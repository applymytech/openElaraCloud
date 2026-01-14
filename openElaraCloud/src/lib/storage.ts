import {
  db, storage, auth, doc, getDoc, setDoc, updateDoc, collection, query, where, 
  getDocs, deleteDoc, Timestamp, increment, ref, uploadBytes, getDownloadURL, 
  deleteObject, listAll, getMetadata
} from './firebase';
import { SignedContent, ContentMetadata } from './signing';

// ============================================================================
// STORAGE QUOTAS
// ============================================================================

export interface StorageQuota {
  used: number;          // Bytes used
  limit: number;         // Bytes allowed
  ragUsed: number;       // RAG data (stays)
  mediaUsed: number;     // Media files (temporary)
}

// Default: 5GB, Max owner can set: 10GB
export const DEFAULT_STORAGE_LIMIT = 5 * 1024 * 1024 * 1024;  // 5 GB
export const MAX_STORAGE_LIMIT = 10 * 1024 * 1024 * 1024;     // 10 GB

export async function getStorageQuota(): Promise<StorageQuota> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const data = userDoc.data();
  
  return {
    used: data?.storageUsed || 0,
    limit: Math.min(data?.storageLimit || DEFAULT_STORAGE_LIMIT, MAX_STORAGE_LIMIT),
    ragUsed: data?.ragStorageUsed || 0,
    mediaUsed: data?.mediaStorageUsed || 0,
  };
}

export async function updateStorageUsage(deltaBytes: number, category: 'rag' | 'media'): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  const userRef = doc(db, 'users', user.uid);
  
  const updates: Record<string, any> = {
    storageUsed: increment(deltaBytes),
  };
  
  if (category === 'rag') {
    updates.ragStorageUsed = increment(deltaBytes);
  } else {
    updates.mediaStorageUsed = increment(deltaBytes);
  }
  
  await updateDoc(userRef, updates);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getQuotaPercentage(quota: StorageQuota): number {
  return Math.round((quota.used / quota.limit) * 100);
}

// ============================================================================
// MEDIA STORAGE (TEMPORARY - DOWNLOAD & DELETE)
// ============================================================================

export interface StoredMedia {
  id: string;
  userId: string;
  filename: string;
  contentType: string;
  size: number;
  storageUrl: string;
  downloadUrl: string;
  metadata: ContentMetadata;
  createdAt: Date;
  expiresAt: Date;        // Auto-delete after this date
  downloaded: boolean;    // Track if user downloaded
}

// Media expires after 30 days if not downloaded
const MEDIA_EXPIRY_DAYS = 30;

/**
 * Store generated media temporarily in cloud storage
 */
export async function storeMedia(
  signedContent: SignedContent, 
  filename: string, 
  contentType: string
): Promise<StoredMedia> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  // Check quota
  const quota = await getStorageQuota();
  const dataUrl = signedContent.dataUrl;
  const base64Data = dataUrl.split(',')[1];
  const binaryData = atob(base64Data);
  const bytes = new Uint8Array(binaryData.length);
  for (let i = 0; i < binaryData.length; i++) {
    bytes[i] = binaryData.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: contentType });
  
  if (quota.used + blob.size > quota.limit) {
    throw new Error(`Storage quota exceeded. Used: ${formatBytes(quota.used)}, Limit: ${formatBytes(quota.limit)}. Please download and delete some files.`);
  }
  
  // Generate unique ID
  const mediaId = `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  // Upload to Firebase Storage
  const storageRef = ref(storage, `users/${user.uid}/media/${mediaId}/${filename}`);
  await uploadBytes(storageRef, blob, {
    contentType,
    customMetadata: {
      originalFilename: filename,
      createdBy: 'elara',
      contentHash: signedContent.metadata.contentHash || '',
    }
  });
  
  const downloadUrl = await getDownloadURL(storageRef);
  
  // Also store the metadata sidecar
  const sidecarRef = ref(storage, `users/${user.uid}/media/${mediaId}/${filename}.metadata.json`);
  const sidecarBlob = new Blob([signedContent.metadataJson], { type: 'application/json' });
  await uploadBytes(sidecarRef, sidecarBlob);
  
  // Create Firestore record
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + MEDIA_EXPIRY_DAYS);
  
  const mediaDoc: Omit<StoredMedia, 'id'> = {
    userId: user.uid,
    filename,
    contentType,
    size: blob.size,
    storageUrl: `users/${user.uid}/media/${mediaId}`,
    downloadUrl,
    metadata: signedContent.metadata,
    createdAt: new Date(),
    expiresAt,
    downloaded: false,
  };
  
  await setDoc(doc(db, 'users', user.uid, 'media', mediaId), {
    ...mediaDoc,
    createdAt: Timestamp.fromDate(mediaDoc.createdAt),
    expiresAt: Timestamp.fromDate(mediaDoc.expiresAt),
  });
  
  // Update storage usage
  await updateStorageUsage(blob.size + sidecarBlob.size, 'media');
  
  return { id: mediaId, ...mediaDoc };
}

/**
 * List all stored media for current user
 */
export async function listStoredMedia(): Promise<StoredMedia[]> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  const mediaQuery = query(
    collection(db, 'users', user.uid, 'media')
  );
  
  const snapshot = await getDocs(mediaQuery);
  
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      expiresAt: data.expiresAt?.toDate() || new Date(),
    } as StoredMedia;
  });
}

/**
 * Download media with metadata sidecar (CUT operation - marks for deletion)
 * Returns a ZIP blob containing the media file and its metadata sidecar
 */
export async function downloadMediaWithSidecar(mediaId: string): Promise<{
  mediaBlob: Blob;
  sidecarBlob: Blob;
  filename: string;
}> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  // Get media record
  const mediaDoc = await getDoc(doc(db, 'users', user.uid, 'media', mediaId));
  if (!mediaDoc.exists()) throw new Error('Media not found');
  
  const media = mediaDoc.data() as StoredMedia;
  
  // Download both files
  const mediaRef = ref(storage, `${media.storageUrl}/${media.filename}`);
  const sidecarRef = ref(storage, `${media.storageUrl}/${media.filename}.metadata.json`);
  
  const [mediaUrl, sidecarUrl] = await Promise.all([
    getDownloadURL(mediaRef),
    getDownloadURL(sidecarRef),
  ]);
  
  const [mediaResponse, sidecarResponse] = await Promise.all([
    fetch(mediaUrl),
    fetch(sidecarUrl),
  ]);
  
  const mediaBlob = await mediaResponse.blob();
  const sidecarBlob = await sidecarResponse.blob();
  
  // Mark as downloaded (will be auto-deleted sooner)
  await updateDoc(doc(db, 'users', user.uid, 'media', mediaId), {
    downloaded: true,
  });
  
  return {
    mediaBlob,
    sidecarBlob,
    filename: media.filename,
  };
}

/**
 * Delete media after download (completing the CUT operation)
 */
export async function deleteMedia(mediaId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  // Get media record
  const mediaDocRef = doc(db, 'users', user.uid, 'media', mediaId);
  const mediaDoc = await getDoc(mediaDocRef);
  if (!mediaDoc.exists()) return;
  
  const media = mediaDoc.data() as StoredMedia;
  
  // Delete from Storage
  try {
    const mediaRef = ref(storage, `${media.storageUrl}/${media.filename}`);
    const sidecarRef = ref(storage, `${media.storageUrl}/${media.filename}.metadata.json`);
    await Promise.all([
      deleteObject(mediaRef),
      deleteObject(sidecarRef),
    ]);
  } catch (e) {
    console.warn('Error deleting storage files:', e);
  }
  
  // Delete Firestore record
  await deleteDoc(mediaDocRef);
  
  // Update storage usage (negative delta)
  await updateStorageUsage(-(media.size + 1000), 'media'); // +1000 for sidecar estimate
}

/**
 * Download and delete in one operation (true CUT behavior)
 */
export async function cutMedia(mediaId: string): Promise<void> {
  const { mediaBlob, sidecarBlob, filename } = await downloadMediaWithSidecar(mediaId);
  
  // Trigger browser download for both files
  const downloadFile = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  downloadFile(mediaBlob, filename);
  downloadFile(sidecarBlob, `${filename}.metadata.json`);
  
  // Delete from cloud
  await deleteMedia(mediaId);
}

/**
 * Store media from a remote URL (for video generation results)
 * Fetches the content and stores with basic metadata
 */
export async function storeMediaFromUrl(
  url: string,
  filename: string,
  contentType: string,
  metadata?: Record<string, any>
): Promise<StoredMedia> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  // Fetch the content from URL
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch media from URL');
  }
  const blob = await response.blob();
  
  // Check quota
  const quota = await getStorageQuota();
  if (quota.used + blob.size > quota.limit) {
    throw new Error(`Storage quota exceeded. Used: ${formatBytes(quota.used)}, Limit: ${formatBytes(quota.limit)}. Please download and delete some files.`);
  }
  
  // Generate unique ID
  const mediaId = `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  // Upload to Firebase Storage
  const storageRef = ref(storage, `users/${user.uid}/media/${mediaId}/${filename}`);
  await uploadBytes(storageRef, blob, {
    contentType,
    customMetadata: {
      originalFilename: filename,
      createdBy: 'elara',
      ...metadata,
    }
  });
  
  const downloadUrl = await getDownloadURL(storageRef);
  
  // Create Firestore record
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry
  
  // Determine content type for metadata
  const metaContentType: 'image' | 'video' | 'audio' = 
    contentType.startsWith('video') ? 'video' : 
    contentType.startsWith('audio') ? 'audio' : 'image';
  
  const basicMetadata: ContentMetadata = {
    installationId: 'elara-cloud',
    signatureVersion: '1.0',
    generatedAt: new Date().toISOString(),
    contentType: metaContentType,
    characterId: metadata?.character || 'custom',
    characterName: metadata?.character || 'Custom',
    modelUsed: metadata?.model || 'unknown',
    promptHash: '', // Not tracking for URL-based storage
    contentHash: '',
  };
  
  const mediaDoc: Omit<StoredMedia, 'id'> = {
    userId: user.uid,
    filename,
    contentType,
    size: blob.size,
    storageUrl: `users/${user.uid}/media/${mediaId}`,
    downloadUrl,
    metadata: basicMetadata,
    createdAt: new Date(),
    expiresAt,
    downloaded: false,
  };
  
  await setDoc(doc(db, 'users', user.uid, 'media', mediaId), {
    ...mediaDoc,
    createdAt: Timestamp.fromDate(mediaDoc.createdAt),
    expiresAt: Timestamp.fromDate(mediaDoc.expiresAt),
  });
  
  // Update storage usage
  await updateStorageUsage(blob.size, 'media');
  
  return { id: mediaId, ...mediaDoc };
}

// ============================================================================
// STORAGE STATUS COMPONENT DATA
// ============================================================================

export interface StorageStatus {
  quota: StorageQuota;
  mediaFiles: StoredMedia[];
  percentUsed: number;
  warningLevel: 'ok' | 'warning' | 'critical';
  downloadRecommended: boolean;
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const quota = await getStorageQuota();
  const mediaFiles = await listStoredMedia();
  const percentUsed = getQuotaPercentage(quota);
  
  let warningLevel: 'ok' | 'warning' | 'critical' = 'ok';
  if (percentUsed >= 90) warningLevel = 'critical';
  else if (percentUsed >= 70) warningLevel = 'warning';
  
  // Recommend download if any media is older than 7 days or not downloaded
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const downloadRecommended = mediaFiles.some(
    m => !m.downloaded || m.createdAt < sevenDaysAgo
  );
  
  return {
    quota,
    mediaFiles,
    percentUsed,
    warningLevel,
    downloadRecommended,
  };
}

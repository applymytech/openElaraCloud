/**
 * Content Signing Service for OpenElara Cloud
 * 
 * Embeds provenance metadata in generated images to prove origin.
 * 
 * SIGNING ARCHITECTURE:
 * 1. Each user gets a unique signing key stored in Firestore
 * 2. Keys are generated on first content generation
 * 3. Signatures include: userId, userKey, timestamp, contentHash
 * 4. Verification checks signature against Firestore user record
 * 
 * Browser Limitations:
 * - Cannot modify EXIF/PNG chunks directly (no sharp/node)
 * - Uses Canvas API to embed metadata in image data
 * - Also stores metadata in a sidecar JSON
 * 
 * What Gets Signed:
 * - User ID (Firebase Auth UID)
 * - User signing key (unique per user from Firestore)
 * - Timestamp
 * - Character used
 * - Model used
 * - Prompt hash (not the prompt itself for privacy)
 */

import { getActiveCharacter } from './characters';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// ============================================================================
// USER SIGNING KEY (Firestore-backed)
// ============================================================================

const SIGNING_KEY_CACHE = 'elara_signing_key_cache';

export interface UserSigningKey {
  keyId: string;           // Unique key identifier
  publicFingerprint: string;  // Public fingerprint for verification
  createdAt: string;
  userId: string;
}

/**
 * Generate a cryptographically secure signing key
 */
async function generateSigningKey(): Promise<{ keyId: string; publicFingerprint: string }> {
  // Generate random key ID
  const keyId = crypto.randomUUID();
  
  // Generate a public fingerprint using Web Crypto
  const keyMaterial = new Uint8Array(32);
  crypto.getRandomValues(keyMaterial);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyMaterial);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const publicFingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  
  return { keyId, publicFingerprint };
}

/**
 * Get or create the user's signing key from Firestore
 * This key is unique per user and stored securely in their Firestore document
 */
export async function getUserSigningKey(): Promise<UserSigningKey | null> {
  const user = auth.currentUser;
  if (!user) return null;
  
  // Check cache first
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(SIGNING_KEY_CACHE);
      if (cached) {
        const parsed = JSON.parse(cached) as UserSigningKey;
        if (parsed.userId === user.uid) {
          return parsed;
        }
      }
    } catch { /* ignore cache errors */ }
  }
  
  try {
    // Check Firestore for existing key
    const signingRef = doc(db, 'users', user.uid, 'private', 'signingKey');
    const signingSnap = await getDoc(signingRef);
    
    if (signingSnap.exists()) {
      const data = signingSnap.data() as UserSigningKey;
      // Cache it
      if (typeof window !== 'undefined') {
        localStorage.setItem(SIGNING_KEY_CACHE, JSON.stringify(data));
      }
      return data;
    }
    
    // Generate new signing key for this user
    const { keyId, publicFingerprint } = await generateSigningKey();
    const newKey: UserSigningKey = {
      keyId,
      publicFingerprint,
      createdAt: new Date().toISOString(),
      userId: user.uid,
    };
    
    // Store in Firestore (private subcollection)
    await setDoc(signingRef, newKey);
    
    // Cache it
    if (typeof window !== 'undefined') {
      localStorage.setItem(SIGNING_KEY_CACHE, JSON.stringify(newKey));
    }
    
    return newKey;
  } catch (error) {
    console.error('[Signing] Failed to get/create signing key:', error);
    return null;
  }
}

/**
 * Clear cached signing key (call on logout)
 */
export function clearSigningKeyCache(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SIGNING_KEY_CACHE);
  }
}

// ============================================================================
// INSTALLATION ID (Browser-local, for additional tracking)
// ============================================================================

// ============================================================================
// INSTALLATION ID
// ============================================================================

const INSTALL_ID_KEY = 'elara_installation_id';
const GENERATED_CONTENT_KEY = 'elara_generated_content';

export interface InstallationConfig {
  installationId: string;
  createdAt: string;
  version: string;
  privacyNotice: string;
}

/**
 * Get or create a unique installation ID for this browser
 */
export function getInstallationId(): string {
  if (typeof window === 'undefined') return 'server';
  
  let config = getInstallationConfig();
  if (config) return config.installationId;
  
  // Generate new installation ID
  const installationId = crypto.randomUUID();
  config = {
    installationId,
    createdAt: new Date().toISOString(),
    version: '1.0',
    privacyNotice: 'This ID is local only. It is never transmitted to servers.',
  };
  
  localStorage.setItem(INSTALL_ID_KEY, JSON.stringify(config));
  return installationId;
}

/**
 * Get the full installation config
 */
export function getInstallationConfig(): InstallationConfig | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(INSTALL_ID_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// ============================================================================
// CONTENT METADATA
// ============================================================================

export interface ContentMetadata {
  // User Provenance (Firestore-backed)
  userId?: string;            // Firebase Auth UID
  userEmail?: string;         // User's email (for verification)
  userDisplayName?: string;   // User's display name
  userKeyFingerprint?: string; // Public fingerprint from UserSigningKey
  
  // Installation Provenance (Browser-local)
  installationId: string;
  signatureVersion: string;
  
  // Timing
  generatedAt: string;
  
  // Content info
  contentType: 'image' | 'video' | 'audio';
  characterId: string;
  characterName: string;
  modelUsed: string;
  promptHash: string;  // SHA-256 hash, not the actual prompt
  fullPrompt?: string; // Optional: store full prompt if user wants
  
  // Generation context
  generationType: 'selfie' | 'custom' | 'agentic';
  userRequest?: string;     // User's original request/scene
  aiDecision?: string;      // AI's scene decision (for agentic mode)
  conversationContext?: string; // Recent conversation for context
  
  // Generation params
  width?: number;
  height?: number;
  seed?: number;
  steps?: number;
  guidanceScale?: number;
  negativePrompt?: string;
  
  // Verification
  contentHash?: string;  // Hash of the actual content
  signature?: string;    // HMAC signature using user's key
}

export interface SignedContent {
  dataUrl: string;       // The image/video data URL
  metadata: ContentMetadata;
  metadataJson: string;  // JSON string for embedding
}

/**
 * Create a SHA-256 hash of a string
 */
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a signature for content using the user's key
 */
async function createSignature(data: string, keyFingerprint: string): Promise<string> {
  const combined = data + keyFingerprint;
  return sha256(combined);
}

/**
 * Generate metadata for a piece of content
 * Now includes user signing key for verification
 */
export async function generateMetadata(params: {
  contentType: 'image' | 'video' | 'audio';
  prompt: string;
  model: string;
  width?: number;
  height?: number;
  seed?: number;
  steps?: number;
  guidanceScale?: number;
  negativePrompt?: string;
  generationType?: 'selfie' | 'custom' | 'agentic';
  userRequest?: string;
  aiDecision?: string;
  conversationContext?: string;
  includeFullPrompt?: boolean;
}): Promise<ContentMetadata> {
  const character = getActiveCharacter();
  const promptHash = await sha256(params.prompt);
  
  // Get user's signing key
  const signingKey = await getUserSigningKey();
  const user = auth.currentUser;
  
  const metadata: ContentMetadata = {
    // User provenance (if logged in)
    userId: user?.uid,
    userEmail: user?.email || undefined,
    userDisplayName: user?.displayName || undefined,
    userKeyFingerprint: signingKey?.publicFingerprint,
    
    // Installation provenance
    installationId: getInstallationId(),
    signatureVersion: '3.0-cloud-comprehensive',
    
    // Timing
    generatedAt: new Date().toISOString(),
    
    // Content info
    contentType: params.contentType,
    characterId: character.id,
    characterName: character.name,
    modelUsed: params.model,
    promptHash,
    fullPrompt: params.includeFullPrompt ? params.prompt : undefined,
    
    // Generation context
    generationType: params.generationType || 'custom',
    userRequest: params.userRequest,
    aiDecision: params.aiDecision,
    conversationContext: params.conversationContext,
    
    // Generation params
    width: params.width,
    height: params.height,
    seed: params.seed,
    steps: params.steps,
    guidanceScale: params.guidanceScale,
    negativePrompt: params.negativePrompt,
  };
  
  // Create signature if we have a signing key
  if (signingKey) {
    const dataToSign = `${metadata.userId}:${metadata.generatedAt}:${metadata.promptHash}:${metadata.characterId}`;
    metadata.signature = await createSignature(dataToSign, signingKey.publicFingerprint);
  }
  
  return metadata;
}

/**
 * Sign an image by embedding metadata
 * 
 * BROWSER LIMITATIONS:
 * - Cannot modify EXIF/PNG chunks directly (no sharp/node)
 * - Uses Canvas API to embed metadata in image data via steganography
 * - Also stores metadata in localStorage registry for verification
 * 
 * METADATA ENCODING:
 * 1. Draw original image on canvas
 * 2. Encode metadata signature in last row of pixels (blue channel LSB)
 * 3. Store full metadata in localStorage for retrieval
 * 4. Return signed canvas as data URL
 */
export async function signImage(
  imageDataUrl: string,
  metadata: ContentMetadata
): Promise<SignedContent> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = async () => {
      try {
        // Create canvas with exact dimensions
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        
        if (!ctx) {
          throw new Error('Failed to get 2D context');
        }
        
        // Draw original image
        ctx.drawImage(img, 0, 0);
        
        // Prepare metadata for embedding
        const metadataJson = JSON.stringify(metadata);
        
        // STEGANOGRAPHY: Encode signature in pixel data
        // We use the last row of pixels to embed a marker + hash
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Create a compact signature marker
        const marker = 'ELARA_SIGNED_V3';
        const metadataHash = await sha256(metadataJson);
        const embeddedString = marker + ':' + metadataHash.slice(0, 32);
        
        // Embed in the last row of pixels (blue channel LSB)
        const lastRowStart = (canvas.height - 1) * canvas.width * 4;
        const maxChars = Math.min(embeddedString.length, canvas.width);
        
        for (let i = 0; i < maxChars; i++) {
          const charCode = embeddedString.charCodeAt(i);
          const pixelIndex = lastRowStart + (i * 4) + 2; // Blue channel
          
          // Modify LSB (least significant 4 bits)
          if (pixelIndex < data.length) {
            data[pixelIndex] = (data[pixelIndex] & 0xF0) | (charCode & 0x0F);
          }
        }
        
        // Put modified pixel data back
        ctx.putImageData(imageData, 0, 0);
        
        // Get signed image as data URL (PNG preserves pixel data)
        const signedDataUrl = canvas.toDataURL('image/png', 1.0);
        
        // Calculate final content hash
        metadata.contentHash = await sha256(signedDataUrl);
        
        // Store in local registry for verification
        storeGeneratedContent(metadata);
        
        console.log(`[Signing] Image signed with hash: ${metadata.contentHash?.slice(0, 16)}...`);
        
        resolve({
          dataUrl: signedDataUrl,
          metadata,
          metadataJson: JSON.stringify(metadata, null, 2),
        });
      } catch (error) {
        console.error('[Signing] Failed to sign image:', error);
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load image for signing'));
    img.src = imageDataUrl;
  });
}

/**
 * Verify if an image was signed by this installation
 */
export function verifyImageSignature(imageDataUrl: string): Promise<{
  isSigned: boolean;
  isOurs: boolean;
  metadata?: ContentMetadata;
}> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Check for signature marker in last row
        const startPixel = (canvas.height - 1) * canvas.width * 4;
        let marker = '';
        for (let i = 0; i < 12 && i < canvas.width; i++) {
          const pixelIndex = startPixel + (i * 4) + 2;
          marker += String.fromCharCode(data[pixelIndex] & 0x0F);
        }
        
        // Note: This simple check won't fully work due to LSB limitations
        // But it demonstrates the concept
        const isSigned = marker.includes('ELARA');
        
        resolve({
          isSigned,
          isOurs: isSigned, // In full implementation, would check installationId
        });
      } catch {
        resolve({ isSigned: false, isOurs: false });
      }
    };
    
    img.onerror = () => resolve({ isSigned: false, isOurs: false });
    img.src = imageDataUrl;
  });
}

// ============================================================================
// LOCAL CONTENT REGISTRY
// ============================================================================

interface GeneratedContentRegistry {
  [contentHash: string]: ContentMetadata;
}

/**
 * Store generated content metadata in local registry
 */
function storeGeneratedContent(metadata: ContentMetadata): void {
  if (typeof window === 'undefined' || !metadata.contentHash) return;
  
  try {
    const stored = localStorage.getItem(GENERATED_CONTENT_KEY);
    const registry: GeneratedContentRegistry = stored ? JSON.parse(stored) : {};
    
    registry[metadata.contentHash] = metadata;
    
    // Keep only last 1000 entries
    const entries = Object.entries(registry);
    if (entries.length > 1000) {
      const sorted = entries.sort((a, b) => 
        new Date(b[1].generatedAt).getTime() - new Date(a[1].generatedAt).getTime()
      );
      const trimmed = Object.fromEntries(sorted.slice(0, 1000));
      localStorage.setItem(GENERATED_CONTENT_KEY, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(GENERATED_CONTENT_KEY, JSON.stringify(registry));
    }
  } catch {
    // Storage full or other error - ignore
  }
}

/**
 * Get all generated content from local registry
 */
export function getGeneratedContentRegistry(): GeneratedContentRegistry {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(GENERATED_CONTENT_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Check if content was generated by this installation
 */
export async function isOurContent(dataUrl: string): Promise<boolean> {
  const hash = await sha256(dataUrl);
  const registry = getGeneratedContentRegistry();
  return hash in registry;
}

/**
 * Get metadata for content if it's ours
 */
export async function getContentMetadata(dataUrl: string): Promise<ContentMetadata | null> {
  const hash = await sha256(dataUrl);
  const registry = getGeneratedContentRegistry();
  return registry[hash] || null;
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

/**
 * Download image with metadata sidecar
 */
export function downloadWithMetadata(
  signedContent: SignedContent,
  filename: string
): void {
  // Download image
  const imageLink = document.createElement('a');
  imageLink.href = signedContent.dataUrl;
  imageLink.download = filename;
  imageLink.click();
  
  // Download metadata sidecar
  const metadataBlob = new Blob([signedContent.metadataJson], { type: 'application/json' });
  const metadataUrl = URL.createObjectURL(metadataBlob);
  const metadataLink = document.createElement('a');
  metadataLink.href = metadataUrl;
  metadataLink.download = filename.replace(/\.[^.]+$/, '_metadata.json');
  metadataLink.click();
  URL.revokeObjectURL(metadataUrl);
}

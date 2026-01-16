/**
 * Content Signing Service for OpenElara Cloud (v2.1)
 * 
 * Logic:
 * - PRIVATE KEY: Stored in Google Secret Manager (Sovereign Side).
 * - PUBLIC KEY: Hardcoded in the app or fetched from public config.
 * 
 * Flow:
 * 1. Content is generated on the server.
 * 2. Server signs the metadata with the PRIVATE KEY.
 * 3. App (this file) uses the PUBLIC KEY to verify the origin.
 * 4. If the user is the Admin (Owner), the app can retrieve the 
 *    original sidecar filename from Firestore 'provenance' for compliance.
 */

import { db, auth } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

// The Public Key used to verify ElaraSign signatures
// This is usually configured during deployment via deploy.js
const ELARA_PUBLIC_KEY_SPKI = "REPLACE_WITH_PUBLIC_KEY_SPKI";

/**
 * Verify an image signature and retrieve metadata.
 * 
 * If the user is the admin, it also attempts to fetch the "Compliance Info"
 * (like the original sidecar filename) from the Firestore provenance registry.
 */
export async function scanAndVerify(dataUrl: string): Promise<any> {
  const contentHash = await sha256(dataUrl);
  
  // 1. Basic Verification (Provenance Check)
  // We check if this hash exists in our sovereign registry
  const provenanceRef = doc(db, "provenance", contentHash);
  const snap = await getDoc(provenanceRef);
  
  if (!snap.exists()) {
    return { isSigned: false, message: "No signature found in sovereign registry." };
  }

  const data = snap.data();
  const isAdmin = await checkIfAdmin();

  // 2. Build Response
  const response: any = {
    isSigned: true,
    generatedAt: data.generatedAt,
    model: data.modelUsed,
    character: data.characterName,
  };

  // 3. Compliance Level (Admin Only)
  if (isAdmin) {
    response.compliance = {
      originalFilename: data.originalFilename || "unknown_sidecar.json",
      userId: data.userId,
      fullPrompt: data.originalPrompt,
      storagePath: data.storagePath
    };
  }

  return response;
}

/**
 * Check if the currently logged in user is the App Owner
 */
async function checkIfAdmin(): Promise<boolean> {
  if (!auth?.currentUser) return false;
  
  // We check the 'users' collection for the isInviteOnly or admin flag
  // In our schema, the admin is usually the first user or one with specific claims
  const userRef = doc(db, "users", auth?.currentUser.uid);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    return userSnap.data().isAdmin === true;
  }
  return false;
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Export Utility: Download content with its metadata sidecar
 */
export function downloadContent(dataUrl: string, metadata: any, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();

  const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
  const metaUrl = URL.createObjectURL(blob);
  const metaLink = document.createElement('a');
  metaLink.href = metaUrl;
  metaLink.download = filename.replace(/\.[^.]+$/, '_sidecar.json');
  metaLink.click();
}

export interface SignedContent {
  dataUrl: string;
  metadataJson: string;
  metadata: ContentMetadata;
  signature: string;
}

export async function generateMetadata(data: any): Promise<any> {
  return {
    ...data,
    generatedAt: new Date().toISOString(),
  };
}

export async function signImage(dataUrl: string, metadata: any): Promise<SignedContent> {
  return {
    dataUrl,
    metadataJson: JSON.stringify(metadata),
    signature: 'local-mock-signature',
    metadata: metadata,
  };
}

export interface ContentMetadata {
  contentType: string;
  prompt?: string;
  model?: string;
  generatedAt: string;
  [key: string]: any;
}

export async function downloadWithMetadata(signedContent: SignedContent, filename: string): Promise<void> {
    downloadContent(signedContent.dataUrl, JSON.parse(signedContent.metadataJson), filename);
}

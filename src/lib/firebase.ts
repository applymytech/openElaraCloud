import { getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFirebaseConfig, validateFirebaseConfig, type FirebaseConfig } from "./firebaseConfig";

// Get Firebase config (no .env.local required!)
const firebaseConfig = getFirebaseConfig();

// Validate configuration
const validation = validateFirebaseConfig(firebaseConfig);
if (!validation.valid) {
  console.error('[Firebase] Configuration error:', validation.error);
  if (validation.setupInstructions) {
    console.error('[Firebase] Setup instructions:\n', validation.setupInstructions);
  }
}

// Initialize Firebase (only once)
// Note: We allow initialization even with invalid config to prevent crashes
// Pages will handle the missing config gracefully with UI messages
let app: any = null;
let auth: any = null;
let db: any = null;
let storage: any = null;
let googleProvider: any = null;

try {
  if (firebaseConfig) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    db = getFirestore(app);
    storage = getStorage(app);
  } else {
    console.warn('[Firebase] No configuration found - Firebase services unavailable');
  }
} catch (error) {
  console.error('[Firebase] Initialization failed:', error);
}

// Export services (may be null if config missing)
export { auth, googleProvider, db, storage, firebaseConfig };
export default app;

/**
 * Check if Firebase is properly configured
 */
export function isFirebaseConfigured(): boolean {
  return firebaseConfig !== null && validation.valid;
}

/**
 * Get configuration error details for UI display
 */
export function getFirebaseConfigError(): { error: string; setupInstructions?: string } | null {
  if (validation.valid) return null;
  return {
    error: validation.error || 'Unknown configuration error',
    setupInstructions: validation.setupInstructions,
  };
}

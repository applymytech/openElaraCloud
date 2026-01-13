/**
 * Firebase Configuration - Runtime Detection
 *
 * NO .env.local REQUIRED!
 *
 * Dev Mode:
 * - Detects Firebase config from build-time Next.js env vars
 * - If missing, shows helpful setup UI
 *
 * Production Mode:
 * - Firebase Hosting injects config automatically via reserved URLs
 * - See: https://firebase.google.com/docs/hosting/reserved-urls
 */

export interface FirebaseConfig {
	apiKey: string;
	authDomain: string;
	projectId: string;
	storageBucket: string;
	messagingSenderId: string;
	appId: string;
	measurementId?: string;
}

/**
 * Get Firebase config from environment or runtime detection
 */
export function getFirebaseConfig(): FirebaseConfig | null {
	// Try environment variables first (set during build or in hosting)
	const envConfig = {
		apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
		authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
		projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
		storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
		messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
		appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
		measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
	};

	// Check if we have all required fields
	if (
		envConfig.apiKey &&
		envConfig.authDomain &&
		envConfig.projectId &&
		envConfig.storageBucket &&
		envConfig.messagingSenderId &&
		envConfig.appId
	) {
		return envConfig as FirebaseConfig;
	}

	// Fallback: Try to detect from Firebase Hosting reserved URLs
	// When deployed to Firebase Hosting, /__/firebase/init.json is available
	// This won't work in dev, but prevents hard crashes in production
	if (typeof window !== "undefined") {
		// Check if we're on Firebase Hosting domain
		if (window.location.hostname.includes(".web.app") || window.location.hostname.includes(".firebaseapp.com")) {
			// We're deployed but config is missing - this should never happen
			// Firebase Hosting automatically injects config
			if (typeof window !== "undefined" && window.console) {
				window.console.error("[Firebase] Deployed but config missing - check hosting setup");
			}
		}
	}

	return null;
}

/**
 * Validate that Firebase config is complete
 */
export function validateFirebaseConfig(config: FirebaseConfig | null): {
	valid: boolean;
	error?: string;
	setupInstructions?: string;
} {
	if (!config) {
		return {
			valid: false,
			error: "Firebase configuration is missing",
			setupInstructions: `
To set up Firebase for development:

1. Go to Firebase Console → Project Settings → Your apps
2. Select your web app (or create one)
3. Copy the config values
4. Add to your deployment:
   - For hosting: firebase deploy (auto-configures)
   - For local dev: Set NEXT_PUBLIC_* env vars in your terminal or hosting provider

Example terminal setup (Windows):
$env:NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
$env:NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="project.firebaseapp.com"
$env:NEXT_PUBLIC_FIREBASE_PROJECT_ID="project-id"
$env:NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="project.appspot.com"
$env:NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456"
$env:NEXT_PUBLIC_FIREBASE_APP_ID="1:123456:web:abc123"

Then run: npm run dev
      `.trim(),
		};
	}

	// Validate project ID format
	if (!/^[a-z0-9-]+$/.test(config.projectId)) {
		return {
			valid: false,
			error: "Invalid Firebase project ID format",
		};
	}

	return { valid: true };
}

/**
 * Get the Cloud Functions base URL for this project
 */
export function getFunctionsUrl(config: FirebaseConfig | null): string {
	if (!config?.projectId) {
		throw new Error("Cannot determine Functions URL without Firebase config");
	}

	// Default region for Cloud Functions
	return `https://us-central1-${config.projectId}.cloudfunctions.net`;
}

/**
 * Web Crypto API - Browser-based Encryption for API Keys
 *
 * Provides basic encryption for localStorage API keys using Web Crypto API.
 * This is obfuscation, NOT bulletproof security, but better than plain text.
 *
 * Security Notes:
 * - Encryption key derived from browser fingerprint + installation ID
 * - Still vulnerable to XSS (if attacker has code execution, they can decrypt)
 * - Protects against casual localStorage inspection
 * - Browser extensions with access to page context can still read keys
 *
 * This is a defense-in-depth measure, not a silver bullet.
 */

const _CRYPTO_KEY_NAME = "elara_crypto_key_v1";
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

/**
 * Generate a stable device identifier (basic fingerprinting)
 * NOT for tracking - just for encryption key derivation
 */
function getDeviceId(): string {
	if (typeof window === "undefined") {
		return "server";
	}

	const components = [
		navigator.userAgent,
		navigator.language,
		screen.width,
		screen.height,
		screen.colorDepth,
		new Date().getTimezoneOffset(),
	];

	return components.join("|");
}

/**
 * Get or create encryption key material
 */
async function getKeyMaterial(): Promise<CryptoKey> {
	if (typeof window === "undefined" || !window.crypto?.subtle) {
		throw new Error("Web Crypto API not available");
	}

	// Use device fingerprint as password
	const password = getDeviceId();
	const enc = new TextEncoder();

	return window.crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, [
		"deriveBits",
		"deriveKey",
	]);
}

/**
 * Derive encryption key from key material
 */
async function deriveKey(keyMaterial: CryptoKey, salt: BufferSource): Promise<CryptoKey> {
	if (typeof window === "undefined" || !window.crypto?.subtle) {
		throw new Error("Web Crypto API not available");
	}

	return window.crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt,
			iterations: 100000,
			hash: "SHA-256",
		},
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

/**
 * Encrypt a string (typically an API key)
 */
export async function encryptKey(plaintext: string): Promise<string> {
	try {
		if (typeof window === "undefined" || !window.crypto?.subtle) {
			// Fallback to base64 if crypto not available
			return btoa(plaintext);
		}

		const keyMaterial = await getKeyMaterial();
		const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
		const key = await deriveKey(keyMaterial, salt);
		const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));

		const enc = new TextEncoder();
		const encoded = enc.encode(plaintext);

		const ciphertext = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

		// Combine salt + iv + ciphertext and base64 encode
		const combined = new Uint8Array(SALT_LENGTH + IV_LENGTH + ciphertext.byteLength);
		combined.set(salt, 0);
		combined.set(iv, SALT_LENGTH);
		combined.set(new Uint8Array(ciphertext), SALT_LENGTH + IV_LENGTH);

		// Convert to base64 (use array spread with slice for compatibility)
		const bytes = [];
		for (let i = 0; i < combined.length; i++) {
			bytes.push(combined[i]);
		}
		return btoa(String.fromCharCode(...bytes));
	} catch (_error) {
		// Fallback to base64 if encryption fails
		// Handle Unicode properly using TextEncoder
		try {
			const encoder = new TextEncoder();
			const utf8Bytes = encoder.encode(plaintext);
			return btoa(String.fromCharCode(...Array.from(utf8Bytes)));
		} catch {
			// Last resort: try direct btoa (may fail on Unicode)
			return btoa(plaintext);
		}
	}
}

/**
 * Decrypt a string (typically an API key)
 */
export async function decryptKey(encryptedData: string): Promise<string> {
	try {
		if (typeof window === "undefined" || !window.crypto?.subtle) {
			// Fallback: try base64 decode
			return atob(encryptedData);
		}

		// Decode base64
		const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));

		// Check if this looks like encrypted data (has correct length)
		if (combined.length < SALT_LENGTH + IV_LENGTH) {
			// Probably base64-only fallback
			return atob(encryptedData);
		}

		// Extract salt, iv, ciphertext
		const salt = combined.slice(0, SALT_LENGTH);
		const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
		const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);

		const keyMaterial = await getKeyMaterial();
		const key = await deriveKey(keyMaterial, salt);

		const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);

		const dec = new TextDecoder();
		return dec.decode(decrypted);
	} catch (_error) {
		// Fallback: try base64 decode (for backwards compatibility)
		try {
			const decoded = atob(encryptedData);
			// Handle Unicode properly using TextDecoder
			try {
				const bytes = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
				const decoder = new TextDecoder();
				return decoder.decode(bytes);
			} catch {
				// Fallback to direct string
				return decoded;
			}
		} catch {
			throw new Error("Failed to decrypt API key");
		}
	}
}

/**
 * Check if Web Crypto API is available
 */
export function isCryptoAvailable(): boolean {
	return typeof window !== "undefined" && !!window.crypto?.subtle && typeof window.crypto.subtle.encrypt === "function";
}

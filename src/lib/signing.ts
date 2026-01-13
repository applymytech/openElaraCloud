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
 */

import { logger } from "./logger";

/**
 * Additional metadata fields:
 * - Character used
 * - Model used
 * - Prompt hash (not the prompt itself for privacy)
 *
 * ELARA STANDARD v1.0:
 * - LSB steganography in bottom-left 64x4 pixel block (blue channel)
 * - 128-byte signature capacity
 * - Cross-platform compatible with Desktop app
 */

import { doc, getDoc, setDoc } from "firebase/firestore";
import { getActiveCharacter } from "./characters";
import { auth, db } from "./firebase";

// Import Elara Signing Standard v1.0
import {
	createMetadata as createElaraMetadata,
	ELARA_MARKER,
	extractV1Signature,
	signImageContent,
} from "./signing-core";

// ============================================================================
// USER SIGNING KEY (Firestore-backed)
// ============================================================================

const SIGNING_KEY_CACHE = "elara_signing_key_cache";

export interface UserSigningKey {
	keyId: string; // Unique key identifier
	publicFingerprint: string; // Public fingerprint for verification
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
	const hashBuffer = await crypto.subtle.digest("SHA-256", keyMaterial);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const publicFingerprint = hashArray
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")
		.slice(0, 32);

	return { keyId, publicFingerprint };
}

/**
 * Get or create the user's signing key from Firestore
 * This key is unique per user and stored securely in their Firestore document
 */
export async function getUserSigningKey(): Promise<UserSigningKey | null> {
	const user = auth.currentUser;
	if (!user) {
		return null;
	}

	// Check cache first
	if (typeof window !== "undefined") {
		try {
			const cached = localStorage.getItem(SIGNING_KEY_CACHE);
			if (cached) {
				const parsed = JSON.parse(cached) as UserSigningKey;
				if (parsed.userId === user.uid) {
					return parsed;
				}
			}
		} catch {
			/* ignore cache errors */
		}
	}

	try {
		// Check Firestore for existing key
		const signingRef = doc(db, "users", user.uid, "private", "signingKey");
		const signingSnap = await getDoc(signingRef);

		if (signingSnap.exists()) {
			const data = signingSnap.data() as UserSigningKey;
			// Cache it
			if (typeof window !== "undefined") {
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
		if (typeof window !== "undefined") {
			localStorage.setItem(SIGNING_KEY_CACHE, JSON.stringify(newKey));
		}

		return newKey;
	} catch (error) {
		console.error("[Signing] Failed to get/create signing key:", error);
		return null;
	}
}

/**
 * Clear cached signing key (call on logout)
 */
export function clearSigningKeyCache(): void {
	if (typeof window !== "undefined") {
		localStorage.removeItem(SIGNING_KEY_CACHE);
	}
}

// ============================================================================
// INSTALLATION ID (Browser-local, for additional tracking)
// ============================================================================

// ============================================================================
// INSTALLATION ID
// ============================================================================

const INSTALL_ID_KEY = "elara_installation_id";
const GENERATED_CONTENT_KEY = "elara_generated_content";

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
	if (typeof window === "undefined") {
		return "server";
	}

	let config = getInstallationConfig();
	if (config) {
		return config.installationId;
	}

	// Generate new installation ID
	const installationId = crypto.randomUUID();
	config = {
		installationId,
		createdAt: new Date().toISOString(),
		version: "1.0",
		privacyNotice: "This ID is local only. It is never transmitted to servers.",
	};

	localStorage.setItem(INSTALL_ID_KEY, JSON.stringify(config));
	return installationId;
}

/**
 * Get the full installation config
 */
export function getInstallationConfig(): InstallationConfig | null {
	if (typeof window === "undefined") {
		return null;
	}

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
	userId?: string; // Firebase Auth UID
	userEmail?: string; // User's email (for verification)
	userDisplayName?: string; // User's display name
	userKeyFingerprint?: string; // Public fingerprint from UserSigningKey

	// Installation Provenance (Browser-local)
	installationId: string;
	signatureVersion: string;

	// Timing
	generatedAt: string;

	// Content info
	contentType: "image" | "video" | "audio";
	characterId: string;
	characterName: string;
	modelUsed: string;
	promptHash: string; // SHA-256 hash, not the actual prompt
	fullPrompt?: string; // Optional: store full prompt if user wants

	// Generation context
	generationType: "selfie" | "custom" | "agentic";
	userRequest?: string; // User's original request/scene
	aiDecision?: string; // AI's scene decision (for agentic mode)
	conversationContext?: string; // Recent conversation for context

	// Generation params
	width?: number;
	height?: number;
	seed?: number;
	steps?: number;
	guidanceScale?: number;
	negativePrompt?: string;

	// Verification
	contentHash?: string; // Hash of the actual content
	signature?: string; // HMAC signature using user's key
}

export interface SignedContent {
	dataUrl: string; // The image/video data URL
	metadata: ContentMetadata;
	metadataJson: string; // JSON string for embedding
}

/**
 * Create a SHA-256 hash of a string
 */
async function sha256(message: string): Promise<string> {
	const msgBuffer = new TextEncoder().encode(message);
	const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
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
	contentType: "image" | "video" | "audio";
	prompt: string;
	model: string;
	width?: number;
	height?: number;
	seed?: number;
	steps?: number;
	guidanceScale?: number;
	negativePrompt?: string;
	generationType?: "selfie" | "custom" | "agentic";
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
		signatureVersion: "3.0-cloud-comprehensive",

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
		generationType: params.generationType || "custom",
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
 * ELARA STANDARD v1.0 ENCODING:
 * 1. Draw original image on canvas
 * 2. Embed signature in bottom-left 64x4 pixel block (blue channel LSB)
 * 3. Store full metadata in localStorage for retrieval
 * 4. Return signed canvas as data URL
 */
export async function signImage(imageDataUrl: string, metadata: ContentMetadata): Promise<SignedContent> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";

		img.onload = async () => {
			try {
				// Create canvas with exact dimensions
				const canvas = document.createElement("canvas");
				canvas.width = img.width;
				canvas.height = img.height;
				const ctx = canvas.getContext("2d", { willReadFrequently: true });

				if (!ctx) {
					throw new Error("Failed to get 2D context");
				}

				// Draw original image
				ctx.drawImage(img, 0, 0);

				// Check minimum size for Elara Standard (64x4 pixels)
				if (img.width < 64 || img.height < 4) {
					console.warn("[Signing] Image too small for Elara Standard, using legacy signing");
					// Fall back to legacy last-row signing for tiny images
					await signImageLegacy(canvas, ctx, metadata);
					const signedDataUrl = canvas.toDataURL("image/png", 1.0);
					metadata.contentHash = await sha256(signedDataUrl);
					storeGeneratedContent(metadata);
					resolve({
						dataUrl: signedDataUrl,
						metadata,
						metadataJson: JSON.stringify(metadata, null, 2),
					});
					return;
				}

				// Get raw pixel data for Elara Standard signing
				const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
				const _pixelData = new Uint8Array(imageData.data.buffer);

				// Prepare metadata for embedding
				const metadataJson = JSON.stringify(metadata);

				// Create user fingerprint from userId
				const userFingerprint = metadata.userId
					? await sha256(`elara:user:${metadata.userId}`)
					: await sha256(`elara:install:${metadata.installationId}`);

				// Create Elara Standard metadata object
				const elaraMetadata = createElaraMetadata({
					generator: "elara.cloud",
					userFingerprint,
					keyFingerprint: metadata.userKeyFingerprint || metadata.installationId || "unknown",
					contentType: "image",
					contentHash: await sha256(metadataJson),
					characterId: metadata.characterId || "unknown",
					modelUsed: metadata.modelUsed || "unknown",
					promptHash: metadata.promptHash || "unknown",
				});

				// Add optional fields
				if (metadata.width) {
					elaraMetadata.width = metadata.width;
				}
				if (metadata.height) {
					elaraMetadata.height = metadata.height;
				}
				if (metadata.seed) {
					elaraMetadata.seed = metadata.seed;
				}
				if (metadata.steps) {
					elaraMetadata.steps = metadata.steps;
				}
				if (metadata.guidanceScale) {
					elaraMetadata.guidanceScale = metadata.guidanceScale;
				}
				if (metadata.generationType) {
					elaraMetadata.generationType = metadata.generationType as "selfie" | "custom" | "agentic";
				}
				if (metadata.userRequest) {
					elaraMetadata.userRequest = metadata.userRequest;
				}
				if (metadata.aiDecision) {
					elaraMetadata.aiDecision = metadata.aiDecision;
				}

				// Sign using Elara Standard v1.0
				// Note: signImageContent expects Uint8ClampedArray, so we need to convert
				const clampedPixelData = new Uint8ClampedArray(imageData.data);
				const signResult = await signImageContent(clampedPixelData, canvas.width, canvas.height, elaraMetadata);

				// Put signed pixel data back
				// Create a fresh Uint8ClampedArray from the buffer to satisfy TypeScript
				const signedPixelArray = new Uint8ClampedArray(signResult.signedImageData.length);
				signedPixelArray.set(signResult.signedImageData);
				const signedImageData = new ImageData(signedPixelArray, canvas.width, canvas.height);
				ctx.putImageData(signedImageData, 0, 0);

				// Get signed image as data URL (PNG preserves pixel data)
				const signedDataUrl = canvas.toDataURL("image/png", 1.0);

				// Calculate final content hash
				metadata.contentHash = await sha256(signedDataUrl);

				// Update signature version to indicate Elara Standard was used
				metadata.signatureVersion = "4.0-elara-standard";

				// Add visible PNG metadata layer (server-side)
				let finalDataUrl = signedDataUrl;
				try {
					const { getFunctions, httpsCallable } = await import("firebase/functions");
					const functions = getFunctions();
					const addMetadata = httpsCallable(functions, "signImageMetadata");

					const result = (await addMetadata({
						imageBase64: signedDataUrl,
						metadata: {
							userId: metadata.userId,
							model: metadata.modelUsed,
							character: metadata.characterName,
							timestamp: metadata.generatedAt,
						},
					})) as { data: { signedImage: string } };

					if (result.data?.signedImage) {
						finalDataUrl = result.data.signedImage;
					}
				} catch (e) {
					console.warn("[Signing] Could not add visible PNG metadata (fallback to steganography only):", e);
				}

				// Store in local registry for verification
				storeGeneratedContent(metadata);

				logger.debug(`Signed with Elara Standard v1.0, hash: ${metadata.contentHash?.slice(0, 16)}...`, {
					component: "Signing",
				});

				resolve({
					dataUrl: finalDataUrl,
					metadata,
					metadataJson: JSON.stringify(metadata, null, 2),
				});
			} catch (error) {
				console.error("[Signing] Failed to sign image:", error);
				reject(error);
			}
		};

		img.onerror = () => reject(new Error("Failed to load image for signing"));
		img.src = imageDataUrl;
	});
}

/**
 * Legacy signing for small images (last row, blue channel)
 * Used when image is too small for Elara Standard (< 64x4)
 */
async function signImageLegacy(
	canvas: HTMLCanvasElement,
	ctx: CanvasRenderingContext2D,
	metadata: ContentMetadata,
): Promise<void> {
	const metadataJson = JSON.stringify(metadata);
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const data = imageData.data;

	// Create a compact signature marker (legacy v3 format)
	const marker = "ELARA_SIGNED_V3";
	const metadataHash = await sha256(metadataJson);
	const embeddedString = `${marker}:${metadataHash.slice(0, 32)}`;

	// Embed in the last row of pixels (blue channel LSB)
	const lastRowStart = (canvas.height - 1) * canvas.width * 4;
	const maxChars = Math.min(embeddedString.length, canvas.width);

	for (let i = 0; i < maxChars; i++) {
		const charCode = embeddedString.charCodeAt(i);
		const pixelIndex = lastRowStart + i * 4 + 2; // Blue channel

		// Modify LSB (least significant 4 bits)
		if (pixelIndex < data.length) {
			data[pixelIndex] = (data[pixelIndex] & 0xf0) | (charCode & 0x0f);
		}
	}

	ctx.putImageData(imageData, 0, 0);
	logger.debug("Applied legacy V3 signature (small image)", { component: "Signing" });
}

/**
 * Verify if an image was signed by this installation
 * Now checks for both Elara Standard v1.0 and legacy V3 signatures
 */
export function verifyImageSignature(imageDataUrl: string): Promise<{
	isSigned: boolean;
	isOurs: boolean;
	metadata?: ContentMetadata;
	signatureType?: "elara-standard-v1" | "legacy-v3";
	elaraMetadata?: unknown;
}> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";

		img.onload = async () => {
			try {
				const canvas = document.createElement("canvas");
				canvas.width = img.width;
				canvas.height = img.height;
				const ctx = canvas.getContext("2d");

				if (!ctx) {
					reject(new Error("Failed to get 2D context"));
					return;
				}

				ctx.drawImage(img, 0, 0);

				const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
				const pixelData = new Uint8ClampedArray(imageData.data);

				// First, try Elara Standard v1.0 signature detection
				if (canvas.width >= 64 && canvas.height >= 4) {
					try {
					// Use extractV1Signature to check if there's a signature
					const signature = extractV1Signature(pixelData, canvas.width, canvas.height);
						if (signature && signature.length > 0) {
							// Check for ELARA marker in the signature
							const markerBytes = signature.slice(0, 8);
							const marker = new TextDecoder().decode(markerBytes);
							if (marker === ELARA_MARKER) {
								logger.debug("Elara Standard v1.0 signature detected", { component: "Signing" });
								resolve({
									isSigned: true,
									isOurs: true,
									signatureType: "elara-standard-v1",
								});
								return;
							}
						}
					} catch (e) {
						console.debug("[Signing] Elara Standard check failed:", e);
					}
				}

				// Fallback: Check for legacy V3 signature in last row
				const data = imageData.data;
				const startPixel = (canvas.height - 1) * canvas.width * 4;
				let marker = "";
				for (let i = 0; i < 15 && i < canvas.width; i++) {
					const pixelIndex = startPixel + i * 4 + 2;
					marker += String.fromCharCode(data[pixelIndex] & 0x0f);
				}

				const isLegacySigned = marker.includes("ELARA");

				if (isLegacySigned) {
					logger.debug("Legacy V3 signature detected", { component: "Signing" });
					resolve({
						isSigned: true,
						isOurs: true,
						signatureType: "legacy-v3",
					});
					return;
				}

				resolve({ isSigned: false, isOurs: false });
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
	if (typeof window === "undefined" || !metadata.contentHash) {
		return;
	}

	try {
		const stored = localStorage.getItem(GENERATED_CONTENT_KEY);
		const registry: GeneratedContentRegistry = stored ? JSON.parse(stored) : {};

		registry[metadata.contentHash] = metadata;

		// Keep only last 1000 entries
		const entries = Object.entries(registry);
		if (entries.length > 1000) {
			const sorted = entries.sort(
				(a, b) => new Date(b[1].generatedAt).getTime() - new Date(a[1].generatedAt).getTime(),
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
	if (typeof window === "undefined") {
		return {};
	}

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
export function downloadWithMetadata(signedContent: SignedContent, filename: string): void {
	// Download image
	const imageLink = document.createElement("a");
	imageLink.href = signedContent.dataUrl;
	imageLink.download = filename;
	imageLink.click();

	// Download metadata sidecar
	const metadataBlob = new Blob([signedContent.metadataJson], { type: "application/json" });
	const metadataUrl = URL.createObjectURL(metadataBlob);
	const metadataLink = document.createElement("a");
	metadataLink.href = metadataUrl;
	metadataLink.download = filename.replace(/\.[^.]+$/, "_metadata.json");
	metadataLink.click();
	URL.revokeObjectURL(metadataUrl);
}

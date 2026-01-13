/**
 * Text-to-Speech Service for OpenElara Cloud
 *
 * PORTED FROM DESKTOP: src/main/handlers/apiHandlers.js (handleTogetherTTS)
 *
 * Uses Together.ai's TTS API with multiple models:
 * - hexgrad/Kokoro-82M (cheapest, default)
 * - canopylabs/orpheus-3b-0.1-ft (higher quality)
 * - cartesia/sonic (premium)
 *
 * Each model has specific voice options that must be matched correctly.
 */

import { getAPIKey } from "./byok";
import { logger } from "./logger";

// ============================================================================
// TYPES
// ============================================================================

export interface TTSOptions {
	model?: string;
	voice?: string;
	responseFormat?: "wav" | "mp3" | "raw";
	speed?: number;
}

export interface TTSResult {
	success: boolean;
	audioData?: ArrayBuffer;
	audioUrl?: string;
	error?: string;
}

export interface Voice {
	id: string;
	name: string;
	displayName: string;
	gender?: "male" | "female" | "neutral";
}

// ============================================================================
// VOICE CATALOGS (from desktop voice-studio.js)
// ============================================================================

export const KOKORO_VOICES: Voice[] = [
	{ id: "af_heart", name: "af_heart", displayName: "Female - Heart", gender: "female" },
	{ id: "af_bella", name: "af_bella", displayName: "Female - Bella", gender: "female" },
	{ id: "af_sarah", name: "af_sarah", displayName: "Female - Sarah", gender: "female" },
	{ id: "af_nicole", name: "af_nicole", displayName: "Female - Nicole", gender: "female" },
	{ id: "af_sky", name: "af_sky", displayName: "Female - Sky", gender: "female" },
	{ id: "af_alloy", name: "af_alloy", displayName: "Female - Alloy", gender: "female" },
	{ id: "af_aoede", name: "af_aoede", displayName: "Female - Aoede", gender: "female" },
	{ id: "af_jessica", name: "af_jessica", displayName: "Female - Jessica", gender: "female" },
	{ id: "af_kore", name: "af_kore", displayName: "Female - Kore", gender: "female" },
	{ id: "af_nova", name: "af_nova", displayName: "Female - Nova", gender: "female" },
	{ id: "af_river", name: "af_river", displayName: "Female - River", gender: "female" },
	{ id: "am_adam", name: "am_adam", displayName: "Male - Adam", gender: "male" },
	{ id: "am_echo", name: "am_echo", displayName: "Male - Echo", gender: "male" },
	{ id: "am_eric", name: "am_eric", displayName: "Male - Eric", gender: "male" },
	{ id: "am_fenrir", name: "am_fenrir", displayName: "Male - Fenrir", gender: "male" },
	{ id: "am_liam", name: "am_liam", displayName: "Male - Liam", gender: "male" },
	{ id: "am_michael", name: "am_michael", displayName: "Male - Michael", gender: "male" },
	{ id: "am_onyx", name: "am_onyx", displayName: "Male - Onyx", gender: "male" },
	{ id: "am_puck", name: "am_puck", displayName: "Male - Puck", gender: "male" },
	{ id: "bf_emma", name: "bf_emma", displayName: "British Female - Emma", gender: "female" },
	{ id: "bf_isabella", name: "bf_isabella", displayName: "British Female - Isabella", gender: "female" },
	{ id: "bm_george", name: "bm_george", displayName: "British Male - George", gender: "male" },
	{ id: "bm_lewis", name: "bm_lewis", displayName: "British Male - Lewis", gender: "male" },
];

export const ORPHEUS_VOICES: Voice[] = [
	{ id: "tara", name: "tara", displayName: "Female - Tara", gender: "female" },
	{ id: "leah", name: "leah", displayName: "Female - Leah", gender: "female" },
	{ id: "jess", name: "jess", displayName: "Female - Jess", gender: "female" },
	{ id: "leo", name: "leo", displayName: "Male - Leo", gender: "male" },
	{ id: "dan", name: "dan", displayName: "Male - Dan", gender: "male" },
	{ id: "mia", name: "mia", displayName: "Female - Mia", gender: "female" },
	{ id: "zac", name: "zac", displayName: "Male - Zac", gender: "male" },
	{ id: "zoe", name: "zoe", displayName: "Female - Zoe", gender: "female" },
];

export const CARTESIA_VOICES: Voice[] = [
	{ id: "a167e0f3-df7e-4d52-a9c3-f949145efdab", name: "alloy", displayName: "Alloy (Default)", gender: "neutral" },
	{ id: "c2ac25f9-ecc4-4f56-9095-651354df60c0", name: "echo", displayName: "Echo", gender: "male" },
	{ id: "79a125e8-cd45-4c13-8a67-188112f4dd22", name: "nova", displayName: "Nova", gender: "female" },
];

// ============================================================================
// TTS MODELS
// ============================================================================

export interface TTSModel {
	id: string;
	name: string;
	description: string;
	maxTextLength: number;
	costPerMillion?: number; // Cost per million characters
	voices: Voice[];
}

export const TTS_MODELS: TTSModel[] = [
	{
		id: "hexgrad/Kokoro-82M",
		name: "Kokoro 82M",
		description: "Fast, affordable TTS with many voice options",
		maxTextLength: 5000,
		costPerMillion: 15, // $0.015 per 1K chars
		voices: KOKORO_VOICES,
	},
	{
		id: "canopylabs/orpheus-3b-0.1-ft",
		name: "Orpheus 3B",
		description: "Higher quality emotional TTS",
		maxTextLength: 2000,
		costPerMillion: 60,
		voices: ORPHEUS_VOICES,
	},
	{
		id: "cartesia/sonic-2",
		name: "Cartesia Sonic 2",
		description: "Premium quality TTS (RECOMMENDED)",
		maxTextLength: 10000,
		costPerMillion: 100,
		voices: CARTESIA_VOICES,
	},
];

// ONLY recommended models are valid - cartesia/sonic-2 (matches VOICE_MODEL_METADATA)
export const DEFAULT_TTS_MODEL = "cartesia/sonic-2";
export const DEFAULT_VOICE = "a167e0f3-df7e-4d52-a9c3-f949145efdab"; // alloy

// ============================================================================
// VOICE VALIDATION (from desktop)
// ============================================================================

/**
 * Validate and fix voice for the selected model
 * Returns a valid voice ID for the model, falling back to defaults if needed
 */
export function validateVoiceForModel(voice: string, model: string): string {
	const modelConfig = TTS_MODELS.find((m) => m.id === model);
	if (!modelConfig) {
		console.warn(`[TTS] Unknown model '${model}', using Kokoro default`);
		return DEFAULT_VOICE;
	}

	// Check if voice exists in model's voice list
	const validVoice = modelConfig.voices.find((v) => v.id === voice || v.name === voice);
	if (validVoice) {
		return validVoice.id;
	}

	// Fall back to first voice in model's list
	const fallback = modelConfig.voices[0]?.id || DEFAULT_VOICE;
	console.warn(`[TTS] Voice '${voice}' not valid for model '${model}', using '${fallback}'`);
	return fallback;
}

/**
 * Get max text length for a model
 */
export function getModelMaxTextLength(model: string): number {
	const modelConfig = TTS_MODELS.find((m) => m.id === model);
	return modelConfig?.maxTextLength || 5000;
}

// ============================================================================
// TTS GENERATION
// ============================================================================

/**
 * Generate speech audio from text using Together.ai TTS API
 *
 * @param text - Text to synthesize
 * @param options - TTS options (model, voice, format)
 * @returns TTSResult with audio data or error
 */
export async function generateSpeech(text: string, options: TTSOptions = {}): Promise<TTSResult> {
	const apiKey = await getAPIKey("together");

	if (!apiKey) {
		return {
			success: false,
			error: "Together.ai API Key is not set. Please configure it in Settings → API Keys.",
		};
	}

	// Defaults
	const model = options.model || DEFAULT_TTS_MODEL;
	const voice = validateVoiceForModel(options.voice || DEFAULT_VOICE, model);
	const responseFormat = options.responseFormat || "wav";

	// Validate and truncate text if needed
	const maxLength = getModelMaxTextLength(model);
	const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

	if (text.length > maxLength) {
		console.warn(`[TTS] Text truncated from ${text.length} to ${maxLength} chars (${model} limit)`);
	}

	if (!truncatedText.trim()) {
		return { success: false, error: "Text is empty. Cannot generate speech for empty input." };
	}

	try {
		logger.debug(`Generating audio: model=${model}, voice=${voice}, format=${responseFormat}`, { component: "TTS" });

		// Together.AI TTS API payload
		const payload: Record<string, unknown> = {
			model,
			input: truncatedText,
			voice,
		};

		// Optional response format (default is wav)
		if (responseFormat && responseFormat !== "wav") {
			payload.response_format = responseFormat;
		}

		const response = await fetch("https://api.together.xyz/v1/audio/speech", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"Cache-Control": "no-cache, no-store, must-revalidate",
				"X-Request-ID": `tts-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));

			if (response.status === 429) {
				return { success: false, error: "Together.ai rate limit exceeded. Please wait a moment." };
			}
			if (response.status === 401) {
				return { success: false, error: "Invalid Together.ai API key. Please check Settings." };
			}
			if (response.status === 400) {
				const errorMessage = errorData.error?.message || "Bad request";
				if (errorMessage.includes("voice") || errorMessage.includes("Voice")) {
					return {
						success: false,
						error: `Invalid voice '${voice}' for model '${model}'. Please select a different voice.`,
					};
				}
				return { success: false, error: `TTS Request Error: ${errorMessage}` };
			}

			return {
				success: false,
				error: `TTS Error: ${errorData.error?.message || response.statusText}`,
			};
		}

		// Get audio data as ArrayBuffer
		const audioData = await response.arrayBuffer();
		logger.debug(`Audio generated, size: ${audioData.byteLength} bytes`, { component: "TTS" });

		// Create blob URL for playback
		const mimeType = responseFormat === "mp3" ? "audio/mpeg" : "audio/wav";
		const blob = new Blob([audioData], { type: mimeType });
		const audioUrl = URL.createObjectURL(blob);

		return {
			success: true,
			audioData,
			audioUrl,
		};
	} catch (error: any) {
		console.error("[TTS] Generation failed:", error);
		return {
			success: false,
			error: `TTS Error: ${error.message}`,
		};
	}
}

/**
 * Get voices for a specific model
 */
export function getVoicesForModel(model: string): Voice[] {
	const modelConfig = TTS_MODELS.find((m) => m.id === model);
	return modelConfig?.voices || KOKORO_VOICES;
}

/**
 * Get the default voice for a character based on their voice profile
 */
export function getCharacterVoice(characterVoiceId?: string, model?: string): string {
	if (!characterVoiceId) {
		return DEFAULT_VOICE;
	}
	return validateVoiceForModel(characterVoiceId, model || DEFAULT_TTS_MODEL);
}

// ============================================================================
// AUDIO UTILITIES
// ============================================================================

/**
 * Play audio from a URL
 */
export function playAudio(audioUrl: string): HTMLAudioElement {
	const audio = new Audio(audioUrl);
	audio.play().catch((err) => console.error("[TTS] Playback failed:", err));
	return audio;
}

/**
 * Download audio as a file
 */
export function downloadAudio(audioUrl: string, filename: string = "speech.wav"): void {
	const a = document.createElement("a");
	a.href = audioUrl;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
}

/**
 * Clean up audio URL (revoke blob URL)
 */
export function cleanupAudioUrl(audioUrl: string): void {
	if (audioUrl.startsWith("blob:")) {
		URL.revokeObjectURL(audioUrl);
	}
}

// ============================================================================
// VERTEX AI TTS (Google Cloud Text-to-Speech - Native)
// No API key needed - uses Cloud Functions with ADC
// Free tier: 1 million characters/month!
// ============================================================================

export interface GoogleVoice {
	id: string;
	name: string;
	displayName: string;
	gender: "male" | "female" | "neutral";
	type: "Neural2" | "Wavenet" | "Standard" | "News";
}

// Popular Google Cloud TTS Neural2 voices (highest quality)
export const GOOGLE_NEURAL2_VOICES: GoogleVoice[] = [
	{ id: "en-US-Neural2-F", name: "en-US-Neural2-F", displayName: "US Female - F", gender: "female", type: "Neural2" },
	{ id: "en-US-Neural2-H", name: "en-US-Neural2-H", displayName: "US Female - H", gender: "female", type: "Neural2" },
	{ id: "en-US-Neural2-C", name: "en-US-Neural2-C", displayName: "US Female - C", gender: "female", type: "Neural2" },
	{ id: "en-US-Neural2-D", name: "en-US-Neural2-D", displayName: "US Male - D", gender: "male", type: "Neural2" },
	{ id: "en-US-Neural2-A", name: "en-US-Neural2-A", displayName: "US Male - A", gender: "male", type: "Neural2" },
	{ id: "en-US-Neural2-J", name: "en-US-Neural2-J", displayName: "US Male - J", gender: "male", type: "Neural2" },
	{ id: "en-GB-Neural2-F", name: "en-GB-Neural2-F", displayName: "UK Female - F", gender: "female", type: "Neural2" },
	{ id: "en-GB-Neural2-A", name: "en-GB-Neural2-A", displayName: "UK Female - A", gender: "female", type: "Neural2" },
	{ id: "en-GB-Neural2-D", name: "en-GB-Neural2-D", displayName: "UK Male - D", gender: "male", type: "Neural2" },
	{ id: "en-GB-Neural2-B", name: "en-GB-Neural2-B", displayName: "UK Male - B", gender: "male", type: "Neural2" },
	{ id: "en-AU-Neural2-A", name: "en-AU-Neural2-A", displayName: "AU Female - A", gender: "female", type: "Neural2" },
	{ id: "en-AU-Neural2-D", name: "en-AU-Neural2-D", displayName: "AU Male - D", gender: "male", type: "Neural2" },
];

export const DEFAULT_GOOGLE_VOICE = "en-US-Neural2-F";

/**
 * Generate speech using Google Cloud TTS (via Vertex AI Cloud Function)
 * 
 * This is the native Google option - no API key needed!
 * Uses the vertexTTS Cloud Function which has Application Default Credentials.
 */
export async function generateSpeechVertex(text: string, options: {
	voice?: string;
	speakingRate?: number;
	pitch?: number;
	audioEncoding?: "MP3" | "LINEAR16" | "OGG_OPUS";
} = {}): Promise<TTSResult> {
	try {
		const { auth } = await import("./firebase");
		const user = auth.currentUser;
		if (!user) {
			return { success: false, error: "Not authenticated. Please sign in." };
		}
		
		const idToken = await user.getIdToken();
		
		const functionUrl = process.env.NEXT_PUBLIC_FUNCTIONS_URL || 
			`https://us-central1-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net`;
		
		const voice = options.voice || DEFAULT_GOOGLE_VOICE;
		
		logger.debug(`Vertex TTS: voice=${voice}`, { component: "TTS" });

		const response = await fetch(`${functionUrl}/vertexTTS`, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${idToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				text,
				voice,
				speakingRate: options.speakingRate,
				pitch: options.pitch,
				audioEncoding: options.audioEncoding || "MP3",
			}),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return {
				success: false,
				error: `Google TTS Error: ${errorData.error || response.statusText}`,
			};
		}

		const data = await response.json();
		
		if (!data.audioContent) {
			return { success: false, error: "No audio content returned" };
		}

		// Decode base64 audio
		const binaryString = atob(data.audioContent);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		const audioData = bytes.buffer;

		// Create blob URL for playback
		const mimeType = data.audioEncoding === "LINEAR16" ? "audio/wav" : "audio/mpeg";
		const blob = new Blob([audioData], { type: mimeType });
		const audioUrl = URL.createObjectURL(blob);

		return {
			success: true,
			audioData,
			audioUrl,
		};
	} catch (error: any) {
		console.error("[Vertex TTS] Generation failed:", error);
		return {
			success: false,
			error: `Google TTS Error: ${error.message}`,
		};
	}
}

/**
 * Smart TTS generator - uses Vertex AI if no Together key, otherwise Together
 */
export async function generateSpeechSmart(text: string, options: TTSOptions = {}): Promise<TTSResult> {
	const apiKey = await getAPIKey("together");
	
	// If no Together key, use Google Cloud TTS (free tier!)
	if (!apiKey) {
		logger.debug("No Together.ai key, using Google Cloud TTS", { component: "TTS" });
		return generateSpeechVertex(text, {
			voice: DEFAULT_GOOGLE_VOICE,
			speakingRate: options.speed,
		});
	}
	
	// Use Together.ai
	return generateSpeech(text, options);
}

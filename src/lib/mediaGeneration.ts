/**
 * Media Generation Service for OpenElara Cloud
 *
 * PORTED FROM DESKTOP APP: Uses proper model metadata from models.ts
 * NOW USING: Model Registry with MVP (Minimum Viable Payload) pattern
 *
 * Handles:
 * - Image generation (selfies, custom prompts) via Together.ai BYOK (direct browser calls)
 * - Video generation via Cloud Function (Together.ai video API doesn't support CORS!)
 * - Voice/TTS generation via Together.ai BYOK (Cartesia Sonic)
 *
 * ROUTING ARCHITECTURE:
 * - IMAGE: Direct BYOK → Together.ai (supports CORS from browser) ✅
 * - VIDEO: Cloud Function proxy → Together.ai (no CORS support!) 🔒
 * - TTS: Direct BYOK → Together.ai (supports CORS from browser) ✅
 *
 * Supported Providers (matching desktop app):
 * - Together.ai: Images, Video, TTS, Chat, Embeddings
 * - OpenRouter: Chat routing to 300+ models
 * - Exa.ai: Web search (optional)
 */

import { logger } from "./logger";

/**
 * MODEL REGISTRY PATTERN (Jan 2026):
 * - buildPayload() from model-registry.ts handles all param validation
 * - Models only receive params they support (verified via ~800 API tests)
 * - MVP pattern: optional params only sent if user overrides defaults
 */

import { getAPIKey } from "./byok";
import { type Character, getActiveCharacter } from "./characters";
import { auth, firebaseConfig } from "./firebase";
import { getFunctionsUrl } from "./firebaseConfig";
import { createLogger } from "./logger";
// NEW: Model Registry imports with buildPayload()
import { buildPayload } from "./model-registry";

// Legacy imports for backwards compatibility
import {
	getDefaultChatModel,
	getDefaultImageModel,
	getDefaultVideoModel,
	getImageModelMetadata,
	getSelectedModel,
	getVideoModelMetadata,
	IMAGE_MODEL_METADATA,
	VIDEO_MODEL_METADATA,
} from "./models";
import { generateMetadata, type SignedContent, signImage } from "./signing";
import { getImageModel, modelSupportsParam } from "./verified-image-models";

// ============================================================================
// IMAGE GENERATION
// ============================================================================

export interface ImageGenerationOptions {
	prompt: string;
	width?: number;
	height?: number;
	model?: string;
	steps?: number;
	seed?: number;
	negativePrompt?: string;
	guidanceScale?: number;

	// Selfie mode
	isSelfie?: boolean;
	selfieScene?: string; // User's scene suggestion
}

export interface GeneratedImage {
	signedContent: SignedContent;
	prompt: string;
	revisedPrompt?: string;
}

// Re-export model metadata for backwards compatibility
export const IMAGE_MODELS = IMAGE_MODEL_METADATA;
export const VIDEO_MODELS = VIDEO_MODEL_METADATA;

/**
 * Build a character-contextual prompt (inserts character into scene)
 *
 * NOTE: "Selfie" here means character-centric, NOT literally prompting for "selfie"
 * The scene should be contextual (decided by AI in agentic mode, or user in custom)
 * and NOT include the word "selfie" unless that's genuinely desired.
 */
export function buildSelfiePrompt(character: Character, sceneRequest?: string): string {
	// Character's physical description (first person for character-centric)
	const appearance = character.descriptionFirstPerson || character.descriptionSafe;
	const attire = character.attireFirstPerson || character.attire;

	// Scene from user request or contextual default (NOT "selfie" word!)
	const scene = sceneRequest?.trim() ? sceneRequest : "looking at camera with a warm, natural expression";

	// Combine into full prompt
	return `${appearance} ${attire} ${scene}, highly detailed, professional photography, soft lighting, sharp focus`;
}

/**
 * Check model parameter support using NEW MODEL REGISTRY
 *
 * Uses verified-image-models.ts which has full parameter schema for each model.
 * Falls back to legacy IMAGE_MODEL_METADATA for backwards compatibility.
 */
function getModelParamSupport(modelId: string): {
	known: boolean;
	supportsSteps: boolean;
	supportsGuidanceScale: boolean;
	supportsNegativePrompt: boolean;
	supportsSeed: boolean;
} {
	// NEW: First try the verified model registry
	const registryModel = getImageModel(modelId);
	if (registryModel) {
		return {
			known: true,
			supportsSteps: modelSupportsParam(modelId, "steps"),
			supportsGuidanceScale: modelSupportsParam(modelId, "guidance_scale"),
			supportsNegativePrompt: modelSupportsParam(modelId, "negative_prompt"),
			supportsSeed: modelSupportsParam(modelId, "seed"),
		};
	}

	// LEGACY: Fall back to old IMAGE_MODEL_METADATA
	const meta = IMAGE_MODEL_METADATA[modelId];

	if (meta) {
		return {
			known: true,
			supportsSteps: meta.supportsSteps ?? false,
			supportsGuidanceScale: meta.supportsGuidanceScale ?? false,
			supportsNegativePrompt: meta.supportsNegativePrompt ?? false,
			supportsSeed: meta.supportsSeed ?? false,
		};
	}

	// No metadata - use MINIMUM VIABLE PAYLOAD (none of the optional params)
	return {
		known: false,
		supportsSteps: false,
		supportsGuidanceScale: false,
		supportsNegativePrompt: false,
		supportsSeed: false,
	};
}

/**
 * Generate an image using Together.ai
 *
 * NOW USING MODEL REGISTRY with buildPayload():
 * - Verified models use the new schema with MVP pattern
 * - Optional params only sent if model supports them AND user overrides
 * - Falls back to legacy IMAGE_MODEL_METADATA for backwards compatibility
 *
 * Based on ~800 API calls testing all Together.ai models (Nov 2025)
 */
export async function generateImage(options: ImageGenerationOptions): Promise<GeneratedImage> {
	const togetherKey = await getAPIKey("together");
	if (!togetherKey) {
		throw new Error("Together.ai API key required. Add it in Settings.");
	}

	const character = getActiveCharacter();
	const model = options.model || "black-forest-labs/FLUX.1-schnell";

	// NEW: Try the verified model registry first
	const registryModel = getImageModel(model);

	// LEGACY: Fall back to old metadata
	const modelConfig = getImageModelMetadata(model);
	const paramSupport = getModelParamSupport(model);

	// ENFORCE: Need either registry or legacy metadata
	if (!registryModel && !modelConfig) {
		throw new Error(
			`Unsupported image model: ${model}. ` +
				`Only Together.ai models with metadata are supported. ` +
				`Check verified-image-models.ts or models.ts for the full list.`,
		);
	}

	// Build prompt
	let prompt = options.prompt;
	if (options.isSelfie) {
		prompt = buildSelfiePrompt(character, options.selfieScene || options.prompt);
	}

	let requestBody: Record<string, any>;
	let width: number;
	let height: number;

	// ============================================================================
	// NEW PATH: Use buildPayload() from model registry (verified models)
	// ============================================================================
	if (registryModel) {
		// Build user values from options - only include non-undefined values
		// The MVP pattern means we only send optional params if user EXPLICITLY sets them
		const userValues: Record<string, unknown> = {
			prompt,
			model,
			width: options.width,
			height: options.height,
			n: 1,
			response_format: "b64_json",
			// CRITICAL: Disable Together.ai's overly aggressive safety checker
			// It false-positives on innocent prompts like "surfing" with character descriptions
			// We have our own content moderation at the app layer if needed
			disable_safety_checker: true,
		};

		// Optional params - only add if user provided them (MVP pattern)
		if (options.steps !== undefined) {
			userValues.steps = options.steps;
		}
		if (options.guidanceScale !== undefined) {
			userValues.guidance_scale = options.guidanceScale;
		}
		if (options.negativePrompt || character.negativePrompt) {
			userValues.negative_prompt = options.negativePrompt || character.negativePrompt;
		}
		if (options.seed !== undefined) {
			userValues.seed = options.seed;
		}

		// Build payload using schema - only includes params the model supports
		const { payload, warnings } = buildPayload(registryModel, userValues);
		requestBody = payload as Record<string, any>;

		// CRITICAL: Re-add disable_safety_checker after buildPayload (in case it was stripped)
		// This is necessary because the registry might not have this param defined
		requestBody.disable_safety_checker = true;

		// Log warnings if any params were invalid
		if (warnings.length > 0) {
			console.warn(`[Image Gen] Payload warnings for ${model}:`, warnings);
		}

		width = requestBody.width || 1024;
		height = requestBody.height || 1024;

		logger.debug(`Image: ${model} (registry), ${width}x${height}`, { component: "ImageGen" });
	}
	// ============================================================================
	// LEGACY PATH: Use old IMAGE_MODEL_METADATA (backwards compatibility)
	// ============================================================================
	else {
		requestBody = {
			model,
			prompt,
			n: 1,
			response_format: "b64_json",
			// CRITICAL: Disable Together.ai's overly aggressive safety checker
			disable_safety_checker: true,
		};

		// Width/Height
		width = options.width || modelConfig?.defaultWidth || 1024;
		height = options.height || modelConfig?.defaultHeight || 1024;
		requestBody.width = width;
		requestBody.height = height;

		// Steps - ONLY send if model supports it
		if (paramSupport.supportsSteps && modelConfig?.stepRange) {
			const steps = options.steps || modelConfig.defaultSteps || 4;
			const validatedSteps = Math.min(Math.max(steps, modelConfig.stepRange.min), modelConfig.stepRange.max);
			requestBody.steps = validatedSteps;
		}

		// Guidance Scale - ONLY send if model supports it
		if (
			paramSupport.supportsGuidanceScale &&
			modelConfig?.guidanceScaleRange &&
			modelConfig.defaultGuidanceScale !== null
		) {
			const guidanceScale = options.guidanceScale || modelConfig.defaultGuidanceScale;
			if (guidanceScale !== undefined) {
				const validatedGuidance = Math.min(
					Math.max(guidanceScale, modelConfig.guidanceScaleRange.min),
					modelConfig.guidanceScaleRange.max,
				);
				requestBody.guidance_scale = validatedGuidance;
			}
		}

		// Negative Prompt - ONLY send if model supports it
		if (paramSupport.supportsNegativePrompt) {
			const negativePrompt = options.negativePrompt || character.negativePrompt;
			if (negativePrompt) {
				requestBody.negative_prompt = negativePrompt;
			}
		}

		// Seed - ONLY send if model supports it
		if (paramSupport.supportsSeed && options.seed !== undefined) {
			requestBody.seed = options.seed;
		}

		logger.debug(`Image: ${model} (legacy), ${requestBody.width}x${requestBody.height}`, { component: "ImageGen" });
	}

	// ============================================================================
	// API CALL
	// ============================================================================
	const response = await fetch("https://api.together.xyz/v1/images/generations", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${togetherKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(requestBody),
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error?.message || "Image generation failed");
	}

	const result = await response.json();
	const base64 = result.data[0]?.b64_json;

	if (!base64) {
		throw new Error("No image data received");
	}

	const dataUrl = `data:image/png;base64,${base64}`;

	// Generate metadata for signing with full context
	const metadata = await generateMetadata({
		contentType: "image",
		prompt,
		model,
		width,
		height,
		steps: requestBody.steps,
		guidanceScale: requestBody.guidance_scale,
		negativePrompt: requestBody.negative_prompt,
		seed: options.seed,
		generationType: options.isSelfie ? "selfie" : "custom",
		userRequest: options.selfieScene || options.prompt,
		includeFullPrompt: true, // Store full prompt for provenance
	});

	// Sign the image
	const signedContent = await signImage(dataUrl, metadata);

	return {
		signedContent,
		prompt,
		revisedPrompt: result.data[0]?.revised_prompt,
	};
}

/**
 * Generate a selfie of the current character
 */
export async function generateSelfie(
	sceneRequest?: string,
	options?: Partial<ImageGenerationOptions>,
): Promise<GeneratedImage> {
	return generateImage({
		prompt: sceneRequest || "",
		isSelfie: true,
		selfieScene: sceneRequest,
		...options,
	});
}

// ============================================================================
// AGENTIC SELFIE GENERATION - AI DECIDES THE SCENE
// ============================================================================

import { chat } from "./api";
import type { MoodState } from "./mood";
import { buildSelfieSystemPrompt, getMoodEmotionalContext } from "./promptBuilder";

export interface AgenticSelfieOptions {
	sceneSuggestion?: string;
	model?: string; // Image generation model
	chatModel?: string; // LLM for scene decision (uses user's selected model if not provided)
	character?: Character;
	moodState?: MoodState | null;
	conversationContext?: string;
}

export interface AgenticSelfieResult {
	image: GeneratedImage;
	aiSceneDecision: string; // What the AI decided
	attireOverride?: string; // If AI chose different attire
}

/**
 * AGENTIC CHARACTER IMAGE GENERATION - The AI decides the scene based on mood and persona
 *
 * ARCHITECTURE CLARIFICATION:
 * - This function does TWO API calls: (1) LLM for scene decision, (2) Image generation
 * - The "selfie" term is legacy - this is really "agentic character-centric image"
 * - The AI contextually inserts the character into a scene, NOT prompting for "selfie"!
 *
 * Workflow:
 * 1. User provides optional scene suggestion
 * 2. LLM (with character persona + mood) DECIDES the actual scene/attire contextually
 * 3. AI's contextual scene description goes to image generation model via generateImage()
 * 4. Result is character-authentic, mood-influenced, using SAME endpoint as custom mode
 */
export async function generateAgenticSelfie(options: AgenticSelfieOptions): Promise<AgenticSelfieResult> {
	const togetherKey = await getAPIKey("together");
	if (!togetherKey) {
		throw new Error("Together.ai API key required. Add it in Settings.");
	}

	const character = options.character || getActiveCharacter();

	// Build the selfie system prompt (includes SELFIE_GENERATION_INSTRUCTIONS)
	const systemPrompt = buildSelfieSystemPrompt({
		userName: "User",
		character,
	});

	// Build context for the AI's decision
	const contextParts: string[] = [];

	// Add mood context if available
	if (options.moodState) {
		const emotionalContext = getMoodEmotionalContext(options.moodState, character.name);
		if (emotionalContext) {
			contextParts.push(`**Current Emotional State:**\n${emotionalContext}`);
		}
	}

	// Add conversation context if available
	if (options.conversationContext) {
		contextParts.push(`**Recent Conversation Context:**\n${options.conversationContext}`);
	}

	// Build the user message (scene suggestion)
	const userSuggestion = options.sceneSuggestion?.trim()
		? `The user suggests: "${options.sceneSuggestion}"\n\nRemember: This is a SUGGESTION. You decide the actual scene based on your mood and persona.`
		: "Generate a selfie that reflects your current mood and personality. You have full creative freedom.";

	const fullUserMessage =
		contextParts.length > 0 ? `${contextParts.join("\n\n")}\n\n---\n\n${userSuggestion}` : userSuggestion;

	// STEP 1: Ask the AI to decide the scene
	// ⛔ NO HARDCODED FALLBACK - model must be provided or selected
	const chatModelToUse = options.chatModel || getSelectedModel("chat");
	if (!chatModelToUse) {
		throw new Error("No chat model selected. Please select a model in Settings.");
	}

	const aiResponse = await chat(
		[
			{ role: "system", content: systemPrompt },
			{ role: "user", content: fullUserMessage },
		],
		{
			model: chatModelToUse,
			maxTokens: 300, // Scene descriptions are short
		},
	);

	const aiDecision = aiResponse.choices[0]?.message?.content || "A casual selfie with a warm smile";

	// Parse the AI's decision - check for ATTIRE override
	let attireOverride: string | undefined;
	let sceneDescription = aiDecision;

	if (aiDecision.includes("ATTIRE:")) {
		const attireMatch = aiDecision.match(/ATTIRE:\s*(.+?)(?:\n|$)/i);
		if (attireMatch) {
			attireOverride = attireMatch[1].trim();
			// Remove ATTIRE line from scene description
			sceneDescription = aiDecision.replace(/ATTIRE:\s*.+?(?:\n|$)/i, "").trim();
		}
	}

	// STEP 2: Build the final image prompt with character appearance
	const appearance = character.descriptionFirstPerson || character.descriptionSafe;
	const attire = attireOverride || character.attireFirstPerson || character.attire;

	const finalPrompt = `${appearance} ${attire} ${sceneDescription}, highly detailed, professional photography, soft lighting, sharp focus`;

	// STEP 3: Generate the image with full context metadata
	const image = await generateImage({
		prompt: finalPrompt,
		model: options.model,
		isSelfie: true,
		selfieScene: sceneDescription,
	});

	// Update metadata to include AI decision and conversation context
	if (image.signedContent.metadata) {
		image.signedContent.metadata.generationType = "agentic";
		image.signedContent.metadata.aiDecision = aiDecision;
		image.signedContent.metadata.userRequest = options.sceneSuggestion;
		image.signedContent.metadata.conversationContext = options.conversationContext;
		// Re-serialize metadata JSON
		image.signedContent.metadataJson = JSON.stringify(image.signedContent.metadata);
	}

	return {
		image,
		aiSceneDecision: sceneDescription,
		attireOverride,
	};
}

/**
 * FULLY AUTONOMOUS SELFIE AGENT
 *
 * The LLM has complete control:
 * - Selects image generation model based on desired aesthetic
 * - Chooses all parameters (steps, guidance, etc.)
 * - Decides scene based on conversation context and memories
 * - User just triggers it - all decisions are AI-made
 *
 * This creates "entropic" selfies where each one is unique and context-aware
 */
export async function generateAutonomousSelfie(options: {
	conversationContext?: string;
	character?: Character;
	moodState?: MoodState | null;
}): Promise<AgenticSelfieResult> {
	const togetherKey = await getAPIKey("together");
	if (!togetherKey) {
		throw new Error("Together.ai API key required. Add it in Settings.");
	}

	const character = options.character || getActiveCharacter();

	// Build autonomous decision prompt
	const systemPrompt = `You are ${character.name}. You're about to take a selfie, and you have COMPLETE CREATIVE CONTROL.

Your physical appearance (always use verbatim):
${character.descriptionFirstPerson || character.descriptionSafe}

${character.attireFirstPerson || character.attire}

# YOUR TASK:
1. Review the conversation context and your current mood
2. Choose the PERFECT image generation model for the aesthetic you want
3. Decide on the scene/setting that reflects the conversation or your mood
4. Specify any special attire if you want to change from your default

# AVAILABLE MODELS:
${Object.entries(IMAGE_MODEL_METADATA)
	.map(([id, meta]) => `- ${id}: ${meta.displayName} (${meta.description || "general purpose"})`)
	.join("\n")}

# RESPONSE FORMAT:
MODEL: [chosen model ID]
SCENE: [your scene description - be creative and context-aware]
ATTIRE: [optional - only if you want to change from default]

Make it personal, make it relevant to our conversation. Be entropic - surprise me!`;

	// Build context
	const contextParts: string[] = [];

	if (options.moodState) {
		const emotionalContext = getMoodEmotionalContext(options.moodState, character.name);
		if (emotionalContext) {
			contextParts.push(`**My Current Mood:**\n${emotionalContext}`);
		}
	}

	if (options.conversationContext) {
		contextParts.push(`**What We've Been Talking About:**\n${options.conversationContext}`);
	}

	const userMessage =
		contextParts.length > 0 ? contextParts.join("\n\n") : "Generate a selfie that shows who you are right now.";

	// Let AI decide everything
	// ⛔ NO HARDCODED FALLBACK - model must be selected
	const chatModelToUse = getSelectedModel("chat");
	if (!chatModelToUse) {
		throw new Error("No chat model selected. Please select a model in Settings.");
	}

	const aiResponse = await chat(
		[
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userMessage },
		],
		{
			model: chatModelToUse,
			maxTokens: 500,
		},
	);

	const aiDecision = aiResponse.choices[0]?.message?.content || "";

	// Parse AI's decision
	const modelMatch = aiDecision.match(/MODEL:\s*(.+?)(?:\n|$)/i);
	const sceneMatch = aiDecision.match(/SCENE:\s*([\s\S]+?)(?:\n(?:ATTIRE:|MODEL:)|$)/i);
	const attireMatch = aiDecision.match(/ATTIRE:\s*(.+?)(?:\n|$)/i);

	const defaultModel = await getDefaultImageModel();
	const chosenModel = modelMatch?.[1]?.trim() || defaultModel;
	const sceneDescription = sceneMatch?.[1]?.trim() || "a casual selfie with a warm smile";
	const attireOverride = attireMatch?.[1]?.trim();

	// Build final prompt
	const appearance = character.descriptionFirstPerson || character.descriptionSafe;
	const attire = attireOverride || character.attireFirstPerson || character.attire;
	const finalPrompt = `${appearance} ${attire} ${sceneDescription}, highly detailed, professional photography, soft lighting, sharp focus`;

	// Generate with AI's chosen settings
	const image = await generateImage({
		prompt: finalPrompt,
		model: chosenModel,
		isSelfie: true,
		selfieScene: sceneDescription,
	});

	// Update metadata
	if (image.signedContent.metadata) {
		image.signedContent.metadata.generationType = "agentic";
		image.signedContent.metadata.aiDecision = `MODEL: ${chosenModel}\nSCENE: ${sceneDescription}${attireOverride ? `\nATTIRE: ${attireOverride}` : ""}`;
		image.signedContent.metadata.conversationContext = options.conversationContext;
		image.signedContent.metadataJson = JSON.stringify(image.signedContent.metadata);
	}

	return {
		image,
		aiSceneDecision: `I chose ${IMAGE_MODEL_METADATA[chosenModel]?.displayName || chosenModel} for this scene: ${sceneDescription}`,
		attireOverride,
	};
}

// ============================================================================
// VIDEO GENERATION - Uses proper model metadata from models.ts
// ============================================================================

export interface VideoGenerationOptions {
	prompt: string;
	duration?: number; // seconds
	model?: string;
	resolution?: string;
	negativePrompt?: string;
	guidanceScale?: number;
	firstFrameImage?: string; // base64 or URL for I2V
	lastFrameImage?: string; // base64 or URL for I2V (if supported)
	seed?: number;

	// Selfie mode
	isSelfie?: boolean;
	selfieScene?: string;

	// Progress callback for polling
	onProgress?: (status: string, attempt: number) => void;
}

export interface GeneratedVideo {
	url: string;
	prompt: string;
	model: string;
	duration: number;
	resolution: string;
}

/**
 * Generate a video using Together.ai with ASYNC POLLING
 *
 * CRITICAL ARCHITECTURE NOTE (Jan 2026):
 * Unlike image generation, video MUST go through Cloud Function because
 * Together.ai's video API does NOT support CORS from browser origins!
 *
 * This is NOT a BYOK limitation - it's a fundamental browser security constraint.
 * The Cloud Function uses the owner's Together.ai key from Secret Manager.
 *
 * VERIFIED AGAINST TOGETHER.AI DOCS (2026-01-08):
 * https://docs.together.ai/docs/videos-overview
 * https://docs.together.ai/reference/create-videos
 *
 * ✓ POST /v1/video/generations creates async job
 * ✓ Returns job ID immediately
 * ✓ GET /v1/video/generations/{job_id} polls for completion
 * ✓ Job statuses: queued, in_progress, completed, failed, cancelled
 * ✓ Parameters: model, prompt, width, height, seconds, guidance_scale, seed, negative_prompt, frame_images
 * ✓ frame_images format: [{ input_image: base64 | url, frame: number | \"last\" }]
 * ✓ Output: outputs.video_url (expires after completion - download immediately!)
 * ✓ Cost charged on job creation (NOT on completion)
 *
 * CRITICAL: Video generation is ASYNCHRONOUS:
 * 1. POST to Cloud Function /generateVideo creates a JOB (proxied to Together.ai)
 * 2. Returns job ID immediately
 * 3. Must poll GET /generateVideo?jobId=xxx until status = "completed"
 * 4. Job statuses: queued, in_progress, completed, failed, cancelled
 *
 * Uses proper model metadata from models.ts - unsupported models rejected
 */
export async function generateVideo(options: VideoGenerationOptions): Promise<GeneratedVideo> {
	// NOTE: Video generation goes through Cloud Function (Together.ai video API doesn't support CORS)
	// The Cloud Function uses the owner's API key from Secret Manager
	// No BYOK key needed for video - authentication is via Firebase Auth token

	const model = options.model || (await getDefaultVideoModel());
	const modelConfig = getVideoModelMetadata(model);

	if (!modelConfig) {
		throw new Error(
			`Unsupported video model: ${model}. ` +
				`Only Together.ai models with metadata are supported. ` +
				`Check models.ts VIDEO_MODEL_METADATA for the full list.`,
		);
	}

	// Build prompt
	let prompt = options.prompt;
	if (options.isSelfie) {
		const character = getActiveCharacter();
		prompt = buildSelfiePrompt(character, options.selfieScene || options.prompt);
	}

	// VALIDATE PROMPT LENGTH (Together.ai requirement: 1-32000 chars)
	if (!prompt || prompt.length === 0) {
		throw new Error("Video prompt cannot be empty");
	}
	if (prompt.length > 32000) {
		throw new Error(`Video prompt too long (${prompt.length} chars, max 32000)`);
	}

	// Get model-specific defaults
	const resolution = options.resolution || modelConfig.defaultResolution;
	const [width, height] = resolution.split("x").map(Number);

	// VALIDATE RESOLUTION
	if (!width || !height || width <= 0 || height <= 0) {
		throw new Error(`Invalid resolution: ${resolution}`);
	}

	// Validate duration (1-10 seconds per Together.ai docs)
	const duration = Math.min(
		Math.max(options.duration || modelConfig.maxDuration, 1),
		Math.min(modelConfig.maxDuration, 10),
	);

	// Build API request body - only supported parameters per model metadata
	// CRITICAL: seconds MUST be a STRING per Together.ai API spec
	const requestBody: Record<string, any> = {
		model,
		prompt,
		width,
		height,
		seconds: String(duration), // Together.ai requires STRING not number
	};

	// Add optional parameters ONLY if model supports them
	if (options.negativePrompt && modelConfig.parameterSupport.negative_prompt) {
		// Validate negative prompt length
		if (options.negativePrompt.length > 32000) {
			throw new Error(`Negative prompt too long (${options.negativePrompt.length} chars, max 32000)`);
		}
		requestBody.negative_prompt = options.negativePrompt;
	}

	if (options.guidanceScale !== undefined && modelConfig.parameterSupport.guidance_scale) {
		// CRITICAL: guidance_scale MUST be INTEGER per Together.ai API spec
		// Recommended range: 6-10, avoid >12
		const validatedGuidance = Math.round(Math.max(6, Math.min(options.guidanceScale, 12)));
		requestBody.guidance_scale = validatedGuidance;
	}

	if (options.seed !== undefined) {
		// CRITICAL: seed MUST be INTEGER
		requestBody.seed = Math.round(options.seed);
	}

	// Image-to-Video support (first frame)
	if (options.firstFrameImage && modelConfig.features.firstFrame) {
		requestBody.frame_images = [
			{
				input_image: options.firstFrameImage,
				frame: 0,
			},
		];
	}

	const logger = createLogger("MediaGen");
	logger.debug(`Creating video job with model: ${model}`);

	// ===========================================================================
	// VIDEO GENERATION ROUTING: ALWAYS USE CLOUD FUNCTION
	// ===========================================================================
	//
	// CRITICAL: Together.ai's video API does NOT support CORS from browsers!
	// Unlike images (which work with direct BYOK calls), video must go through
	// our Cloud Function which acts as a proxy.
	//
	// The Cloud Function uses the owner's Together.ai key from Secret Manager.
	// This is a fundamental browser limitation, not a BYOK design choice.
	// ===========================================================================

	const functionsUrl = getFunctionsUrl(firebaseConfig);
	const token = await auth.currentUser?.getIdToken();

	if (!token) {
		throw new Error("Authentication required for video generation");
	}

	// STEP 1: Create the video generation JOB via Cloud Function
	const createResponse = await fetch(`${functionsUrl}/generateVideo`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(requestBody),
	});

	if (!createResponse.ok) {
		const error = await createResponse.json().catch(() => ({}));
		// Enhanced error message with actual API response
		const errorMsg = error.error?.message || error.error || error.message || createResponse.statusText;
		throw new Error(`Video generation failed (${createResponse.status}): ${errorMsg}`);
	}

	const jobData = await createResponse.json();
	const jobId = jobData.id;

	if (!jobId) {
		throw new Error(`No job ID received from video generation API. Response: ${JSON.stringify(jobData)}`);
	}

	logger.debug(`Video job created: ${jobId}`, { component: "VideoGen" });

	// STEP 2: Poll for completion via Cloud Function
	let attempts = 0;
	const maxAttempts = 120; // 10 minutes max (5 sec intervals)
	const pollInterval = 5000; // 5 seconds

	while (attempts < maxAttempts) {
		await new Promise((resolve) => setTimeout(resolve, pollInterval));
		attempts++;

		const statusResponse = await fetch(`${functionsUrl}/generateVideo?jobId=${jobId}`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		if (!statusResponse.ok) {
			console.warn(`[Video Gen] Polling failed: ${statusResponse.statusText}`);
			continue; // Retry
		}

		const status = await statusResponse.json();

		// Call progress callback if provided
		if (options.onProgress) {
			options.onProgress(status.status, attempts);
		}

		if (status.status === "completed") {
			const videoUrl = status.outputs?.video_url;
			if (!videoUrl) {
				throw new Error("Video completed but no URL received");
			}

			logger.debug(`Video ready: ${videoUrl.slice(0, 50)}...`, { component: "VideoGen" });

			return {
				url: videoUrl,
				prompt,
				model,
				duration,
				resolution,
			};
		} else if (status.status === "failed") {
			const errorMsg = status.info?.errors || "Video generation failed";
			throw new Error(`Video generation failed: ${errorMsg}`);
		} else if (status.status === "cancelled") {
			throw new Error("Video generation was cancelled");
		}

		// Status is 'queued' or 'in_progress' - continue polling
	}

	throw new Error("Video generation timed out after 10 minutes");
}

// ============================================================================
// AGENTIC VIDEO GENERATION - AI DECIDES THE SCENE
// ============================================================================

import { buildVideoSystemPrompt } from "./promptBuilder";

export interface AgenticVideoOptions {
	sceneSuggestion?: string;
	model?: string; // Video generation model
	chatModel?: string; // LLM for scene decision (uses user's selected model if not provided)
	character?: Character;
	moodState?: MoodState | null;
	conversationContext?: string;
	duration?: number;
	onProgress?: (status: string, attempt: number) => void;
}

export interface AgenticVideoResult {
	video: GeneratedVideo;
	aiSceneDecision: string; // What the AI decided
	attireOverride?: string; // If AI chose different attire
}

/**
 * AGENTIC CHARACTER VIDEO GENERATION - The AI decides the scene based on mood and persona
 *
 * ARCHITECTURE CLARIFICATION:
 * - This function does TWO API calls: (1) LLM for scene decision, (2) Video generation
 * - Both selfie and custom modes use the SAME video generation endpoint
 * - The AI contextually creates a scene with the character, with cinematography
 *
 * Workflow:
 * 1. User provides optional scene suggestion
 * 2. LLM (with character persona + mood) DECIDES the actual scene/attire/camera contextually
 * 3. AI's contextual scene description goes to video model via generateVideo()
 * 4. Result is character-authentic, mood-influenced, using SAME endpoint as custom mode
 */
export async function generateAgenticVideo(options: AgenticVideoOptions): Promise<AgenticVideoResult> {
	const togetherKey = await getAPIKey("together");
	if (!togetherKey) {
		throw new Error("Together.ai API key required. Add it in Settings.");
	}

	const character = options.character || getActiveCharacter();

	// Build the video system prompt (includes VIDEO_GENERATION_INSTRUCTIONS)
	const systemPrompt = buildVideoSystemPrompt({
		userName: "User",
		character,
	});

	// Build context for the AI's decision
	const contextParts: string[] = [];

	// Add mood context if available
	if (options.moodState) {
		const emotionalContext = getMoodEmotionalContext(options.moodState, character.name);
		if (emotionalContext) {
			contextParts.push(`**Current Emotional State:**\n${emotionalContext}`);
		}
	}

	// Add conversation context if available
	if (options.conversationContext) {
		contextParts.push(`**Recent Conversation Context:**\n${options.conversationContext}`);
	}

	// Build the user message (scene suggestion)
	const userSuggestion = options.sceneSuggestion?.trim()
		? `The user suggests: "${options.sceneSuggestion}"\n\nRemember: This is a SUGGESTION. You decide the actual scene, actions, and camera work based on your mood and persona.`
		: "Create a video scene that reflects your current mood and personality. You have full creative freedom over movement, actions, and camera direction.";

	const fullUserMessage =
		contextParts.length > 0 ? `${contextParts.join("\n\n")}\n\n---\n\n${userSuggestion}` : userSuggestion;

	// STEP 1: Ask the AI to decide the video scene
	// CRITICAL: Use user's selected chat model - NEVER hardcode models!
	const selectedChat = getSelectedModel("chat");
	const defaultChat = await getDefaultChatModel();
	const chatModelToUse = options.chatModel || selectedChat || defaultChat;

	if (!chatModelToUse) {
		throw new Error("No chat model available. Please configure an API key and select a model in Settings.");
	}

	const aiResponse = await chat(
		[
			{ role: "system", content: systemPrompt },
			{ role: "user", content: fullUserMessage },
		],
		{
			model: chatModelToUse,
			maxTokens: 400, // Video scenes with camera directions need more space
		},
	);

	const aiDecision =
		aiResponse.choices[0]?.message?.content || "A casual video with gentle movement and warm expression";

	// Parse the AI's decision - check for ATTIRE override
	let attireOverride: string | undefined;
	let sceneDescription = aiDecision;

	if (aiDecision.includes("ATTIRE:")) {
		const attireMatch = aiDecision.match(/ATTIRE:\s*(.+?)(?:\n|$)/i);
		if (attireMatch) {
			attireOverride = attireMatch[1].trim();
			sceneDescription = aiDecision.replace(/ATTIRE:\s*.+?(?:\n|$)/i, "").trim();
		}
	}

	// STEP 2: Build the final video prompt with character appearance
	const appearance = character.descriptionFirstPerson || character.descriptionSafe;
	const attire = attireOverride || character.attireFirstPerson || character.attire;

	const finalPrompt = `${appearance} ${attire} ${sceneDescription}, cinematic quality, smooth motion, professional lighting`;

	// STEP 3: Generate the video
	const video = await generateVideo({
		prompt: finalPrompt,
		model: options.model,
		duration: options.duration,
		isSelfie: false, // We already built the prompt
		onProgress: options.onProgress, // Pass through progress callback
	});

	return {
		video,
		aiSceneDecision: sceneDescription,
		attireOverride,
	};
}

// ============================================================================
// VOICE/TTS GENERATION
// ============================================================================

export interface TTSOptions {
	text: string;
	voice?: string;
	model?: string;
}

/**
 * Generate speech using Together.ai Kokoro
 */
export async function generateSpeech(options: TTSOptions): Promise<Blob> {
	const togetherKey = await getAPIKey("together");
	if (!togetherKey) {
		throw new Error("Together.ai API key required for TTS. Add it in Settings.");
	}

	const character = getActiveCharacter();
	const voice = options.voice || character.voiceProfile.voice || "af_heart";
	const model = options.model || character.voiceProfile.model || "hexgrad/Kokoro-82M";

	// Kokoro has 1000 char limit
	const text = options.text.slice(0, 1000);

	const response = await fetch("https://api.together.xyz/v1/audio/speech", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${togetherKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			input: text,
			voice,
			response_format: "wav",
		}),
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error?.message || "TTS generation failed");
	}

	return response.blob();
}

/**
 * Play audio blob
 */
export function playAudio(audioBlob: Blob): HTMLAudioElement {
	const url = URL.createObjectURL(audioBlob);
	const audio = new Audio(url);
	audio.onended = () => URL.revokeObjectURL(url);
	audio.play();
	return audio;
}

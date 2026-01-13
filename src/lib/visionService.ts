/**
 * Vision Service for OpenElara Cloud
 * ====================================
 *
 * Simple, opinionated vision support:
 * - ONE model: Qwen3-VL-32B-Instruct (proven serverless on Together)
 * - NO model choice (it just works)
 * - Two usage patterns:
 *   1. "Eyes" mode: Vision describes image → pass to any LLM
 *   2. Auto-route: Image requests go directly to vision model
 *
 * Ported from Desktop visionService.js with simplifications for cloud.
 *
 * @author OpenElara Project
 */

import { getAPIKeySync } from "./byok";

// ============================================================================
// THE VISION MODEL (No alternatives. This one works.)
// ============================================================================

/**
 * The vision model. Period.
 *
 * Why Qwen3-VL-32B-Instruct:
 * - ✅ Serverless on Together.ai (no dedicated endpoints needed)
 * - ✅ Passed persona self-recognition test
 * - ✅ Can see signature areas
 * - ✅ Fast enough (5-15s responses)
 * - ✅ 32K context window
 *
 * Why NOT others:
 * - Llama Vision models: Require dedicated endpoints ($$$)
 * - Qwen3-VL-8B: Returns garbled output on complex tasks
 * - Qwen2.5-VL-72B: Internal server errors
 */
export const VISION_MODEL = "Qwen/Qwen3-VL-32B-Instruct";
export const VISION_MODEL_DISPLAY_NAME = "Qwen3 Vision 32B";

const TOGETHER_CHAT_URL = "https://api.together.xyz/v1/chat/completions";

// Token limits for different use cases
const VISION_TOKEN_LIMITS = {
	brief: 256,
	standard: 512,
	detailed: 1024,
	maximum: 2048,
};

// ============================================================================
// TYPES
// ============================================================================

export interface VisionConfig {
	timeout?: number;
	detailLevel?: "brief" | "standard" | "detailed" | "maximum";
}

export interface VisionResult {
	success: boolean;
	description?: string;
	error?: string;
	responseTimeMs?: number;
	tokenEstimate?: number;
}

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Check if vision is available (has Together API key)
 */
export function isVisionAvailable(): boolean {
	const apiKey = getAPIKeySync("together");
	return Boolean(apiKey);
}

/**
 * Describe an image for use by any LLM (the "eyes" pattern).
 * Returns a concise description that can be injected into context.
 *
 * @param imageBase64 - Base64-encoded image (with or without data: prefix)
 * @param config - Optional configuration
 * @returns Description result
 */
export async function describeImageForLLM(imageBase64: string, config: VisionConfig = {}): Promise<VisionResult> {
	const apiKey = getAPIKeySync("together");
	if (!apiKey) {
		return {
			success: false,
			error: "Together API key not configured. Add your key in Settings.",
		};
	}

	const maxTokens = VISION_TOKEN_LIMITS[config.detailLevel || "standard"];
	const timeout = config.timeout || 60000;

	// Prompt optimized for "describe to a blind person" use case
	const prompt = `Describe this image concisely as if explaining to someone who cannot see.

Focus on:
1. Main subject - What is the primary focus?
2. People/Characters - If present, describe appearance, expression, pose
3. Setting - Where is this? What's in the environment?
4. Mood - What feeling does this convey?

Keep your description between 100-${Math.round(maxTokens * 0.7)} words. Be vivid but concise.`;

	const startTime = Date.now();

	try {
		const result = await callVisionModel(apiKey, imageBase64, prompt, maxTokens, timeout);

		if (!result.success) {
			return result;
		}

		return {
			success: true,
			description: result.content,
			responseTimeMs: Date.now() - startTime,
			tokenEstimate: Math.ceil((result.content?.length || 0) / 4),
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
			responseTimeMs: Date.now() - startTime,
		};
	}
}

/**
 * Process an image-containing message directly with the vision model.
 * Use this when you want the vision model to answer the user directly.
 *
 * @param imageBase64 - Base64-encoded image
 * @param userPrompt - The user's question about the image
 * @param systemPrompt - Optional system prompt (for persona)
 */
export async function processWithVision(
	imageBase64: string,
	userPrompt: string,
	systemPrompt?: string,
): Promise<VisionResult> {
	const apiKey = getAPIKeySync("together");
	if (!apiKey) {
		return {
			success: false,
			error: "Together API key not configured. Add your key in Settings.",
		};
	}

	const startTime = Date.now();

	try {
		const result = await callVisionModel(apiKey, imageBase64, userPrompt, 2048, 60000, systemPrompt);

		return {
			success: result.success,
			description: result.content,
			error: result.error,
			responseTimeMs: Date.now() - startTime,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
			responseTimeMs: Date.now() - startTime,
		};
	}
}

/**
 * Check if a message contains images and needs vision processing.
 */
export function messageRequiresVision(message: {
	content?: string | Array<{ type: string; image_url?: { url: string } }>;
	images?: string[];
	image?: string;
	attachments?: Array<{ type: string; mimeType?: string }>;
}): boolean {
	// Has explicit image fields
	if (message.images && message.images.length > 0) {
		return true;
	}
	if (message.image) {
		return true;
	}

	// Has image attachments
	if (message.attachments?.some((a) => a.type?.startsWith("image/") || a.mimeType?.startsWith("image/"))) {
		return true;
	}

	// Content is multimodal array with images
	if (Array.isArray(message.content)) {
		return message.content.some((part) => part.type === "image_url");
	}

	// Content contains base64 image data
	if (typeof message.content === "string" && message.content.includes("data:image/")) {
		return true;
	}

	return false;
}

/**
 * Extract images from a message for vision processing.
 */
export function extractImagesFromMessage(message: {
	content?: string | Array<{ type: string; image_url?: { url: string } }>;
	images?: string[];
	image?: string;
}): string[] {
	const images: string[] = [];

	// Direct image fields
	if (message.images) {
		images.push(...message.images);
	}
	if (message.image) {
		images.push(message.image);
	}

	// Multimodal content array
	if (Array.isArray(message.content)) {
		for (const part of message.content) {
			if (part.type === "image_url" && part.image_url?.url) {
				images.push(part.image_url.url);
			}
		}
	}

	return images;
}

// ============================================================================
// HELPER: Create image description block for context injection
// ============================================================================

/**
 * Create an image description block to inject into LLM context.
 * Wraps the description in clear markers so the LLM knows it's an image.
 */
export function createImageDescriptionBlock(description: string, imageId: string = "user_image"): string {
	return `<image_description id="${imageId}">
${description}
</image_description>`;
}

// ============================================================================
// CORE: Call the Vision Model
// ============================================================================

interface VisionModelResult {
	success: boolean;
	content?: string;
	error?: string;
}

async function callVisionModel(
	apiKey: string,
	imageBase64: string,
	prompt: string,
	maxTokens: number = 1024,
	timeout: number = 60000,
	systemPrompt?: string,
): Promise<VisionModelResult> {
	// Build messages
	const messages: any[] = [];

	if (systemPrompt) {
		messages.push({
			role: "system",
			content: systemPrompt,
		});
	}

	// Prepare image URL - ensure proper format
	let imageUrl: string;
	if (imageBase64.startsWith("http")) {
		imageUrl = imageBase64;
	} else if (imageBase64.startsWith("data:")) {
		imageUrl = imageBase64;
	} else {
		// Assume raw base64, add data URL prefix
		imageUrl = `data:image/png;base64,${imageBase64}`;
	}

	messages.push({
		role: "user",
		content: [
			{ type: "text", text: prompt },
			{ type: "image_url", image_url: { url: imageUrl } },
		],
	});

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		const response = await fetch(TOGETHER_CHAT_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: VISION_MODEL,
				messages,
				max_tokens: maxTokens,
				temperature: 0.3,
			}),
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			const errorText = await response.text();
			let errorMessage = `HTTP ${response.status}`;
			try {
				const errorJson = JSON.parse(errorText);
				errorMessage = errorJson.error?.message || errorJson.message || errorText;
			} catch {
				errorMessage = errorText.substring(0, 200);
			}
			return { success: false, error: errorMessage };
		}

		const data = await response.json();
		const content = data.choices?.[0]?.message?.content || "";

		return { success: true, content };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			error: errorMessage.includes("abort") ? "Request timed out" : errorMessage,
		};
	}
}

// ============================================================================
// PERSONA SELF-RECOGNITION (for testing/fun)
// ============================================================================

/**
 * Ask the vision model (with persona system prompt) to recognize itself.
 * This is the "Elara, who is this?" test.
 */
export async function personaSelfRecognition(
	imageBase64: string,
	personaSystemPrompt: string,
): Promise<{
	success: boolean;
	recognizedSelf: boolean | null;
	response?: string;
	error?: string;
}> {
	const result = await processWithVision(
		imageBase64,
		"Look at this image carefully. Who do you see? Do you recognize this person? Describe who this is.",
		personaSystemPrompt,
	);

	if (!result.success) {
		return {
			success: false,
			recognizedSelf: null,
			error: result.error,
		};
	}

	// Analyze if persona recognized itself
	const responseLC = result.description?.toLowerCase() || "";
	const selfIndicators = ["me", "myself", "i am", "that's me", "this is me", "my face"];
	const notMeIndicators = ["someone else", "another person", "don't know who"];

	const hasSelf = selfIndicators.some((ind) => responseLC.includes(ind));
	const hasNotMe = notMeIndicators.some((ind) => responseLC.includes(ind));

	let recognizedSelf: boolean | null = null;
	if (hasSelf && !hasNotMe) {
		recognizedSelf = true;
	} else if (hasNotMe && !hasSelf) {
		recognizedSelf = false;
	}

	return {
		success: true,
		recognizedSelf,
		response: result.description,
	};
}

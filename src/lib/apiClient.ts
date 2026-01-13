/**
 * OpenElara Cloud - API Client
 *
 * Ported from desktop openElara architecture.
 *
 * KEY DESIGN PRINCIPLES:
 * - Together.ai is the PRIMARY provider (chat, images, video, TTS)
 * - Other providers use OpenAI-compatible REST API
 * - Models are identified by provider from the model ID itself
 * - BYOK (Bring Your Own Key) - users store keys in localStorage
 *
 * The desktop app routes like this:
 * - Together.ai models → Together.ai API
 * - OpenRouter models → OpenRouter API (OpenAI-compatible)
 * - Custom providers → Any OpenAI-compatible endpoint
 * - Local LLM → Ollama/LM Studio (not applicable for cloud)
 */

import { type CustomEndpoint, getActiveEndpoint, getAPIKey, getCustomEndpoint } from "./byok";
import { logger } from "./logger";
import { IMAGE_MODEL_METADATA } from "./models";
import { calculateMaxTokens, estimateTokens } from "./tokenBudget";

// ============================================================================
// TYPES
// ============================================================================

export interface ChatMessage {
	role: "system" | "user" | "assistant" | "tool";
	content: string | ContentPart[];
	tool_calls?: ToolCall[];
	tool_call_id?: string;
}

export interface ContentPart {
	type: "text" | "image_url";
	text?: string;
	image_url?: { url: string };
}

export interface ToolCall {
	id: string;
	type: "function";
	function: {
		name: string;
		arguments: string;
	};
}

export interface Tool {
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: {
			type: "object";
			properties: Record<string, any>;
			required: string[];
		};
	};
}

export interface ModelConfig {
	modelId: string;
	provider: "together" | "openrouter" | "custom" | "vertex";
	displayName?: string;
}

export interface ChatPayload {
	messages: ChatMessage[];
	modelConfig: ModelConfig;
	temperature?: number;
	maxTokens?: number;
	ragContext?: string;
	tools?: Tool[];
	tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
}

export interface ChatResponse {
	success: boolean;
	answer?: string;
	thinking?: string;
	error?: string;
	toolCalls?: ToolCall[];
	emotionalState?: ExtractedEmotionalState | null; // Extracted emotional state for RAG tracking
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

export interface ImagePayload {
	prompt: string;
	model?: string;
	width?: number;
	height?: number;
	steps?: number;
	negativePrompt?: string;
	seed?: number;
	guidanceScale?: number;
}

export interface ImageResponse {
	success: boolean;
	data?: Array<{
		b64_json?: string;
		url?: string;
	}>;
	error?: string;
}

// ============================================================================
// THINKING TAG EXTRACTION (from desktop)
// ============================================================================

function extractThinkingForModal(content: string | null): string {
	if (!content || typeof content !== "string") {
		return "";
	}
	const thinkingMatch = content.match(/<thinking>([\s\S]*?)<\/thinking>/i);
	return thinkingMatch ? thinkingMatch[1].trim() : "";
}

/**
 * Extract emotional state log from LLM response (for RAG storage, NOT rendering)
 * Matches patterns like:
 * - "My current emotional state as Elara: GOOD, ENGAGED 💜"
 * - "[EMOTIONAL STATE: happy, engaged]"
 * - "Emotional state: content, curious"
 */
export interface ExtractedEmotionalState {
	rawLog: string;
	mood?: string;
	description?: string;
}

function extractEmotionalState(content: string | null): ExtractedEmotionalState | null {
	if (!content || typeof content !== "string") {
		return null;
	}

	// Pattern 1: "My current emotional state as [Name]: STATE"
	const pattern1 = /My current emotional state as \w+:\s*([^\n]+)/i;
	// Pattern 2: "[EMOTIONAL STATE: ...]" or "(EMOTIONAL STATE: ...)"
	const pattern2 = /[[(]EMOTIONAL\s*STATE[:\s]+([^\])]+)[\])]/i;
	// Pattern 3: "Emotional state:" at start of line
	const pattern3 = /^Emotional\s*state[:\s]+([^\n]+)/im;
	// Pattern 4: Mood level patterns like "Mood level: 75/100"
	const _pattern4 = /Mood\s*level[:\s]+\d+\/\d+[^\n]*/gi;
	// Pattern 5: Internal system markers
	const pattern5 = /═+[\s\S]*?EMOTIONAL STATE[\s\S]*?═+/gi;

	const match = content.match(pattern1) || content.match(pattern2) || content.match(pattern3);

	if (match) {
		return {
			rawLog: match[0],
			description: match[1]?.trim(),
		};
	}

	// Check for system marker patterns
	const systemMatch = content.match(pattern5);
	if (systemMatch) {
		return {
			rawLog: systemMatch[0],
		};
	}

	return null;
}

/**
 * Remove emotional state logs from content before rendering
 * These are for internal RAG/mood tracking only, not for user display
 */
function stripEmotionalStateLogs(content: string | null): string {
	if (!content || typeof content !== "string") {
		return content || "";
	}

	let cleaned = content;

	// Remove "My current emotional state as [Name]: ..." lines
	cleaned = cleaned.replace(/My current emotional state as \w+:[^\n]*\n?/gi, "");

	// Remove "[EMOTIONAL STATE: ...]" or "(EMOTIONAL STATE: ...)"
	cleaned = cleaned.replace(/[[(]EMOTIONAL\s*STATE[:\s]+[^\])]+[\])]\s*\n?/gi, "");

	// Remove "Emotional state:" lines
	cleaned = cleaned.replace(/^Emotional\s*state[:\s]+[^\n]*\n?/gim, "");

	// Remove "Mood level: X/100" lines
	cleaned = cleaned.replace(/Mood\s*level[:\s]+\d+\/\d+[^\n]*\n?/gi, "");

	// Remove system emotional state blocks (the fancy boxed ones)
	cleaned = cleaned.replace(/═+[\s\S]*?EMOTIONAL STATE[\s\S]*?═+\s*\n?/gi, "");
	cleaned = cleaned.replace(/─+[\s\S]*?EMOTIONAL STATE[\s\S]*?─+\s*\n?/gi, "");

	// Remove leading/trailing whitespace and normalize multiple newlines
	cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

	return cleaned;
}

function extractResponseForChat(content: string | null): string {
	if (!content || typeof content !== "string") {
		return content || "";
	}

	// Remove ALL thinking content FIRST (can appear anywhere)
	let cleaned = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();

	// Remove emotional state logs (for RAG only, not display)
	cleaned = stripEmotionalStateLogs(cleaned);

	// Check for <response> tags
	const responseMatch = cleaned.match(/<response>([\s\S]*?)<\/response>/i);
	if (responseMatch) {
		return responseMatch[1].trim();
	}

	return cleaned || content;
}

function extractAndCleanThought(content: string | null): {
	cleanedAnswer: string;
	extractedThinking: string;
	emotionalState: ExtractedEmotionalState | null;
} {
	return {
		cleanedAnswer: extractResponseForChat(content),
		extractedThinking: extractThinkingForModal(content),
		emotionalState: extractEmotionalState(content),
	};
}

// ============================================================================
// PROVIDER DETECTION (from desktop routeApiCall)
// ============================================================================

/**
 * Detect provider from model ID or explicit provider setting
 *
 * SUPPORTED PROVIDERS (matching desktop app):
 * - vertex: Vertex AI (Gemini) - Native Google, no API key needed
 * - together: Together.ai - Primary provider for chat, images, video, TTS
 * - openrouter: OpenRouter - Chat routing to 300+ models (50+ free)
 * - custom: User-defined endpoint (BYOEndpoint)
 *
 * Note: OpenAI/Anthropic models are accessed THROUGH OpenRouter, not directly.
 * This matches the desktop app's architecture.
 */
export function detectProvider(modelId: string, explicitProvider?: string): "together" | "openrouter" | "custom" | "vertex" {
	const normalized = (explicitProvider || modelId).toLowerCase();

	// Check for explicit Vertex AI / Gemini models
	if (
		normalized.includes("vertex") ||
		explicitProvider === "vertex" ||
		modelId.startsWith("gemini-") ||
		modelId.includes("gemini-2") ||
		modelId.includes("gemini-1.5") ||
		modelId.includes("imagen-")
	) {
		return "vertex";
	}

	// Check if there's an active custom endpoint
	const activeEndpoint = getActiveEndpoint();
	if (activeEndpoint && activeEndpoint !== "together" && activeEndpoint !== "openrouter" && activeEndpoint !== "vertex") {
		return "custom";
	}

	// Check for explicit custom provider marker
	if (normalized.includes("custom/") || explicitProvider === "custom") {
		return "custom";
	}

	// OpenRouter - explicit or models accessed via router
	if (
		normalized.includes("openrouter") ||
		normalized.includes("open router") ||
		modelId.startsWith("openai/") || // OpenAI via OpenRouter
		modelId.startsWith("anthropic/") || // Anthropic via OpenRouter
		modelId.startsWith("google/gemini")
	) {
		// Gemini via OpenRouter
		return "openrouter";
	}

	// Together.ai models - the primary provider
	// Includes: Llama, DeepSeek, Qwen, Mistral, FLUX, etc.
	if (
		normalized.includes("together") ||
		modelId.startsWith("meta-llama/") ||
		modelId.startsWith("mistralai/") ||
		modelId.startsWith("Qwen/") ||
		modelId.startsWith("deepseek-ai/") ||
		modelId.startsWith("google/") ||
		modelId.startsWith("black-forest-labs/") ||
		modelId.includes("Llama") ||
		modelId.includes("Mixtral") ||
		modelId.includes("-Free") ||
		modelId.includes("Turbo-Free")
	) {
		return "together";
	}

	// Default to vertex (native Google, no API key needed)
	return "vertex";
}

// ============================================================================
// VERTEX AI API (Native Google - No API Key Required)
// Uses Cloud Functions which have ADC (Application Default Credentials)
// ============================================================================

async function chatWithVertex(payload: ChatPayload): Promise<ChatResponse> {
	try {
		// Get Firebase auth token for the Cloud Function
		const { auth } = await import("./firebase");
		const user = auth.currentUser;
		if (!user) {
			return { success: false, error: "Not authenticated. Please sign in." };
		}
		
		const idToken = await user.getIdToken();
		
		// Determine the Cloud Function URL based on environment
		const functionUrl = process.env.NEXT_PUBLIC_FUNCTIONS_URL || 
			`https://us-central1-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net`;
		
		logger.debug(`Vertex AI: ${payload.modelConfig.modelId}`, { component: "API" });

		const response = await fetch(`${functionUrl}/vertexChat`, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${idToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messages: payload.messages,
				model: payload.modelConfig.modelId,
				temperature: payload.temperature ?? 0.7,
			}),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			if (response.status === 429) {
				return { success: false, error: "Vertex AI rate limit exceeded. Please wait a moment." };
			}
			if (response.status === 403) {
				return {
					success: false,
					error: errorData.error || "Trial expired or access denied.",
				};
			}
			return {
				success: false,
				error: `Vertex AI Error: ${errorData.error || response.statusText}`,
			};
		}

		const data = await response.json();
		const choice = data.choices?.[0];
		const rawContent = choice?.message?.content;

		const { cleanedAnswer, extractedThinking, emotionalState } = extractAndCleanThought(rawContent);

		return {
			success: true,
			answer: cleanedAnswer,
			thinking: extractedThinking,
			emotionalState,
			usage: data.usage,
		};
	} catch (error: any) {
		console.error("[Vertex AI] Request failed:", error);
		return { success: false, error: `Vertex AI Error: ${error.message}` };
	}
}

// ============================================================================
// TOGETHER.AI API (Primary Provider)
// ============================================================================

async function chatWithTogether(apiKey: string, payload: ChatPayload): Promise<ChatResponse> {
	try {
		// Calculate max_tokens dynamically based on model context window and token mode
		const inputTokens = estimateTokens(JSON.stringify(payload.messages));
		const maxTokens = payload.maxTokens ?? calculateMaxTokens(payload.modelConfig.modelId, inputTokens);

		const requestBody: Record<string, unknown> = {
			model: payload.modelConfig.modelId,
			messages: payload.messages,
			temperature: payload.temperature ?? 0.7,
		};

		// Only set max_tokens if explicitly provided or in standard mode
		// FULLY_AUTO and SEMI_AUTO modes return null - let model decide
		if (maxTokens !== null) {
			requestBody.max_tokens = maxTokens;
		}

		logger.debug(`Together: ${payload.modelConfig.modelId} (max_tokens: ${maxTokens ?? "auto"})`, { component: "API" });

		const response = await fetch("https://api.together.xyz/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"Cache-Control": "no-cache, no-store, must-revalidate",
				"X-Request-ID": `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			if (response.status === 429) {
				return { success: false, error: "Together.ai rate limit exceeded. Please wait a moment." };
			}
			// Model not found/available - provide honest error
			if (response.status === 404) {
				return {
					success: false,
					error: `Model "${payload.modelConfig.modelId}" is not available. Please select a different model in Settings.`,
				};
			}
			// Model quota/billing issue
			if (response.status === 402 || response.status === 403) {
				return {
					success: false,
					error: `Access denied for model "${payload.modelConfig.modelId}". This model may require a paid API key or have billing restrictions.`,
				};
			}
			return {
				success: false,
				error: `Together.ai API Error: ${errorData.error?.message || response.statusText}`,
			};
		}

		const data = await response.json();
		const choice = data.choices?.[0];
		const rawContent = choice?.message?.content;

		const { cleanedAnswer, extractedThinking, emotionalState } = extractAndCleanThought(rawContent);

		return {
			success: true,
			answer: cleanedAnswer,
			thinking: extractedThinking,
			emotionalState,
			usage: data.usage,
		};
	} catch (error: any) {
		console.error("[Together] Request failed:", error);
		return { success: false, error: `Together.ai Error: ${error.message}` };
	}
}

// ============================================================================
// OPENROUTER API (OpenAI-Compatible)
// ============================================================================

async function chatWithOpenRouter(apiKey: string, payload: ChatPayload): Promise<ChatResponse> {
	try {
		// Calculate max_tokens dynamically based on model context window and token mode
		const inputTokens = estimateTokens(JSON.stringify(payload.messages));
		const maxTokens = payload.maxTokens ?? calculateMaxTokens(payload.modelConfig.modelId, inputTokens);

		const requestBody: Record<string, unknown> = {
			model: payload.modelConfig.modelId,
			messages: payload.messages,
			temperature: payload.temperature ?? 0.7,
		};

		// Only set max_tokens if explicitly provided or in standard mode
		// FULLY_AUTO and SEMI_AUTO modes return null - let model decide
		if (maxTokens !== null) {
			requestBody.max_tokens = maxTokens;
		}

		logger.debug(`OpenRouter: ${payload.modelConfig.modelId} (max_tokens: ${maxTokens ?? "auto"})`, {
			component: "API",
		});

		const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://openelara.ai",
				"X-Title": "OpenElara Cloud",
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			if (response.status === 429) {
				const guiltyProvider = errorData.error?.metadata?.provider_name || "Unknown";
				return {
					success: false,
					error: `OpenRouter rate limit from provider: ${guiltyProvider}. Consider blocking this provider.`,
				};
			}
			return {
				success: false,
				error: `OpenRouter API Error: ${errorData.error?.message || response.statusText}`,
			};
		}

		const data = await response.json();
		const choice = data.choices?.[0];
		const rawContent = choice?.message?.content;

		const { cleanedAnswer, extractedThinking, emotionalState } = extractAndCleanThought(rawContent);

		return {
			success: true,
			answer: cleanedAnswer,
			thinking: extractedThinking,
			emotionalState,
			usage: data.usage,
		};
	} catch (error: any) {
		console.error("[OpenRouter] Request failed:", error);
		return { success: false, error: `OpenRouter Error: ${error.message}` };
	}
}

// ============================================================================
// OPENAI-STYLE API (Generic OpenAI-Compatible)
// ============================================================================

async function _chatWithOpenAIStyle(
	apiKey: string,
	endpoint: string,
	payload: ChatPayload,
	extraHeaders?: Record<string, string>,
): Promise<ChatResponse> {
	try {
		// Calculate max_tokens dynamically based on model context window and token mode
		const inputTokens = estimateTokens(JSON.stringify(payload.messages));
		const maxTokens = payload.maxTokens ?? calculateMaxTokens(payload.modelConfig.modelId, inputTokens);

		const requestBody: Record<string, unknown> = {
			model: payload.modelConfig.modelId,
			messages: payload.messages,
			temperature: payload.temperature ?? 0.7,
		};

		// Only set max_tokens if explicitly provided or in standard mode
		// FULLY_AUTO and SEMI_AUTO modes return null - let model decide
		if (maxTokens !== null) {
			requestBody.max_tokens = maxTokens;
		}

		logger.debug(`OpenAI-style: ${payload.modelConfig.modelId} (max_tokens: ${maxTokens ?? "auto"})`, {
			component: "API",
		});

		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				...extraHeaders,
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			if (response.status === 429) {
				return { success: false, error: "API rate limit exceeded. Please wait a moment." };
			}
			// Model not found/available - provide honest error
			if (response.status === 404) {
				return {
					success: false,
					error: `Model "${payload.modelConfig.modelId}" is not available. Please select a different model in Settings.`,
				};
			}
			return {
				success: false,
				error: `API Error: ${errorData.error?.message || response.statusText}`,
			};
		}

		const data = await response.json();
		const choice = data.choices?.[0];
		const rawContent = choice?.message?.content;

		const { cleanedAnswer, extractedThinking, emotionalState } = extractAndCleanThought(rawContent);

		return {
			success: true,
			answer: cleanedAnswer,
			thinking: extractedThinking,
			emotionalState,
			usage: data.usage,
		};
	} catch (error: any) {
		console.error("[OpenAI-Style] Request failed:", error);
		return { success: false, error: `API Error: ${error.message}` };
	}
}

// ============================================================================
// CUSTOM ENDPOINT API (BYOEndpoint)
// ============================================================================

/**
 * Merge custom JSON fields into base payload
 */
function mergeCustomPayload(basePayload: Record<string, unknown>, customJSON?: string): Record<string, unknown> {
	if (!customJSON || !customJSON.trim()) {
		return basePayload;
	}

	try {
		const customFields = JSON.parse(customJSON);
		return { ...basePayload, ...customFields };
	} catch (error) {
		console.error("[Custom Endpoint] Invalid custom JSON:", error);
		return basePayload;
	}
}

/**
 * Build payload from template (advanced mode)
 */
function buildFromTemplate(
	template: string,
	modelId: string,
	messages: ChatMessage[],
	temperature: number,
	maxTokens: number | null,
): Record<string, unknown> {
	try {
		// Replace placeholders
		const built = template
			.replace(/{{MODEL}}/g, modelId)
			.replace(/{{MESSAGES}}/g, JSON.stringify(messages))
			.replace(/{{TEMPERATURE}}/g, temperature.toString())
			.replace(/{{MAX_TOKENS}}/g, maxTokens !== null ? maxTokens.toString() : "null");

		return JSON.parse(built);
	} catch (error) {
		console.error("[Custom Endpoint] Invalid payload template:", error);
		// Fallback to standard
		return {
			model: modelId,
			messages,
			temperature,
			...(maxTokens !== null ? { max_tokens: maxTokens } : {}),
		};
	}
}

/**
 * Chat with a custom endpoint (BYOEndpoint)
 *
 * ⚠️ ONLY works if endpoint follows OpenAI-compatible REST API standards.
 * No guarantees. Chat only - NOT for image/video generation.
 *
 * Supports:
 * - Custom base URLs
 * - Custom JSON fields (e.g., {"nsfw": true})
 * - Full payload override with templates
 */
async function chatWithCustomEndpoint(endpoint: CustomEndpoint, payload: ChatPayload): Promise<ChatResponse> {
	try {
		// Calculate max_tokens
		const inputTokens = estimateTokens(JSON.stringify(payload.messages));
		const maxTokens = payload.maxTokens ?? calculateMaxTokens(payload.modelConfig.modelId, inputTokens);

		// Determine the chat endpoint URL
		const chatUrl = endpoint.chatEndpoint || (endpoint.baseUrl ? `${endpoint.baseUrl}/v1/chat/completions` : null);

		if (!chatUrl) {
			return {
				success: false,
				error: "Custom endpoint requires either chatEndpoint or baseUrl to be configured.",
			};
		}

		// Build the request body
		let requestBody: Record<string, unknown>;

		if (endpoint.overridePayload && endpoint.payloadTemplate) {
			// Advanced: Use template
			requestBody = buildFromTemplate(
				endpoint.payloadTemplate,
				payload.modelConfig.modelId,
				payload.messages,
				payload.temperature ?? 0.7,
				maxTokens,
			);
		} else {
			// Standard: Build OpenAI-compatible payload with custom fields
			const basePayload: Record<string, unknown> = {
				model: payload.modelConfig.modelId,
				messages: payload.messages,
				temperature: payload.temperature ?? 0.7,
			};

			// Add max_tokens if not unrestricted
			if (maxTokens !== null) {
				basePayload.max_tokens = maxTokens;
			}

			// Merge custom JSON fields
			requestBody = mergeCustomPayload(basePayload, endpoint.customPayload);
		}

		logger.debug(`Custom endpoint: ${chatUrl} → ${payload.modelConfig.modelId}`, { component: "API" });

		// Build headers
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		// Add auth if API key provided
		if (endpoint.apiKey?.trim()) {
			headers.Authorization = `Bearer ${endpoint.apiKey.trim()}`;
		}

		const response = await fetch(chatUrl, {
			method: "POST",
			headers,
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			if (response.status === 429) {
				return { success: false, error: "API rate limit exceeded. Please wait a moment." };
			}
			return {
				success: false,
				error: `Custom endpoint error (${response.status}): ${errorData.error?.message || response.statusText}`,
			};
		}

		const data = await response.json();
		const choice = data.choices?.[0];
		const rawContent = choice?.message?.content;

		const { cleanedAnswer, extractedThinking, emotionalState } = extractAndCleanThought(rawContent);

		return {
			success: true,
			answer: cleanedAnswer,
			thinking: extractedThinking,
			emotionalState,
			usage: data.usage,
		};
	} catch (error: any) {
		console.error("[Custom Endpoint] Request failed:", error);
		return { success: false, error: `Custom endpoint error: ${error.message}` };
	}
}

// ============================================================================
// MAIN ROUTER (from desktop routeApiCall)
// ============================================================================

/**
 * Route API call to appropriate provider
 *
 * This mimics the desktop's routeApiCall function:
 * - Detects provider from model ID
 * - Gets appropriate API key
 * - Calls the right handler
 */
export async function routeChat(payload: ChatPayload): Promise<ChatResponse> {
	const provider = payload.modelConfig.provider || detectProvider(payload.modelConfig.modelId);

	logger.debug(`Routing to: ${provider}`, { component: "API" });

	switch (provider) {
		case "vertex": {
			// Vertex AI - Native Google, no API key needed (uses Cloud Functions)
			return chatWithVertex(payload);
		}

		case "together": {
			const apiKey = await getAPIKey("together");
			if (!apiKey) {
				// Fall back to Vertex AI if no Together key
				logger.debug("No Together.ai key, falling back to Vertex AI", { component: "API" });
				return chatWithVertex(payload);
			}
			return chatWithTogether(apiKey, payload);
		}

		case "openrouter": {
			const apiKey = await getAPIKey("openrouter");
			if (!apiKey) {
				// Fall back to Vertex AI if no OpenRouter key
				logger.debug("No OpenRouter key, falling back to Vertex AI", { component: "API" });
				return chatWithVertex(payload);
			}
			return chatWithOpenRouter(apiKey, payload);
		}

		case "custom": {
			// Get the active custom endpoint
			const activeEndpoint = getActiveEndpoint();
			if (!activeEndpoint || activeEndpoint === "together" || activeEndpoint === "openrouter" || activeEndpoint === "vertex") {
				return { success: false, error: "No custom endpoint selected." };
			}

			const endpoint = getCustomEndpoint(activeEndpoint);
			if (!endpoint) {
				return { success: false, error: `Custom endpoint "${activeEndpoint}" not found.` };
			}

			if (endpoint.enabled === false) {
				return { success: false, error: `Custom endpoint "${activeEndpoint}" is disabled.` };
			}

			return chatWithCustomEndpoint(endpoint, payload);
		}

		default: {
			// Default: Try Vertex AI first (native, no key needed)
			// Then try BYOK providers
			const togetherKey = await getAPIKey("together");
			if (togetherKey) {
				return chatWithTogether(togetherKey, payload);
			}

			const openrouterKey = await getAPIKey("openrouter");
			if (openrouterKey) {
				return chatWithOpenRouter(openrouterKey, payload);
			}

			// Fall back to Vertex AI (always available)
			return chatWithVertex(payload);
		}
	}
}

// ============================================================================
// IMAGE GENERATION
// ============================================================================

/**
 * Generate image using Vertex AI (Imagen) - Native Google
 * No API key required - uses Cloud Functions with ADC
 */
export async function generateImageVertex(payload: ImagePayload): Promise<ImageResponse> {
	try {
		const { auth } = await import("./firebase");
		const user = auth.currentUser;
		if (!user) {
			return { success: false, error: "Not authenticated. Please sign in." };
		}
		
		const idToken = await user.getIdToken();
		
		const functionUrl = process.env.NEXT_PUBLIC_FUNCTIONS_URL || 
			`https://us-central1-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net`;
		
		logger.debug(`Vertex Image: ${payload.model || "imagen-3.0-generate-001"}`, { component: "API" });

		const response = await fetch(`${functionUrl}/vertexGenerateImage`, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${idToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				prompt: payload.prompt,
				model: payload.model || "imagen-3.0-generate-001",
				width: payload.width,
				height: payload.height,
				negativePrompt: payload.negativePrompt,
			}),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return {
				success: false,
				error: `Vertex AI Image Error: ${errorData.error || response.statusText}`,
			};
		}

		const data = await response.json();
		return {
			success: true,
			data: data.data,
		};
	} catch (error: any) {
		console.error("[Vertex Image] Generation failed:", error);
		return { success: false, error: `Vertex AI Image Error: ${error.message}` };
	}
}

/**
 * Generate image using Together.ai (FLUX models)
 *
 * Together.ai is the BYOK provider for image generation (FLUX models)
 * Uses user-selected model or defaults to free tier
 */
export async function generateImage(payload: ImagePayload): Promise<ImageResponse> {
	// Check if user has Together.ai key
	const apiKey = await getAPIKey("together");
	
	// If no Together key, use Vertex AI (Imagen) as fallback
	if (!apiKey) {
		logger.debug("No Together.ai key, using Vertex AI Imagen", { component: "API" });
		return generateImageVertex(payload);
	}

	// Get the model: explicit > user selection > fallback
	const modelId = payload.model || "black-forest-labs/FLUX.1-schnell";
	const modelMeta = IMAGE_MODEL_METADATA[modelId];

	const requestBody: Record<string, unknown> = {
		model: modelId,
		prompt: payload.prompt,
		width: payload.width || modelMeta?.defaultWidth || 1024,
		height: payload.height || modelMeta?.defaultHeight || 1024,
		steps: payload.steps || modelMeta?.defaultSteps || 4,
		n: 1,
		response_format: "b64_json",
	};

	// Add optional parameters if supported by model
	if (payload.negativePrompt && modelMeta?.supportsNegativePrompt !== false) {
		requestBody.negative_prompt = payload.negativePrompt;
	}
	if (payload.seed !== undefined) {
		requestBody.seed = payload.seed;
	}
	if (payload.guidanceScale !== undefined) {
		requestBody.guidance = payload.guidanceScale;
	} else if (modelMeta?.defaultGuidanceScale) {
		requestBody.guidance = modelMeta.defaultGuidanceScale;
	}

	logger.debug(`Image: ${modelId} ${requestBody.width}x${requestBody.height}, ${requestBody.steps} steps`, {
		component: "API",
	});

	try {
		const response = await fetch("https://api.together.xyz/v1/images/generations", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return {
				success: false,
				error: `Image generation failed: ${errorData.error?.message || response.statusText}`,
			};
		}

		const data = await response.json();
		return {
			success: true,
			data: data.data,
		};
	} catch (error: any) {
		console.error("[Together Image] Generation failed:", error);
		return { success: false, error: `Image generation error: ${error.message}` };
	}
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export { getAllAPIKeys, getAPIKey, hasOwnKeys } from "./byok";

/**
 * Simple chat function for backwards compatibility
 *
 * Uses the model selection from localStorage (via models.ts)
 * or falls back to a known-good default model
 *
 * Returns both the answer and thinking (for display in thinking modal)
 */
export async function chat(
	messages: ChatMessage[],
	options: {
		model?: string;
		temperature?: number;
		maxTokens?: number;
		tools?: Tool[];
		tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
	} = {},
): Promise<{
	choices: Array<{ message: { role: string; content: string; thinking?: string; tool_calls?: ToolCall[] } }>;
	thinking?: string;
}> {
	// ⛔ NO HARDCODED FALLBACK - model MUST be provided
	// If no model specified, throw error - UI should ensure model is selected
	const modelId = options.model;
	if (!modelId) {
		throw new Error("Chat model not specified. Please select a model in Settings.");
	}
	const provider = detectProvider(modelId);

	logger.debug(`Chat: ${modelId} (→ ${provider})`, { component: "API" });

	const payload: ChatPayload = {
		messages,
		modelConfig: {
			modelId,
			provider,
		},
		temperature: options.temperature,
		maxTokens: options.maxTokens,
		tools: options.tools,
		tool_choice: options.tool_choice,
	};

	const result = await routeChat(payload);

	if (!result.success) {
		throw new Error(result.error || "Chat failed");
	}

	// Return in OpenAI-compatible format with thinking and tool_calls preserved
	return {
		choices: [
			{
				message: {
					role: "assistant",
					content: result.answer || "",
					thinking: result.thinking,
					tool_calls: result.toolCalls,
				},
			},
		],
		thinking: result.thinking,
	};
}

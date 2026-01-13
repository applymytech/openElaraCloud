/**
 * Shared Model & Tool Registry - Platform Agnostic
 * =================================================
 *
 * This file contains the CANONICAL definitions for:
 * - Chat LLM providers and models
 * - Image generation models
 * - Video generation models
 * - Speech/TTS models
 * - Agentic tools (function calling)
 * - Custom endpoint configuration
 *
 * USAGE:
 * - Desktop (Electron): Import directly, uses IPC for API calls
 * - Cloud (Next.js): Import directly, uses fetch for API calls
 *
 * GOAL: 100% alignment between Desktop and Cloud apps
 *
 * @author OpenElara Project
 * @license MIT
 * @version 2.0.0 (Unified)
 */

// ============================================================================
// PROVIDER DEFINITIONS
// ============================================================================

export type ProviderType =
	| "together" // Together.ai - Primary provider
	| "openrouter" // OpenRouter - Multi-provider gateway
	| "openai" // OpenAI direct
	| "anthropic" // Anthropic direct
	| "google" // Google AI (Gemini)
	| "local" // Local LLM (Ollama, LM Studio)
	| "custom"; // User-defined endpoint

export interface ProviderConfig {
	id: ProviderType;
	name: string;
	baseUrl: string;
	modelsEndpoint: string;
	chatEndpoint: string;
	authHeader: "Authorization" | "X-API-Key" | "custom";
	authPrefix?: string; // e.g., "Bearer "
	supportsTools: boolean;
	supportsStreaming: boolean;
	supportsImages: boolean;
	supportsVideos: boolean;
	supportsTTS: boolean;
	requiresApiKey: boolean;
}

export const PROVIDERS: Record<ProviderType, ProviderConfig> = {
	together: {
		id: "together",
		name: "Together.ai",
		baseUrl: "https://api.together.xyz",
		modelsEndpoint: "/v1/models",
		chatEndpoint: "/v1/chat/completions",
		authHeader: "Authorization",
		authPrefix: "Bearer ",
		supportsTools: true,
		supportsStreaming: true,
		supportsImages: true,
		supportsVideos: true,
		supportsTTS: true,
		requiresApiKey: true,
	},
	openrouter: {
		id: "openrouter",
		name: "OpenRouter",
		baseUrl: "https://openrouter.ai/api",
		modelsEndpoint: "/v1/models",
		chatEndpoint: "/v1/chat/completions",
		authHeader: "Authorization",
		authPrefix: "Bearer ",
		supportsTools: true,
		supportsStreaming: true,
		supportsImages: false,
		supportsVideos: false,
		supportsTTS: false,
		requiresApiKey: true,
	},
	openai: {
		id: "openai",
		name: "OpenAI",
		baseUrl: "https://api.openai.com",
		modelsEndpoint: "/v1/models",
		chatEndpoint: "/v1/chat/completions",
		authHeader: "Authorization",
		authPrefix: "Bearer ",
		supportsTools: true,
		supportsStreaming: true,
		supportsImages: true,
		supportsVideos: false,
		supportsTTS: true,
		requiresApiKey: true,
	},
	anthropic: {
		id: "anthropic",
		name: "Anthropic",
		baseUrl: "https://api.anthropic.com",
		modelsEndpoint: "/v1/models",
		chatEndpoint: "/v1/messages",
		authHeader: "X-API-Key",
		supportsTools: true,
		supportsStreaming: true,
		supportsImages: false,
		supportsVideos: false,
		supportsTTS: false,
		requiresApiKey: true,
	},
	google: {
		id: "google",
		name: "Google AI",
		baseUrl: "https://generativelanguage.googleapis.com",
		modelsEndpoint: "/v1/models",
		chatEndpoint: "/v1/models/{model}:generateContent",
		authHeader: "custom",
		supportsTools: true,
		supportsStreaming: true,
		supportsImages: true,
		supportsVideos: false,
		supportsTTS: false,
		requiresApiKey: true,
	},
	local: {
		id: "local",
		name: "Local LLM",
		baseUrl: "http://localhost:11434", // Ollama default
		modelsEndpoint: "/api/tags",
		chatEndpoint: "/api/chat",
		authHeader: "Authorization",
		supportsTools: false, // Most local models don't support tools
		supportsStreaming: true,
		supportsImages: false,
		supportsVideos: false,
		supportsTTS: false,
		requiresApiKey: false,
	},
	custom: {
		id: "custom",
		name: "Custom Endpoint",
		baseUrl: "", // User-provided
		modelsEndpoint: "/v1/models",
		chatEndpoint: "/v1/chat/completions",
		authHeader: "Authorization",
		authPrefix: "Bearer ",
		supportsTools: false, // Assume no
		supportsStreaming: true,
		supportsImages: false,
		supportsVideos: false,
		supportsTTS: false,
		requiresApiKey: true,
	},
};

// ============================================================================
// CUSTOM ENDPOINT CONFIGURATION
// ============================================================================

/**
 * CustomEndpoint - BYOEndpoint configuration
 *
 * Allows users to connect to ANY chat LLM by providing endpoints.
 *
 * ⚠️ IMPORTANT: This only works if the endpoint follows OpenAI REST API standards.
 * Chat LLM ONLY - NOT for images/videos/audio generation.
 */
export interface CustomEndpoint {
	id: string; // Unique identifier
	name: string; // User-friendly display name
	apiKey?: string; // API key (can be empty for some endpoints)
	baseUrl: string; // Base URL (e.g., https://api.example.com)
	modelsEndpoint?: string; // Override /v1/models path
	chatEndpoint?: string; // Override /v1/chat/completions path
	customHeaders?: Record<string, string>; // Extra headers
	customPayload?: Record<string, unknown>; // Extra JSON fields to merge
	overridePayload?: boolean; // If true, use payloadTemplate instead
	payloadTemplate?: string; // Full payload template with {{placeholders}}
	enabled: boolean; // Whether this endpoint is active
	lastVerified?: string; // ISO date of last successful verification
	supportedModels?: string[]; // Cached list of models from /models endpoint
}

/**
 * Default custom endpoint template
 */
export function createCustomEndpoint(partial: Partial<CustomEndpoint>): CustomEndpoint {
	return {
		id: partial.id || crypto.randomUUID?.() || `custom_${Date.now()}`,
		name: partial.name || "Custom API",
		apiKey: partial.apiKey || "",
		baseUrl: partial.baseUrl || "",
		modelsEndpoint: partial.modelsEndpoint,
		chatEndpoint: partial.chatEndpoint,
		customHeaders: partial.customHeaders,
		customPayload: partial.customPayload,
		overridePayload: partial.overridePayload || false,
		payloadTemplate: partial.payloadTemplate,
		enabled: partial.enabled ?? true,
		lastVerified: partial.lastVerified,
		supportedModels: partial.supportedModels,
	};
}

// ============================================================================
// TOOL DEFINITIONS (FUNCTION CALLING)
// ============================================================================

/**
 * Tool definition following OpenAI function calling schema
 */
export interface Tool {
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: {
			type: "object";
			properties: Record<
				string,
				{
					type: string;
					description: string;
					enum?: string[];
				}
			>;
			required: string[];
		};
	};
}

/**
 * Tool execution result
 */
export interface ToolResult {
	tool: string;
	input: Record<string, unknown>;
	output: unknown;
	success: boolean;
	error?: string;
	timestamp: string;
	executionMs?: number;
}

/**
 * CANONICAL Tool Registry
 *
 * These tools are available in BOTH Desktop and Cloud apps.
 * Implementation differs (IPC vs fetch) but interface is identical.
 */
export const UNIFIED_TOOLS: Tool[] = [
	// ═══════════════════════════════════════════════════════════════════════════
	// WEB TOOLS - Search and fetch from internet (requires Exa API key)
	// ═══════════════════════════════════════════════════════════════════════════
	{
		type: "function",
		function: {
			name: "search_web",
			description:
				"Search the web for current information using Exa.ai. Returns an AI-generated answer synthesized from multiple web sources. Use for up-to-date information, news, or facts.",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "What to search for - a plain English question or search query.",
					},
				},
				required: ["query"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "read_url",
			description:
				"Fetch and extract the main content from a specific webpage URL. Use when you need to read a particular webpage.",
			parameters: {
				type: "object",
				properties: {
					url: {
						type: "string",
						description: "The full URL to fetch content from (must include https:// or http://).",
					},
				},
				required: ["url"],
			},
		},
	},

	// ═══════════════════════════════════════════════════════════════════════════
	// RAG TOOLS - Search local knowledge and memories (Desktop-only for now)
	// ═══════════════════════════════════════════════════════════════════════════
	{
		type: "function",
		function: {
			name: "search_knowledge_base",
			description:
				"Search the user's uploaded documents and knowledge base for relevant information. Use for facts from uploaded documents.",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "Specific search query for the knowledge base.",
					},
					top_k: {
						type: "number",
						description: "Number of results to retrieve. Default 5, max 20.",
					},
				},
				required: ["query"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "search_conversation_memory",
			description: "Search past conversations with the user to recall previous discussions, preferences, or context.",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "What to search for in past conversations.",
					},
					time_range: {
						type: "string",
						description: "Time filter: recent (last week), month, all. Default: all.",
						enum: ["recent", "month", "all"],
					},
				},
				required: ["query"],
			},
		},
	},

	// ═══════════════════════════════════════════════════════════════════════════
	// CONTENT GENERATION - Images, Videos, Audio (requires Together API key)
	// ═══════════════════════════════════════════════════════════════════════════
	{
		type: "function",
		function: {
			name: "generate_image",
			description:
				"Generate an image using Together.ai image models. You write the detailed description including style, mood, composition, lighting, colors.",
			parameters: {
				type: "object",
				properties: {
					prompt: {
						type: "string",
						description: "Detailed image description. Be as specific as possible for best results.",
					},
					model: {
						type: "string",
						description:
							"Optional: Image model to use. Defaults to FLUX.1-schnell. Options: FLUX.1-schnell, FLUX.1-dev, FLUX.2-flex (best for text), stabilityai/stable-diffusion-xl-base-1.0",
					},
					width: {
						type: "number",
						description: "Image width in pixels (64-2048). Default: 1024",
					},
					height: {
						type: "number",
						description: "Image height in pixels (64-2048). Default: 1024",
					},
				},
				required: ["prompt"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "generate_persona_selfie",
			description:
				"Generate a selfie of the current AI persona/character in a contextual scene. Use when the user wants to see the AI or asks for a picture of the persona.",
			parameters: {
				type: "object",
				properties: {
					context: {
						type: "string",
						description:
							"Situation/setting for the selfie (e.g., at the gym, in a meeting, at a party, casual at home).",
					},
					mood: {
						type: "string",
						description: "Emotional expression: happy, professional, playful, serious, energetic, calm.",
					},
					custom_attire: {
						type: "string",
						description: "Optional: Override default wardrobe (e.g., red evening gown, workout gear).",
					},
				},
				required: ["context", "mood"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "generate_video",
			description:
				"Generate a short video (5-10 seconds) using Together.ai video models. Use when user explicitly requests video creation. EXPENSIVE operation.",
			parameters: {
				type: "object",
				properties: {
					prompt: {
						type: "string",
						description: "Detailed video description including action, scene, camera movement, timing.",
					},
					model: {
						type: "string",
						description:
							"Optional: Video model. Defaults to cost-effective model. Options: minimax/video-01-director, google/veo-3.0-fast",
					},
					duration: {
						type: "number",
						description: "Video duration in seconds (3-10). Default: 5",
					},
				},
				required: ["prompt"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "generate_voice_clip",
			description:
				"Generate a voice/audio clip using text-to-speech. Use when user asks the AI to say something or wants audio output.",
			parameters: {
				type: "object",
				properties: {
					text: {
						type: "string",
						description: "Text to convert to speech. Keep under 500 characters.",
					},
					emotion: {
						type: "string",
						description: "Emotional tone: neutral, happy, sad, excited, calm.",
						enum: ["neutral", "happy", "sad", "excited", "calm"],
					},
				},
				required: ["text"],
			},
		},
	},

	// ═══════════════════════════════════════════════════════════════════════════
	// UTILITY TOOLS - Scratchpad, notes, thinking
	// ═══════════════════════════════════════════════════════════════════════════
	{
		type: "function",
		function: {
			name: "save_thought",
			description:
				"Save an important finding or reasoning step to your scratchpad. Use to remember things for later turns in multi-step reasoning.",
			parameters: {
				type: "object",
				properties: {
					thought: {
						type: "string",
						description: "What you learned or figured out.",
					},
				},
				required: ["thought"],
			},
		},
	},
];

/**
 * Get tools available based on API keys present
 *
 * @param availableKeys - Object with boolean flags for each API key
 * @returns Filtered list of tools the user can actually use
 */
export function getAvailableTools(availableKeys: { together?: boolean; exa?: boolean; hasRAG?: boolean }): {
	tools: Tool[];
	unavailableReasons: string[];
} {
	const tools: Tool[] = [];
	const unavailableReasons: string[] = [];

	for (const tool of UNIFIED_TOOLS) {
		const name = tool.function.name;

		// Web tools require Exa
		if (name === "search_web" || name === "read_url") {
			if (availableKeys.exa) {
				tools.push(tool);
			} else {
				unavailableReasons.push(`${name}: Requires Exa API key`);
			}
			continue;
		}

		// RAG tools require local RAG system
		if (name === "search_knowledge_base" || name === "search_conversation_memory") {
			if (availableKeys.hasRAG) {
				tools.push(tool);
			} else {
				unavailableReasons.push(`${name}: Requires RAG system (Desktop only)`);
			}
			continue;
		}

		// Content generation requires Together
		if (name.startsWith("generate_")) {
			if (availableKeys.together) {
				tools.push(tool);
			} else {
				unavailableReasons.push(`${name}: Requires Together.ai API key`);
			}
			continue;
		}

		// Utility tools always available
		tools.push(tool);
	}

	return { tools, unavailableReasons };
}

// ============================================================================
// MODEL TYPE DEFINITIONS
// ============================================================================

export type ModelType = "chat" | "image" | "video" | "audio" | "embedding";

export interface BaseModel {
	id: string;
	type: ModelType;
	displayName: string;
	provider: ProviderType;
	description?: string;
	contextLength?: number;
	pricing?: {
		input?: number; // Per 1M tokens
		output?: number; // Per 1M tokens
		perImage?: number;
		perSecond?: number;
	};
	free?: boolean;
	deprecated?: boolean;
}

export interface ChatModel extends BaseModel {
	type: "chat";
	supportsTools: boolean;
	supportsVision: boolean;
	supportsStreaming: boolean;
	isThinking?: boolean; // CoT/reasoning model
	maxOutputTokens?: number;
}

export interface ImageModel extends BaseModel {
	type: "image";
	supportsT2I: boolean;
	supportsI2I: boolean;
	supportsNegativePrompt: boolean;
	supportsSteps: boolean;
	supportsGuidanceScale: boolean;
	supportsSeed: boolean;
	supportsLoRA: boolean;
	defaultSteps?: number;
	stepRange?: { min: number; max: number };
	defaultGuidanceScale?: number;
	guidanceScaleRange?: { min: number; max: number };
	defaultWidth: number;
	defaultHeight: number;
	maxWidth: number;
	maxHeight: number;
}

export interface VideoModel extends BaseModel {
	type: "video";
	supportsT2V: boolean;
	supportsI2V: boolean;
	supportsFirstFrame: boolean;
	supportsLastFrame: boolean;
	supportsAudio: boolean;
	defaultDuration: number;
	maxDuration: number;
	supportsSeed: boolean;
	defaultResolution: string;
	availableResolutions: string[];
}

export interface AudioModel extends BaseModel {
	type: "audio";
	voices: string[];
	defaultVoice: string;
	maxCharacters: number;
	supportedFormats: string[];
	sampleRate: number;
}

// ============================================================================
// AGENTIC WORKFLOW CONFIGURATION
// ============================================================================

export interface AgenticConfig {
	maxTurns: number; // Max tool use turns before forcing final answer
	requireAcknowledge: boolean; // Show "working on it" before tools
	allowParallel: boolean; // Allow multiple tool calls in one turn
	scratchpadEnabled: boolean; // Enable save_thought tool
}

export const DEFAULT_AGENTIC_CONFIG: AgenticConfig = {
	maxTurns: 5,
	requireAcknowledge: true,
	allowParallel: false, // Sequential for reliability
	scratchpadEnabled: true,
};

// ============================================================================
// EXPORTS
// ============================================================================

export {
	// Re-export for convenience
	PROVIDERS as providers,
	UNIFIED_TOOLS as tools,
};

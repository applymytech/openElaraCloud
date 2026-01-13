/**
 * Dynamic Model Registry - Fetches from Together.ai /models endpoint
 *
 * NO MANUAL DATABASES - Everything comes from the API response
 *
 * Together.ai /models response schema:
 * {
 *   data: [
 *     {
 *       id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
 *       object: "model",
 *       created: 1234567890,
 *       type: "chat" | "image" | "video" | "embedding" | "moderation",
 *       display_name: "Llama 3.3 70B Instruct Turbo",
 *       context_length: 131072,
 *       pricing: { input: 0.0006, output: 0.0006 },
 *       // ... other fields
 *     }
 *   ]
 * }
 */

import { getAPIKey } from "./byok";

export interface TogetherModel {
	id: string;
	object: string;
	created: number;
	type: "chat" | "image" | "video" | "embedding" | "moderation" | "language";
	display_name?: string;
	context_length?: number;
	pricing?: {
		input?: number;
		output?: number;
		hourly?: number;
		base?: number;
		finetune?: number;
		image?: number;
	};
	architecture?: {
		modality?: string;
		tokenizer?: string;
		instruct_type?: string;
	};
}

export interface TogetherModelsResponse {
	data: TogetherModel[];
}

let cachedModels: TogetherModelsResponse | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all models from Together.ai API
 * Cached for 5 minutes to avoid excessive API calls
 */
export async function fetchTogetherModels(forceRefresh = false): Promise<TogetherModelsResponse> {
	const now = Date.now();

	// Return cached if fresh
	if (!forceRefresh && cachedModels && now - cacheTimestamp < CACHE_TTL) {
		return cachedModels;
	}

	const apiKey = await getAPIKey("together");
	if (!apiKey) {
		throw new Error("Together.ai API key required to fetch models");
	}

	const response = await fetch("https://api.together.xyz/v1/models", {
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch models: ${response.statusText}`);
	}

	const data: TogetherModelsResponse = await response.json();

	// Cache the result
	cachedModels = data;
	cacheTimestamp = now;

	return data;
}

/**
 * Get all chat models
 */
export async function getChatModelsFromAPI(): Promise<TogetherModel[]> {
	const response = await fetchTogetherModels();
	return response.data.filter((m) => m.type === "chat");
}

/**
 * Get all image models
 */
export async function getImageModelsFromAPI(): Promise<TogetherModel[]> {
	const response = await fetchTogetherModels();
	return response.data.filter((m) => m.type === "image");
}

/**
 * Get all video models
 */
export async function getVideoModelsFromAPI(): Promise<TogetherModel[]> {
	const response = await fetchTogetherModels();
	return response.data.filter((m) => m.type === "video");
}

/**
 * Get free models (pricing.input === 0 or pricing.base === 0)
 */
export async function getFreeModels(type: "chat" | "image" | "video"): Promise<TogetherModel[]> {
	const response = await fetchTogetherModels();
	return response.data.filter(
		(m) =>
			m.type === type &&
			(m.pricing?.input === 0 || m.pricing?.output === 0 || m.pricing?.base === 0 || m.pricing?.image === 0),
	);
}

/**
 * Find a specific model by ID
 */
export async function findModel(modelId: string): Promise<TogetherModel | null> {
	const response = await fetchTogetherModels();
	return response.data.find((m) => m.id === modelId) || null;
}

/**
 * Check if a model supports standardized function calling
 *
 * Philosophy: Even models without standardized tools can use XML-based tool prompts.
 * We detect tool support to optimize the system prompt, not to exclude models.
 *
 * Heuristic:
 * - Context length >= 8000 (most modern models)
 * - NOT a thinking/reasoning model (they use CoT, not tools)
 * - NOT deprecated or experimental
 */
export function supportsTools(model: TogetherModel): boolean {
	if (model.type !== "chat") {
		return false;
	}

	const id = model.id.toLowerCase();
	const name = (model.display_name || "").toLowerCase();

	// Exclude deprecated models
	if (id.includes("deprecated") || name.includes("deprecated")) {
		return false;
	}

	// Exclude serverless-only models (unstable)
	if (id.includes("serverless")) {
		return false;
	}

	// Exclude experimental/test models
	if (id.includes("test") || id.includes("experimental")) {
		return false;
	}

	// Known thinking models (no function calling, use chain-of-thought)
	const thinkingPatterns = ["deepseek-r1", "deepseek-r1-distill", "r1-distill", "thinking", "reasoner"];

	if (thinkingPatterns.some((pattern) => id.includes(pattern) || name.includes(pattern))) {
		return false;
	}

	// Most modern models with context >= 8000 support standardized tools
	return (model.context_length || 0) >= 8000;
}

/**
 * Check if a model is usable (not deprecated, not serverless-only)
 */
export function isUsableModel(model: TogetherModel): boolean {
	const id = model.id.toLowerCase();
	const name = (model.display_name || "").toLowerCase();

	// Block deprecated
	if (id.includes("deprecated") || name.includes("deprecated")) {
		return false;
	}

	// Block serverless-only
	if (id.includes("serverless")) {
		return false;
	}

	// Block test/experimental
	if (id.includes("test") || id.includes("experimental")) {
		return false;
	}

	return true;
}

/**
 * Get display name with fallback
 */
export function getDisplayName(model: TogetherModel): string {
	if (model.display_name) {
		return model.display_name;
	}

	// Fallback: extract from ID
	const parts = model.id.split("/");
	const name = parts[parts.length - 1];
	return name.replace(/-/g, " ").replace(/_/g, " ");
}

/**
 * Format pricing for display
 */
export function formatPricing(model: TogetherModel): string {
	if (!model.pricing) {
		return "Unknown";
	}

	if (model.pricing.input === 0 && model.pricing.output === 0) {
		return "FREE";
	}

	if (model.type === "image" && model.pricing.image !== undefined) {
		return model.pricing.image === 0 ? "FREE" : `$${model.pricing.image}/image`;
	}

	if (model.pricing.input !== undefined && model.pricing.output !== undefined) {
		return `$${model.pricing.input}/M in, $${model.pricing.output}/M out`;
	}

	if (model.pricing.base !== undefined) {
		return `$${model.pricing.base}/M tokens`;
	}

	return "Paid";
}

/**
 * Check if a model is FREE
 */
export function isFree(model: TogetherModel): boolean {
	if (!model.pricing) {
		return false;
	}
	return (model.pricing.input === 0 && model.pricing.output === 0) || model.pricing.base === 0;
}

/**
 * Build chat model metadata from API response
 * This is the SOURCE OF TRUTH - no hardcoded metadata needed!
 */
export interface ChatModelMetadata {
	displayName: string;
	description: string;
	supportsTools: boolean;
	contextLength: number | null;
	free: boolean;
	thinking: boolean;
}

export function buildChatModelMetadata(model: TogetherModel): ChatModelMetadata {
	const hasTools = supportsTools(model);
	const isThinking = !hasTools && (model.context_length || 0) >= 4000; // Thinking models don't have tools

	return {
		displayName: getDisplayName(model),
		description: `${model.architecture?.modality || "Text"} model - ${formatPricing(model)}`,
		supportsTools: hasTools,
		contextLength: model.context_length || null,
		free: isFree(model),
		thinking: isThinking,
	};
}

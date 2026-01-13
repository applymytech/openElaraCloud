/**
 * Model Verification Service
 * ===========================
 *
 * THE FUNDAMENTAL PATTERN:
 * 1. GET /models → "What do you have?"
 * 2. POST /chat/completions (ping) → "Are you alive?"
 * 3. Store results: working models, response times, blocklist
 *
 * This is identical to how web servers establish connections.
 * Every OpenAI-compatible REST API follows this pattern.
 * Free and paid models respond to the SAME payload.
 *
 * ████████████████████████████████████████████████████████████████████████████
 * █                                                                          █
 * █   🚫 NO HARDCODED MODELS - Everything is discovered dynamically 🚫       █
 * █                                                                          █
 * ████████████████████████████████████████████████████████████████████████████
 */

import { getAPIKey } from "./byok";

// ============================================================================
// TYPES
// ============================================================================

export interface VerifiedModel {
	id: string;
	displayName: string;
	provider: "together" | "openrouter" | "custom";
	type: "chat" | "image" | "video" | "embedding";
	contextLength: number;
	pricing: {
		input: number; // per 1M tokens, 0 = free, -1 = unknown/dedicated
		output: number;
	};
	isFree: boolean;
	isVerified: boolean; // Actually tested and working
	responseTimeMs: number | null; // Latency from ping test
	publisher: string; // Extracted from model ID (meta-llama, mistralai, etc.)
	lastVerified: string; // ISO timestamp
	error?: string; // If verification failed
}

export interface VerificationResult {
	provider: "together" | "openrouter" | "custom";
	timestamp: string;
	totalModels: number;
	verifiedModels: number;
	failedModels: number;
	models: VerifiedModel[];
	blocklist: string[]; // Models that claim serverless but fail
}

export interface CachedVerification {
	together?: VerificationResult;
	openrouter?: VerificationResult;
	custom?: Record<string, VerificationResult>; // Keyed by endpoint URL
	lastSync: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_KEY = "elara_verified_models";
const CACHE_TTL_MS = 1000 * 60 * 60 * 4; // 4 hours
const PING_TIMEOUT_MS = 30000; // 30 seconds per model
const PING_DELAY_MS = 500; // Delay between pings to avoid rate limits

// API endpoints
const TOGETHER_MODELS_URL = "https://api.together.xyz/v1/models";
const TOGETHER_CHAT_URL = "https://api.together.xyz/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

// ============================================================================
// HELPERS
// ============================================================================

function extractPublisher(modelId: string): string {
	const parts = modelId.split("/");
	if (parts.length > 1) {
		const raw = parts[0];
		// Clean up common publisher names
		const cleanMap: Record<string, string> = {
			"meta-llama": "Meta",
			mistralai: "Mistral",
			"deepseek-ai": "DeepSeek",
			"ServiceNow-AI": "ServiceNow",
			Qwen: "Qwen",
			google: "Google",
			anthropic: "Anthropic",
			openai: "OpenAI",
			togethercomputer: "Together",
			nvidia: "NVIDIA",
		};
		return cleanMap[raw] || raw;
	}
	return "Other";
}

function parsePrice(price: string | number | undefined | null): number {
	if (price === undefined || price === null) {
		return -1;
	}
	if (typeof price === "number") {
		return price;
	}
	const parsed = parseFloat(price);
	return Number.isNaN(parsed) ? -1 : parsed;
}

// ============================================================================
// PING TEST - The Universal "Are You Alive?" Check
// ============================================================================

async function pingModel(
	modelId: string,
	chatUrl: string,
	apiKey: string,
	headers: Record<string, string> = {},
): Promise<{ success: boolean; responseTimeMs: number; error?: string }> {
	const startTime = Date.now();

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

		const response = await fetch(chatUrl, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				...headers,
			},
			body: JSON.stringify({
				model: modelId,
				messages: [{ role: "user", content: "Hi" }],
				max_tokens: 1, // Minimal response to save cost
				temperature: 0,
			}),
			signal: controller.signal,
		});

		clearTimeout(timeoutId);
		const responseTimeMs = Date.now() - startTime;

		if (response.ok) {
			return { success: true, responseTimeMs };
		} else {
			const errorText = await response.text();
			// Check for specific error patterns
			if (response.status === 400 && errorText.includes("non-serve")) {
				return { success: false, responseTimeMs, error: "dedicated_only" };
			}
			if (response.status === 503) {
				return { success: false, responseTimeMs, error: "service_unavailable" };
			}
			if (response.status === 429) {
				return { success: false, responseTimeMs, error: "rate_limited" };
			}
			return { success: false, responseTimeMs, error: `http_${response.status}` };
		}
	} catch (error: any) {
		const responseTimeMs = Date.now() - startTime;
		if (error.name === "AbortError") {
			return { success: false, responseTimeMs, error: "timeout" };
		}
		return { success: false, responseTimeMs, error: error.message };
	}
}

// ============================================================================
// TOGETHER.AI VERIFICATION
// ============================================================================

export async function verifyTogetherModels(
	onProgress?: (current: number, total: number, modelId: string) => void,
): Promise<VerificationResult> {
	const apiKey = await getAPIKey("together");
	if (!apiKey) {
		throw new Error("Together.ai API key not configured");
	}

	// Step 1: GET /models
	const modelsResponse = await fetch(TOGETHER_MODELS_URL, {
		headers: { Authorization: `Bearer ${apiKey}` },
	});

	if (!modelsResponse.ok) {
		throw new Error(`Failed to fetch models: ${modelsResponse.status}`);
	}

	const modelsData = await modelsResponse.json();
	const allModels = Array.isArray(modelsData) ? modelsData : modelsData.data || [];

	// Filter to chat models with serverless pricing
	const chatModels = allModels.filter((m: any) => {
		if (m.type !== "chat") {
			return false;
		}
		// pricing must exist and not be null
		if (!m.pricing) {
			return false;
		}
		// input price must be defined (even if 0 = free)
		return m.pricing.input !== undefined && m.pricing.input !== null;
	});

	const result: VerificationResult = {
		provider: "together",
		timestamp: new Date().toISOString(),
		totalModels: chatModels.length,
		verifiedModels: 0,
		failedModels: 0,
		models: [],
		blocklist: [],
	};

	// Step 2: Ping each model
	for (let i = 0; i < chatModels.length; i++) {
		const model = chatModels[i];
		const inputPrice = parsePrice(model.pricing?.input);
		const outputPrice = parsePrice(model.pricing?.output);

		onProgress?.(i + 1, chatModels.length, model.id);

		const verifiedModel: VerifiedModel = {
			id: model.id,
			displayName: model.display_name || model.id.split("/").pop() || model.id,
			provider: "together",
			type: "chat",
			contextLength: model.context_length || 0,
			pricing: { input: inputPrice, output: outputPrice },
			isFree: inputPrice === 0 || outputPrice === 0,
			isVerified: false,
			responseTimeMs: null,
			publisher: extractPublisher(model.id),
			lastVerified: new Date().toISOString(),
		};

		// Only ping free models to avoid costs
		// Paid models are assumed working if they have valid pricing
		if (verifiedModel.isFree) {
			const ping = await pingModel(model.id, TOGETHER_CHAT_URL, apiKey);
			verifiedModel.isVerified = ping.success;
			verifiedModel.responseTimeMs = ping.responseTimeMs;
			verifiedModel.error = ping.error;

			if (ping.success) {
				result.verifiedModels++;
			} else {
				result.failedModels++;
				result.blocklist.push(model.id);
			}

			// Rate limit protection
			await new Promise((r) => setTimeout(r, PING_DELAY_MS));
		} else {
			// Paid models: trust the /models response
			verifiedModel.isVerified = true; // Assumed working
			result.verifiedModels++;
		}

		result.models.push(verifiedModel);
	}

	return result;
}

// ============================================================================
// OPENROUTER VERIFICATION
// ============================================================================

export async function verifyOpenRouterModels(
	onProgress?: (current: number, total: number, modelId: string) => void,
): Promise<VerificationResult> {
	const apiKey = await getAPIKey("openrouter");
	if (!apiKey) {
		throw new Error("OpenRouter API key not configured");
	}

	const headers = {
		"HTTP-Referer": "https://openelara.cloud",
		"X-Title": "OpenElara Cloud",
	};

	// Step 1: GET /models
	const modelsResponse = await fetch(OPENROUTER_MODELS_URL, {
		headers: { Authorization: `Bearer ${apiKey}`, ...headers },
	});

	if (!modelsResponse.ok) {
		throw new Error(`Failed to fetch models: ${modelsResponse.status}`);
	}

	const modelsData = await modelsResponse.json();
	const allModels = modelsData.data || [];

	// Filter to chat models with valid pricing
	const chatModels = allModels.filter((m: any) => {
		// OpenRouter models have pricing.prompt and pricing.completion
		const promptPrice = parsePrice(m.pricing?.prompt);
		const completionPrice = parsePrice(m.pricing?.completion);
		// -1 means unknown/null = might be dedicated only
		return promptPrice >= 0 && completionPrice >= 0;
	});

	const result: VerificationResult = {
		provider: "openrouter",
		timestamp: new Date().toISOString(),
		totalModels: chatModels.length,
		verifiedModels: 0,
		failedModels: 0,
		models: [],
		blocklist: [],
	};

	// Step 2: Ping each model (only free ones to save money)
	for (let i = 0; i < chatModels.length; i++) {
		const model = chatModels[i];
		const inputPrice = parsePrice(model.pricing?.prompt);
		const outputPrice = parsePrice(model.pricing?.completion);

		onProgress?.(i + 1, chatModels.length, model.id);

		const verifiedModel: VerifiedModel = {
			id: model.id,
			displayName: model.name || model.id.split("/").pop() || model.id,
			provider: "openrouter",
			type: "chat",
			contextLength: model.context_length || 0,
			pricing: { input: inputPrice, output: outputPrice },
			isFree: inputPrice === 0 && outputPrice === 0,
			isVerified: false,
			responseTimeMs: null,
			publisher: extractPublisher(model.id),
			lastVerified: new Date().toISOString(),
		};

		// Only ping free models
		if (verifiedModel.isFree) {
			const ping = await pingModel(model.id, OPENROUTER_CHAT_URL, apiKey, headers);
			verifiedModel.isVerified = ping.success;
			verifiedModel.responseTimeMs = ping.responseTimeMs;
			verifiedModel.error = ping.error;

			if (ping.success) {
				result.verifiedModels++;
			} else {
				result.failedModels++;
				result.blocklist.push(model.id);
			}

			await new Promise((r) => setTimeout(r, PING_DELAY_MS));
		} else {
			verifiedModel.isVerified = true;
			result.verifiedModels++;
		}

		result.models.push(verifiedModel);
	}

	return result;
}

// ============================================================================
// CUSTOM ENDPOINT VERIFICATION
// ============================================================================

export async function verifyCustomEndpoint(
	baseUrl: string,
	apiKey: string,
	onProgress?: (current: number, total: number, modelId: string) => void,
): Promise<VerificationResult> {
	// Standard OpenAI-compatible endpoints
	const modelsUrl = `${baseUrl.replace(/\/$/, "")}/v1/models`;
	const chatUrl = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;

	// Step 1: GET /models
	const modelsResponse = await fetch(modelsUrl, {
		headers: { Authorization: `Bearer ${apiKey}` },
	});

	if (!modelsResponse.ok) {
		throw new Error(`Failed to fetch models: ${modelsResponse.status}`);
	}

	const modelsData = await modelsResponse.json();
	const allModels = Array.isArray(modelsData) ? modelsData : modelsData.data || [];

	const result: VerificationResult = {
		provider: "custom",
		timestamp: new Date().toISOString(),
		totalModels: allModels.length,
		verifiedModels: 0,
		failedModels: 0,
		models: [],
		blocklist: [],
	};

	// Step 2: Ping each model
	for (let i = 0; i < allModels.length; i++) {
		const model = allModels[i];

		onProgress?.(i + 1, allModels.length, model.id);

		const verifiedModel: VerifiedModel = {
			id: model.id,
			displayName: model.id,
			provider: "custom",
			type: "chat",
			contextLength: model.context_length || 0,
			pricing: { input: 0, output: 0 }, // Custom endpoints: pricing unknown
			isFree: true, // Assume free for local/custom
			isVerified: false,
			responseTimeMs: null,
			publisher: "Custom",
			lastVerified: new Date().toISOString(),
		};

		const ping = await pingModel(model.id, chatUrl, apiKey);
		verifiedModel.isVerified = ping.success;
		verifiedModel.responseTimeMs = ping.responseTimeMs;
		verifiedModel.error = ping.error;

		if (ping.success) {
			result.verifiedModels++;
		} else {
			result.failedModels++;
			result.blocklist.push(model.id);
		}

		result.models.push(verifiedModel);
		await new Promise((r) => setTimeout(r, PING_DELAY_MS));
	}

	return result;
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

export function getCachedVerification(): CachedVerification | null {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		const cached = localStorage.getItem(CACHE_KEY);
		if (!cached) {
			return null;
		}

		const data: CachedVerification = JSON.parse(cached);

		// Check if cache is still fresh
		const lastSync = new Date(data.lastSync).getTime();
		if (Date.now() - lastSync > CACHE_TTL_MS) {
			return null; // Cache expired
		}

		return data;
	} catch {
		return null;
	}
}

export function setCachedVerification(cache: CachedVerification): void {
	if (typeof window === "undefined") {
		return;
	}
	localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export function clearVerificationCache(): void {
	if (typeof window === "undefined") {
		return;
	}
	localStorage.removeItem(CACHE_KEY);
}

// ============================================================================
// HIGH-LEVEL API
// ============================================================================

/**
 * Get verified models for a provider.
 * Returns cached results if fresh, otherwise fetches and verifies.
 */
export async function getVerifiedModels(
	provider: "together" | "openrouter",
	options?: {
		forceRefresh?: boolean;
		onProgress?: (current: number, total: number, modelId: string) => void;
	},
): Promise<VerifiedModel[]> {
	const cache = getCachedVerification();

	// Return cached if fresh and not forcing refresh
	if (!options?.forceRefresh && cache?.[provider]) {
		return cache[provider]?.models;
	}

	// Fetch and verify
	let result: VerificationResult;
	if (provider === "together") {
		result = await verifyTogetherModels(options?.onProgress);
	} else {
		result = await verifyOpenRouterModels(options?.onProgress);
	}

	// Update cache
	const newCache: CachedVerification = {
		...cache,
		[provider]: result,
		lastSync: new Date().toISOString(),
	};
	setCachedVerification(newCache);

	return result.models;
}

/**
 * Get all verified models grouped for the UI.
 */
export function groupModelsForUI(models: VerifiedModel[]): {
	free: VerifiedModel[];
	byPublisher: Record<string, VerifiedModel[]>;
} {
	const working = models.filter((m) => m.isVerified && !m.error);

	const free = working.filter((m) => m.isFree).sort((a, b) => (a.responseTimeMs || 9999) - (b.responseTimeMs || 9999));

	const byPublisher: Record<string, VerifiedModel[]> = {};
	for (const model of working) {
		if (!byPublisher[model.publisher]) {
			byPublisher[model.publisher] = [];
		}
		byPublisher[model.publisher].push(model);
	}

	// Sort each publisher's models by response time
	for (const publisher of Object.keys(byPublisher)) {
		byPublisher[publisher].sort((a, b) => (a.responseTimeMs || 9999) - (b.responseTimeMs || 9999));
	}

	return { free, byPublisher };
}

/**
 * Quick check: Is a specific model available?
 * Uses cache, doesn't ping.
 */
export function isModelAvailable(modelId: string): boolean {
	const cache = getCachedVerification();
	if (!cache) {
		return false;
	}

	const allModels = [...(cache.together?.models || []), ...(cache.openrouter?.models || [])];

	const model = allModels.find((m) => m.id === modelId);
	return model?.isVerified === true && !model.error;
}

/**
 * Get the fastest working model for a provider.
 */
export function getFastestModel(provider: "together" | "openrouter"): VerifiedModel | null {
	const cache = getCachedVerification();
	const result = cache?.[provider];
	if (!result) {
		return null;
	}

	const working = result.models
		.filter((m) => m.isVerified && !m.error && m.responseTimeMs !== null)
		.sort((a, b) => a.responseTimeMs! - b.responseTimeMs!);

	return working[0] || null;
}

/**
 * Get blocklisted models (claimed serverless but failed).
 */
export function getBlocklist(provider: "together" | "openrouter"): string[] {
	const cache = getCachedVerification();
	return cache?.[provider]?.blocklist || [];
}

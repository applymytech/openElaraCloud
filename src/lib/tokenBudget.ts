/**
 * TokenBudget - Token Budget Calculator
 *
 * Ported from desktop OpenElara: src/utils/TokenBudget.js
 *
 * A pure TypeScript library for calculating token allocations in LLM contexts.
 * No DOM dependencies - works anywhere.
 *
 * Usage:
 *   const budget = new TokenBudget(128000, 512, 4096);
 *   budget.setSlot('knowledge', 2048);
 *   budget.setSlot('history', 2048);
 *   const result = budget.calculate();
 *   // result.userBudget = remaining tokens for user input
 */

export interface TokenBudgetResult {
	valid: boolean;
	userBudget: number;
	totalAllocated: number;
	availableInput: number;
	breakdown: {
		limit: number;
		system: number;
		output: number;
		slots: Record<string, number>;
	};
}

/**
 * Token Management Modes (from desktop app requirements)
 *
 * FULLY_AUTO:
 *   - Unrestricted RAG context (fills available space)
 *   - No hardcoded max_tokens limit
 *   - Model decides response length naturally
 *   - Best for: Power users who want maximum context
 *
 * SEMI_AUTO:
 *   - Only output size slider (user preference)
 *   - Output preference added to system prompt (not hardcoded max_tokens)
 *   - RAG context unrestricted
 *   - Best for: Users who want some control over response length
 *
 * STANDARD:
 *   - Full token manager with all sliders
 *   - Knowledge, history, output all controlled
 *   - Best for: Precise token budget control
 */
export type TokenMode = "fully-auto" | "semi-auto" | "standard";

export interface TokenSettings {
	mode: TokenMode;
	output: number;
	knowledge: number;
	history: number;
	recentTurns: number;
	systemReserve: number;
	outputPercentage: number | null;
	knowledgePercentage: number | null;
	historyPercentage: number | null;
	// Semi-auto specific: desired response size (words, not tokens)
	preferredResponseWords: number | null;
}

export const DEFAULT_TOKEN_SETTINGS: TokenSettings = {
	mode: "fully-auto", // Default to unrestricted mode
	output: 0,
	knowledge: 2048,
	history: 2048,
	recentTurns: 2, // Changed from 5 to 2 to support journal system (user turn + AI reflection)
	systemReserve: 512,
	// Percentage-based scaling (applied when switching models)
	// ARCHITECT RULE: Always reserve 25% for response - trust RAG to filter noise
	outputPercentage: 0.25, // 25% of available context for response
	knowledgePercentage: null, // null = use absolute value
	historyPercentage: null,
	// Semi-auto: user's preferred response length in words
	preferredResponseWords: null, // null = no preference
};

const TOKEN_SETTINGS_KEY = "openelara_token_settings";

/**
 * Load token settings from localStorage with fallback to defaults
 */
export function loadTokenSettings(): TokenSettings {
	if (typeof window === "undefined") {
		return { ...DEFAULT_TOKEN_SETTINGS };
	}

	try {
		const saved = localStorage.getItem(TOKEN_SETTINGS_KEY);
		if (saved) {
			const parsed = JSON.parse(saved);
			// If user manually set output, clear the percentage
			if (parsed.output && parsed.output !== DEFAULT_TOKEN_SETTINGS.output) {
				parsed.outputPercentage = null;
			}
			return { ...DEFAULT_TOKEN_SETTINGS, ...parsed };
		}
	} catch (error) {
		console.error("[TokenBudget] Failed to load settings:", error);
		localStorage.removeItem(TOKEN_SETTINGS_KEY);
	}
	return { ...DEFAULT_TOKEN_SETTINGS };
}

/**
 * Save token settings to localStorage
 */
export function saveTokenSettings(settings: TokenSettings): void {
	if (typeof window === "undefined") {
		return;
	}

	try {
		localStorage.setItem(TOKEN_SETTINGS_KEY, JSON.stringify(settings));
	} catch (error) {
		console.error("[TokenBudget] Failed to save settings:", error);
	}
}

/**
 * TokenBudget Calculator
 *
 * The Core Formula:
 *   availableInput = limit - output - system
 *   userBudget = availableInput - sum(all slots)
 */
export class TokenBudget {
	private limit: number;
	private system: number;
	private output: number;
	private slots: Record<string, number>;

	/**
	 * Create a new TokenBudget calculator
	 * @param modelLimit - Total context window of the model (e.g., 128000)
	 * @param systemReserve - Tokens reserved for system prompt (default: 0)
	 * @param outputReserve - Tokens reserved for model output (default: 0)
	 */
	constructor(modelLimit: number, systemReserve = 0, outputReserve = 0) {
		this.limit = Math.max(0, Math.floor(modelLimit) || 0);
		this.system = Math.max(0, Math.floor(systemReserve) || 0);
		this.output = Math.max(0, Math.floor(outputReserve) || 0);
		this.slots = {};
	}

	/**
	 * Define or update a budget slot
	 * Slots represent different types of context: RAG, history, etc.
	 */
	setSlot(name: string, amount: number): TokenBudget {
		this.slots[name] = Math.max(0, Math.floor(amount) || 0);
		return this;
	}

	/**
	 * Get the current allocation for a slot
	 */
	getSlot(name: string): number {
		return this.slots[name] || 0;
	}

	/**
	 * Remove a slot from the budget
	 */
	removeSlot(name: string): TokenBudget {
		delete this.slots[name];
		return this;
	}

	/**
	 * Clear all slots
	 */
	clearSlots(): TokenBudget {
		this.slots = {};
		return this;
	}

	/**
	 * Update the output reserve
	 */
	setOutput(amount: number): TokenBudget {
		this.output = Math.max(0, Math.floor(amount) || 0);
		return this;
	}

	/**
	 * Update the system reserve
	 */
	setSystem(amount: number): TokenBudget {
		this.system = Math.max(0, Math.floor(amount) || 0);
		return this;
	}

	/**
	 * Calculate the token budget breakdown
	 */
	calculate(): TokenBudgetResult {
		// Sum all allocated slots
		const totalAllocated = Object.values(this.slots).reduce((a, b) => a + b, 0);

		// The Core Formula
		// Available Input = Total Model Limit - Output Reserve - System Reserve
		const availableInput = this.limit - this.output - this.system;

		// User Safe Space = Available Input - All Allocated Slots
		const userBudget = availableInput - totalAllocated;

		return {
			valid: userBudget > 0,
			userBudget: Math.max(0, userBudget),
			totalAllocated,
			availableInput: Math.max(0, availableInput),
			breakdown: {
				limit: this.limit,
				system: this.system,
				output: this.output,
				slots: { ...this.slots },
			},
		};
	}

	/**
	 * Create a snapshot of the current state (useful for debugging/logging)
	 */
	toJSON(): TokenBudgetResult & { limit: number; system: number; output: number; slots: Record<string, number> } {
		return {
			limit: this.limit,
			system: this.system,
			output: this.output,
			slots: { ...this.slots },
			...this.calculate(),
		};
	}
}

/**
 * Get context window for a model
 *
 * ⛔ NO HARDCODED METADATA - Use model ID patterns as fallback
 * Real context windows come from the /models API dynamically
 */
export function getModelContextWindow(modelId: string): number {
	// Defaults based on model family patterns
	// These are CONSERVATIVE estimates - real values come from API
	if (modelId.includes("405B")) {
		return 128000;
	}
	if (modelId.includes("70B")) {
		return 128000;
	}
	if (modelId.includes("8B")) {
		return 128000;
	}
	if (modelId.includes("3B")) {
		return 8192;
	}
	if (modelId.includes("gpt-4")) {
		return 128000;
	}
	if (modelId.includes("gpt-3.5")) {
		return 16384;
	}
	if (modelId.includes("claude")) {
		return 200000;
	}
	if (modelId.includes("Qwen")) {
		return 32768;
	}
	if (modelId.includes("deepseek")) {
		return 65536;
	}
	if (modelId.includes("Llama-3")) {
		return 128000;
	}
	if (modelId.includes("Llama-4")) {
		return 128000;
	}

	// Safe default for unknown models
	return 8192;
}

/**
 * Calculate appropriate max_tokens for a model based on context window
 *
 * IMPORTANT: This replaces hardcoded values like "max_tokens: 2048"
 * Instead, we calculate based on model capabilities and current context usage.
 *
 * Behavior by mode:
 * - FULLY_AUTO: Returns null (let model decide)
 * - SEMI_AUTO: Returns null (output preference is in system prompt)
 * - STANDARD: Returns calculated max_tokens based on settings
 */
export function calculateMaxTokens(
	modelId: string,
	inputTokens: number = 0,
	settings?: Partial<TokenSettings>,
): number | null {
	const contextWindow = getModelContextWindow(modelId);
	const tokenSettings = { ...loadTokenSettings(), ...settings };

	// FULLY_AUTO: Don't restrict output - let model decide naturally
	if (tokenSettings.mode === "fully-auto") {
		return null;
	}

	// SEMI_AUTO: Don't use hardcoded max_tokens
	// Output preference should be added to system prompt instead
	if (tokenSettings.mode === "semi-auto") {
		return null;
	}

	// STANDARD: Full token budget calculation
	// Create budget calculator
	const budget = new TokenBudget(
		contextWindow,
		tokenSettings.systemReserve,
		0, // We're calculating output, not reserving it yet
	);

	// Add slots for RAG and history
	budget.setSlot("knowledge", tokenSettings.knowledge);
	budget.setSlot("history", tokenSettings.history);
	budget.setSlot("input", inputTokens);

	const result = budget.calculate();

	// Use percentage-based output if set, otherwise use remaining budget
	let maxTokens: number;
	if (tokenSettings.outputPercentage !== null) {
		maxTokens = Math.floor(contextWindow * tokenSettings.outputPercentage);
	} else if (tokenSettings.output > 0) {
		maxTokens = tokenSettings.output;
	} else {
		// Default: use 25% of context window, but at least 1024 and at most 8192
		maxTokens = Math.min(8192, Math.max(1024, Math.floor(contextWindow * 0.25)));
	}

	// Don't exceed available budget
	maxTokens = Math.min(maxTokens, result.userBudget);

	// Ensure minimum viable output
	return Math.max(256, maxTokens);
}

/**
 * Get output preference instruction for system prompt (SEMI_AUTO mode)
 *
 * This is used when mode is 'semi-auto' to suggest response length
 * without hardcoding max_tokens in the API call.
 */
export function getOutputPreferenceInstruction(settings?: Partial<TokenSettings>): string | null {
	const tokenSettings = { ...loadTokenSettings(), ...settings };

	// Only applies to semi-auto mode
	if (tokenSettings.mode !== "semi-auto") {
		return null;
	}

	// Check if user has a preferred response length
	if (!tokenSettings.preferredResponseWords) {
		return null;
	}

	const words = tokenSettings.preferredResponseWords;

	// Create natural language instruction based on word count
	if (words <= 50) {
		return `\n\n**User Preference:** Keep your response brief - around ${words} words or less. Be concise.`;
	} else if (words <= 150) {
		return `\n\n**User Preference:** Aim for a moderate response length - around ${words} words.`;
	} else if (words <= 300) {
		return `\n\n**User Preference:** Provide a detailed response - around ${words} words.`;
	} else {
		return `\n\n**User Preference:** Provide a comprehensive, thorough response - around ${words} words or more if needed.`;
	}
}

/**
 * Estimate token count for text (rough approximation)
 * For accurate counts, use a proper tokenizer like tiktoken
 */
export function estimateTokens(text: string): number {
	if (!text) {
		return 0;
	}
	// Rough estimate: ~4 characters per token for English text
	return Math.ceil(text.length / 4);
}

export default TokenBudget;

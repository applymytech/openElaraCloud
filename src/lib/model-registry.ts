/**
 * Model Registry Schema - Shared Types
 * =====================================
 * Platform-agnostic model registry definitions.
 * Used by both Desktop (openElara) and Cloud (openElaraCloud).
 *
 * This is the CANONICAL source for model metadata.
 * Copy this file to both apps or extract to @openelara/model-registry package.
 *
 * MINIMAL VIABLE PAYLOAD (MVP) PATTERN:
 * =====================================
 * ALL models work with minimal params - extras are OPTIONAL enhancements.
 *
 * Image MVP: { model, prompt, width, height, response_format }
 * Video MVP: { model, prompt }
 * Audio MVP: { model, input }
 *
 * Optional params (steps, guidance_scale, seed, etc.) are only sent if:
 * 1. The model supports them (check `optionalParameters`)
 * 2. The user explicitly wants to override the model's defaults
 *
 * Models have sensible server-side defaults - we don't NEED to send everything.
 *
 * @author OpenElara Project
 * @license MIT
 * @version 1.0.0
 */

// ============================================================================
// PARAMETER SCHEMA (CRM-style dynamic fields)
// ============================================================================

/**
 * Field type for parameter schema
 */
export type ParameterType =
	| "string" // Single-line text
	| "textarea" // Multi-line text (prompts)
	| "number" // Float numbers
	| "integer" // Whole numbers
	| "boolean" // True/false
	| "select"; // Dropdown selection

/**
 * UI rendering hint for parameter
 */
export type UIHint =
	| "input" // Standard text input
	| "textarea" // Multi-line textarea
	| "slider" // Range slider
	| "select" // Select dropdown (same as dropdown)
	| "dropdown" // Select dropdown
	| "checkbox" // Boolean checkbox
	| "hidden"; // Not shown in UI

/**
 * Constraint definition for a parameter
 */
export interface ParameterConstraints {
	// Number/integer constraints
	min?: number;
	max?: number;
	step?: number;

	// String constraints
	minLength?: number;
	maxLength?: number;
	pattern?: string; // Regex pattern

	// Select constraints (dropdown options)
	options?: Array<{
		value: string | number;
		label: string;
	}>;

	// Multi-select
	multiple?: boolean;
}

/**
 * Conditional visibility rule
 */
export interface DependsOn {
	/** Name of the parameter this depends on */
	parameter: string;
	/** Value that triggers visibility */
	value: unknown;
	/** Comparison operator (default: equals) */
	operator?: "equals" | "notEquals" | "contains" | "greaterThan" | "lessThan";
}

/**
 * CRM-style dynamic field definition
 * Allows UI to render arbitrary parameters without hardcoding
 */
export interface ParameterSchema {
	// ═══════════════════════════════════════════════════════════════════════════
	// IDENTITY
	// ═══════════════════════════════════════════════════════════════════════════

	/** API field name (e.g., "steps", "guidance_scale") */
	name: string;

	/** Human-readable label (e.g., "Inference Steps") */
	displayName: string;

	/** Tooltip/help text */
	description?: string;

	// ═══════════════════════════════════════════════════════════════════════════
	// TYPE & VALIDATION
	// ═══════════════════════════════════════════════════════════════════════════

	/** Data type for validation and coercion */
	type: ParameterType;

	/** Whether this field is required */
	required: boolean;

	/** Type-specific constraints */
	constraints?: ParameterConstraints;

	// ═══════════════════════════════════════════════════════════════════════════
	// DEFAULT VALUE
	// ═══════════════════════════════════════════════════════════════════════════

	/** Default value if not provided */
	defaultValue?: unknown;

	// ═══════════════════════════════════════════════════════════════════════════
	// UI HINTS
	// ═══════════════════════════════════════════════════════════════════════════

	/** How to render this field in UI */
	uiHint?: UIHint;

	/** Group for organizing params (e.g., "basic", "advanced", "output") */
	group?: string;

	/** Display order within group */
	order?: number;

	/** Hide from user interface (system params like 'model', 'n') */
	hidden?: boolean;

	// ═══════════════════════════════════════════════════════════════════════════
	// CONDITIONAL VISIBILITY
	// ═══════════════════════════════════════════════════════════════════════════

	/** Show this field only when another field has a specific value */
	dependsOn?: DependsOn;
}

// ============================================================================
// MODEL REGISTRY ENTRY
// ============================================================================

/**
 * Model type classification
 */
export type ModelType = "image" | "video" | "audio" | "chat" | "embedding";

/**
 * Provider/platform hosting the model
 */
export type ModelProvider =
	| "together" // Together.ai
	| "openrouter" // OpenRouter
	| "openai" // OpenAI
	| "anthropic" // Anthropic
	| "google" // Google AI
	| "replicate" // Replicate
	| "custom"; // User-defined endpoint

/**
 * Verification status of the model
 */
export type ModelStatus =
	| "verified" // Tested and confirmed working
	| "community" // Community-reported working
	| "custom" // User-defined model
	| "deprecated"; // No longer available

/**
 * Endpoint configuration for custom models
 */
export interface EndpointConfig {
	/** Full URL to the API endpoint */
	url: string;

	/** HTTP method */
	method: "POST" | "GET";

	/** Authorization header type */
	authHeader: "Bearer" | "X-API-Key" | "custom";

	/** Custom header name if authHeader='custom' */
	customAuthKey?: string;

	/** Response path to extract image/video data */
	responsePath?: string; // e.g., "data[0].b64_json"
}

/**
 * Pricing information for cost estimation
 */
export interface ModelPricing {
	/** Unit of measurement */
	unit: "per_image" | "per_second" | "per_1k_tokens" | "per_character" | "per_request";

	/** Cost per unit in USD */
	cost: number;

	/** Currency (always USD for now) */
	currency: "USD";

	/** Additional notes about pricing */
	notes?: string;
}

/**
 * Universal model registry entry
 * Works for image, video, audio, chat, embedding models
 */
export interface ModelRegistryEntry {
	// ═══════════════════════════════════════════════════════════════════════════
	// IDENTITY
	// ═══════════════════════════════════════════════════════════════════════════

	/** Unique model identifier (e.g., "black-forest-labs/FLUX.1-schnell") */
	id: string;

	/** Type of model */
	type: ModelType;

	/** Human-readable name (e.g., "FLUX.1 Schnell") */
	displayName: string;

	/** Model description */
	description: string;

	/** Provider hosting this model */
	provider: ModelProvider;

	// ═══════════════════════════════════════════════════════════════════════════
	// STATUS
	// ═══════════════════════════════════════════════════════════════════════════

	/** Verification status */
	status: ModelStatus;

	/** ISO date of last verification */
	verifiedDate?: string;

	/** ISO date when deprecated */
	deprecatedDate?: string;

	/** Reason for deprecation */
	deprecatedReason?: string;

	// ═══════════════════════════════════════════════════════════════════════════
	// ENDPOINT CONFIG (for custom models)
	// ═══════════════════════════════════════════════════════════════════════════

	/** Custom endpoint configuration */
	endpoint?: EndpointConfig;

	// ═══════════════════════════════════════════════════════════════════════════
	// PARAMETER SCHEMA
	// ═══════════════════════════════════════════════════════════════════════════

	/** Array of parameter definitions */
	parameters: ParameterSchema[];

	// ═══════════════════════════════════════════════════════════════════════════
	// PRICING (optional)
	// ═══════════════════════════════════════════════════════════════════════════

	/** Cost information */
	pricing?: ModelPricing;

	// ═══════════════════════════════════════════════════════════════════════════
	// UI HINTS
	// ═══════════════════════════════════════════════════════════════════════════

	/** Whether this model is recommended for most users */
	recommended?: boolean;

	/** Free tier available */
	free?: boolean;

	/** Searchable tags */
	tags?: string[];

	// ═══════════════════════════════════════════════════════════════════════════
	// AGENTIC WORKFLOW HINTS (for prompt optimization)
	// ═══════════════════════════════════════════════════════════════════════════

	/** Prompt character limits (from provider docs) */
	promptLimits?: {
		/** Minimum characters required */
		min: number;
		/** Maximum characters allowed */
		max: number;
		/** Suggested length for best results */
		suggested?: number;
	};

	/** Model style characteristics (helps agentic prompt building) */
	styleHints?: {
		/** Primary style output (e.g., 'photorealistic', 'anime', 'cinematic') */
		defaultStyle?: string;
		/** Does the model follow style instructions well? */
		styleControllability: "high" | "medium" | "low";
		/** Does it support camera/lens instructions? */
		supportsCameraControl?: boolean;
		/** Does it support detailed scene descriptions? */
		supportsDetailedScenes?: boolean;
		/** Warning: model has strong style bias */
		styleBias?: string;
		/** Best use cases */
		bestFor?: string[];
		/** Notes for agentic prompt building */
		agenticNotes?: string;
	};

	/** Supports identity-less generation (Architect persona) */
	supportsAbstract?: boolean;
}

// ============================================================================
// PAYLOAD BUILDER UTILITIES
// ============================================================================

/**
 * Result of payload building
 */
export interface PayloadBuildResult {
	/** The built payload object */
	payload: Record<string, unknown>;

	/** Any validation warnings */
	warnings: string[];

	/** Parameters that were coerced to valid range */
	coercedParams: string[];
}

/**
 * Build API payload from model schema and user values
 * ONLY includes parameters defined in the model's schema
 *
 * @param model - Model registry entry with parameter schema
 * @param values - User-provided values
 * @returns PayloadBuildResult with validated payload
 */
export function buildPayload(model: ModelRegistryEntry, values: Record<string, unknown>): PayloadBuildResult {
	const payload: Record<string, unknown> = {};
	const warnings: string[] = [];
	const coercedParams: string[] = [];

	for (const param of model.parameters) {
		const rawValue = values[param.name] ?? param.defaultValue;

		// Skip undefined optional params
		if (rawValue === undefined) {
			if (param.required) {
				warnings.push(`Required parameter '${param.name}' is missing`);
			}
			continue;
		}

		// Type coercion
		let coercedValue: unknown = rawValue;

		switch (param.type) {
			case "integer":
				coercedValue = parseInt(String(rawValue), 10);
				if (Number.isNaN(coercedValue as number)) {
					warnings.push(`Invalid integer for '${param.name}': ${rawValue}`);
					coercedValue = param.defaultValue ?? 0;
				}
				break;

			case "number":
				coercedValue = parseFloat(String(rawValue));
				if (Number.isNaN(coercedValue as number)) {
					warnings.push(`Invalid number for '${param.name}': ${rawValue}`);
					coercedValue = param.defaultValue ?? 0;
				}
				break;

			case "boolean":
				coercedValue = Boolean(rawValue);
				break;

			case "string":
			case "textarea":
				coercedValue = String(rawValue);
				break;

			case "select":
				// Validate against options if provided
				if (param.constraints?.options) {
					const validValues = param.constraints.options.map((o) => o.value);
					if (!validValues.includes(rawValue as string | number)) {
						warnings.push(`Invalid option for '${param.name}': ${rawValue}`);
						coercedValue = param.defaultValue ?? param.constraints.options[0]?.value;
					}
				}
				break;
		}

		// Apply numeric constraints
		if ((param.type === "number" || param.type === "integer") && param.constraints) {
			const numValue = coercedValue as number;

			if (param.constraints.min !== undefined && numValue < param.constraints.min) {
				coercedValue = param.constraints.min;
				coercedParams.push(param.name);
			}

			if (param.constraints.max !== undefined && numValue > param.constraints.max) {
				coercedValue = param.constraints.max;
				coercedParams.push(param.name);
			}
		}

		// Apply string constraints
		if ((param.type === "string" || param.type === "textarea") && param.constraints) {
			const strValue = coercedValue as string;

			if (param.constraints.maxLength !== undefined && strValue.length > param.constraints.maxLength) {
				coercedValue = strValue.slice(0, param.constraints.maxLength);
				coercedParams.push(param.name);
				warnings.push(`'${param.name}' truncated to ${param.constraints.maxLength} characters`);
			}
		}

		payload[param.name] = coercedValue;
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// POST-PROCESSING: Convert 'size' param to width/height for APIs that need it
	// Google models use 'size' as a convenience, but Together API needs width/height
	// ═══════════════════════════════════════════════════════════════════════════
	if (payload.size && typeof payload.size === "string") {
		const [width, height] = (payload.size as string).split("x").map(Number);
		if (width && height) {
			payload.width = width;
			payload.height = height;
			delete payload.size; // Remove size, use width/height
		}
	}

	return { payload, warnings, coercedParams };
}

/**
 * Get default values from a model's parameter schema
 *
 * @param model - Model registry entry
 * @returns Object with default values for all params
 */
export function getDefaultValues(model: ModelRegistryEntry): Record<string, unknown> {
	const defaults: Record<string, unknown> = {};

	for (const param of model.parameters) {
		if (param.defaultValue !== undefined) {
			defaults[param.name] = param.defaultValue;
		}
	}

	return defaults;
}

/**
 * Get visible parameters (not hidden) sorted by group and order
 *
 * @param model - Model registry entry
 * @returns Sorted array of visible parameters
 */
export function getVisibleParameters(model: ModelRegistryEntry): ParameterSchema[] {
	return model.parameters
		.filter((p) => !p.hidden)
		.sort((a, b) => {
			// Sort by group first
			const groupCompare = (a.group || "").localeCompare(b.group || "");
			if (groupCompare !== 0) {
				return groupCompare;
			}

			// Then by order
			return (a.order ?? 999) - (b.order ?? 999);
		});
}

/**
 * Get parameters grouped by their group property
 *
 * @param model - Model registry entry
 * @returns Map of group name to parameters
 */
export function getParametersByGroup(model: ModelRegistryEntry): Map<string, ParameterSchema[]> {
	const groups = new Map<string, ParameterSchema[]>();

	for (const param of getVisibleParameters(model)) {
		const group = param.group || "default";
		if (!groups.has(group)) {
			groups.set(group, []);
		}
		groups.get(group)?.push(param);
	}

	return groups;
}

/**
 * Check if a parameter should be visible based on dependsOn rules
 *
 * @param param - Parameter schema
 * @param values - Current form values
 * @returns Whether the parameter should be visible
 */
export function isParameterVisible(param: ParameterSchema, values: Record<string, unknown>): boolean {
	if (param.hidden) {
		return false;
	}
	if (!param.dependsOn) {
		return true;
	}

	const dependentValue = values[param.dependsOn.parameter];
	const targetValue = param.dependsOn.value;
	const operator = param.dependsOn.operator || "equals";

	switch (operator) {
		case "equals":
			return dependentValue === targetValue;
		case "notEquals":
			return dependentValue !== targetValue;
		case "contains":
			return String(dependentValue).includes(String(targetValue));
		case "greaterThan":
			return Number(dependentValue) > Number(targetValue);
		case "lessThan":
			return Number(dependentValue) < Number(targetValue);
		default:
			return true;
	}
}

// ============================================================================
// JSON SCHEMA INFERENCE (for custom model wizard)
// ============================================================================

/**
 * Infer parameter schema from a sample JSON payload
 * Used in the "Add Custom Model" wizard when user pastes a sample API request
 *
 * @param json - Sample JSON payload
 * @returns Array of inferred parameter schemas
 */
export function inferSchemaFromJSON(json: Record<string, unknown>): ParameterSchema[] {
	const parameters: ParameterSchema[] = [];

	for (const [key, value] of Object.entries(json)) {
		const param: ParameterSchema = {
			name: key,
			displayName: formatDisplayName(key),
			type: inferType(value),
			required: isLikelyRequired(key),
			defaultValue: value,
			uiHint: inferUIHint(key, value),
			group: inferGroup(key),
			order: inferOrder(key),
			hidden: isSystemParam(key),
		};

		// Infer constraints based on value
		if (typeof value === "number") {
			param.constraints = inferNumericConstraints(key, value);
		} else if (typeof value === "string" && isLikelyPrompt(key)) {
			param.constraints = { maxLength: 4096 };
		}

		parameters.push(param);
	}

	return parameters;
}

// ============================================================================
// HELPER FUNCTIONS FOR SCHEMA INFERENCE
// ============================================================================

function formatDisplayName(key: string): string {
	return key
		.replace(/_/g, " ")
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (str) => str.toUpperCase())
		.trim();
}

function inferType(value: unknown): ParameterType {
	if (typeof value === "boolean") {
		return "boolean";
	}
	if (typeof value === "number") {
		return Number.isInteger(value) ? "integer" : "number";
	}
	if (typeof value === "string" && value.length > 100) {
		return "textarea";
	}
	return "string";
}

function isLikelyRequired(key: string): boolean {
	const requiredKeys = ["prompt", "model", "text", "input"];
	return requiredKeys.includes(key.toLowerCase());
}

function inferUIHint(key: string, value: unknown): UIHint {
	const keyLower = key.toLowerCase();

	if (keyLower.includes("prompt") || keyLower.includes("text")) {
		return "textarea";
	}
	if (typeof value === "boolean") {
		return "checkbox";
	}
	if (typeof value === "number") {
		// Likely sliders for common params
		if (["steps", "guidance", "cfg", "scale", "width", "height", "seed"].some((k) => keyLower.includes(k))) {
			return "slider";
		}
	}
	return "input";
}

function inferGroup(key: string): string {
	const keyLower = key.toLowerCase();

	// Basic params
	if (["prompt", "model", "width", "height", "size"].some((k) => keyLower.includes(k))) {
		return "basic";
	}

	// Output params
	if (["format", "response", "output", "n"].some((k) => keyLower.includes(k))) {
		return "output";
	}

	// Advanced params
	return "advanced";
}

function inferOrder(key: string): number {
	const orderMap: Record<string, number> = {
		prompt: 1,
		model: 2,
		width: 3,
		height: 4,
		steps: 5,
		guidance: 6,
		cfg: 6,
		scale: 7,
		seed: 8,
		negative: 9,
	};

	const keyLower = key.toLowerCase();
	for (const [pattern, order] of Object.entries(orderMap)) {
		if (keyLower.includes(pattern)) {
			return order;
		}
	}
	return 99;
}

function isSystemParam(key: string): boolean {
	const systemParams = ["model", "n", "response_format", "output_format"];
	return systemParams.includes(key.toLowerCase());
}

function isLikelyPrompt(key: string): boolean {
	const promptKeys = ["prompt", "text", "input", "description"];
	return promptKeys.some((k) => key.toLowerCase().includes(k));
}

function inferNumericConstraints(key: string, value: number): ParameterConstraints {
	const keyLower = key.toLowerCase();

	// Common constraint patterns
	if (keyLower.includes("steps")) {
		return { min: 1, max: 100, step: 1 };
	}
	if (keyLower.includes("guidance") || keyLower.includes("cfg") || keyLower.includes("scale")) {
		return { min: 0, max: 30, step: 0.1 };
	}
	if (keyLower.includes("width") || keyLower.includes("height")) {
		return { min: 256, max: 4096, step: 64 };
	}
	if (keyLower.includes("seed")) {
		return { min: 0, max: 2147483647, step: 1 };
	}

	// Default: reasonable range around the sample value
	return {
		min: 0,
		max: Math.max(value * 4, 100),
		step: Number.isInteger(value) ? 1 : 0.1,
	};
}

// ============================================================================
// AGENTIC PROMPT BUILDING UTILITIES
// ============================================================================

/**
 * Prompt budget breakdown for agentic workflows
 */
export interface PromptBudget {
	/** Total characters available */
	total: number;
	/** Characters reserved for persona description */
	personaBudget: number;
	/** Characters remaining for scene/action description */
	sceneBudget: number;
	/** Suggested prompt length for best results */
	suggested: number;
	/** Model has limited prompt space */
	isConstrained: boolean;
}

/**
 * Calculate prompt budget for agentic self-image/video generation
 *
 * Handles models with different character limits:
 * - High-capacity (3000+ chars): Full persona + detailed scene
 * - Medium (1500-3000): Persona + moderate scene
 * - Constrained (<1500): Must compress persona, minimal scene
 *
 * @param model - Model registry entry
 * @param personaLength - Length of persona description (e.g., Elara's appearance)
 * @returns PromptBudget breakdown
 */
export function calculatePromptBudget(model: ModelRegistryEntry, personaLength: number): PromptBudget {
	const limits = model.promptLimits;

	// Default limits if not specified
	const total = limits?.max ?? 2000;
	const suggested = limits?.suggested ?? Math.floor(total * 0.7);

	// Reserve space for persona (character description)
	const personaBudget = Math.min(personaLength, Math.floor(total * 0.4));

	// Remaining budget for scene description
	const sceneBudget = total - personaBudget - 50; // 50 char buffer for separators

	return {
		total,
		personaBudget,
		sceneBudget,
		suggested,
		isConstrained: total < 1500,
	};
}

/**
 * Result of prompt optimization
 */
export interface OptimizedPrompt {
	/** Final prompt string */
	prompt: string;
	/** Original length before optimization */
	originalLength: number;
	/** Final length after optimization */
	finalLength: number;
	/** Whether prompt was truncated */
	wasTruncated: boolean;
	/** Warnings about optimizations made */
	warnings: string[];
}

/**
 * Optimize a prompt for a specific model's constraints
 *
 * Strategies based on model capabilities:
 * - High controllability: Preserve camera/lens instructions
 * - Style bias: Don't fight the model's natural style
 * - Constrained limits: Aggressive summarization
 *
 * @param model - Model registry entry
 * @param personaPrompt - Character/identity description (e.g., Elara's appearance)
 * @param scenePrompt - Scene/action description
 * @returns OptimizedPrompt result
 */
export function optimizePromptForModel(
	model: ModelRegistryEntry,
	personaPrompt: string,
	scenePrompt: string,
): OptimizedPrompt {
	const limits = model.promptLimits;
	const hints = model.styleHints;
	const warnings: string[] = [];

	const maxLength = limits?.max ?? 2000;
	const separator = ". ";

	let persona = personaPrompt.trim();
	let scene = scenePrompt.trim();

	// Calculate initial length
	const originalLength = persona.length + separator.length + scene.length;

	// If within limits, no optimization needed
	if (originalLength <= maxLength) {
		return {
			prompt: persona + separator + scene,
			originalLength,
			finalLength: originalLength,
			wasTruncated: false,
			warnings,
		};
	}

	// OPTIMIZATION STRATEGY 1: Respect style bias
	// If model has strong style bias, don't include conflicting style instructions
	if (hints?.styleBias) {
		const biasPatterns = ["realistic", "anime", "cartoon", "photorealistic"];
		for (const pattern of biasPatterns) {
			if (scene.toLowerCase().includes(pattern) && hints.styleBias !== pattern) {
				warnings.push(`Model has ${hints.styleBias} bias - removed conflicting style instruction`);
				scene = scene.replace(new RegExp(pattern, "gi"), "").trim();
			}
		}
	}

	// OPTIMIZATION STRATEGY 2: Budget allocation
	// 60% persona, 40% scene for character-focused models
	// 40% persona, 60% scene for scene-focused models
	const personaRatio = hints?.supportsCameraControl ? 0.4 : 0.6;
	const personaBudget = Math.floor(maxLength * personaRatio);
	const sceneBudget = maxLength - personaBudget - separator.length;

	// Truncate if needed
	if (persona.length > personaBudget) {
		persona = truncateIntelligently(persona, personaBudget);
		warnings.push(`Persona truncated from ${personaPrompt.length} to ${persona.length} chars`);
	}

	if (scene.length > sceneBudget) {
		scene = truncateIntelligently(scene, sceneBudget);
		warnings.push(`Scene truncated from ${scenePrompt.length} to ${scene.length} chars`);
	}

	const finalPrompt = persona + separator + scene;

	return {
		prompt: finalPrompt,
		originalLength,
		finalLength: finalPrompt.length,
		wasTruncated: true,
		warnings,
	};
}

/**
 * Truncate text intelligently at sentence or word boundaries
 */
function truncateIntelligently(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}

	// Try to truncate at sentence boundary
	const truncated = text.slice(0, maxLength);
	const lastPeriod = truncated.lastIndexOf(".");
	const lastComma = truncated.lastIndexOf(",");
	const lastSpace = truncated.lastIndexOf(" ");

	// Prefer sentence boundary, then comma, then word
	if (lastPeriod > maxLength * 0.7) {
		return truncated.slice(0, lastPeriod + 1);
	}
	if (lastComma > maxLength * 0.7) {
		return truncated.slice(0, lastComma);
	}
	if (lastSpace > maxLength * 0.8) {
		return truncated.slice(0, lastSpace);
	}

	// Hard truncate as last resort
	return `${truncated.slice(0, maxLength - 3)}...`;
}

/**
 * Check if a model is suitable for a persona type
 *
 * @param model - Model registry entry
 * @param isAbstract - Whether the persona is abstract/identity-less (Architect)
 * @param personaLength - Approximate length of persona description
 * @returns Suitability assessment
 */
export function checkModelSuitability(
	model: ModelRegistryEntry,
	isAbstract: boolean,
	personaLength: number,
): { suitable: boolean; reason: string } {
	const limits = model.promptLimits;
	const hints = model.styleHints;

	// Abstract/Architect persona check
	if (isAbstract && !model.supportsAbstract) {
		return {
			suitable: false,
			reason: `${model.displayName} may not handle abstract/geometric content well`,
		};
	}

	// Prompt length check
	if (limits && personaLength > limits.max * 0.6) {
		return {
			suitable: false,
			reason: `Persona too long (${personaLength} chars) for model limit (${limits.max} chars)`,
		};
	}

	// Style controllability check for detailed personas
	if (hints?.styleControllability === "low" && personaLength > 300) {
		return {
			suitable: false,
			reason: `Model has low style controllability - detailed persona may not render accurately`,
		};
	}

	return {
		suitable: true,
		reason: "Model is suitable for this persona",
	};
}

/**
 * Verified Image Models - Model Registry Format
 * ==============================================
 *
 * MINIMAL VIABLE PAYLOAD (MVP) PATTERN:
 * All models work with: { model, prompt, width, height, response_format }
 * Optional params are enhancements IF the model supports them.
 *
 * These models have been tested via actual API calls (~800 tests).
 * Source: backend/image_model_test_results_20251125_134155.json
 * Last verified: November 25, 2025
 *
 * @author OpenElara Project
 */

import type { ModelRegistryEntry, ParameterSchema } from "./model-registry";

// ============================================================================
// MVP PARAMETERS (Required for ALL image models)
// ============================================================================

const PROMPT_PARAM: ParameterSchema = {
	name: "prompt",
	displayName: "Prompt",
	description: "Describe the image you want to generate",
	type: "textarea",
	required: true,
	constraints: { maxLength: 4096 },
	uiHint: "textarea",
	group: "basic",
	order: 1,
};

const MODEL_PARAM = (modelId: string): ParameterSchema => ({
	name: "model",
	displayName: "Model",
	type: "string",
	required: true,
	defaultValue: modelId,
	hidden: true,
});

const WIDTH_PARAM = (defaultVal: number): ParameterSchema => ({
	name: "width",
	displayName: "Width",
	type: "integer",
	required: false,
	defaultValue: defaultVal,
	constraints: { min: 256, max: 2048, step: 64 },
	uiHint: "slider",
	group: "basic",
	order: 2,
});

const HEIGHT_PARAM = (defaultVal: number): ParameterSchema => ({
	name: "height",
	displayName: "Height",
	type: "integer",
	required: false,
	defaultValue: defaultVal,
	constraints: { min: 256, max: 2048, step: 64 },
	uiHint: "slider",
	group: "basic",
	order: 3,
});

const N_PARAM: ParameterSchema = {
	name: "n",
	displayName: "Number of Images",
	type: "integer",
	required: false,
	defaultValue: 1,
	hidden: true,
};

const RESPONSE_FORMAT_PARAM: ParameterSchema = {
	name: "response_format",
	displayName: "Response Format",
	type: "string",
	required: false,
	defaultValue: "b64_json",
	hidden: true,
};

// ============================================================================
// OPTIONAL ENHANCEMENT PARAMETERS (Only if model supports + user wants override)
// ============================================================================

/**
 * Steps parameter - only include in payload if user explicitly sets it
 * Model has sensible defaults server-side
 */
const STEPS_PARAM = (min: number, max: number, modelDefault: number): ParameterSchema => ({
	name: "steps",
	displayName: "Inference Steps",
	description: `More steps = higher quality, slower. Model default: ${modelDefault}`,
	type: "integer",
	required: false,
	defaultValue: undefined, // Don't send unless user overrides
	constraints: { min, max, step: 1 },
	uiHint: "slider",
	group: "advanced",
	order: 1,
});

/**
 * Guidance scale - only include if user explicitly sets it
 */
const GUIDANCE_PARAM = (min: number, max: number, modelDefault: number): ParameterSchema => ({
	name: "guidance_scale",
	displayName: "Guidance Scale",
	description: `How closely to follow prompt. Model default: ${modelDefault}`,
	type: "number",
	required: false,
	defaultValue: undefined, // Don't send unless user overrides
	constraints: { min, max, step: 0.1 },
	uiHint: "slider",
	group: "advanced",
	order: 2,
});

const SEED_PARAM: ParameterSchema = {
	name: "seed",
	displayName: "Seed",
	description: "For reproducible results (leave empty for random)",
	type: "integer",
	required: false,
	defaultValue: undefined, // Don't send unless user sets it
	constraints: { min: 0, max: 2147483647 },
	uiHint: "input",
	group: "advanced",
	order: 3,
};

const NEGATIVE_PROMPT_PARAM: ParameterSchema = {
	name: "negative_prompt",
	displayName: "Negative Prompt",
	description: "What to avoid in the image",
	type: "textarea",
	required: false,
	defaultValue: undefined, // Don't send unless user sets it
	constraints: { maxLength: 1024 },
	uiHint: "textarea",
	group: "advanced",
	order: 4,
};

// ============================================================================
// MVP PARAMS ARRAY (used by all image models)
// ============================================================================

const MVP_IMAGE_PARAMS = (modelId: string, width = 1024, height = 1024): ParameterSchema[] => [
	PROMPT_PARAM,
	MODEL_PARAM(modelId),
	WIDTH_PARAM(width),
	HEIGHT_PARAM(height),
	N_PARAM,
	RESPONSE_FORMAT_PARAM,
];

// ============================================================================
// FLUX MODELS (Black Forest Labs)
// Support: steps, guidance_scale, seed, negative_prompt
// ============================================================================

export const FLUX_SCHNELL: ModelRegistryEntry = {
	id: "black-forest-labs/FLUX.1-schnell",
	type: "image",
	displayName: "FLUX.1 Schnell",
	description: "Fast, high-quality image generation. Supports LoRA.",
	provider: "together",
	status: "verified",
	verifiedDate: "2025-11-25",

	parameters: [
		...MVP_IMAGE_PARAMS("black-forest-labs/FLUX.1-schnell"),
		// Optional enhancements (model defaults: steps=4, guidance=3.5)
		STEPS_PARAM(1, 12, 4),
		GUIDANCE_PARAM(0.5, 30, 3.5),
		SEED_PARAM,
		NEGATIVE_PROMPT_PARAM,
	],

	pricing: { unit: "per_image", cost: 0.003, currency: "USD" },
	recommended: true,
	tags: ["fast", "lora-support", "high-quality"],
};

export const FLUX_DEV: ModelRegistryEntry = {
	id: "black-forest-labs/FLUX.1-dev",
	type: "image",
	displayName: "FLUX.1 Dev",
	description: "Development model with full LoRA support.",
	provider: "together",
	status: "verified",
	verifiedDate: "2025-11-25",

	parameters: [
		...MVP_IMAGE_PARAMS("black-forest-labs/FLUX.1-dev"),
		// Optional enhancements (model defaults: steps=25, guidance=7.5)
		STEPS_PARAM(1, 50, 25),
		GUIDANCE_PARAM(0.5, 30, 7.5),
		SEED_PARAM,
		NEGATIVE_PROMPT_PARAM,
	],

	pricing: { unit: "per_image", cost: 0.025, currency: "USD" },
	recommended: true,
	tags: ["lora-support", "high-quality", "development"],
};

export const FLUX_PRO: ModelRegistryEntry = {
	id: "black-forest-labs/FLUX.1.1-pro",
	type: "image",
	displayName: "FLUX.1.1 Pro",
	description: "Professional quality image generation.",
	provider: "together",
	status: "verified",
	verifiedDate: "2025-11-25",

	parameters: [
		...MVP_IMAGE_PARAMS("black-forest-labs/FLUX.1.1-pro"),
		STEPS_PARAM(1, 50, 25),
		GUIDANCE_PARAM(0.5, 30, 7.5),
		SEED_PARAM,
		NEGATIVE_PROMPT_PARAM,
	],

	pricing: { unit: "per_image", cost: 0.05, currency: "USD" },
	recommended: true,
	tags: ["professional", "high-quality"],
};

export const FLUX_KONTEXT_PRO: ModelRegistryEntry = {
	id: "black-forest-labs/FLUX.1-kontext-pro",
	type: "image",
	displayName: "FLUX.1 Kontext Pro",
	description: "Context-aware image generation.",
	provider: "together",
	status: "verified",
	verifiedDate: "2025-11-25",

	parameters: [
		...MVP_IMAGE_PARAMS("black-forest-labs/FLUX.1-kontext-pro"),
		STEPS_PARAM(1, 50, 25),
		GUIDANCE_PARAM(0.5, 30, 7.5),
		SEED_PARAM,
		NEGATIVE_PROMPT_PARAM,
	],

	pricing: { unit: "per_image", cost: 0.04, currency: "USD" },
	tags: ["context-aware", "high-resolution"],
};

export const FLUX_KONTEXT_MAX: ModelRegistryEntry = {
	id: "black-forest-labs/FLUX.1-kontext-max",
	type: "image",
	displayName: "FLUX.1 Kontext Max",
	description: "Maximum context awareness.",
	provider: "together",
	status: "verified",
	verifiedDate: "2025-11-25",

	parameters: [
		...MVP_IMAGE_PARAMS("black-forest-labs/FLUX.1-kontext-max"),
		STEPS_PARAM(2, 50, 26),
		GUIDANCE_PARAM(0.5, 30, 7.5),
		SEED_PARAM,
		NEGATIVE_PROMPT_PARAM,
	],

	pricing: { unit: "per_image", cost: 0.08, currency: "USD" },
	tags: ["context-aware", "maximum-quality"],
};

export const FLUX_KREA_DEV: ModelRegistryEntry = {
	id: "black-forest-labs/FLUX.1-krea-dev",
	type: "image",
	displayName: "FLUX.1 Krea Dev",
	description: "Creative development model.",
	provider: "together",
	status: "verified",
	verifiedDate: "2025-11-25",

	parameters: [
		...MVP_IMAGE_PARAMS("black-forest-labs/FLUX.1-krea-dev"),
		STEPS_PARAM(1, 40, 20),
		GUIDANCE_PARAM(0.5, 30, 7.5),
		SEED_PARAM,
		NEGATIVE_PROMPT_PARAM,
	],

	pricing: { unit: "per_image", cost: 0.025, currency: "USD" },
	tags: ["creative", "development"],
};

// ============================================================================
// GOOGLE IMAGEN MODELS
// MVP ONLY - No optional params (steps/guidance don't exist for this API)
// IMPORTANT: Google models have STRICT size requirements - only specific combinations work!
// ============================================================================

// Google-specific size parameter with select options (not free-form slider)
const GOOGLE_IMAGEN_SIZE_PARAM = (supportedSizes: string[], defaultSize = "1024x1024"): ParameterSchema => ({
	name: "size",
	displayName: "Image Size",
	description: "Select from supported sizes (width x height)",
	type: "select",
	required: false,
	defaultValue: defaultSize,
	constraints: {
		options: supportedSizes.map((s) => ({ label: s, value: s })),
	},
	uiHint: "select",
	group: "basic",
	order: 2,
});

// Google models don't use width/height directly - they use size presets
const MVP_GOOGLE_IMAGE_PARAMS = (modelId: string, supportedSizes: string[]): ParameterSchema[] => [
	PROMPT_PARAM,
	MODEL_PARAM(modelId),
	GOOGLE_IMAGEN_SIZE_PARAM(supportedSizes),
	RESPONSE_FORMAT_PARAM,
	// NOTE: No N_PARAM for most Google models!
];

// Imagen 4.0 Preview/Ultra sizes
const IMAGEN_4_FULL_SIZES = [
	"1024x1024",
	"2048x2048", // Square
	"768x1408",
	"1536x2816", // Portrait
	"1408x768",
	"2816x1536", // Landscape
	"896x1280",
	"1792x2560", // Portrait alt
	"1280x896",
	"2560x1792", // Landscape alt
];

// Imagen 4.0 Fast - fewer options
const IMAGEN_4_FAST_SIZES = [
	"1024x1024", // Square
	"768x1408",
	"1408x768", // Portrait/Landscape
	"896x1280",
	"1280x896", // Alt portrait/landscape
];

// Flash Image 2.5 - different size options
const FLASH_IMAGE_SIZES = [
	"1024x1024", // Square
	"1248x832",
	"832x1248", // ~3:2 ratio
	"1184x864",
	"864x1184", // ~4:3 ratio
	"896x1152",
	"1152x896", // ~3:4 ratio
	"768x1344",
	"1344x768", // ~9:16 ratio
	"1536x672", // Ultra-wide
];

export const GOOGLE_IMAGEN_4_PREVIEW: ModelRegistryEntry = {
	id: "google/imagen-4.0-preview",
	type: "image",
	displayName: "Google Imagen 4.0 Preview",
	description: "Google's latest image model. Strict size requirements.",
	provider: "together",
	status: "verified",
	verifiedDate: "2026-01-09",

	// Google uses 'size' param, not width/height
	parameters: MVP_GOOGLE_IMAGE_PARAMS("google/imagen-4.0-preview", IMAGEN_4_FULL_SIZES),

	pricing: { unit: "per_image", cost: 0.04, currency: "USD" },
	recommended: true,
	tags: ["google", "high-quality"],
};

export const GOOGLE_IMAGEN_4_FAST: ModelRegistryEntry = {
	id: "google/imagen-4.0-fast",
	type: "image",
	displayName: "Google Imagen 4.0 Fast",
	description: "Fast generation from Google. Limited size options.",
	provider: "together",
	status: "verified",
	verifiedDate: "2026-01-09",

	parameters: MVP_GOOGLE_IMAGE_PARAMS("google/imagen-4.0-fast", IMAGEN_4_FAST_SIZES),

	pricing: { unit: "per_image", cost: 0.02, currency: "USD" },
	recommended: true,
	tags: ["google", "fast"],
};

export const GOOGLE_IMAGEN_4_ULTRA: ModelRegistryEntry = {
	id: "google/imagen-4.0-ultra",
	type: "image",
	displayName: "Google Imagen 4.0 Ultra",
	description: "Highest quality from Google. Strict size requirements.",
	provider: "together",
	status: "verified",
	verifiedDate: "2026-01-09",

	parameters: MVP_GOOGLE_IMAGE_PARAMS("google/imagen-4.0-ultra", IMAGEN_4_FULL_SIZES),

	pricing: { unit: "per_image", cost: 0.08, currency: "USD" },
	recommended: true,
	tags: ["google", "ultra-quality"],
};

export const GOOGLE_GEMINI_3_PRO_IMAGE: ModelRegistryEntry = {
	id: "google/gemini-3-pro-image",
	type: "image",
	displayName: "Gemini 3 Pro Image",
	description: "Gemini-powered image generation. No n param support.",
	provider: "together",
	status: "verified",
	verifiedDate: "2026-01-09",

	// Gemini 3 Pro uses standard width/height but DOES NOT support n param
	parameters: [
		PROMPT_PARAM,
		MODEL_PARAM("google/gemini-3-pro-image"),
		WIDTH_PARAM(1024),
		HEIGHT_PARAM(1024),
		// NOTE: No N_PARAM - this model doesn't support it!
		RESPONSE_FORMAT_PARAM,
	],

	pricing: { unit: "per_image", cost: 0.04, currency: "USD" },
	recommended: true,
	tags: ["google", "gemini"],
};

export const GOOGLE_FLASH_IMAGE: ModelRegistryEntry = {
	id: "google/flash-image-2.5",
	type: "image",
	displayName: "Flash Image 2.5",
	description: "Google's flash image model. Strict size requirements.",
	provider: "together",
	status: "verified",
	verifiedDate: "2026-01-09",

	// Flash uses size param like Imagen
	parameters: MVP_GOOGLE_IMAGE_PARAMS("google/flash-image-2.5", FLASH_IMAGE_SIZES),

	pricing: { unit: "per_image", cost: 0.015, currency: "USD" },
	tags: ["google", "fast"],
};

// ============================================================================
// HIDREAM MODELS
// Support: steps, guidance_scale, seed, negative_prompt
// ============================================================================

export const HIDREAM_I1_FULL: ModelRegistryEntry = {
	id: "HiDream-ai/HiDream-I1-Full",
	type: "image",
	displayName: "HiDream I1 Full",
	description: "Full quality HiDream model.",
	provider: "together",
	status: "verified",
	verifiedDate: "2025-11-25",

	parameters: [
		...MVP_IMAGE_PARAMS("HiDream-ai/HiDream-I1-Full"),
		STEPS_PARAM(1, 50, 25),
		GUIDANCE_PARAM(0.5, 30, 7.5),
		SEED_PARAM,
		NEGATIVE_PROMPT_PARAM,
	],

	pricing: { unit: "per_image", cost: 0.03, currency: "USD" },
	tags: ["hidream", "high-quality"],
};

export const HIDREAM_I1_DEV: ModelRegistryEntry = {
	id: "HiDream-ai/HiDream-I1-Dev",
	type: "image",
	displayName: "HiDream I1 Dev",
	description: "HiDream development model.",
	provider: "together",
	status: "verified",
	verifiedDate: "2025-11-25",

	parameters: [
		...MVP_IMAGE_PARAMS("HiDream-ai/HiDream-I1-Dev"),
		STEPS_PARAM(1, 100, 50),
		GUIDANCE_PARAM(0.5, 20, 10.2),
		SEED_PARAM,
		NEGATIVE_PROMPT_PARAM,
	],

	pricing: { unit: "per_image", cost: 0.02, currency: "USD" },
	tags: ["hidream", "development"],
};

export const HIDREAM_I1_FAST: ModelRegistryEntry = {
	id: "HiDream-ai/HiDream-I1-Fast",
	type: "image",
	displayName: "HiDream I1 Fast",
	description: "Fast HiDream model.",
	provider: "together",
	status: "verified",
	verifiedDate: "2025-11-25",

	parameters: [
		...MVP_IMAGE_PARAMS("HiDream-ai/HiDream-I1-Fast"),
		STEPS_PARAM(1, 100, 50),
		GUIDANCE_PARAM(0.5, 30, 7.5),
		SEED_PARAM,
		NEGATIVE_PROMPT_PARAM,
	],

	pricing: { unit: "per_image", cost: 0.015, currency: "USD" },
	tags: ["hidream", "fast"],
};

// ============================================================================
// STABILITY AI MODELS
// Support: steps, guidance_scale, seed, negative_prompt
// ============================================================================

export const SD3_MEDIUM: ModelRegistryEntry = {
	id: "stabilityai/stable-diffusion-3-medium",
	type: "image",
	displayName: "Stable Diffusion 3 Medium",
	description: "SD3 medium quality model.",
	provider: "together",
	status: "verified",
	verifiedDate: "2025-11-25",

	parameters: [
		...MVP_IMAGE_PARAMS("stabilityai/stable-diffusion-3-medium"),
		STEPS_PARAM(1, 100, 50),
		GUIDANCE_PARAM(0.5, 30, 7.5),
		SEED_PARAM,
		NEGATIVE_PROMPT_PARAM,
	],

	pricing: { unit: "per_image", cost: 0.035, currency: "USD" },
	tags: ["stability", "sd3"],
};

export const SDXL_BASE: ModelRegistryEntry = {
	id: "stabilityai/stable-diffusion-xl-base-1.0",
	type: "image",
	displayName: "Stable Diffusion XL 1.0",
	description: "SDXL base model.",
	provider: "together",
	status: "verified",
	verifiedDate: "2025-11-25",

	parameters: [
		...MVP_IMAGE_PARAMS("stabilityai/stable-diffusion-xl-base-1.0"),
		STEPS_PARAM(1, 100, 50),
		GUIDANCE_PARAM(0.5, 30, 7.5),
		SEED_PARAM,
		NEGATIVE_PROMPT_PARAM,
	],

	pricing: { unit: "per_image", cost: 0.02, currency: "USD" },
	recommended: true,
	tags: ["stability", "sdxl", "versatile"],
};

// ============================================================================
// QWEN IMAGE
// ============================================================================

export const QWEN_IMAGE: ModelRegistryEntry = {
	id: "Qwen/Qwen-Image",
	type: "image",
	displayName: "Qwen Image",
	description: "Qwen image generation model.",
	provider: "together",
	status: "verified",
	verifiedDate: "2025-11-25",

	parameters: [
		...MVP_IMAGE_PARAMS("Qwen/Qwen-Image"),
		STEPS_PARAM(1, 75, 38),
		GUIDANCE_PARAM(0.5, 30, 7.5),
		SEED_PARAM,
		NEGATIVE_PROMPT_PARAM,
	],

	pricing: { unit: "per_image", cost: 0.02, currency: "USD" },
	tags: ["qwen"],
};

// ============================================================================
// RUNDIFFUSION / LYKON MODELS
// ============================================================================

export const JUGGERNAUT_PRO_FLUX: ModelRegistryEntry = {
	id: "RunDiffusion/Juggernaut-pro-flux",
	type: "image",
	displayName: "Juggernaut Pro FLUX",
	description: "Pro-level FLUX variant.",
	provider: "together",
	status: "verified",
	verifiedDate: "2025-11-25",

	parameters: [
		...MVP_IMAGE_PARAMS("RunDiffusion/Juggernaut-pro-flux"),
		STEPS_PARAM(1, 100, 50),
		GUIDANCE_PARAM(0.5, 30, 7.5),
		SEED_PARAM,
		NEGATIVE_PROMPT_PARAM,
	],

	pricing: { unit: "per_image", cost: 0.025, currency: "USD" },
	tags: ["rundiffusion", "flux-variant"],
};

export const JUGGERNAUT_LIGHTNING_FLUX: ModelRegistryEntry = {
	id: "Rundiffusion/Juggernaut-Lightning-Flux",
	type: "image",
	displayName: "Juggernaut Lightning FLUX",
	description: "Fast FLUX variant.",
	provider: "together",
	status: "verified",
	verifiedDate: "2025-11-25",

	parameters: [
		...MVP_IMAGE_PARAMS("Rundiffusion/Juggernaut-Lightning-Flux"),
		STEPS_PARAM(1, 100, 50),
		GUIDANCE_PARAM(0.5, 30, 7.5),
		SEED_PARAM,
		NEGATIVE_PROMPT_PARAM,
	],

	pricing: { unit: "per_image", cost: 0.02, currency: "USD" },
	tags: ["rundiffusion", "fast"],
};

export const DREAMSHAPER: ModelRegistryEntry = {
	id: "Lykon/DreamShaper",
	type: "image",
	displayName: "DreamShaper",
	description: "Dream-style image generation.",
	provider: "together",
	status: "verified",
	verifiedDate: "2025-11-25",

	parameters: [
		...MVP_IMAGE_PARAMS("Lykon/DreamShaper"),
		STEPS_PARAM(1, 100, 50),
		GUIDANCE_PARAM(0.5, 30, 7.5),
		SEED_PARAM,
		NEGATIVE_PROMPT_PARAM,
	],

	pricing: { unit: "per_image", cost: 0.015, currency: "USD" },
	tags: ["lykon", "artistic"],
};

// ============================================================================
// REGISTRY EXPORT
// ============================================================================

export const VERIFIED_IMAGE_MODELS: ModelRegistryEntry[] = [
	// FLUX Models (recommended)
	FLUX_SCHNELL,
	FLUX_DEV,
	FLUX_PRO,
	FLUX_KONTEXT_PRO,
	FLUX_KONTEXT_MAX,
	FLUX_KREA_DEV,

	// Google (MVP only - no optional params)
	GOOGLE_IMAGEN_4_PREVIEW,
	GOOGLE_IMAGEN_4_FAST,
	GOOGLE_IMAGEN_4_ULTRA,
	GOOGLE_GEMINI_3_PRO_IMAGE,
	GOOGLE_FLASH_IMAGE,

	// HiDream
	HIDREAM_I1_FULL,
	HIDREAM_I1_DEV,
	HIDREAM_I1_FAST,

	// Stability AI
	SD3_MEDIUM,
	SDXL_BASE,

	// Qwen
	QWEN_IMAGE,

	// RunDiffusion / Lykon
	JUGGERNAUT_PRO_FLUX,
	JUGGERNAUT_LIGHTNING_FLUX,
	DREAMSHAPER,
];

/**
 * Get model by ID
 */
export function getImageModel(modelId: string): ModelRegistryEntry | undefined {
	return VERIFIED_IMAGE_MODELS.find((m) => m.id === modelId);
}

/**
 * Get recommended models
 */
export function getRecommendedImageModels(): ModelRegistryEntry[] {
	return VERIFIED_IMAGE_MODELS.filter((m) => m.recommended);
}

/**
 * Get models by tag
 */
export function getImageModelsByTag(tag: string): ModelRegistryEntry[] {
	return VERIFIED_IMAGE_MODELS.filter((m) => m.tags?.includes(tag));
}

/**
 * Check if a model supports an optional parameter
 */
export function modelSupportsParam(modelId: string, paramName: string): boolean {
	const model = getImageModel(modelId);
	if (!model) {
		return false;
	}
	return model.parameters.some((p) => p.name === paramName);
}

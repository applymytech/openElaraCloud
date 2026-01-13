/**
 * Verified Video Models - Model Registry Format
 * ==============================================
 *
 * MINIMAL VIABLE PAYLOAD (MVP) PATTERN:
 * All video models work with: { model, prompt }
 * Optional params (first_frame_image, resolution, etc.) are enhancements.
 *
 * Source: Together.ai docs + desktop togetherModels.js
 * Last verified: January 9, 2026
 *
 * VERIFIED MODELS (5 total):
 * - Wan-AI/Wan2.2-T2V-A14B    $0.15 - CHEAPEST!
 * - minimax/video-01-director  $0.28
 * - minimax/hailuo-02          $0.28 (6s only!)
 * - pixverse/pixverse-v5       $0.30
 * - google/veo-3.0-fast        $0.80
 *
 * @author OpenElara Project
 */

import type { ModelRegistryEntry, ParameterSchema } from "./model-registry";

// Re-export for convenience
export type { ModelRegistryEntry } from "./model-registry";

// ============================================================================
// MVP PARAMETERS (Required for ALL video models)
// ============================================================================

const PROMPT_PARAM: ParameterSchema = {
	name: "prompt",
	displayName: "Prompt",
	description: "Describe the video you want to generate",
	type: "textarea",
	required: true,
	constraints: { maxLength: 2048 },
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

// ============================================================================
// OPTIONAL VIDEO PARAMETERS
// ============================================================================

const RESOLUTION_PARAM = (options: string[], _defaultVal: string): ParameterSchema => ({
	name: "resolution",
	displayName: "Resolution",
	description: "Video resolution (width x height)",
	type: "select",
	required: false,
	defaultValue: undefined,
	constraints: {
		options: options.map((r) => ({ value: r, label: r })),
	},
	uiHint: "dropdown",
	group: "basic",
	order: 2,
});

const DURATION_PARAM = (maxDuration: number): ParameterSchema => ({
	name: "duration",
	displayName: "Duration (seconds)",
	description: `Max: ${maxDuration}s`,
	type: "integer",
	required: false,
	defaultValue: undefined,
	constraints: { min: 1, max: maxDuration, step: 1 },
	uiHint: "slider",
	group: "basic",
	order: 3,
});

const FIRST_FRAME_IMAGE_PARAM: ParameterSchema = {
	name: "first_frame_image",
	displayName: "First Frame (I2V)",
	description: "URL to image for first frame (Image-to-Video)",
	type: "string",
	required: false,
	defaultValue: undefined,
	uiHint: "input",
	group: "advanced",
	order: 1,
};

const LAST_FRAME_IMAGE_PARAM: ParameterSchema = {
	name: "last_frame_image",
	displayName: "Last Frame",
	description: "URL to image for last frame",
	type: "string",
	required: false,
	defaultValue: undefined,
	uiHint: "input",
	group: "advanced",
	order: 2,
};

const GUIDANCE_PARAM = (min: number, max: number, modelDefault: number): ParameterSchema => ({
	name: "guidance_scale",
	displayName: "Guidance Scale",
	description: `Model default: ${modelDefault}`,
	type: "number",
	required: false,
	defaultValue: undefined,
	constraints: { min, max, step: 0.1 },
	uiHint: "slider",
	group: "advanced",
	order: 3,
});

const NEGATIVE_PROMPT_PARAM: ParameterSchema = {
	name: "negative_prompt",
	displayName: "Negative Prompt",
	description: "What to avoid in the video",
	type: "textarea",
	required: false,
	defaultValue: undefined,
	constraints: { maxLength: 1024 },
	uiHint: "textarea",
	group: "advanced",
	order: 4,
};

const STEPS_PARAM = (min: number, max: number, modelDefault: number): ParameterSchema => ({
	name: "steps",
	displayName: "Inference Steps",
	description: `Model default: ${modelDefault}`,
	type: "integer",
	required: false,
	defaultValue: undefined,
	constraints: { min, max, step: 1 },
	uiHint: "slider",
	group: "advanced",
	order: 5,
});

const SEED_PARAM: ParameterSchema = {
	name: "seed",
	displayName: "Seed",
	description: "For reproducible results",
	type: "integer",
	required: false,
	defaultValue: undefined,
	constraints: { min: 0, max: 2147483647 },
	uiHint: "input",
	group: "advanced",
	order: 6,
};

// ============================================================================
// MVP PARAMS ARRAY (used by all video models)
// ============================================================================

const MVP_VIDEO_PARAMS = (modelId: string): ParameterSchema[] => [PROMPT_PARAM, MODEL_PARAM(modelId)];

// ============================================================================
// 1. WAN 2.2 - CHEAPEST VERIFIED MODEL! ($0.15)
// ============================================================================

export const WAN_2_2_T2V: ModelRegistryEntry = {
	id: "Wan-AI/Wan2.2-T2V-A14B",
	type: "video",
	displayName: "Wan 2.2 T2V 14B",
	description: "5s, text-to-video. ✅ VERIFIED 2026-01-09 ($0.15) - CHEAPEST!",
	provider: "together",
	status: "verified",
	verifiedDate: "2026-01-09",

	parameters: [
		...MVP_VIDEO_PARAMS("Wan-AI/Wan2.2-T2V-A14B"),
		RESOLUTION_PARAM(["1024x576", "576x1024"], "1024x576"),
		DURATION_PARAM(5),
		GUIDANCE_PARAM(1, 10, 7),
		STEPS_PARAM(10, 50, 25),
		SEED_PARAM,
	],

	pricing: { unit: "per_second", cost: 0.03, currency: "USD", notes: "$0.15 for 5s" },
	recommended: true,
	tags: ["wan-ai", "t2v-only", "cost-effective"],

	// Agentic workflow hints
	promptLimits: { min: 2, max: 2000, suggested: 400 },
	styleHints: {
		defaultStyle: "realistic",
		styleControllability: "medium",
		supportsCameraControl: true,
		supportsDetailedScenes: true,
		bestFor: ["character videos", "realistic scenes", "budget productions"],
	},
	supportsAbstract: true,
};

// ============================================================================
// 2. MINIMAX VIDEO-01-DIRECTOR ($0.28)
// ============================================================================

export const MINIMAX_VIDEO_01_DIRECTOR: ModelRegistryEntry = {
	id: "minimax/video-01-director",
	type: "video",
	displayName: "MiniMax 01 Director",
	description: "5s, 1366×768. ✅ VERIFIED 2026-01-09 ($0.28)",
	provider: "together",
	status: "verified",
	verifiedDate: "2026-01-09",

	parameters: [
		...MVP_VIDEO_PARAMS("minimax/video-01-director"),
		RESOLUTION_PARAM(["1366x768"], "1366x768"),
		DURATION_PARAM(5),
		FIRST_FRAME_IMAGE_PARAM,
		GUIDANCE_PARAM(1, 10, 7),
		SEED_PARAM,
	],

	pricing: { unit: "per_second", cost: 0.056, currency: "USD", notes: "$0.28 for 5s" },
	recommended: true,
	tags: ["minimax", "cost-effective", "i2v", "t2v"],

	// Agentic workflow hints
	promptLimits: { min: 2, max: 3000, suggested: 500 },
	styleHints: {
		defaultStyle: "cinematic",
		styleControllability: "high",
		supportsCameraControl: true,
		supportsDetailedScenes: true,
		bestFor: ["character videos", "scenes", "promotional"],
	},
	supportsAbstract: true,
};

// ============================================================================
// 3. MINIMAX HAILUO-02 ($0.28) - NOTE: Only 6s or 10s duration!
// ============================================================================

export const MINIMAX_HAILUO_02: ModelRegistryEntry = {
	id: "minimax/hailuo-02",
	type: "video",
	displayName: "MiniMax Hailuo 02",
	description: "6s, 1080p/768p. ✅ VERIFIED 2026-01-09 ($0.28)",
	provider: "together",
	status: "verified",
	verifiedDate: "2026-01-09",

	parameters: [
		...MVP_VIDEO_PARAMS("minimax/hailuo-02"),
		RESOLUTION_PARAM(["1366x768", "1920x1080"], "1366x768"),
		// CRITICAL: Hailuo 02 only supports 6 or 10 seconds!
		{
			name: "seconds",
			displayName: "Duration (seconds)",
			description: "ONLY 6 or 10 supported",
			type: "select",
			required: true,
			defaultValue: "6",
			constraints: {
				options: [
					{ value: "6", label: "6 seconds" },
					{ value: "10", label: "10 seconds" },
				],
			},
			uiHint: "select",
			group: "basic",
			order: 3,
		},
		FIRST_FRAME_IMAGE_PARAM,
		GUIDANCE_PARAM(1, 10, 7),
		SEED_PARAM,
	],

	pricing: { unit: "per_second", cost: 0.047, currency: "USD", notes: "$0.28 for 6s" },
	recommended: true,
	tags: ["minimax", "long-duration", "i2v", "t2v"],

	// Agentic workflow hints
	promptLimits: { min: 2, max: 3000, suggested: 500 },
	styleHints: {
		defaultStyle: "cinematic",
		styleControllability: "high",
		supportsCameraControl: true,
		supportsDetailedScenes: true,
		bestFor: ["professional videos", "character animations", "longer scenes"],
	},
	supportsAbstract: true,
};

// ============================================================================
// 4. PIXVERSE V5 ($0.30)
// ============================================================================

const PIXVERSE_RESOLUTIONS = [
	"640x360",
	"480x360",
	"360x360",
	"270x360",
	"360x640",
	"960x540",
	"720x540",
	"540x540",
	"405x540",
	"540x960",
	"1280x720",
	"960x720",
	"720x720",
	"540x720",
	"720x1280",
	"1920x1080",
	"1440x1080",
	"1080x1080",
	"810x1080",
	"1080x1920",
];

export const PIXVERSE_V5: ModelRegistryEntry = {
	id: "pixverse/pixverse-v5",
	type: "video",
	displayName: "PixVerse v5",
	description: "5s, 20+ resolutions. ✅ VERIFIED 2026-01-09 ($0.30)",
	provider: "together",
	status: "verified",
	verifiedDate: "2026-01-09",

	parameters: [
		...MVP_VIDEO_PARAMS("pixverse/pixverse-v5"),
		RESOLUTION_PARAM(PIXVERSE_RESOLUTIONS, "1280x720"),
		DURATION_PARAM(5),
		FIRST_FRAME_IMAGE_PARAM,
		LAST_FRAME_IMAGE_PARAM,
		GUIDANCE_PARAM(1, 10, 7),
		NEGATIVE_PROMPT_PARAM,
		SEED_PARAM,
	],

	pricing: { unit: "per_second", cost: 0.06, currency: "USD", notes: "$0.30 for 5s" },
	tags: ["pixverse", "many-resolutions", "first-last-frame", "t2v", "i2v"],

	// Agentic workflow hints
	promptLimits: { min: 2, max: 2048, suggested: 400 },
	styleHints: {
		defaultStyle: "stylized",
		styleControllability: "medium",
		supportsCameraControl: false,
		supportsDetailedScenes: true,
		bestFor: ["stylized videos", "creative content", "various aspect ratios"],
	},
	supportsAbstract: true,
};

// ============================================================================
// 5. GOOGLE VEO 3.0 FAST ($0.80)
// ============================================================================

export const GOOGLE_VEO_3_FAST: ModelRegistryEntry = {
	id: "google/veo-3.0-fast",
	type: "video",
	displayName: "Google Veo 3.0 Fast",
	description: "8s, 1080p/720p. ✅ VERIFIED 2026-01-09 ($0.80)",
	provider: "together",
	status: "verified",
	verifiedDate: "2026-01-09",

	parameters: [
		...MVP_VIDEO_PARAMS("google/veo-3.0-fast"),
		RESOLUTION_PARAM(["1280x720", "720x1280", "1920x1080", "1080x1920"], "1280x720"),
		DURATION_PARAM(8),
		FIRST_FRAME_IMAGE_PARAM,
		GUIDANCE_PARAM(1, 10, 7),
		SEED_PARAM,
	],

	pricing: { unit: "per_second", cost: 0.1, currency: "USD", notes: "$0.80 for 8s" },
	recommended: true,
	tags: ["google", "veo", "fast", "cost-effective", "t2v"],

	// Agentic workflow hints
	promptLimits: { min: 2, max: 3000, suggested: 600 },
	styleHints: {
		defaultStyle: "photorealistic",
		styleControllability: "high",
		supportsCameraControl: true,
		supportsDetailedScenes: true,
		bestFor: ["photorealistic videos", "high quality scenes", "professional content"],
	},
	supportsAbstract: true,
};

// ============================================================================
// REGISTRY EXPORT - Only VERIFIED cost-effective models
// ============================================================================

export const VERIFIED_VIDEO_MODELS: ModelRegistryEntry[] = [
	WAN_2_2_T2V, // $0.15 - CHEAPEST!
	MINIMAX_VIDEO_01_DIRECTOR, // $0.28
	MINIMAX_HAILUO_02, // $0.28 (6s only!)
	PIXVERSE_V5, // $0.30
	GOOGLE_VEO_3_FAST, // $0.80
];

/**
 * Verified T2V model IDs - safe for production
 */
export const VERIFIED_T2V_MODEL_IDS = [
	"Wan-AI/Wan2.2-T2V-A14B", // $0.15, CHEAPEST!
	"minimax/video-01-director", // $0.28
	"minimax/hailuo-02", // $0.28 (6s)
	"pixverse/pixverse-v5", // $0.30
	"google/veo-3.0-fast", // $0.80
] as const;

/**
 * Default video model for selfie/agentic generation
 */
export const DEFAULT_VIDEO_MODEL = "Wan-AI/Wan2.2-T2V-A14B";

/**
 * Get video model by ID
 */
export function getVideoModel(modelId: string): ModelRegistryEntry | undefined {
	return VERIFIED_VIDEO_MODELS.find((m) => m.id === modelId);
}

/**
 * Get recommended video models
 */
export function getRecommendedVideoModels(): ModelRegistryEntry[] {
	return VERIFIED_VIDEO_MODELS.filter((m) => m.recommended);
}

/**
 * Get cost-effective video models
 */
export function getCostEffectiveVideoModels(): ModelRegistryEntry[] {
	return VERIFIED_VIDEO_MODELS.filter((m) => m.tags?.includes("cost-effective"));
}

/**
 * Get video models that support I2V (first frame)
 */
export function getI2VVideoModels(): ModelRegistryEntry[] {
	return VERIFIED_VIDEO_MODELS.filter((m) => m.tags?.includes("i2v"));
}

/**
 * Check if a video model supports an optional parameter
 */
export function videoModelSupportsParam(modelId: string, paramName: string): boolean {
	const model = getVideoModel(modelId);
	if (!model) {
		return false;
	}
	return model.parameters.some((p) => p.name === paramName);
}

/**
 * Model Management for OpenElara Cloud
 *
 * PORTED FROM DESKTOP APP: src/main/handlers/togetherModels.js
 *
 * COMPREHENSIVE API TESTING (2025-11-25):
 * - Tested ALL 27 Together.ai image models via actual API calls
 * - ~800 total API calls across all models testing:
 *   - Step ranges (15 values: 1, 2, 4, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 75, 100)
 *   - Guidance scale ranges (10 values: 0.5, 1, 2, 3.5, 5, 7, 10, 15, 20, 30)
 *   - Resolutions (8 sizes: 512x512 → 2048x2048)
 * - Results: 18 working models, 9 unsupported (different API structures)
 */

import { getAPIKey } from "./byok";
import { logger } from "./logger";

// ============================================================================
// TYPES
// ============================================================================

export interface ResolutionPreset {
	width: number;
	height: number;
	label: string;
}

export interface ImageModelMetadata {
	displayName: string;
	description: string;
	defaultSteps: number;
	stepRange: { min: number; max: number } | null; // null = steps not supported
	defaultWidth: number;
	defaultHeight: number;
	resolutionPresets: ResolutionPreset[];
	supportsLoRA: boolean;
	supportsNegativePrompt: boolean;
	supportsT2I: boolean;
	supportsI2I: boolean;
	supportsSeed: boolean;
	supportsSteps: boolean; // CRITICAL: Some models (Google, ByteDance) don't support steps
	supportsGuidanceScale: boolean; // CRITICAL: Some models don't support guidance_scale
	defaultGuidanceScale: number | null; // null if not supported
	guidanceScaleRange: { min: number; max: number } | null; // null = not supported
	outputFormats: string[];
	free?: boolean;
}

export interface VideoModelMetadata {
	displayName: string;
	description: string;
	maxDuration: number;
	resolutions: string[];
	defaultResolution: string;
	fps: number;
	features: {
		t2v: boolean;
		i2v: boolean;
		firstFrame: boolean;
		lastFrame: boolean;
		audio: boolean;
	};
	parameterSupport: {
		negative_prompt: boolean;
		guidance_scale: boolean;
		steps: boolean;
	};
	costEffective?: boolean; // Cheap models suitable for agent selfies
}

export interface ChatModelMetadata {
	displayName: string;
	description: string;
	supportsTools: boolean;
	contextLength?: number | null;
	free?: boolean;
	thinking?: boolean;
}

export interface VoiceModelMetadata {
	displayName: string;
	description: string;
	voiceCount: number;
	defaultSampleRate: number;
	supportedFormats: string[];
	supportedLanguages: string[];
	voices?: string[];
	voiceCategories?: Record<string, string[]>;
}

export interface Model {
	id: string;
	type: "chat" | "image" | "video" | "audio";
	displayName?: string;
	organization?: string;
	pricing?: { input?: number; output?: number };
	contextLength?: number;
	metadata: ImageModelMetadata | VideoModelMetadata | ChatModelMetadata | VoiceModelMetadata;
	fallback?: boolean;
}

export type ModelType = "chat" | "image" | "video" | "audio" | "vision";

// ============================================================================
// STORAGE KEYS
// ============================================================================

const SELECTED_MODEL_KEY = "elara_selected_model";
const MODELS_CACHE_KEY = "elara_models_cache";
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// ============================================================================
// IMAGE MODEL METADATA - ALL VALUES VERIFIED via ~800 API calls (2025-11-25)
// Source: desktop_source/src/main/handlers/togetherModels.js
// ============================================================================

export const IMAGE_MODEL_METADATA: Record<string, ImageModelMetadata> = {
	// FLUX Models - Working (Verified)
	// NOTE: FLUX.1-schnell-Free was deprecated by Together.ai on 2026-01-08
	"black-forest-labs/FLUX.1-schnell": {
		displayName: "FLUX.1 Schnell",
		description: "Fast, high-quality image generation",
		defaultSteps: 6,
		stepRange: { min: 1, max: 12 },
		defaultWidth: 1024,
		defaultHeight: 1024,
		resolutionPresets: [
			{ width: 512, height: 512, label: "Square (512x512)" },
			{ width: 768, height: 768, label: "Square (768x768)" },
			{ width: 1024, height: 1024, label: "Square HD (1024x1024)" },
			{ width: 1024, height: 768, label: "Landscape (1024x768)" },
			{ width: 768, height: 1024, label: "Portrait (768x1024)" },
			{ width: 1280, height: 720, label: "Widescreen (1280x720)" },
		],
		supportsLoRA: true,
		supportsNegativePrompt: true,
		supportsT2I: true,
		supportsI2I: true,
		supportsSeed: true,
		supportsSteps: true,
		supportsGuidanceScale: true,
		defaultGuidanceScale: 15.2,
		guidanceScaleRange: { min: 0.5, max: 30 },
		outputFormats: ["jpeg", "png"],
	},
	"black-forest-labs/FLUX.1.1-pro": {
		displayName: "FLUX.1.1 Pro",
		description: "Professional quality image generation",
		defaultSteps: 25,
		stepRange: { min: 1, max: 50 },
		defaultWidth: 1024,
		defaultHeight: 1024,
		resolutionPresets: [
			{ width: 512, height: 512, label: "Square (512x512)" },
			{ width: 768, height: 768, label: "Square (768x768)" },
			{ width: 1024, height: 1024, label: "Square HD (1024x1024)" },
			{ width: 1024, height: 768, label: "Landscape (1024x768)" },
			{ width: 768, height: 1024, label: "Portrait (768x1024)" },
		],
		supportsLoRA: false,
		supportsNegativePrompt: true,
		supportsT2I: true,
		supportsI2I: true,
		supportsSeed: true,
		supportsSteps: true,
		supportsGuidanceScale: true,
		defaultGuidanceScale: 15.2,
		guidanceScaleRange: { min: 0.5, max: 30 },
		outputFormats: ["jpeg", "png"],
	},
	"black-forest-labs/FLUX.1-dev": {
		displayName: "FLUX.1 Dev",
		description: "Development model with LoRA support",
		defaultSteps: 25,
		stepRange: { min: 1, max: 50 },
		defaultWidth: 1024,
		defaultHeight: 1024,
		resolutionPresets: [
			{ width: 512, height: 512, label: "Square (512x512)" },
			{ width: 768, height: 768, label: "Square (768x768)" },
			{ width: 1024, height: 1024, label: "Square HD (1024x1024)" },
			{ width: 1024, height: 768, label: "Landscape (1024x768)" },
			{ width: 768, height: 1024, label: "Portrait (768x1024)" },
			{ width: 1280, height: 720, label: "Widescreen (1280x720)" },
		],
		supportsLoRA: true,
		supportsNegativePrompt: true,
		supportsT2I: true,
		supportsI2I: true,
		supportsSeed: true,
		supportsSteps: true,
		supportsGuidanceScale: true,
		defaultGuidanceScale: 15.2,
		guidanceScaleRange: { min: 0.5, max: 30 },
		outputFormats: ["jpeg", "png"],
	},
	"black-forest-labs/FLUX.1-kontext-pro": {
		displayName: "FLUX.1 Kontext Pro",
		description: "Context-aware image generation",
		defaultSteps: 25,
		stepRange: { min: 1, max: 50 },
		defaultWidth: 1024,
		defaultHeight: 1024,
		resolutionPresets: [
			{ width: 512, height: 512, label: "Square (512x512)" },
			{ width: 768, height: 768, label: "Square (768x768)" },
			{ width: 1024, height: 1024, label: "Square HD (1024x1024)" },
			{ width: 1024, height: 768, label: "Landscape (1024x768)" },
			{ width: 768, height: 1024, label: "Portrait (768x1024)" },
			{ width: 1280, height: 720, label: "Widescreen (1280x720)" },
			{ width: 1920, height: 1080, label: "Full HD (1920x1080)" },
			{ width: 2048, height: 2048, label: "Ultra HD (2048x2048)" },
		],
		supportsLoRA: false,
		supportsNegativePrompt: true,
		supportsT2I: true,
		supportsI2I: true,
		supportsSeed: true,
		supportsSteps: true,
		supportsGuidanceScale: true,
		defaultGuidanceScale: 15.2,
		guidanceScaleRange: { min: 0.5, max: 30 },
		outputFormats: ["jpeg", "png"],
	},
	"black-forest-labs/FLUX.1-kontext-max": {
		displayName: "FLUX.1 Kontext Max",
		description: "Maximum context awareness",
		defaultSteps: 26,
		stepRange: { min: 2, max: 50 },
		defaultWidth: 1024,
		defaultHeight: 1024,
		resolutionPresets: [
			{ width: 512, height: 512, label: "Square (512x512)" },
			{ width: 768, height: 768, label: "Square (768x768)" },
			{ width: 1024, height: 1024, label: "Square HD (1024x1024)" },
			{ width: 1024, height: 768, label: "Landscape (1024x768)" },
			{ width: 768, height: 1024, label: "Portrait (768x1024)" },
			{ width: 1280, height: 720, label: "Widescreen (1280x720)" },
			{ width: 1920, height: 1080, label: "Full HD (1920x1080)" },
			{ width: 2048, height: 2048, label: "Ultra HD (2048x2048)" },
		],
		supportsLoRA: false,
		supportsNegativePrompt: true,
		supportsT2I: true,
		supportsI2I: true,
		supportsSeed: true,
		supportsSteps: true,
		supportsGuidanceScale: true,
		defaultGuidanceScale: 15.2,
		guidanceScaleRange: { min: 0.5, max: 30 },
		outputFormats: ["jpeg", "png"],
	},
	"black-forest-labs/FLUX.1-krea-dev": {
		displayName: "FLUX.1 Krea Dev",
		description: "Creative development model",
		defaultSteps: 20,
		stepRange: { min: 1, max: 40 },
		defaultWidth: 1024,
		defaultHeight: 1024,
		resolutionPresets: [
			{ width: 1024, height: 1024, label: "Square HD (1024x1024)" },
			{ width: 1024, height: 768, label: "Landscape (1024x768)" },
			{ width: 768, height: 1024, label: "Portrait (768x1024)" },
			{ width: 1280, height: 720, label: "Widescreen (1280x720)" },
		],
		supportsLoRA: false,
		supportsNegativePrompt: true,
		supportsT2I: true,
		supportsI2I: true,
		supportsSeed: true,
		supportsSteps: true,
		supportsGuidanceScale: true,
		defaultGuidanceScale: 15.2,
		guidanceScaleRange: { min: 0.5, max: 30 },
		outputFormats: ["jpeg", "png"],
	},

	// HiDream Models
	"HiDream-ai/HiDream-I1-Full": {
		displayName: "HiDream I1 Full",
		description: "Full quality image generation",
		defaultSteps: 25,
		stepRange: { min: 1, max: 50 },
		defaultWidth: 1024,
		defaultHeight: 1024,
		resolutionPresets: [
			{ width: 512, height: 512, label: "Square (512x512)" },
			{ width: 768, height: 768, label: "Square (768x768)" },
			{ width: 1024, height: 1024, label: "Square HD (1024x1024)" },
			{ width: 1024, height: 768, label: "Landscape (1024x768)" },
			{ width: 768, height: 1024, label: "Portrait (768x1024)" },
			{ width: 2048, height: 2048, label: "Ultra HD (2048x2048)" },
		],
		supportsLoRA: false,
		supportsNegativePrompt: true,
		supportsT2I: true,
		supportsI2I: true,
		supportsSeed: true,
		supportsSteps: true,
		supportsGuidanceScale: true,
		defaultGuidanceScale: 15.2,
		guidanceScaleRange: { min: 0.5, max: 30 },
		outputFormats: ["jpeg", "png"],
	},
	"HiDream-ai/HiDream-I1-Dev": {
		displayName: "HiDream I1 Dev",
		description: "Development model",
		defaultSteps: 50,
		stepRange: { min: 1, max: 100 },
		defaultWidth: 1024,
		defaultHeight: 1024,
		resolutionPresets: [
			{ width: 512, height: 512, label: "Square (512x512)" },
			{ width: 768, height: 768, label: "Square (768x768)" },
			{ width: 1024, height: 1024, label: "Square HD (1024x1024)" },
			{ width: 1024, height: 768, label: "Landscape (1024x768)" },
			{ width: 768, height: 1024, label: "Portrait (768x1024)" },
			{ width: 2048, height: 2048, label: "Ultra HD (2048x2048)" },
		],
		supportsLoRA: false,
		supportsNegativePrompt: true,
		supportsT2I: true,
		supportsI2I: true,
		supportsSeed: true,
		supportsSteps: true,
		supportsGuidanceScale: true,
		defaultGuidanceScale: 10.2,
		guidanceScaleRange: { min: 0.5, max: 20 },
		outputFormats: ["jpeg", "png"],
	},
	"HiDream-ai/HiDream-I1-Fast": {
		displayName: "HiDream I1 Fast",
		description: "Fast generation model",
		defaultSteps: 50,
		stepRange: { min: 1, max: 100 },
		defaultWidth: 1024,
		defaultHeight: 1024,
		resolutionPresets: [
			{ width: 512, height: 512, label: "Square (512x512)" },
			{ width: 768, height: 768, label: "Square (768x768)" },
			{ width: 1024, height: 1024, label: "Square HD (1024x1024)" },
			{ width: 1024, height: 768, label: "Landscape (1024x768)" },
			{ width: 768, height: 1024, label: "Portrait (768x1024)" },
			{ width: 2048, height: 2048, label: "Ultra HD (2048x2048)" },
		],
		supportsLoRA: false,
		supportsNegativePrompt: true,
		supportsT2I: true,
		supportsI2I: true,
		supportsSeed: true,
		supportsSteps: true,
		supportsGuidanceScale: true,
		defaultGuidanceScale: 15.2,
		guidanceScaleRange: { min: 0.5, max: 30 },
		outputFormats: ["jpeg", "png"],
	},

	// Qwen Image
	"Qwen/Qwen-Image": {
		displayName: "Qwen Image",
		description: "Qwen image generation model",
		defaultSteps: 38,
		stepRange: { min: 1, max: 75 },
		defaultWidth: 1024,
		defaultHeight: 1024,
		resolutionPresets: [
			{ width: 512, height: 512, label: "Square (512x512)" },
			{ width: 768, height: 768, label: "Square (768x768)" },
			{ width: 1024, height: 1024, label: "Square HD (1024x1024)" },
			{ width: 1024, height: 768, label: "Landscape (1024x768)" },
			{ width: 768, height: 1024, label: "Portrait (768x1024)" },
		],
		supportsLoRA: false,
		supportsNegativePrompt: true,
		supportsT2I: true,
		supportsI2I: false, // VERIFIED: Does not support I2I
		supportsSeed: true,
		supportsSteps: true,
		supportsGuidanceScale: true,
		defaultGuidanceScale: 15.2,
		guidanceScaleRange: { min: 0.5, max: 30 },
		outputFormats: ["jpeg", "png"],
	},

	// RunDiffusion/Lykon Models
	"RunDiffusion/Juggernaut-pro-flux": {
		displayName: "Juggernaut Pro FLUX",
		description: "Pro-level FLUX variant",
		defaultSteps: 50,
		stepRange: { min: 1, max: 100 },
		defaultWidth: 1024,
		defaultHeight: 1024,
		resolutionPresets: [
			{ width: 512, height: 512, label: "Square (512x512)" },
			{ width: 768, height: 768, label: "Square (768x768)" },
			{ width: 1024, height: 1024, label: "Square HD (1024x1024)" },
			{ width: 1024, height: 768, label: "Landscape (1024x768)" },
			{ width: 768, height: 1024, label: "Portrait (768x1024)" },
			{ width: 2048, height: 2048, label: "Ultra HD (2048x2048)" },
		],
		supportsLoRA: false,
		supportsNegativePrompt: true,
		supportsT2I: true,
		supportsI2I: true,
		supportsSeed: true,
		supportsSteps: true,
		supportsGuidanceScale: true,
		defaultGuidanceScale: 15.2,
		guidanceScaleRange: { min: 0.5, max: 30 },
		outputFormats: ["jpeg", "png"],
	},
	"Rundiffusion/Juggernaut-Lightning-Flux": {
		displayName: "Juggernaut Lightning FLUX",
		description: "Fast FLUX variant",
		defaultSteps: 50,
		stepRange: { min: 1, max: 100 },
		defaultWidth: 1024,
		defaultHeight: 1024,
		resolutionPresets: [
			{ width: 512, height: 512, label: "Square (512x512)" },
			{ width: 768, height: 768, label: "Square (768x768)" },
			{ width: 1024, height: 1024, label: "Square HD (1024x1024)" },
			{ width: 1024, height: 768, label: "Landscape (1024x768)" },
			{ width: 768, height: 1024, label: "Portrait (768x1024)" },
			{ width: 2048, height: 2048, label: "Ultra HD (2048x2048)" },
		],
		supportsLoRA: false,
		supportsNegativePrompt: true,
		supportsT2I: true,
		supportsI2I: true,
		supportsSeed: true,
		supportsSteps: true,
		supportsGuidanceScale: true,
		defaultGuidanceScale: 15.2,
		guidanceScaleRange: { min: 0.5, max: 30 },
		outputFormats: ["jpeg", "png"],
	},
	"Lykon/DreamShaper": {
		displayName: "DreamShaper",
		description: "Dream-style image generation",
		defaultSteps: 50,
		stepRange: { min: 1, max: 100 },
		defaultWidth: 1024,
		defaultHeight: 1024,
		resolutionPresets: [
			{ width: 512, height: 512, label: "Square (512x512)" },
			{ width: 768, height: 768, label: "Square (768x768)" },
			{ width: 1024, height: 1024, label: "Square HD (1024x1024)" },
			{ width: 1024, height: 768, label: "Landscape (1024x768)" },
			{ width: 768, height: 1024, label: "Portrait (768x1024)" },
			{ width: 2048, height: 2048, label: "Ultra HD (2048x2048)" },
		],
		supportsLoRA: false,
		supportsNegativePrompt: true,
		supportsT2I: true,
		supportsI2I: true,
		supportsSeed: true,
		supportsSteps: true,
		supportsGuidanceScale: true,
		defaultGuidanceScale: 15.2,
		guidanceScaleRange: { min: 0.5, max: 30 },
		outputFormats: ["jpeg", "png"],
	},

	// Stability AI Models
	"stabilityai/stable-diffusion-3-medium": {
		displayName: "Stable Diffusion 3 Medium",
		description: "SD3 medium quality model",
		defaultSteps: 50,
		stepRange: { min: 1, max: 100 },
		defaultWidth: 1024,
		defaultHeight: 1024,
		resolutionPresets: [
			{ width: 512, height: 512, label: "Square (512x512)" },
			{ width: 768, height: 768, label: "Square (768x768)" },
			{ width: 1024, height: 1024, label: "Square HD (1024x1024)" },
			{ width: 1024, height: 768, label: "Landscape (1024x768)" },
			{ width: 768, height: 1024, label: "Portrait (768x1024)" },
			{ width: 2048, height: 2048, label: "Ultra HD (2048x2048)" },
		],
		supportsLoRA: false,
		supportsNegativePrompt: true,
		supportsT2I: true,
		supportsI2I: true,
		supportsSeed: true,
		supportsSteps: true,
		supportsGuidanceScale: true,
		defaultGuidanceScale: 15.2,
		guidanceScaleRange: { min: 0.5, max: 30 },
		outputFormats: ["jpeg", "png"],
	},
	"stabilityai/stable-diffusion-xl-base-1.0": {
		displayName: "Stable Diffusion XL 1.0",
		description: "SDXL base model",
		defaultSteps: 50,
		stepRange: { min: 1, max: 100 },
		defaultWidth: 1024,
		defaultHeight: 1024,
		resolutionPresets: [
			{ width: 512, height: 512, label: "Square (512x512)" },
			{ width: 768, height: 768, label: "Square (768x768)" },
			{ width: 1024, height: 1024, label: "Square HD (1024x1024)" },
			{ width: 1024, height: 768, label: "Landscape (1024x768)" },
			{ width: 768, height: 1024, label: "Portrait (768x1024)" },
		],
		supportsLoRA: false,
		supportsNegativePrompt: true,
		supportsT2I: true,
		supportsI2I: true,
		supportsSeed: true,
		supportsSteps: true,
		supportsGuidanceScale: true,
		defaultGuidanceScale: 15.2,
		guidanceScaleRange: { min: 0.5, max: 30 },
		outputFormats: ["jpeg", "png"],
	},

	// ============================================================================
	// GOOGLE IMAGEN MODELS - MINIMAL PAYLOAD (no steps, no guidance_scale)
	// These models use different API structure - only prompt, model, width, height
	// ============================================================================
	"google/imagen-4.0-preview": {
		displayName: "Google Imagen 4.0 Preview",
		description: "Google's latest image model - Preview tier",
		defaultSteps: 0, // Not supported
		stepRange: null, // Not supported
		defaultWidth: 1024,
		defaultHeight: 1024,
		resolutionPresets: [
			{ width: 1024, height: 1024, label: "1K Square (1:1)" },
			{ width: 1248, height: 832, label: "1K Landscape (3:2)" },
			{ width: 832, height: 1248, label: "1K Portrait (2:3)" },
			{ width: 1344, height: 768, label: "1K Wide (16:9)" },
			{ width: 768, height: 1344, label: "1K Tall (9:16)" },
		],
		supportsLoRA: false,
		supportsNegativePrompt: false,
		supportsT2I: true,
		supportsI2I: false,
		supportsSeed: false,
		supportsSteps: false,
		supportsGuidanceScale: false,
		defaultGuidanceScale: null,
		guidanceScaleRange: null,
		outputFormats: ["jpeg", "png"],
	},
	"google/imagen-4.0-fast": {
		displayName: "Google Imagen 4.0 Fast",
		description: "Google's fast image model - Quick generation",
		defaultSteps: 0,
		stepRange: null,
		defaultWidth: 1024,
		defaultHeight: 1024,
		resolutionPresets: [
			{ width: 1024, height: 1024, label: "1K Square (1:1)" },
			{ width: 1248, height: 832, label: "1K Landscape (3:2)" },
			{ width: 832, height: 1248, label: "1K Portrait (2:3)" },
			{ width: 1344, height: 768, label: "1K Wide (16:9)" },
			{ width: 768, height: 1344, label: "1K Tall (9:16)" },
		],
		supportsLoRA: false,
		supportsNegativePrompt: false,
		supportsT2I: true,
		supportsI2I: false,
		supportsSeed: false,
		supportsSteps: false,
		supportsGuidanceScale: false,
		defaultGuidanceScale: null,
		guidanceScaleRange: null,
		outputFormats: ["jpeg", "png"],
	},
	"google/imagen-4.0-ultra": {
		displayName: "Google Imagen 4.0 Ultra",
		description: "Google's premium image model - Highest quality",
		defaultSteps: 0,
		stepRange: null,
		defaultWidth: 1024,
		defaultHeight: 1024,
		resolutionPresets: [
			{ width: 1024, height: 1024, label: "1K Square (1:1)" },
			{ width: 1248, height: 832, label: "1K Landscape (3:2)" },
			{ width: 832, height: 1248, label: "1K Portrait (2:3)" },
			{ width: 1344, height: 768, label: "1K Wide (16:9)" },
			{ width: 768, height: 1344, label: "1K Tall (9:16)" },
		],
		supportsLoRA: false,
		supportsNegativePrompt: false,
		supportsT2I: true,
		supportsI2I: false,
		supportsSeed: false,
		supportsSteps: false,
		supportsGuidanceScale: false,
		defaultGuidanceScale: null,
		guidanceScaleRange: null,
		outputFormats: ["jpeg", "png"],
	},
	"google/gemini-3-pro-image": {
		displayName: "Gemini 3 Pro Image",
		description: "Gemini-powered image generation - Multiple resolutions",
		defaultSteps: 0,
		stepRange: null,
		defaultWidth: 1024,
		defaultHeight: 1024,
		resolutionPresets: [
			// 1K resolutions
			{ width: 1024, height: 1024, label: "1K Square (1:1)" },
			{ width: 1248, height: 832, label: "1K (3:2)" },
			{ width: 1344, height: 768, label: "1K (16:9)" },
			// 2K resolutions
			{ width: 2048, height: 2048, label: "2K Square (1:1)" },
			{ width: 2496, height: 1664, label: "2K (3:2)" },
			{ width: 2688, height: 1536, label: "2K (16:9)" },
			// 4K resolutions
			{ width: 4096, height: 4096, label: "4K Square (1:1)" },
		],
		supportsLoRA: false,
		supportsNegativePrompt: false,
		supportsT2I: true,
		supportsI2I: false,
		supportsSeed: false,
		supportsSteps: false,
		supportsGuidanceScale: false,
		defaultGuidanceScale: null,
		guidanceScaleRange: null,
		outputFormats: ["jpeg", "png"],
	},
	"google/flash-image-2.5": {
		displayName: "Flash Image 2.5",
		description: "Google's flash image model - Fast generation",
		defaultSteps: 0,
		stepRange: null,
		defaultWidth: 1024,
		defaultHeight: 1024,
		resolutionPresets: [
			{ width: 1024, height: 1024, label: "Square (1:1)" },
			{ width: 1248, height: 832, label: "Landscape (3:2)" },
			{ width: 832, height: 1248, label: "Portrait (2:3)" },
		],
		supportsLoRA: false,
		supportsNegativePrompt: false,
		supportsT2I: true,
		supportsI2I: false,
		supportsSeed: false,
		supportsSteps: false,
		supportsGuidanceScale: false,
		defaultGuidanceScale: null,
		guidanceScaleRange: null,
		outputFormats: ["jpeg", "png"],
	},
};

// ============================================================================
// VIDEO MODEL METADATA - Source: Together.ai docs + desktop togetherModels.js
// ============================================================================

export const VIDEO_MODEL_METADATA: Record<string, VideoModelMetadata> = {
	// MiniMax Models - Recommended for quality + duration
	"minimax/video-01-director": {
		displayName: "MiniMax 01 Director",
		description: "5s, 1366×768, first frame I2V",
		maxDuration: 5,
		resolutions: ["1366x768"],
		defaultResolution: "1366x768",
		fps: 25,
		features: {
			t2v: true,
			i2v: true,
			firstFrame: true,
			lastFrame: false,
			audio: false,
		},
		parameterSupport: {
			negative_prompt: false,
			guidance_scale: true,
			steps: false,
		},

		costEffective: true, // 5s, good for quick selfies
	},
	"minimax/hailuo-02": {
		displayName: "MiniMax Hailuo 02",
		description: "10s, 1080p/768p, first frame I2V",
		maxDuration: 10,
		resolutions: ["1366x768", "1920x1080"],
		defaultResolution: "1366x768",
		fps: 25,
		features: {
			t2v: true,
			i2v: true,
			firstFrame: true,
			lastFrame: false,
			audio: false,
		},
		parameterSupport: {
			negative_prompt: false,
			guidance_scale: true,
			steps: false,
		},
	},

	// Google Veo - Flagship quality
	"google/veo-2.0": {
		displayName: "Google Veo 2.0",
		description: "5s, 720p, first+last frame I2V",
		maxDuration: 5,
		resolutions: ["1280x720", "720x1280"],
		defaultResolution: "1280x720",
		fps: 24,
		features: {
			t2v: true,
			i2v: true,
			firstFrame: true,
			lastFrame: true,
			audio: false,
		},
		parameterSupport: {
			negative_prompt: false,
			guidance_scale: true,
			steps: false,
		},
	},
	"google/veo-3.0": {
		displayName: "Google Veo 3.0",
		description: "8s, 1080p/720p, first frame I2V",
		maxDuration: 8,
		resolutions: ["1280x720", "720x1280", "1920x1080", "1080x1920"],
		defaultResolution: "1280x720",
		fps: 24,
		features: {
			t2v: true,
			i2v: true,
			firstFrame: true,
			lastFrame: false,
			audio: false,
		},
		parameterSupport: {
			negative_prompt: false,
			guidance_scale: true,
			steps: false,
		},
	},
	"Wan-AI/Wan2.1-T2V-14B": {
		displayName: "Wan 2.1 T2V 14B",
		description: "Text to video, 14B parameters",
		maxDuration: 6,
		resolutions: ["1024x576", "576x1024"],
		defaultResolution: "1024x576",
		fps: 24,
		features: {
			t2v: true,
			i2v: false,
			firstFrame: false,
			lastFrame: false,
			audio: false,
		},
		parameterSupport: {
			negative_prompt: false,
			guidance_scale: true,
			steps: true,
		},
	},
	"google/veo-3.0-audio": {
		displayName: "Google Veo 3.0 + Audio",
		description: "8s, 1080p/720p, with generated audio",
		maxDuration: 8,
		resolutions: ["1280x720", "720x1280", "1920x1080", "1080x1920"],
		defaultResolution: "1280x720",
		fps: 24,
		features: {
			t2v: true,
			i2v: true,
			firstFrame: true,
			lastFrame: false,
			audio: true,
		},
		parameterSupport: {
			negative_prompt: false,
			guidance_scale: true,
			steps: false,
		},
	},
	"google/veo-3.0-fast": {
		displayName: "Google Veo 3.0 Fast",
		description: "8s, 1080p/720p, faster generation",
		maxDuration: 8,
		resolutions: ["1280x720", "720x1280", "1920x1080", "1080x1920"],
		defaultResolution: "1280x720",
		fps: 24,
		features: {
			t2v: true,
			i2v: true,
			firstFrame: true,
			lastFrame: false,
			audio: false,
		},
		parameterSupport: {
			negative_prompt: false,
			guidance_scale: true,
			steps: false,
		},

		costEffective: true, // Fast generation, cheaper
	},
	"pixverse/pixverse-v5": {
		displayName: "PixVerse v5",
		description: "5s, 20+ resolutions, first+last I2V",
		maxDuration: 5,
		resolutions: [
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
		],
		defaultResolution: "1280x720",
		fps: 24,
		features: {
			t2v: true,
			i2v: true,
			firstFrame: true,
			lastFrame: true,
			audio: false,
		},
		parameterSupport: {
			negative_prompt: true,
			guidance_scale: true,
			steps: false,
		},
	},

	// Kling Models
	"kwaivgI/kling-2.1-master": {
		displayName: "Kling 2.1 Master",
		description: "5s, 1080p, first frame I2V",
		maxDuration: 5,
		resolutions: ["1920x1080", "1080x1080", "1080x1920"],
		defaultResolution: "1920x1080",
		fps: 24,
		features: {
			t2v: true,
			i2v: true,
			firstFrame: true,
			lastFrame: false,
			audio: false,
		},
		parameterSupport: {
			negative_prompt: false,
			guidance_scale: true,
			steps: false,
		},
	},
	"kwaivgI/kling-2.1-standard": {
		displayName: "Kling 2.1 Standard",
		description: "5s, 1080p, first frame I2V",
		maxDuration: 5,
		resolutions: ["1920x1080", "1080x1080", "1080x1920"],
		defaultResolution: "1920x1080",
		fps: 24,
		features: {
			t2v: true,
			i2v: true,
			firstFrame: true,
			lastFrame: false,
			audio: false,
		},
		parameterSupport: {
			negative_prompt: false,
			guidance_scale: true,
			steps: false,
		},
	},

	// Vidu - Best duration
	"vidu/vidu-2.0": {
		displayName: "Vidu 2.0",
		description: "8s, 9 resolutions, first+last I2V",
		maxDuration: 8,
		resolutions: [
			"1920x1080",
			"1080x1080",
			"1080x1920",
			"1280x720",
			"720x720",
			"720x1280",
			"640x360",
			"360x360",
			"360x640",
		],
		defaultResolution: "1920x1080",
		fps: 24,
		features: {
			t2v: true,
			i2v: true,
			firstFrame: true,
			lastFrame: true,
			audio: false,
		},
		parameterSupport: {
			negative_prompt: true,
			guidance_scale: true,
			steps: false,
		},
	},

	// OpenAI Sora - Premium
	"openai/sora-2": {
		displayName: "Sora 2",
		description: "8s, 720p, first frame I2V, premium",
		maxDuration: 8,
		resolutions: ["1280x720", "720x1280"],
		defaultResolution: "1280x720",
		fps: 24,
		features: {
			t2v: true,
			i2v: true,
			firstFrame: true,
			lastFrame: false,
			audio: false,
		},
		parameterSupport: {
			negative_prompt: false,
			guidance_scale: false,
			steps: false,
		},
	},
	"openai/sora-2-pro": {
		displayName: "Sora 2 Pro",
		description: "8s, 720p, flagship quality",
		maxDuration: 8,
		resolutions: ["1280x720", "720x1280"],
		defaultResolution: "1280x720",
		fps: 24,
		features: {
			t2v: true,
			i2v: true,
			firstFrame: true,
			lastFrame: false,
			audio: false,
		},
		parameterSupport: {
			negative_prompt: false,
			guidance_scale: false,
			steps: false,
		},
	},
};

// ============================================================================
// ⛔ CHAT MODEL METADATA - PERMANENTLY NUKED ⛔
// ============================================================================
//
// ████████████████████████████████████████████████████████████████████████████
// █                                                                          █
// █   🚫 DO NOT ADD HARDCODED CHAT MODELS HERE 🚫                            █
// █                                                                          █
// █   ALL chat models come from /models API endpoint.                        █
// █   See: dynamicModels.ts → getChatModelsFromAPI()                        █
// █                                                                          █
// █   Any engineer who adds hardcoded chat model metadata                    █
// █   without explicit permission from the project owner                     █
// █   will have their code immediately reverted.                             █
// █                                                                          █
// █   REASON: LLM models change constantly. Hardcoding creates:              █
// █   - Stale data                                                           █
// █   - Maintenance burden                                                   █
// █   - Incorrect pricing/context info                                       █
// █   - False assumptions about model capabilities                           █
// █                                                                          █
// █   The /models API is the ONLY source of truth.                          █
// █                                                                          █
// ████████████████████████████████████████████████████████████████████████████
//
// NUKED: 2026-01-09 - Previous 150+ lines of hardcoded model metadata deleted
// REASON: Models must be 100% dynamic from API

// ============================================================================
// VOICE MODEL METADATA
// ============================================================================

export const VOICE_MODEL_METADATA: Record<string, VoiceModelMetadata> = {
	"cartesia/sonic-2": {
		displayName: "Cartesia Sonic 2",
		description: "155+ high-quality voices, multi-language",
		voiceCount: 155,
		defaultSampleRate: 44100,
		supportedFormats: ["wav", "mp3", "raw"],
		supportedLanguages: ["en", "de", "fr", "es", "hi", "it", "ja", "ko", "nl", "pl", "pt", "ru", "sv", "tr", "zh"],
		voiceCategories: {
			professional: ["laidback woman", "professional narrator", "professional british woman"],
			casual: ["friendly sidekick", "young male", "teen girl", "elderly man"],
			character: ["video game npc", "sci-fi ai", "news anchor"],
		},
	},
	"hexgrad/Kokoro-82M": {
		displayName: "Kokoro 82M",
		description: "Lightweight, 24kHz voices",
		voiceCount: 20,
		defaultSampleRate: 24000,
		supportedFormats: ["wav", "mp3", "raw"],
		supportedLanguages: ["en"],
		voices: [
			"af_alloy",
			"af_aoede",
			"af_bella",
			"af_jessica",
			"af_kore",
			"af_nicole",
			"af_nova",
			"af_river",
			"af_sarah",
			"af_sky",
			"am_adam",
			"am_echo",
			"am_eric",
			"am_fenrir",
			"am_liam",
			"am_michael",
			"am_onyx",
			"am_puck",
			"am_santa",
			"bf_alice",
			"bf_emma",
		],
	},
	"canopylabs/orpheus-3b-0.1-ft": {
		displayName: "Orpheus 3B",
		description: "High-quality voice synthesis",
		voiceCount: 8,
		defaultSampleRate: 24000,
		supportedFormats: ["wav", "mp3", "raw"],
		supportedLanguages: ["en"],
		voices: ["tara", "leah", "jess", "mia", "zoe", "leo", "dan", "zac"],
	},
};

// ============================================================================
// BROKEN/UNSUPPORTED MODELS - DO NOT USE
// These require special API structures we don't support
// ============================================================================

export const UNSUPPORTED_IMAGE_MODELS = [
	"black-forest-labs/FLUX.1-pro", // Internal server errors
	"black-forest-labs/FLUX.1-dev-lora", // Requires image_loras parameter
	"black-forest-labs/FLUX.1-kontext-dev", // Requires condition_image
	// Google Imagen models now supported with MINIMUM VIABLE PAYLOAD (no steps/guidance)
	"ByteDance-Seed/Seedream-3.0", // Different API structure - needs investigation
	"ByteDance-Seed/Seedream-4.0", // Different API structure - needs investigation
	"ideogram/ideogram-3.0", // Different API structure - needs investigation
];

// ============================================================================
// API FETCHING
// ============================================================================

async function fetchTogetherModelsFromAPI(): Promise<any[]> {
	const apiKey = await getAPIKey("together");

	if (!apiKey) {
		throw new Error("Together.ai API key not configured");
	}

	logger.debug("Fetching from Together.ai API...", { component: "Models" });

	const response = await fetch("https://api.together.xyz/v1/models", {
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		throw new Error(`API request failed: ${response.status}`);
	}

	const data = await response.json();
	logger.debug(`Fetched ${data.length} models from Together.ai`, { component: "Models" });
	return data;
}

/**
 * Fetch models from OpenRouter API
 * https://openrouter.ai/api/v1/models
 */
async function _fetchOpenRouterModelsFromAPI(): Promise<any[]> {
	const apiKey = await getAPIKey("openrouter");

	if (!apiKey) {
		throw new Error("OpenRouter API key not configured");
	}

	logger.debug("Fetching from OpenRouter API...", { component: "Models" });

	const response = await fetch("https://openrouter.ai/api/v1/models", {
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		throw new Error(`OpenRouter API request failed: ${response.status}`);
	}

	const result = await response.json();
	const models = result.data || [];
	logger.debug(`Fetched ${models.length} models from OpenRouter`, { component: "Models" });

	// Normalize OpenRouter response to match Together.ai schema
	return models.map((m: any) => ({
		id: m.id,
		type: "chat",
		display_name: m.name || m.id,
		organization: m.id.split("/")[0],
		context_length: m.context_length,
		pricing: m.pricing,
	}));
}

function enhanceModelWithMetadata(apiModel: any, metadataRegistry: Record<string, any>, modelType: ModelType): Model {
	const hardcodedMeta = metadataRegistry[apiModel.id];

	if (!hardcodedMeta) {
		return {
			id: apiModel.id,
			type: modelType as any,
			displayName: apiModel.display_name || apiModel.id.split("/").pop(),
			organization: apiModel.organization,
			pricing: apiModel.pricing,
			contextLength: apiModel.context_length,
			metadata: {
				displayName: apiModel.display_name || apiModel.id.split("/").pop() || apiModel.id,
				description: `${apiModel.organization || "Unknown"} ${modelType} model`,
			} as any,
		};
	}

	return {
		id: apiModel.id,
		type: modelType as any,
		displayName: hardcodedMeta.displayName || apiModel.display_name,
		organization: apiModel.organization,
		pricing: apiModel.pricing,
		contextLength: apiModel.context_length || hardcodedMeta.contextLength,
		metadata: {
			...hardcodedMeta,
			contextLength: apiModel.context_length || hardcodedMeta.contextLength,
		},
	};
}

// ============================================================================
// PUBLIC API
// ============================================================================

async function getCachedOrFetchModels(): Promise<any[]> {
	if (typeof window === "undefined") {
		return [];
	}

	const cached = localStorage.getItem(MODELS_CACHE_KEY);
	if (cached) {
		try {
			const { models, timestamp } = JSON.parse(cached);
			if (Date.now() - timestamp < CACHE_DURATION) {
				return models;
			}
		} catch {
			/* cache corrupted */
		}
	}

	try {
		const freshModels = await fetchTogetherModelsFromAPI();
		localStorage.setItem(
			MODELS_CACHE_KEY,
			JSON.stringify({
				models: freshModels,
				timestamp: Date.now(),
			}),
		);
		return freshModels;
	} catch (error) {
		console.error("[Models] Failed to fetch:", error);
		return [];
	}
}

export async function getChatModels(): Promise<Model[]> {
	try {
		// Use dynamic models as SOURCE OF TRUTH
		const { getChatModelsFromAPI, isUsableModel, buildChatModelMetadata } = await import("./dynamicModels");

		const apiModels = await getChatModelsFromAPI();

		// Filter to usable models (no deprecated, serverless-only, test models)
		const usableModels = apiModels.filter(isUsableModel);

		// Build metadata dynamically from API response
		return usableModels.map((apiModel) => ({
			id: apiModel.id,
			type: "chat" as const,
			displayName: apiModel.display_name || apiModel.id.split("/").pop() || apiModel.id,
			organization: apiModel.id.split("/")[0],
			pricing: apiModel.pricing,
			contextLength: apiModel.context_length,
			metadata: buildChatModelMetadata(apiModel),
		}));
	} catch (error) {
		console.error("[Models] Failed to get chat models from API:", error);
		// NO FALLBACK - API key required. No hardcoded models.
		// If we can't fetch from API, return empty array.
		// UI will show "Configure API key" message.
		return [];
	}
}

export async function getImageModels(): Promise<Model[]> {
	try {
		const allModels = await getCachedOrFetchModels();

		// STRICT FILTERING: Only return models that:
		// 1. Are NOT in the unsupported list
		// 2. HAVE verified metadata in IMAGE_MODEL_METADATA
		// 3. Are NOT deprecated or serverless-only
		// This prevents unknown models from breaking the app
		const imageModels = allModels.filter((m: any) => {
			// Skip unsupported models
			if (UNSUPPORTED_IMAGE_MODELS.includes(m.id)) {
				return false;
			}

			// Check for deprecated/serverless in model ID or display name
			const idLower = m.id.toLowerCase();
			const nameLower = (m.display_name || "").toLowerCase();

			if (idLower.includes("deprecated") || nameLower.includes("deprecated")) {
				// Skip deprecated models silently
				return false;
			}

			if (idLower.includes("serverless") && !IMAGE_MODEL_METADATA[m.id]) {
				// Skip serverless-only models silently
				return false;
			}

			// Only include models with verified metadata
			// Unknown models are rejected - "better safe than sorry"
			if (!IMAGE_MODEL_METADATA[m.id]) {
				// Skip unknown models silently
				return false;
			}
			return m.type === "image";
		});

		return imageModels.map((model: any) => enhanceModelWithMetadata(model, IMAGE_MODEL_METADATA, "image"));
	} catch (error) {
		console.error("[Models] Failed to get image models:", error);
		// Fallback: Use hardcoded metadata for known working models only
		return Object.entries(IMAGE_MODEL_METADATA).map(([id, meta]) => ({
			id,
			type: "image" as const,
			displayName: meta.displayName,
			metadata: meta,
			fallback: true,
		}));
	}
}

export async function getVideoModels(): Promise<Model[]> {
	return Object.entries(VIDEO_MODEL_METADATA).map(([id, meta]) => ({
		id,
		type: "video" as const,
		displayName: meta.displayName,
		metadata: meta,
	}));
}

// Removed getRecommended* functions - Elara doesn't recommend a brain!
// All usable models are equal. Tool compatibility is detected automatically.

/**
 * Get cost-effective video models suitable for agent selfies
 * These are cheaper/faster models ideal for autonomous generation
 */
export function getCostEffectiveVideoModels(): string[] {
	return Object.entries(VIDEO_MODEL_METADATA)
		.filter(([_, meta]) => meta.costEffective)
		.map(([id]) => id);
}

// ============================================================================
// MODEL SELECTION STORAGE
// ============================================================================

export function getSelectedModel(type: ModelType): string | null {
	if (typeof window === "undefined") {
		return null;
	}
	return localStorage.getItem(`${SELECTED_MODEL_KEY}_${type}`);
}

export function setSelectedModel(type: ModelType, modelId: string): void {
	if (typeof window === "undefined") {
		return;
	}
	localStorage.setItem(`${SELECTED_MODEL_KEY}_${type}`, modelId);
}

/**
 * Get the default chat model.
 *
 * ⛔ NO HARDCODED FALLBACKS - If no API key or selection, returns null.
 * UI must handle this gracefully by prompting user to configure API key.
 */
export async function getDefaultChatModel(): Promise<string | null> {
	// First: use user's last selection if available
	const selected = getSelectedModel("chat");
	if (selected) {
		return selected;
	}

	// Get all available chat models from API
	try {
		const models = await getChatModels();

		if (models.length === 0) {
			// No models available - likely no API key configured
			return null;
		}

		// Prefer FREE models
		const freeModel = models.find((m) => (m.metadata as ChatModelMetadata).free);
		if (freeModel) {
			return freeModel.id;
		}

		// Use first available model
		return models[0].id;
	} catch (error) {
		console.error("[Models] Failed to get default chat model:", error);
		// NO HARDCODED FALLBACK - return null, UI will prompt for API key
		return null;
	}
}

export async function getDefaultImageModel(): Promise<string> {
	const selected = getSelectedModel("image");
	if (selected && IMAGE_MODEL_METADATA[selected]) {
		return selected;
	}

	// NOTE: FLUX.1-schnell-Free was deprecated 2026-01-08
	// Default to FLUX.1-schnell (fast, affordable)
	return "black-forest-labs/FLUX.1-schnell";
}

export async function getDefaultVideoModel(): Promise<string> {
	const selected = getSelectedModel("video");
	if (selected && VIDEO_MODEL_METADATA[selected]) {
		return selected;
	}

	// Default to MiniMax Video 01 (good balance of quality/cost)
	return "MiniMax-ai/MiniMax-Video-01-Director";
}

export function clearModelsCache(): void {
	if (typeof window === "undefined") {
		return;
	}
	localStorage.removeItem(MODELS_CACHE_KEY);
}

/**
 * Get full metadata for a specific image model
 */
export function getImageModelMetadata(modelId: string): ImageModelMetadata | null {
	return IMAGE_MODEL_METADATA[modelId] || null;
}

/**
 * Get full metadata for a specific video model
 */
export function getVideoModelMetadata(modelId: string): VideoModelMetadata | null {
	return VIDEO_MODEL_METADATA[modelId] || null;
}

/**
 * Get full metadata for a specific chat model.
 *
 * ⛔ CHAT MODELS ARE 100% DYNAMIC - No hardcoded metadata.
 * Use getChatModels() and find the model, or use dynamicModels.ts directly.
 *
 * This function exists only for backwards compatibility and returns null.
 * The real metadata comes from the /models API via dynamicModels.ts
 */
export function getChatModelMetadata(modelId: string): ChatModelMetadata | null {
	// ⛔ NO HARDCODED METADATA - All chat models come from API
	// Return null - callers should use getChatModels() instead
	console.warn(`[Models] getChatModelMetadata('${modelId}') called - use getChatModels() for dynamic data`);
	return null;
}

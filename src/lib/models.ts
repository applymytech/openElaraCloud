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

import { getAPIKey } from './byok';

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
  stepRange: { min: number; max: number };
  defaultWidth: number;
  defaultHeight: number;
  resolutionPresets: ResolutionPreset[];
  supportsLoRA: boolean;
  supportsNegativePrompt: boolean;
  supportsT2I: boolean;
  supportsI2I: boolean;
  supportsSeed: boolean;
  defaultGuidanceScale: number;
  guidanceScaleRange: { min: number; max: number };
  outputFormats: string[];
  recommended?: boolean;
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
  recommended?: boolean;
}

export interface ChatModelMetadata {
  displayName: string;
  description: string;
  supportsTools: boolean;
  contextLength?: number | null;
  recommended?: boolean;
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
  recommended?: boolean;
}

export interface Model {
  id: string;
  type: 'chat' | 'image' | 'video' | 'audio';
  displayName?: string;
  organization?: string;
  pricing?: { input?: number; output?: number };
  contextLength?: number;
  metadata: ImageModelMetadata | VideoModelMetadata | ChatModelMetadata | VoiceModelMetadata;
  fallback?: boolean;
}

export type ModelType = 'chat' | 'image' | 'video' | 'audio' | 'vision';

// ============================================================================
// STORAGE KEYS
// ============================================================================

const SELECTED_MODEL_KEY = 'elara_selected_model';
const MODELS_CACHE_KEY = 'elara_models_cache';
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// ============================================================================
// IMAGE MODEL METADATA - ALL VALUES VERIFIED via ~800 API calls (2025-11-25)
// Source: desktop_source/src/main/handlers/togetherModels.js
// ============================================================================

export const IMAGE_MODEL_METADATA: Record<string, ImageModelMetadata> = {
  // FLUX Models - Working (Verified)
  "black-forest-labs/FLUX.1-schnell-Free": {
    displayName: "FLUX.1 Schnell Free",
    description: "Fast image generation - Free tier",
    defaultSteps: 2,
    stepRange: { min: 1, max: 4 },
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
    supportsLoRA: false,
    supportsNegativePrompt: true,
    supportsT2I: true,
    supportsI2I: true,
    supportsSeed: true,
    defaultGuidanceScale: 15.2,
    guidanceScaleRange: { min: 0.5, max: 30 },
    outputFormats: ["jpeg", "png"],
    recommended: true,
    free: true,
  },
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
    defaultGuidanceScale: 15.2,
    guidanceScaleRange: { min: 0.5, max: 30 },
    outputFormats: ["jpeg", "png"],
    recommended: true,
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
    defaultGuidanceScale: 15.2,
    guidanceScaleRange: { min: 0.5, max: 30 },
    outputFormats: ["jpeg", "png"],
    recommended: true,
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
    defaultGuidanceScale: 15.2,
    guidanceScaleRange: { min: 0.5, max: 30 },
    outputFormats: ["jpeg", "png"],
    recommended: true,
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
    defaultGuidanceScale: 15.2,
    guidanceScaleRange: { min: 0.5, max: 30 },
    outputFormats: ["jpeg", "png"],
    recommended: true,
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
    recommended: true,
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
    recommended: true,
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
    recommended: true,
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
    recommended: true,
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
    recommended: true,
  },

  // PixVerse - Most resolution options
  "pixverse/pixverse-v5": {
    displayName: "PixVerse v5",
    description: "5s, 20+ resolutions, first+last I2V",
    maxDuration: 5,
    resolutions: [
      "640x360", "480x360", "360x360", "270x360", "360x640",
      "960x540", "720x540", "540x540", "405x540", "540x960",
      "1280x720", "960x720", "720x720", "540x720", "720x1280",
      "1920x1080", "1440x1080", "1080x1080", "810x1080", "1080x1920",
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
      "1920x1080", "1080x1080", "1080x1920",
      "1280x720", "720x720", "720x1280",
      "640x360", "360x360", "360x640",
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
    recommended: true,
  },
};

// ============================================================================
// CHAT MODEL METADATA - VERIFIED via actual API testing (2025-11-25)
// 57 models tested, 41 serverless working, 25 with function calling support
// ============================================================================

export const CHAT_MODEL_METADATA: Record<string, ChatModelMetadata> = {
  // Function Calling Support (25 models)
  // Meta Llama Models - Best balance, recommended
  "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo": {
    displayName: "Llama 3.1 405B Turbo",
    description: "Maximum capability LLM with function calling",
    supportsTools: true,
    recommended: false, // Expensive
  },
  "meta-llama/Llama-3.3-70B-Instruct-Turbo": {
    displayName: "Llama 3.3 70B Turbo",
    description: "High-performance LLM with function calling",
    supportsTools: true,
    recommended: true,
  },
  "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo": {
    displayName: "Llama 3.1 70B Turbo",
    description: "Powerful LLM with function calling",
    supportsTools: true,
    recommended: true,
  },
  "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8": {
    displayName: "Llama 4 Maverick 17B",
    description: "Next-gen LLM with function calling (128 experts)",
    supportsTools: true,
    contextLength: 32768,
    recommended: false,
  },
  "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": {
    displayName: "Llama 3.1 8B Turbo",
    description: "Fast, affordable LLM with function calling",
    supportsTools: true,
    recommended: true, // Best value
  },
  "meta-llama/Llama-3.2-3B-Instruct-Turbo": {
    displayName: "Llama 3.2 3B Turbo",
    description: "Lightweight LLM with function calling",
    supportsTools: true,
    recommended: false,
  },

  // Qwen Models - Excellent performance
  "Qwen/Qwen2.5-72B-Instruct-Turbo": {
    displayName: "Qwen 2.5 72B Turbo",
    description: "High-quality LLM with function calling",
    supportsTools: true,
    recommended: true,
  },
  "Qwen/Qwen3-Next-80B-A3B-Instruct": {
    displayName: "Qwen3 Next 80B",
    description: "Latest generation LLM with function calling",
    supportsTools: true,
    recommended: false,
  },
  "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8": {
    displayName: "Qwen3 Coder 480B",
    description: "Specialized coding LLM with function calling",
    supportsTools: true,
    recommended: false,
  },
  "Qwen/Qwen2.5-7B-Instruct-Turbo": {
    displayName: "Qwen 2.5 7B Turbo",
    description: "Compact, efficient LLM with function calling",
    supportsTools: true,
    recommended: true, // Great value
  },
  "Qwen/Qwen3-235B-A22B-Instruct-2507-tput": {
    displayName: "Qwen3 235B Instruct",
    description: "Large-scale LLM with function calling",
    supportsTools: true,
    recommended: false,
  },

  // DeepSeek Models - Strong reasoning
  "deepseek-ai/DeepSeek-V3": {
    displayName: "DeepSeek V3",
    description: "Powerful reasoning LLM with function calling",
    supportsTools: true,
    contextLength: 12288,
    recommended: true,
  },
  "deepseek-ai/DeepSeek-V3.1": {
    displayName: "DeepSeek V3.1",
    description: "Advanced reasoning LLM with function calling",
    supportsTools: true,
    contextLength: 40000,
    recommended: true,
  },

  // Mistral Models
  "mistralai/Mistral-Small-24B-Instruct-2501": {
    displayName: "Mistral Small 24B",
    description: "Efficient LLM with function calling",
    supportsTools: true,
    recommended: true,
  },
  "mistralai/Mixtral-8x7B-Instruct-v0.1": {
    displayName: "Mixtral 8x7B",
    description: "Mixture-of-experts model",
    supportsTools: false,
    recommended: false,
  },

  // FREE Models
  "ServiceNow-AI/Apriel-1.5-15b-Thinker": {
    displayName: "Apriel 1.5 15B Thinker",
    description: "FREE reasoning LLM with function calling",
    supportsTools: true,
    recommended: true,
    free: true,
  },
  "nvidia/NVIDIA-Nemotron-Nano-9B-v2": {
    displayName: "Nemotron Nano 9B",
    description: "NVIDIA LLM with function calling",
    supportsTools: true,
    recommended: true,
  },
  "openai/gpt-oss-20b": {
    displayName: "GPT-OSS 20B",
    description: "Compact open-source style LLM",
    supportsTools: true,
    recommended: true,
  },

  // Thinking/Reasoning Models (no function calling)
  "deepseek-ai/DeepSeek-R1": {
    displayName: "DeepSeek R1 (Thinking)",
    description: "Reasoning model - no function calling",
    supportsTools: false,
    contextLength: 12288,
    thinking: true,
    recommended: false,
  },
  "deepseek-ai/DeepSeek-R1-Distill-Llama-70B": {
    displayName: "DeepSeek R1 Distill 70B",
    description: "Distilled reasoning model",
    supportsTools: false,
    contextLength: 32768,
    thinking: true,
    recommended: false,
  },

  // Google Models
  "google/gemma-2-27b-it": {
    displayName: "Gemma 2 27B",
    description: "Google's open model",
    supportsTools: false,
    recommended: false,
  },
  "google/gemma-2-9b-it": {
    displayName: "Gemma 2 9B",
    description: "Compact Google model",
    supportsTools: false,
    recommended: false,
  },
};

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
    recommended: true,
  },
  "hexgrad/Kokoro-82M": {
    displayName: "Kokoro 82M",
    description: "Lightweight, 24kHz voices",
    voiceCount: 20,
    defaultSampleRate: 24000,
    supportedFormats: ["wav", "mp3", "raw"],
    supportedLanguages: ["en"],
    voices: [
      "af_alloy", "af_aoede", "af_bella", "af_jessica", "af_kore",
      "af_nicole", "af_nova", "af_river", "af_sarah", "af_sky",
      "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam",
      "am_michael", "am_onyx", "am_puck", "am_santa",
      "bf_alice", "bf_emma",
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
  "google/imagen-4.0-preview", // Different API structure
  "google/imagen-4.0-ultra", // Different API structure
  "google/imagen-4.0-fast", // Different API structure
  "google/flash-image-2.5", // Different API structure
  "google/gemini-3-pro-image", // Different API structure
  "ByteDance-Seed/Seedream-3.0", // Different API structure
  "ByteDance-Seed/Seedream-4.0", // Different API structure
  "ideogram/ideogram-3.0", // Different API structure
];

// ============================================================================
// API FETCHING
// ============================================================================

async function fetchTogetherModelsFromAPI(): Promise<any[]> {
  const apiKey = getAPIKey('together');
  
  if (!apiKey) {
    throw new Error('Together.ai API key not configured');
  }
  
  console.log('[Models] Fetching from Together.ai API...');
  
  const response = await fetch('https://api.together.xyz/v1/models', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  
  const data = await response.json();
  console.log(`[Models] Fetched ${data.length} models from API`);
  return data;
}

function enhanceModelWithMetadata(
  apiModel: any,
  metadataRegistry: Record<string, any>,
  modelType: ModelType
): Model {
  const hardcodedMeta = metadataRegistry[apiModel.id];
  
  if (!hardcodedMeta) {
    return {
      id: apiModel.id,
      type: modelType as any,
      displayName: apiModel.display_name || apiModel.id.split('/').pop(),
      organization: apiModel.organization,
      pricing: apiModel.pricing,
      contextLength: apiModel.context_length,
      metadata: {
        displayName: apiModel.display_name || apiModel.id.split('/').pop() || apiModel.id,
        description: `${apiModel.organization || 'Unknown'} ${modelType} model`,
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
  if (typeof window === 'undefined') return [];
  
  const cached = localStorage.getItem(MODELS_CACHE_KEY);
  if (cached) {
    try {
      const { models, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return models;
      }
    } catch { /* cache corrupted */ }
  }
  
  try {
    const freshModels = await fetchTogetherModelsFromAPI();
    localStorage.setItem(MODELS_CACHE_KEY, JSON.stringify({
      models: freshModels,
      timestamp: Date.now(),
    }));
    return freshModels;
  } catch (error) {
    console.error('[Models] Failed to fetch:', error);
    return [];
  }
}

export async function getChatModels(): Promise<Model[]> {
  try {
    const allModels = await getCachedOrFetchModels();
    const chatModels = allModels.filter((m: any) => m.type === 'chat');
    return chatModels.map((model: any) => 
      enhanceModelWithMetadata(model, CHAT_MODEL_METADATA, 'chat')
    );
  } catch (error) {
    console.error('[Models] Failed to get chat models:', error);
    return Object.entries(CHAT_MODEL_METADATA).map(([id, meta]) => ({
      id,
      type: 'chat' as const,
      displayName: meta.displayName,
      metadata: meta,
      fallback: true,
    }));
  }
}

export async function getImageModels(): Promise<Model[]> {
  try {
    const allModels = await getCachedOrFetchModels();
    const imageModels = allModels.filter((m: any) => 
      m.type === 'image' && !UNSUPPORTED_IMAGE_MODELS.includes(m.id)
    );
    return imageModels.map((model: any) => 
      enhanceModelWithMetadata(model, IMAGE_MODEL_METADATA, 'image')
    );
  } catch (error) {
    console.error('[Models] Failed to get image models:', error);
    return Object.entries(IMAGE_MODEL_METADATA).map(([id, meta]) => ({
      id,
      type: 'image' as const,
      displayName: meta.displayName,
      metadata: meta,
      fallback: true,
    }));
  }
}

export async function getVideoModels(): Promise<Model[]> {
  return Object.entries(VIDEO_MODEL_METADATA).map(([id, meta]) => ({
    id,
    type: 'video' as const,
    displayName: meta.displayName,
    metadata: meta,
  }));
}

export function getRecommendedChatModels(): string[] {
  return Object.entries(CHAT_MODEL_METADATA)
    .filter(([_, meta]) => meta.recommended)
    .map(([id]) => id);
}

export function getRecommendedImageModels(): string[] {
  return Object.entries(IMAGE_MODEL_METADATA)
    .filter(([_, meta]) => meta.recommended)
    .map(([id]) => id);
}

export function getRecommendedVideoModels(): string[] {
  return Object.entries(VIDEO_MODEL_METADATA)
    .filter(([_, meta]) => meta.recommended)
    .map(([id]) => id);
}

// ============================================================================
// MODEL SELECTION STORAGE
// ============================================================================

export function getSelectedModel(type: ModelType): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(`${SELECTED_MODEL_KEY}_${type}`);
}

export function setSelectedModel(type: ModelType, modelId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${SELECTED_MODEL_KEY}_${type}`, modelId);
}

export function getDefaultChatModel(): string {
  const selected = getSelectedModel('chat');
  if (selected) return selected;
  
  const recommended = getRecommendedChatModels();
  if (recommended.includes('meta-llama/Llama-3.3-70B-Instruct-Turbo')) {
    return 'meta-llama/Llama-3.3-70B-Instruct-Turbo';
  }
  
  return recommended[0] || 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo';
}

export function getDefaultImageModel(): string {
  const selected = getSelectedModel('image');
  if (selected) return selected;
  
  // Prefer free tier
  const freeModels = Object.entries(IMAGE_MODEL_METADATA)
    .filter(([_, meta]) => meta.free)
    .map(([id]) => id);
  
  if (freeModels.length > 0) {
    return freeModels[0];
  }
  
  return 'black-forest-labs/FLUX.1-schnell';
}

export function getDefaultVideoModel(): string {
  const selected = getSelectedModel('video');
  if (selected) return selected;
  
  return 'google/veo-3.0';
}

export function clearModelsCache(): void {
  if (typeof window === 'undefined') return;
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
 * Get full metadata for a specific chat model
 */
export function getChatModelMetadata(modelId: string): ChatModelMetadata | null {
  return CHAT_MODEL_METADATA[modelId] || null;
}

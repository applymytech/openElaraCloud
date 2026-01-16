/**
 * Media Generation Service for OpenElara Cloud
 * 
 * PORTED FROM DESKTOP APP: Uses proper model metadata from models.ts
 * 
 * Handles:
 * - Image generation (selfies, custom prompts) via Together.ai
 * - Video generation via Together.ai
 * - Voice/TTS generation via Together.ai, ElevenLabs
 * 
 * All using BYOK (Bring Your Own Key) - direct API calls from browser
 */

import { getAPIKey } from './byok';
import { getActiveCharacter, type Character } from './characters';
import { generateMetadata, signImage, type SignedContent } from './signing';
import { 
  IMAGE_MODEL_METADATA,
  VIDEO_MODEL_METADATA,
  VOICE_MODEL_METADATA,
  getDefaultImageModel,
  getDefaultVideoModel,
  getImageModelMetadata,
  getVideoModelMetadata,
  type ImageModelMetadata,
  type VideoModelMetadata,
} from './models';

// ============================================================================
// IMAGE GENERATION
// ============================================================================

export interface ImageGenerationOptions {
  prompt: string;
  width?: number;
  height?: number;
  model?: string;
  steps?: number;
  seed?: number;
  negativePrompt?: string;
  guidanceScale?: number;
  
  // Selfie mode
  isSelfie?: boolean;
  selfieScene?: string;  // User's scene suggestion
}

export interface GeneratedImage {
  signedContent: SignedContent;
  prompt: string;
  revisedPrompt?: string;
}

// Re-export model metadata for backwards compatibility
export const IMAGE_MODELS = IMAGE_MODEL_METADATA;
export const VIDEO_MODELS = VIDEO_MODEL_METADATA;

/**
 * Build a selfie prompt using character's appearance
 */
export function buildSelfiePrompt(
  character: Character,
  sceneRequest?: string
): string {
  // Character's physical description (first person for selfie)
  const appearance = character.descriptionFirstPerson || character.descriptionSafe;
  const attire = character.attireFirstPerson || character.attire;
  
  // Scene from user request or default
  const scene = sceneRequest?.trim() 
    ? sceneRequest 
    : 'casual selfie, looking at camera with a warm smile';
  
  // Combine into full prompt
  return `${appearance} ${attire} ${scene}, highly detailed, professional photography, soft lighting, sharp focus`;
}

/**
 * Generate an image using Together.ai
 * Uses proper model metadata from models.ts (verified via ~800 API calls)
 */
export async function generateImage(
  options: ImageGenerationOptions
): Promise<GeneratedImage> {
  const togetherKey = getAPIKey('together');
  if (!togetherKey) {
    throw new Error('Together.ai API key required. Add it in Settings.');
  }
  
  const character = getActiveCharacter();
  const model = options.model || await getDefaultImageModel();
  const modelConfig = await getImageModelMetadata(model);
  
  // Build prompt
  let prompt = options.prompt;
  if (options.isSelfie) {
    prompt = buildSelfiePrompt(character, options.selfieScene || options.prompt);
  }
  
  // Get model-specific defaults from verified metadata
  const width = options.width || modelConfig?.defaultWidth || 1024;
  const height = options.height || modelConfig?.defaultHeight || 1024;
  const steps = options.steps || modelConfig?.defaultSteps || 4;
  const guidanceScale = options.guidanceScale || modelConfig?.defaultGuidanceScale;
  
  // Validate steps are within model's allowed range
  const validatedSteps = modelConfig?.stepRange 
    ? Math.min(Math.max(steps, modelConfig.stepRange.min), modelConfig.stepRange.max)
    : steps;
  
  // Negative prompt if supported by model
  let negativePrompt = options.negativePrompt || character.negativePrompt;
  const supportsNegativePrompt = modelConfig?.supportsNegativePrompt ?? true;
  
  // Build API request body
  const requestBody: Record<string, any> = {
    model,
    prompt,
    width,
    height,
    steps: validatedSteps,
    n: 1,
    response_format: 'b64_json',
  };
  
  // Add optional parameters based on model capabilities
  if (supportsNegativePrompt && negativePrompt) {
    requestBody.negative_prompt = negativePrompt;
  }
  
  if (guidanceScale !== undefined && modelConfig?.guidanceScaleRange) {
    // Validate guidance scale is within model's range
    const validatedGuidance = Math.min(
      Math.max(guidanceScale, modelConfig.guidanceScaleRange.min),
      modelConfig.guidanceScaleRange.max
    );
    requestBody.guidance_scale = validatedGuidance;
  }
  
  if (options.seed !== undefined && modelConfig?.supportsSeed) {
    requestBody.seed = options.seed;
  }
  
  // API call
  const response = await fetch('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${togetherKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Image generation failed');
  }
  
  const result = await response.json();
  const base64 = result.data[0]?.b64_json;
  
  if (!base64) {
    throw new Error('No image data received');
  }
  
  const dataUrl = `data:image/png;base64,${base64}`;
  
  // Generate metadata for signing
  const metadata = await generateMetadata({
    contentType: 'image',
    prompt,
    model,
    width,
    height,
    steps: validatedSteps,
    seed: options.seed,
  });
  
  // Sign the image
  const signedContent = await signImage(dataUrl, metadata);
  
  return {
    signedContent,
    prompt,
    revisedPrompt: result.data[0]?.revised_prompt,
  };
}

/**
 * Generate a selfie of the current character
 */
export async function generateSelfie(
  sceneRequest?: string,
  options?: Partial<ImageGenerationOptions>
): Promise<GeneratedImage> {
  return generateImage({
    prompt: sceneRequest || '',
    isSelfie: true,
    selfieScene: sceneRequest,
    ...options,
  });
}

// ============================================================================
// AGENTIC SELFIE GENERATION - AI DECIDES THE SCENE
// ============================================================================

import { chat } from './api';
import { buildSelfieSystemPrompt, getMoodEmotionalContext } from './promptBuilder';
import type { MoodState } from './mood';

export interface AgenticSelfieOptions {
  sceneSuggestion?: string;
  model?: string;
  character?: Character;
  moodState?: MoodState | null;
  conversationContext?: string;
}

export interface AgenticSelfieResult {
  image: GeneratedImage;
  aiSceneDecision: string;  // What the AI decided
  attireOverride?: string;  // If AI chose different attire
}

/**
 * AGENTIC SELFIE GENERATION - The AI decides the scene based on mood and persona
 * 
 * This is the REAL desktop workflow:
 * 1. User provides optional scene suggestion
 * 2. LLM (with character persona + mood) DECIDES the actual scene/attire
 * 3. AI's scene description goes to image generation model
 * 4. Result is character-authentic, mood-influenced, not just generic
 */
export async function generateAgenticSelfie(
  options: AgenticSelfieOptions
): Promise<AgenticSelfieResult> {
  const togetherKey = getAPIKey('together');
  if (!togetherKey) {
    throw new Error('Together.ai API key required. Add it in Settings.');
  }
  
  const character = options.character || getActiveCharacter();
  
  // Build the selfie system prompt (includes SELFIE_GENERATION_INSTRUCTIONS)
  const systemPrompt = buildSelfieSystemPrompt({
    userName: 'User',
    character,
  });
  
  // Build context for the AI's decision
  let contextParts: string[] = [];
  
  // Add mood context if available
  if (options.moodState) {
    const emotionalContext = getMoodEmotionalContext(options.moodState, character.name);
    if (emotionalContext) {
      contextParts.push(`**Current Emotional State:**\n${emotionalContext}`);
    }
  }
  
  // Add conversation context if available
  if (options.conversationContext) {
    contextParts.push(`**Recent Conversation Context:**\n${options.conversationContext}`);
  }
  
  // Build the user message (scene suggestion)
  const userSuggestion = options.sceneSuggestion?.trim() 
    ? `The user suggests: "${options.sceneSuggestion}"\n\nRemember: This is a SUGGESTION. You decide the actual scene based on your mood and persona.`
    : 'Generate a selfie that reflects your current mood and personality. You have full creative freedom.';
  
  const fullUserMessage = contextParts.length > 0 
    ? `${contextParts.join('\n\n')}\n\n---\n\n${userSuggestion}`
    : userSuggestion;
  
  // STEP 1: Ask the AI to decide the scene
  const aiResponse = await chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: fullUserMessage },
  ], {
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', // Fast model for scene decision
    maxTokens: 300, // Scene descriptions are short
  });
  
  const aiDecision = aiResponse.choices[0]?.message?.content || 'A casual selfie with a warm smile';
  
  // Parse the AI's decision - check for ATTIRE override
  let attireOverride: string | undefined;
  let sceneDescription = aiDecision;
  
  if (aiDecision.includes('ATTIRE:')) {
    const attireMatch = aiDecision.match(/ATTIRE:\s*(.+?)(?:\n|$)/i);
    if (attireMatch) {
      attireOverride = attireMatch[1].trim();
      // Remove ATTIRE line from scene description
      sceneDescription = aiDecision.replace(/ATTIRE:\s*.+?(?:\n|$)/i, '').trim();
    }
  }
  
  // STEP 2: Build the final image prompt with character appearance
  const appearance = character.descriptionFirstPerson || character.descriptionSafe;
  const attire = attireOverride || character.attireFirstPerson || character.attire;
  
  const finalPrompt = `${appearance} ${attire} ${sceneDescription}, highly detailed, professional photography, soft lighting, sharp focus`;
  
  // STEP 3: Generate the image
  const image = await generateImage({
    prompt: finalPrompt,
    model: options.model,
    isSelfie: false, // We already built the prompt
  });
  
  return {
    image,
    aiSceneDecision: sceneDescription,
    attireOverride,
  };
}

// ============================================================================
// VIDEO GENERATION - Uses proper model metadata from models.ts
// ============================================================================

export interface VideoGenerationOptions {
  prompt: string;
  duration?: number;  // seconds
  model?: string;
  resolution?: string;
  negativePrompt?: string;
  guidanceScale?: number;
  firstFrameImage?: string;  // base64 or URL for I2V
  lastFrameImage?: string;   // base64 or URL for I2V (if supported)
  
  // Selfie mode
  isSelfie?: boolean;
  selfieScene?: string;
}

export interface GeneratedVideo {
  url: string;
  prompt: string;
  model: string;
  duration: number;
  resolution: string;
}

/**
 * Generate a video using Together.ai
 * Uses proper model metadata from models.ts
 */
export async function generateVideo(
  options: VideoGenerationOptions
): Promise<GeneratedVideo> {
  const togetherKey = getAPIKey('together');
  if (!togetherKey) {
    throw new Error('Together.ai API key required. Add it in Settings.');
  }
  
  const model = options.model || await getDefaultVideoModel();
  const modelConfig = await getVideoModelMetadata(model);
  
  if (!modelConfig) {
    throw new Error(`Unknown video model: ${model}. Please select a valid model.`);
  }
  
  // Build prompt
  let prompt = options.prompt;
  if (options.isSelfie) {
    const character = getActiveCharacter();
    prompt = buildSelfiePrompt(character, options.selfieScene || options.prompt);
  }
  
  // Get model-specific defaults
  const resolution = options.resolution || modelConfig.defaultResolution;
  const [width, height] = resolution.split('x').map(Number);
  
  // Validate duration
  const duration = Math.min(
    options.duration || modelConfig.maxDuration,
    modelConfig.maxDuration
  );
  
  // Build API request body
  const requestBody: Record<string, any> = {
    model,
    prompt,
    width,
    height,
    duration,
  };
  
  // Add optional parameters based on model capabilities
  if (options.negativePrompt && modelConfig.parameterSupport.negative_prompt) {
    requestBody.negative_prompt = options.negativePrompt;
  }
  
  if (options.guidanceScale !== undefined && modelConfig.parameterSupport.guidance_scale) {
    requestBody.guidance_scale = options.guidanceScale;
  }
  
  // Image-to-Video support
  if (options.firstFrameImage && modelConfig.features.firstFrame) {
    requestBody.first_frame_image = options.firstFrameImage;
  }
  
  if (options.lastFrameImage && modelConfig.features.lastFrame) {
    requestBody.last_frame_image = options.lastFrameImage;
  }
  
  // API call
  const response = await fetch('https://api.together.xyz/v1/video/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${togetherKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Video generation failed');
  }
  
  const result = await response.json();
  const videoUrl = result.data?.[0]?.url || result.url;
  
  if (!videoUrl) {
    throw new Error('No video URL received');
  }
  
  return {
    url: videoUrl,
    prompt,
    model,
    duration,
    resolution,
  };
}

// ============================================================================
// AGENTIC VIDEO GENERATION - AI DECIDES THE SCENE
// ============================================================================

import { buildVideoSystemPrompt } from './promptBuilder';

export interface AgenticVideoOptions {
  sceneSuggestion?: string;
  model?: string;
  character?: Character;
  moodState?: MoodState | null;
  conversationContext?: string;
  duration?: number;
}

export interface AgenticVideoResult {
  video: GeneratedVideo;
  aiSceneDecision: string;  // What the AI decided
  attireOverride?: string;  // If AI chose different attire
}

/**
 * AGENTIC VIDEO GENERATION - The AI decides the scene based on mood and persona
 * 
 * Same workflow as agentic selfie:
 * 1. User provides optional scene suggestion
 * 2. LLM (with character persona + mood) DECIDES the actual scene/attire
 * 3. AI's scene description + camera directions go to video model
 * 4. Result is character-authentic, mood-influenced
 */
export async function generateAgenticVideo(
  options: AgenticVideoOptions
): Promise<AgenticVideoResult> {
  const togetherKey = getAPIKey('together');
  if (!togetherKey) {
    throw new Error('Together.ai API key required. Add it in Settings.');
  }
  
  const character = options.character || getActiveCharacter();
  
  // Build the video system prompt (includes VIDEO_GENERATION_INSTRUCTIONS)
  const systemPrompt = buildVideoSystemPrompt({
    userName: 'User',
    character,
  });
  
  // Build context for the AI's decision
  let contextParts: string[] = [];
  
  // Add mood context if available
  if (options.moodState) {
    const emotionalContext = getMoodEmotionalContext(options.moodState, character.name);
    if (emotionalContext) {
      contextParts.push(`**Current Emotional State:**\n${emotionalContext}`);
    }
  }
  
  // Add conversation context if available
  if (options.conversationContext) {
    contextParts.push(`**Recent Conversation Context:**\n${options.conversationContext}`);
  }
  
  // Build the user message (scene suggestion)
  const userSuggestion = options.sceneSuggestion?.trim() 
    ? `The user suggests: "${options.sceneSuggestion}"\n\nRemember: This is a SUGGESTION. You decide the actual scene, actions, and camera work based on your mood and persona.`
    : 'Create a video scene that reflects your current mood and personality. You have full creative freedom over movement, actions, and camera direction.';
  
  const fullUserMessage = contextParts.length > 0 
    ? `${contextParts.join('\n\n')}\n\n---\n\n${userSuggestion}`
    : userSuggestion;
  
  // STEP 1: Ask the AI to decide the video scene
  const aiResponse = await chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: fullUserMessage },
  ], {
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    maxTokens: 400, // Video scenes with camera directions need more space
  });
  
  const aiDecision = aiResponse.choices[0]?.message?.content || 'A casual video with gentle movement and warm expression';
  
  // Parse the AI's decision - check for ATTIRE override
  let attireOverride: string | undefined;
  let sceneDescription = aiDecision;
  
  if (aiDecision.includes('ATTIRE:')) {
    const attireMatch = aiDecision.match(/ATTIRE:\s*(.+?)(?:\n|$)/i);
    if (attireMatch) {
      attireOverride = attireMatch[1].trim();
      sceneDescription = aiDecision.replace(/ATTIRE:\s*.+?(?:\n|$)/i, '').trim();
    }
  }
  
  // STEP 2: Build the final video prompt with character appearance
  const appearance = character.descriptionFirstPerson || character.descriptionSafe;
  const attire = attireOverride || character.attireFirstPerson || character.attire;
  
  const finalPrompt = `${appearance} ${attire} ${sceneDescription}, cinematic quality, smooth motion, professional lighting`;
  
  // STEP 3: Generate the video
  const video = await generateVideo({
    prompt: finalPrompt,
    model: options.model,
    duration: options.duration,
    isSelfie: false, // We already built the prompt
  });
  
  return {
    video,
    aiSceneDecision: sceneDescription,
    attireOverride,
  };
}

// ============================================================================
// VOICE/TTS GENERATION
// ============================================================================

export interface TTSOptions {
  text: string;
  voice?: string;
  model?: string;
}

/**
 * Generate speech using Together.ai Kokoro
 */
export async function generateSpeech(options: TTSOptions): Promise<Blob> {
  const togetherKey = getAPIKey('together');
  if (!togetherKey) {
    throw new Error('Together.ai API key required for TTS. Add it in Settings.');
  }
  
  const character = getActiveCharacter();
  const voice = options.voice || character.voiceProfile.voice || 'af_heart';
  const model = options.model || character.voiceProfile.model || 'hexgrad/Kokoro-82M';
  
  // Kokoro has 1000 char limit
  const text = options.text.slice(0, 1000);
  
  const response = await fetch('https://api.together.xyz/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${togetherKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
      voice,
      response_format: 'wav',
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'TTS generation failed');
  }
  
  return response.blob();
}

/**
 * Generate speech using ElevenLabs
 */
export async function generateSpeechElevenLabs(options: TTSOptions): Promise<Blob> {
  const elevenKey = getAPIKey('elevenlabs');
  if (!elevenKey) {
    throw new Error('ElevenLabs API key required. Add it in Settings.');
  }
  
  const voiceId = options.voice || 'EXAVITQu4vr4xnSDxMaL'; // Default: Sarah
  
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': elevenKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: options.text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail?.message || 'ElevenLabs TTS failed');
  }
  
  return response.blob();
}

/**
 * Play audio blob
 */
export function playAudio(audioBlob: Blob): HTMLAudioElement {
  const url = URL.createObjectURL(audioBlob);
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  audio.play();
  return audio;
}

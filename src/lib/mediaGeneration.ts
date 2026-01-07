/**
 * Media Generation Service for OpenElara Cloud
 * 
 * PORTED FROM DESKTOP APP: Uses proper model metadata from models.ts
 * 
 * Handles:
 * - Image generation (selfies, custom prompts) via Together.ai
 * - Video generation via Together.ai
 * - Voice/TTS generation via Together.ai (Cartesia Sonic)
 * 
 * All using BYOK (Bring Your Own Key) - direct API calls from browser
 * 
 * Supported Providers (matching desktop app):
 * - Together.ai: Images, Video, TTS, Chat, Embeddings
 * - OpenRouter: Chat routing to 300+ models
 * - Exa.ai: Web search (optional)
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
  getCostEffectiveVideoModels,
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
 * Build a character-contextual prompt (inserts character into scene)
 * 
 * NOTE: "Selfie" here means character-centric, NOT literally prompting for "selfie"
 * The scene should be contextual (decided by AI in agentic mode, or user in custom)
 * and NOT include the word "selfie" unless that's genuinely desired.
 */
export function buildSelfiePrompt(
  character: Character,
  sceneRequest?: string
): string {
  // Character's physical description (first person for character-centric)
  const appearance = character.descriptionFirstPerson || character.descriptionSafe;
  const attire = character.attireFirstPerson || character.attire;
  
  // Scene from user request or contextual default (NOT "selfie" word!)
  const scene = sceneRequest?.trim() 
    ? sceneRequest 
    : 'looking at camera with a warm, natural expression';
  
  // Combine into full prompt
  return `${appearance} ${attire} ${scene}, highly detailed, professional photography, soft lighting, sharp focus`;
}

/**
 * Check model parameter support using actual metadata
 * 
 * Returns detailed support info rather than just boolean "known"
 * This lets us send exactly the params each model supports
 */
function getModelParamSupport(modelId: string): {
  known: boolean;
  supportsSteps: boolean;
  supportsGuidanceScale: boolean;
  supportsNegativePrompt: boolean;
  supportsSeed: boolean;
} {
  const meta = IMAGE_MODEL_METADATA[modelId];
  
  // If we have metadata, use the actual flags
  if (meta) {
    return {
      known: true,
      supportsSteps: meta.supportsSteps ?? false,
      supportsGuidanceScale: meta.supportsGuidanceScale ?? false,
      supportsNegativePrompt: meta.supportsNegativePrompt ?? false,
      supportsSeed: meta.supportsSeed ?? false,
    };
  }
  
  // No metadata - use MINIMUM VIABLE PAYLOAD (none of the optional params)
  return {
    known: false,
    supportsSteps: false,
    supportsGuidanceScale: false,
    supportsNegativePrompt: false,
    supportsSeed: false,
  };
}

/**
 * Generate an image using Together.ai
 * 
 * DEFENSIVE PARAMETER FILTERING:
 * - ONLY Together.ai models with metadata in IMAGE_MODEL_METADATA are supported
 * - Uses model metadata to determine which params are supported
 * - Models with supportsSteps: false won't get steps param
 * - Models with supportsGuidanceScale: false won't get guidance_scale
 * - This prevents "Parameter 'X' is not supported" errors
 * 
 * Based on ~800 API calls testing all Together.ai models (Nov 2025)
 */
export async function generateImage(
  options: ImageGenerationOptions
): Promise<GeneratedImage> {
  const togetherKey = getAPIKey('together');
  if (!togetherKey) {
    throw new Error('Together.ai API key required. Add it in Settings.');
  }
  
  const character = getActiveCharacter();
  const model = options.model || getDefaultImageModel();
  const modelConfig = getImageModelMetadata(model);
  const paramSupport = getModelParamSupport(model);
  
  // ENFORCE: Only Together.ai models with metadata are supported
  if (!modelConfig) {
    throw new Error(
      `Unsupported image model: ${model}. ` +
      `Only Together.ai models with metadata are supported. ` +
      `Check models.ts IMAGE_MODEL_METADATA for the full list.`
    );
  }
  
  // Build prompt
  let prompt = options.prompt;
  if (options.isSelfie) {
    prompt = buildSelfiePrompt(character, options.selfieScene || options.prompt);
  }
  
  // ============================================================================
  // MINIMUM VIABLE PAYLOAD - Always start with just model + prompt
  // ============================================================================
  const requestBody: Record<string, any> = {
    model,
    prompt,
    n: 1,
    response_format: 'b64_json',
  };
  
  // ============================================================================
  // OPTIONAL PARAMETERS - Only add if model metadata says it's supported
  // ============================================================================
  
  // Width/Height - Generally safe to include (most models support these)
  const width = options.width || modelConfig?.defaultWidth || 1024;
  const height = options.height || modelConfig?.defaultHeight || 1024;
  requestBody.width = width;
  requestBody.height = height;
  
  // Steps - ONLY send if model supports it (supportsSteps: true)
  if (paramSupport.supportsSteps && modelConfig?.stepRange) {
    const steps = options.steps || modelConfig.defaultSteps || 4;
    const validatedSteps = Math.min(
      Math.max(steps, modelConfig.stepRange.min), 
      modelConfig.stepRange.max
    );
    requestBody.steps = validatedSteps;
  }
  // If supportsSteps: false, DON'T send steps - let API use defaults
  
  // Guidance Scale - ONLY send if model supports it (supportsGuidanceScale: true)
  if (paramSupport.supportsGuidanceScale && modelConfig?.guidanceScaleRange && modelConfig.defaultGuidanceScale !== null) {
    const guidanceScale = options.guidanceScale || modelConfig.defaultGuidanceScale;
    if (guidanceScale !== undefined) {
      const validatedGuidance = Math.min(
        Math.max(guidanceScale, modelConfig.guidanceScaleRange.min),
        modelConfig.guidanceScaleRange.max
      );
      requestBody.guidance_scale = validatedGuidance;
    }
  }
  // If supportsGuidanceScale: false, DON'T send guidance_scale
  
  // Negative Prompt - ONLY send if model supports it
  if (paramSupport.supportsNegativePrompt) {
    const negativePrompt = options.negativePrompt || character.negativePrompt;
    if (negativePrompt) {
      requestBody.negative_prompt = negativePrompt;
    }
  }
  // If supportsNegativePrompt: false, DON'T send it
  
  // Seed - ONLY send if model supports it
  if (paramSupport.supportsSeed && options.seed !== undefined) {
    requestBody.seed = options.seed;
  }
  // If supportsSeed: false, DON'T send seed
  
  // Log what we're sending (helpful for debugging)
  console.log(`[Image Gen] Model: ${model}, Known: ${paramSupport.known}, Params: ${Object.keys(requestBody).join(', ')}`);
  
  // ============================================================================
  // API CALL
  // ============================================================================
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
  
  // Generate metadata for signing with full context
  const metadata = await generateMetadata({
    contentType: 'image',
    prompt,
    model,
    width,
    height,
    steps: requestBody.steps,
    guidanceScale: requestBody.guidance_scale,
    negativePrompt: requestBody.negative_prompt,
    seed: options.seed,
    generationType: options.isSelfie ? 'selfie' : 'custom',
    userRequest: options.selfieScene || options.prompt,
    includeFullPrompt: true, // Store full prompt for provenance
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
 * AGENTIC CHARACTER IMAGE GENERATION - The AI decides the scene based on mood and persona
 * 
 * ARCHITECTURE CLARIFICATION:
 * - This function does TWO API calls: (1) LLM for scene decision, (2) Image generation
 * - The "selfie" term is legacy - this is really "agentic character-centric image"
 * - The AI contextually inserts the character into a scene, NOT prompting for "selfie"!
 * 
 * Workflow:
 * 1. User provides optional scene suggestion
 * 2. LLM (with character persona + mood) DECIDES the actual scene/attire contextually
 * 3. AI's contextual scene description goes to image generation model via generateImage()
 * 4. Result is character-authentic, mood-influenced, using SAME endpoint as custom mode
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
  
  // STEP 3: Generate the image with full context metadata
  const image = await generateImage({
    prompt: finalPrompt,
    model: options.model,
    isSelfie: true,
    selfieScene: sceneDescription,
  });
  
  // Update metadata to include AI decision and conversation context
  if (image.signedContent.metadata) {
    image.signedContent.metadata.generationType = 'agentic';
    image.signedContent.metadata.aiDecision = aiDecision;
    image.signedContent.metadata.userRequest = options.sceneSuggestion;
    image.signedContent.metadata.conversationContext = options.conversationContext;
    // Re-serialize metadata JSON
    image.signedContent.metadataJson = JSON.stringify(image.signedContent.metadata);
  }
  
  return {
    image,
    aiSceneDecision: sceneDescription,
    attireOverride,
  };
}

/**
 * FULLY AUTONOMOUS SELFIE AGENT
 * 
 * The LLM has complete control:
 * - Selects image generation model based on desired aesthetic
 * - Chooses all parameters (steps, guidance, etc.)
 * - Decides scene based on conversation context and memories
 * - User just triggers it - all decisions are AI-made
 * 
 * This creates "entropic" selfies where each one is unique and context-aware
 */
export async function generateAutonomousSelfie(options: {
  conversationContext?: string;
  character?: Character;
  moodState?: MoodState | null;
}): Promise<AgenticSelfieResult> {
  const togetherKey = getAPIKey('together');
  if (!togetherKey) {
    throw new Error('Together.ai API key required. Add it in Settings.');
  }
  
  const character = options.character || getActiveCharacter();
  
  // Build autonomous decision prompt
  const systemPrompt = `You are ${character.name}. You're about to take a selfie, and you have COMPLETE CREATIVE CONTROL.

Your physical appearance (always use verbatim):
${character.descriptionFirstPerson || character.descriptionSafe}

${character.attireFirstPerson || character.attire}

# YOUR TASK:
1. Review the conversation context and your current mood
2. Choose the PERFECT image generation model for the aesthetic you want
3. Decide on the scene/setting that reflects the conversation or your mood
4. Specify any special attire if you want to change from your default

# AVAILABLE MODELS:
${Object.entries(IMAGE_MODEL_METADATA).map(([id, meta]) => 
  `- ${id}: ${meta.displayName} (${meta.description || 'general purpose'})`
).join('\n')}

# RESPONSE FORMAT:
MODEL: [chosen model ID]
SCENE: [your scene description - be creative and context-aware]
ATTIRE: [optional - only if you want to change from default]

Make it personal, make it relevant to our conversation. Be entropic - surprise me!`;

  // Build context
  let contextParts: string[] = [];
  
  if (options.moodState) {
    const emotionalContext = getMoodEmotionalContext(options.moodState, character.name);
    if (emotionalContext) {
      contextParts.push(`**My Current Mood:**\n${emotionalContext}`);
    }
  }
  
  if (options.conversationContext) {
    contextParts.push(`**What We've Been Talking About:**\n${options.conversationContext}`);
  }
  
  const userMessage = contextParts.length > 0 
    ? contextParts.join('\n\n')
    : 'Generate a selfie that shows who you are right now.';
  
  // Let AI decide everything
  const aiResponse = await chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ], {
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    maxTokens: 500,
  });
  
  const aiDecision = aiResponse.choices[0]?.message?.content || '';
  
  // Parse AI's decision
  const modelMatch = aiDecision.match(/MODEL:\s*(.+?)(?:\n|$)/i);
  const sceneMatch = aiDecision.match(/SCENE:\s*([\s\S]+?)(?:\n(?:ATTIRE:|MODEL:)|$)/i);
  const attireMatch = aiDecision.match(/ATTIRE:\s*(.+?)(?:\n|$)/i);
  
  const chosenModel = modelMatch?.[1]?.trim() || getDefaultImageModel();
  const sceneDescription = sceneMatch?.[1]?.trim() || 'a casual selfie with a warm smile';
  const attireOverride = attireMatch?.[1]?.trim();
  
  // Build final prompt
  const appearance = character.descriptionFirstPerson || character.descriptionSafe;
  const attire = attireOverride || character.attireFirstPerson || character.attire;
  const finalPrompt = `${appearance} ${attire} ${sceneDescription}, highly detailed, professional photography, soft lighting, sharp focus`;
  
  // Generate with AI's chosen settings
  const image = await generateImage({
    prompt: finalPrompt,
    model: chosenModel,
    isSelfie: true,
    selfieScene: sceneDescription,
  });
  
  // Update metadata
  if (image.signedContent.metadata) {
    image.signedContent.metadata.generationType = 'agentic';
    image.signedContent.metadata.aiDecision = `MODEL: ${chosenModel}\nSCENE: ${sceneDescription}${attireOverride ? `\nATTIRE: ${attireOverride}` : ''}`;
    image.signedContent.metadata.conversationContext = options.conversationContext;
    image.signedContent.metadataJson = JSON.stringify(image.signedContent.metadata);
  }
  
  return {
    image,
    aiSceneDecision: `I chose ${IMAGE_MODEL_METADATA[chosenModel]?.displayName || chosenModel} for this scene: ${sceneDescription}`,
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
  seed?: number;
  
  // Selfie mode
  isSelfie?: boolean;
  selfieScene?: string;
  
  // Progress callback for polling
  onProgress?: (status: string, attempt: number) => void;
}

export interface GeneratedVideo {
  url: string;
  prompt: string;
  model: string;
  duration: number;
  resolution: string;
}

/**
 * Generate a video using Together.ai with ASYNC POLLING
 * 
 * CRITICAL: Video generation is ASYNCHRONOUS:
 * 1. POST to /v1/video/generations creates a JOB
 * 2. Returns job ID immediately
 * 3. Must poll GET /v1/video/generations/{job_id} until status = "completed"
 * 4. Job statuses: queued, in_progress, completed, failed, cancelled
 * 
 * Uses proper model metadata from models.ts - unsupported models rejected
 */
export async function generateVideo(
  options: VideoGenerationOptions
): Promise<GeneratedVideo> {
  const togetherKey = getAPIKey('together');
  if (!togetherKey) {
    throw new Error('Together.ai API key required. Add it in Settings.');
  }
  
  const model = options.model || getDefaultVideoModel();
  const modelConfig = getVideoModelMetadata(model);
  
  if (!modelConfig) {
    throw new Error(
      `Unsupported video model: ${model}. ` +
      `Only Together.ai models with metadata are supported. ` +
      `Check models.ts VIDEO_MODEL_METADATA for the full list.`
    );
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
  
  // Build API request body - only supported parameters per model metadata
  const requestBody: Record<string, any> = {
    model,
    prompt,
    width,
    height,
    seconds: duration, // Together.ai uses "seconds" not "duration"
  };
  
  // Add optional parameters ONLY if model supports them
  if (options.negativePrompt && modelConfig.parameterSupport.negative_prompt) {
    requestBody.negative_prompt = options.negativePrompt;
  }
  
  if (options.guidanceScale !== undefined && modelConfig.parameterSupport.guidance_scale) {
    requestBody.guidance_scale = options.guidanceScale;
  }
  
  if (options.seed !== undefined) {
    requestBody.seed = options.seed;
  }
  
  // Image-to-Video support (first frame)
  if (options.firstFrameImage && modelConfig.features.firstFrame) {
    requestBody.frame_images = [{
      input_image: options.firstFrameImage,
      frame: 0,
    }];
  }
  
  console.log(`[Video Gen] Creating job with model: ${model}`);
  
  // STEP 1: Create the video generation JOB
  const createResponse = await fetch('https://api.together.xyz/v1/video/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${togetherKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!createResponse.ok) {
    const error = await createResponse.json().catch(() => ({}));
    throw new Error(error.error?.message || `Video generation failed: ${createResponse.statusText}`);
  }
  
  const jobData = await createResponse.json();
  const jobId = jobData.id;
  
  if (!jobId) {
    throw new Error('No job ID received from video generation API');
  }
  
  console.log(`[Video Gen] Job created: ${jobId}`);
  
  // STEP 2: Poll for completion
  let attempts = 0;
  const maxAttempts = 120; // 10 minutes max (5 sec intervals)
  const pollInterval = 5000; // 5 seconds
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    attempts++;
    
    console.log(`[Video Gen] Polling job ${jobId} (attempt ${attempts}/${maxAttempts})`);
    
    const statusResponse = await fetch(`https://api.together.xyz/v1/video/generations/${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${togetherKey}`,
      },
    });
    
    if (!statusResponse.ok) {
      console.warn(`[Video Gen] Polling failed: ${statusResponse.statusText}`);
      continue; // Retry
    }
    
    const status = await statusResponse.json();
    
    console.log(`[Video Gen] Job status: ${status.status}`);
    
    // Call progress callback if provided
    if (options.onProgress) {
      options.onProgress(status.status, attempts);
    }
    
    if (status.status === 'completed') {
      const videoUrl = status.outputs?.video_url;
      if (!videoUrl) {
        throw new Error('Video completed but no URL received');
      }
      
      console.log(`[Video Gen] ✓ Video ready: ${videoUrl}`);
      
      return {
        url: videoUrl,
        prompt,
        model,
        duration,
        resolution,
      };
    } else if (status.status === 'failed') {
      const errorMsg = status.info?.errors || 'Video generation failed';
      throw new Error(`Video generation failed: ${errorMsg}`);
    } else if (status.status === 'cancelled') {
      throw new Error('Video generation was cancelled');
    }
    
    // Status is 'queued' or 'in_progress' - continue polling
  }
  
  throw new Error('Video generation timed out after 10 minutes');
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
  onProgress?: (status: string, attempt: number) => void;
}

export interface AgenticVideoResult {
  video: GeneratedVideo;
  aiSceneDecision: string;  // What the AI decided
  attireOverride?: string;  // If AI chose different attire
}

/**
 * AGENTIC CHARACTER VIDEO GENERATION - The AI decides the scene based on mood and persona
 * 
 * ARCHITECTURE CLARIFICATION:
 * - This function does TWO API calls: (1) LLM for scene decision, (2) Video generation
 * - Both selfie and custom modes use the SAME video generation endpoint
 * - The AI contextually creates a scene with the character, with cinematography
 * 
 * Workflow:
 * 1. User provides optional scene suggestion
 * 2. LLM (with character persona + mood) DECIDES the actual scene/attire/camera contextually
 * 3. AI's contextual scene description goes to video model via generateVideo()
 * 4. Result is character-authentic, mood-influenced, using SAME endpoint as custom mode
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
    onProgress: options.onProgress, // Pass through progress callback
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
 * Play audio blob
 */
export function playAudio(audioBlob: Blob): HTMLAudioElement {
  const url = URL.createObjectURL(audioBlob);
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  audio.play();
  return audio;
}

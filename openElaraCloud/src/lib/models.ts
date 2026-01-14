/**
 * Model Management for OpenElara Cloud
 * 
 * This file is responsible for fetching and managing the list of available AI models
 * from various providers. It consolidates them into a single, unified list for the
 * frontend to use.
 */
import { firebaseApp } from './firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

// ===========================================================================
// TYPES
// ===========================================================================

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
  supportsNegativePrompt: boolean;
  defaultGuidanceScale: number;
  guidanceScaleRange: { min: number; max: number };
  recommended?: boolean;
}

export interface ChatModelMetadata {
  displayName: string;
  description: string;
  supportsTools: boolean;
  contextLength?: number | null;
  recommended?: boolean;
}

export interface Model {
  id: string;
  provider: string; // e.g., 'vertex-ai', 'together-ai', 'openrouter'
  type: 'chat' | 'image';
  displayName?: string;
  metadata: ImageModelMetadata | ChatModelMetadata;
}

export type ModelType = 'chat' | 'image';

// ===========================================================================
// STATE MANAGEMENT
// ===========================================================================

let allModels: Model[] = [];
let lastFetchTimestamp: number = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// ===========================================================================
// DATA FETCHING
// ===========================================================================

/**
 * Fetches the consolidated list of models from the backend Firebase Function.
 * Implements caching to avoid redundant calls.
 */
async function fetchModels(): Promise<Model[]> {
  const now = Date.now();
  if (allModels.length > 0 && (now - lastFetchTimestamp) < CACHE_DURATION) {
    console.log("Returning cached models.");
    return allModels;
  }

  console.log("Fetching models from backend...");
  try {
    const functions = getFunctions(firebaseApp);
    const getModels = httpsCallable(functions, 'getModels');
    const response = await getModels();
    const models = (response.data as any).models as Model[];
    
    if (!Array.isArray(models)) {
        throw new Error("Invalid model data received from backend.");
    }

    allModels = models;
    lastFetchTimestamp = now;
    console.log("Successfully fetched and cached models:", allModels);
    return allModels;
  } catch (error) {
    console.error("Error fetching models:", error);
    // Return a default/fallback list in case of error
    return [
        {
            id: 'gemini-1.5-pro-preview-0409',
            provider: 'vertex-ai',
            type: 'chat',
            displayName: 'Gemini 1.5 Pro (Fallback)',
            metadata: {
              displayName: 'Gemini 1.5 Pro (Fallback)',
              description: 'Google\'s flagship multimodal model, with a 1 million token context window. (This is a fallback value)',
              supportsTools: true,
              contextLength: 1000000,
              recommended: true,
            },
          }
    ];
  }
}

// ===========================================================================
// PUBLIC API
// ===========================================================================

export async function getChatModels(): Promise<Model[]> {
  const models = await fetchModels();
  return models.filter(m => m.type === 'chat');
}

export async function getImageModels(): Promise<Model[]> {
  const models = await fetchModels();
  return models.filter(m => m.type === 'image');
}

export async function getRecommendedChatModels(): Promise<string[]> {
    const models = await getChatModels();
    return models.filter(m => m.metadata.recommended).map(m => m.id);
}
  
export async function getRecommendedImageModels(): Promise<string[]> {
    const models = await getImageModels();
    return models.filter(m => m.metadata.recommended).map(m => m.id);
}

export async function getDefaultChatModel(): Promise<string> {
    const recommended = await getRecommendedChatModels();
    const allChatModels = await getChatModels();
    return recommended[0] || (allChatModels.length > 0 ? allChatModels[0].id : 'gemini-1.5-pro-preview-0409');
}
  
export async function getDefaultImageModel(): Promise<string> {
    const recommended = await getRecommendedImageModels();
    const allImageModels = await getImageModels();
    return recommended[0] || (allImageModels.length > 0 ? allImageModels[0].id : 'imagegeneration@005');
}

export async function getModelById(modelId: string): Promise<Model | null> {
    const models = await fetchModels();
    return models.find(m => m.id === modelId) || null;
}

export async function getImageModelMetadata(modelId: string): Promise<ImageModelMetadata | null> {
  const model = await getModelById(modelId);
  return model && model.type === 'image' ? model.metadata as ImageModelMetadata : null;
}

export async function getChatModelMetadata(modelId: string): Promise<ChatModelMetadata | null> {
    const model = await getModelById(modelId);
    return model && model.type === 'chat' ? model.metadata as ChatModelMetadata : null;
}

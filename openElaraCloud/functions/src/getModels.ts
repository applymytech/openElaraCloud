
import { onCall } from 'firebase-functions/v2/https';
import fetch from 'node-fetch';

// Define a common model structure for the frontend
interface Model {
  id: string;
  provider: 'vertex-ai' | 'together-ai' | 'openrouter';
  type: 'chat' | 'image';
  displayName?: string;
  metadata: any; // Simplified for this example
}

// Static list of Vertex AI models
const VERTEX_AI_MODELS: Model[] = [
    {
        id: 'gemini-1.5-pro-preview-0409',
        provider: 'vertex-ai',
        type: 'chat',
        displayName: 'Gemini 1.5 Pro',
        metadata: {
          displayName: 'Gemini 1.5 Pro',
          description: 'Google\'s flagship multimodal model, with a 1 million token context window.',
          supportsTools: true,
          contextLength: 1000000,
          recommended: true,
        },
      },
      {
        id: 'imagegeneration@005',
        provider: 'vertex-ai',
        type: 'image',
        displayName: 'Imagen 2',
        metadata: {
          displayName: 'Imagen 2',
          description: 'Google\'s flagship image generation model for photorealistic and creative outputs.',
          defaultSteps: 20,
          stepRange: { min: 1, max: 40 },
          defaultWidth: 1536,
          defaultHeight: 1536,
          resolutionPresets: [
            { width: 1024, height: 1024, label: 'Square (1024x1024)' },
            { width: 1536, height: 1536, label: 'Square HD (1536x1536)' },
            { width: 1600, height: 1200, label: 'Landscape (4:3)' },
            { width: 1200, height: 1600, label: 'Portrait (3:4)' },
            { width: 1920, height: 1080, label: 'Widescreen (16:9)' },
          ],
          supportsNegativePrompt: true,
          defaultGuidanceScale: 7.5,
          guidanceScaleRange: { min: 0, max: 20 },
          recommended: true,
        },
      },
];

// Helper to fetch from Together.ai
async function getTogetherAIModels(apiKey: string): Promise<Model[]> {
    try {
        const response = await fetch('https://api.together.xyz/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) {
            console.error(`Together.ai API error: ${response.statusText}`);
            return [];
        }
        const data = await response.json() as any[];
        return data.map(model => ({
            id: model.id,
            provider: 'together-ai',
            type: model.type, // Assuming 'type' is in the response
            displayName: model.display_name,
            metadata: {
                displayName: model.display_name,
                description: model.description,
                // Add other relevant metadata
            }
        }));
    } catch (error) {
        console.error("Error fetching Together.ai models:", error);
        return [];
    }
}

// Helper to fetch from OpenRouter
async function getOpenRouterModels(apiKey: string): Promise<Model[]> {
    try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) {
            console.error(`OpenRouter API error: ${response.statusText}`);
            return [];
        }
        const { data } = await response.json() as { data: any[] };
        return data.map(model => ({
            id: model.id,
            provider: 'openrouter',
            type: 'chat', // OpenRouter primarily offers chat models
            displayName: model.name,
            metadata: {
                displayName: model.name,
                description: model.description,
                contextLength: model.context_length,
                // Add other relevant metadata
            }
        }));
    } catch (error) {
        console.error("Error fetching OpenRouter models:", error);
        return [];
    }
}


export const getModels = onCall(async (request) => {
    // In a real app, you'd use Google Secret Manager here
    const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

    let allModels: Model[] = [...VERTEX_AI_MODELS];

    if (TOGETHER_API_KEY) {
        const togetherModels = await getTogetherAIModels(TOGETHER_API_KEY);
        allModels = [...allModels, ...togetherModels];
    }

    if (OPENROUTER_API_KEY) {
        const openRouterModels = await getOpenRouterModels(OPENROUTER_API_KEY);
        allModels = [...allModels, ...openRouterModels];
    }

    return { models: allModels };
});

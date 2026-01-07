/**
 * OpenElara Cloud - API Client
 * 
 * Ported from desktop openElara architecture.
 * 
 * KEY DESIGN PRINCIPLES:
 * - Together.ai is the PRIMARY provider (chat, images, video, TTS)
 * - Other providers use OpenAI-compatible REST API
 * - Models are identified by provider from the model ID itself
 * - BYOK (Bring Your Own Key) - users store keys in localStorage
 * 
 * The desktop app routes like this:
 * - Together.ai models → Together.ai API
 * - OpenRouter models → OpenRouter API (OpenAI-compatible)
 * - Custom providers → Any OpenAI-compatible endpoint
 * - Local LLM → Ollama/LM Studio (not applicable for cloud)
 */

import { getAPIKey, hasOwnKeys, type APIKeys } from './byok';
import { getDefaultChatModel, getDefaultImageModel, getSelectedModel, CHAT_MODEL_METADATA, IMAGE_MODEL_METADATA } from './models';
import { calculateMaxTokens, estimateTokens } from './tokenBudget';

// ============================================================================
// TYPES
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ModelConfig {
  modelId: string;
  provider: 'together' | 'openrouter';
  displayName?: string;
}

export interface ChatPayload {
  messages: ChatMessage[];
  modelConfig: ModelConfig;
  temperature?: number;
  maxTokens?: number;
  ragContext?: string;
}

export interface ChatResponse {
  success: boolean;
  answer?: string;
  thinking?: string;
  error?: string;
  toolCalls?: ToolCall[];
  emotionalState?: ExtractedEmotionalState | null; // Extracted emotional state for RAG tracking
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ImagePayload {
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  steps?: number;
  negativePrompt?: string;
  seed?: number;
  guidanceScale?: number;
}

export interface ImageResponse {
  success: boolean;
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  error?: string;
}

// ============================================================================
// THINKING TAG EXTRACTION (from desktop)
// ============================================================================

function extractThinkingForModal(content: string | null): string {
  if (!content || typeof content !== 'string') return '';
  const thinkingMatch = content.match(/<thinking>([\s\S]*?)<\/thinking>/i);
  return thinkingMatch ? thinkingMatch[1].trim() : '';
}

/**
 * Extract emotional state log from LLM response (for RAG storage, NOT rendering)
 * Matches patterns like:
 * - "My current emotional state as Elara: GOOD, ENGAGED 💜"
 * - "[EMOTIONAL STATE: happy, engaged]"
 * - "Emotional state: content, curious"
 */
export interface ExtractedEmotionalState {
  rawLog: string;
  mood?: string;
  description?: string;
}

function extractEmotionalState(content: string | null): ExtractedEmotionalState | null {
  if (!content || typeof content !== 'string') return null;
  
  // Pattern 1: "My current emotional state as [Name]: STATE"
  const pattern1 = /My current emotional state as \w+:\s*([^\n]+)/i;
  // Pattern 2: "[EMOTIONAL STATE: ...]" or "(EMOTIONAL STATE: ...)"
  const pattern2 = /[\[\(]EMOTIONAL\s*STATE[:\s]+([^\]\)]+)[\]\)]/i;
  // Pattern 3: "Emotional state:" at start of line
  const pattern3 = /^Emotional\s*state[:\s]+([^\n]+)/im;
  // Pattern 4: Mood level patterns like "Mood level: 75/100"
  const pattern4 = /Mood\s*level[:\s]+\d+\/\d+[^\n]*/gi;
  // Pattern 5: Internal system markers
  const pattern5 = /═+[\s\S]*?EMOTIONAL STATE[\s\S]*?═+/gi;
  
  let match = content.match(pattern1) || content.match(pattern2) || content.match(pattern3);
  
  if (match) {
    return {
      rawLog: match[0],
      description: match[1]?.trim(),
    };
  }
  
  // Check for system marker patterns
  const systemMatch = content.match(pattern5);
  if (systemMatch) {
    return {
      rawLog: systemMatch[0],
    };
  }
  
  return null;
}

/**
 * Remove emotional state logs from content before rendering
 * These are for internal RAG/mood tracking only, not for user display
 */
function stripEmotionalStateLogs(content: string | null): string {
  if (!content || typeof content !== 'string') return content || '';
  
  let cleaned = content;
  
  // Remove "My current emotional state as [Name]: ..." lines
  cleaned = cleaned.replace(/My current emotional state as \w+:[^\n]*\n?/gi, '');
  
  // Remove "[EMOTIONAL STATE: ...]" or "(EMOTIONAL STATE: ...)"
  cleaned = cleaned.replace(/[\[\(]EMOTIONAL\s*STATE[:\s]+[^\]\)]+[\]\)]\s*\n?/gi, '');
  
  // Remove "Emotional state:" lines
  cleaned = cleaned.replace(/^Emotional\s*state[:\s]+[^\n]*\n?/gim, '');
  
  // Remove "Mood level: X/100" lines
  cleaned = cleaned.replace(/Mood\s*level[:\s]+\d+\/\d+[^\n]*\n?/gi, '');
  
  // Remove system emotional state blocks (the fancy boxed ones)
  cleaned = cleaned.replace(/═+[\s\S]*?EMOTIONAL STATE[\s\S]*?═+\s*\n?/gi, '');
  cleaned = cleaned.replace(/─+[\s\S]*?EMOTIONAL STATE[\s\S]*?─+\s*\n?/gi, '');
  
  // Remove leading/trailing whitespace and normalize multiple newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  
  return cleaned;
}

function extractResponseForChat(content: string | null): string {
  if (!content || typeof content !== 'string') return content || '';
  
  // Remove ALL thinking content FIRST (can appear anywhere)
  let cleaned = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
  
  // Remove emotional state logs (for RAG only, not display)
  cleaned = stripEmotionalStateLogs(cleaned);
  
  // Check for <response> tags
  const responseMatch = cleaned.match(/<response>([\s\S]*?)<\/response>/i);
  if (responseMatch) {
    return responseMatch[1].trim();
  }
  
  return cleaned || content;
}

function extractAndCleanThought(content: string | null): { 
  cleanedAnswer: string; 
  extractedThinking: string;
  emotionalState: ExtractedEmotionalState | null;
} {
  return {
    cleanedAnswer: extractResponseForChat(content),
    extractedThinking: extractThinkingForModal(content),
    emotionalState: extractEmotionalState(content),
  };
}

// ============================================================================
// PROVIDER DETECTION (from desktop routeApiCall)
// ============================================================================

/**
 * Detect provider from model ID or explicit provider setting
 * 
 * SUPPORTED PROVIDERS (matching desktop app):
 * - together: Together.ai - Primary provider for chat, images, video, TTS
 * - openrouter: OpenRouter - Chat routing to 300+ models (50+ free)
 * 
 * Note: OpenAI/Anthropic models are accessed THROUGH OpenRouter, not directly.
 * This matches the desktop app's architecture.
 */
export function detectProvider(modelId: string, explicitProvider?: string): 'together' | 'openrouter' {
  const normalized = (explicitProvider || modelId).toLowerCase();
  
  // OpenRouter - explicit or models accessed via router
  if (normalized.includes('openrouter') || 
      normalized.includes('open router') ||
      modelId.startsWith('openai/') ||       // OpenAI via OpenRouter
      modelId.startsWith('anthropic/') ||    // Anthropic via OpenRouter
      modelId.startsWith('google/gemini')) { // Gemini via OpenRouter
    return 'openrouter';
  }
  
  // Together.ai models - the primary provider
  // Includes: Llama, DeepSeek, Qwen, Mistral, FLUX, etc.
  if (normalized.includes('together') ||
      modelId.startsWith('meta-llama/') ||
      modelId.startsWith('mistralai/') ||
      modelId.startsWith('Qwen/') ||
      modelId.startsWith('deepseek-ai/') ||
      modelId.startsWith('google/') ||
      modelId.startsWith('black-forest-labs/') ||
      modelId.includes('Llama') ||
      modelId.includes('Mixtral') ||
      modelId.includes('-Free') || 
      modelId.includes('Turbo-Free')) {
    return 'together';
  }
  
  // Default to together (the primary provider)
  return 'together';
}

// ============================================================================
// TOGETHER.AI API (Primary Provider)
// ============================================================================

async function chatWithTogether(
  apiKey: string,
  payload: ChatPayload
): Promise<ChatResponse> {
  try {
    // Calculate max_tokens dynamically based on model context window and token mode
    const inputTokens = estimateTokens(JSON.stringify(payload.messages));
    const maxTokens = payload.maxTokens ?? calculateMaxTokens(payload.modelConfig.modelId, inputTokens);
    
    const requestBody: Record<string, unknown> = {
      model: payload.modelConfig.modelId,
      messages: payload.messages,
      temperature: payload.temperature ?? 0.7,
    };
    
    // Only set max_tokens if explicitly provided or in standard mode
    // FULLY_AUTO and SEMI_AUTO modes return null - let model decide
    if (maxTokens !== null) {
      requestBody.max_tokens = maxTokens;
    }
    
    console.log(`[Together] Sending request to model: ${payload.modelConfig.modelId} (max_tokens: ${maxTokens ?? 'unrestricted'})`);
    
    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Request-ID': `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 429) {
        return { success: false, error: 'Together.ai rate limit exceeded. Please wait a moment.' };
      }
      // Model not found/available - provide honest error
      if (response.status === 404) {
        return { 
          success: false, 
          error: `Model "${payload.modelConfig.modelId}" is not available. Please select a different model in Settings.` 
        };
      }
      // Model quota/billing issue
      if (response.status === 402 || response.status === 403) {
        return { 
          success: false, 
          error: `Access denied for model "${payload.modelConfig.modelId}". This model may require a paid API key or have billing restrictions.` 
        };
      }
      return { 
        success: false, 
        error: `Together.ai API Error: ${errorData.error?.message || response.statusText}` 
      };
    }
    
    const data = await response.json();
    const choice = data.choices?.[0];
    const rawContent = choice?.message?.content;
    
    const { cleanedAnswer, extractedThinking, emotionalState } = extractAndCleanThought(rawContent);
    
    return {
      success: true,
      answer: cleanedAnswer,
      thinking: extractedThinking,
      emotionalState,
      usage: data.usage,
    };
  } catch (error: any) {
    console.error('[Together] Request failed:', error);
    return { success: false, error: `Together.ai Error: ${error.message}` };
  }
}

// ============================================================================
// OPENROUTER API (OpenAI-Compatible)
// ============================================================================

async function chatWithOpenRouter(
  apiKey: string,
  payload: ChatPayload
): Promise<ChatResponse> {
  try {
    // Calculate max_tokens dynamically based on model context window and token mode
    const inputTokens = estimateTokens(JSON.stringify(payload.messages));
    const maxTokens = payload.maxTokens ?? calculateMaxTokens(payload.modelConfig.modelId, inputTokens);
    
    const requestBody: Record<string, unknown> = {
      model: payload.modelConfig.modelId,
      messages: payload.messages,
      temperature: payload.temperature ?? 0.7,
    };
    
    // Only set max_tokens if explicitly provided or in standard mode
    // FULLY_AUTO and SEMI_AUTO modes return null - let model decide
    if (maxTokens !== null) {
      requestBody.max_tokens = maxTokens;
    }
    
    console.log(`[OpenRouter] Sending request to model: ${payload.modelConfig.modelId} (max_tokens: ${maxTokens ?? 'unrestricted'})`);
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://openelara.ai',
        'X-Title': 'OpenElara Cloud',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 429) {
        const guiltyProvider = errorData.error?.metadata?.provider_name || 'Unknown';
        return { 
          success: false, 
          error: `OpenRouter rate limit from provider: ${guiltyProvider}. Consider blocking this provider.` 
        };
      }
      return { 
        success: false, 
        error: `OpenRouter API Error: ${errorData.error?.message || response.statusText}` 
      };
    }
    
    const data = await response.json();
    const choice = data.choices?.[0];
    const rawContent = choice?.message?.content;
    
    const { cleanedAnswer, extractedThinking, emotionalState } = extractAndCleanThought(rawContent);
    
    return {
      success: true,
      answer: cleanedAnswer,
      thinking: extractedThinking,
      emotionalState,
      usage: data.usage,
    };
  } catch (error: any) {
    console.error('[OpenRouter] Request failed:', error);
    return { success: false, error: `OpenRouter Error: ${error.message}` };
  }
}

// ============================================================================
// OPENAI-STYLE API (Generic OpenAI-Compatible)
// ============================================================================

async function chatWithOpenAIStyle(
  apiKey: string,
  endpoint: string,
  payload: ChatPayload,
  extraHeaders?: Record<string, string>
): Promise<ChatResponse> {
  try {
    // Calculate max_tokens dynamically based on model context window and token mode
    const inputTokens = estimateTokens(JSON.stringify(payload.messages));
    const maxTokens = payload.maxTokens ?? calculateMaxTokens(payload.modelConfig.modelId, inputTokens);
    
    const requestBody: Record<string, unknown> = {
      model: payload.modelConfig.modelId,
      messages: payload.messages,
      temperature: payload.temperature ?? 0.7,
    };
    
    // Only set max_tokens if explicitly provided or in standard mode
    // FULLY_AUTO and SEMI_AUTO modes return null - let model decide
    if (maxTokens !== null) {
      requestBody.max_tokens = maxTokens;
    }
    
    console.log(`[OpenAI-Style] Sending request to ${endpoint} model: ${payload.modelConfig.modelId} (max_tokens: ${maxTokens ?? 'unrestricted'})`);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 429) {
        return { success: false, error: 'API rate limit exceeded. Please wait a moment.' };
      }
      // Model not found/available - provide honest error
      if (response.status === 404) {
        return { 
          success: false, 
          error: `Model "${payload.modelConfig.modelId}" is not available. Please select a different model in Settings.` 
        };
      }
      return { 
        success: false, 
        error: `API Error: ${errorData.error?.message || response.statusText}` 
      };
    }
    
    const data = await response.json();
    const choice = data.choices?.[0];
    const rawContent = choice?.message?.content;
    
    const { cleanedAnswer, extractedThinking, emotionalState } = extractAndCleanThought(rawContent);
    
    return {
      success: true,
      answer: cleanedAnswer,
      thinking: extractedThinking,
      emotionalState,
      usage: data.usage,
    };
  } catch (error: any) {
    console.error('[OpenAI-Style] Request failed:', error);
    return { success: false, error: `API Error: ${error.message}` };
  }
}

// ============================================================================
// MAIN ROUTER (from desktop routeApiCall)
// ============================================================================

/**
 * Route API call to appropriate provider
 * 
 * This mimics the desktop's routeApiCall function:
 * - Detects provider from model ID
 * - Gets appropriate API key
 * - Calls the right handler
 */
export async function routeChat(payload: ChatPayload): Promise<ChatResponse> {
  const provider = payload.modelConfig.provider || detectProvider(payload.modelConfig.modelId);
  
  console.log(`[API Route] Routing to provider: ${provider}`);
  
  switch (provider) {
    case 'together': {
      const apiKey = getAPIKey('together');
      if (!apiKey) {
        return { success: false, error: 'Together.ai API key not configured. Add it in Settings.' };
      }
      return chatWithTogether(apiKey, payload);
    }
    
    case 'openrouter': {
      const apiKey = getAPIKey('openrouter');
      if (!apiKey) {
        return { success: false, error: 'OpenRouter API key not configured. Add it in Settings.' };
      }
      return chatWithOpenRouter(apiKey, payload);
    }
    
    default: {
      // Try together first, then openrouter
      const togetherKey = getAPIKey('together');
      if (togetherKey) {
        return chatWithTogether(togetherKey, payload);
      }
      
      const openrouterKey = getAPIKey('openrouter');
      if (openrouterKey) {
        return chatWithOpenRouter(openrouterKey, payload);
      }
      
      return { success: false, error: 'No API key configured. Add Together.ai or OpenRouter key in Settings.' };
    }
  }
}

// ============================================================================
// IMAGE GENERATION (Together.ai Primary)
// ============================================================================

/**
 * Generate image using Together.ai
 * 
 * Together.ai is the primary provider for image generation (FLUX models)
 * Uses user-selected model or defaults to free tier
 */
export async function generateImage(payload: ImagePayload): Promise<ImageResponse> {
  const apiKey = getAPIKey('together');
  if (!apiKey) {
    return { success: false, error: 'Together.ai API key required for image generation. Add it in Settings.' };
  }
  
  // Get the model: explicit > user selection > default (free tier)
  const modelId = payload.model || getDefaultImageModel();
  const modelMeta = IMAGE_MODEL_METADATA[modelId];
  
  const requestBody: Record<string, unknown> = {
    model: modelId,
    prompt: payload.prompt,
    width: payload.width || modelMeta?.defaultWidth || 1024,
    height: payload.height || modelMeta?.defaultHeight || 1024,
    steps: payload.steps || modelMeta?.defaultSteps || 4,
    n: 1,
    response_format: 'b64_json',
  };
  
  // Add optional parameters if supported by model
  if (payload.negativePrompt && modelMeta?.supportsNegativePrompt !== false) {
    requestBody.negative_prompt = payload.negativePrompt;
  }
  if (payload.seed !== undefined) {
    requestBody.seed = payload.seed;
  }
  if (payload.guidanceScale !== undefined) {
    requestBody.guidance = payload.guidanceScale;
  } else if (modelMeta?.defaultGuidanceScale) {
    requestBody.guidance = modelMeta.defaultGuidanceScale;
  }
  
  console.log(`[Together Image] Generating with model: ${modelId}`);
  console.log(`[Together Image] Settings: ${requestBody.width}x${requestBody.height}, ${requestBody.steps} steps`);
  
  try {
    const response = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        success: false, 
        error: `Image generation failed: ${errorData.error?.message || response.statusText}` 
      };
    }
    
    const data = await response.json();
    return {
      success: true,
      data: data.data,
    };
  } catch (error: any) {
    console.error('[Together Image] Generation failed:', error);
    return { success: false, error: `Image generation error: ${error.message}` };
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export { hasOwnKeys, getAPIKey, getAllAPIKeys } from './byok';

/**
 * Simple chat function for backwards compatibility
 * 
 * Uses the model selection from localStorage (via models.ts)
 * or falls back to a known-good default model
 * 
 * Returns both the answer and thinking (for display in thinking modal)
 */
export async function chat(
  messages: ChatMessage[],
  options: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<{ 
  choices: Array<{ message: { role: string; content: string; thinking?: string } }>;
  thinking?: string;
}> {
  // Get the model: explicit > user selection > default
  const modelId = options.model || getDefaultChatModel();
  const provider = detectProvider(modelId);
  
  console.log(`[Chat] Using model: ${modelId} (provider: ${provider})`);
  
  const payload: ChatPayload = {
    messages,
    modelConfig: {
      modelId,
      provider,
    },
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  };
  
  const result = await routeChat(payload);
  
  if (!result.success) {
    throw new Error(result.error || 'Chat failed');
  }
  
  // Return in OpenAI-compatible format with thinking preserved
  return {
    choices: [{
      message: {
        role: 'assistant',
        content: result.answer || '',
        thinking: result.thinking,
      },
    }],
    thinking: result.thinking,
  };
}

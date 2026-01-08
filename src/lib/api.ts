/**
 * API Client for OpenElara Cloud
 * 
 * ARCHITECTURE (from desktop openElara):
 * - Together.ai is the PRIMARY provider (chat, images, video, TTS)
 * - Other providers use OpenAI-compatible REST API
 * - Models are routed by provider detection from model ID
 * - BYOK (Bring Your Own Key) - users store keys in localStorage
 * 
 * This file re-exports the main API functions from apiClient.ts
 * and provides backwards-compatible interfaces.
 */

// Re-export everything from the main API client
export {
  // Types
  type ChatMessage,
  type ChatPayload,
  type ChatResponse,
  type ImagePayload,
  type ImageResponse,
  type ModelConfig,
  type ContentPart,
  type ToolCall,
  type ExtractedEmotionalState,
  type Tool,
  
  // Functions
  chat,
  routeChat,
  generateImage,
  detectProvider,
  hasOwnKeys,
  getAPIKey,
  getAllAPIKeys,
} from './apiClient';

import { hasOwnKeys } from './byok';

/**
 * Check if BYOK mode is active (user has their own keys)
 */
export function isBYOKMode(): boolean {
  return hasOwnKeys();
}

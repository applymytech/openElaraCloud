/**
 * BYOK (Bring Your Own Key) - Local API Key Storage
 * 
 * Ported from desktop openElara.
 * 
 * Keys are stored in localStorage (browser) - NEVER sent to server.
 * The Same-Origin Policy protects localStorage from other websites.
 * 
 * In the desktop app, keys are encrypted with Electron's safeStorage.
 * In the cloud app, they're in localStorage which is inherently per-origin.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const KEY_PREFIX = 'elara_apikey_';

// ============================================================================
// TYPES
// ============================================================================

export interface APIKeys {
  together?: string;
  openrouter?: string;
  elevenlabs?: string;
  openai?: string;
  anthropic?: string;
  exa?: string;
}

export type APIKeyProvider = keyof APIKeys;

// ============================================================================
// KEY MANAGEMENT
// ============================================================================

/**
 * Save an API key to localStorage
 */
export function saveAPIKey(provider: APIKeyProvider, key: string): void {
  if (typeof window === 'undefined') return;
  if (key.trim()) {
    localStorage.setItem(`${KEY_PREFIX}${provider}`, key.trim());
  } else {
    localStorage.removeItem(`${KEY_PREFIX}${provider}`);
  }
}

/**
 * Get an API key from localStorage
 */
export function getAPIKey(provider: APIKeyProvider): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(`${KEY_PREFIX}${provider}`);
}

/**
 * Remove an API key from localStorage
 */
export function removeAPIKey(provider: APIKeyProvider): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`${KEY_PREFIX}${provider}`);
}

/**
 * Get all stored API keys
 */
export function getAllAPIKeys(): APIKeys {
  if (typeof window === 'undefined') return {};
  
  const keys: APIKeys = {};
  const providers: APIKeyProvider[] = ['together', 'openrouter', 'elevenlabs', 'openai', 'anthropic', 'exa'];
  
  for (const provider of providers) {
    const key = getAPIKey(provider);
    if (key) {
      keys[provider] = key;
    }
  }
  
  return keys;
}

/**
 * Check if user has any configured API keys
 */
export function hasOwnKeys(): boolean {
  const keys = getAllAPIKeys();
  // Together.ai is the primary provider - check it first
  return !!(keys.together || keys.openrouter || keys.openai || keys.anthropic);
}

/**
 * Check if user has Together.ai key (required for images/TTS)
 */
export function hasTogetherKey(): boolean {
  return !!getAPIKey('together');
}

/**
 * Check if user has a chat-capable key
 */
export function hasChatKey(): boolean {
  return hasOwnKeys();
}

/**
 * Clear all stored API keys
 */
export function clearAllKeys(): void {
  if (typeof window === 'undefined') return;
  
  const providers: APIKeyProvider[] = ['together', 'openrouter', 'elevenlabs', 'openai', 'anthropic', 'exa'];
  for (const provider of providers) {
    removeAPIKey(provider);
  }
}

/**
 * Check if user has Exa.ai key (for web search)
 */
export function hasExaKey(): boolean {
  return !!getAPIKey('exa');
}

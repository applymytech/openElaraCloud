/**
 * BYOK (Bring Your Own Key) - Local API Key Storage
 * 
 * Ported from desktop openElara.
 * 
 * Keys are stored in localStorage (browser) - NEVER sent to server.
 * The Same-Origin Policy protects localStorage from other websites.
 * 
 * Security Improvements (2026-01-08):
 * - Keys are now encrypted using Web Crypto API (AES-GCM-256)
 * - Encryption key derived from device fingerprint
 * - Still vulnerable to XSS, but protects against casual inspection
 * - Graceful fallback to base64 if crypto unavailable
 */

import { encryptKey, decryptKey, isCryptoAvailable } from './crypto';

// ============================================================================
// CONSTANTS
// ============================================================================

const KEY_PREFIX = 'elara_apikey_';
const CUSTOM_ENDPOINTS_KEY = 'elara_custom_endpoints';
const ACTIVE_ENDPOINT_KEY = 'elara_active_endpoint';

// ============================================================================
// TYPES
// ============================================================================

export interface APIKeys {
  together?: string;
  openrouter?: string;
  exa?: string;
}

export type APIKeyProvider = keyof APIKeys;

/**
 * CustomEndpoint - BYOEndpoint configuration
 * 
 * Allows users to ATTEMPT connecting to ANY chat LLM by providing endpoints.
 * 
 * ⚠️ DISCLAIMER: This only works if the endpoint follows OpenAI REST API standards.
 * No guarantees about any specific provider. Chat only - NOT for images/videos.
 * If it doesn't work, that's on the user to debug their endpoint.
 */
export interface CustomEndpoint {
  name: string;                  // User-friendly name (generic, e.g., "My Custom API")
  apiKey: string;                // API key (can be empty for some endpoints)
  baseUrl?: string;              // Base URL (e.g., https://api.example.com)
  modelsEndpoint?: string;       // Custom /models path (optional, rarely used)
  chatEndpoint?: string;         // Custom /chat/completions path (optional)
  customPayload?: string;        // JSON additions (e.g., '{"nsfw": true}')
  overridePayload?: boolean;     // If true, use payloadTemplate instead of standard
  payloadTemplate?: string;      // Full payload template with placeholders
  enabled?: boolean;             // Whether this endpoint is active
}

// ============================================================================
// KEY MANAGEMENT
// ============================================================================

/**
 * Save an API key to localStorage (encrypted)
 */
export async function saveAPIKey(provider: APIKeyProvider, key: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (key.trim()) {
    const encrypted = await encryptKey(key.trim());
    localStorage.setItem(`${KEY_PREFIX}${provider}`, encrypted);
  } else {
    localStorage.removeItem(`${KEY_PREFIX}${provider}`);
  }
}

/**
 * Save an API key synchronously (for legacy code)
 * Uses base64 fallback instead of proper encryption
 */
export function saveAPIKeySync(provider: APIKeyProvider, key: string): void {
  if (typeof window === 'undefined') return;
  if (key.trim()) {
    const encoded = btoa(key.trim());
    localStorage.setItem(`${KEY_PREFIX}${provider}`, encoded);
  } else {
    localStorage.removeItem(`${KEY_PREFIX}${provider}`);
  }
}

/**
 * Get an API key from localStorage (decrypted)
 */
export async function getAPIKey(provider: APIKeyProvider): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const encrypted = localStorage.getItem(`${KEY_PREFIX}${provider}`);
  if (!encrypted) return null;
  
  try {
    return await decryptKey(encrypted);
  } catch (error) {
    // If decryption fails, assume it's plain text (legacy)
    return encrypted;
  }
}

/**
 * Get an API key synchronously (for legacy code)
 * Attempts base64 decode, falls back to plain text
 */
export function getAPIKeySync(provider: APIKeyProvider): string | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(`${KEY_PREFIX}${provider}`);
  if (!stored) return null;
  
  try {
    return atob(stored);
  } catch {
    return stored;
  }
}

/**
 * Remove an API key from localStorage
 */
export function removeAPIKey(provider: APIKeyProvider): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`${KEY_PREFIX}${provider}`);
}

/**
 * Get all stored API keys (decrypted)
 */
export async function getAllAPIKeys(): Promise<APIKeys> {
  if (typeof window === 'undefined') return {};
  
  const keys: APIKeys = {};
  const providers: APIKeyProvider[] = ['together', 'openrouter', 'exa'];
  
  for (const provider of providers) {
    const key = await getAPIKey(provider);
    if (key) {
      keys[provider] = key;
    }
  }
  
  return keys;
}

/**
 * Get all stored API keys synchronously (for legacy code)
 */
export function getAllAPIKeysSync(): APIKeys {
  if (typeof window === 'undefined') return {};
  
  const keys: APIKeys = {};
  const providers: APIKeyProvider[] = ['together', 'openrouter', 'exa'];
  
  for (const provider of providers) {
    const key = getAPIKeySync(provider);
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
  const keys = getAllAPIKeysSync();
  // Together.ai is the primary provider, OpenRouter for chat routing
  return !!(keys.together || keys.openrouter);
}

/**
 * Check if user has Together.ai key (required for images/TTS)
 */
export function hasTogetherKey(): boolean {
  return !!getAPIKeySync('together');
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
  
  const providers: APIKeyProvider[] = ['together', 'openrouter', 'exa'];
  for (const provider of providers) {
    removeAPIKey(provider);
  }
}

/**
 * Check if user has Exa.ai key (for web search)
 */
export function hasExaKey(): boolean {
  return !!getAPIKeySync('exa');
}

// ============================================================================
// CUSTOM ENDPOINT MANAGEMENT (BYOEndpoint)
// ============================================================================

/**
 * Save a custom endpoint configuration
 */
export function saveCustomEndpoint(endpoint: CustomEndpoint): void {
  if (typeof window === 'undefined') return;
  
  const endpoints = getAllCustomEndpoints();
  const existingIndex = endpoints.findIndex(e => e.name === endpoint.name);
  
  if (existingIndex >= 0) {
    endpoints[existingIndex] = endpoint;
  } else {
    endpoints.push(endpoint);
  }
  
  localStorage.setItem(CUSTOM_ENDPOINTS_KEY, JSON.stringify(endpoints));
}

/**
 * Get a specific custom endpoint by name
 */
export function getCustomEndpoint(name: string): CustomEndpoint | null {
  if (typeof window === 'undefined') return null;
  
  const endpoints = getAllCustomEndpoints();
  return endpoints.find(e => e.name === name) || null;
}

/**
 * Get all custom endpoints
 */
export function getAllCustomEndpoints(): CustomEndpoint[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(CUSTOM_ENDPOINTS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('[BYOK] Failed to load custom endpoints:', error);
  }
  
  return [];
}

/**
 * Remove a custom endpoint
 */
export function removeCustomEndpoint(name: string): void {
  if (typeof window === 'undefined') return;
  
  const endpoints = getAllCustomEndpoints();
  const filtered = endpoints.filter(e => e.name !== name);
  
  localStorage.setItem(CUSTOM_ENDPOINTS_KEY, JSON.stringify(filtered));
  
  // If this was the active endpoint, clear it
  const active = getActiveEndpoint();
  if (active === name) {
    clearActiveEndpoint();
  }
}

/**
 * Set the active endpoint (provider name or custom endpoint name)
 */
export function setActiveEndpoint(name: 'together' | 'openrouter' | string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_ENDPOINT_KEY, name);
}

/**
 * Get the currently active endpoint
 * Returns 'together', 'openrouter', or a custom endpoint name
 */
export function getActiveEndpoint(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_ENDPOINT_KEY);
}

/**
 * Clear the active endpoint selection
 */
export function clearActiveEndpoint(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACTIVE_ENDPOINT_KEY);
}

/**
 * Check if a custom endpoint is configured and active
 */
export function hasCustomEndpoint(): boolean {
  const endpoints = getAllCustomEndpoints();
  return endpoints.some(e => e.enabled !== false);
}

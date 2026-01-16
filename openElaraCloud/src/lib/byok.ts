/**
 * Sovereign Key Management (v2.0)
 * 
 * Keys are stored securely in Google Secret Manager (Sovereign Vault).
 * This module handles the communication with the backend to store/verify keys.
 * 
 * NO SENSITIVE KEYS ARE STORED IN LOCALSTORAGE.
 */

import { app } from './firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(app);

/**
 * Saves an API key securely to the Sovereign Vault (Google Secret Manager).
 */
export async function saveAPIKeySecurely(provider: string, key: string): Promise<any> {
  const storeUserSecret = httpsCallable(functions, 'storeUserSecret');
  const result = await storeUserSecret({ service: provider, value: key });
  return result.data;
}

/**
 * Helper to check if a service is likely configured.
 * Since we can't read the keys back for security, we check for local 'existence' flags.
 */
export function markServiceConfigured(provider: string, status: boolean = true): void {
  if (typeof window === 'undefined') return;
  if (status) {
    localStorage.setItem(`elara_vault_status_${provider}`, 'configured');
  } else {
    localStorage.removeItem(`elara_vault_status_${provider}`);
  }
}

export function isServiceConfigured(provider: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(`elara_vault_status_${provider}`) === 'configured';
}

// Re-exporting compatible types and mock getters for backward compatibility
export interface APIKeys {
  together?: string;
  openrouter?: string;
  elevenlabs?: string;
  exa?: string;
  openai?: string;
  anthropic?: string;
}

export function getAPIKey(provider: string): string | null {
    // Return null to force system to use Secret Manager fallback
    return null; 
}

export function hasOwnKeys(): boolean {
    // Checks if any vault flags are set
    const providers = ['openai', 'anthropic', 'together', 'openrouter', 'exa', 'elevenlabs'];
    return providers.some(p => isServiceConfigured(p));
}

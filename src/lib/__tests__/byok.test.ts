/**
 * BYOK (Bring Your Own Key) Module Tests
 * 
 * Tests for API key storage, retrieval, and management
 * This is the core of the BYOK security system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
	saveAPIKey, 
	getAPIKey, 
	removeAPIKey, 
	getAllAPIKeys,
	getAPIKeySync,
	saveAPIKeySync,
	type APIKeyProvider,
} from '../byok';

describe('BYOK Module', () => {
	beforeEach(() => {
		// Clear localStorage before each test
		if (typeof window !== 'undefined' && window.localStorage) {
			window.localStorage.clear();
		}
	});

	describe('saveAPIKey & getAPIKey (async)', () => {
		it('should save and retrieve an API key', async () => {
			const provider: APIKeyProvider = 'together';
			const testKey = 'test-together-key-123';

			await saveAPIKey(provider, testKey);
			const retrieved = await getAPIKey(provider);

			expect(retrieved).toBe(testKey);
		});

		it('should return null for non-existent key', async () => {
			const retrieved = await getAPIKey('together');
			expect(retrieved).toBeNull();
		});

		it('should overwrite existing key', async () => {
			const provider: APIKeyProvider = 'openrouter';
			
			await saveAPIKey(provider, 'old-key');
			await saveAPIKey(provider, 'new-key');
			
			const retrieved = await getAPIKey(provider);
			expect(retrieved).toBe('new-key');
		});

		it('should handle empty string as removal', async () => {
			const provider: APIKeyProvider = 'exa';
			
			await saveAPIKey(provider, 'some-key');
			await saveAPIKey(provider, '   '); // Whitespace-only should be treated as empty
			
			const retrieved = await getAPIKey(provider);
			expect(retrieved).toBeNull();
		});

		it('should handle all supported providers', async () => {
			const providers: APIKeyProvider[] = ['together', 'openrouter', 'exa'];
			
			for (const provider of providers) {
				const testKey = `test-${provider}-key`;
				await saveAPIKey(provider, testKey);
				const retrieved = await getAPIKey(provider);
				expect(retrieved).toBe(testKey);
			}
		});

		it('should not leak keys between providers', async () => {
			await saveAPIKey('together', 'together-key');
			await saveAPIKey('openrouter', 'openrouter-key');
			
			const togetherKey = await getAPIKey('together');
			const openrouterKey = await getAPIKey('openrouter');
			
			expect(togetherKey).toBe('together-key');
			expect(openrouterKey).toBe('openrouter-key');
			expect(togetherKey).not.toBe(openrouterKey);
		});
	});

	describe('saveAPIKeySync & getAPIKeySync', () => {
		it('should save and retrieve synchronously', () => {
			const provider: APIKeyProvider = 'together';
			const testKey = 'sync-test-key';

			saveAPIKeySync(provider, testKey);
			const retrieved = getAPIKeySync(provider);

			expect(retrieved).toBe(testKey);
		});

		it('should return null for non-existent key', () => {
			const retrieved = getAPIKeySync('together');
			expect(retrieved).toBeNull();
		});

		it('should be compatible with async version', async () => {
			const provider: APIKeyProvider = 'openrouter';
			const testKey = 'compatibility-test';

			// Save with sync
			saveAPIKeySync(provider, testKey);
			
			// Retrieve with async
			const retrieved = await getAPIKey(provider);
			expect(retrieved).toBe(testKey);
		});
	});

	describe('removeAPIKey', () => {
		it('should remove an existing key', async () => {
			const provider: APIKeyProvider = 'exa';
			
			await saveAPIKey(provider, 'key-to-remove');
			expect(await getAPIKey(provider)).toBe('key-to-remove');
			
			removeAPIKey(provider);
			expect(await getAPIKey(provider)).toBeNull();
		});

		it('should not throw when removing non-existent key', () => {
			expect(() => removeAPIKey('together')).not.toThrow();
		});

		it('should only remove specified provider key', async () => {
			await saveAPIKey('together', 'together-key');
			await saveAPIKey('openrouter', 'openrouter-key');
			
			removeAPIKey('together');
			
			expect(await getAPIKey('together')).toBeNull();
			expect(await getAPIKey('openrouter')).toBe('openrouter-key');
		});
	});

	describe('getAllAPIKeys', () => {
		it('should return empty object when no keys stored', async () => {
			const keys = await getAllAPIKeys();
			expect(keys).toEqual({});
		});

		it('should return all stored keys', async () => {
			await saveAPIKey('together', 'together-key');
			await saveAPIKey('openrouter', 'openrouter-key');
			await saveAPIKey('exa', 'exa-key');
			
			const keys = await getAllAPIKeys();
			
			expect(keys.together).toBe('together-key');
			expect(keys.openrouter).toBe('openrouter-key');
			expect(keys.exa).toBe('exa-key');
		});

		it('should only return keys that exist', async () => {
			await saveAPIKey('together', 'together-key');
			// Don't set openrouter or exa
			
			const keys = await getAllAPIKeys();
			
			expect(keys.together).toBe('together-key');
			expect(keys.openrouter).toBeUndefined();
			expect(keys.exa).toBeUndefined();
		});
	});

	describe('Security Properties', () => {
		it('should not store keys in plaintext', async () => {
			const testKey = 'super-secret-key-123';
			await saveAPIKey('together', testKey);
			
			// Check what's actually in localStorage
			const stored = localStorage.getItem('elara_apikey_together');
			
			// Stored value should not be plaintext
			expect(stored).not.toBe(testKey);
		});

		it('should encrypt different keys differently', async () => {
			await saveAPIKey('together', 'key-one');
			await saveAPIKey('openrouter', 'key-two');
			
			const stored1 = localStorage.getItem('elara_apikey_together');
			const stored2 = localStorage.getItem('elara_apikey_openrouter');
			
			expect(stored1).not.toBe(stored2);
		});

		it('should handle sensitive characters safely', async () => {
			const sensitiveKey = "key-with-quotes'\"and<script>alert('xss')</script>";
			await saveAPIKey('together', sensitiveKey);
			
			const retrieved = await getAPIKey('together');
			expect(retrieved).toBe(sensitiveKey);
		});
	});

	describe('Real-World Scenarios', () => {
		it('should handle typical Together.ai key', async () => {
			const togetherKey = 'abc123def456ghi789jkl012mno345pqr678';
			await saveAPIKey('together', togetherKey);
			expect(await getAPIKey('together')).toBe(togetherKey);
		});

		it('should handle typical OpenRouter key', async () => {
			const openrouterKey = `sk-or-v1-${'a'.repeat(64)}`;
			await saveAPIKey('openrouter', openrouterKey);
			expect(await getAPIKey('openrouter')).toBe(openrouterKey);
		});

		it('should handle typical Exa.ai key', async () => {
			const exaKey = `exa-${'b'.repeat(40)}`;
			await saveAPIKey('exa', exaKey);
			expect(await getAPIKey('exa')).toBe(exaKey);
		});

		it('should handle user clearing a key', async () => {
			await saveAPIKey('together', 'initial-key');
			await saveAPIKey('together', ''); // User clears it
			expect(await getAPIKey('together')).toBeNull();
		});

		it('should handle user updating a key', async () => {
			await saveAPIKey('together', 'old-key');
			await saveAPIKey('together', 'new-key');
			expect(await getAPIKey('together')).toBe('new-key');
		});

		it('should handle rapid key updates', async () => {
			for (let i = 0; i < 10; i++) {
				await saveAPIKey('together', `key-${i}`);
			}
			expect(await getAPIKey('together')).toBe('key-9');
		});
	});

	describe('Edge Cases', () => {
		it('should handle very long keys', async () => {
			const longKey = `sk-${'a'.repeat(1000)}`;
			await saveAPIKey('together', longKey);
			expect(await getAPIKey('together')).toBe(longKey);
		});

		it('should handle keys with newlines', async () => {
			const keyWithNewlines = 'key\nwith\nnewlines';
			await saveAPIKey('together', keyWithNewlines);
			expect(await getAPIKey('together')).toBe(keyWithNewlines);
		});

		it('should handle keys with special characters', async () => {
			const specialKey = 'key!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
			await saveAPIKey('together', specialKey);
			expect(await getAPIKey('together')).toBe(specialKey);
		});

		it('should handle Unicode keys', async () => {
			const unicodeKey = '🔐中文-key-with-emoji';
			await saveAPIKey('together', unicodeKey);
			expect(await getAPIKey('together')).toBe(unicodeKey);
		});
	});

	describe('Multiple Keys Management', () => {
		it('should handle setting all keys at once', async () => {
			const keys = {
				together: 'together-key-123',
				openrouter: 'openrouter-key-456',
				exa: 'exa-key-789',
			};

			for (const [provider, key] of Object.entries(keys)) {
				await saveAPIKey(provider as APIKeyProvider, key);
			}

			const retrieved = await getAllAPIKeys();
			expect(retrieved.together).toBe(keys.together);
			expect(retrieved.openrouter).toBe(keys.openrouter);
			expect(retrieved.exa).toBe(keys.exa);
		});

		it('should handle partial key sets', async () => {
			await saveAPIKey('together', 'together-only');
			
			const keys = await getAllAPIKeys();
			expect(keys.together).toBe('together-only');
			expect(keys.openrouter).toBeUndefined();
			expect(keys.exa).toBeUndefined();
		});

		it('should handle clearing all keys', async () => {
			await saveAPIKey('together', 'key1');
			await saveAPIKey('openrouter', 'key2');
			await saveAPIKey('exa', 'key3');
			
			removeAPIKey('together');
			removeAPIKey('openrouter');
			removeAPIKey('exa');
			
			const keys = await getAllAPIKeys();
			expect(Object.keys(keys).length).toBe(0);
		});
	});

	describe('localStorage Persistence', () => {
		it('should persist keys between "sessions"', async () => {
			await saveAPIKey('together', 'persistent-key');
			
			// Simulate page reload (keys stay in localStorage mock)
			const retrieved = await getAPIKey('together');
			expect(retrieved).toBe('persistent-key');
		});

		it('should use consistent storage keys', async () => {
			await saveAPIKey('together', 'test-key');
			
			// Check actual localStorage key format
			const stored = localStorage.getItem('elara_apikey_together');
			expect(stored).toBeTruthy();
		});
	});

	describe('Performance', () => {
		it('should handle rapid sequential operations', async () => {
			const iterations = 50;
			const start = Date.now();
			
			for (let i = 0; i < iterations; i++) {
				await saveAPIKey('together', `key-${i}`);
				await getAPIKey('together');
			}
			
			const elapsed = Date.now() - start;
			
			// Should complete quickly (< 3 seconds for 50 iterations - accounting for crypto overhead)
			expect(elapsed).toBeLessThan(3000);
		});

		it('should handle concurrent operations', async () => {
			const promises = [];
			
			for (let i = 0; i < 10; i++) {
				promises.push(saveAPIKey('together', `concurrent-key-${i}`));
			}
			
			await Promise.all(promises);
			
			// Last write should win
			const retrieved = await getAPIKey('together');
			expect(retrieved).toContain('concurrent-key');
		});
	});
});

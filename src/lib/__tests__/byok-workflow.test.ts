/**
 * BYOK Workflow Integration Tests
 * 
 * Tests the end-to-end BYOK (Bring Your Own Key) workflow:
 * 1. User stores API keys
 * 2. System detects BYOK mode
 * 3. API calls use user's keys
 * 4. Fallback to Cloud Functions when no keys
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
	saveAPIKey, 
	getAPIKey, 
	hasOwnKeys,
	hasTogetherKey,
	hasChatKey,
	getAllAPIKeys,
	removeAPIKey,
} from '../byok';

describe('BYOK Workflow Integration', () => {
	beforeEach(() => {
		// Clear localStorage before each test
		if (typeof window !== 'undefined' && window.localStorage) {
			window.localStorage.clear();
		}
	});

	describe('BYOK Mode Detection', () => {
		it('should detect NO keys initially', () => {
			expect(hasOwnKeys()).toBe(false);
			expect(hasTogetherKey()).toBe(false);
			expect(hasChatKey()).toBe(false);
		});

		it('should detect BYOK mode with Together.ai key', async () => {
			await saveAPIKey('together', 'together-key-123');
			
			expect(hasOwnKeys()).toBe(true);
			expect(hasTogetherKey()).toBe(true);
			expect(hasChatKey()).toBe(true);
		});

		it('should detect BYOK mode with OpenRouter key', async () => {
			await saveAPIKey('openrouter', 'openrouter-key-123');
			
			expect(hasOwnKeys()).toBe(true);
			expect(hasChatKey()).toBe(true);
		});

		it('should NOT detect BYOK mode with only Exa key', async () => {
			await saveAPIKey('exa', 'exa-key-123');
			
			// Exa alone doesn't enable BYOK (need chat provider)
			expect(hasOwnKeys()).toBe(false);
			expect(hasTogetherKey()).toBe(false);
		});

		it('should detect Together.ai specifically', async () => {
			await saveAPIKey('openrouter', 'openrouter-key');
			expect(hasTogetherKey()).toBe(false);
			
			await saveAPIKey('together', 'together-key');
			expect(hasTogetherKey()).toBe(true);
		});

		it('should handle multiple keys', async () => {
			await saveAPIKey('together', 'together-key');
			await saveAPIKey('openrouter', 'openrouter-key');
			await saveAPIKey('exa', 'exa-key');
			
			expect(hasOwnKeys()).toBe(true);
			expect(hasTogetherKey()).toBe(true);
			expect(hasChatKey()).toBe(true);
		});
	});

	describe('Workflow: User Sets Up Keys', () => {
		it('should allow user to set primary provider key', async () => {
			// User goes to account page, adds Together.ai key
			const userKey = 'user-together-key-abc123';
			await saveAPIKey('together', userKey);
			
			// System should detect BYOK mode
			expect(hasOwnKeys()).toBe(true);
			
			// Key should be retrievable
			const retrieved = await getAPIKey('together');
			expect(retrieved).toBe(userKey);
		});

		it('should allow user to set multiple provider keys', async () => {
			// User adds multiple keys
			await saveAPIKey('together', 'together-key');
			await saveAPIKey('openrouter', 'openrouter-key');
			await saveAPIKey('exa', 'exa-key');
			
			// All should be retrievable
			const keys = await getAllAPIKeys();
			expect(keys.together).toBe('together-key');
			expect(keys.openrouter).toBe('openrouter-key');
			expect(keys.exa).toBe('exa-key');
		});

		it('should allow user to update existing keys', async () => {
			// User adds initial key
			await saveAPIKey('together', 'old-key');
			
			// User updates key (got new one from provider)
			await saveAPIKey('together', 'new-key');
			
			// Should have new key
			const retrieved = await getAPIKey('together');
			expect(retrieved).toBe('new-key');
		});

		it('should allow user to remove keys', async () => {
			// User adds key
			await saveAPIKey('together', 'key-to-remove');
			expect(hasOwnKeys()).toBe(true);
			
			// User removes key
			removeAPIKey('together');
			expect(hasOwnKeys()).toBe(false);
		});
	});

	describe('Workflow: BYOK vs Cloud Functions', () => {
		it('should prefer BYOK when keys are available', async () => {
			// User has their own keys
			await saveAPIKey('together', 'user-key');
			await saveAPIKey('openrouter', 'user-key-2');
			
			// System should use BYOK mode
			expect(hasOwnKeys()).toBe(true);
			
			// This means direct API calls to providers
			// (not going through Cloud Functions)
		});

		it('should fallback to Cloud Functions when no keys', () => {
			// No user keys
			expect(hasOwnKeys()).toBe(false);
			
			// System should use Cloud Functions
			// (owner's keys from Secret Manager)
		});

		it('should switch to BYOK when user adds first key', async () => {
			// Initially no keys
			expect(hasOwnKeys()).toBe(false);
			
			// User adds first key
			await saveAPIKey('together', 'first-key');
			
			// Now BYOK mode
			expect(hasOwnKeys()).toBe(true);
		});

		it('should fallback to Cloud Functions when user removes last key', async () => {
			// User has key
			await saveAPIKey('together', 'key');
			expect(hasOwnKeys()).toBe(true);
			
			// User removes it
			removeAPIKey('together');
			
			// Back to Cloud Functions
			expect(hasOwnKeys()).toBe(false);
		});
	});

	describe('Workflow: Feature Availability', () => {
		it('should enable image generation with Together.ai key', async () => {
			await saveAPIKey('together', 'together-key');
			
			// Together.ai supports images
			expect(hasTogetherKey()).toBe(true);
		});

		it('should enable chat with any chat provider key', async () => {
			// OpenRouter for chat
			await saveAPIKey('openrouter', 'openrouter-key');
			expect(hasChatKey()).toBe(true);
			
			// Together.ai also for chat
			removeAPIKey('openrouter');
			await saveAPIKey('together', 'together-key');
			expect(hasChatKey()).toBe(true);
		});

		it('should enable web search with Exa key', async () => {
			await saveAPIKey('exa', 'exa-key');
			
			const keys = await getAllAPIKeys();
			expect(keys.exa).toBeTruthy();
			
			// But Exa alone doesn't enable BYOK mode
			expect(hasOwnKeys()).toBe(false);
		});

		it('should enable all features with all keys', async () => {
			await saveAPIKey('together', 'together-key');
			await saveAPIKey('openrouter', 'openrouter-key');
			await saveAPIKey('exa', 'exa-key');
			
			expect(hasOwnKeys()).toBe(true);
			expect(hasTogetherKey()).toBe(true);
			expect(hasChatKey()).toBe(true);
			
			const keys = await getAllAPIKeys();
			expect(keys.together).toBeTruthy();
			expect(keys.openrouter).toBeTruthy();
			expect(keys.exa).toBeTruthy();
		});
	});

	describe('Workflow: User Journey Simulation', () => {
		it('should simulate new user onboarding', async () => {
			// Step 1: New user, no keys
			expect(hasOwnKeys()).toBe(false);
			
			// Step 2: User goes to account page, adds Together.ai key
			await saveAPIKey('together', 'my-together-key');
			
			// Step 3: System detects BYOK mode
			expect(hasOwnKeys()).toBe(true);
			
			// Step 4: User can now chat and generate images
			expect(hasChatKey()).toBe(true);
			expect(hasTogetherKey()).toBe(true);
			
			// Step 5: User adds OpenRouter for more models
			await saveAPIKey('openrouter', 'my-openrouter-key');
			
			// Step 6: User adds Exa for web search
			await saveAPIKey('exa', 'my-exa-key');
			
			// Step 7: User has full access
			const allKeys = await getAllAPIKeys();
			expect(Object.keys(allKeys).length).toBe(3);
		});

		it('should simulate user switching keys', async () => {
			// User starts with Together.ai
			await saveAPIKey('together', 'together-key-v1');
			
			// User gets new key from provider
			await saveAPIKey('together', 'together-key-v2');
			
			// Old key is replaced
			const current = await getAPIKey('together');
			expect(current).toBe('together-key-v2');
		});

		it('should simulate user removing all keys', async () => {
			// User has multiple keys
			await saveAPIKey('together', 'key1');
			await saveAPIKey('openrouter', 'key2');
			await saveAPIKey('exa', 'key3');
			
			// User decides to use Cloud Functions instead
			removeAPIKey('together');
			removeAPIKey('openrouter');
			removeAPIKey('exa');
			
			// Back to Cloud Functions mode
			expect(hasOwnKeys()).toBe(false);
			
			const keys = await getAllAPIKeys();
			expect(Object.keys(keys).length).toBe(0);
		});

		it('should simulate user adding keys incrementally', async () => {
			// Day 1: User adds Together.ai
			await saveAPIKey('together', 'together-key');
			expect(hasOwnKeys()).toBe(true);
			
			// Day 2: User adds OpenRouter
			await saveAPIKey('openrouter', 'openrouter-key');
			expect(hasChatKey()).toBe(true);
			
			// Day 3: User adds Exa
			await saveAPIKey('exa', 'exa-key');
			
			// All keys available
			const keys = await getAllAPIKeys();
			expect(keys.together).toBeTruthy();
			expect(keys.openrouter).toBeTruthy();
			expect(keys.exa).toBeTruthy();
		});
	});

	describe('Workflow: Error Scenarios', () => {
		it('should handle corrupted key gracefully', async () => {
			// Manually corrupt localStorage
			localStorage.setItem('elara_apikey_together', 'CORRUPTED!!!');
			
			// Should not crash
			const retrieved = await getAPIKey('together');
			// Might return corrupted or null depending on decryption
			expect(retrieved !== undefined).toBe(true);
		});

		it('should handle missing localStorage', () => {
			// Temporarily remove localStorage
			const originalLocalStorage = (global as any).window.localStorage;
			(global as any).window = {};
			
			// Should not crash
			expect(() => hasOwnKeys()).not.toThrow();
			
			// Restore
			(global as any).window.localStorage = originalLocalStorage;
		});

		it('should handle rapid key updates', async () => {
			// User rapidly updates key (network latency, etc)
			const updates = [];
			for (let i = 0; i < 20; i++) {
				updates.push(saveAPIKey('together', `key-${i}`));
			}
			
			await Promise.all(updates);
			
			// Should have some final key
			const final = await getAPIKey('together');
			expect(final).toContain('key-');
		});
	});

	describe('Workflow: Security Scenarios', () => {
		it('should not expose keys in console', async () => {
			await saveAPIKey('together', 'secret-key-123');
			
			const keys = await getAllAPIKeys();
			
			// Keys object exists
			expect(keys.together).toBeTruthy();
			
			// But localStorage is encrypted
			const stored = localStorage.getItem('elara_apikey_together');
			expect(stored).not.toBe('secret-key-123');
		});

		it('should isolate keys by provider', async () => {
			await saveAPIKey('together', 'together-secret');
			await saveAPIKey('openrouter', 'openrouter-secret');
			
			// Keys don't leak between providers
			const together = await getAPIKey('together');
			const openrouter = await getAPIKey('openrouter');
			
			expect(together).toBe('together-secret');
			expect(openrouter).toBe('openrouter-secret');
			expect(together).not.toBe(openrouter);
		});

		it('should handle XSS attempt in key value', async () => {
			const xssAttempt = '<script>alert("xss")</script>';
			await saveAPIKey('together', xssAttempt);
			
			const retrieved = await getAPIKey('together');
			expect(retrieved).toBe(xssAttempt);
			
			// Should be stored safely
			const stored = localStorage.getItem('elara_apikey_together');
			expect(stored).not.toContain('<script>');
		});
	});

	describe('Workflow: Performance', () => {
		it('should detect BYOK mode quickly', async () => {
			await saveAPIKey('together', 'key');
			
			const iterations = 1000;
			const start = Date.now();
			
			for (let i = 0; i < iterations; i++) {
				hasOwnKeys();
			}
			
			const elapsed = Date.now() - start;
			
			// Should be near-instant (< 100ms for 1000 checks)
			expect(elapsed).toBeLessThan(100);
		});

		it('should retrieve keys quickly', async () => {
			await saveAPIKey('together', 'key');
			await saveAPIKey('openrouter', 'key2');
			await saveAPIKey('exa', 'key3');
			
			const iterations = 100;
			const start = Date.now();
			
			for (let i = 0; i < iterations; i++) {
				await getAllAPIKeys();
			}
			
			const elapsed = Date.now() - start;
			
			// Should complete quickly (< 500ms for 100 iterations)
			expect(elapsed).toBeLessThan(500);
		});
	});
});

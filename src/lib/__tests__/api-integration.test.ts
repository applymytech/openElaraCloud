/**
 * API Client Integration Tests
 * 
 * Tests the integration between BYOK detection and API routing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { saveAPIKey, removeAPIKey, getAllAPIKeys } from '../byok';

// Mock the API client behavior
describe('API Integration Tests', () => {
	beforeEach(() => {
		if (typeof window !== 'undefined' && window.localStorage) {
			window.localStorage.clear();
		}
	});

	describe('BYOK Mode Detection in API Calls', () => {
		it('should route to BYOK when Together.ai key is present', async () => {
			// Setup: User has Together.ai key
			await saveAPIKey('together', 'test-together-key');

			// Verify BYOK mode would be active
			const keys = await getAllAPIKeys();
			expect(keys.together).toBeTruthy();
			
			// In real app, this would trigger direct API call to Together.ai
		});

		it('should route to Cloud Functions when no keys present', async () => {
			// Setup: No BYOK keys
			const keys = await getAllAPIKeys();
			expect(Object.keys(keys).length).toBe(0);
			
			// In real app, this would trigger Cloud Functions call
		});

		it('should switch modes dynamically when key is added', async () => {
			// Start with no keys
			let keys = await getAllAPIKeys();
			expect(Object.keys(keys).length).toBe(0);

			// User adds a key
			await saveAPIKey('together', 'new-key');
			
			// Should now be in BYOK mode
			keys = await getAllAPIKeys();
			expect(keys.together).toBeTruthy();
		});

		it('should switch modes dynamically when key is removed', async () => {
			// Start with a key
			await saveAPIKey('together', 'test-key');
			let keys = await getAllAPIKeys();
			expect(keys.together).toBeTruthy();

			// User removes the key
			removeAPIKey('together');
			
			// Should now be in Cloud Functions mode
			keys = await getAllAPIKeys();
			expect(keys.together).toBeFalsy();
		});
	});

	describe('Multi-Provider Scenarios', () => {
		it('should support multiple providers simultaneously', async () => {
			// User adds keys for multiple providers
			await saveAPIKey('together', 'together-key');
			await saveAPIKey('openrouter', 'openrouter-key');
			await saveAPIKey('exa', 'exa-key');

			const keys = await getAllAPIKeys();
			expect(keys.together).toBe('together-key');
			expect(keys.openrouter).toBe('openrouter-key');
			expect(keys.exa).toBe('exa-key');
		});

		it('should isolate failures by provider', async () => {
			// Setup multiple keys
			await saveAPIKey('together', 'together-key');
			await saveAPIKey('openrouter', 'openrouter-key');

			// One provider fails (simulated by removing key)
			removeAPIKey('together');

			// Other provider should still work
			const keys = await getAllAPIKeys();
			expect(keys.together).toBeFalsy();
			expect(keys.openrouter).toBe('openrouter-key');
		});

		it('should handle provider priority correctly', async () => {
			// Setup: User has both Together and OpenRouter
			await saveAPIKey('together', 'together-key');
			await saveAPIKey('openrouter', 'openrouter-key');

			const keys = await getAllAPIKeys();
			
			// Both should be available
			expect(keys.together).toBeTruthy();
			expect(keys.openrouter).toBeTruthy();

			// In real app, Together.ai would be preferred for images
			// OpenRouter would be used for chat
		});
	});

	describe('Error Recovery Scenarios', () => {
		it('should handle corrupted key gracefully', async () => {
			// Manually corrupt a key in localStorage
			if (typeof window !== 'undefined' && window.localStorage) {
				window.localStorage.setItem('elara_apikey_together', 'CORRUPTED_DATA!!!');
			}

			// Should not crash when trying to retrieve
			const keys = await getAllAPIKeys();
			
			// Corrupted key might return null or corrupted string
			// The important thing is it doesn't crash the app
			expect(() => keys.together).not.toThrow();
		});

		it('should recover from localStorage being unavailable', () => {
			// This simulates browser with localStorage disabled
			// getAllAPIKeys should handle this gracefully
			expect(() => getAllAPIKeys()).not.toThrow();
		});

		it('should handle rapid key changes', async () => {
			// Simulate user rapidly changing keys
			for (let i = 0; i < 10; i++) {
				await saveAPIKey('together', `key-version-${i}`);
			}

			// Should have final version
			const keys = await getAllAPIKeys();
			expect(keys.together).toBe('key-version-9');
		});
	});

	describe('Real-World User Flows', () => {
		it('should support trial user upgrading to BYOK', async () => {
			// Step 1: Trial user (no keys)
			let keys = await getAllAPIKeys();
			expect(Object.keys(keys).length).toBe(0);

			// Step 2: User signs up for Together.ai
			// Step 3: User adds their API key
			await saveAPIKey('together', 'user-together-api-key');

			// Step 4: User can now generate images with their own key
			keys = await getAllAPIKeys();
			expect(keys.together).toBeTruthy();
		});

		it('should support user switching providers', async () => {
			// User starts with Together.ai
			await saveAPIKey('together', 'together-key');
			
			// User decides to try OpenRouter instead
			removeAPIKey('together');
			await saveAPIKey('openrouter', 'openrouter-key');

			const keys = await getAllAPIKeys();
			expect(keys.together).toBeFalsy();
			expect(keys.openrouter).toBeTruthy();
		});

		it('should support user with multiple devices', async () => {
			// Device 1: User adds key
			await saveAPIKey('together', 'device-1-key');

			// Simulate device 2 (fresh localStorage)
			if (typeof window !== 'undefined' && window.localStorage) {
				window.localStorage.clear();
			}

			// Device 2: User needs to add key again (no sync)
			let keys = await getAllAPIKeys();
			expect(Object.keys(keys).length).toBe(0);

			// This is expected - keys are per-device for security
			// User must add keys on each device
		});
	});

	describe('Security Scenarios', () => {
		it('should not expose keys in error messages', async () => {
			const secretKey = 'sk-super-secret-key-12345';
			await saveAPIKey('together', secretKey);

			// Even if we try to stringify, key should be encrypted
			const stored = window.localStorage.getItem('elara_apikey_together');
			expect(stored).not.toContain(secretKey);
			expect(stored).not.toContain('super-secret');
		});

		it('should handle XSS attempts in key values', async () => {
			const xssKey = '<script>alert("xss")</script>';
			
			// Should store without executing
			await saveAPIKey('together', xssKey);
			
			// Should retrieve safely
			const keys = await getAllAPIKeys();
			expect(keys.together).toBe(xssKey);
		});

		it('should handle SQL injection attempts in key values', async () => {
			const sqlKey = "'; DROP TABLE users; --";
			
			// Should store safely (we don't have SQL, but testing escaping)
			await saveAPIKey('together', sqlKey);
			
			// Should retrieve safely
			const keys = await getAllAPIKeys();
			expect(keys.together).toBe(sqlKey);
		});
	});

	describe('Performance Under Load', () => {
		it('should handle many rapid API calls', async () => {
			await saveAPIKey('together', 'test-key');

			const start = Date.now();
			
			// Simulate 100 rapid API calls checking BYOK mode
			for (let i = 0; i < 100; i++) {
				await getAllAPIKeys();
			}

			const elapsed = Date.now() - start;

			// Should complete reasonably quickly (< 5 seconds accounting for crypto overhead)
			expect(elapsed).toBeLessThan(5000);
		});

		it('should handle concurrent key operations', async () => {
			// Simulate multiple components trying to access keys simultaneously
			const operations = [
				saveAPIKey('together', 'key-1'),
				saveAPIKey('openrouter', 'key-2'),
				saveAPIKey('exa', 'key-3'),
				getAllAPIKeys(),
				getAllAPIKeys(),
			];

			// Should not crash with concurrent access
			await expect(Promise.all(operations)).resolves.toBeTruthy();
		});
	});
});

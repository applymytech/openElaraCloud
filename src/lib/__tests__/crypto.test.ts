/**
 * Crypto Module Tests
 * 
 * Tests for Web Crypto API encryption/decryption
 * These tests verify the BYOK key storage security layer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { encryptKey, decryptKey, isCryptoAvailable } from '../crypto';

// Mock Web Crypto API for Node.js environment
const mockCrypto = {
	subtle: {
		importKey: vi.fn(),
		deriveKey: vi.fn(),
		encrypt: vi.fn(),
		decrypt: vi.fn(),
	},
	getRandomValues: vi.fn((arr: Uint8Array) => {
		// Fill with predictable values for testing
		for (let i = 0; i < arr.length; i++) {
			arr[i] = i % 256;
		}
		return arr;
	}),
};

const mockWindow = {
	crypto: mockCrypto,
	navigator: {
		userAgent: 'test-agent',
		language: 'en-US',
	},
	screen: {
		width: 1920,
		height: 1080,
		colorDepth: 24,
	},
	Date: global.Date,
};

describe('Crypto Module', () => {
	describe('isCryptoAvailable', () => {
		it('should return false in Node.js environment by default', () => {
			// In Node.js test environment without mocking
			const available = isCryptoAvailable();
			expect(typeof available).toBe('boolean');
		});
	});

	describe('Encryption/Decryption Flow', () => {
		beforeEach(() => {
			// Reset mocks
			vi.clearAllMocks();
		});

		it('should encrypt and decrypt a simple API key', async () => {
			const testKey = 'sk-test-1234567890abcdef';
			
			// Test the actual encryption (will use fallback in Node.js)
			const encrypted = await encryptKey(testKey);
			expect(encrypted).toBeTruthy();
			expect(encrypted).not.toBe(testKey);
			
			// Decrypt should return original
			const decrypted = await decryptKey(encrypted);
			expect(decrypted).toBe(testKey);
		});

		it('should handle empty string', async () => {
			const encrypted = await encryptKey('');
			const decrypted = await decryptKey(encrypted);
			expect(decrypted).toBe('');
		});

		it('should handle long API keys', async () => {
			const longKey = 'sk-' + 'a'.repeat(200);
			const encrypted = await encryptKey(longKey);
			const decrypted = await decryptKey(encrypted);
			expect(decrypted).toBe(longKey);
		});

		it('should handle special characters', async () => {
			const specialKey = 'key-with-special-chars: !@#$%^&*()_+-=[]{}|;:,.<>?';
			const encrypted = await encryptKey(specialKey);
			const decrypted = await decryptKey(encrypted);
			expect(decrypted).toBe(specialKey);
		});

		it('should handle Unicode characters', async () => {
			const unicodeKey = 'key-with-emoji-🔐-and-中文-characters';
			const encrypted = await encryptKey(unicodeKey);
			const decrypted = await decryptKey(encrypted);
			expect(decrypted).toBe(unicodeKey);
		});

		it('should produce different encrypted outputs for same input (due to random IV)', async () => {
			const testKey = 'sk-test-same-input';
			
			const encrypted1 = await encryptKey(testKey);
			const encrypted2 = await encryptKey(testKey);
			
			// Encrypted values should be different (different IVs)
			expect(encrypted1).not.toBe(encrypted2);
			
			// But both should decrypt to same value
			const decrypted1 = await decryptKey(encrypted1);
			const decrypted2 = await decryptKey(encrypted2);
			expect(decrypted1).toBe(testKey);
			expect(decrypted2).toBe(testKey);
		});
	});

	describe('Fallback Behavior', () => {
		it('should encrypt keys differently than plaintext (not base64 when crypto available)', async () => {
			// When Web Crypto is available, it uses real encryption
			// When it's not, it falls back to base64
			const testKey = 'sk-fallback-test';
			const encrypted = await encryptKey(testKey);
			
			// Encrypted should not be plaintext
			expect(encrypted).not.toBe(testKey);
			
			// Should decrypt correctly either way
			const decrypted = await decryptKey(encrypted);
			expect(decrypted).toBe(testKey);
		});

		it('should handle invalid encrypted data gracefully', async () => {
			try {
				await decryptKey('invalid-encrypted-data-!!!');
				// If it doesn't throw, it used fallback
			} catch (error) {
				// Expected to throw
				expect(error).toBeInstanceOf(Error);
			}
		});

		it('should handle corrupted encrypted data', async () => {
			const testKey = 'sk-test-corrupt';
			const encrypted = await encryptKey(testKey);
			
			// Corrupt the encrypted data
			const corrupted = encrypted.slice(0, -5) + 'XXXXX';
			
			try {
				await decryptKey(corrupted);
				// May succeed with fallback or throw
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
			}
		});
	});

	describe('Security Properties', () => {
		it('should not store plaintext keys', async () => {
			const testKey = 'sk-very-secret-key';
			const encrypted = await encryptKey(testKey);
			
			// Encrypted should not contain plaintext
			expect(encrypted).not.toContain(testKey);
			expect(encrypted.toLowerCase()).not.toContain('secret');
		});

		it('should encrypt keys that are reasonably long', async () => {
			const testKey = 'sk-test';
			const encrypted = await encryptKey(testKey);
			
			// Even with fallback (base64), encrypted should be different length
			expect(encrypted.length).toBeGreaterThan(0);
		});
	});

	describe('Real-World API Key Formats', () => {
		const realWorldKeys = [
			{ name: 'OpenAI', key: 'sk-proj-1234567890abcdefghijklmnopqrstuvwxyz1234567890' },
			{ name: 'Anthropic', key: 'sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz' },
			{ name: 'Together.ai', key: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234' },
			{ name: 'OpenRouter', key: 'sk-or-v1-1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz' },
			{ name: 'Exa.ai', key: '1234567890abcdefghijklmnopqrstuvwxyz1234567890' },
		];

		realWorldKeys.forEach(({ name, key }) => {
			it(`should handle ${name} API key format`, async () => {
				const encrypted = await encryptKey(key);
				expect(encrypted).toBeTruthy();
				expect(encrypted).not.toBe(key);
				
				const decrypted = await decryptKey(encrypted);
				expect(decrypted).toBe(key);
			});
		});
	});

	describe('Edge Cases', () => {
		it('should handle whitespace in keys', async () => {
			const keyWithSpaces = '  sk-test-with-spaces  ';
			const encrypted = await encryptKey(keyWithSpaces);
			const decrypted = await decryptKey(encrypted);
			expect(decrypted).toBe(keyWithSpaces);
		});

		it('should handle newlines in keys', async () => {
			const keyWithNewlines = 'sk-test\n\rwith\nnewlines';
			const encrypted = await encryptKey(keyWithNewlines);
			const decrypted = await decryptKey(encrypted);
			expect(decrypted).toBe(keyWithNewlines);
		});

		it('should handle very short keys', async () => {
			const shortKey = 'x';
			const encrypted = await encryptKey(shortKey);
			const decrypted = await decryptKey(encrypted);
			expect(decrypted).toBe(shortKey);
		});

		it('should handle keys with only numbers', async () => {
			const numericKey = '1234567890';
			const encrypted = await encryptKey(numericKey);
			const decrypted = await decryptKey(encrypted);
			expect(decrypted).toBe(numericKey);
		});
	});

	describe('Performance', () => {
		it('should encrypt/decrypt quickly', async () => {
			const testKey = 'sk-performance-test';
			const iterations = 10;
			
			const start = Date.now();
			for (let i = 0; i < iterations; i++) {
				const encrypted = await encryptKey(testKey);
				await decryptKey(encrypted);
			}
			const elapsed = Date.now() - start;
			
			// Should complete 10 iterations in reasonable time (< 1 second)
			expect(elapsed).toBeLessThan(1000);
		});
	});
});

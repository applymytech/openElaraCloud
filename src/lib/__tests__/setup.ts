/**
 * Test Setup for Vitest
 * \n * Provides global mocks and utilities for all tests
 * This runs ONCE before all tests to set up the environment
 */

import { beforeAll, beforeEach, afterEach, vi } from 'vitest';

// Simple localStorage polyfill that always works
function createMockLocalStorage() {
	const store: Record<string, string> = {};
	return {
		getItem: (key: string) => store[key] || null,
		setItem: (key: string, value: string) => { store[key] = value; },
		removeItem: (key: string) => { delete store[key]; },
		clear: () => { Object.keys(store).forEach(key => delete store[key]); },
		get length() { return Object.keys(store).length; },
		key: (index: number) => Object.keys(store)[index] || null,
	};
}

// Initialize test environment ONCE before all tests
beforeAll(() => {
	// Setup Web Crypto API using Node.js crypto
	if (!global.crypto || !global.crypto.subtle) {
		const { webcrypto } = require('crypto');
		// @ts-ignore - Polyfill for tests
		global.crypto = webcrypto as any;
	}

	// Setup localStorage using our mock (happy-dom's localStorage has issues in test environment)
	const mockStorage = createMockLocalStorage();
	// @ts-ignore - Replace with mock
	global.localStorage = mockStorage;
	
	// Ensure window object exists and has our mock localStorage
	if (typeof window === 'undefined') {
		// @ts-ignore - Create minimal window for tests
		global.window = { localStorage: mockStorage } as any;
	} else {
		// @ts-ignore - Replace window.localStorage with mock
		window.localStorage = mockStorage;
	}
});

// Clean up between tests
beforeEach(() => {
	// Clear our mock localStorage
	if (global.localStorage) {
		global.localStorage.clear();
	}
	
	// Clear all mocks
	vi.clearAllMocks();
});

afterEach(() => {
	// Additional cleanup if needed
});

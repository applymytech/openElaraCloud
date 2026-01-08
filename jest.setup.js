/**
 * Jest Setup File
 * 
 * Runs before each test suite.
 * Configures test environment, mocks, and global utilities.
 */

import '@testing-library/jest-dom';

// Mock Firebase (prevents actual Firebase calls in tests)
jest.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: jest.fn(),
  },
  db: {},
  storage: {},
}));

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  })),
}));

// Mock window.matchMedia (for responsive tests)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Suppress console errors in tests (unless debugging)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Not implemented: HTMLFormElement'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

/**
 * UI Error Handler
 * 
 * Converts technical errors into user-friendly messages
 * and provides helpful recovery suggestions.
 */

import { ERROR_MESSAGES } from './constants';

export interface UIError {
  title: string;
  message: string;
  suggestion?: string;
  recoverable: boolean;
}

/**
 * Convert any error into a user-friendly format
 */
export function handleUIError(error: unknown): UIError {
  // Handle known error types
  if (error instanceof Error) {
    return handleKnownError(error);
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      title: 'Error',
      message: error,
      recoverable: true,
    };
  }

  // Handle API error responses
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const apiError = error as { error: string; hint?: string };
    return {
      title: 'API Error',
      message: apiError.error,
      suggestion: apiError.hint,
      recoverable: true,
    };
  }

  // Unknown error
  return {
    title: 'Unexpected Error',
    message: 'Something went wrong. Please try again.',
    suggestion: 'If the problem persists, try refreshing the page.',
    recoverable: true,
  };
}

/**
 * Handle known error patterns
 */
function handleKnownError(error: Error): UIError {
  const message = error.message.toLowerCase();

  // Trial expired
  if (message.includes('trial') && message.includes('expired')) {
    return {
      title: 'Trial Expired',
      message: ERROR_MESSAGES.TRIAL_EXPIRED,
      suggestion: 'Visit the GitHub repo to deploy your own instance with your own keys.',
      recoverable: false,
    };
  }

  // Rate limited
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return {
      title: 'Slow Down',
      message: ERROR_MESSAGES.RATE_LIMITED,
      suggestion: 'Wait a moment before trying again.',
      recoverable: true,
    };
  }

  // Authentication errors
  if (message.includes('unauthorized') || message.includes('not authenticated')) {
    return {
      title: 'Authentication Required',
      message: ERROR_MESSAGES.AUTH_REQUIRED,
      suggestion: 'Please sign in to continue.',
      recoverable: true,
    };
  }

  // Network errors
  if (message.includes('network') || message.includes('fetch failed')) {
    return {
      title: 'Network Error',
      message: ERROR_MESSAGES.NETWORK_ERROR,
      suggestion: 'Check your internet connection and try again.',
      recoverable: true,
    };
  }

  // Configuration errors
  if (message.includes('config') || message.includes('firebase')) {
    return {
      title: 'Configuration Error',
      message: ERROR_MESSAGES.CONFIG_MISSING,
      suggestion: 'Contact support if you deployed this instance yourself.',
      recoverable: false,
    };
  }

  // File size errors
  if (message.includes('too large') || message.includes('size')) {
    return {
      title: 'File Too Large',
      message: message,
      suggestion: 'Try compressing the file or uploading a smaller one.',
      recoverable: true,
    };
  }

  // API key errors
  if (message.includes('api key') || message.includes('no keys')) {
    return {
      title: 'API Keys Required',
      message: ERROR_MESSAGES.NO_API_KEYS,
      suggestion: 'Go to Account → API Keys to add your provider keys.',
      recoverable: true,
    };
  }

  // Validation errors (from Zod)
  if (message.includes('validation') || message.includes('invalid')) {
    return {
      title: 'Invalid Input',
      message: error.message,
      suggestion: 'Check your input and try again.',
      recoverable: true,
    };
  }

  // Default: show the error message as-is
  return {
    title: 'Error',
    message: error.message || 'An unexpected error occurred.',
    suggestion: 'Please try again.',
    recoverable: true,
  };
}

/**
 * Create a toast-friendly error message
 */
export function toToastError(error: unknown): string {
  const uiError = handleUIError(error);
  let text = uiError.message;
  if (uiError.suggestion) {
    text += ` ${uiError.suggestion}`;
  }
  return text;
}

/**
 * Check if an error is fatal (app cannot continue)
 */
export function isFatalError(error: unknown): boolean {
  const uiError = handleUIError(error);
  return !uiError.recoverable;
}

/**
 * Application Constants
 * 
 * Single source of truth for all magic numbers and configuration values.
 */

// ============================================================================
// TRIAL & SUBSCRIPTION
// ============================================================================

/** Trial duration in milliseconds (7 days) */
export const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/** Grace period after trial expires before content deletion (30 days) */
export const CONTENT_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/** Default storage quota for new users (in GB) */
export const DEFAULT_STORAGE_QUOTA_GB = 2;

// ============================================================================
// RATE LIMITING
// ============================================================================

/** Max requests per minute per user for Cloud Functions */
export const RATE_LIMIT_PER_MINUTE = 60;

/** Max chat messages per hour per user */
export const CHAT_RATE_LIMIT_PER_HOUR = 200;

/** Max image generations per hour per user */
export const IMAGE_RATE_LIMIT_PER_HOUR = 50;

/** Max video generations per hour per user (expensive) */
export const VIDEO_RATE_LIMIT_PER_HOUR = 10;

// ============================================================================
// CACHING
// ============================================================================

/** Cache TTL for Secret Manager secrets (5 minutes) */
export const SECRET_CACHE_TTL_MS = 5 * 60 * 1000;

/** Cache TTL for model lists (1 hour) */
export const MODEL_CACHE_TTL_MS = 60 * 60 * 1000;

/** Cache TTL for user profile data (5 minutes) */
export const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

// ============================================================================
// FILE SIZES
// ============================================================================

/** Max file size for general uploads (50 MB) */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Max file size for images (10 MB) */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

/** Max file size for code files (25 MB) */
export const MAX_CODE_FILE_SIZE_BYTES = 25 * 1024 * 1024;

/** Max audio recording size (25 MB - ~25 minutes at 16kbps) */
export const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024;

// ============================================================================
// CONTENT LIMITS
// ============================================================================

/** Max chat message length (characters) */
export const MAX_CHAT_MESSAGE_LENGTH = 50000;

/** Max system prompt length (characters) */
export const MAX_SYSTEM_PROMPT_LENGTH = 10000;

/** Max image prompt length (characters) */
export const MAX_IMAGE_PROMPT_LENGTH = 2000;

/** Max video prompt length (characters) */
export const MAX_VIDEO_PROMPT_LENGTH = 2000;

/** Max TTS text length (characters) - varies by model */
export const MAX_TTS_TEXT_LENGTH = 4000;

// ============================================================================
// TOKEN BUDGETS
// ============================================================================

/** Default max tokens for chat completion */
export const DEFAULT_MAX_TOKENS = 8000;

/** Context window buffer to prevent token overflow */
export const TOKEN_BUFFER = 1000;

/** Max tokens for RAG context chunks */
export const MAX_RAG_TOKENS = 16000;

// ============================================================================
// UI SETTINGS
// ============================================================================

/** Auto-scroll threshold for chat (pixels from bottom) */
export const CHAT_AUTO_SCROLL_THRESHOLD = 100;

/** Textarea max height before scrolling (pixels) */
export const TEXTAREA_MAX_HEIGHT = 200;

/** Debounce delay for auto-save (ms) */
export const AUTO_SAVE_DEBOUNCE_MS = 1000;

// ============================================================================
// API DEFAULTS
// ============================================================================

/** Default chat model */
export const DEFAULT_CHAT_MODEL = 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free';

/** Default image model (FLUX.1-schnell-Free deprecated 2026-01-08) */
export const DEFAULT_IMAGE_MODEL = 'black-forest-labs/FLUX.1-schnell';

/** Default video model */
export const DEFAULT_VIDEO_MODEL = 'minimax/video-01';

/** Default TTS model */
export const DEFAULT_TTS_MODEL = 'kokoro-v1';

/** Default temperature for chat */
export const DEFAULT_TEMPERATURE = 0.7;

/** Default image generation steps */
export const DEFAULT_IMAGE_STEPS = 4;

/** Default image dimensions */
export const DEFAULT_IMAGE_WIDTH = 1024;
export const DEFAULT_IMAGE_HEIGHT = 1024;

// ============================================================================
// FIREBASE REGIONS
// ============================================================================

/** Primary Cloud Functions region */
export const FUNCTIONS_REGION = 'us-central1';

/** Storage bucket regions (multi-region) */
export const STORAGE_REGION = 'us';

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ERROR_MESSAGES = {
  TRIAL_EXPIRED: 'Your 7-day trial has expired. Deploy your own instance to continue!',
  NO_API_KEYS: 'No API keys configured. Add your keys in Account → API Keys or use cloud mode.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  FILE_TOO_LARGE: 'File is too large. Maximum size is',
  INVALID_FILE_TYPE: 'Invalid file type. Supported types:',
  NETWORK_ERROR: 'Network error. Check your connection and try again.',
  AUTH_REQUIRED: 'You must be signed in to use this feature.',
  CONFIG_MISSING: 'Firebase configuration is missing. Check your deployment setup.',
} as const;

// ============================================================================
// FEATURE FLAGS
// ============================================================================

/** Enable debug logging in development */
export const DEBUG_ENABLED = process.env.NODE_ENV === 'development';

/** Enable trial enforcement */
export const TRIAL_ENFORCEMENT_ENABLED = true;

/** Enable rate limiting */
export const RATE_LIMITING_ENABLED = true;

/** Enable content moderation (future) */
export const CONTENT_MODERATION_ENABLED = false;

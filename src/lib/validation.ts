/**
 * Input Validation Schemas
 * 
 * Zod schemas for runtime validation of user inputs.
 * Prevents invalid data from reaching the API and provides clear error messages.
 */

import { z } from 'zod';
import {
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_IMAGE_PROMPT_LENGTH,
  MAX_VIDEO_PROMPT_LENGTH,
  MAX_SYSTEM_PROMPT_LENGTH,
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGE_SIZE_BYTES,
  DEFAULT_IMAGE_WIDTH,
  DEFAULT_IMAGE_HEIGHT,
  DEFAULT_TEMPERATURE,
} from './constants';

// ============================================================================
// CHAT SCHEMAS
// ============================================================================

export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string().min(1).max(MAX_CHAT_MESSAGE_LENGTH),
  tool_calls: z.array(z.any()).optional(),
  tool_call_id: z.string().optional(),
});

export const chatPayloadSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  model: z.string().regex(/^[\w\-\/\.]+$/, 'Invalid model ID format'),
  temperature: z.number().min(0).max(2).default(DEFAULT_TEMPERATURE),
  maxTokens: z.number().int().min(1).max(100000).optional(),
  stream: z.boolean().optional(),
});

export const systemPromptSchema = z.string()
  .min(1, 'System prompt cannot be empty')
  .max(MAX_SYSTEM_PROMPT_LENGTH, `System prompt too long (max ${MAX_SYSTEM_PROMPT_LENGTH} chars)`);

// ============================================================================
// IMAGE GENERATION SCHEMAS
// ============================================================================

export const imageGenerationSchema = z.object({
  prompt: z.string()
    .min(1, 'Image prompt cannot be empty')
    .max(MAX_IMAGE_PROMPT_LENGTH, `Prompt too long (max ${MAX_IMAGE_PROMPT_LENGTH} chars)`),
  model: z.string().regex(/^[\w\-\/\.]+$/, 'Invalid model ID format').optional(),
  width: z.number().int().min(256).max(2048).default(DEFAULT_IMAGE_WIDTH),
  height: z.number().int().min(256).max(2048).default(DEFAULT_IMAGE_HEIGHT),
  steps: z.number().int().min(1).max(100).optional(),
  negativePrompt: z.string().max(MAX_IMAGE_PROMPT_LENGTH).optional(),
  seed: z.number().int().min(0).max(2147483647).optional(),
  guidanceScale: z.number().min(0).max(30).optional(),
});

// ============================================================================
// VIDEO GENERATION SCHEMAS
// ============================================================================

export const videoGenerationSchema = z.object({
  prompt: z.string()
    .min(1, 'Video prompt cannot be empty')
    .max(MAX_VIDEO_PROMPT_LENGTH, `Prompt too long (max ${MAX_VIDEO_PROMPT_LENGTH} chars)`),
  model: z.string().regex(/^[\w\-\/\.]+$/, 'Invalid model ID format').optional(),
  width: z.number().int().min(256).max(1920).optional(),
  height: z.number().int().min(256).max(1080).optional(),
  seconds: z.number().int().min(1).max(30).default(5),
  guidanceScale: z.number().min(0).max(30).optional(),
  seed: z.number().int().min(0).max(2147483647).optional(),
  negativePrompt: z.string().max(MAX_VIDEO_PROMPT_LENGTH).optional(),
  firstFrameImage: z.string().optional(), // Base64 image
  lastFrameImage: z.string().optional(),  // Base64 image
});

// ============================================================================
// FILE UPLOAD SCHEMAS
// ============================================================================

export const fileUploadSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().min(1).max(MAX_FILE_SIZE_BYTES),
  type: z.string().regex(/^[\w\-]+\/[\w\-\+\.]+$/, 'Invalid MIME type'),
});

export const imageFileSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().min(1).max(MAX_IMAGE_SIZE_BYTES),
  type: z.string().regex(/^image\/(png|jpeg|jpg|gif|webp)$/, 'Invalid image type'),
});

// ============================================================================
// API KEY SCHEMAS
// ============================================================================

export const apiKeySchema = z.string()
  .min(10, 'API key too short')
  .max(200, 'API key too long')
  .regex(/^[A-Za-z0-9_\-\.]+$/, 'API key contains invalid characters');

export const apiKeysSchema = z.object({
  together: apiKeySchema.optional(),
  openrouter: apiKeySchema.optional(),
  exa: apiKeySchema.optional(),
});

// ============================================================================
// USER PROFILE SCHEMAS
// ============================================================================

export const displayNameSchema = z.string()
  .min(1, 'Display name cannot be empty')
  .max(50, 'Display name too long (max 50 chars)')
  .regex(/^[\w\s\-']+$/, 'Display name contains invalid characters');

export const passwordSchema = z.string()
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password too long (max 128 chars)');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate data against a schema and return helpful error messages
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  error?: string;
} {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const message = err.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { success: false, error: message };
    }
    return { success: false, error: 'Validation failed' };
  }
}

/**
 * Validate data and throw user-friendly error if invalid
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = validate(schema, data);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data!;
}

// Export types derived from schemas
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatPayload = z.infer<typeof chatPayloadSchema>;
export type ImageGenerationPayload = z.infer<typeof imageGenerationSchema>;
export type VideoGenerationPayload = z.infer<typeof videoGenerationSchema>;
export type FileUpload = z.infer<typeof fileUploadSchema>;
export type ImageFile = z.infer<typeof imageFileSchema>;
export type APIKeys = z.infer<typeof apiKeysSchema>;

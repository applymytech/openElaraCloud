/**
 * Text-to-Speech Service for OpenElara Cloud
 * 
 * PORTED FROM DESKTOP: src/main/handlers/apiHandlers.js (handleTogetherTTS)
 * 
 * Uses Together.ai's TTS API with multiple models:
 * - hexgrad/Kokoro-82M (cheapest, default)
 * - canopylabs/orpheus-3b-0.1-ft (higher quality)
 * - cartesia/sonic (premium)
 * 
 * Each model has specific voice options that must be matched correctly.
 */

import { getAPIKey } from './byok';

// ============================================================================
// TYPES
// ============================================================================

export interface TTSOptions {
  model?: string;
  voice?: string;
  responseFormat?: 'wav' | 'mp3' | 'raw';
  speed?: number;
}

export interface TTSResult {
  success: boolean;
  audioData?: ArrayBuffer;
  audioUrl?: string;
  error?: string;
}

export interface Voice {
  id: string;
  name: string;
  displayName: string;
  gender?: 'male' | 'female' | 'neutral';
}

// ============================================================================
// VOICE CATALOGS (from desktop voice-studio.js)
// ============================================================================

export const KOKORO_VOICES: Voice[] = [
  { id: 'af_heart', name: 'af_heart', displayName: 'Female - Heart', gender: 'female' },
  { id: 'af_bella', name: 'af_bella', displayName: 'Female - Bella', gender: 'female' },
  { id: 'af_sarah', name: 'af_sarah', displayName: 'Female - Sarah', gender: 'female' },
  { id: 'af_nicole', name: 'af_nicole', displayName: 'Female - Nicole', gender: 'female' },
  { id: 'af_sky', name: 'af_sky', displayName: 'Female - Sky', gender: 'female' },
  { id: 'af_alloy', name: 'af_alloy', displayName: 'Female - Alloy', gender: 'female' },
  { id: 'af_aoede', name: 'af_aoede', displayName: 'Female - Aoede', gender: 'female' },
  { id: 'af_jessica', name: 'af_jessica', displayName: 'Female - Jessica', gender: 'female' },
  { id: 'af_kore', name: 'af_kore', displayName: 'Female - Kore', gender: 'female' },
  { id: 'af_nova', name: 'af_nova', displayName: 'Female - Nova', gender: 'female' },
  { id: 'af_river', name: 'af_river', displayName: 'Female - River', gender: 'female' },
  { id: 'am_adam', name: 'am_adam', displayName: 'Male - Adam', gender: 'male' },
  { id: 'am_echo', name: 'am_echo', displayName: 'Male - Echo', gender: 'male' },
  { id: 'am_eric', name: 'am_eric', displayName: 'Male - Eric', gender: 'male' },
  { id: 'am_fenrir', name: 'am_fenrir', displayName: 'Male - Fenrir', gender: 'male' },
  { id: 'am_liam', name: 'am_liam', displayName: 'Male - Liam', gender: 'male' },
  { id: 'am_michael', name: 'am_michael', displayName: 'Male - Michael', gender: 'male' },
  { id: 'am_onyx', name: 'am_onyx', displayName: 'Male - Onyx', gender: 'male' },
  { id: 'am_puck', name: 'am_puck', displayName: 'Male - Puck', gender: 'male' },
  { id: 'bf_emma', name: 'bf_emma', displayName: 'British Female - Emma', gender: 'female' },
  { id: 'bf_isabella', name: 'bf_isabella', displayName: 'British Female - Isabella', gender: 'female' },
  { id: 'bm_george', name: 'bm_george', displayName: 'British Male - George', gender: 'male' },
  { id: 'bm_lewis', name: 'bm_lewis', displayName: 'British Male - Lewis', gender: 'male' },
];

export const ORPHEUS_VOICES: Voice[] = [
  { id: 'tara', name: 'tara', displayName: 'Female - Tara', gender: 'female' },
  { id: 'leah', name: 'leah', displayName: 'Female - Leah', gender: 'female' },
  { id: 'jess', name: 'jess', displayName: 'Female - Jess', gender: 'female' },
  { id: 'leo', name: 'leo', displayName: 'Male - Leo', gender: 'male' },
  { id: 'dan', name: 'dan', displayName: 'Male - Dan', gender: 'male' },
  { id: 'mia', name: 'mia', displayName: 'Female - Mia', gender: 'female' },
  { id: 'zac', name: 'zac', displayName: 'Male - Zac', gender: 'male' },
  { id: 'zoe', name: 'zoe', displayName: 'Female - Zoe', gender: 'female' },
];

export const CARTESIA_VOICES: Voice[] = [
  { id: 'a167e0f3-df7e-4d52-a9c3-f949145efdab', name: 'alloy', displayName: 'Alloy (Default)', gender: 'neutral' },
  { id: 'c2ac25f9-ecc4-4f56-9095-651354df60c0', name: 'echo', displayName: 'Echo', gender: 'male' },
  { id: '79a125e8-cd45-4c13-8a67-188112f4dd22', name: 'nova', displayName: 'Nova', gender: 'female' },
];

// ============================================================================
// TTS MODELS
// ============================================================================

export interface TTSModel {
  id: string;
  name: string;
  description: string;
  maxTextLength: number;
  costPerMillion?: number; // Cost per million characters
  voices: Voice[];
}

export const TTS_MODELS: TTSModel[] = [
  {
    id: 'hexgrad/Kokoro-82M',
    name: 'Kokoro 82M',
    description: 'Fast, affordable TTS with many voice options',
    maxTextLength: 5000,
    costPerMillion: 15, // $0.015 per 1K chars
    voices: KOKORO_VOICES,
  },
  {
    id: 'canopylabs/orpheus-3b-0.1-ft',
    name: 'Orpheus 3B',
    description: 'Higher quality emotional TTS',
    maxTextLength: 2000,
    costPerMillion: 60,
    voices: ORPHEUS_VOICES,
  },
  {
    id: 'cartesia/sonic',
    name: 'Cartesia Sonic',
    description: 'Premium quality TTS',
    maxTextLength: 10000,
    costPerMillion: 100,
    voices: CARTESIA_VOICES,
  },
];

export const DEFAULT_TTS_MODEL = 'hexgrad/Kokoro-82M';
export const DEFAULT_VOICE = 'af_heart';

// ============================================================================
// VOICE VALIDATION (from desktop)
// ============================================================================

/**
 * Validate and fix voice for the selected model
 * Returns a valid voice ID for the model, falling back to defaults if needed
 */
export function validateVoiceForModel(voice: string, model: string): string {
  const modelConfig = TTS_MODELS.find(m => m.id === model);
  if (!modelConfig) {
    console.warn(`[TTS] Unknown model '${model}', using Kokoro default`);
    return DEFAULT_VOICE;
  }

  // Check if voice exists in model's voice list
  const validVoice = modelConfig.voices.find(v => v.id === voice || v.name === voice);
  if (validVoice) {
    return validVoice.id;
  }

  // Fall back to first voice in model's list
  const fallback = modelConfig.voices[0]?.id || DEFAULT_VOICE;
  console.warn(`[TTS] Voice '${voice}' not valid for model '${model}', using '${fallback}'`);
  return fallback;
}

/**
 * Get max text length for a model
 */
export function getModelMaxTextLength(model: string): number {
  const modelConfig = TTS_MODELS.find(m => m.id === model);
  return modelConfig?.maxTextLength || 5000;
}

// ============================================================================
// TTS GENERATION
// ============================================================================

/**
 * Generate speech audio from text using Together.ai TTS API
 * 
 * @param text - Text to synthesize
 * @param options - TTS options (model, voice, format)
 * @returns TTSResult with audio data or error
 */
export async function generateSpeech(text: string, options: TTSOptions = {}): Promise<TTSResult> {
  const apiKey = getAPIKey('together');
  
  if (!apiKey) {
    return { 
      success: false, 
      error: 'Together.ai API Key is not set. Please configure it in Settings → API Keys.' 
    };
  }

  // Defaults
  const model = options.model || DEFAULT_TTS_MODEL;
  const voice = validateVoiceForModel(options.voice || DEFAULT_VOICE, model);
  const responseFormat = options.responseFormat || 'wav';

  // Validate and truncate text if needed
  const maxLength = getModelMaxTextLength(model);
  const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;
  
  if (text.length > maxLength) {
    console.warn(`[TTS] Text truncated from ${text.length} to ${maxLength} chars (${model} limit)`);
  }

  if (!truncatedText.trim()) {
    return { success: false, error: 'Text is empty. Cannot generate speech for empty input.' };
  }

  try {
    console.log(`[TTS] Generating audio: model=${model}, voice=${voice}, format=${responseFormat}`);
    console.log(`[TTS] Text preview: "${truncatedText.substring(0, 50)}..."`);

    // Together.AI TTS API payload
    const payload: Record<string, unknown> = {
      model,
      input: truncatedText,
      voice,
    };

    // Optional response format (default is wav)
    if (responseFormat && responseFormat !== 'wav') {
      payload.response_format = responseFormat;
    }

    const response = await fetch('https://api.together.xyz/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Request-ID': `tts-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 429) {
        return { success: false, error: 'Together.ai rate limit exceeded. Please wait a moment.' };
      }
      if (response.status === 401) {
        return { success: false, error: 'Invalid Together.ai API key. Please check Settings.' };
      }
      if (response.status === 400) {
        const errorMessage = errorData.error?.message || 'Bad request';
        if (errorMessage.includes('voice') || errorMessage.includes('Voice')) {
          return { 
            success: false, 
            error: `Invalid voice '${voice}' for model '${model}'. Please select a different voice.` 
          };
        }
        return { success: false, error: `TTS Request Error: ${errorMessage}` };
      }
      
      return { 
        success: false, 
        error: `TTS Error: ${errorData.error?.message || response.statusText}` 
      };
    }

    // Get audio data as ArrayBuffer
    const audioData = await response.arrayBuffer();
    console.log(`[TTS] Audio generated successfully, size: ${audioData.byteLength} bytes`);

    // Create blob URL for playback
    const mimeType = responseFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav';
    const blob = new Blob([audioData], { type: mimeType });
    const audioUrl = URL.createObjectURL(blob);

    return {
      success: true,
      audioData,
      audioUrl,
    };
  } catch (error: any) {
    console.error('[TTS] Generation failed:', error);
    return { 
      success: false, 
      error: `TTS Error: ${error.message}` 
    };
  }
}

/**
 * Get voices for a specific model
 */
export function getVoicesForModel(model: string): Voice[] {
  const modelConfig = TTS_MODELS.find(m => m.id === model);
  return modelConfig?.voices || KOKORO_VOICES;
}

/**
 * Get the default voice for a character based on their voice profile
 */
export function getCharacterVoice(characterVoiceId?: string, model?: string): string {
  if (!characterVoiceId) return DEFAULT_VOICE;
  return validateVoiceForModel(characterVoiceId, model || DEFAULT_TTS_MODEL);
}

// ============================================================================
// AUDIO UTILITIES
// ============================================================================

/**
 * Play audio from a URL
 */
export function playAudio(audioUrl: string): HTMLAudioElement {
  const audio = new Audio(audioUrl);
  audio.play().catch(err => console.error('[TTS] Playback failed:', err));
  return audio;
}

/**
 * Download audio as a file
 */
export function downloadAudio(audioUrl: string, filename: string = 'speech.wav'): void {
  const a = document.createElement('a');
  a.href = audioUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Clean up audio URL (revoke blob URL)
 */
export function cleanupAudioUrl(audioUrl: string): void {
  if (audioUrl.startsWith('blob:')) {
    URL.revokeObjectURL(audioUrl);
  }
}

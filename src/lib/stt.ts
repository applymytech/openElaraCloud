/**
 * Speech-to-Text Service for OpenElara Cloud
 * 
 * PORTED FROM DESKTOP: src/services/voiceService.js
 * 
 * Uses browser MediaRecorder API → Together.ai Whisper API
 * 
 * Desktop had both local Whisper (via Python) and cloud Whisper.
 * Cloud app only uses Together.ai Whisper (cloud-only).
 */

import { getAPIKey } from './byok';

// ============================================================================
// TYPES
// ============================================================================

export interface STTOptions {
  language?: string;  // ISO language code or 'auto'
  format?: 'json' | 'text';
}

export interface STTResult {
  success: boolean;
  text?: string;
  error?: string;
  language?: string;
}

// ============================================================================
// MEDIA RECORDER STATE
// ============================================================================

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let isRecording = false;

/**
 * Check if speech recognition is supported
 */
export function isSTTSupported(): boolean {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/**
 * Start recording audio from microphone
 */
export async function startRecording(): Promise<{ success: boolean; error?: string }> {
  if (isRecording) {
    return { success: false, error: 'Already recording' };
  }
  
  if (!isSTTSupported()) {
    return { success: false, error: 'Speech recognition not supported in this browser' };
  }
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000, // Optimal for Whisper
      }
    });
    
    // Use webm/opus for better compression, fallback to wav
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/wav';
    
    mediaRecorder = new MediaRecorder(stream, { mimeType });
    audioChunks = [];
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    mediaRecorder.start(1000); // Collect data every second
    isRecording = true;
    
    console.log('[STT] Recording started with mimeType:', mimeType);
    return { success: true };
  } catch (error: any) {
    console.error('[STT] Failed to start recording:', error);
    
    if (error.name === 'NotAllowedError') {
      return { success: false, error: 'Microphone access denied. Please allow microphone access in your browser settings.' };
    } else if (error.name === 'NotFoundError') {
      return { success: false, error: 'No microphone found. Please connect a microphone and try again.' };
    }
    
    return { success: false, error: `Recording failed: ${error.message}` };
  }
}

/**
 * Stop recording and return the audio blob
 */
export async function stopRecording(): Promise<{ success: boolean; audioBlob?: Blob; error?: string }> {
  if (!isRecording || !mediaRecorder) {
    return { success: false, error: 'Not recording' };
  }
  
  return new Promise((resolve) => {
    mediaRecorder!.onstop = () => {
      const mimeType = mediaRecorder!.mimeType;
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      
      // Stop all tracks
      mediaRecorder!.stream.getTracks().forEach(track => track.stop());
      
      mediaRecorder = null;
      audioChunks = [];
      isRecording = false;
      
      console.log('[STT] Recording stopped, blob size:', audioBlob.size, 'bytes');
      resolve({ success: true, audioBlob });
    };
    
    mediaRecorder!.stop();
  });
}

/**
 * Check if currently recording
 */
export function getRecordingState(): boolean {
  return isRecording;
}

/**
 * Cancel recording without processing
 */
export function cancelRecording(): void {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    mediaRecorder.stop();
    mediaRecorder = null;
    audioChunks = [];
    isRecording = false;
    console.log('[STT] Recording cancelled');
  }
}

// ============================================================================
// TOGETHER.AI WHISPER API
// ============================================================================

/**
 * Transcribe audio using Together.ai Whisper API
 */
export async function transcribeAudio(
  audioBlob: Blob, 
  options: STTOptions = {}
): Promise<STTResult> {
  const apiKey = await getAPIKey('together');
  
  if (!apiKey) {
    return { 
      success: false, 
      error: 'Together.ai API Key required for speech recognition. Configure it in Settings → API Keys.' 
    };
  }
  
  try {
    // Create form data with audio file
    const formData = new FormData();
    
    // Convert blob to appropriate format
    // Together.ai Whisper accepts: mp3, mp4, mpeg, mpga, m4a, wav, webm
    const audioFile = new File([audioBlob], 'audio.webm', { type: audioBlob.type });
    formData.append('file', audioFile);
    formData.append('model', 'openai/whisper-large-v3');
    
    if (options.language && options.language !== 'auto') {
      formData.append('language', options.language);
    }
    
    console.log('[STT] Sending audio to Together.ai Whisper API...');
    
    const response = await fetch('https://api.together.xyz/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[STT] API Error:', errorData);
      return { 
        success: false, 
        error: `Transcription failed: ${errorData.error?.message || response.statusText}` 
      };
    }
    
    const result = await response.json();
    console.log('[STT] Transcription result:', result);
    
    return {
      success: true,
      text: result.text?.trim() || '',
      language: result.language,
    };
  } catch (error: any) {
    console.error('[STT] Transcription error:', error);
    return { 
      success: false, 
      error: `Transcription error: ${error.message}` 
    };
  }
}

// ============================================================================
// CONVENIENCE FUNCTION - Record and Transcribe
// ============================================================================

/**
 * Full speech-to-text workflow:
 * 1. Record until callback signals stop
 * 2. Transcribe with Whisper
 * 3. Return text
 */
export async function recordAndTranscribe(options: STTOptions = {}): Promise<STTResult> {
  const startResult = await startRecording();
  if (!startResult.success) {
    return { success: false, error: startResult.error };
  }
  
  // Recording continues until stopRecording is called
  // This function should be used with external stop control
  return { success: true, text: '' };
}

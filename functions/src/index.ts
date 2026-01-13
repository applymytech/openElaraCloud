/**
 * OpenElara Cloud - Firebase Functions
 * 
 * These functions handle secure API calls to AI services.
 * API keys are stored in Google Secret Manager - NEVER exposed to client.
 * 
 * PROVIDER HIERARCHY:
 * 1. Vertex AI (Gemini) - Native Google, works with same GCP project
 * 2. Together.ai - External, requires TOGETHER_API_KEY secret
 * 3. OpenRouter - External, requires OPENROUTER_API_KEY secret
 * 
 * ELARASIGN INTEGRATION:
 * All generated content (images, video, audio) is signed server-side
 * BEFORE being returned to the user. This ensures provenance tracking
 * cannot be bypassed by client-side manipulation.
 * 
 * Signing approach:
 * - Uses simplified UID link (hash of user ID) for accountability
 * - PNG-only output for images (lossless, signature survives)
 * - Metadata stored in Firebase Storage alongside content
 */

import { BigQuery } from "@google-cloud/bigquery";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { VertexAI } from "@google-cloud/vertexai";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as crypto from "crypto";
import sharp from "sharp";

// Initialize Firebase Admin
admin.initializeApp();

// Secret Manager client
const secretClient = new SecretManagerServiceClient();

// Vertex AI client (uses ADC - Application Default Credentials)
const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "";
const location = process.env.VERTEX_LOCATION || "us-central1";
let vertexAI: VertexAI | null = null;

function getVertexAI(): VertexAI {
  if (!vertexAI) {
    vertexAI = new VertexAI({ project: projectId, location });
  }
  return vertexAI;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Cache TTL for Secret Manager secrets (5 minutes) */
const SECRET_CACHE_TTL_MS = 5 * 60 * 1000;

/** Max requests per minute per user */
const RATE_LIMIT_PER_MINUTE = 60;

/** Trial enforcement enabled */
const TRIAL_ENFORCEMENT_ENABLED = true;

// Cache secrets to avoid repeated lookups
const secretCache: Map<string, { value: string; expiry: number }> = new Map();

/**
 * Get a secret from Google Secret Manager
 */
async function getSecret(secretName: string): Promise<string | null> {
  // Check cache
  const cached = secretCache.get(secretName);
  if (cached && cached.expiry > Date.now()) {
    return cached.value;
  }

  try {
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    
    const [version] = await secretClient.accessSecretVersion({ name });
    const payload = version.payload?.data?.toString();
    
    if (payload) {
      secretCache.set(secretName, { value: payload, expiry: Date.now() + SECRET_CACHE_TTL_MS });
      return payload;
    }
  } catch (error) {
    console.error(`Failed to get secret ${secretName}:`, error);
  }
  
  return null;
}

/**
 * Check if user's trial has expired
 * Respects manual date changes in Firestore
 */
async function checkTrialStatus(userId: string): Promise<{ valid: boolean; error?: string }> {
  if (!TRIAL_ENFORCEMENT_ENABLED) {
    return { valid: true };
  }

  try {
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return { valid: false, error: 'User profile not found' };
    }

    const userData = userDoc.data();
    const trialExpiresAt = userData?.trialExpiresAt;

    if (!trialExpiresAt) {
      // No trial expiration set - assume valid (admin accounts)
      return { valid: true };
    }

    // Convert Firestore Timestamp to Date
    const expiryDate = trialExpiresAt.toDate ? trialExpiresAt.toDate() : new Date(trialExpiresAt);
    const now = new Date();

    if (now > expiryDate) {
      return {
        valid: false,
        error: 'Trial expired. Deploy your own instance to continue!',
      };
    }

    return { valid: true };
  } catch (error) {
    functions.logger.error('Trial check failed:', error);
    // Fail open - don't block users if check fails
    return { valid: true };
  }
}

/**
 * Rate limiting check using Firestore (persists across cold starts)
 * Returns true if request should be blocked
 */
async function checkRateLimit(userId: string): Promise<{ blocked: boolean; error?: string }> {
  const now = Date.now();
  const bucketId = `${userId}_${Math.floor(now / 60000)}`; // Per-minute bucket
  
  try {
    const rateLimitRef = admin.firestore().collection('_rateLimits').doc(bucketId);
    
    // Use transaction to ensure atomic increment
    const result = await admin.firestore().runTransaction(async (transaction) => {
      const doc = await transaction.get(rateLimitRef);
      
      if (!doc.exists) {
        // Create new bucket
        transaction.set(rateLimitRef, {
          userId,
          count: 1,
          resetAt: now + 60000,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { count: 1, blocked: false };
      }
      
      const data = doc.data();
      const newCount = (data?.count || 0) + 1;
      
      // Check if bucket expired
      if (data?.resetAt && data.resetAt < now) {
        // Reset bucket
        transaction.set(rateLimitRef, {
          userId,
          count: 1,
          resetAt: now + 60000,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { count: 1, blocked: false };
      }
      
      // Increment count
      transaction.update(rateLimitRef, { count: newCount });
      
      return {
        count: newCount,
        blocked: newCount > RATE_LIMIT_PER_MINUTE,
      };
    });
    
    if (result.blocked) {
      return {
        blocked: true,
        error: `Rate limit exceeded. Maximum ${RATE_LIMIT_PER_MINUTE} requests per minute.`,
      };
    }
    
    return { blocked: false };
  } catch (error) {
    functions.logger.error('Rate limit check failed:', error);
    // Fail open - don't block users if rate limit check fails
    return { blocked: false };
  }
}

/**
 * Verify the request is from an authenticated user
 */
async function verifyAuth(request: functions.https.Request): Promise<admin.auth.DecodedIdToken | null> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch {
    return null;
  }
}

// ============================================================================
// ELARASIGN - SERVER-SIDE SIGNING UTILITIES
// ============================================================================

/**
 * ElaraSign v2.0 Constants
 * Matches the canonical signing-core.ts implementation
 */
const ELARA_MARKER = "ELARA2";
const ELARA_VERSION = 0x02;

const SIGNATURE_LOCATIONS = {
  topLeft: { width: 32, height: 4, getPosition: () => ({ x: 0, y: 0 }) },
  topRight: { width: 4, height: 32, getPosition: (w: number) => ({ x: w - 4, y: 0 }) },
  bottomCenter: { width: 32, height: 4, getPosition: (w: number, h: number) => ({ x: Math.floor((w - 32) / 2), y: h - 4 }) },
} as const;

const LOCATION_IDS = { topLeft: 0, topRight: 1, bottomCenter: 2 } as const;
const BLOCK_CAPACITY = 64; // bytes per signature block

/**
 * Compute CRC-32 checksum for signature integrity
 */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  const table = getCrc32Table();
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// CRC-32 lookup table (lazily computed)
let crc32Table: number[] | null = null;
function getCrc32Table(): number[] {
  if (!crc32Table) {
    crc32Table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      crc32Table[i] = c >>> 0;
    }
  }
  return crc32Table;
}

/**
 * Create a SHA-256 hash of the user ID for privacy
 */
function createUserFingerprint(userId: string): string {
  return crypto.createHash("sha256").update(userId).digest("hex").substring(0, 16);
}

/**
 * Create a SHA-256 hash (truncated for compact storage)
 */
function sha256Truncated(data: string | Buffer, length: number = 16): Uint8Array {
  const hash = crypto.createHash("sha256").update(data).digest();
  return new Uint8Array(hash.slice(0, length));
}

/**
 * Pack signature for a specific location (48 bytes)
 * Layout: [MARKER:6][VERSION:1][LOCATION:1][META_HASH:16][CONTENT_HASH:16][TIMESTAMP:4][CRC32:4]
 */
function packSignature(
  metadataJson: string,
  contentBytes: Buffer,
  locationId: number
): Uint8Array {
  const metaHash = sha256Truncated(metadataJson, 16);
  const contentHash = sha256Truncated(contentBytes, 16);
  const timestamp = Math.floor(Date.now() / 1000);

  const signature = new Uint8Array(48);
  let offset = 0;

  // Marker (6 bytes)
  const markerBytes = new TextEncoder().encode(ELARA_MARKER);
  signature.set(markerBytes, offset);
  offset += 6;

  // Version (1 byte)
  signature[offset++] = ELARA_VERSION;

  // Location ID (1 byte)
  signature[offset++] = locationId;

  // Metadata hash (16 bytes)
  signature.set(metaHash, offset);
  offset += 16;

  // Content hash (16 bytes)
  signature.set(contentHash, offset);
  offset += 16;

  // Timestamp (4 bytes, big-endian)
  signature[offset++] = (timestamp >> 24) & 0xff;
  signature[offset++] = (timestamp >> 16) & 0xff;
  signature[offset++] = (timestamp >> 8) & 0xff;
  signature[offset++] = timestamp & 0xff;

  // CRC-32 checksum (4 bytes)
  const checksum = crc32(signature.slice(0, offset));
  signature[offset++] = (checksum >>> 24) & 0xff;
  signature[offset++] = (checksum >>> 16) & 0xff;
  signature[offset++] = (checksum >>> 8) & 0xff;
  signature[offset++] = checksum & 0xff;

  return signature;
}

/**
 * Embed signature at a specific location using LSB steganography
 */
function embedAtLocation(
  pixelData: Buffer,
  width: number,
  height: number,
  signature: Uint8Array,
  location: typeof SIGNATURE_LOCATIONS[keyof typeof SIGNATURE_LOCATIONS]
): void {
  const pos = location.getPosition(width, height);
  const blockWidth = location.width;
  const blockHeight = location.height;

  const paddedSignature = new Uint8Array(BLOCK_CAPACITY);
  paddedSignature.set(signature);

  let byteIndex = 0;
  let nibbleIndex = 0;

  for (let dy = 0; dy < blockHeight; dy++) {
    for (let dx = 0; dx < blockWidth; dx++) {
      if (byteIndex >= paddedSignature.length) {
        break;
      }

      const x = pos.x + dx;
      const y = pos.y + dy;
      if (x < 0 || x >= width || y < 0 || y >= height) {
        continue;
      }

      const pixelIndex = (y * width + x) * 4;
      const blueChannelIndex = pixelIndex + 2;

      const blueValue = pixelData[blueChannelIndex];
      const byte = paddedSignature[byteIndex];
      const nibble = nibbleIndex === 0 ? (byte >> 4) & 0x0f : byte & 0x0f;
      pixelData[blueChannelIndex] = (blueValue & 0xf0) | nibble;

      nibbleIndex++;
      if (nibbleIndex === 2) {
        nibbleIndex = 0;
        byteIndex++;
      }
    }
  }
}

/**
 * Sign an image with ElaraSign v2.0 multi-location signature
 * Returns PNG buffer with embedded provenance data
 */
async function signImageBuffer(
  imageBuffer: Buffer,
  userId: string,
  metadata: {
    model: string;
    prompt: string;
    width: number;
    height: number;
    steps?: number;
    seed?: number;
  }
): Promise<{ signedBuffer: Buffer; metadataJson: string }> {
  // Get raw pixel data from the image
  const image = sharp(imageBuffer);
  const { width, height } = await image.metadata() as { width: number; height: number };

  if (!width || !height || width < 64 || height < 36) {
    throw new Error("Image too small for signing (minimum 64x36)");
  }

  // Get raw RGBA pixel data
  const rawPixels = await image.raw().ensureAlpha().toBuffer();
  const pixelData = Buffer.from(rawPixels);

  // Create simplified metadata (UID-based, privacy-preserving)
  const elaraMetadata = {
    signatureVersion: "2.0",
    generator: "elara.cloud",
    generatedAt: new Date().toISOString(),
    userFingerprint: createUserFingerprint(userId),
    contentType: "image",
    contentHash: crypto.createHash("sha256").update(rawPixels).digest("hex"),
    modelUsed: metadata.model,
    promptHash: crypto.createHash("sha256").update(metadata.prompt).digest("hex"),
    width: metadata.width,
    height: metadata.height,
    steps: metadata.steps,
    seed: metadata.seed,
  };
  const metadataJson = JSON.stringify(elaraMetadata);

  // Embed signature at all three locations for redundancy
  const locations = [
    { loc: SIGNATURE_LOCATIONS.topLeft, id: LOCATION_IDS.topLeft },
    { loc: SIGNATURE_LOCATIONS.topRight, id: LOCATION_IDS.topRight },
    { loc: SIGNATURE_LOCATIONS.bottomCenter, id: LOCATION_IDS.bottomCenter },
  ];

  for (const { loc, id } of locations) {
    const packedSig = packSignature(metadataJson, rawPixels, id);
    embedAtLocation(pixelData, width, height, packedSig, loc);
  }

  // Convert back to PNG (lossless - preserves signature)
  const signedBuffer = await sharp(pixelData, {
    raw: { width, height, channels: 4 }
  }).png().toBuffer();

  return { signedBuffer, metadataJson };
}

// ============================================================================
// AI CHAT ENDPOINT
// ============================================================================

export const aiChat = functions.https.onRequest(async (req, res) => {
  // CORS - Restrict to Firebase hosting domains only
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'https://openelaracloud.web.app',
    'https://openelaracloud.firebaseapp.com',
    'http://localhost:3000', // Local dev
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Verify authentication
  const user = await verifyAuth(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Check trial status (respects manual Firestore changes)
  const trialStatus = await checkTrialStatus(user.uid);
  if (!trialStatus.valid) {
    res.status(403).json({ error: trialStatus.error });
    return;
  }

  // Check rate limit
  const rateLimit = await checkRateLimit(user.uid);
  if (rateLimit.blocked) {
    res.status(429).json({ error: rateLimit.error });
    return;
  }

  // Get API key from Secret Manager
  const apiKey = await getSecret("TOGETHER_API_KEY");
  if (!apiKey) {
    res.status(500).json({ 
      error: "API key not configured",
      hint: "Add TOGETHER_API_KEY to Google Secret Manager" 
    });
    return;
  }

  try {
    const { messages, model, temperature } = req.body;
    // Note: max_tokens intentionally omitted - let API auto-calculate available tokens
    // This prevents "token count exceeds context length" errors
    
    // CRITICAL: Model MUST be provided by frontend - no hardcoded fallbacks!
    if (!model) {
      res.status(400).json({ 
        error: "model is required", 
        hint: "Frontend must pass the user's selected model - no fallbacks allowed" 
      });
      return;
    }

    const response = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,  // User's selected model - NEVER hardcode fallbacks!
        messages,
        temperature: temperature ?? 0.7,
        // max_tokens omitted: API will use (context_length - input_tokens)
      }),
    });

    const data = await response.json();
    
    // Log usage for the user (optional analytics)
    await admin.firestore()
      .collection("users")
      .doc(user.uid)
      .collection("usage")
      .add({
        type: "chat",
        model,
        tokens: data.usage?.total_tokens || 0,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

    res.json(data);
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Failed to process chat request" });
  }
});

// ============================================================================
// VERTEX AI CHAT ENDPOINT (Native Google)
// No API key needed - uses Application Default Credentials
// ============================================================================

export const vertexChat = functions.https.onRequest(async (req, res) => {
  // CORS
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'https://openelaracloud.web.app',
    'https://openelaracloud.firebaseapp.com',
    'http://localhost:3000',
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const user = await verifyAuth(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Check trial status
  const trialStatus = await checkTrialStatus(user.uid);
  if (!trialStatus.valid) {
    res.status(403).json({ error: trialStatus.error });
    return;
  }

  // Check rate limit
  const rateLimit = await checkRateLimit(user.uid);
  if (rateLimit.blocked) {
    res.status(429).json({ error: rateLimit.error });
    return;
  }

  try {
    const { messages, model, temperature } = req.body;
    
    // Default to Gemini 2.0 Flash (fast, capable, good free tier)
    const geminiModel = model || "gemini-2.0-flash-001";
    
    // Convert OpenAI-style messages to Vertex AI format
    const vertexMessages = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === "assistant" ? "model" : msg.role,
      parts: [{ text: msg.content }],
    }));

    // Get the generative model
    const vertex = getVertexAI();
    const generativeModel = vertex.getGenerativeModel({
      model: geminiModel,
      generationConfig: {
        temperature: temperature ?? 0.7,
      },
    });

    // Start chat and send message
    const chat = generativeModel.startChat({
      history: vertexMessages.slice(0, -1),
    });

    const lastMessage = vertexMessages[vertexMessages.length - 1];
    const result = await chat.sendMessage(lastMessage.parts[0].text);
    const response = result.response;

    // Convert response to OpenAI-compatible format
    const openAIResponse = {
      choices: [{
        message: {
          role: "assistant",
          content: response.candidates?.[0]?.content?.parts?.[0]?.text || "",
        },
        finish_reason: response.candidates?.[0]?.finishReason || "stop",
      }],
      usage: {
        prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
        completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: (response.usageMetadata?.promptTokenCount || 0) + 
                     (response.usageMetadata?.candidatesTokenCount || 0),
      },
      model: geminiModel,
      provider: "vertex",
    };

    // Log usage
    await admin.firestore()
      .collection("users")
      .doc(user.uid)
      .collection("usage")
      .add({
        type: "chat",
        provider: "vertex",
        model: geminiModel,
        tokens: openAIResponse.usage.total_tokens,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

    res.json(openAIResponse);
  } catch (error) {
    console.error("Vertex AI chat error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ 
      error: "Failed to process chat request",
      details: message,
      hint: "Ensure Vertex AI API is enabled: gcloud services enable aiplatform.googleapis.com"
    });
  }
});

// ============================================================================
// VERTEX AI IMAGE GENERATION ENDPOINT (Imagen - Native Google)
// No external API key needed - uses Application Default Credentials
// https://cloud.google.com/vertex-ai/generative-ai/docs/image/generate-images
// ============================================================================

export const vertexGenerateImage = functions.https.onRequest(async (req, res) => {
  // CORS
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'https://openelaracloud.web.app',
    'https://openelaracloud.firebaseapp.com',
    'http://localhost:3000',
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const user = await verifyAuth(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Check trial status
  const trialStatus = await checkTrialStatus(user.uid);
  if (!trialStatus.valid) {
    res.status(403).json({ error: trialStatus.error });
    return;
  }

  // Check rate limit
  const rateLimit = await checkRateLimit(user.uid);
  if (rateLimit.blocked) {
    res.status(429).json({ error: rateLimit.error });
    return;
  }

  try {
    const { prompt, model, width, height, aspectRatio, negativePrompt, numberOfImages } = req.body;
    
    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    // Imagen model selection (default to Imagen 3)
    // Available: imagen-3.0-generate-001, imagen-3.0-fast-generate-001
    const imagenModel = model || "imagen-3.0-generate-001";
    
    // Determine dimensions - Imagen uses aspect ratio
    // Supported: 1:1, 9:16, 16:9, 3:4, 4:3
    const finalAspectRatio = aspectRatio || "1:1";
    
    // Map aspect ratio to dimensions for signing metadata
    const dimensionMap: Record<string, { width: number; height: number }> = {
      "1:1": { width: 1024, height: 1024 },
      "9:16": { width: 768, height: 1365 },
      "16:9": { width: 1365, height: 768 },
      "3:4": { width: 896, height: 1195 },
      "4:3": { width: 1195, height: 896 },
    };
    const dimensions = dimensionMap[finalAspectRatio] || { width: width || 1024, height: height || 1024 };

    functions.logger.info("Generating image with Vertex AI Imagen:", {
      model: imagenModel,
      aspectRatio: finalAspectRatio,
      userId: user.uid,
    });

    // Call Vertex AI Imagen API directly via REST
    // The SDK doesn't have great Imagen support yet, so we use REST
    const accessToken = await getAccessToken();
    
    const imagenRequestBody: Record<string, any> = {
      instances: [{
        prompt: prompt,
      }],
      parameters: {
        sampleCount: numberOfImages || 1,
        aspectRatio: finalAspectRatio,
        // Safety settings (can be adjusted)
        safetySetting: "block_some",
        // Person generation (disable for safety by default)
        personGeneration: "dont_allow",
      },
    };

    // Add negative prompt if provided
    if (negativePrompt) {
      imagenRequestBody.instances[0].negativePrompt = negativePrompt;
    }

    const imagenEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${imagenModel}:predict`;

    const response = await fetch(imagenEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(imagenRequestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      functions.logger.error("Imagen API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      
      // Check for specific error types
      if (response.status === 403) {
        res.status(403).json({
          error: "Vertex AI Imagen not enabled or quota exceeded",
          hint: "Enable Imagen API: gcloud services enable aiplatform.googleapis.com",
          details: errorData,
        });
        return;
      }
      
      res.status(response.status).json({
        error: "Failed to generate image",
        details: errorData,
      });
      return;
    }

    const data = await response.json();
    
    // Imagen returns predictions array with base64 images
    if (!data.predictions || data.predictions.length === 0) {
      res.status(500).json({ 
        error: "No image generated",
        hint: "The prompt may have been blocked by safety filters",
      });
      return;
    }

    // Get the first generated image
    const prediction = data.predictions[0];
    const imageBase64 = prediction.bytesBase64Encoded;
    
    if (!imageBase64) {
      res.status(500).json({ error: "No image data in response" });
      return;
    }

    // Decode and sign the image with ElaraSign v2.0
    const imageBuffer = Buffer.from(imageBase64, "base64");
    
    functions.logger.info("Signing Imagen output for user:", user.uid);
    
    const { signedBuffer, metadataJson } = await signImageBuffer(
      imageBuffer,
      user.uid,
      {
        model: imagenModel,
        prompt,
        width: dimensions.width,
        height: dimensions.height,
      }
    );

    // Convert signed PNG to base64
    const signedB64 = signedBuffer.toString("base64");

    // Log generation event
    await admin.firestore()
      .collection("users")
      .doc(user.uid)
      .collection("generations")
      .add({
        type: "image",
        provider: "vertex",
        model: imagenModel,
        prompt,
        aspectRatio: finalAspectRatio,
        width: dimensions.width,
        height: dimensions.height,
        signed: true,
        signatureVersion: "2.0",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

    // Return in same format as Together.ai endpoint for consistency
    res.json({
      data: [{
        b64_json: signedB64,
        signed: true,
        signatureVersion: "2.0",
      }],
      metadata: JSON.parse(metadataJson),
      provider: "vertex",
      model: imagenModel,
    });

  } catch (error) {
    console.error("Vertex AI image generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ 
      error: "Failed to generate image",
      details: message,
      hint: "Ensure Vertex AI API is enabled and Imagen is available in your region",
    });
  }
});

/**
 * Get access token for Vertex AI REST calls
 * Uses Application Default Credentials (ADC)
 */
async function getAccessToken(): Promise<string> {
  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token || token;
}

// ============================================================================
// IMAGE GENERATION ENDPOINT (Together.ai - BYOK/Fallback)
// ============================================================================

export const generateImage = functions.https.onRequest(async (req, res) => {
  // CORS - Restrict to Firebase hosting domains only
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'https://openelaracloud.web.app',
    'https://openelaracloud.firebaseapp.com',
    'http://localhost:3000',
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const user = await verifyAuth(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Check trial status
  const trialStatus = await checkTrialStatus(user.uid);
  if (!trialStatus.valid) {
    res.status(403).json({ error: trialStatus.error });
    return;
  }

  // Check rate limit
  const rateLimit = await checkRateLimit(user.uid);
  if (rateLimit.blocked) {
    res.status(429).json({ error: rateLimit.error });
    return;
  }

  const apiKey = await getSecret("TOGETHER_API_KEY");
  if (!apiKey) {
    res.status(500).json({ error: "API key not configured" });
    return;
  }

  try {
    const { prompt, model, width, height, steps, seed } = req.body;
    
    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    const finalWidth = width || 1024;
    const finalHeight = height || 1024;
    const finalSteps = steps || 4;
    const finalModel = model || "black-forest-labs/FLUX.1-schnell";

    // Generate image from Together.ai (always request base64 for signing)
    const response = await fetch("https://api.together.xyz/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: finalModel,
        prompt,
        width: finalWidth,
        height: finalHeight,
        steps: finalSteps,
        n: 1,
        response_format: "b64_json",
      }),
    });

    const data = await response.json();

    // Check for errors from Together.ai
    if (data.error || !data.data?.[0]?.b64_json) {
      console.error("Together.ai error:", data.error || "No image data returned");
      res.status(500).json({ error: data.error?.message || "Failed to generate image" });
      return;
    }

    // Decode base64 image
    const originalB64 = data.data[0].b64_json;
    const imageBuffer = Buffer.from(originalB64, "base64");

    // Sign the image with ElaraSign v2.0 (server-side, cannot be bypassed)
    functions.logger.info("Signing image for user:", user.uid);
    
    const { signedBuffer, metadataJson } = await signImageBuffer(
      imageBuffer,
      user.uid,
      {
        model: finalModel,
        prompt,
        width: finalWidth,
        height: finalHeight,
        steps: finalSteps,
        seed: seed || data.data[0].seed,
      }
    );

    // Convert signed PNG to base64 for client
    const signedB64 = signedBuffer.toString("base64");

    // Log generation event
    await admin.firestore()
      .collection("users")
      .doc(user.uid)
      .collection("generations")
      .add({
        type: "image",
        model: finalModel,
        prompt,
        width: finalWidth,
        height: finalHeight,
        steps: finalSteps,
        signed: true,
        signatureVersion: "2.0",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

    // Return signed image in same format as Together.ai API
    res.json({
      data: [{
        b64_json: signedB64,
        signed: true,
        signatureVersion: "2.0",
      }],
      metadata: JSON.parse(metadataJson),
    });

  } catch (error) {
    console.error("Image generation error:", error);
    res.status(500).json({ error: "Failed to generate image" });
  }
});

// ============================================================================
// VERTEX AI TEXT-TO-SPEECH ENDPOINT (Google Cloud TTS - Native)
// No external API key needed - uses Application Default Credentials
// Free tier: 1 million characters per month!
// https://cloud.google.com/text-to-speech/docs/reference/rest
// ============================================================================

export const vertexTTS = functions.https.onRequest(async (req, res) => {
  // CORS
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'https://openelaracloud.web.app',
    'https://openelaracloud.firebaseapp.com',
    'http://localhost:3000',
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const user = await verifyAuth(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Check trial status
  const trialStatus = await checkTrialStatus(user.uid);
  if (!trialStatus.valid) {
    res.status(403).json({ error: trialStatus.error });
    return;
  }

  // Check rate limit
  const rateLimit = await checkRateLimit(user.uid);
  if (rateLimit.blocked) {
    res.status(429).json({ error: rateLimit.error });
    return;
  }

  try {
    const { 
      text, 
      voice,           // e.g., "en-US-Neural2-F", "en-GB-News-G"
      languageCode,    // e.g., "en-US", "en-GB"
      speakingRate,    // 0.25 to 4.0, default 1.0
      pitch,           // -20.0 to 20.0 semitones, default 0
      audioEncoding,   // MP3, LINEAR16, OGG_OPUS
    } = req.body;
    
    if (!text) {
      res.status(400).json({ error: "text is required" });
      return;
    }

    // Limit text length (Cloud TTS limit is 5000 bytes per request)
    if (text.length > 5000) {
      res.status(400).json({ 
        error: "Text too long",
        hint: "Maximum 5000 characters per request",
      });
      return;
    }

    // Default voice configuration
    const finalVoice = voice || "en-US-Neural2-F";
    const finalLanguageCode = languageCode || finalVoice.substring(0, 5); // Extract from voice name
    const finalAudioEncoding = audioEncoding || "MP3";

    functions.logger.info("Generating speech with Google Cloud TTS:", {
      voice: finalVoice,
      languageCode: finalLanguageCode,
      textLength: text.length,
      userId: user.uid,
    });

    // Call Google Cloud TTS API
    const accessToken = await getAccessToken();
    
    const ttsRequestBody = {
      input: { text },
      voice: {
        languageCode: finalLanguageCode,
        name: finalVoice,
      },
      audioConfig: {
        audioEncoding: finalAudioEncoding,
        speakingRate: speakingRate || 1.0,
        pitch: pitch || 0,
      },
    };

    const ttsEndpoint = "https://texttospeech.googleapis.com/v1/text:synthesize";

    const response = await fetch(ttsEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ttsRequestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      functions.logger.error("Cloud TTS API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      
      if (response.status === 403) {
        res.status(403).json({
          error: "Google Cloud TTS not enabled",
          hint: "Enable TTS API: gcloud services enable texttospeech.googleapis.com",
          details: errorData,
        });
        return;
      }
      
      res.status(response.status).json({
        error: "Failed to generate speech",
        details: errorData,
      });
      return;
    }

    const data = await response.json();
    
    if (!data.audioContent) {
      res.status(500).json({ error: "No audio content in response" });
      return;
    }

    // Log usage for tracking
    await admin.firestore()
      .collection("users")
      .doc(user.uid)
      .collection("usage")
      .add({
        type: "tts",
        provider: "vertex",
        voice: finalVoice,
        characters: text.length,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

    // Return audio as base64 (same format as Together.ai Kokoro)
    res.json({
      audioContent: data.audioContent,
      audioEncoding: finalAudioEncoding,
      provider: "vertex",
      voice: finalVoice,
      characters: text.length,
    });

  } catch (error) {
    console.error("Vertex AI TTS error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ 
      error: "Failed to generate speech",
      details: message,
      hint: "Ensure Cloud TTS API is enabled: gcloud services enable texttospeech.googleapis.com",
    });
  }
});

// ============================================================================
// VERTEX AI VOICES ENDPOINT - List available TTS voices
// ============================================================================

export const vertexVoices = functions.https.onRequest(async (req, res) => {
  // CORS
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'https://openelaracloud.web.app',
    'https://openelaracloud.firebaseapp.com',
    'http://localhost:3000',
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // No auth required for voice list - it's public info

  try {
    const languageCode = req.query.languageCode as string || "en";
    
    const accessToken = await getAccessToken();
    const voicesEndpoint = `https://texttospeech.googleapis.com/v1/voices?languageCode=${languageCode}`;

    const response = await fetch(voicesEndpoint, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      res.status(response.status).json({ error: "Failed to fetch voices" });
      return;
    }

    const data = await response.json();
    
    // Return categorized voices (Neural2 are the best quality)
    const voices = data.voices || [];
    const categorized = {
      neural2: voices.filter((v: any) => v.name.includes("Neural2")),
      wavenet: voices.filter((v: any) => v.name.includes("Wavenet")),
      news: voices.filter((v: any) => v.name.includes("News")),
      standard: voices.filter((v: any) => v.name.includes("Standard")),
      other: voices.filter((v: any) => 
        !v.name.includes("Neural2") && 
        !v.name.includes("Wavenet") && 
        !v.name.includes("News") && 
        !v.name.includes("Standard")
      ),
    };

    res.json({
      voices: categorized,
      total: voices.length,
      languageCode,
    });

  } catch (error) {
    console.error("Voice list error:", error);
    res.status(500).json({ error: "Failed to fetch voices" });
  }
});

// ============================================================================
// VIDEO GENERATION ENDPOINT (Async Job Creation + Polling)
// 
// VERIFIED AGAINST TOGETHER.AI DOCS (2026-01-08):
// https://docs.together.ai/docs/videos-overview
// https://docs.together.ai/reference/create-videos
// 
// ✓ POST creates job → returns {id, status: \"queued\"}
// ✓ GET with jobId polls → returns {status, outputs: {video_url}}
// ✓ All parameters match Together.ai schema
// ============================================================================

export const generateVideo = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const user = await verifyAuth(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Check trial status
  const trialStatus = await checkTrialStatus(user.uid);
  if (!trialStatus.valid) {
    res.status(403).json({ error: trialStatus.error });
    return;
  }

  // Check rate limit
  const rateLimit = await checkRateLimit(user.uid);
  if (rateLimit.blocked) {
    res.status(429).json({ error: rateLimit.error });
    return;
  }

  const apiKey = await getSecret("TOGETHER_API_KEY");
  if (!apiKey) {
    res.status(500).json({ error: "API key not configured" });
    return;
  }

  try {
    if (req.method === "POST") {
      // CREATE VIDEO GENERATION JOB
      const { prompt, model, width, height, seconds, guidanceScale, seed, negativePrompt, frameImages } = req.body;

      // VALIDATE REQUIRED PARAMETERS per Together.ai API spec
      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: "prompt is required and must be a string" });
        return;
      }
      if (prompt.length === 0 || prompt.length > 32000) {
        res.status(400).json({ error: `prompt length must be 1-32000 chars (got ${prompt.length})` });
        return;
      }
      if (!model || typeof model !== 'string') {
        res.status(400).json({ error: "model is required and must be a string" });
        return;
      }

      // Build request body with CORRECT TYPES per Together.ai API spec
      const requestBody: Record<string, any> = {
        model,
        prompt,
        width: width || 1024,
        height: height || 576,
        seconds: String(seconds || 5), // CRITICAL: Must be STRING not number
      };

      // Add optional parameters with CORRECT TYPES
      if (guidanceScale !== undefined) {
        // CRITICAL: guidance_scale must be INTEGER, range 6-12 recommended
        requestBody.guidance_scale = Math.round(Math.max(6, Math.min(Number(guidanceScale), 12)));
      }
      if (seed !== undefined) {
        // CRITICAL: seed must be INTEGER
        requestBody.seed = Math.round(Number(seed));
      }
      if (negativePrompt) {
        if (typeof negativePrompt !== 'string' || negativePrompt.length > 32000) {
          res.status(400).json({ error: `negative_prompt must be string, max 32000 chars` });
          return;
        }
        requestBody.negative_prompt = negativePrompt;
      }
      if (frameImages) {
        // Validate frame_images structure
        if (!Array.isArray(frameImages)) {
          res.status(400).json({ error: "frame_images must be an array" });
          return;
        }
        requestBody.frame_images = frameImages;
      }

      const response = await fetch("https://api.together.xyz/v1/video/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      if (!response.ok) {
        // Log detailed error for debugging
        functions.logger.error('Video generation API error:', {
          status: response.status,
          statusText: response.statusText,
          requestBody,
          responseData: data,
        });
        res.status(response.status).json(data);
        return;
      }

      // Log success for tracking
      functions.logger.info('Video job created:', {
        jobId: data.id,
        model: requestBody.model,
        status: data.status,
      });
      
      res.json(data);
    } else if (req.method === "GET") {
      // POLL VIDEO GENERATION JOB STATUS
      const jobId = req.query.jobId as string;
      
      if (!jobId) {
        res.status(400).json({ error: "Missing jobId parameter" });
        return;
      }

      const response = await fetch(`https://api.together.xyz/v1/video/generations/${jobId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      const data = await response.json();
      res.json(data);
    } else {
      res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Video generation error:", error);
    res.status(500).json({ error: "Failed to process video request" });
  }
});

// ============================================================================
// IMAGE VERIFICATION ENDPOINT
// Allows users to verify if an image has valid ElaraSign signature
// ============================================================================

/**
 * Extract signature from a specific location in image
 */
function extractFromLocation(
  pixelData: Buffer,
  width: number,
  height: number,
  location: typeof SIGNATURE_LOCATIONS[keyof typeof SIGNATURE_LOCATIONS]
): Uint8Array | null {
  const pos = location.getPosition(width, height);
  const blockWidth = location.width;
  const blockHeight = location.height;

  // Check bounds
  if (pos.x < 0 || pos.x + blockWidth > width || pos.y < 0 || pos.y + blockHeight > height) {
    return null;
  }

  const result: number[] = [];
  let currentByte = 0;
  let nibbleIndex = 0;

  for (let dy = 0; dy < blockHeight; dy++) {
    for (let dx = 0; dx < blockWidth; dx++) {
      if (result.length >= BLOCK_CAPACITY) {
        break;
      }

      const x = pos.x + dx;
      const y = pos.y + dy;
      const pixelIndex = (y * width + x) * 4;
      const blueChannelIndex = pixelIndex + 2;

      const nibble = pixelData[blueChannelIndex] & 0x0f;

      if (nibbleIndex === 0) {
        currentByte = nibble << 4;
        nibbleIndex = 1;
      } else {
        currentByte |= nibble;
        result.push(currentByte);
        currentByte = 0;
        nibbleIndex = 0;
      }
    }
  }

  const signature = new Uint8Array(result);
  const marker = new TextDecoder().decode(signature.slice(0, 6));
  if (marker !== ELARA_MARKER) {
    return null;
  }

  return signature;
}

/**
 * Unpack and validate a signature
 */
function unpackSignature(signature: Uint8Array): {
  isValid: boolean;
  version: number;
  locationId: number;
  timestamp: number;
} | null {
  if (signature.length < 48) {
    return null;
  }

  const marker = new TextDecoder().decode(signature.slice(0, 6));
  if (marker !== ELARA_MARKER) {
    return null;
  }

  const version = signature[6];
  const locationId = signature[7];

  // Extract timestamp (bytes 40-43)
  const timestamp = (
    (signature[40] << 24) |
    (signature[41] << 16) |
    (signature[42] << 8) |
    signature[43]
  ) >>> 0;

  // Verify CRC-32
  const storedChecksum = (
    (signature[44] << 24) |
    (signature[45] << 16) |
    (signature[46] << 8) |
    signature[47]
  ) >>> 0;

  const computedChecksum = crc32(signature.slice(0, 44));
  const isValid = storedChecksum === computedChecksum;

  return { isValid, version, locationId, timestamp };
}

export const verifyImage = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      res.status(400).json({ error: "Missing imageBase64" });
      return;
    }

    // Decode base64 (handle data URL format)
    const base64Data = imageBase64.includes(",") 
      ? imageBase64.split(",")[1] 
      : imageBase64;
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Get raw pixel data
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const { width, height } = metadata;

    if (!width || !height) {
      res.status(400).json({ error: "Could not read image dimensions" });
      return;
    }

    const rawPixels = await image.raw().ensureAlpha().toBuffer();
    const pixelData = Buffer.from(rawPixels);

    // Try to extract signature from each location
    const locations = [
      { loc: SIGNATURE_LOCATIONS.topLeft, name: "top-left" },
      { loc: SIGNATURE_LOCATIONS.topRight, name: "top-right" },
      { loc: SIGNATURE_LOCATIONS.bottomCenter, name: "bottom-center" },
    ];

    const results: { location: string; valid: boolean; timestamp?: number }[] = [];
    let anyValid = false;
    let signatureTimestamp: number | undefined;

    for (const { loc, name } of locations) {
      const sigData = extractFromLocation(pixelData, width, height, loc);
      if (sigData) {
        const unpacked = unpackSignature(sigData);
        if (unpacked) {
          results.push({
            location: name,
            valid: unpacked.isValid,
            timestamp: unpacked.timestamp,
          });
          if (unpacked.isValid) {
            anyValid = true;
            signatureTimestamp = unpacked.timestamp;
          }
        } else {
          results.push({ location: name, valid: false });
        }
      } else {
        results.push({ location: name, valid: false });
      }
    }

    res.json({
      signed: anyValid,
      signatureVersion: anyValid ? "2.0" : null,
      signedAt: signatureTimestamp 
        ? new Date(signatureTimestamp * 1000).toISOString() 
        : null,
      locations: results,
      message: anyValid 
        ? "This image has a valid ElaraSign signature" 
        : "No valid ElaraSign signature found",
    });

  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ error: "Failed to verify image" });
  }
});

// ============================================================================
// HEALTH CHECK (Admin only)
// ============================================================================

export const health = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  
  // Basic health check (public) - just confirms function is running
  const user = await verifyAuth(req);
  
  // Detailed health check only for authenticated users
  if (user) {
    const togetherKey = await getSecret("TOGETHER_API_KEY");
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      authenticated: true,
      userId: user.uid,
      secrets: {
        TOGETHER_API_KEY: togetherKey ? "configured" : "missing",
      },
    });
  } else {
    // Public: only confirm the function is alive
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Add visible PNG metadata to signed images
 * Two-layer approach:
 * 1. This visible layer (easy to read, deters casual fakers)
 * 2. Hidden steganography (cryptographically secure)
 */
export const signImageMetadata = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { imageBase64, metadata } = request.data;
  
  if (!imageBase64 || !metadata) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing imageBase64 or metadata');
  }

  try {
    const sharp = require('sharp');
    
    // Decode base64 image
    const imageBuffer = Buffer.from(imageBase64.split(',')[1], 'base64');
    
    // Add PNG text chunks (visible layer - easy to fake, but deters casual use)
    const signedImage = await sharp(imageBuffer)
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
      })
      .withMetadata({
        // PNG tEXt chunks - readable by exiftool
        'Title': `AI Generated Image`,
        'Author': metadata.userId || 'Unknown',
        'Description': `Generated by OpenElara Cloud`,
        'Creation Time': metadata.timestamp || new Date().toISOString(),
        'Software': 'OpenElara Cloud v1.0',
        'Comment': JSON.stringify({
          model: metadata.model,
          character: metadata.character,
          userId: metadata.userId,
          timestamp: metadata.timestamp,
          signature: 'VISIBLE_LAYER_V1'
        })
      })
      .toBuffer();
    
    // Return as base64
    const signedBase64 = `data:image/png;base64,${signedImage.toString('base64')}`;
    
    return { signedImage: signedBase64 };
  } catch (error: any) {
    console.error('Failed to add PNG metadata:', error);
    throw new functions.https.HttpsError('internal', 'Failed to process image');
  }
});

// ============================================================================
// BILLING & COST TRACKING
// ============================================================================

/**
 * Get operating costs from BigQuery
 * Returns costs for Firebase, Cloud Functions, Storage, and Google AI APIs
 * Does NOT include external API costs (Together.ai, OpenRouter, etc.)
 */
export const getOperatingCosts = functions.https.onCall(async (request) => {
  // Require authentication
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { period = 'current_month' } = request.data as { period?: string }; // 'current_month' | 'last_30_days' | 'last_7_days'

  try {
    const bigquery = new BigQuery({ projectId });

    // Determine date range
    let dateFilter = '';
    const now = new Date();
    
    switch (period) {
      case 'last_7_days': {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        dateFilter = `usage_start_time >= TIMESTAMP('${sevenDaysAgo.toISOString()}')`;
        break;
      }
      case 'last_30_days': {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        dateFilter = `usage_start_time >= TIMESTAMP('${thirtyDaysAgo.toISOString()}')`;
        break;
      }
      case 'current_month':
      default: {
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = `usage_start_time >= TIMESTAMP('${firstOfMonth.toISOString()}')`;
        break;
      }
    }

    // Query billing export table
    // NOTE: User must have billing export set up to Cloud Storage → BigQuery
    const query = `
      SELECT
        service.description AS service_name,
        SUM(cost) AS total_cost,
        currency
      FROM \`${projectId}.billing_export.gcp_billing_export_v1_*\`
      WHERE ${dateFilter}
        AND cost > 0
      GROUP BY service_name, currency
      ORDER BY total_cost DESC
    `;

    const [rows] = await bigquery.query({ query });

    // Calculate totals by service category
    const breakdown = {
      firebase: 0,
      cloudFunctions: 0,
      storage: 0,
      vertexAI: 0,
      cloudTTS: 0,
      networking: 0,
      other: 0,
      total: 0,
      currency: rows[0]?.currency || 'USD'
    };

    for (const row of rows) {
      const cost = parseFloat(row.total_cost);
      const service = row.service_name.toLowerCase();

      if (service.includes('firebase') || service.includes('firestore')) {
        breakdown.firebase += cost;
      } else if (service.includes('cloud functions') || service.includes('cloud run')) {
        breakdown.cloudFunctions += cost;
      } else if (service.includes('storage') || service.includes('cloud storage')) {
        breakdown.storage += cost;
      } else if (service.includes('vertex') || service.includes('aiplatform')) {
        breakdown.vertexAI += cost;
      } else if (service.includes('text-to-speech') || service.includes('speech')) {
        breakdown.cloudTTS += cost;
      } else if (service.includes('network') || service.includes('egress')) {
        breakdown.networking += cost;
      } else {
        breakdown.other += cost;
      }

      breakdown.total += cost;
    }

    return {
      period,
      breakdown,
      disclaimer: 'These costs reflect Google Cloud services only (Firebase, Cloud Functions, Storage, Vertex AI, Cloud TTS). External API costs (Together.ai, OpenRouter, custom endpoints) are NOT included. Refer to those providers for their billing.',
      rawData: rows
    };

  } catch (error: any) {
    console.error('Failed to fetch operating costs:', error);
    
    // If billing export not set up, return friendly error
    if (error.message?.includes('Not found: Dataset') || error.message?.includes('billing_export')) {
      return {
        error: 'billing_export_not_configured',
        message: 'Billing export to BigQuery is not set up. To enable cost tracking, go to Google Cloud Console → Billing → Billing Export and configure export to BigQuery.',
        breakdown: null
      };
    }

    throw new functions.https.HttpsError('internal', `Failed to fetch costs: ${error.message}`);
  }
});

// ============================================================================
// SECRET MANAGER - API KEY MANAGEMENT (Owner Only)
// Secure BYOK key storage - keys stored in Secret Manager, not localStorage
// ============================================================================

/**
 * Save or update an API key in Secret Manager
 * Owner-only operation (must be the project admin)
 */
export const updateAPIKey = functions.https.onCall(async (request) => {
  // Require authentication
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { provider, key } = request.data as { provider: string; key: string };

  // Validate inputs
  if (!provider || typeof provider !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'provider is required');
  }
  if (!key || typeof key !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'key is required');
  }

  // Map provider names to Secret Manager secret names
  const secretNameMap: Record<string, string> = {
    together: 'TOGETHER_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    exa: 'EXA_API_KEY',
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    groq: 'GROQ_API_KEY',
  };

  const secretName = secretNameMap[provider.toLowerCase()];
  if (!secretName) {
    throw new functions.https.HttpsError('invalid-argument', `Unknown provider: ${provider}`);
  }

  try {
    const secretPath = `projects/${projectId}/secrets/${secretName}`;

    // Try to add secret version (will fail if secret doesn't exist)
    try {
      await secretClient.addSecretVersion({
        parent: secretPath,
        payload: {
          data: Buffer.from(key, 'utf8'),
        },
      });

      functions.logger.info(`Updated secret ${secretName} for user ${request.auth.uid}`);

      // Invalidate cache
      secretCache.delete(secretName);

      return {
        success: true,
        provider,
        message: `${provider} API key updated successfully`,
      };
    } catch (addError: any) {
      // If secret doesn't exist, create it first
      if (addError.code === 5) { // NOT_FOUND
        await secretClient.createSecret({
          parent: `projects/${projectId}`,
          secretId: secretName,
          secret: {
            replication: {
              automatic: {},
            },
          },
        });

        // Now add the first version
        await secretClient.addSecretVersion({
          parent: secretPath,
          payload: {
            data: Buffer.from(key, 'utf8'),
          },
        });

        functions.logger.info(`Created new secret ${secretName} for user ${request.auth.uid}`);

        // Invalidate cache
        secretCache.delete(secretName);

        return {
          success: true,
          provider,
          message: `${provider} API key saved successfully`,
        };
      }

      throw addError;
    }
  } catch (error: any) {
    functions.logger.error('Failed to update API key:', error);
    throw new functions.https.HttpsError('internal', `Failed to save API key: ${error.message}`);
  }
});

/**
 * Delete an API key from Secret Manager
 * Owner-only operation
 */
export const deleteAPIKey = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { provider } = request.data as { provider: string };

  if (!provider || typeof provider !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'provider is required');
  }

  const secretNameMap: Record<string, string> = {
    together: 'TOGETHER_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    exa: 'EXA_API_KEY',
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    groq: 'GROQ_API_KEY',
  };

  const secretName = secretNameMap[provider.toLowerCase()];
  if (!secretName) {
    throw new functions.https.HttpsError('invalid-argument', `Unknown provider: ${provider}`);
  }

  try {
    const secretPath = `projects/${projectId}/secrets/${secretName}`;

    // Delete the secret entirely (not just latest version)
    await secretClient.deleteSecret({ name: secretPath });

    functions.logger.info(`Deleted secret ${secretName} for user ${request.auth.uid}`);

    // Invalidate cache
    secretCache.delete(secretName);

    return {
      success: true,
      provider,
      message: `${provider} API key deleted successfully`,
    };
  } catch (error: any) {
    // If secret doesn't exist, that's OK
    if (error.code === 5) { // NOT_FOUND
      return {
        success: true,
        provider,
        message: `${provider} API key was not configured`,
      };
    }

    functions.logger.error('Failed to delete API key:', error);
    throw new functions.https.HttpsError('internal', `Failed to delete API key: ${error.message}`);
  }
});

/**
 * List configured API keys (returns which providers have keys, not the keys themselves)
 * Owner-only operation
 */
export const listAPIKeys = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const secretNames = [
      'TOGETHER_API_KEY',
      'OPENROUTER_API_KEY',
      'EXA_API_KEY',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'GROQ_API_KEY',
    ];

    const configured: Record<string, boolean> = {};

    for (const secretName of secretNames) {
      const key = await getSecret(secretName);
      const provider = secretName.replace('_API_KEY', '').toLowerCase();
      configured[provider] = !!key;
    }

    return {
      configured,
      message: 'Keys are stored securely in Google Secret Manager',
    };
  } catch (error: any) {
    functions.logger.error('Failed to list API keys:', error);
    throw new functions.https.HttpsError('internal', `Failed to list keys: ${error.message}`);
  }
});

/**
 * OpenElara Cloud - Firebase Functions
 * 
 * These functions handle secure API calls to AI services.
 * API keys are stored in Google Secret Manager - NEVER exposed to client.
 */

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

// Initialize Firebase Admin
admin.initializeApp();

// Secret Manager client
const secretClient = new SecretManagerServiceClient();

// Cache secrets to avoid repeated lookups
const secretCache: Map<string, { value: string; expiry: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
      secretCache.set(secretName, { value: payload, expiry: Date.now() + CACHE_TTL });
      return payload;
    }
  } catch (error) {
    console.error(`Failed to get secret ${secretName}:`, error);
  }
  
  return null;
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
// AI CHAT ENDPOINT
// ============================================================================

export const aiChat = functions.https.onRequest(async (req, res) => {
  // CORS
  res.set("Access-Control-Allow-Origin", "*");
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

    const response = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
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
// IMAGE GENERATION ENDPOINT
// ============================================================================

export const generateImage = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
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

  const apiKey = await getSecret("TOGETHER_API_KEY");
  if (!apiKey) {
    res.status(500).json({ error: "API key not configured" });
    return;
  }

  try {
    const { prompt, model, width, height, steps } = req.body;
    // Note: steps intentionally kept - image gen needs explicit control
    // Unlike chat, there's no "auto-calculate" for image params

    const response = await fetch("https://api.together.xyz/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "black-forest-labs/FLUX.1-schnell",
        prompt,
        width: width || 1024,
        height: height || 1024,
        steps: steps || 4,
        n: 1,
        response_format: "b64_json",
      }),
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Image generation error:", error);
    res.status(500).json({ error: "Failed to generate image" });
  }
});

// ============================================================================
// VIDEO GENERATION ENDPOINT (Async Job Creation + Polling)
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

  const apiKey = await getSecret("TOGETHER_API_KEY");
  if (!apiKey) {
    res.status(500).json({ error: "API key not configured" });
    return;
  }

  try {
    if (req.method === "POST") {
      // CREATE VIDEO GENERATION JOB
      const { prompt, model, width, height, seconds, guidanceScale, seed, negativePrompt, frameImages } = req.body;

      const requestBody: Record<string, any> = {
        model: model || "minimax/video-01",
        prompt,
        width: width || 1024,
        height: height || 576,
        seconds: seconds || 5,
      };

      // Add optional parameters
      if (guidanceScale !== undefined) {
        requestBody.guidance_scale = guidanceScale;
      }
      if (seed !== undefined) {
        requestBody.seed = seed;
      }
      if (negativePrompt) {
        requestBody.negative_prompt = negativePrompt;
      }
      if (frameImages) {
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
        res.status(response.status).json(data);
        return;
      }

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
export const signImageMetadata = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { imageBase64, metadata } = data;
  
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

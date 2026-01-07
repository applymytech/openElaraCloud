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

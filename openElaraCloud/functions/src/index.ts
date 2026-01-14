/**
 * OpenElara Cloud - Firebase Functions
 *
 * These functions handle secure API calls to AI services.
 * API keys are stored in Google Secret Manager - NEVER exposed to client.
 */

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { VertexAI } from "@google-cloud/vertexai";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import fetch from "node-fetch";
import OpenAI from "openai";
import Exa from "exa-js";


// Initialize Firebase Admin
admin.initializeApp();

// Initialize Vertex AI
const vertex = new VertexAI({
  project: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '',
  location: 'us-central1'
});

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

// ===========================================================================
// AI CHAT ENDPOINT (ROUTER)
// ===========================================================================

export const aiChat = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const { modelId, provider, messages, tools } = data;

    try {
        switch (provider) {
            case 'vertex-ai':
                const model = vertex.getGenerativeModel({ model: modelId });
                const result = await model.generateContent({
                    contents: messages,
                    tools: tools,
                });
                return { response: result.response.candidates[0].content };

            case 'together-ai':
                const togetherApiKey = await getSecret('TOGETHER_API_KEY');
                if (!togetherApiKey) {
                    throw new functions.https.HttpsError('internal', 'TOGETHER_API_KEY secret not found.');
                }
                const togetherResponse = await fetch('https://api.together.xyz/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${togetherApiKey}`
                    },
                    body: JSON.stringify({
                        model: modelId,
                        messages: messages,
                    })
                });
                const togetherData = await togetherResponse.json();
                return { response: (togetherData as any).choices[0].message };

            case 'openrouter':
                const openRouterApiKey = await getSecret('OPENROUTER_API_KEY');
                if (!openRouterApiKey) {
                    throw new functions.https.HttpsError('internal', 'OPENROUTER_API_KEY secret not found.');
                }
                const openrouter = new OpenAI({
                    apiKey: openRouterApiKey,
                    baseURL: 'https://openrouter.ai/api/v1'
                });
                const openRouterResponse = await openrouter.chat.completions.create({
                    model: modelId,
                    messages: messages,
                });
                return { response: openRouterResponse.choices[0].message };

            default:
                throw new functions.https.HttpsError('invalid-argument', 'Unsupported provider.');
        }
    } catch (error) {
        console.error("Chat error:", error);
        throw new functions.https.HttpsError('internal', 'Failed to process chat request.');
    }
});


// ===========================================================================
// IMAGE GENERATION ENDPOINT
// ===========================================================================

export const generateImage = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const { modelId, provider, params } = data;

    // For now, only Vertex AI is supported for image generation
    if (provider !== 'vertex-ai') {
        throw new functions.https.HttpsError('invalid-argument', 'Unsupported provider for image generation.');
    }

    try {
        const model = vertex.getGenerativeModel({ model: modelId });
        const response = await model.generateContent({
            contents: [{
                role: "user",
                parts: [
                    { text: params.prompt },
                ]
            }],
        });

        const imageResponse = response.response;
        return imageResponse.candidates[0].content.parts[0].fileData;
    } catch (error) {
        console.error("Image generation error:", error);
        throw new functions.https.HttpsError('internal', 'Failed to generate image.');
    }
});

// ===========================================================================
// RESEARCH AGENT ENDPOINT (Exa.ai)
// ===========================================================================
export const researchAgent = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const { type, query, maxResults, url } = data;
    const exaApiKey = await getSecret('EXA_API_KEY');

    if (!exaApiKey) {
        throw new functions.https.HttpsError('internal', 'EXA_API_KEY secret not found.');
    }

    const exa = new Exa(exaApiKey);

    try {
        switch (type) {
            case 'search':
                const searchResults = await exa.search(query, {
                    numResults: maxResults || 10,
                    useAutoprompt: true,
                });
                return { results: searchResults };

            case 'answer':
                const answerResult = await exa.search(query, {
                    answer: true,
                });
                return { answer: answerResult };

            case 'crawl':
                if (!url) {
                    throw new functions.https.HttpsError('invalid-argument', 'A URL is required for crawling.');
                }
                const contentsResult = await exa.getContents([url]);
                return { contents: contentsResult };

            default:
                throw new functions.https.HttpsError('invalid-argument', 'Unsupported research agent type.');
        }
    } catch (error) {
        console.error("Research agent error:", error);
        throw new functions.https.HttpsError('internal', 'Research agent failed.');
    }
});


// ===========================================================================
// HEALTH CHECK
// ===========================================================================

export const health = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  // Quick check for keys in environment or secret manager for a more detailed health check
  const togetherApiKey = await getSecret('TOGETHER_API_KEY');
  const openRouterApiKey = await getSecret('OPENROUTER_API_KEY');
  const exaApiKey = await getSecret('EXA_API_KEY');


  res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        vertexAI: "configured",
        togetherAI: togetherApiKey ? "key_found" : "key_not_found",
        openRouter: openRouterApiKey ? "key_found" : "key_not_found",
        exa: exaApiKey ? "key_found" : "key_not_found",
      }
    });
});


export * from "./getModels";

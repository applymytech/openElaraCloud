import { onCall, HttpsError } from "firebase-functions/v2/https";
import fetch from "node-fetch";
import { getUserSecret } from "./secrets";

export const researchAgent = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const { type, query, maxResults, url } = request.data;
  const userId = request.auth.uid;
  
  // SECURE RETRIEVAL FROM SECRET MANAGER
  const apiKey = await getUserSecret(userId, "exa");

  if (!apiKey) {
      throw new HttpsError("failed-precondition", "Exa API Key not found in your Sovereign Vault. Please add it in Settings.");
  }

  try {
    let endpoint = "";
    let body: any = {};

    if (type === "search") {
      endpoint = "https://api.exa.ai/search";
      body = { query, numResults: maxResults || 5, useAutoprompt: true };
    } else if (type === "answer") {
      endpoint = "https://api.exa.ai/answer";
      body = { query };
    } else if (type === "crawl") {
      endpoint = "https://api.exa.ai/contents";
      body = { urls: [url] };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Exa API error: ${response.statusText}`);
    }

    return await response.json();

  } catch (error: any) {
    console.error("Research API Error:", error);
    throw new HttpsError("internal", error.message);
  }
});

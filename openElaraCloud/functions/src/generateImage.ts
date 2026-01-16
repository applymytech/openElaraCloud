import { onCall, HttpsError } from "firebase-functions/v2/https";
import fetch from "node-fetch";
import { getUserSecret } from "./secrets";

export const generateImage = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const { modelId, provider, params } = request.data;
  const userId = request.auth.uid;

  try {
    if (provider === "together-ai") {
      // SECURE RETRIEVAL FROM SECRET MANAGER
      const apiKey = await getUserSecret(userId, "together");
      
      if (!apiKey) {
        throw new Error("Together.ai API Key not found in your Sovereign Vault.");
      }

      const response = await fetch("https://api.together.xyz/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          prompt: params.prompt,
          negative_prompt: params.negative_prompt,
          steps: params.steps,
          width: params.width,
          height: params.height,
          guidance_scale: params.guidance_scale,
        }),
      });

      if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || "Together.ai image generation failed.");
      }

      return await response.json();
    }

    throw new Error(`Unsupported image provider: ${provider}`);

  } catch (error: any) {
    console.error("Image API Error:", error);
    throw new HttpsError("internal", error.message);
  }
});

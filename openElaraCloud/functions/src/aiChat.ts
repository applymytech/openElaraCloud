import { onCall, HttpsError } from "firebase-functions/v2/https";
import { VertexAI } from "@google-cloud/vertexai";
import OpenAI from "openai";
import { getUserSecret } from "./secrets";

export const aiChat = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const { modelId, provider, messages } = request.data;
  const userId = request.auth.uid;

  try {
    if (provider === "vertex-ai") {
      const vertexAI = new VertexAI({ 
        project: (process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT) as string, 
        location: "us-central1" 
      });
      const model = vertexAI.getGenerativeModel({ model: modelId });
      
      const history = messages.slice(0, -1).map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const lastMessage = messages[messages.length - 1].content;

      const chatSession = model.startChat({ history });
      const result = await chatSession.sendMessage(lastMessage);
      const response = result.response.candidates?.[0].content.parts[0].text;

      return { response: { role: "assistant", content: response } };
    } 
    
    if (provider === "together-ai" || provider === "openrouter") {
      // SECURE RETRIEVAL FROM SECRET MANAGER
      const service = provider === "together-ai" ? "together" : "openrouter";
      const apiKey = await getUserSecret(userId, service);
      
      if (!apiKey) {
        throw new Error(`API Key for ${provider} not found in your Sovereign Vault. Please add it in Settings.`);
      }

      const baseURL = provider === "together-ai" ? "https://api.together.xyz/v1" : "https://openrouter.ai/api/v1";
      const openai = new OpenAI({ apiKey, baseURL });

      const completion = await openai.chat.completions.create({
        model: modelId,
        messages: messages,
      });

      return { response: completion.choices[0].message };
    }

    throw new Error(`Unsupported provider: ${provider}`);

  } catch (error: any) {
    console.error("Chat API Error:", error);
    
    if (error.message?.includes("location") || error.message?.includes("region")) {
      return { 
        response: { 
          role: "assistant", 
          content: `> **Sovereignty Note:** The requested model (${modelId}) is not available in the current Google Cloud region. You can try selecting a different model or contact your administrator to enable additional regions for Vertex AI.` 
        } 
      };
    }

    throw new HttpsError("internal", error.message);
  }
});

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { saveUserSecret } from "./secrets";

/**
 * SECURE VAULT ROUTE
 * Allows a user to store their API keys in Google Secret Manager.
 */
export const storeUserSecret = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const { service, value } = request.data;
  const userId = request.auth.uid;

  if (!service || !value) {
    throw new HttpsError("invalid-argument", "Service and value are required.");
  }

  // Only allow specific services to prevent abuse
  const allowedServices = ["together", "openrouter", "exa", "elevenlabs"];
  if (!allowedServices.includes(service.toLowerCase())) {
    throw new HttpsError("invalid-argument", "Invalid service for Sovereign Vault.");
  }

  try {
    const result = await saveUserSecret(userId, service.toLowerCase(), value);
    return { 
      success: true, 
      message: `API Key for ${service} secured in your Sovereign Vault.`,
      secretId: result.secretId 
    };
  } catch (error: any) {
    throw new HttpsError("internal", error.message);
  }
});

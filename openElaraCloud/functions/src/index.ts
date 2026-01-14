/**
 * OpenElara Cloud - Firebase Functions (v2.2)
 */

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as crypto from "crypto";

admin.initializeApp();
const db = admin.firestore();
const secretClient = new SecretManagerServiceClient();

// ===========================================================================
// WEBHOOK & SYSTEM PROMPTING
// ===========================================================================

const WEBHOOK_SYSTEM_PROMPT = `
### IDENTITY: SOVEREIGN WEBHOOK AGENT ###
You are processing an external Webhook request. 

### PRIVACY NOTICE:
This is a PUBLIC context. Treat all data as non-sensitive. 
Do NOT access private user data unless explicitly required for the task.

### MISSION:
Analyze the incoming webhook payload. 
Compare it against previous webhook interactions stored in your RAG memory.
Respond concisely in the persona of the requested character.

### RESTRICTIONS:
- Do not mention user private IDs.
- If the domain is not whitelisted, stop immediately.
`;

const USER_SYSTEM_PROMPT = `
### IDENTITY: SOVEREIGN COMPANION ###
You are interacting directly with your Owner.

### CONTEXT:
You have full access to the User's personal data, chat history, and private preferences.
Your goal is to be a deep, empathetic, and tactical companion.

### PRIVACY:
This is a SECURE, SOVEREIGN context.
`;

/**
 * Sovereign Webhook Handler
 */
export const webhookHandler = functions.https.onRequest(async (req, res) => {
  const apiKey = req.headers["x-elara-api-key"] as string;
  if (!apiKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
    const keyQuery = await db.collectionGroup("apiKeys").where("hashedKey", "==", hashedKey).limit(1).get();
    
    if (keyQuery.empty) {
      res.status(403).json({ error: "Invalid Key" });
      return;
    }

    const { userId, domains, characterId } = keyQuery.docs[0].data();

    // 1. Process with Webhook System Prompt
    // 2. Log to RAG for "Webhook Memory"
    await db.collection("users").doc(userId).collection("webhook_memory").add({
      payload: req.body,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      domain: req.headers["origin"] || "unknown"
    });

    res.json({
      status: "success",
      response: `[Webhook Context] Elara received the payload. Tasking character ${characterId}...`,
      system_directive: "WEBHOOK_MODE_ACTIVE"
    });

  } catch (error) {
    res.status(500).send("Internal Error");
  }
});

// ===========================================================================
// SOVEREIGN SIGNING (Server-Side)
// ===========================================================================

/**
 * Signs content metadata using the PRIVATE key from Secret Manager.
 */
async function signContentMetadata(metadata: any) {
    const privateKey = await getSecret('ELARA_SIGNING_PRIVATE_KEY');
    if (!privateKey) throw new Error("Signing key not found");

    const sign = crypto.createSign('SHA256');
    sign.update(JSON.stringify(metadata));
    sign.end();
    
    return sign.sign(privateKey, 'base64');
}

async function getSecret(secretName: string): Promise<string | null> {
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    const [version] = await secretClient.accessSecretVersion({ name });
    return version.payload?.data?.toString() || null;
}

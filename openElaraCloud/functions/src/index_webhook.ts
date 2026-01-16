import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

export const webhookHandler = functions.https.onRequest(async (req, res) => {
  const db = admin.firestore();
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

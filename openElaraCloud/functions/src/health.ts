import { onCall } from "firebase-functions/v2/https";

export const health = onCall(async (request) => {
  return { 
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "2.2.0",
    environment: process.env.FUNCTIONS_EMULATOR ? "emulator" : "production"
  };
});

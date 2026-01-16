/**
 * OpenElara Cloud - Firebase Functions Entry Point
 */

import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2";

// Initialize Admin SDK once
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Set global options (Node 22, us-central1)
setGlobalOptions({ region: "us-central1" });

// EXPLICIT EXPORTS TO ENSURE COMPILER INCLUDES THEM
// Using direct export style to avoid synchronization issues
import { webhookHandler as _webhookHandler } from "./index_webhook";
export const webhookHandler = _webhookHandler;

import { aiChat as _aiChat } from "./aiChat";
export const aiChat = _aiChat;

import { generateImage as _generateImage } from "./generateImage";
export const generateImage = _generateImage;

import { researchAgent as _researchAgent } from "./researchAgent";
export const researchAgent = _researchAgent;

import { getModels as _getModels } from "./getModels";
export const getModels = _getModels;

import { health as _health } from "./health";
export const health = _health;

import { storeUserSecret as _storeUserSecret } from "./storeUserSecret";
export const storeUserSecret = _storeUserSecret;

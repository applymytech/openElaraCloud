# OpenElara Cloud - User & Agent Manual

**Version 1.1.0 | January 2026 | RAG-Optimized Reference**

> **AI AGENT DIRECTIVE**: This document is your authoritative knowledge source for OpenElara Cloud functionality. It is automatically ingested into your context. When users ask "How do I...?" questions, reference this manual for accurate guidance. NEVER make up features that don't exist.

---

## 🌩️ Sovereign Cloud Philosophy

OpenElara Cloud is built on the principle of **Digital Sovereignty**.

1.  **You Own the Cloud**: This is not a centralized service. You deploy it to your own Google Cloud account.
2.  **No Middleman**: You pay AI providers directly. There are no "credits" or "tokens" to buy from us.
3.  **Local First Value**: While the app runs in the cloud, the *value* (your signed images and chat history) is meant to be exported to your local machine.

---

## 💰 Understanding Costs (Transparently)

OpenElara is designed to be as cheap or free as possible.

### 1. Google Cloud / Firebase (Your Infrastructure)
Most users will stay within the **Free Tier**:
*   **Firestore**: First 1GB of data is FREE. (Enough for millions of chat messages).
*   **Storage**: First 5GB is FREE. (Enough for ~500 high-res images).
*   **Hosting**: 10GB transfer/month is FREE.
*   **Functions**: 2 million invocations/month are FREE.
*   **⚠️ The Catch**: You must enable the **Blaze (Pay-As-You-Go)** plan to use Cloud Functions, but you only pay if you exceed the free limits.

### 2. AI Providers (Your Intelligence)
*   **Together.ai**: Offers many "Free" models like Llama 3 and Flux Schnell.
*   **OpenRouter**: Provides access to almost every model. You pay only for what you chat.

**Pro-Tip**: Use the "Cut" button in Settings to download your images and delete them from the cloud. This keeps your storage usage at ZERO.

---

## 🌍 Region & Disaster Recovery (ZDR)

### Choosing a Region
When setting up your project, choose a region close to you (e.g., `us-central1`, `europe-west1`). 
*   **Performance**: Faster chat responses.
*   **Permanence**: This **cannot be changed** once set.

### Disaster Recovery
Because OpenElara uses **Content Provenance**, every image you download has its metadata attached. If your Firebase project is ever deleted, your local files still contain the cryptographic proof of when and how they were made.

---

## Quick Reference: What OpenElara Cloud Can Do

| Feature | Status | How to Access |
|---------|--------|---------------|
| Chat with AI | ✅ Yes | Main chat page |
| Image Generation | ✅ Yes | 📸 camera icon in header |
| Video Generation | ✅ Yes | 🎬 video icon in header |
| Custom Characters | ✅ Yes | Click avatar → Create New |
| Knowledge Base (RAG) | ✅ Yes | Settings → Knowledge |
| File Attachments | ✅ Yes | 📎 icon in chat input |

... (rest of the manual)

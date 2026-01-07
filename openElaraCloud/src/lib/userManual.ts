/**
 * OpenElara Cloud User Manual
 * 
 * This document is designed to be ingested into the RAG system
 * so Elara can reference it when users have questions about the app.
 * 
 * AUTO-SYNCED with package.json version on each build.
 * IMPORTANT: Keep this updated as features change!
 */

// Version from package.json - update this when releasing
export const APP_VERSION = '1.0.0';
export const MANUAL_VERSION = '1.0.0';
export const LAST_UPDATED = '2026-01-07';

export const USER_MANUAL_MARKDOWN = `
# OpenElara Cloud User Manual

Welcome to OpenElara Cloud - a sovereign AI assistant with unique creative capabilities.

---

## What Makes Elara Special

Unlike generic AI chat apps, OpenElara Cloud provides:

1. **Character System** - Chat with Elara or create your own AI characters with unique personalities and appearances
2. **Selfie Generation** - Generate images of your AI character using their detailed physical description
3. **Content Provenance** - Every generated image includes cryptographic signatures and metadata proving its origin
4. **Personal RAG** - Your conversation history and uploaded knowledge files enhance future conversations
5. **BYOK Privacy** - Your API keys stay in YOUR browser, never on our servers

---

## Getting Started

### Logging In
- OpenElara Cloud is invite-only
- You'll receive your email and temporary password from the administrator
- Log in at the main page, then change your password in Settings

### Setting Up BYOK (Bring Your Own Key)

**Together.ai is the PRIMARY provider** - it handles chat, images, video, and TTS.
Other providers use OpenAI-compatible REST API.

1. Go to **Settings** (⚙️ icon)
2. Enter your API keys:
   - **Together.ai** (REQUIRED) - Primary provider for everything
     - Chat with Llama, Mistral, Qwen, DeepSeek models
     - Image generation with FLUX models
     - Video generation
     - TTS with Kokoro voices
   - **OpenRouter** (Optional) - Access 100+ models via OpenAI-compatible API
   - **OpenAI** (Optional) - Direct access to GPT models
   - **ElevenLabs** (Optional) - Premium voice synthesis
3. Keys are stored **only in your browser** - never sent to our servers
4. API calls go DIRECTLY from your browser to the provider

---

## Features Guide

### Chat
- Type your message and press Enter (or click Send)
- Shift+Enter for new lines
- Elara remembers context within your conversation
- Quick prompts help you get started

### Character Switching
- Click Elara's avatar/icon in the header to open the Character menu
- Select from built-in characters (Elara, Architect) or your custom creations
- Each character has their own personality and appearance

### Creating Custom Characters
1. Open Character menu → "Create New Character"
2. Fill in the required fields:
   - **Name** - Your character's name
   - **Description** - Physical appearance (used for image generation)
   - **Safe Description** - Family-friendly version
   - **First-Person Description** - "I am..." version
   - **Attire** - Default clothing
   - **Negative Prompt** - Things to avoid in generations
   - **Persona** - Personality and communication style
3. Optional: Voice and Emotional profiles
4. Click Save - your character is ready to use!

### Generating Images & Selfies
1. Click the 📸 camera icon in the header
2. Choose mode:
   - **Selfie** - Uses the active character's description automatically
   - **Custom** - Write your own prompt
3. Select a model (FLUX.1 Schnell is free!)
4. For selfies, add an optional scene suggestion
5. Click Generate
6. Download with metadata to keep the provenance information

### Understanding Content Provenance

**This is what makes your generated content valuable!**

Every image Elara generates includes:
- **Content Hash** - Cryptographic fingerprint of the image
- **Installation ID** - Your unique browser identifier
- **Timestamp** - When it was created
- **Model Used** - Which AI model generated it
- **Prompt** - The text that created it (if you choose to include it)

When you download:
- You get the **image file** (PNG)
- You get the **metadata sidecar** (JSON file with provenance)
- These files prove YOU created this content with Elara

**Keep both files together!** The sidecar is what proves authenticity.

---

## Storage & Downloads

### Storage Philosophy

Cloud storage is **temporary**. Think of it as a staging area.

- **RAG data** (conversations, knowledge files) stays in the cloud to help Elara remember
- **Generated media** (images, videos, audio) should be **downloaded and deleted**

### Storage Quotas
- Default: **5 GB**
- Maximum: **10 GB** (contact admin to increase)
- RAG data is lightweight (text)
- Media files add up quickly - download them!

### The "Cut & Paste" Download System

When you download media:
1. You receive the **media file** + **metadata sidecar**
2. The file is **deleted from cloud storage** automatically
3. This is intentional! The value is in the signed local file

Think of it like a photo booth:
- The cloud is the booth - it creates and holds temporarily
- The download is you taking the photo home
- The receipt (sidecar) proves where it came from

---

## RAG (Retrieval-Augmented Generation)

### What is RAG?
RAG lets Elara reference your personal knowledge when chatting.

### Automatic RAG
- Your conversations are automatically saved and indexed
- Elara can recall things you've discussed before

### Custom Knowledge
1. Go to Settings → Knowledge Base
2. Upload files (.txt, .md supported)
3. These become part of Elara's context for your chats

### RAG Storage
- Stays in the cloud (doesn't count heavily against quota)
- Delete old conversations you don't need
- Keep relevant knowledge files for better assistance

---

## Privacy & Security

### Your API Keys (BYOK)
- Stored **only** in browser localStorage
- Protected by Same-Origin Policy (other sites can't read them)
- Never sent to our servers
- API calls go directly from your browser to providers (Together, OpenRouter, etc.)

### Your Data
- Conversations stored in Firestore (Firebase)
- Images stored in Firebase Storage (until downloaded)
- All data is user-scoped (only you can access yours)

### Best Practices
1. Use strong unique passwords
2. Log out on shared devices
3. Download your generated content regularly
4. Back up important conversations

---

## Troubleshooting

### "API Key Invalid"
- Check you've entered the key correctly in Settings
- Some providers require account verification first
- Test the key using the test button

### "Storage Quota Exceeded"
- Download and delete your generated media
- Check Settings for storage breakdown
- Contact admin if you need more space

### Images Not Generating
- Ensure you have a Together.ai key configured
- Free FLUX.1 Schnell model doesn't require billing
- Check for error messages in the generation panel

### Chat Not Responding
- Check your OpenRouter or OpenAI key is valid
- Try refreshing the page
- Check your internet connection

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Enter | Send message |
| Shift+Enter | New line in message |
| Esc | Close modals |

---

## Contact & Support

OpenElara Cloud is a sovereign AI tool - you control your experience.

For issues:
- Check this manual first (Elara knows it!)
- Contact your administrator

---

## Version Information

- **App Version**: 1.0.0
- **Last Updated**: January 2026
- **Platform**: Next.js 16 + Firebase
- **Node.js**: 22+

---

_This manual is part of your RAG knowledge base. Ask Elara anything about using the app!_
`;

export default USER_MANUAL_MARKDOWN;

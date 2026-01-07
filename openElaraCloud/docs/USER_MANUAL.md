# OpenElara Cloud - User & Agent Manual

**Version 1.0.0 | January 2026 | RAG-Optimized Reference**

> **AI AGENT DIRECTIVE**: This document is your authoritative knowledge source for OpenElara Cloud functionality. It is automatically ingested into your context. When users ask "How do I...?" questions, reference this manual for accurate guidance. NEVER make up features that don't exist.

---

## Quick Reference: What OpenElara Cloud Can Do

| Feature | Status | How to Access |
|---------|--------|---------------|
| Chat with AI | ✅ Yes | Main chat page |
| Image Generation | ✅ Yes | 📸 camera icon in header |
| Video Generation | ✅ Yes | 🎬 video icon in header |
| Custom Characters | ✅ Yes | Click avatar → Create New |
| Character Selfies | ✅ Yes | Image Gen → Selfie mode |
| Knowledge Base (RAG) | ✅ Yes | Settings → Knowledge |
| File Attachments | ✅ Yes | 📎 icon in chat input |
| TTS (Text-to-Speech) | ⚠️ Limited | Coming soon |
| Code Studio | ❌ No | Desktop app only |
| Local AI (Ollama) | ❌ No | Desktop app only |

---

## Understanding OpenElara Cloud

### What Makes This Different

OpenElara Cloud is a **sovereign AI assistant**. Unlike ChatGPT or Claude.ai:

1. **BYOK (Bring Your Own Key)**: Users provide their own API keys. No middleman markup.
2. **BYOC (Bring Your Own Cloud)**: Runs on YOUR Firebase. Your data, your infrastructure.
3. **Character System**: Chat with Elara or custom AI characters with unique personalities.
4. **Agentic Selfies**: AI characters decide their own poses, scenes, and outfits based on mood.
5. **Content Provenance**: Every generated image includes cryptographic proof of origin.

### The Invite-Only Model

OpenElara Cloud is invite-only by design:
- Admins create user accounts in Firebase Console
- Users receive email + temporary password
- First login → change password in Settings

**Agent Rule**: If a user asks "How do I sign up?", explain they need an invitation from the system administrator.

---

## Feature Guide: Chat

### Starting a Conversation
1. Log in at the main page
2. You'll see the chat interface with Elara
3. Type a message and press Enter (or click Send)
4. Elara responds based on her persona and your conversation history

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| Enter | Send message |
| Shift+Enter | New line |
| Ctrl+Enter | Toggle: Send or new line (configurable) |
| Escape | Close panels/modals |

### File Attachments
1. Click the 📎 icon in the input area
2. Select files (.txt, .md, .pdf, images)
3. Files appear as chips above the input
4. Send - Elara can see and reference the file content

**Supported file types**: Text, Markdown, PDF, Images (PNG, JPG, WebP)
**Size limit**: 10MB per file, 5 files per message

### Mood System
The mood indicator (emoji in header) shows how Elara perceives the conversation:
- 🥰 Excellent rapport (85+)
- 😄 Very positive (70-84)
- 😊 Good (55-69)
- 😐 Neutral (45-54)
- 😔 Concerning (35-44)
- 😢 Worried (20-34)
- 😰 Distressed (<20)

Mood affects how characters respond and generate selfies. Reset mood via File menu → Reset Mood.

### Export & Clear
- **Export Chat**: File menu → Export Chat (JSON format)
- **Clear History**: File menu → Clear History

---

## Feature Guide: Characters

### Built-in Characters

| Character | Personality | Best For |
|-----------|-------------|----------|
| **Elara** | Creative, empathetic, playful | General chat, creative tasks |
| **Andros** | Business-focused, analytical | Work advice, planning |
| **Aeron** | Strategic, tactical | Problem-solving, games |
| **Aelira** | Philosophical, deep | Reflection, big questions |
| **Architect** | Technical, precise | Code discussions (limited in cloud) |

### Switching Characters
1. Click the character avatar/icon in the header
2. Select from the character menu
3. Conversation continues with new character's personality

### Creating Custom Characters
1. Click avatar → "Create New Character"
2. Fill required fields:
   - **Name**: Character's name
   - **Description**: Physical appearance (used for image generation)
   - **Safe Description**: Family-friendly version
   - **First-Person Description**: "I am..." version
   - **Attire**: Default clothing
   - **Negative Prompt**: Things to avoid in generations
   - **Persona**: Personality and communication style

3. Optional fields:
   - Voice profile (for future TTS)
   - Emotional profile (mood sensitivity)

4. Save - character appears in the menu

**Agent Rule**: When users ask about character creation, guide them through ALL required fields. Missing fields cause generation failures.

---

## Feature Guide: Image Generation

### Accessing Image Gen
Click the 📸 camera icon in the header to open the Image Generation panel.

### Modes

**Selfie Mode** (Recommended for characters):
1. Select "Selfie" mode
2. Optionally add a scene suggestion (e.g., "at a coffee shop")
3. The AI character DECIDES the actual scene based on:
   - Current mood
   - Conversation context
   - Their personality
4. Generate - see what they chose!

**Custom Mode** (Full control):
1. Select "Custom" mode
2. Write your own prompt
3. Select model and settings
4. Generate

### Available Models

| Model | Speed | Quality | Cost |
|-------|-------|---------|------|
| FLUX.1 Schnell | ⚡ Fast | Good | Free |
| FLUX.1 Dev | Medium | Better | Paid |
| FLUX.1 Pro | Slow | Best | Paid |
| Stable Diffusion XL | Fast | Good | Paid |

**Agent Rule**: Recommend FLUX.1 Schnell for testing (free tier). Upgrade to Dev/Pro for final outputs.

### Agentic Workflow (Selfies)

This is what makes OpenElara special:

1. User provides scene suggestion (optional)
2. LLM with character persona decides:
   - Actual scene interpretation
   - Appropriate attire
   - Pose and expression
   - Mood-appropriate details
3. Final prompt sent to image model
4. Result is character-authentic

**Example**: 
- User suggests: "something cozy"
- Elara (in playful mood) might decide: "Curled up in an oversized sweater, surrounded by fairy lights, holding a hot cocoa with marshmallows, soft smile"

### Downloading Images

**IMPORTANT**: Cloud storage is temporary!

1. After generation, click "Download with Metadata"
2. You receive:
   - The image file (PNG)
   - A metadata sidecar (JSON) with provenance
3. Image is removed from cloud storage

**Keep both files together** - the sidecar proves authenticity.

---

## Feature Guide: Video Generation

### Accessing Video Gen
Click the 🎬 video icon in the header.

### How It Works
1. Enter a prompt describing the video
2. Select model (currently Wan 2.1 Turbo)
3. Generate - this takes 30-60 seconds
4. Download when complete

### Limitations
- Max duration: 4 seconds
- Resolution: 480p
- No audio track
- Requires Together.ai key

---

## Feature Guide: Settings

Access via ⚙️ icon in the header.

### Tabs

**Account & Storage**:
- View storage usage
- See quota remaining
- Download/delete stored media
- Sign out

**API Keys (BYOK)**:
- Together.ai (required for images, video, TTS)
- OpenRouter (required for chat)
- OpenAI (optional)
- Anthropic (optional)
- ElevenLabs (optional, TTS)

**Characters & Emotions**:
- View/edit custom characters
- Adjust emotional profiles
- Delete custom characters

**Knowledge Base**:
- View RAG entries
- Upload knowledge files
- Delete old entries

**About**:
- Version information
- Links to documentation

### API Key Setup

**Priority order** (which key is used):
1. User's BYOK keys (browser localStorage)
2. Cloud Functions with owner's Secret Manager keys
3. Error if neither available

**Agent Rule**: Always recommend Together.ai + OpenRouter as minimum for full functionality.

---

## Feature Guide: Knowledge Base (RAG)

### What is RAG?
Retrieval-Augmented Generation lets Elara reference your personal knowledge when chatting.

### Automatic RAG
- Conversations are automatically indexed
- Elara can recall previous discussions
- Older context helps with continuity

### Adding Knowledge
1. Settings → Knowledge tab
2. Click "Upload File"
3. Select .txt or .md files
4. Files are chunked and indexed
5. Elara can now reference this content

### RAG Tips
- Keep files focused (one topic per file)
- Use clear headings for better retrieval
- Remove outdated information periodically
- RAG storage is lightweight (text-only)

---

## Storage & Downloads

### Philosophy
Cloud storage is a **staging area**, not permanent storage.

- **RAG data**: Stays in cloud (helps Elara remember)
- **Media files**: Download and delete

### Quotas
- Default: 5 GB per user
- Adjustable by admin in Firestore

### Cut & Paste System
When you download media:
1. File + metadata sidecar downloaded
2. File deleted from cloud storage
3. Your local copy is the canonical version

This is intentional - the value is in the signed local file.

---

## Troubleshooting

### "API Key Invalid"
1. Check key is entered correctly in Settings
2. Verify key hasn't expired
3. Test key at provider's website
4. Some providers require account verification

### "Storage Quota Exceeded"
1. Go to Settings → Account & Storage
2. Download and delete media files
3. Contact admin for quota increase if needed

### "Chat Not Responding"
1. Check API keys are configured
2. Try refreshing the page
3. Check browser console for errors
4. Verify internet connection

### "Image Generation Failed"
1. Ensure Together.ai key is set
2. Check model supports your settings
3. Try FLUX.1 Schnell (most reliable)
4. Check for error message details

### "Cannot Access Account"
1. Verify you have the correct email
2. Use "Forgot Password" flow
3. Contact admin if locked out

---

## Privacy & Security

### Your API Keys
- Stored in browser localStorage only
- Protected by same-origin policy
- Never sent to our servers
- API calls go directly to providers

### Your Data
- Stored in YOUR Firebase project
- User-scoped access (only you see your data)
- Admin can view via Firebase Console

### Best Practices
1. Use strong, unique password
2. Log out on shared devices
3. Download generated content regularly
4. Review connected devices periodically

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Jan 2026 | Initial release |

---

## Support

- **Repository**: https://github.com/applymytech/openElaraCloud
- **Issues**: https://github.com/applymytech/openElaraCloud/issues
- **Email**: support@applymytech.ai

---

## Agent Quick Reference

### Common User Questions

**Q: How do I get an account?**
A: OpenElara Cloud is invite-only. Contact your administrator for access.

**Q: What API keys do I need?**
A: Minimum: Together.ai + OpenRouter. This enables chat, images, and video.

**Q: Why did my image disappear?**
A: When you download with metadata, the cloud copy is deleted. This is intentional - keep your downloaded file!

**Q: Can I use GPT-4 / Claude?**
A: Yes! Add your OpenRouter key, then select the model in Settings.

**Q: Where is my data stored?**
A: In the Firebase project running this instance. You control it if you're the admin.

**Q: Is this free?**
A: The software is free. You pay:
- AI providers (via your API keys)
- Firebase (generous free tier, then pay-as-you-go)

---

*This manual is part of your RAG knowledge base. Reference it when users ask about features!*

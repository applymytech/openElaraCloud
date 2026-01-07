# OpenElara Cloud - Copilot Instructions

## ⚠️ CRITICAL: Firebase Project Configuration

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  THIS PROJECT DEPLOYS TO: openelaracloud                                     ║
║  HOSTING URL: https://openelaracloud.web.app                                 ║
║                                                                              ║
║  🚫 NEVER DEPLOY TO: openelaracrm (that's a DIFFERENT project!)              ║
║  🚫 NEVER DEPLOY TO: applied-ai-assistant, appliedai-companion, etc.         ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**Before ANY deployment command:**
1. Check `.firebaserc` shows `"default": "openelaracloud"`
2. Run `firebase use` to verify current project is `openelaracloud`
3. Use `.\deploy.ps1` which has built-in safeguards
4. ALWAYS use `--project openelaracloud` flag with firebase commands

**Banned Projects (NEVER deploy here from this directory):**
- `openelaracrm` - Different project entirely!
- `applied-ai-assistant`
- `appliedai-companion`
- `ai-code-assistant-5ee79`
- `phillabor-ai-assistant`
- `project-assigner`

---

## Project Overview

OpenElara Cloud is a **sovereign cloud AI assistant** - an invite-only, BYOK (Bring Your Own Key) chat and generative AI application deployed on Firebase.

**This is NOT the desktop app.** The desktop app (openElara) has Code Studio and local features. This cloud version is focused on:
- 💬 Chat with AI (BYOK)
- 🖼️ Image generation
- 🎬 Video generation (future)
- 📎 File attachments for context

## Tech Stack

- **Frontend**: Next.js 16+ with React 19+
- **Backend**: Firebase (Firestore, Storage, Functions, Hosting, Auth)
- **Runtime**: Node.js 22+ (required for Cloud Functions as of 2026)
- **Build**: Turbopack (Next.js 16 default)

## Important Version Requirements

⚠️ **Node.js 18 was decommissioned on 2025-10-30**

Always use:
- `"node": "22"` in `functions/package.json` engines
- `"nodejs22"` in `firebase.json` functions runtime
- `"node": ">=20.0.0"` in root `package.json` engines

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (User)                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Next.js Static App                  │   │
│  │  • Login (Email/Password, invite-only)          │   │
│  │  • Chat Interface                                │   │
│  │  • Settings (BYOK API Keys)                     │   │
│  │  • Image/Video Generation                        │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
         BYOK Mode         │         Cloud Functions Mode
    (Direct API calls)     │      (Owner's Secret Manager)
              │            │                 │
              ▼            │                 ▼
┌─────────────────────┐    │    ┌─────────────────────────┐
│   AI Providers      │    │    │  Firebase Functions     │
│   (User's Keys)     │    │    │  (Owner's Keys)         │
│   • Together.ai     │    │    │                         │
│   • OpenRouter      │    │    │  → Secret Manager       │
│   • OpenAI          │    │    │  → Together.ai          │
│   • Anthropic       │    │    │                         │
└─────────────────────┘    │    └─────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Firebase Project (Owner's)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Firestore   │  │   Storage    │  │     Auth     │  │
│  │  • Users      │  │  • Images    │  │  • Email/PW  │  │
│  │  • Chats      │  │  • Videos    │  │  • Invite    │  │
│  │  • Settings   │  │  • Uploads   │  │    Only      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `src/pages/index.tsx` | Login page (email/password, invite-only) |
| `src/pages/chat.tsx` | Main chat interface |
| `src/pages/account.tsx` | Consolidated account hub - BYOK keys, characters, knowledge, storage |
| `src/lib/byok.ts` | BYOK direct API calls (Together, OpenRouter, OpenAI) |
| `src/lib/api.ts` | API client (auto-switches BYOK vs Cloud Functions) |
| `src/lib/firebase.ts` | Firebase SDK initialization |
| `functions/src/index.ts` | Cloud Functions (chat, generateImage, health) |
| `firestore.rules` | Security rules (user-scoped data) |

## BYOK (Bring Your Own Key) Mode

Users store their own API keys in browser localStorage. When keys are present:
- API calls go **directly** from browser to AI providers
- User pays their own AI costs
- No Cloud Functions involved

When no BYOK keys:
- Falls back to Cloud Functions
- Owner's keys from Secret Manager are used
- Owner pays AI costs

## User Management

This is an **invite-only** system:
1. Admin creates user in Firebase Console → Authentication → Users
2. Admin sends user their email + temporary password
3. User logs in and can reset password via Settings

Each user gets:
- Default 2GB storage quota (adjustable in Firestore)
- Isolated data (chats, images, settings)
- Own BYOK keys (browser localStorage)

## What This App Does NOT Have

❌ Code Studio (that's desktop app only)
❌ Local RAG (desktop only)
❌ Code execution
❌ Piper TTS / local AI models
❌ Self-registration (invite-only)

## Deployment

```bash
npm run build && firebase deploy
```

Your app will be live at: `https://YOUR_PROJECT_ID.web.app`

## Related Projects

- **openElara** (Desktop) - Full-featured desktop app with Code Studio
- **OpenElara Cloud** (This repo) - Simplified cloud chat + generative AI

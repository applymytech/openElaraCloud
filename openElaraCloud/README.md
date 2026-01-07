# OpenElara Cloud ☁️

> **Sovereign Cloud AI Assistant** - Deploy your own AI-powered assistant on YOUR infrastructure.

## What is This?

This is the **cloud-native version** of OpenElara, designed to run on Google Cloud Platform with Firebase. Unlike the desktop app, this runs in your browser and stores everything in your own Firebase project.

**You own:**
- Your data (Firestore)
- Your API keys (Secret Manager)  
- Your infrastructure (Firebase Hosting)
- Your users (Firebase Auth)

## Quick Start (15 minutes)

### Prerequisites

- [ ] Node.js 18+ installed
- [ ] Google Cloud account with billing enabled
- [ ] Together.ai API key ([get one free](https://together.ai))

### Step 1: Clone & Install

```bash
git clone https://github.com/applymytech/openElaraCloud.git
cd openElaraCloud
npm install
```

### Step 2: Firebase Setup

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login and init
firebase login
firebase init
```

Select:
- ✅ Firestore
- ✅ Functions  
- ✅ Hosting
- ✅ Storage

### Step 3: Create Secrets

Go to [Google Cloud Console → Secret Manager](https://console.cloud.google.com/security/secret-manager)

Create these secrets:
| Secret Name | Required | Description |
|-------------|----------|-------------|
| `TOGETHER_API_KEY` | ✅ Yes | Your Together.ai API key |
| `OPENROUTER_API_KEY` | Optional | For additional models |
| `ELEVENLABS_API_KEY` | Optional | For voice features |

### Step 4: Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

### Step 5: Test Locally

```bash
npm run dev
```

Open http://localhost:3000 - sign in with Google and test!

### Step 6: Deploy

```bash
npm run build
firebase deploy
```

🎉 Your sovereign AI assistant is live!

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Browser                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Next.js Frontend                    │   │
│  │  • Chat Interface                                │   │
│  │  • Code Studio (Monaco Editor)                   │   │
│  │  • Image/Voice Generation                        │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              YOUR Firebase Project                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Firestore   │  │   Storage    │  │  Functions   │  │
│  │  • Chats      │  │  • Files     │  │  • AI Proxy  │  │
│  │  • Settings   │  │  • Images    │  │  • Secrets   │  │
│  │  • History    │  │  • Projects  │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   External APIs                          │
│  • Together.ai (LLM)                                    │
│  • OpenRouter (optional)                                │
│  • ElevenLabs (optional voice)                          │
└─────────────────────────────────────────────────────────┘
```

## What's Different from Desktop?

| Feature | Desktop | Cloud |
|---------|---------|-------|
| Storage | Local filesystem | Firebase Storage |
| Database | Local JSON/SQLite | Firestore |
| Auth | None (local) | Google Sign-In |
| API Keys | Config file | Secret Manager |
| Code Execution | Local terminal | Sandboxed (limited) |
| File Access | Full system | Project files only |

## Security

- **Firestore Rules**: Strict user-scoped access
- **Secret Manager**: API keys never exposed to client
- **Auth**: Google Sign-In with Firebase Auth
- **Functions**: Server-side API calls only

## Support

- 📖 [Documentation](./docs/)
- 🐛 [Issues](https://github.com/applymytech/openElaraCloud/issues)
- 💬 [Discussions](https://github.com/applymytech/openElaraCloud/discussions)

## License

MIT - Use it, modify it, deploy it. It's yours.

---

Part of the **Elara Sovereign Collection**:
- [OpenElara](https://github.com/applymytech/openElara) - Desktop App
- [OpenElara Cloud](https://github.com/applymytech/openElaraCloud) - This repo
- [Elara CRM](https://github.com/applymytech/elaraCRM) - Customer Management

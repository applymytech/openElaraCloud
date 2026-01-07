# OpenElara Cloud ☁️

<p align="center">
  <img src="public/cover.jpg" alt="OpenElara Cloud" width="600">
</p>

> **Sovereign Cloud AI Assistant** - Deploy your own AI-powered assistant on YOUR infrastructure.

**OpenElara Cloud** is a **demonstration and educational project** showing what a sovereign, self-hosted AI assistant could look like. Built by a hobbyist developer, it's a proof-of-concept for BYOK + BYOC (Bring Your Own Key + Bring Your Own Cloud) AI applications.

> 🎓 **What This Is:** An educational tool, a proof of concept, a hobbyist project. Not a commercial product.

> ⚠️ **Adults Only (18+)** — This application provides access to AI capabilities that may generate mature content.

---

## 💡 The Vision

This is my vision of what a sovereign AI assistant could look like:
- Running on YOUR cloud infrastructure (Firebase)
- Using YOUR API keys (BYOK)
- Storing data in YOUR database
- Putting YOU in control of everything

I'm just a hobbyist with a dream. I built this to learn, to teach, and to show what's possible.

---

## ✨ Features

### 🤖 AI Chat with Personality
Five unique AI personas with distinct conversation styles:
- **Elara** — Creative problem-solver, your default companion
- **Andros** — Business and technology advisor
- **Aeron** — Strategic tactical thinker
- **Aelira** — Philosophical deep thinker
- **Architect** — System design specialist

### 🎨 Agentic Image Generation
Not just prompts — **Elara decides** the scene:
- Provide a suggestion ("something cozy")
- Elara interprets based on mood and context
- Get character-authentic selfies
- FLUX models via Together.ai

### 📜 Content Provenance
Every generated image includes cryptographic proof:
- Content hash
- Timestamp
- Model used
- Your installation ID
- Downloadable metadata sidecar

### 🧠 Personal Knowledge Base (RAG)
- Conversations automatically indexed
- Upload your own documents
- Elara remembers and references your knowledge

### 🎬 Video Generation
- Text-to-video with Wan 2.1 Turbo
- Character-based scenes
- Download with provenance

### 🔒 True Sovereignty
- **BYOK**: Your API keys in YOUR browser
- **BYOC**: Your Firebase project, your data
- **No middleman**: Direct API calls to providers
- **Open source**: Verify everything

---

## 📜 License (The Simple Version)

**FREE for:**
- ✅ Personal use
- ✅ Education and learning
- ✅ Development and experimentation
- ✅ Internal business use
- ✅ Modifying and sharing

**Just ask first if you want to build a commercial product on top of it.**

My philosophy: *1% of a million is better than 50% of nothing. I want you to succeed.*

See [LICENSE](./LICENSE) for full details.

---

## 🔑 Bring Your Own Key (BYOK)

OpenElara Cloud is **completely free**. Users connect directly to AI providers using their own API keys:

| Provider | What You Get |
|----------|--------------|
| **Together.ai** | FLUX images, Wan video, Kokoro TTS, 200+ LLMs |
| **OpenRouter** | Access to GPT-4, Claude, Gemini, and more |
| **OpenAI** | Direct GPT-4o access |
| **Anthropic** | Direct Claude access |

**You pay the providers directly at their rates. OpenElara charges nothing.**

---

## 🚀 Quick Start (15 minutes)

### Prerequisites

- Node.js 20+ installed
- Google Cloud account (Firebase requires billing, generous free tier)
- Together.ai API key ([get one free](https://together.ai))
- OpenRouter API key ([get one free](https://openrouter.ai))

### Step 1: Clone & Install

```bash
git clone https://github.com/applymytech/openElaraCloud.git
cd openElaraCloud
npm install
cd functions && npm install && cd ..
```

### Step 2: Firebase Setup

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Create project at console.firebase.google.com, then:
firebase init
```

Select: Firestore, Functions, Hosting, Storage

### Step 3: Configure Environment

```bash
# Copy template files
cp .env.local.template .env.local
cp .firebaserc.template .firebaserc
cp deploy.ps1.template deploy.ps1   # Windows
```

Edit `.env.local` with your Firebase config from the console.
Edit `.firebaserc` with your Firebase project ID.

> 📖 **See [SECRETS_SETUP.md](./SECRETS_SETUP.md) for complete secrets & configuration guide.**

### Step 4: Deploy Rules & Test

```bash
# Deploy security rules
firebase deploy --only firestore:rules,storage

# Test locally
npm run dev
```

### Step 5: Create First User

1. Firebase Console → Authentication → Users → Add user
2. Enter email and temporary password
3. Share credentials with user

### Step 6: Deploy

```bash
npm run build
firebase deploy
```

🎉 Your sovereign AI assistant is live!

---

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| [User Manual](./docs/USER_MANUAL.md) | Complete feature guide |
| [Agent Setup Guide](./docs/AGENT_SETUP_GUIDE.md) | For AI assistants helping with setup |
| [Privacy Policy](./PRIVACY.md) | How data is (not) collected |
| [Terms of Service](./TERMS.md) | Your rights and responsibilities |
| [License](./LICENSE) | The hobbyist license |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User's Browser                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Next.js Frontend                    │   │
│  │  • Chat with AI personas                        │   │
│  │  • Image/Video generation                        │   │
│  │  • Character system                              │   │
│  │  • BYOK key management (localStorage)           │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
         BYOK Mode         │         Cloud Functions
    (User's keys)          │         (Owner's keys)
              │            │                 │
              ▼            │                 ▼
┌─────────────────────┐    │    ┌─────────────────────────┐
│   AI Providers      │    │    │  Firebase Functions     │
│   • Together.ai     │    │    │  (Fallback mode)        │
│   • OpenRouter      │    │    │  ↓                      │
│   • OpenAI          │    │    │  Secret Manager         │
│   • Anthropic       │    │    │  ↓                      │
│                     │    │    │  AI Providers           │
└─────────────────────┘    │    └─────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              YOUR Firebase Project                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Firestore   │  │   Storage    │  │     Auth     │  │
│  │  • Users      │  │  • Images    │  │  • Email/PW  │  │
│  │  • Chats      │  │  • Videos    │  │  (invite     │  │
│  │  • RAG data   │  │  • Uploads   │  │   only)      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 Security

- **User-scoped data**: Firestore rules ensure users only access their own data
- **BYOK isolation**: API keys in localStorage, protected by same-origin policy
- **HTTPS enforced**: Firebase Hosting requires HTTPS
- **Invite-only**: No self-registration, admin controls access

---

## 🌐 What's Different from Desktop?

| Feature | Desktop | Cloud |
|---------|---------|-------|
| Storage | Local filesystem | Firebase Storage |
| Database | Local JSON | Firestore |
| Auth | None (local) | Email/Password |
| API Keys | Config file | Browser localStorage |
| Code Execution | Full terminal | ❌ Not available |
| Local AI (Ollama) | ✅ Supported | ❌ Not available |

**Want Code Studio?** Use the [Desktop app](https://github.com/applymytech/openElara).

---

## 📧 Contact

| Purpose | Email |
|---------|-------|
| General | openelara@applymytech.ai |
| Support | support@applymytech.ai |
| Privacy | privacy@applymytech.ai |
| Commercial | openelara@applymytech.ai |

**GitHub:** [github.com/applymytech/openElaraCloud](https://github.com/applymytech/openElaraCloud)

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/your-feature`
3. Follow existing code style
4. Test thoroughly
5. Submit pull request

---

## 📋 Related Projects

Part of the **Elara Sovereign Collection**:

- [OpenElara Desktop](https://github.com/applymytech/openElara) - Full-featured desktop app with Code Studio
- [OpenElara Cloud](https://github.com/applymytech/openElaraCloud) - This repo
- [Elara CRM](https://github.com/applymytech/elaraCRM) - Customer Management (coming soon)

---

## 🙏 Thanks

Thanks for checking out OpenElara Cloud! Whether you use it, learn from it, or just think it's interesting—I appreciate you taking the time.

If you build something cool with it, I'd love to hear about it!

— Andrew

---

**Version:** 1.0.0 | **Updated:** January 2026 | **License:** [Hobbyist License](./LICENSE)

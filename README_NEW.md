# 🌟 OpenElara Cloud - Sovereign AI Demo

**7-Day Public Demo** | **Deploy Your Own** | **BYOK (Bring Your Own Key)**

A sovereign cloud AI assistant - BYOK chat and generative AI application deployed on Firebase. Try the demo for 7 days, then deploy your own instance with YOUR API keys in YOUR infrastructure!

🌐 **Live Demo**: [https://openelaracloud.web.app](https://openelaracloud.web.app) (7-day trial)

> **Adults Only (18+)** — This application provides access to AI capabilities that may generate mature content.

---

## 🎯 What is OpenElara Cloud?

OpenElara Cloud is a **progressive web app (PWA)** for:
- 💬 **Chat with AI** - 50+ free models via OpenRouter + premium models via Together.ai
- 🖼️ **Image Generation** - FLUX models via Together.ai
- 🎬 **Video Generation** - Stable Diffusion Video
- 📎 **File Context** - Attach files for contextual chat
- 🔑 **BYOK** - Your API keys, your costs, no subscriptions
- 🎨 **Character System** - 5 unique AI personalities (Elara, Andros, Aeron, Aelira, Architect)
- 📚 **Knowledge Base** - RAG (Retrieval-Augmented Generation)
- 🌐 **Web Search** - Powered by Exa.ai

### This is NOT the Desktop App

The full-featured [openElara desktop app](https://github.com/applymytech/openElara) includes:
- 💻 **Code Studio** - Full IDE for AI-assisted coding
- 🗂️ **Local RAG** - Ingest local documents
- 🎵 **Piper TTS** - Offline text-to-speech
- 🧠 **Local AI Models** - Run models on your hardware

---

## ⚡ Quick Start (7-Day Trial)

1. Visit [https://openelaracloud.web.app](https://openelaracloud.web.app)
2. Sign in with **Google** or **Microsoft**
3. Get your API keys:
   - [Together.ai](https://api.together.xyz/settings/api-keys) - Image/video gen + premium chat ($5 free credit)
   - [OpenRouter](https://openrouter.ai/keys) - 50+ free chat models
   - [Exa.ai](https://dashboard.exa.ai/api-keys) - Web search (1000 free searches/month)
4. Paste keys in **Account → API Keys**
5. Start chatting!

**After 7 days**: Deploy your own instance (see below) or lose access.

**Data Retention**: Your custom content (personas, images, videos) is kept for 30 days to help with migration.

---

## 🚀 Deploy Your Own Instance

### Prerequisites

- [Node.js 22+](https://nodejs.org/)
- [Firebase CLI](https://firebase.google.com/docs/cli)
- Google Cloud account (free tier available)

### Step 1: Firebase Project Setup

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Create new project in Firebase Console:
# https://console.firebase.google.com/

# Clone this repo
git clone https://github.com/applymytech/openElaraCloud.git
cd openElaraCloud

# Initialize Firebase
firebase use --add
# Select your project and use alias "default"
```

### Step 2: Enable Firebase Services

In [Firebase Console](https://console.firebase.google.com/):

1. **Authentication** → Sign-in method:
   - Enable **Email/Password**
   - Enable **Google**
   - Enable **Microsoft** (optional)
   - Add your domain to authorized domains

2. **Firestore Database**:
   - Create in production mode
   - Choose region (e.g., `us-central1`)

3. **Storage**:
   - Create default bucket
   - Choose same region as Firestore

### Step 3: Install Dependencies

```bash
# Root dependencies
npm install

# Functions dependencies
cd functions
npm install
cd ..
```

### Step 4: Configure Firestore Rules

```bash
# Copy template
cp firestore.rules.template firestore.rules

# For unlimited trial (your personal instance), edit firestore.rules:
# Change line 11:
#   function getTrialDays() { return 999999; }

# Deploy rules
firebase deploy --only firestore:rules,storage
```

### Step 5: Create PWA Icons

Create two PNG icons:
- `public/icon-192.png` (192x192)
- `public/icon-512.png` (512x512)

You can use any icon generator or:
```bash
# Use ImageMagick to convert your logo
convert logo.png -resize 192x192 public/icon-192.png
convert logo.png -resize 512x512 public/icon-512.png
```

### Step 6: Replace Login Page

```bash
# Use the new OAuth-enabled login
mv src/pages/index.tsx src/pages/index-backup.tsx
mv src/pages/index-new.tsx src/pages/index.tsx
```

### Step 7: Build and Deploy

```bash
# Build Next.js app
npm run build

# Deploy everything
firebase deploy

# Or deploy specific services:
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
```

Your app will be live at: `https://YOUR_PROJECT_ID.web.app`

### Step 8: First User Setup

1. **Sign in with Google/Microsoft** or create user via:
   - Firebase Console → Authentication → Add User
   - Enter email + password
   
2. **Configure API keys**:
   - Login to your deployed app
   - Go to Account → API Keys
   - Add your Together.ai, OpenRouter, Exa keys

---

## 🔧 Customization

### Remove 7-Day Trial Limit

Edit `firestore.rules`:
```javascript
function getTrialDays() {
  return 999999; // Unlimited!
}
```

Redeploy:
```bash
firebase deploy --only firestore:rules
```

### Customize Branding

Edit `public/manifest.json`:
```json
{
  "name": "Your AI Assistant",
  "short_name": "YourAI",
  "theme_color": "#your-color",
  "background_color": "#your-bg-color"
}
```

### Change Theme

Edit `src/styles/nexus-theme.css`:
```css
:root {
  --nexus-primary: #your-primary-color;
  --nexus-bg: #your-background;
  /* ... */
}
```

### Hide Trial Banner

In your personal deployment, edit `src/lib/trial.ts`:
```typescript
const TRIAL_DAYS = 999999; // Set to huge number
```

Or remove `<TrialBanner />` from [chat.tsx](src/pages/chat.tsx#L710).

---

## 📊 Architecture

```
┌─────────────────────────────────────┐
│     Browser (PWA)                   │
│  ┌────────────────────────────┐    │
│  │  Next.js Static App        │    │
│  │  • Google/Microsoft OAuth  │    │
│  │  • BYOK API Keys           │    │
│  │  • Chat Interface          │    │
│  │  • Image/Video Gen         │    │
│  └────────────────────────────┘    │
└─────────────────────────────────────┘
              │
              │ (BYOK Mode: Direct API calls)
              │
    ┌─────────┼──────────┐
    │         │          │
    ▼         ▼          ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│Together │ │OpenRouter│ │ Exa.ai │
│   .ai   │ │          │ │        │
│ (User's │ │ (User's  │ │(User's │
│  Keys)  │ │  Keys)   │ │ Keys)  │
└─────────┘ └─────────┘ └─────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Firebase (Your Project)            │
│  ┌──────────┐ ┌──────────┐         │
│  │Firestore │ │ Storage  │         │
│  │• Users   │ │• Images  │         │
│  │• Chats   │ │• Videos  │         │
│  │• Settings│ │• Files   │         │
│  └──────────┘ └──────────┘         │
└─────────────────────────────────────┘
```

### BYOK Mode

Users store API keys in **browser localStorage** (never sent to server):
- API calls go **directly** from browser to AI providers
- User pays their own AI costs
- No server-side API key storage
- Full data sovereignty

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 16+** | React framework with SSR |
| **React 19+** | UI library |
| **Firebase** | Backend (Auth, Firestore, Storage, Hosting) |
| **Together.ai** | Image/video generation + premium chat |
| **OpenRouter** | 50+ free chat models |
| **Exa.ai** | Web search |
| **Node.js 22+** | Cloud Functions runtime |
| **TypeScript** | Type safety |

---

## 🔐 Security & Privacy

### What We Store
- ✅ User email (Firebase Auth)
- ✅ Chat history (Firestore, user-scoped)
- ✅ Generated images/videos (Firebase Storage, user-scoped)
- ✅ Custom characters/personas (Firestore, user-scoped)

### What We DON'T Store
- ❌ API keys (localStorage only, never sent to server)
- ❌ Payment information (users pay AI providers directly)
- ❌ AI model responses (not logged server-side)

### Data Retention (Demo Instance)
- **Trial**: 7 days
- **Content**: 30 days after trial expiration
- **Your Instance**: You control all retention policies!

---

## 📱 PWA Features

### Installation
- **Desktop** (Chrome/Edge): Click install icon in address bar
- **iOS Safari**: Share → Add to Home Screen
- **Android Chrome**: "Add to Home Screen" banner

### Offline Capability
- Service worker caches static assets
- Works offline for UI (API calls require internet)

### Native-Like Experience
- Standalone window (no browser chrome)
- Custom splash screen
- App icons on desktop/homescreen

---

## 🤝 Contributing

We welcome contributions! Please:
1. Fork the repo
2. Create a feature branch
3. Submit a pull request

### Development Setup
```bash
git clone https://github.com/applymytech/openElaraCloud.git
cd openElaraCloud
npm install
cd functions && npm install && cd ..

# Run dev server
npm run dev

# Open http://localhost:3000
```

---

## 📚 Documentation

- [User Manual](docs/USER_MANUAL.md) - Complete user guide
- [Demo Deployment Guide](DEMO_DEPLOYMENT_GUIDE.md) - Detailed deployment instructions
- [AI Deployment Guide](AI_DEPLOYMENT_GUIDE.md) - Firebase specifics
- [Secrets Setup](SECRETS_SETUP.md) - Cloud Functions secrets (optional)

---

## 🆘 Troubleshooting

### "Trial Expired"
Deploy your own instance (see above) for unlimited access!

### OAuth Not Working
Check Firebase Console → Authentication → Sign-in method → Authorized domains includes your domain.

### Build Errors
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Functions Deployment Failed
```bash
# Check Node version
node --version  # Should be 22.x

# Redeploy
cd functions
npm install
cd ..
firebase deploy --only functions
```

---

## 💰 Cost Estimates

### Firebase (Free Tier Generous)
- **Hosting**: 10GB storage, 360MB/day bandwidth
- **Firestore**: 1GB storage, 50k reads/day, 20k writes/day
- **Storage**: 5GB, 1GB/day downloads
- **Auth**: Unlimited

### AI Provider Costs (Your Keys)
- **Together.ai**: ~$0.50 per 1000 images (FLUX.1-schnell)
- **OpenRouter**: Many free models! Premium models vary
- **Exa.ai**: Free tier: 1000 searches/month

**Example**: $10/month supports ~20k images or ~100k free chats!

---

## 🔗 Related Projects

- [openElara Desktop](https://github.com/applymytech/openElara) - Full desktop app with Code Studio
- [Together.ai](https://www.together.ai/) - Image/video generation API
- [OpenRouter](https://openrouter.ai/) - Multi-model chat routing
- [Exa.ai](https://exa.ai/) - Web search for AI

---

## 📄 License

MIT License - see [LICENSE](LICENSE)

---

## 🌟 Why Sovereign AI?

Traditional AI apps lock you into:
- ❌ Monthly subscriptions
- ❌ Vendor-controlled data
- ❌ Usage limits
- ❌ Privacy concerns

OpenElara Cloud gives you:
- ✅ **Your keys** - Direct relationships with AI providers
- ✅ **Your data** - Stored in YOUR Firebase project
- ✅ **Your costs** - Pay only for what you use
- ✅ **Your control** - Deploy anywhere, modify freely
- ✅ **Your privacy** - Keys never leave your browser

**You are not the product. You ARE the platform.**

---

## 🚀 Get Started

```bash
# Try the demo (7 days)
https://openelaracloud.web.app

# Deploy your own (10 minutes)
git clone https://github.com/applymytech/openElaraCloud.git
cd openElaraCloud
# Follow "Deploy Your Own Instance" above
```

**Questions?** Open an issue or discussion on GitHub!

---

<p align="center">
  Made with ❤️ by <a href="https://applymytech.com">Apply My Tech</a>
</p>

<p align="center">
  ⭐ Star us on GitHub if you find this useful!
</p>

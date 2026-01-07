# 🔐 OpenElara Cloud - Secrets & Keys Setup Guide

This document lists ALL secrets and configuration files required to run OpenElara Cloud.

> ⚠️ **IMPORTANT**: Never commit real API keys or secrets to git!
> All files ending in `.template` are safe to commit. Copy them to create your real config files.

---

## 📁 Required Configuration Files

### 1. `.env.local` (Firebase Client Config)

**Copy from:** `.env.local.template`

```bash
cp .env.local.template .env.local
```

**Get values from:** [Firebase Console](https://console.firebase.google.com) → Project Settings → Your apps → Web app → Config

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API Key | `AIzaSyA-xxxxxxxxxxxxxxxxxxxxxx` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Auth domain | `your-project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Project ID | `your-project-id` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage bucket | `your-project.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sender ID | `123456789012` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID | `1:123456789012:web:abcdef123456` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Analytics ID (optional) | `G-XXXXXXXXXX` |

---

### 2. `.firebaserc` (Firebase Project Binding)

**Copy from:** `.firebaserc.template`

```bash
cp .firebaserc.template .firebaserc
```

**Contents:**
```json
{
  "projects": {
    "default": "your-firebase-project-id"
  }
}
```

---

### 3. `deploy.ps1` (Windows) or `deploy.sh` (Linux/Mac)

**Copy from:** `deploy.ps1.template`

```bash
cp deploy.ps1.template deploy.ps1
```

**Configure:**
- `$REQUIRED_PROJECT` = Your Firebase project ID
- `$REQUIRED_ACCOUNT` = Your Google account email
- `$CONFIG_NAME` = A name for your gcloud configuration

---

## 🔑 Google Secret Manager (Server-Side API Keys)

These secrets are used by Firebase Cloud Functions. They are **never** exposed to the browser.

### Setup Command:
```bash
# Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Create secrets
gcloud secrets create TOGETHER_API_KEY --replication-policy="automatic"
echo -n "your-together-api-key" | gcloud secrets versions add TOGETHER_API_KEY --data-file=-
```

### Required Secrets:

| Secret Name | Description | Get From |
|-------------|-------------|----------|
| `TOGETHER_API_KEY` | Together.ai API key (chat, images, TTS) | [together.ai](https://together.ai) → Settings → API Keys |

### Optional Secrets (for future expansion):

| Secret Name | Description | Get From |
|-------------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI direct access | [platform.openai.com](https://platform.openai.com/api-keys) |
| `ANTHROPIC_API_KEY` | Claude direct access | [console.anthropic.com](https://console.anthropic.com) |
| `EXA_API_KEY` | Exa.ai web search | [exa.ai](https://exa.ai) |

### Grant Function Access:
```bash
# Get your project number
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')

# Grant access to the function's service account
gcloud secrets add-iam-policy-binding TOGETHER_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding TOGETHER_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 🌐 BYOK (Bring Your Own Key) - Client-Side

Users can add their own API keys in the browser. These are stored in `localStorage` and **never** sent to your server.

| Provider | Purpose | Get From |
|----------|---------|----------|
| Together.ai | Chat, Images, Video, TTS, STT | [together.ai](https://together.ai) |
| OpenRouter | Multi-model routing | [openrouter.ai](https://openrouter.ai) |
| OpenAI | GPT-4, DALL-E | [platform.openai.com](https://platform.openai.com) |
| Anthropic | Claude models | [console.anthropic.com](https://console.anthropic.com) |
| Exa.ai | Web search & research | [exa.ai](https://exa.ai) |
| ElevenLabs | Premium TTS | [elevenlabs.io](https://elevenlabs.io) |

---

## 🗄️ Firestore Security Rules

The `firestore.rules` file is safe to commit - it contains access control rules, not secrets.

Key rules:
- Users can only read/write their own data (`/users/{userId}/**`)
- All data requires authentication
- Admins can be granted elevated access via custom claims

---

## 📦 Storage Security Rules

The `storage.rules` file is safe to commit - it contains access control rules, not secrets.

Key rules:
- Users can only access their own files (`/users/{userId}/**`)
- File size limits enforced (default: 50MB)
- Only specific file types allowed

---

## ✅ Quick Setup Checklist

```
[ ] 1. Copy .env.local.template → .env.local
[ ] 2. Fill in Firebase config values in .env.local
[ ] 3. Copy .firebaserc.template → .firebaserc
[ ] 4. Set your project ID in .firebaserc
[ ] 5. Copy deploy.ps1.template → deploy.ps1
[ ] 6. Configure deploy.ps1 with your account/project
[ ] 7. Create TOGETHER_API_KEY in Secret Manager
[ ] 8. Grant Secret Manager access to Cloud Functions
[ ] 9. Deploy: .\deploy.ps1
```

---

## 🚨 Security Reminders

1. **Never commit** `.env.local`, `.firebaserc`, or `deploy.ps1`
2. **Always use** Secret Manager for server-side API keys
3. **BYOK keys** stay in browser localStorage - your server never sees them
4. **Firebase API keys** are safe to expose (they're restricted by security rules)
5. **Rotate secrets** if you suspect a leak

---

## 📞 Support

If you need help setting up:
- Check the [Firebase documentation](https://firebase.google.com/docs)
- Check the [Together.ai documentation](https://docs.together.ai)
- Open an issue on the repository

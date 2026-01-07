# OpenElara Cloud - Agent Setup Guide

**Version 1.0.0 | January 2026**

> **FOR CODE AGENTS ONLY**: This document provides instructions for AI coding assistants (like GitHub Copilot, Claude, etc.) to guide first-time users through setting up OpenElara Cloud.

---

## 🤖 Agent Context

You are helping a user deploy **OpenElara Cloud** - a sovereign, self-hosted AI assistant that runs on their own Firebase infrastructure. This is a BYOK (Bring Your Own Key) + BYOC (Bring Your Own Cloud) application.

**Your role:** Guide users through setup step-by-step, explaining what each step does and why.

---

## Prerequisites Check

Before starting, verify the user has:

```
□ Node.js 20+ installed (check: node --version)
□ npm 10+ installed (check: npm --version)
□ Google account (for Firebase)
□ Credit card (Firebase requires billing, but has generous free tier)
□ API key from Together.ai (free tier available: https://together.ai)
```

**Agent Action:** If any prerequisite is missing, help the user obtain it before continuing.

---

## Step 1: Clone & Install

```bash
# Clone the repository
git clone https://github.com/applymytech/openElaraCloud.git
cd openElaraCloud

# Install dependencies
npm install

# Install functions dependencies
cd functions && npm install && cd ..
```

**What this does:**
- Downloads the OpenElara Cloud source code
- Installs Next.js, Firebase SDK, and other frontend dependencies
- Installs Cloud Functions dependencies separately

**Expected time:** 2-5 minutes depending on internet speed.

---

## Step 2: Firebase Project Setup

### 2a. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project" (or "Add project")
3. Enter a project name (e.g., "my-elara-cloud")
4. Disable Google Analytics (optional, not needed)
5. Click "Create project"

**Agent tip:** The project ID is globally unique. If their preferred name is taken, suggest adding numbers or their initials.

### 2b. Enable Required Services

In Firebase Console, enable these services:

**Authentication:**
1. Go to Build → Authentication
2. Click "Get started"
3. Enable "Email/Password" provider
4. (Optional) Enable "Google" provider for easier login

**Firestore Database:**
1. Go to Build → Firestore Database
2. Click "Create database"
3. Choose "Start in production mode" (we'll add rules)
4. Select a location close to your users

**Storage:**
1. Go to Build → Storage
2. Click "Get started"
3. Choose "Start in production mode"
4. Same location as Firestore

**Functions:**
1. Go to Build → Functions
2. Click "Get started" (or "Upgrade project" if prompted)
3. This requires Blaze (pay-as-you-go) plan
4. Don't worry - there's a generous free tier!

### 2c. Get Firebase Config

1. Go to Project Settings (⚙️ icon)
2. Scroll to "Your apps" section
3. Click Web icon (</>) to register a web app
4. Enter app nickname (e.g., "OpenElara Cloud")
5. DON'T check "Firebase Hosting" yet
6. Click "Register app"
7. Copy the `firebaseConfig` object - you'll need these values

---

## Step 3: Configure Environment

```bash
# Copy the template
cp .env.local.template .env.local
```

Edit `.env.local` with your Firebase config:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key-here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id (optional)
```

**Agent action:** Help users map the Firebase Console values to the .env.local format.

---

## Step 4: Deploy Security Rules

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase (select existing project)
firebase init
```

When prompted during `firebase init`:
- Select: Firestore, Functions, Hosting, Storage
- Use existing project: (select your project)
- Firestore Rules: `firestore.rules` (use existing)
- Firestore Indexes: `firestore.indexes.json` (use existing)
- Functions language: TypeScript
- Functions directory: `functions` (use existing)
- Hosting directory: `out` (for Next.js static export)
- Single-page app: Yes
- Storage rules: `storage.rules` (use existing)

```bash
# Deploy security rules
firebase deploy --only firestore:rules,storage
```

---

## Step 5: Create First Admin User

Since OpenElara Cloud is invite-only:

1. Go to Firebase Console → Authentication → Users
2. Click "Add user"
3. Enter email and a temporary password
4. Share these credentials with the first user

**Agent tip:** The user can change their password in Settings after logging in.

---

## Step 6: (Optional) Set Up Cloud Functions

If users want the fallback mode (owner-paid AI when users don't have BYOK keys):

### 6a. Enable Secret Manager

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select the Firebase project
3. Enable "Secret Manager API"
4. Create a secret named `TOGETHER_API_KEY` with your Together.ai key

### 6b. Grant Functions Access

```bash
# Get the service account email
firebase functions:config:get

# Grant access in Cloud Console → IAM
# Add role "Secret Manager Secret Accessor" to the functions service account
```

### 6c. Deploy Functions

```bash
firebase deploy --only functions
```

---

## Step 7: Test Locally

```bash
npm run dev
```

Open http://localhost:3000 and:
1. Log in with the admin account you created
2. Go to Settings → API Keys
3. Enter your Together.ai API key
4. Return to Chat and send a message

**Expected result:** Elara responds! 🎉

---

## Step 8: Deploy to Production

```bash
# Build for production
npm run build

# Deploy everything
firebase deploy
```

Your app is now live at: `https://your-project-id.web.app`

---

## Troubleshooting Guide

### "Permission denied" errors
- Check Firestore/Storage rules are deployed
- Verify user is authenticated
- Check the security rules match the provided templates

### "API key invalid" errors
- Verify the key is entered correctly in Settings
- Check the key hasn't expired
- Try the key directly with curl to test

### "Quota exceeded" errors
- Check Firebase Blaze plan is active
- Review quotas in Firebase Console → Usage

### Functions not working
- Check functions are deployed: `firebase functions:list`
- Check Secret Manager has the API key
- Check logs: `firebase functions:log`

### Build failures
- Ensure Node.js 20+ is installed
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check for TypeScript errors: `npm run lint`

---

## Post-Setup Configuration

### Adding More Users
1. Firebase Console → Authentication → Users → Add user
2. Send them their credentials
3. They can change password in Settings

### Adjusting Storage Quotas
Default is 5GB per user. To change:
1. Firestore → users/{userId}
2. Edit `storageQuota` field (in bytes)

### Custom Domain
1. Firebase Hosting → Add custom domain
2. Follow DNS verification steps
3. SSL is automatic

---

## Security Checklist

Before going live:

```
□ Security rules deployed (firestore.rules, storage.rules)
□ Admin user created with strong password
□ HTTPS enforced (automatic with Firebase Hosting)
□ API keys stored in user browsers (BYOK) or Secret Manager
□ Billing alerts configured in Google Cloud
```

---

## Support Resources

- **Repository:** https://github.com/applymytech/openElaraCloud
- **Issues:** https://github.com/applymytech/openElaraCloud/issues
- **Email:** support@applymytech.ai

---

**Agent Summary:** After setup, users have a fully sovereign AI assistant running on their own infrastructure. They control:
- User accounts (Firebase Auth)
- Data storage (Firestore + Storage)
- API costs (BYOK or owner-funded)
- Security rules and access
- Deployment and updates

This is true digital sovereignty. 🎉

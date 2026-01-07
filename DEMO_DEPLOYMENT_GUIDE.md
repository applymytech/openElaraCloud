# 7-Day Demo Deployment Guide

## 🎯 What Changed

Your OpenElara Cloud is now a **7-day demo** that encourages users to deploy their own sovereign instance.

## ✅ Implemented Features

### 1. **PWA (Progressive Web App)**
- ✅ `manifest.json` for "Install to Desktop"
- ✅ Service worker for offline capability
- ✅ Meta tags for mobile/desktop install prompts
- Users can add to homescreen/desktop like a native app!

### 2. **Authentication Updates**
- ✅ Google OAuth
- ✅ Microsoft OAuth  
- ✅ Email/Password with forgot password
- ✅ Trial expiration checks on login

### 3. **7-Day Trial System** (`src/lib/trial.ts`)
- ✅ Auto-initialize trial on first login
- ✅ Track days remaining
- ✅ Warning levels: info (5+ days) → warning (3-4 days) → urgent (1-2 days) → expired
- ✅ Block login after expiration
- ✅ Daily trial banner with warnings

### 4. **BYOK Enforcement**
- ✅ Prominent banner explaining BYOK requirement
- ✅ Direct links to get API keys (Together.ai, OpenRouter, Exa)
- ✅ Clear messaging: No keys = No functionality
- ✅ API keys NEVER stored server-side (localStorage only)

### 5. **Data Retention Policy**
- ✅ API keys: Cleared immediately from localStorage
- ✅ User content: Firestore rules allow 30-day retention window
- ✅ Custom personalities, images, videos preserved for migration

### 6. **Cross-Promotion**
- ✅ Links to deploy cloud version (this repo)
- ✅ Links to desktop version (openElara with Code Studio)
- ✅ "Sovereign AI" messaging throughout

### 7. **Firestore Rules**
- ✅ Updated to support Google/Microsoft OAuth
- ✅ Trial expiration checks
- ✅ Template version for public repo (`.template`)
- ✅ Working version gitignored

## 📁 New Files

```
public/
  manifest.json          # PWA manifest
  sw.js                  # Service worker

src/
  lib/
    trial.ts             # Trial management system
  components/
    TrialBanner.tsx      # Trial warning banner
  pages/
    index-new.tsx        # New login page (rename to index.tsx)

firestore.rules.template # Template for public repo
```

## 🚀 Deployment Steps

### Step 1: Update Firebase Console

1. **Enable OAuth Providers**:
   ```
   Firebase Console → Authentication → Sign-in method
   → Enable Google
   → Enable Microsoft
   → Add authorized domains
   ```

2. **Deploy Firestore Rules**:
   ```powershell
   # Copy template to working rules
   cp firestore.rules.template firestore.rules
   
   # Deploy
   firebase deploy --only firestore:rules
   ```

### Step 2: Replace Login Page

```powershell
# Backup old login
mv src/pages/index.tsx src/pages/index-old.tsx

# Use new login
mv src/pages/index-new.tsx src/pages/index.tsx
```

### Step 3: Add Trial Banner to Chat

In `src/pages/chat.tsx`, add at the top:

```tsx
import TrialBanner from '@/components/TrialBanner';

export default function Chat() {
  // ...existing code...
  
  return (
    <>
      <TrialBanner />  {/* Add this */}
      <div className="chat-container">
        {/* existing chat UI */}
      </div>
    </>
  );
}
```

### Step 4: Create Icon Assets

```powershell
# Place these in public/
public/icon-192.png   # 192x192 app icon
public/icon-512.png   # 512x512 app icon
```

### Step 5: Deploy

```powershell
npm run build
firebase deploy
```

### Step 6: Test PWA Install

1. Open deployed site in Chrome/Edge
2. Look for "Install" button in address bar
3. Click to install as desktop app
4. Verify it opens as standalone app

## 🔑 User Experience Flow

### New User Journey:

1. **Landing Page**:
   - See BYOK requirement banner
   - Links to get API keys (Together.ai, OpenRouter, Exa)
   - 7-day trial notice
   - Sign in with Google/Microsoft/Email

2. **First Login**:
   - Account created
   - 7-day trial initialized
   - Redirected to `/account` to set up BYOK keys

3. **Daily Usage**:
   - Trial banner shows days remaining
   - Banner changes color as expiration approaches:
     - 🔵 Blue (5+ days): Info
     - 🟠 Orange (3-4 days): Warning  
     - 🔴 Red (1-2 days): Urgent
     - ⛔ Dark red (expired): Blocked

4. **Trial Expiration**:
   - Can no longer log in
   - Message: "Deploy your own instance!"
   - Custom content kept 30 days
   - API keys cleared from localStorage

## 📋 What Users See

### Login Screen:
```
🔑 BYOK Required - Have Your API Keys Ready!
▶ (Click to expand)

🚀 7-Day Demo
This is a public demonstration of the code. After 7 days, 
deploy YOUR OWN sovereign instance with YOUR keys!

[Continue with Google]
[Continue with Microsoft]

or

Email: ___________
Password: ___________
[Sign In]

Want Your Own Instance?
☁️ Cloud Version (This Code)
🖥️ Desktop Version (with Code Studio)
```

### Trial Banner (Day 2):
```
⏰ 5 Days Remaining | ℹ️ 5 days left in trial. Start planning your deployment!
[🚀 Deploy Your Own] [Dismiss]
```

### Trial Banner (Last Day):
```
⏰ 1 Day Remaining | ⚠️ Last Day! Your trial expires tomorrow. Deploy your own instance now!
[🚀 Deploy Your Own] [Dismiss]
```

### Trial Expired:
```
🚫 Trial Expired - Deploy Your Own!
Your 7-day trial has ended. Deploy your own instance to continue 
using OpenElara Cloud with YOUR API keys in YOUR infrastructure.
[🚀 Deploy Your Own]
(no dismiss button)
```

## 🎨 Customization for Your Instance

In your working `firestore.rules` (NOT the template):

```javascript
// Customize trial duration for your deployment
function getTrialDays() {
  return 999999; // Unlimited for your personal instance!
}
```

In `src/lib/trial.ts`:

```typescript
// For your personal deployment, extend trial indefinitely
const TRIAL_DAYS = process.env.NEXT_PUBLIC_UNLIMITED_TRIAL === 'true' 
  ? 999999 
  : 7;
```

## 🌍 Sovereign Cloud Messaging

Key points emphasized throughout:

1. **BYOK**: Your keys, your costs, no subscriptions
2. **Your Infrastructure**: Deploy to any Google Cloud region
3. **Your Data**: Never leaves your Firebase project
4. **Open Source**: All code public, audit anytime
5. **No Vendor Lock-in**: Same keys work in desktop app

## 📱 PWA Install Prompts

**Desktop (Chrome/Edge)**:
- Install icon in address bar
- "Install OpenElara Cloud" prompt

**Mobile (iOS Safari)**:
- Share → Add to Home Screen

**Mobile (Android Chrome)**:
- "Add to Home Screen" banner
- Install from menu

## ⚠️ Important Notes

### For Public Demo (openelaracloud.web.app):
- ✅ Keep 7-day trial
- ✅ Show BYOK warnings
- ✅ Encourage self-deployment
- ✅ Clear trial messaging

### For Personal Deployments:
- 🔧 Set unlimited trial in firestore.rules
- 🔧 Remove/customize trial banner
- 🔧 Keep or remove BYOK warnings (your choice)
- 🔧 Customize branding

## 🔐 Security Notes

1. **API Keys**: NEVER in Firestore/Storage, localStorage only
2. **OAuth**: Configure authorized domains in Firebase Console
3. **Firestore Rules**: Trial checks prevent expired access
4. **Content Retention**: 30-day grace period for migration

## 🎯 Success Metrics

Track in Firebase Analytics:
- Trial sign-ups
- Days to deployment (goal: <7)
- GitHub repo stars/forks
- Desktop app downloads

## 🚀 Next Steps

1. Test OAuth flows locally
2. Deploy to staging first
3. Create 192x192 and 512x512 icons
4. Test PWA install on multiple browsers
5. Monitor trial conversion rates
6. Update README with trial policy

Your sovereign cloud AI is now a compelling demo that converts users into self-hosters! 🎉

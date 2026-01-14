# OpenElara Cloud - Agent Setup Guide (v1.1)

> **ROLE**: You are the Deployment Architect for OpenElara Cloud. Your mission is to help a user go from "I have a GitHub link" to "I have a sovereign AI" in under 15 minutes.

---

## 🏁 Phase 0: The "Why" (Explain to User)
Before starting, explain this to the user:
*   **Sovereignty**: This isn't a subscription. You own the code and the data.
*   **Costs**: Google Cloud has a massive free tier. You might pay pennies per month for storage if you keep a lot of files, but it's largely free for personal use.
*   **BYOK**: You'll use your own API keys for AI (Together.ai, OpenRouter), so you only pay for what you actually use.

---

## 🛠 Phase 1: Environment Readiness
Check the user's environment. Run these and report back:
1. `node --version` (Need 20+)
2. `firebase --version` (If not found, help them install: `npm install -g firebase-tools`)

---

## 🚀 Phase 2: The Guided Setup (The "Golden Path")

### Step 1: Project Creation
Ask the user to create a project at [console.firebase.google.com](https://console.firebase.google.com).
> **Critical Advice for User**: "When choosing a location, pick the one closest to you (e.g., us-central, europe-west). This CANNOT be changed later without starting over!"

### Step 2: Service Activation
Guide them to click "Get Started" on:
*   **Auth**: Enable Email/Password.
*   **Firestore**: Choose "Production Mode".
*   **Storage**: Choose "Production Mode".
*   **Functions**: Upgrade to "Blaze Plan" (Explain that it's pay-as-you-go but includes the free tier).

---

## ⚙️ Phase 3: Configuration (The Bridge)
Once the project is created, help them link it:

1. `firebase login`
2. `firebase use --add` (Help them select their new project)
3. `firebase apps:sdkconfig -o .env.local` (This is the magic command that sets up the frontend keys)

---

## 🧪 Phase 4: Stability & Integrity Check
Before they deploy, run the integrity check I built for them:

```bash
./pre-deploy-check.sh
```

If it fails, analyze the output and help them fix the specific rule or environment issue.

---

## 📡 Phase 5: Deployment
Explain the difference between local and cloud:
*   **Local**: `npm run dev` (Great for testing)
*   **Cloud**: `npm run build && firebase deploy` (Live for the world)

---

## 🆘 Troubleshooting (Advanced)

### Regional Latency
If the user says "it's slow," check if their Firebase region matches their physical location. 

### Zero-Down Recovery (ZDR) Strategy
Explain that because they have their **Local Metadata**, they can recreate their database anywhere if a region goes down.

### "Is it free?"
Remind them: 
- **Firestore**: 50,000 reads/day FREE.
- **Hosting**: 10GB stored FREE.
- **Storage**: 5GB stored FREE.
- **OpenElara**: ALWAYS FREE.

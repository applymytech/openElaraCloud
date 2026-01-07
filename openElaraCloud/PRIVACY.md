# Privacy Policy

**OpenElara Cloud - Apply My Tech**  
**Last Updated:** January 7, 2026

---

## 🎁 A Gift, Not a Product

OpenElara Cloud is my gift to the world. **I don't want your data. I don't want your money.**

There is no secret data mining. No telemetry. No hidden agenda. No "premium tier" coming later. Elara is yours - use her well.

---

## TL;DR

OpenElara Cloud is a **Bring Your Own Cloud (BYOC)** application. Your data lives in **YOUR** Firebase project, not ours. We provide the code - you provide the infrastructure.

**Apply My Tech (the developer) cannot access your data.** We don't have your Firebase credentials.

---

## What Is OpenElara Cloud?

OpenElara Cloud is a **demonstration and educational tool** - a hobbyist project showing what a sovereign AI assistant could look like. It's designed to run entirely on YOUR infrastructure:

- **YOUR** Firebase project
- **YOUR** Firestore database
- **YOUR** Firebase Storage
- **YOUR** API keys (stored in YOUR browser)

**⚠️ Age Requirement:** This application is intended for users aged **18 and older**. AI-generated content may include mature themes.

---

## We Collect Nothing

Apply My Tech (the developer) does **NOT** collect:

- ❌ Your conversations or chat history
- ❌ Your files or images
- ❌ Your API keys
- ❌ Usage analytics or telemetry
- ❌ Crash reports
- ❌ Personal information
- ❌ Device identifiers
- ❌ IP addresses
- ❌ Anything at all

**Why?** Because we don't have access to your Firebase project. You deploy to YOUR infrastructure. We just provide the code.

---

## What YOU Control

When you deploy OpenElara Cloud, everything is stored in YOUR Firebase project:

| Data | Location | Who Controls It |
|------|----------|-----------------|
| User accounts | YOUR Firebase Auth | You |
| Conversations | YOUR Firestore | You |
| Generated images | YOUR Firebase Storage | You |
| Settings | YOUR Firestore | You |
| API Keys | User's browser localStorage | Each user |

**You are the data controller.** You decide:
- Who can create accounts
- How long to retain data
- When to delete data
- Security rules and access controls

---

## BYOK (Bring Your Own Key) - API Keys

Users store their own API keys in browser localStorage. This means:

| What | How It Works |
|------|--------------|
| Where keys are stored | User's browser only |
| Who can access them | Only that user, on that browser |
| API calls | Go directly from browser to AI provider |
| YOUR servers | Never see the keys |
| OUR servers | Don't exist - we're just code |

### Supported Providers

When users add API keys and make requests:

| Provider | Data Goes To |
|----------|-------------|
| Together.ai | Together.ai servers (BYOK) |
| OpenRouter | OpenRouter servers (BYOK) |
| OpenAI | OpenAI servers (BYOK) |
| Anthropic | Anthropic servers (BYOK) |

**User responsibility:** Review the privacy policy of any AI provider before using their services.

### 💡 Privacy Tip: OpenRouter Zero Data Retention

If users use OpenRouter, recommend enabling **"Zero Data Retention" (ZDR)** in their API key settings. This prevents prompts from being stored or used for training.

---

## Firebase (Your Infrastructure)

### What Firebase Stores

In YOUR Firebase project:

**Firestore (Database):**
- User profiles and settings
- Conversation history
- RAG (knowledge base) entries

**Firebase Storage:**
- Generated images (until downloaded)
- Generated videos (until downloaded)
- Uploaded files for context

**Firebase Auth:**
- User email addresses
- Password hashes (managed by Firebase)

### Firebase's Privacy

Firebase is operated by Google. When you deploy to YOUR Firebase project:
- Google's privacy policy applies to YOUR data
- YOU are the data controller
- Review: https://firebase.google.com/support/privacy

### Your Responsibility as Admin

As the Firebase project owner, you should:

1. **Configure security rules** - Use the provided `firestore.rules` and `storage.rules`
2. **Manage user data** - Handle deletion requests appropriately
3. **Monitor storage** - Set appropriate quotas
4. **Review logs** - Firebase provides audit logging if enabled

---

## Data Retention

### Automatic
- Cloud Functions may log errors (Firebase default behavior)
- Firebase Auth retains user records until deleted

### User-Controlled
- Conversations persist until user deletes them
- Images persist in Storage until downloaded/deleted
- Knowledge base entries persist until deleted

### Admin-Controlled
- User accounts can be deleted via Firebase Console
- Firestore data can be purged via Console or CLI
- Storage files can be removed via Console

---

## Security Measures

### Built into OpenElara Cloud

- **User-scoped data** - Firestore rules ensure users only access their own data
- **No cross-user access** - Security rules prevent reading other users' data
- **HTTPS only** - Firebase Hosting enforces HTTPS
- **API key isolation** - Keys in localStorage protected by same-origin policy

### Your Responsibility

- Keep Firebase credentials secure
- Review and test security rules
- Monitor for unusual activity
- Enable Firebase App Check if desired

---

## Children's Privacy

OpenElara Cloud is **NOT** intended for users under 18.

The application can connect to AI services that may generate mature content. Do not create accounts for minors.

---

## International Users

YOUR Firebase project location determines where data is stored. Choose a region appropriate for your users and applicable laws (GDPR, etc.).

---

## Changes to This Policy

This privacy policy may be updated as the application evolves. Check the "Last Updated" date at the top.

---

## Contact

| Purpose | Email |
|---------|-------|
| Privacy questions | privacy@applymytech.ai |
| General | openelara@applymytech.ai |
| Support | support@applymytech.ai |

---

## Summary

1. **We don't collect your data** - We can't, we don't have access to your Firebase
2. **You control everything** - Your project, your data, your rules
3. **API keys are user-side** - Stored in browser, never sent to us
4. **You're the admin** - Manage users, data, and security yourself

This is what "sovereign AI" means: **you own it all**.

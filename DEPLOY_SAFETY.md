# 🛡️ Deployment Safety Guide

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   THIS PROJECT: openelaracloud                                               ║
║   HOSTING URL:  https://openelaracloud.web.app                               ║
║                                                                              ║
║   🚫 NEVER DEPLOY TO: openelaracrm (that's a DIFFERENT project!)             ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## Quick Safety Check

Before any deployment, run this command to verify you're targeting the right project:

```powershell
# Check current Firebase project
firebase use

# Expected output should show:
# Active Project: openelaracloud
```

## Safe Deployment (Recommended)

Always use the deploy script which has built-in safeguards:

```powershell
.\deploy.ps1
```

The deploy script will:
1. ✅ Verify you're in the correct directory (checks `package.json` name)
2. ✅ Verify `.firebaserc` has correct project
3. ✅ Block deployment to any banned project
4. ✅ Require you to type `openelaracloud` to confirm
5. ✅ Always use `--project openelaracloud` flag

## Manual Deployment (Use with caution!)

If you must deploy manually, ALWAYS include the project flag:

```powershell
# Build first
npm run build

# Deploy with explicit project (REQUIRED!)
firebase deploy --project openelaracloud
```

**⚠️ NEVER run bare `firebase deploy` without `--project openelaracloud`**

## Banned Projects List

These projects should NEVER be deployed to from this directory:

| Project ID | Why It's Banned |
|------------|-----------------|
| `openelaracrm` | Completely different project |
| `applied-ai-assistant` | Wrong project |
| `appliedai-companion` | Wrong project |
| `ai-code-assistant-5ee79` | Wrong project |
| `phillabor-ai-assistant` | Wrong project |
| `project-assigner` | Wrong project |

## Files That Lock This Project

| File | Purpose |
|------|---------|
| `.firebaserc` | Sets `default` project to `openelaracloud` |
| `deploy.ps1` | Has hardcoded project and banned list |
| `.github/copilot-instructions.md` | Instructions for AI assistants |
| `DEPLOY_SAFETY.md` | This file - human reference |

## What To Do If You Accidentally Deploy Wrong

If you accidentally deploy to the wrong project:

1. **Don't panic** - the other project may still have its old code
2. Go to Firebase Console for that project
3. Check Hosting → Release History
4. Roll back to a previous deployment
5. Re-deploy the correct code to the correct project

## Emergency Commands

```powershell
# Check what project Firebase CLI thinks it's using
firebase use

# Force switch to correct project
firebase use openelaracloud

# Check .firebaserc contents
Get-Content .firebaserc

# Check package.json project name (should be "open-elara-cloud")
(Get-Content package.json | ConvertFrom-Json).name
```

---

**Remember: When in doubt, use `.\deploy.ps1`** - it has all the safeguards built in!

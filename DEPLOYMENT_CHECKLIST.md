# 🚀 Deployment Checklist - Post-Fixes

All security fixes have been applied. Follow this checklist before deploying.

---

## ⚠️ CRITICAL: Update BYOK Function Calls

The BYOK functions are now **async**. You **MUST** update these files before deploying:

### Files to Update:

#### 1. `src/pages/account.tsx` (Line 105, 142)
```typescript
// ❌ BEFORE (will break)
setApiKeys(getAllAPIKeys());
saveAPIKey(provider as keyof APIKeys, key || '');

// ✅ AFTER
const keys = await getAllAPIKeys();
setApiKeys(keys);
await saveAPIKey(provider as keyof APIKeys, key || '');
```

#### 2. `src/lib/apiClient.ts` (Multiple lines)
```typescript
// ❌ BEFORE (will break)
const apiKey = getAPIKey('together');

// ✅ AFTER
const apiKey = await getAPIKey('together');
```

**Search for all occurrences:**
```powershell
# PowerShell
Get-ChildItem -Recurse -Include *.ts,*.tsx src/ | 
  Select-String "getAPIKey\(|saveAPIKey\(|getAllAPIKeys\(" -SimpleMatch

# OR manually search in VS Code
# Press Ctrl+Shift+F and search: getAPIKey(
```

---

## ✅ Pre-Deployment Checklist

### **1. Code Updates** (REQUIRED)
- [ ] Update all `getAPIKey()` calls to `await getAPIKey()`
- [ ] Update all `saveAPIKey()` calls to `await saveAPIKey()`
- [ ] Update all `getAllAPIKeys()` calls to `await getAllAPIKeys()`
- [ ] Ensure calling functions are marked `async`

### **2. Install Dependencies**
```bash
npm install
cd functions && npm install && cd ..
```

### **3. Build Test**
```bash
npm run build
```
Should complete without errors.

### **4. Type Check**
```bash
npx tsc --noEmit
```
Should show no errors.

### **5. Test Locally**
```bash
npm run dev
```

Test these flows:
- [ ] Go to Account → API Keys
- [ ] Save a new API key (check localStorage - should see encrypted data)
- [ ] Refresh page - key should load
- [ ] Make a chat request with BYOK key
- [ ] Delete API key

---

## 🔧 Optional Setup

### **GitHub Actions CI/CD**

1. Get Firebase service account:
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save the JSON file

2. Add to GitHub:
   - Repository → Settings → Secrets → Actions
   - New repository secret
   - Name: `FIREBASE_SERVICE_ACCOUNT_OPENELARACLOUD`
   - Value: Paste entire JSON

3. Push to trigger:
   ```bash
   git push origin main
   ```

### **Error Monitoring (Sentry Recommended)**

1. Create free account at [sentry.io](https://sentry.io)

2. Install Sentry:
   ```bash
   npm install --save @sentry/nextjs
   ```

3. Add DSN to `.env.local`:
   ```
   NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
   ```

4. Uncomment Sentry code in `src/lib/errorMonitoring.ts`

5. Rebuild:
   ```bash
   npm run build
   ```

---

## 🚀 Deploy

### **Verify Project**
```powershell
.\verify-project.ps1
```
Should show: `openelaracloud`

### **Deploy**
```powershell
.\deploy.ps1
```

This will:
1. ✅ Verify you're deploying to correct project
2. ✅ Build Next.js static export
3. ✅ Build Cloud Functions
4. ✅ Deploy to Firebase Hosting + Functions

---

## 🧪 Post-Deployment Testing

After deployment, test on production:

1. **CSP Header Test**
   - Open DevTools → Network
   - Load your site
   - Check response headers for `Content-Security-Policy`

2. **Encrypted Keys Test**
   - Save an API key in Settings
   - Open DevTools → Application → Local Storage
   - Verify keys are encrypted (should see base64 gibberish)

3. **Rate Limiting Test**
   - Make 61 requests in quick succession
   - Should see "Rate limit exceeded" on 61st request

4. **Firestore Rules Test**
   - Try to write a huge document (>500KB)
   - Should be rejected

5. **Error Logging Test**
   - Check Cloud Functions logs in Firebase Console
   - Look for `functions.logger.error` instead of `console.error`

---

## 📊 What to Monitor

### **First Week**
- [ ] Check Firestore usage (rate limits collection)
- [ ] Monitor function execution count
- [ ] Watch for CSP violations in browser console
- [ ] Check GitHub Actions status (if enabled)

### **First Month**
- [ ] Review error logs (Sentry/Firebase)
- [ ] Check rate limit effectiveness
- [ ] Monitor storage usage
- [ ] Review CI/CD performance

---

## 🆘 Rollback Plan

If issues arise:

### **Quick Rollback**
```powershell
# Rollback hosting only
firebase hosting:rollback --project openelaracloud

# Rollback specific function
firebase functions:rollback functionName --project openelaracloud
```

### **Disable New Features**

**Disable CSP** (if causing issues):
Edit `firebase.json`, remove CSP header, redeploy.

**Disable Rate Limiting** (if causing issues):
Set `RATE_LIMIT_PER_MINUTE = 999999` in `functions/src/index.ts`, redeploy.

**Revert BYOK Encryption** (if causing issues):
Use sync versions:
```typescript
import { getAPIKeySync, saveAPIKeySync } from '@/lib/byok';
```

---

## ✅ Success Criteria

You're ready to deploy when:
- ✅ All TypeScript errors resolved
- ✅ Build completes successfully
- ✅ Local testing passes
- ✅ All BYOK calls updated to async
- ✅ Documentation reviewed

**Then**: `.\deploy.ps1` and you're live! 🎉

---

## 📚 Reference

- **Security Details**: `SECURITY_FIXES_2026-01-08.md`
- **Migration Guide**: `MIGRATION_GUIDE_ASYNC_BYOK.md`
- **Quick Summary**: `FIXES_SUMMARY.md`
- **Original Audit**: (Your honest assessment above)

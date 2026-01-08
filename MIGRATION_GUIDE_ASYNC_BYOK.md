# Migration Guide - BYOK Async Changes

## 🚨 Breaking Change

The BYOK functions are now **async** for Web Crypto encryption support.

---

## Files That Need Updates

Search your codebase for these patterns and update them:

### **Pattern 1: `getAPIKey()`**

```typescript
// ❌ OLD (synchronous)
const key = getAPIKey('together');
if (key) {
  // use key
}

// ✅ NEW (async)
const key = await getAPIKey('together');
if (key) {
  // use key
}

// OR use sync fallback (less secure)
const key = getAPIKeySync('together');
```

### **Pattern 2: `saveAPIKey()`**

```typescript
// ❌ OLD (synchronous)
saveAPIKey('together', 'sk-xxxxx');

// ✅ NEW (async)
await saveAPIKey('together', 'sk-xxxxx');

// OR use sync fallback (less secure)
saveAPIKeySync('together', 'sk-xxxxx');
```

### **Pattern 3: `getAllAPIKeys()`**

```typescript
// ❌ OLD (synchronous)
const keys = getAllAPIKeys();

// ✅ NEW (async)
const keys = await getAllAPIKeys();

// OR use sync fallback (less secure)
const keys = getAllAPIKeysSync();
```

---

## Quick Fix Script

Run this in your project root to find files that need updates:

```bash
# PowerShell
Get-ChildItem -Recurse -Include *.ts,*.tsx -Exclude node_modules | 
  Select-String "getAPIKey\(|saveAPIKey\(|getAllAPIKeys\(" | 
  Select-Object -ExpandProperty Path -Unique

# Bash
grep -r "getAPIKey\|saveAPIKey\|getAllAPIKeys" src/ --include="*.ts" --include="*.tsx"
```

---

## Common Files to Update

Based on your codebase structure, check these files:

1. **src/pages/account.tsx** - Settings page with API key management
2. **src/lib/apiClient.ts** - API calls that use BYOK keys
3. **src/lib/api.ts** - Re-exports BYOK functions
4. **src/components/CustomEndpointModal.tsx** - Custom endpoint configuration

---

## Testing Your Changes

After updating, test:

1. ✅ Save API key in Settings
2. ✅ Load API key on page refresh
3. ✅ Make API call with BYOK key
4. ✅ Remove API key
5. ✅ Check localStorage (should see encrypted data, not plain text)

---

## Rollback Plan

If issues arise, you can temporarily use sync functions:

1. Import sync versions:
   ```typescript
   import { getAPIKeySync, saveAPIKeySync, getAllAPIKeysSync } from '@/lib/byok';
   ```

2. Replace async calls with sync calls
3. Keys will be stored as base64 (not fully encrypted, but better than plain text)

---

## Notes

- **Sync functions**: Use base64 encoding (obfuscation only)
- **Async functions**: Use AES-GCM-256 encryption (proper security)
- **Backwards compatible**: Can read both plain text and encrypted keys
- **Migration**: Old keys will be re-encrypted on next save

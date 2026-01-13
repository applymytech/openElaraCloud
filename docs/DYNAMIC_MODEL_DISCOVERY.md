# Dynamic Model Discovery Architecture

## The Universal Pattern

This is how **every** OpenAI-compatible REST API works:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CONNECTION PATTERN                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   1. GET /models                                                        │
│      └─→ "What models do you have?"                                     │
│          Returns: [ {id, display_name, pricing, context_length, ...} ]  │
│                                                                         │
│   2. POST /chat/completions (ping test)                                 │
│      └─→ "Are you alive?"                                               │
│          Payload: { model: X, messages: [{role:"user", content:"Hi"}] } │
│          Returns: response + latency measurement                        │
│                                                                         │
│   3. Store results:                                                     │
│      └─→ Verified models (confirmed working)                            │
│      └─→ Response times (speed ranking)                                 │
│      └─→ Blocklist (claims serverless but fails)                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Why This Matters

### ❌ The Old Way (WRONG - Hardcoded)
```typescript
// DON'T DO THIS
const MODELS = [
  'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  'mistralai/Mixtral-8x7B-Instruct',
  // ... stale list that breaks when provider changes
];
```

### ✅ The New Way (CORRECT - Dynamic Discovery)
```typescript
// DO THIS
const models = await fetch('/models').then(r => r.json());
// Now verify each one actually works...
for (const model of models) {
  const result = await ping(model.id);
  // Store: working, response time, or blocklisted
}
```

## The Key Insight

**Free and paid models respond to the SAME payload.**

If a model appears in `/models` with valid pricing:
- `pricing.input = 0` → FREE (verified by ping test)
- `pricing.input > 0` → PAID (trust the endpoint, don't waste money pinging)
- `pricing = null` → DEDICATED ONLY (skip, won't work serverless)

The contract is simple: If it's listed with pricing, it WILL respond to `/chat/completions`.

## Implementation

### Files Created

| File | Purpose |
|------|---------|
| `src/lib/modelVerification.ts` | Core verification service - ping tests, caching, blocklists |
| `src/lib/useModelVerification.ts` | React hook for easy component integration |
| `src/components/ModelSelector.tsx` | Updated UI with verified models, response times |
| `src/pages/_app.tsx` | Background verification on app load |

### Flow

```
App Load
   │
   ├─→ Check cache (localStorage)
   │      └─→ Fresh? Use it. Stale? Continue...
   │
   ├─→ Fetch GET /models (Together.ai, OpenRouter, custom)
   │
   ├─→ Filter to serverless models (pricing !== null)
   │
   ├─→ Ping FREE models only (save money)
   │      ├─→ Success: Store verified + response time
   │      └─→ Failure: Add to blocklist
   │
   ├─→ Trust PAID models (if listed, they work)
   │
   └─→ Cache results (4 hour TTL)
```

### UI Structure

```
┌─ Model Selector ─────────────────────────────────────────┐
│ [🚀 Together.ai] [🌐 OpenRouter] [⚙️ Custom API]         │
├──────────────────────────────────────────────────────────┤
│ ⭐ FAVORITES                                              │
│   └─ Your starred models...                              │
│                                                          │
│ 🆓 FREE MODELS (VERIFIED) - sorted by speed              │
│   ├─ Model A    ⚡ FAST    ⏱️ 342ms   📏 128K ctx       │
│   ├─ Model B    🏃 QUICK   ⏱️ 567ms   📏 64K ctx        │
│   └─ Model C    🐢 SLOW    ⏱️ 2.1s    📏 32K ctx        │
│                                                          │
│ 💰 META                                                   │
│   ├─ Llama-3.3-70B-Turbo   $0.88/M   ⏱️ 412ms          │
│   └─ Llama-4-Maverick      $0.27/M   ⏱️ 298ms          │
│                                                          │
│ 💰 DEEPSEEK                                              │
│   └─ DeepSeek-V3           $1.25/M   ⏱️ 787ms          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Custom Endpoints

Any OpenAI-compatible API works the same way:

```typescript
// Ollama (local)
baseUrl: 'http://localhost:11434'

// LM Studio (local)
baseUrl: 'http://localhost:1234'

// Any provider following OpenAI spec
baseUrl: 'https://api.provider.com'
```

The pattern is universal:
- `GET {baseUrl}/v1/models`
- `POST {baseUrl}/v1/chat/completions`

## Background Sync

The verification runs:
1. **On first load** - Full verification if no cache
2. **On login** - Background refresh without blocking UI
3. **Every 4 hours** - Periodic sync while app is open

Cache is stored in localStorage with 4-hour TTL.

## Response Time = Speed Indicator

The ping test measures actual round-trip latency:
- `< 500ms` → ⚡ FAST
- `< 1500ms` → 🏃 QUICK
- `< 3000ms` → 🐢 SLOW
- `> 3000ms` → 🦥 VERY SLOW

This helps users choose models based on actual performance, not marketing claims.

## The Philosophy

**NEVER HARDCODE MODELS.**

The `/models` endpoint is the source of truth. Always.

If the endpoint goes down or changes, your app should gracefully handle it - not crash because you assumed "Llama-3.3-70B" would always exist.

Dynamic discovery means:
- ✅ New models appear automatically when providers add them
- ✅ Deprecated models disappear without code changes
- ✅ Pricing updates reflect immediately
- ✅ Any compatible endpoint works the same way

---

*This architecture was designed to be universal, resilient, and future-proof.*
---

## Implementation Status: ✅ COMPLETE

**Completed January 10, 2026:**

| Component | Status | Location |
|-----------|--------|----------|
| Core verification service | ✅ | `src/lib/modelVerification.ts` |
| React hook | ✅ | `src/lib/useModelVerification.ts` |
| Model selector UI | ✅ | `src/components/ModelSelector.tsx` |
| Background sync | ✅ | `src/pages/_app.tsx` |
| Hardcoded models | ✅ NUKED | Removed from all files |

**Test Scripts Available:**
- `architecture-review/src/test-any-endpoint.ts` - Universal endpoint tester
- `architecture-review/src/verify-together-models.ts` - Together.ai specific
- `architecture-review/src/verify-openrouter-models.ts` - OpenRouter specific

**Run the universal tester:**
```bash
cd c:\architecture-review\src
npx ts-node test-any-endpoint.ts
```

**Documentation:**
- [MODEL_VERIFICATION_ARCHITECTURE.md](../../architecture-review/docs/MODEL_VERIFICATION_ARCHITECTURE.md) - Full technical reference
# Desktop App Sync Instructions

**Date:** January 7, 2026  
**From:** OpenElara Cloud Codebase  
**To:** Desktop App Copilot  
**Re:** Token Management & Council Mode Alignment

---

## Overview

The cloud app has implemented updated token management and council mode patterns that the desktop app should adopt. These changes prioritize **soft limits** (prompt instructions) over **hard limits** (API `max_tokens` flags).

**Key Philosophy:** Let the model decide output length naturally when possible. Use prompt instructions to guide, not API parameters to force.

---

## 1. Token Management: 3-Tier Mode System

### Current Desktop Implementation
The desktop app uses `tokenManager.js` with fixed settings:
```javascript
// OLD: Single mode with hardcoded values
const DEFAULT_TOKEN_SETTINGS = {
  output: 0,
  knowledge: 2048,
  history: 2048,
  recentTurns: 5,
  systemReserve: 512,
  outputPercentage: 0.25,
};
```

### New Implementation Required

Add a `mode` field with three tiers:

```javascript
/**
 * Token Management Modes
 * 
 * FULLY_AUTO: 
 *   - Unrestricted RAG context (fills available space)
 *   - NO max_tokens sent in API call
 *   - Model decides response length naturally
 *   - Best for: Power users who want maximum context
 * 
 * SEMI_AUTO:
 *   - Only output size preference (user slider for desired response length)
 *   - Output preference added to SYSTEM PROMPT as instruction
 *   - NOT sent as max_tokens in API call
 *   - RAG context unrestricted
 *   - Best for: Users who want some control over response length
 * 
 * STANDARD:
 *   - Full token manager with all sliders
 *   - Knowledge, history, output all controlled
 *   - max_tokens IS sent in API call
 *   - Best for: Precise token budget control
 */

const DEFAULT_TOKEN_SETTINGS = {
  mode: 'fully-auto', // 'fully-auto' | 'semi-auto' | 'standard'
  output: 0,
  knowledge: 2048,
  history: 2048,
  recentTurns: 5,
  systemReserve: 512,
  outputPercentage: 0.25,
  knowledgePercentage: null,
  historyPercentage: null,
  // SEMI_AUTO specific: desired response size in WORDS (not tokens)
  preferredResponseWords: null, // null = no preference
};
```

### API Call Changes

**CRITICAL:** Only send `max_tokens` in STANDARD mode.

```javascript
// In your API routing code (e.g., routeApiCall.js)

function buildRequestBody(payload, tokenSettings) {
  const requestBody = {
    model: payload.model,
    messages: payload.messages,
    temperature: payload.temperature ?? 0.7,
  };
  
  // ONLY add max_tokens in STANDARD mode
  if (tokenSettings.mode === 'standard') {
    requestBody.max_tokens = calculateMaxTokens(payload.model, inputTokens, tokenSettings);
  }
  // FULLY_AUTO and SEMI_AUTO: Don't send max_tokens - let model decide
  
  return requestBody;
}
```

### Semi-Auto: System Prompt Instruction

When mode is `semi-auto` and user has set `preferredResponseWords`, add this to the system prompt:

```javascript
function getOutputPreferenceInstruction(tokenSettings) {
  if (tokenSettings.mode !== 'semi-auto') return null;
  if (!tokenSettings.preferredResponseWords) return null;
  
  const words = tokenSettings.preferredResponseWords;
  
  // Create natural language instruction based on word count
  if (words <= 50) {
    return `\n\n**User Preference:** Keep your response brief - around ${words} words or less. Be concise.`;
  } else if (words <= 150) {
    return `\n\n**User Preference:** Aim for a moderate response length - around ${words} words.`;
  } else if (words <= 300) {
    return `\n\n**User Preference:** Provide a detailed response - around ${words} words.`;
  } else {
    return `\n\n**User Preference:** Provide a comprehensive, thorough response - around ${words} words or more if needed.`;
  }
}
```

**This instruction goes in the system prompt, NOT as an API parameter.**

---

## 2. Council Mode: Soft Token Limits

### Current Desktop Implementation
```javascript
// OLD: Hard max_tokens limit
const COUNCIL_OUTPUT_LIMIT = 1024;

// In the API call:
const response = await routeApiCall({
  ...
  maxTokens: COUNCIL_OUTPUT_LIMIT,  // ❌ HARD LIMIT - REMOVE THIS
  ...
});
```

### New Implementation Required

**Remove the hard `maxTokens` from the API call. Use system prompt instruction only.**

```javascript
const COUNCIL_OUTPUT_LIMIT = 1024; // Keep as soft guidance value

// Build system prompt with soft limit instruction
const systemPrompt = buildChatSystemPrompt({
  userName: 'User',
  character: persona.character,
  outputTokenLimit: COUNCIL_OUTPUT_LIMIT, // Soft limit via prompt instruction
});

// API call - NO maxTokens parameter
const response = await routeApiCall({
  mode: persona.id,
  // ✅ NO maxTokens here - soft limit only via system prompt
  history: [{ role: "user", content: focusedPrompt }],
});
```

### Why Soft Limits?

1. **Coherent responses**: Hard cutoffs can truncate mid-sentence
2. **Model judgment**: Let the model decide if it needs 50 more tokens to complete a thought
3. **Cost control still works**: The prompt instruction still guides the model to be concise
4. **Better synthesis**: Council perspectives that are complete are easier to synthesize

---

## 3. Summary of Changes

| Component | Old Behavior | New Behavior |
|-----------|--------------|--------------|
| Token Mode | Single mode | 3 modes: fully-auto, semi-auto, standard |
| max_tokens in API | Always sent | Only in STANDARD mode |
| Semi-auto output control | N/A | System prompt instruction |
| Council persona limits | Hard `maxTokens: 1024` | Soft prompt instruction only |

---

## 4. Files to Update (Desktop App)

1. **`src/main/handlers/tokenManager.js`**
   - Add `mode` field to settings
   - Add `preferredResponseWords` field
   - Add `getOutputPreferenceInstruction()` function

2. **`src/main/handlers/routeApiCall.js`** (or equivalent)
   - Only include `max_tokens` when mode is 'standard'
   - For semi-auto, inject output preference into system prompt

3. **`src/main/handlers/appHandlers.js`**
   - In `executeCollectiveMode()`: Remove `maxTokens` from API call
   - Keep `outputTokenLimit` in `buildChatSystemPrompt()` for soft guidance

4. **UI Components** (Settings panel)
   - Add mode selector: "Fully Automatic" / "Semi-Automatic" / "Standard"
   - Show/hide sliders based on mode
   - Semi-auto: Show only "Preferred Response Length" slider (in words)

---

## 5. Testing Checklist

- [ ] Fully-auto mode: Confirm no `max_tokens` in API requests
- [ ] Semi-auto mode: Confirm output preference appears in system prompt
- [ ] Semi-auto mode: Confirm no `max_tokens` in API requests
- [ ] Standard mode: Confirm `max_tokens` IS sent in API requests
- [ ] Council mode: Confirm no `maxTokens` in persona API calls
- [ ] Council mode: Confirm personas still receive token budget instruction in system prompt

---

## 6. Reference Implementation

See the cloud app files for working implementation:
- `src/lib/tokenBudget.ts` - TokenMode type, settings, calculateMaxTokens
- `src/lib/apiClient.ts` - Conditional max_tokens in API calls
- `src/lib/councilMode.ts` - Soft limit council implementation

---

**End of Instructions**

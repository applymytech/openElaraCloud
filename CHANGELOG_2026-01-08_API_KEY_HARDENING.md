# API Key Hardening for Deep Thought Tools

**Date:** January 8, 2026  
**Status:** ✅ Complete

## Problem

Deep Thought's tool system would fail silently or with cryptic errors when users didn't have required API keys (Exa for web search, Together.ai for image/video generation). The LLM would attempt to use tools that couldn't work, leading to poor user experience.

## Solution

Implemented intelligent tool filtering and friendly error messages that inform both the LLM and the user about missing capabilities.

## Changes Made

### 1. `src/lib/tools.ts`

#### Added `getAvailableTools()` Function
```typescript
export function getAvailableTools(): { tools: Tool[]; unavailableReasons: string[] }
```

- Checks for Exa API key (required for `search_web`, `read_url`)
- Checks for Together.ai API key (required for `make_image`, `make_video`)
- Returns only tools that can actually be used
- Returns friendly messages for unavailable tools with emoji indicators

#### Updated Tool Execution with Key Checks
Each tool now validates API keys before attempting execution:

**search_web:**
```typescript
if (!getAPIKey('exa')) {
  throw new Error('I need an Exa API key to search the web! Please add one in your Account settings to enable web search.');
}
```

**read_url:**
```typescript
if (!getAPIKey('exa')) {
  throw new Error('I need an Exa API key to read URLs! Please add one in your Account settings to enable web content reading.');
}
```

**make_image:**
```typescript
if (!getAPIKey('together')) {
  throw new Error('I need a Together.ai API key to create images! Please add one in your Account settings to unlock my creative abilities.');
}
```

**make_video:**
```typescript
if (!getAPIKey('together')) {
  throw new Error('I need a Together.ai API key to create videos! Please add one in your Account settings to unlock my video generation abilities.');
}
```

#### Updated `getRelevantTools()`
- Now returns `{ description: string; unavailable: string[] }` instead of just string
- Filters tools based on available API keys
- Provides context about unavailable tools to the LLM

### 2. `src/lib/deepThought.ts`

#### System Prompt Enhancement
```typescript
function buildDeepThoughtSystemPrompt(userQuery: string, maxTurns: number)
```

Now dynamically builds tool list based on available keys:
- Lists only available tools in "Available Tools" section
- Adds "Tools Currently Unavailable" section with friendly explanations
- Instructs LLM to explain missing capabilities if user requests them

Example unavailable message:
```
🔍 search_web: I need an Exa API key to search the web and read URLs. Add one in your Account settings to unlock my web research abilities!
```

#### Tool Filtering in Execution
```typescript
const { tools: availableTools } = getAvailableTools();
const response = await chat(messages, {
  tools: availableTools.length > 0 ? availableTools : undefined,
  tool_choice: availableTools.length > 0 ? 'auto' : undefined,
});
```

- Only passes available tools to the LLM
- Prevents LLM from attempting to use tools without required keys
- Sets `tool_choice: undefined` when no tools available

## User Experience Improvements

### Before:
❌ LLM tries to search web → cryptic error → user confused  
❌ LLM tries to generate image → fails silently → no explanation

### After:
✅ LLM sees only available tools → uses what works  
✅ LLM told about missing tools → explains to user naturally  
✅ Clear error messages if tool somehow gets called without key

## Example Scenarios

### Scenario 1: User Has No Keys
**System Prompt:**
```
## Available Tools:

- save_thought: Save an important finding or reasoning step

## Tools Currently Unavailable:

🔍 search_web: I need an Exa API key to search the web...
🔍 read_url: I need an Exa API key to read URLs...
🎨 make_image: I need a Together.ai API key to create images...
🎨 make_video: I need a Together.ai API key to create videos...
```

**LLM Response:**
> "I'd love to search the web for that information, but I need an Exa API key to access live web data. You can add one in your Account settings to unlock my research capabilities!"

### Scenario 2: User Has Exa but Not Together.ai
**System Prompt:**
```
## Available Tools:

- search_web: Search the web for CURRENT LIVE information...
- read_url: Read the CURRENT LIVE content of a webpage...
- save_thought: Save an important finding...

## Tools Currently Unavailable:

🎨 make_image: I need a Together.ai API key to create images...
🎨 make_video: I need a Together.ai API key to create videos...
```

**LLM Can:**
✅ Search web  
✅ Read URLs  
✅ Save thoughts  

**LLM Cannot:**
❌ Generate images (explains why)  
❌ Generate videos (explains why)

### Scenario 3: User Has All Keys
**System Prompt:**
```
## Available Tools:

- search_web: Search the web for CURRENT LIVE information...
- read_url: Read the CURRENT LIVE content of a webpage...
- make_image: Create an image based on a description...
- make_video: Create a short video based on a description...
- save_thought: Save an important finding...
```

**LLM Can:**
✅ Everything! Full agentic capabilities unlocked

## Testing Recommendations

1. **No Keys:** Enable Deep Thought and ask it to search something
   - Expected: Friendly message about needing Exa key

2. **Only Exa:** Ask it to create an image
   - Expected: Friendly message about needing Together.ai key
   - Should still be able to search web successfully

3. **All Keys:** Full agentic workflow
   - Expected: All tools work seamlessly

## Technical Notes

- `save_thought` requires no API keys (always available)
- Tool filtering happens at system prompt AND runtime for defense-in-depth
- Friendly error messages use emoji for visual clarity 🔍🎨
- Messages guide users to Account settings for key management

## Files Modified

- ✅ `src/lib/tools.ts` - Tool availability checking and error messages
- ✅ `src/lib/deepThought.ts` - Dynamic system prompt and tool filtering

## Build Status

✅ TypeScript compilation successful  
✅ No errors or warnings  
✅ Ready for deployment

---

**Philosophy:** An AI that knows its limitations and can explain them clearly is more trustworthy than one that silently fails or gives cryptic errors.

# OpenElara Cloud - Agentic Tooling Implementation Plan

## Executive Summary

**Goal**: Transform OpenElara Cloud into a powerful agentic system where the LLM can autonomously use tools (Exa search/crawl, image/video generation) across multiple reasoning turns to handle complex user requests.

**Core Concept**: Give the LLM appropriate tools and clear instructions, let it reason through a task over multiple turns (minimum 5, user-configurable), with unrestricted token access to ensure quality.

---

## ✅ What Already Exists

### 1. **Exa Integration** (✅ COMPLETE)
- ✅ Power Search - Web search with highlights
- ✅ Power Read (Crawl) - Extract content from URLs
- ✅ Power Similar - Find similar pages
- ✅ Power Answer - AI-generated answers with sources
- ✅ Deep Research - Long-running research tasks
- ✅ BYOK mode (users bring their own Exa key)

**Status**: `src/lib/exa.ts` has full Exa API support from desktop port

### 2. **Image/Video Generation** (✅ COMPLETE)
- ✅ Direct image generation (Together.ai)
- ✅ Agentic selfie generation (LLM decides scene)
- ✅ Video generation (Together.ai)
- ✅ Content signing and metadata

**Status**: `src/lib/mediaGeneration.ts` has `generateAgenticSelfie()` and `generateAgenticVideo()`

### 3. **Token Management** (✅ COMPLETE)
- ✅ `TokenBudget` class with 3 modes: fully-auto, semi-auto, standard
- ✅ Fully-auto mode = unrestricted context (perfect for Deep Thought)

**Status**: `src/lib/tokenBudget.ts` ready for unrestricted mode

### 4. **Signing & Metadata** (⚠️ PARTIAL)
- ✅ Signing logic exists
- ✅ Metadata generation
- ⚠️ **ISSUE**: Metadata not persisting when downloaded from cloud
- ⚠️ **ISSUE**: Metadata injection may have bugs

**Status**: Needs debugging and verification

---

## 🚀 What Needs to Be Built

### 0. **BYOEndpoint - Universal Chat API** (NEW - PREREQUISITE)

**What it is**: Allow users to connect to ANY chat LLM by providing custom endpoints.

#### Why This First?

Deep Thought needs reliable chat infrastructure. The BYOEndpoint system lets users:
- Attempt to use any OpenAI-compatible REST API (no guarantees)
- Add custom JSON fields for provider quirks (e.g., `"nsfw": true`)
- Fully override the payload structure if needed
- **Chat only - NOT for image/video generation**

⚠️ **Disclaimer**: This is pure REST API guesswork based on OpenAI standards. If your endpoint doesn't follow these standards, it will fail. We make no guarantees about any specific provider.

#### Architecture

```typescript
// Custom Endpoint Configuration
interface CustomEndpoint {
  name: string;              // User-friendly name (e.g., "My Custom API")
  apiKey: string;            // API key (can be empty for some providers)
  baseUrl?: string;          // Base URL (e.g., https://api.example.com)
  modelsEndpoint?: string;   // Custom /models path (optional)
  chatEndpoint?: string;     // Custom /chat/completions path (optional)
  customPayload?: string;    // JSON additions (e.g., '{"nsfw": true}')
  overridePayload?: boolean; // Let user build entire payload
}
```

#### Standard OpenAI-Compatible Flow

```
User Request
     ↓
[Detect Provider: Custom Endpoint]
     ↓
Build Payload:
  Base: { model, messages, temperature }
  + Custom JSON: { nsfw: true, top_k: 40, ... }
     ↓
POST to customEndpoint.chatEndpoint || baseUrl/v1/chat/completions
     ↓
Parse Response (OpenAI format)
     ↓
Return to User
```

#### Payload Customization Levels

**Level 1: Standard + Custom Fields** (Most Common)
```typescript
// User adds: { "nsfw": true, "top_k": 40 }
const payload = {
  model: selectedModel,
  messages: [...],
  temperature: 0.7,
  // Merged custom fields
  nsfw: true,
  top_k: 40
};
```

**Level 2: Full Override** (Advanced)
```typescript
// User provides entire payload template
const payload = JSON.parse(customEndpoint.payloadTemplate
  .replace('{{MODEL}}', selectedModel)
  .replace('{{MESSAGES}}', JSON.stringify(messages))
  .replace('{{TEMPERATURE}}', temperature.toString())
);
```

#### Implementation

**New Storage Keys** (localStorage):
```
elara_custom_endpoints: CustomEndpoint[]
elara_active_endpoint: string (name)
```

**New Functions** (byok.ts):
```typescript
- saveCustomEndpoint(endpoint: CustomEndpoint)
- getCustomEndpoint(name: string)
- getAllCustomEndpoints()
- removeCustomEndpoint(name: string)
- setActiveEndpoint(name: 'together' | 'openrouter' | string)
```

**Enhanced Chat** (apiClient.ts):
```typescript
- detectProvider() → Now includes 'custom'
- chatWithCustomEndpoint(endpoint, payload)
- mergeCustomPayload(basePayload, customJSON)
```

**UI Updates** (account.tsx):
```tsx
// New section in API Keys tab
<h3>🌐 Custom Endpoints (BYOEndpoint)</h3>
<button>+ Add Custom Endpoint</button>

// Modal for configuration
<CustomEndpointModal>
  <input name="name" placeholder="My Custom API" />
  <input name="apiKey" placeholder="Optional API Key" />
  <input name="baseUrl" placeholder="https://api.example.com" />
  <textarea name="customPayload" placeholder='{"temperature": 0.8}' />
  <checkbox name="overridePayload" label="Advanced: Full Payload Override" />
  <textarea name="payloadTemplate" placeholder="{{MODEL}}, {{MESSAGES}}" />
</CustomEndpointModal>

// Model selector shows custom endpoints
<ModelSelector>
  <optgroup label="Together.ai">...</optgroup>
  <optgroup label="OpenRouter">...</optgroup>
  <optgroup label="Custom Endpoints">
    <option>My Custom API</option>
  </optgroup>
</ModelSelector>
```

---

### 1. **Deep Thought System** (NEW)

**What it is**: A multi-turn reasoning mode where the LLM uses tools to build up context before responding.

#### Architecture

```
User Request
     ↓
[Deep Thought Mode Activated]
     ↓
┌─────────────────────────────┐
│   Turn 1: Planning          │ → LLM analyzes request, decides tools needed
├─────────────────────────────┤
│   Turn 2: Information       │ → Uses Exa /answer for live research
│         Gathering           │   (prioritize live crawls)
├─────────────────────────────┤
│   Turn 3: Additional        │ → Exa search/crawl for more detail
│         Research            │
├─────────────────────────────┤
│   Turn 4: Creative Tasks    │ → Generate images/videos if needed
├─────────────────────────────┤
│   Turn 5+: Synthesis        │ → Compile final comprehensive answer
└─────────────────────────────┘
     ↓
Final Response to User
```

#### System Prompt Structure

```typescript
const DEEP_THOUGHT_PROMPT = `
You are in DEEP THOUGHT MODE - a multi-turn reasoning process.

YOUR TASK: ${userQuery}

YOU HAVE ${turnsRemaining} TURNS REMAINING to complete this task.

TURN ${currentTurn}/${maxTurns}

AVAILABLE TOOLS:
- exa_answer: Get comprehensive AI answers from live web research (PREFER THIS)
- exa_search: Search the web with semantic ranking
- exa_crawl: Extract full content from specific URLs (use livecrawl='always')
- exa_similar: Find pages similar to a given URL
- make_notes: Record important findings for later turns
- generate_image: Create images based on descriptions
- generate_video: Create videos based on descriptions

GUIDELINES:
1. PRIORITIZE LIVE DATA: When using Exa tools, always prefer live crawls over cached
2. For research: Start with exa_answer, then drill down with search/crawl if needed
3. For creative tasks: Use generate_image/generate_video with detailed prompts
4. Make notes throughout to track your reasoning
5. Don't respond to the user until final turn - use turns to build context
6. On final turn: Synthesize all findings into comprehensive answer

CURRENT CONTEXT:
${previousNotes}

YOUR RESPONSE (this turn):
`;
```

#### Implementation Files

**New File**: `src/lib/deepThought.ts`
```typescript
export interface DeepThoughtConfig {
  maxTurns: number;        // User-configurable (min 5)
  currentTurn: number;
  userQuery: string;
  notes: string[];         // Accumulated notes across turns
  toolResults: ToolResult[];
}

export interface ToolResult {
  turn: number;
  tool: string;
  input: any;
  output: any;
  timestamp: string;
}

export async function executeDeepThought(
  query: string, 
  maxTurns: number = 5
): Promise<DeepThoughtResult>
```

**Modified File**: `src/pages/chat.tsx`
- Add "Deep Thought" toggle button
- Show turn counter during execution
- Display intermediate reasoning (collapsible)

---

### 2. **LLM Tool Calling Integration** (NEW)

**Challenge**: Keep tools DEAD SIMPLE so even 4B models can use them, but powerful enough for 400B+ models.

**Design Philosophy**:
- Minimal tool count (only what's needed)
- Clear, obvious names
- Simple parameter schemas
- No nested complexity
- Use RAG to help LLM find the right tool

#### Tool Definitions (SIMPLE & FOCUSED)

```typescript
// src/lib/tools.ts (NEW FILE)

/**
 * SIMPLE TOOL SYSTEM - Even 4B models can understand this
 * 
 * Design Rules:
 * 1. Max 6-8 tools (cognitive load)
 * 2. Obvious names (search_web NOT exa_neural_discovery)
 * 3. 1-3 parameters max per tool
 * 4. Required params only
 * 5. Clear descriptions in plain English
 */

export const DEEP_THOUGHT_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Search the web for current information. Use this for factual questions, news, recent events. Returns AI-generated answer with sources.",
      parameters: {
        type: "object",
        properties: {
          query: { 
            type: "string", 
            description: "What to search for (plain English question)" 
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_url",
      description: "Read the full content of a specific webpage. Use when you need details from a URL you found.",
      parameters: {
        type: "object",
        properties: {
          url: { 
            type: "string", 
            description: "The URL to read" 
          }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "make_image",
      description: "Create an image. You decide all creative details based on what the user wants.",
      parameters: {
        type: "object",
        properties: {
          description: { 
            type: "string", 
            description: "Detailed description of the image to create (you write this, not the user)" 
          }
        },
        required: ["description"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "make_video",
      description: "Create a short video. You decide all creative details based on what the user wants.",
      parameters: {
        type: "object",
        properties: {
          description: { 
            type: "string", 
            description: "Detailed description of the video to create (you write this, not the user)" 
          }
        },
        required: ["description"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_thought",
      description: "Save an important finding or reasoning step for later turns. Use this to build up your understanding.",
      parameters: {
        type: "object",
        properties: {
          thought: { 
            type: "string", 
            description: "What you learned or figured out" 
          }
        },
        required: ["thought"]
      }
    }
  }
];

/**
 * Tool execution - maps simple names to complex implementations
 */
export async function executeToolCall(
  toolName: string,
  args: any,
  context: DeepThoughtConfig
): Promise<any> {
  switch (toolName) {
    case "search_web":
      // Maps to Exa powerAnswer with livecrawl='always'
      return await powerAnswer(args.query, { 
        numResults: 10,
        livecrawl: 'always'  // ALWAYS prefer live data
      });
      
    case "read_url":
      // Maps to Exa powerRead with livecrawl='always'
      return await powerRead(args.url, {
        livecrawl: 'always'  // ALWAYS prefer live data
      });
      
    case "make_image":
      // LLM already wrote the detailed description
      return await generateImage({
        prompt: args.description,
        model: DEFAULT_IMAGE_MODEL,
        width: DEFAULT_IMAGE_WIDTH,
        height: DEFAULT_IMAGE_HEIGHT,
      });
      
    case "make_video":
      return await generateAgenticVideo({
        userRequest: args.description,
        aiDecision: args.description,
        duration: 5
      });
      
    case "save_thought":
      context.notes.push(`[Turn ${context.currentTurn}] ${args.thought}`);
      return { success: true, saved: args.thought };
      
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
```

#### RAG-Assisted Tool Discovery

**Problem**: Even with simple tools, models can forget which tools exist.

**Solution**: Store tool definitions in RAG, retrieve before each turn.

```typescript
// When Deep Thought starts
const toolDescriptions = DEEP_THOUGHT_TOOLS
  .map(t => `${t.function.name}: ${t.function.description}`)
  .join('\n');

// Add to RAG
await ingestToolDefinitions(toolDescriptions);

// Before each turn
const relevantTools = await retrieveRelevantTools(userQuery);

// Add to system prompt
const systemPrompt = `
You have these tools available:
${relevantTools}

Use them when needed. Simple and direct.
`;
```
```

---

### 3. **Enhanced Image/Video Agency** (ENHANCE EXISTING)

**Current State**: We have `generateAgenticSelfie()` and `generateAgenticVideo()` which let the LLM decide the scene.

**Enhancement Needed**: Extend this pattern to general image/video requests, not just selfies.

#### New Functions

```typescript
// src/lib/mediaGeneration.ts (additions)

export interface AgenticImageOptions {
  userRequest: string;          // "I want a picture of people on a beach"
  conversationContext?: string; // Recent chat history for context
  clarificationTurn?: number;   // Which clarification turn (1-3)
  maxClarifications?: number;   // How many turns to clarify before generating
}

export interface AgenticImageResult {
  needsClarification: boolean;
  clarificationQuestion?: string;
  image?: GeneratedImage;
  reasoning?: string;  // LLM's creative decision process
}

/**
 * AGENTIC IMAGE GENERATION - Full Creative Control to LLM
 * 
 * Flow:
 * 1. User: "I want a picture of some people enjoying a beach"
 * 2. LLM (Turn 1): "What style? Photorealistic, cartoon, painting?"
 * 3. User: "Photorealistic"
 * 4. LLM (Turn 2): "Time of day? Sunset, midday, etc?"
 * 5. User: "Sunset"
 * 6. LLM: [Builds prompt with all creative decisions] → Generate
 */
export async function generateAgenticImage(
  options: AgenticImageOptions
): Promise<AgenticImageResult>
```

**Implementation Strategy**:
- Let the LLM ask clarifying questions (1-3 turns)
- LLM makes ALL creative decisions not specified by user
- LLM builds final detailed prompt
- Generate with signed metadata

---

### 4. **Fix Image Metadata Persistence** (DEBUG & FIX)

**Problem**: When images are generated and stored in Firebase Storage, the metadata doesn't persist when downloaded.

**Root Cause Investigation Needed**:

1. **Browser Canvas Limitation**: 
   - Canvas API can't directly modify EXIF/PNG chunks
   - Current code may be trying to embed metadata in image data (won't survive download)

2. **Sidecar Approach**:
   - Current code generates sidecar `.json` files
   - These may not be downloaded alongside images

3. **Firebase Storage Metadata**:
   - Firebase Storage has custom metadata API
   - Should be using `customMetadata` field on upload

#### Action Items

**Verify Current Behavior**:
```typescript
// Test script to check what's actually stored
1. Generate image
2. Check Firebase Storage object metadata
3. Download via browser
4. Check local file metadata
5. Identify where metadata is lost
```

**Fix Strategy**:
```typescript
// src/lib/signing.ts (modifications)

// Option A: Firebase Storage Custom Metadata
export async function uploadSignedImage(
  imageBlob: Blob,
  metadata: ContentMetadata,
  path: string
): Promise<string> {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, imageBlob, {
    customMetadata: {
      'openelara-signature': JSON.stringify(metadata),
      'signed-at': metadata.timestamp,
      'signed-by': metadata.userId,
      // ... all other metadata fields
    }
  });
  return getDownloadURL(storageRef);
}

// Option B: Sidecar File Approach (current, needs fixing)
export async function downloadWithSidecar(
  imageUrl: string,
  metadata: ContentMetadata
): Promise<void> {
  // Download image
  const imgResponse = await fetch(imageUrl);
  const imgBlob = await imgResponse.blob();
  
  // Download sidecar JSON
  const sidecarUrl = imageUrl.replace(/\.(png|jpg)$/, '.json');
  const jsonBlob = new Blob([JSON.stringify(metadata, null, 2)], 
    { type: 'application/json' });
  
  // Save both files
  const fileName = extractFileName(imageUrl);
  saveAs(imgBlob, fileName);
  saveAs(jsonBlob, fileName.replace(/\.(png|jpg)$/, '.json'));
}
```

---

## 📋 Implementation Phases

### Phase 1: Core Deep Thought System (Week 1)
- [ ] Create `src/lib/deepThought.ts`
- [ ] Create `src/lib/tools.ts` with tool definitions
- [ ] Implement `executeDeepThought()` main loop
- [ ] Add tool execution handlers
- [ ] Test with simple queries

### Phase 2: UI Integration (Week 1)
- [ ] Add Deep Thought toggle to chat UI
- [ ] Show turn counter during execution
- [ ] Display intermediate reasoning (collapsible sections)
- [ ] Add turn count selector (5-20 range)
- [ ] Visual indicator for tool execution

### Phase 3: Exa Integration Priority (Week 2)
- [ ] Verify all Exa endpoints work
- [ ] Add `livecrawl='always'` defaults
- [ ] Test exa_answer with live data priority
- [ ] Benchmark response quality vs training data
- [ ] Document best practices

### Phase 4: Enhanced Media Agency (Week 2)
- [ ] Implement `generateAgenticImage()` with clarifications
- [ ] Implement `generateAgenticVideo()` enhancements
- [ ] Test multi-turn clarification flow
- [ ] Ensure LLM makes creative decisions
- [ ] Test prompt quality

### Phase 5: Metadata Debugging & Fix (Week 3)
- [ ] Write test script to trace metadata flow
- [ ] Identify where metadata is lost
- [ ] Implement fix (Firebase Storage metadata OR sidecar)
- [ ] Verify metadata survives download
- [ ] Test with C2PA verification tools
- [ ] Document verification process

### Phase 6: Testing & Refinement (Week 3-4)
- [ ] End-to-end test: Research query → Image generation
- [ ] Test with various turn counts (5, 10, 20)
- [ ] Performance optimization (caching, parallel tools)
- [ ] Error handling edge cases
- [ ] User documentation

---

## 🎯 Key Design Principles

### 1. **Live Data Priority**
- All Exa calls default to `livecrawl='always'`
- System prompt emphasizes live data over training data
- exa_answer is the primary research tool

### 2. **LLM Agency**
- LLM makes creative decisions (scenes, styles, compositions)
- User provides intent, LLM provides expertise
- Multi-turn clarifications allow refinement

### 3. **Unrestricted Tokens**
- Deep Thought mode forces `fully-auto` token mode
- No hardcoded max_tokens limits
- Let model use what it needs for quality

### 4. **Transparency**
- Show intermediate reasoning to user
- Display which tools are being used
- Let user see the LLM's thought process

### 5. **Metadata Integrity**
- All generated content has provenance
- Metadata survives download and transfer
- Easy verification for users

---

## ⚠️ Risks & Mitigations

### Risk 1: Cost Explosion
**Problem**: Multi-turn reasoning with large contexts = expensive
**Mitigation**: 
- User-configurable turn limits (default 5, max 20)
- BYOK mode strongly encouraged for heavy users
- Clear cost warnings in UI

### Risk 2: Tool Hallucination
**Problem**: LLM might "imagine" tool calls that don't exist
**Mitigation**:
- Strict tool schema validation
- Error messages fed back to LLM for correction
- Fallback to direct response if tools fail

### Risk 3: Metadata Complexity
**Problem**: Image metadata is hard to preserve across platforms
**Mitigation**:
- Multi-layered approach: Firebase metadata + sidecar files
- Clear documentation on verification
- Accept that some platforms will strip metadata

### Risk 4: Performance
**Problem**: Multi-turn with tools could be slow
**Mitigation**:
- Parallel tool execution where possible
- Caching for repeated queries
- Progress indicators in UI
- Background processing for long research tasks

---

## 📊 Success Metrics

### Functionality
- ✅ Deep Thought completes complex queries without user intervention
- ✅ LLM successfully uses all tools without hallucination
- ✅ Image/video generation shows clear creative decisions
- ✅ Metadata verifiable in generated content

### Quality
- ✅ Research answers cite live sources (not training data)
- ✅ Generated images match user intent with LLM refinements
- ✅ Multi-turn reasoning shows logical progression
- ✅ Metadata survives download and transfer

### Performance
- ✅ 5-turn Deep Thought completes in < 2 minutes
- ✅ Tool calls succeed > 95% of time
- ✅ No rate limit violations under normal use
- ✅ UI remains responsive during processing

---

## 🚀 Next Steps

1. **Review this plan** with stakeholder
2. **Prioritize phases** based on user needs
3. **Start Phase 1**: Core Deep Thought implementation
4. **Set up testing environment** for metadata debugging
5. **Create user documentation** as features are built

---

## 📝 Notes

- This plan assumes BYOK mode for heavy usage (cost management)
- Desktop app has more advanced features (Code Studio, local RAG)
- Cloud version focuses on accessible agentic chat + media generation
- Exa integration is the differentiator (live data > training data)
- Metadata persistence is critical for provenance trust

---

**Created**: January 8, 2026
**Status**: PLANNING PHASE
**Next Review**: After stakeholder feedback

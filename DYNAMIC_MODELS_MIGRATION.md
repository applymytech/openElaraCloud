# Dynamic Model Loading Migration

## Problem

We were maintaining a **manual database** of chat models in `models.ts` with hardcoded:
- Model IDs
- Display names
- Pricing info
- Context lengths
- Tool support flags

This is fragile and requires constant updates when Together.ai adds/removes models.

## Solution

**Fetch directly from Together.ai `/models` endpoint**

All the data we need is in the API response:
- `id` - Model ID
- `type` - "chat", "image", "video", etc.
- `display_name` - Human-readable name
- `context_length` - Token limit
- `pricing` - Cost structure
- Plus other metadata

## Implementation

### 1. Dynamic Model Fetcher

Created `src/lib/dynamicModels.ts`:
- `fetchTogetherModels()` - Get all models from API (cached 5 min)
- `getChatModelsFromAPI()` - Filter to chat models
- `getImageModelsFromAPI()` - Filter to image models
- `getVideoModelsFromAPI()` - Filter to video models
- `getFreeModels(type)` - Get FREE models by type
- `findModel(id)` - Look up specific model
- `supportsTools(model)` - Heuristic for function calling support

### 2. Test Script

`test-models-api.js` verifies API schema and lists all available models:

```bash
# PowerShell
$env:TOGETHER_API_KEY="your_key"
node test-models-api.js

# Or pass directly
node test-models-api.js your_key
```

### 3. Migration Path

**Phase 1: Hybrid** (Current)
- Keep existing `models.ts` for backwards compatibility
- Add `dynamicModels.ts` for new code
- Model selector uses dynamic loading

**Phase 2: Full Dynamic**
- Remove hardcoded CHAT_MODEL_METADATA
- All model lists come from API
- Only keep image/video registries (they have parameter schemas not in API)

## Benefits

✅ No more manual updates when Together.ai adds models
✅ Always shows latest available models
✅ Accurate pricing from API
✅ Free models auto-detected
✅ Single source of truth

## API Response Example

```json
{
  "data": [
    {
      "id": "ServiceNow-AI/Apriel-1.6-16b-Thinker",
      "type": "chat",
      "display_name": "Apriel 1.6 16B Thinker",
      "context_length": 32768,
      "pricing": {
        "input": 0.0,
        "output": 0.0
      }
    }
  ]
}
```

## Usage Example

```typescript
import { getChatModelsFromAPI, getFreeModels, supportsTools } from '@/lib/dynamicModels';

// Get all chat models
const chatModels = await getChatModelsFromAPI();

// Get only FREE models
const freeModels = await getFreeModels('chat');

// Check if model supports tools
const model = await findModel('ServiceNow-AI/Apriel-1.6-16b-Thinker');
if (model && supportsTools(model)) {
  // Pass tools to this model
}
```

## Next Steps

1. ✅ Create `dynamicModels.ts`
2. ✅ Create test script
3. ✅ Update `ModelSelector` component to use dynamic loading
4. ✅ Update `getDefaultChatModel()` to use dynamic API
5. ✅ Remove hardcoded CHAT_MODEL_METADATA (NUKED!)
6. ✅ Create full model verification service with ping tests
7. ✅ React hook for component integration
8. ✅ Background sync every 4 hours
9. ✅ Response time tracking and speed badges

## Migration Status: ✅ COMPLETE

**All hardcoded models removed. Dynamic verification is now the ONLY way.**

See [MODEL_VERIFICATION_ARCHITECTURE.md](../architecture-review/docs/MODEL_VERIFICATION_ARCHITECTURE.md) for full documentation.

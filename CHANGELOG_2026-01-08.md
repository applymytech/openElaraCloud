# Changelog - January 8, 2026

## Major Changes - Demonstrator Clarity & UX Improvements

### 🎯 Demonstrator Philosophy (NEW)

**Added `DEMONSTRATOR.md`** - Comprehensive documentation explaining:
- This is a DEMONSTRATOR, not a commercial product
- Free to use for business (permission only required if charging users)
- Sovereign AI philosophy (you own everything)
- Cloud vs Desktop feature matrix
- Licensing: Take it, modify it, deploy it, make it yours!

**Updated `README.md`** - Clarified:
- Header now says "Demonstrator" not "Demo"
- Added link to DEMONSTRATOR.md philosophy
- Added Cloud vs Desktop feature comparison table
- Emphasized this is freely shared by an individual developer

### 🧠 Deep Thought - Now Very Obvious!

**Problem**: Users couldn't find the Deep Thought toggle button

**Solution**: Made it IMPOSSIBLE to miss
- Added prominent 🧠 brain button in quick actions
- Pulsing purple glow animation when active
- ⚡ Sparkle indicator on active button
- Stats ribbon shows "Deep Thought: 10 turns" with glowing border
- Multiple animations: `deepThoughtPulse`, `deepThoughtRibbonGlow`, `sparkle`

**Code Changes**:
- `src/pages/chat.tsx`: Added `deepThoughtEnabled` and `deepThoughtTurns` state
- Added Deep Thought button next to 📸 and 🎬 buttons
- Added ribbon indicator showing turn count when active
- Comprehensive CSS animations for visual prominence

### 🔧 Tooling System Improvements

#### Auto-Select Models (Illusion of Autonomy)

**Problem**: Image/video generation required user to select models

**Solution**: LLM tools now auto-select cost-effective models
- `make_image` uses `DEFAULT_IMAGE_MODEL` (FLUX.1-schnell)
- `make_video` uses `getCostEffectiveVideoModels()[0]` - automatically picks cheapest model
- **NO PRO models** - filters ensure only cost-effective options
- Creates "illusion of autonomy" - LLM doesn't waste turns asking user to pick models

**Code Changes**:
- `src/lib/tools.ts`: Updated `executeToolCall()` for make_image and make_video cases
- Imported `getCostEffectiveVideoModels` from models.ts
- Added model auto-selection logic with comments

#### Exa Tools - Emphasize LIVE Data

**Problem**: LLMs might not understand Exa tools retrieve CURRENT data, not training data

**Solution**: Updated tool descriptions to be crystal clear
- `search_web`: "Search the web for CURRENT LIVE information. This retrieves up-to-date data from the internet, NOT from your training data"
- `read_url`: "Read the CURRENT LIVE content of a specific webpage. This fetches the actual page right now, NOT cached or training data"

**Code Changes**:
- `src/lib/tools.ts`: Updated DEEP_THOUGHT_TOOLS descriptions
- Emphasized "LIVE", "CURRENT", "NOT training data" in descriptions

### 📱 Mobile Responsive Fixes

**Problem**: Messages didn't respect parent bubble width on mobile, rendering horribly

**Solution**: Added proper word wrapping
- Added `max-width: 100%` to `.message-content`
- Added `word-wrap: break-word`
- Added `overflow-wrap: break-word`
- Applies to both desktop and mobile views

**Code Changes**:
- `src/pages/chat.tsx`: Updated `.message-content` styles in two places (desktop + mobile media query)

### 🎨 Model Selector Emoji Updates

**Problem**: Used generic 🚀/🌐 emojis for providers

**Solution**: Changed to 🧠 (brain) for chat models
- Together.ai: 🧠 (was 🚀)
- OpenRouter: 🧠 (was 🌐)
- Custom API: ⚙️ (unchanged)

**Why**: User requested brain for chat, eyes 👁️ for vision. Since cloud app has NO vision support, only brain needed.

**Code Changes**:
- `src/components/ModelSelector.tsx`: Updated `getProviderName()` function

### 🚫 Vision Support Removed (Cloud App)

**Decision**: NO vision models or image analysis in cloud version

**Rationale**:
- Desktop app has full vision pipeline
- Cloud version focuses on simple, reliable chat + generation
- Complex file handling better suited for desktop
- Users can add it themselves if needed (open source!)

**Documentation Updates**:
- `README.md`: Added Cloud vs Desktop feature table
- `DEMONSTRATOR.md`: Explains vision is desktop-only
- `src/lib/userManual.ts`: Updated capabilities matrix
  - File attachments: "TEXT ONLY - Adds to context, no vision analysis"
  - Added rows for "Vision Models" and "Image Upload/Analysis" marked as desktop-only
- `src/pages/chat.tsx`: Attach button tooltip now says "Attach Text File (text content only, no image analysis)"

**What Still Works**:
- ✅ File attachments (extracts text content for context)
- ✅ Image GENERATION (FLUX models)
- ✅ Video generation (MiniMax, Veo)
- ❌ Image ANALYSIS (no vision models)
- ❌ Vision-based responses

### 📄 User Manual Updates

**Updated capabilities matrix** in `src/lib/userManual.ts`:
- Added Deep Thought row (✅ YES)
- Added Context Canvas row (✅ YES)
- Clarified File Attachments: "TEXT ONLY"
- Added Vision Models (❌ NO - Desktop only)
- Added Image Upload/Analysis (❌ NO - Desktop only)
- Updated critical agent rules about vision features

**Agent Guidance**:
- If user wants vision/image analysis → direct to desktop app
- If user asks about Code Studio, local AI, execution → desktop-app-only

---

## Technical Improvements

### State Management
- Added `deepThoughtEnabled: boolean` state
- Added `deepThoughtTurns: number` state (default 10)

### CSS Animations
```css
@keyframes deepThoughtPulse { ... }       // Button glow effect
@keyframes deepThoughtRibbonGlow { ... }  // Ribbon indicator
@keyframes sparkle { ... }                 // ⚡ sparkle animation
```

### Tool System Architecture
- Image tools use `DEFAULT_IMAGE_MODEL` constant
- Video tools use `getCostEffectiveVideoModels()` helper
- Auto-selection logged for debugging
- Model ID included in tool output for transparency

---

## Files Changed

### New Files
- ✅ `DEMONSTRATOR.md` - Complete philosophy and licensing guide
- ✅ `CHANGELOG_2026-01-08.md` - This file

### Modified Files
- ✅ `README.md` - Demonstrator clarity, feature matrix
- ✅ `src/pages/chat.tsx` - Deep Thought UI, mobile fixes, attach tooltip
- ✅ `src/components/ModelSelector.tsx` - Brain emoji for chat
- ✅ `src/lib/tools.ts` - Auto-select models, emphasize LIVE data
- ✅ `src/lib/userManual.ts` - Capabilities matrix updates

---

## Testing Recommendations

### Deep Thought Button
1. ✅ Check button is visible in quick actions
2. ✅ Click button - should toggle active state
3. ✅ Check pulsing purple glow appears
4. ✅ Check ⚡ sparkle animation
5. ✅ Check ribbon shows "Deep Thought: 10 turns"

### Mobile Responsiveness
1. ✅ Test on mobile device or Chrome DevTools mobile mode
2. ✅ Send long message with no spaces
3. ✅ Verify message wraps properly within bubble
4. ✅ Check no horizontal overflow

### Tool System
1. ✅ Enable Deep Thought mode
2. ✅ Ask LLM to generate an image
3. ✅ Verify it doesn't ask user to select model
4. ✅ Check tool output includes auto-selected model name

### File Attachments
1. ✅ Hover over 📄 attach button
2. ✅ Verify tooltip says "text content only, no image analysis"
3. ✅ Attach a text file - should work
4. ✅ Content should be added to context

---

## Breaking Changes

**None** - All changes are additive or clarifications. Existing functionality preserved.

---

## Next Steps (Future)

### Deep Thought Implementation
- **Core loop**: `src/lib/deepThought.ts` (not yet implemented)
- **Integration**: Wire up button to actual Deep Thought execution
- **Turn counter**: Show progress during execution
- **Tool results**: Display in collapsible sections

### Vision (If User Wants It)
- Check desktop app for vision pipeline code
- Adapt for cloud storage
- Add vision model selector (👁️ emoji)
- Implement dual-pipeline (direct vs description)

### Documentation
- Consider adding CONTRIBUTING.md
- Add examples of custom modifications
- Create video walkthrough of demonstrator philosophy

---

## Commit Message Suggestion

```
feat: Demonstrator clarity + Deep Thought UI + mobile fixes

Major Changes:
- Added DEMONSTRATOR.md explaining philosophy, licensing, sovereignty
- Deep Thought toggle now VERY obvious (brain button with glow)
- Fixed mobile message bubble width (proper word wrapping)
- Auto-select models in tooling (illusion of autonomy)
- Emphasized LIVE data in Exa tool descriptions
- Changed model selector to brain emoji
- Clarified no vision support in cloud (desktop-only)

Breaking Changes: None
```

# Storyboard Consistency & User Intent Refactor

## Implementation Date
2026-01-29

## Overview
Complete refactor of the assistant prompt system and reference selection logic to:
1. **Fix scene-internal consistency** (first/last frames of the same scene stay in the same setting)
2. **Prevent cross-scene setting bleed** (new scenes don't inherit previous scene backgrounds)
3. **Follow user intent** (support any video type, not just ads)

## Changes Made

### 1. Assistant System Prompt (`lib/prompts/assistant/system.ts`)

#### Added User Intent Tracking
- Added `**Video Type**` field to reflexion block to detect intent (Promotional/Educational/Entertainment/etc.)
- Added principle #7: "Follow User Intent - Don't force promotional/ad structure unless user wants to promote/sell something"
- Updated tool descriptions from "video ad" to "video" (any type)

#### Scenario Planning Prompt
**NEW REQUIRED FIELDS for visual consistency:**
- `scene_setting`: Concrete setting description (e.g., "Small modern bathroom, warm morning light")
- `setting_change`: Boolean - TRUE if new location vs previous scene
- `continuity_group_id`: Numeric ID grouping consecutive scenes in same setting
- `use_prev_scene_transition`: Only true when `setting_change=false`

**Critical Rule Added:**
- When `setting_change=false`, `scene_setting` MUST be identical to previous scene (copy exact text)
- `use_prev_scene_transition` should ONLY be true when `setting_change=false`

#### Scene Refinement Prompt
**NEW: Strict Continuity Contract**
- Added `scene_setting_lock` output field: exact setting anchor for BOTH first and last frame
- **Default rule**: Background, lighting, time-of-day, wardrobe stay IDENTICAL within a scene
- **Camera move exception**: If action implies pan/reveal, explicitly state "same room, different angle"
- Last frame prompts MUST start with "Same setting." or "Same [room/location]." unless camera move

**Emphasis on Reference Images:**
- Reference images carry identity, appearance, and setting
- Prompts should describe the **delta** (what changes), not re-describe what's visible
- Example: "Same setting. Woman now holds bottle up at eye level..." (not re-describing bathroom)

### 2. Reference Selection Logic (`app/api/assistant/chat/route.ts`)

#### `buildDeterministicImageReferences()` - Key Fix
**REMOVED: Cross-scene "recentFrames" block**
- Old code unconditionally added frames from previous 2 scenes
- This caused accidental setting/background inheritance

**NEW Logic:**
- **Last frame**: ONLY includes (1) scene's own first frame, (2) avatar, (3) product
- **First frame with transition**: Includes previous scene last frame ONLY when `usePrevSceneTransition=true`
- **First frame without transition**: Does NOT include recent previous frames when `setting_change=true`

**Result:**
- Last frames stay consistent with their own first frame (same scene setting)
- First frames of new scenes don't inherit previous scene's background
- Smooth transitions only happen when intentional

#### Added `settingChange` Parameter
- Added optional `settingChange?: boolean` to both `getImageReferenceReflexion()` and `buildDeterministicImageReferences()`
- Passed from scenario planning to reference selection
- Used to gate cross-scene references

### 3. Script Generation Prompt (`app/api/assistant/chat/route.ts`)

**Changed from:**
- "You are the brand's lead creative director + senior copywriter for short-form ads"
- "write a script that feels like a real brand campaign concept"

**Changed to:**
- "You are a lead creative director + senior copywriter for short-form videos"
- "Write a script that matches the user's intent - promotional, educational, entertainment, tutorial, story, or announcement"

**NEW CRITICAL Rule:**
- Only use promotional/ad structure (Hook → Problem → Solution → CTA) when user wants to promote/sell
- Otherwise adapt structure to content type:
  - Educational/Tutorial: Intro → Teach/Demonstrate → Summary/Takeaway
  - Entertainment/Story: Setup → Build → Payoff
  - Announcement: Context → News → What It Means

**Output Format:**
- Split into "For PROMOTIONAL videos:" and "For NON-PROMOTIONAL videos:" sections
- Adapt timing to requested length and content type

### 4. TypeScript Types (`types/assistant.ts`)

#### SceneOutline - Added Fields
```typescript
scene_setting?: string;           // Short concrete setting description
setting_change?: boolean;         // TRUE if new location vs previous scene
continuity_group_id?: number;     // ID grouping scenes in same setting
```

#### StoryboardScene - Added Fields
```typescript
scene_setting_lock?: string;      // Setting anchor for both first/last frame
scene_setting?: string;           // From scenario planning (debugging)
setting_change?: boolean;         // From scenario planning (debugging)
continuity_group_id?: number;     // From scenario planning (debugging)
continuity_notes?: string;        // Explains camera moves/reveals
```

## Expected Improvements

### Scene-Internal Consistency
✅ **Before**: First/last frames of the same scene could have different backgrounds, lighting, or wardrobe  
✅ **After**: Setting stays locked within a scene unless action explicitly implies camera move

### Cross-Scene Freedom
✅ **Before**: New scenes accidentally inherited previous scene's setting/background via "recentFrames"  
✅ **After**: Clean setting changes between scenes; no accidental bleed

### User Intent Following
✅ **Before**: Always forced ad structure (Hook → Problem → Solution → CTA)  
✅ **After**: Adapts to user's actual intent (educational, entertainment, tutorial, etc.)

## Testing Recommendations

### Same-Scene Consistency Test
- Create UGC talking head scene
- Verify first/last frames keep identical room and lighting
- Check wardrobe/hair/makeup stay consistent

### Reveal Logic Test
- Create scene with explicit camera pan/move
- Verify prompt states "same room, different angle"
- Check architectural/decor consistency despite angle change

### Hard Setting Change Test
- Create 2-scene storyboard with different locations
- Verify scene 2 first frame doesn't inherit scene 1 background
- Check clean visual break between settings

### Non-Ad Video Test
- Request educational tutorial video
- Verify script uses "Intro → Teach → Summary" structure (not Hook → Problem → CTA)
- Check storyboard doesn't force promotional beats

## Technical Details

### Prompt Token Budgets
- Scenario planning: 1400 tokens (unchanged)
- Scene refinement: 1800 tokens (unchanged)
- Script generation: 2048 tokens (unchanged)

### Reference Image Limits
- Nano Banana accepts up to 14 reference images
- Last frames now use 1-3 refs (first frame + avatar + product)
- First frames use 1-4 refs when transitioning (prev last frame + avatar + product)

### Backward Compatibility
- All new fields are optional
- Old storyboards without `scene_setting` will still work
- Type system supports both old and new structure

## Files Modified

1. `/Users/hadri/AdsCreator/lib/prompts/assistant/system.ts`
   - ASSISTANT_SYSTEM_PROMPT
   - SCENARIO_PLANNING_PROMPT
   - SCENE_REFINEMENT_PROMPT

2. `/Users/hadri/AdsCreator/app/api/assistant/chat/route.ts`
   - buildDeterministicImageReferences()
   - getImageReferenceReflexion()
   - executeScriptCreation() (scriptSystemPrompt)

3. `/Users/hadri/AdsCreator/types/assistant.ts`
   - SceneOutline interface
   - StoryboardScene interface

## Key Principles

1. **Reference images carry setting** - Don't re-describe what's in the reference
2. **Same scene = same setting** - Background/lighting/wardrobe locked by default
3. **Different scenes = clean break** - No accidental inheritance via references
4. **Follow user intent** - Promotional structure only when actually promoting

## Next Steps

1. Test with real storyboard generation
2. Monitor console logs for consistency warnings
3. Collect user feedback on frame consistency
4. Consider adding visual diff tool to preview first/last frame consistency

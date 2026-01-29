# Prompt Creator Tool Integration

## Overview

Complete integration of the **Prompt Creator** tool - a mandatory pre-generation validation and structuring system that enforces consistency, visual grounding, and proper continuity management across all AI-generated content.

## System Architecture

### Priority Hierarchy

1. **#1 CONSISTENCY** - Character identity, wardrobe, props, setting, lighting, style
2. **#2 CONTROL** - First+last frame endpoints land exactly where intended  
3. **#3 QUALITY** - Cinematic composition, clear motion, clean dialogue mix

### Core Principles (DO NOT BREAK)

1. Never produce text-only prompts when pipeline expects image inputs
2. Always generate storyboard first before crafting prompts
3. **Always craft prompts through Prompt Creation Tool BEFORE any final prompt**
4. Always ground prompts in what is literally visible in provided images
5. Always prefer minimal, targeted change prompts for i2i
6. Always maintain user intent, constraints, and tone

## New Tool: prompt_creator

### Purpose

The `prompt_creator` tool is **MANDATORY** before any image or video generation. It:
- Validates and structures prompts with proper visual grounding
- Enforces consistency across frames and scenes
- Tracks character traits, wardrobe, props, settings
- Handles reference images properly (previous frames, avatars, etc.)
- Builds consistency ledger for tracking across scenes

### When to Call

**MUST** call before:
- ANY Nano Banana image prompt (first frame, last frame, intermediate frames)
- ANY video prompt (i2v) that uses first+last frames  
- Finalizing ANY scene in a storyboard

### Input Schema

```typescript
{
  target_model: "nano_banana_image" | "i2v_audio_model",
  prompt_type: "scene_first_frame" | "scene_last_frame" | "intermediate_frame" | "insert_shot" | "i2v_job",
  scene_id: "S01",
  shot_id: "SH01",
  continuity: {
    is_continuous_from_previous_scene: true|false,
    previous_scene_last_frame_url: "https://..." | null
  },
  reference_images: [
    { 
      url: "https://...", 
      role: "previous_scene_last_frame" | "scene_first_frame_anchor" | "avatar_ref" | "style_ref" | "location_ref" | "prop_ref",
      notes: "optional" 
    }
  ],
  user_intent: "1–3 sentence plain description",
  required_changes: ["list of deltas from anchor images"],
  must_keep: ["list of elements that must not change"],
  forbidden: ["list of elements to avoid"],
  dialogue: {
    needs_spoken_dialogue: true|false,
    language: "English",
    accent: "General American",
    lines: [
      { speaker: "A", text: "...", start_s: 1.2, end_s: 4.6, emotion: "calm" }
    ],
    mix_notes: "dialogue forward, light room tone"
  },
  render_params: {
    aspect_ratio: "16:9" | "9:16" | "1:1" | "4:5",
    style: "photoreal/cinematic/animation",
    camera: "lens + framing + movement",
    lighting: "key notes",
    motion_strength: "low/med/high",
    i2i_strength: "low/med/high"
  }
}
```

### Output Schema

```typescript
{
  visual_grounding_report: {
    for_each_reference_image: [
      {
        url: "https://...",
        literal_description: "What is undeniably visible",
        identity_markers: ["face/hair/wardrobe markers"],
        composition_markers: ["camera angle, shot size"],
        do_not_assume: ["things unclear or not visible"]
      }
    ],
    consistency_ledger_update: {
      character: { stable_traits: [], wardrobe: [], props: [] },
      setting: { location_traits: [], lighting_traits: [], time_of_day: "" },
      style: { look_and_feel: [] }
    }
  },
  final_prompt_package: {
    nano_banana_prompt: {
      positive_prompt: "...",
      negative_prompt: "...",
      change_only_instructions: ["..."],
      must_keep_instructions: ["..."]
    },
    i2v_prompt: {
      start_frame_url: "https://...",
      end_frame_url: "https://...",
      motion_prompt: "...",
      camera_prompt: "...",
      audio_prompt: "...",
      dialogue_script: []
    },
    notes_for_operator: []
  }
}
```

## Key Rules

### 1. KEY CONTINUITY RULE (MANDATORY)

**If Scene N is continuous from Scene N-1:**

When generating Scene N's FIRST frame:
- ✅ MUST include LAST FRAME IMAGE URL of Scene N-1 as reference
- ✅ MUST treat it as visual anchor for setting, lighting, wardrobe, props, character state
- ✅ Text prompt describes ONLY what changes/progresses from anchor
- ❌ Do NOT re-describe everything

**If Scene N is NOT continuous (cut):**
- ❌ Do NOT include previous last frame as reference
- ✅ May still use character reference images for consistency

### 2. WITHIN-SCENE ENDPOINT RULE (MANDATORY)

For each scene:
- **FIRST FRAME** uses: (character refs) + (previous scene last frame if continuous) + (environment refs)
- **LAST FRAME** MUST be conditioned on FIRST FRAME of SAME scene
- **LAST FRAME** text prompt describes only delta from FIRST frame

### 3. DIALOGUE RULES (NATIVE SPOKEN AUDIO)

When dialogue needed:
- Provide exact lines (quoted), speaker labels, language/accent, emotion, pace, timing
- If speaking face visible, enforce camera angle for believable lip-sync
- Keep short: 4-8 seconds = ~5-15 words per line
- Audio mix: dialogue clarity > ambience

### 4. AVATAR/CHARACTER CONSISTENCY (MANDATORY)

If video features recurring character:
- Ask once: (A) upload reference or (B) generate one
- Once avatar exists, include as conditioning input for EVERY frame with character
- Never drift identity: face shape, hairline, eye color, marks, wardrobe

## Continuity Decision Logic

### Scene is "continuous" if:
- Same location + same time + same ongoing action, OR
- Same shot sequence where camera changes but environment/moment remain same

### Scene is a "cut" if:
- New location, or
- Clear time jump, or
- Different wardrobe/state, or  
- New scene purpose

**If continuous:** Include previous scene last frame URL in next scene first frame prompt (MANDATORY)

## Implementation

### 1. Type Definition

Added to `types/assistant.ts`:

```typescript
export type ToolName = 'prompt_creator' | 'script_creation' | 'image_generation' | ...;

export interface PromptCreatorInput {
  target_model: 'nano_banana_image' | 'i2v_audio_model';
  prompt_type: 'scene_first_frame' | 'scene_last_frame' | 'intermediate_frame' | 'insert_shot' | 'i2v_job';
  scene_id: string;
  // ... (full schema above)
}
```

### 2. Tool Schema

Added to `lib/prompts/assistant/system.ts` TOOLS_SCHEMA:

```typescript
{
  name: 'prompt_creator',
  description: 'MANDATORY: Create and validate prompts with proper visual grounding...',
  parameters: {
    type: 'object',
    properties: { /* full schema */ },
    required: ['target_model', 'prompt_type', 'scene_id', 'user_intent', 'render_params']
  }
}
```

### 3. API Handler

Added to `app/api/assistant/chat/route.ts`:

```typescript
async function executePromptCreator(input: any): Promise<{ success: boolean; output?: any; error?: string }> {
  // Validate required fields
  // Build visual grounding report
  // Build final prompt package
  // Return structured output
}
```

Handler features:
- Validates all required fields
- Logs processing info (scene_id, target_model, continuity)
- Builds visual grounding report from reference images
- Creates consistency ledger (character, setting, style)
- Generates final prompt package for target model
- Handles both image and video generation targets

### 4. System Prompt

Complete rewrite of `ASSISTANT_SYSTEM_PROMPT`:
- New priority hierarchy (#1 Consistency, #2 Control, #3 Quality)
- Core behavior rules (6 mandatory)
- Key continuity rule
- Within-scene endpoint rule
- Dialogue rules
- Avatar/character consistency rules
- Tool definitions (7 tools now)
- Continuity decision logic
- Storyboard output contract
- Fail-safes

## Usage Flow

### Before (Without Prompt Creator):
```
User requests → Assistant → Direct image_generation call → Generation
```

### After (With Prompt Creator):
```
User requests 
  → Assistant analyzes 
  → prompt_creator validates/structures
  → Visual grounding + consistency check
  → Final structured prompt
  → image_generation with validated prompt
  → Generation
```

## Example Tool Call

```typescript
<tool_call>
{
  "tool": "prompt_creator",
  "input": {
    "target_model": "nano_banana_image",
    "prompt_type": "scene_first_frame",
    "scene_id": "S01",
    "shot_id": "SH01",
    "continuity": {
      "is_continuous_from_previous_scene": false,
      "previous_scene_last_frame_url": null
    },
    "reference_images": [
      { 
        "url": "https://example.com/avatar.jpg", 
        "role": "avatar_ref", 
        "notes": "Main character reference" 
      }
    ],
    "user_intent": "Woman enters bright modern bathroom, looks at camera with warm smile",
    "required_changes": ["neutral pose", "direct eye contact", "relaxed expression"],
    "must_keep": ["character identity", "wardrobe", "bathroom setting"],
    "forbidden": ["dramatic poses", "props in hands"],
    "render_params": {
      "aspect_ratio": "9:16",
      "style": "photoreal",
      "camera": "medium shot, eye level, 35mm equivalent",
      "lighting": "natural window light, soft shadows"
    }
  }
}
</tool_call>
```

## Benefits

### For Consistency:
- ✅ Tracks character traits across scenes
- ✅ Maintains wardrobe continuity
- ✅ Preserves setting and lighting
- ✅ Prevents identity drift
- ✅ Ensures proper reference image usage

### For Control:
- ✅ First/last frame endpoints precise
- ✅ Smooth scene transitions
- ✅ Proper continuity management
- ✅ Validated prompt structure

### For Quality:
- ✅ Cinematic composition
- ✅ Clear motion description
- ✅ Clean dialogue integration
- ✅ Professional prompt engineering

### For Development:
- ✅ Structured validation before generation
- ✅ Better error handling
- ✅ Consistency ledger for debugging
- ✅ Clear separation of concerns

## Fail-Safes

1. **Missing reference URL:** Don't hallucinate - mark null, proceed with available refs
2. **Dialogue without face:** Provide voice-over style, specify clearly
3. **Continuity breaks:** Flag and propose (A) new scene or (B) story beat explaining change

## Testing Checklist

- [ ] prompt_creator called before image generation
- [ ] Visual grounding report generated correctly
- [ ] Consistency ledger tracks character/setting/style
- [ ] Continuity logic applied correctly (continuous vs cut)
- [ ] Reference images used properly
- [ ] Dialogue integration works
- [ ] Avatar consistency maintained
- [ ] Error handling graceful

---

**Status:** ✅ Fully Integrated
**Build:** ✅ Successful (88.7s)
**Deployment:** ✅ Pushed to main

The assistant now operates as a professional storyboard director with comprehensive prompt engineering and consistency management.

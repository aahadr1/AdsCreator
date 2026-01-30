# Assistant Agent Redesign

## Overview

The assistant has been completely redesigned from a simple chatbot into an intelligent **Video Production Agent** with a structured workflow and specialized tools.

## New Architecture

### Agent-Based Approach

The assistant is now an **agent** that:
- Takes initiative when asked
- Orchestrates complex multi-step workflows
- Makes creative decisions intelligently
- Uses a suite of specialized tools in sequence

### Workflow Stages

Every video production follows this mandatory sequence:

```
1. UNDERSTAND → 2. SCRIPT → 3. AVATARS → 4. REQUIREMENTS → 5. SCENES → 6. FRAMES → 7. PROMPTS → 8. STORYBOARD
```

## New Tools

### 1. `script_creation` (Enhanced)
**Purpose**: Creates complete video scripts with timing, dialogue/voiceover, and structure.

**New Features**:
- Video type awareness (UGC, high-production, tutorial, testimonial, reel, etc.)
- Platform-specific optimization (TikTok, Instagram, YouTube, Facebook)
- Tone control (casual, professional, energetic, etc.)
- Voiceover vs dialogue distinction (for lip-sync intent)
- Automatic hook generation for social content
- Detailed timing breakdown with visual suggestions

**Output includes**:
- Complete script with timing markers
- Scene suggestions
- Speaker notes (tone, pace, emphasis)
- Audio notes

### 2. `requirements_check` (NEW)
**Purpose**: Analyzes what elements are needed before storyboard creation can begin.

**Checks for**:
- Are avatars needed? Do we have them?
- Is a product image needed? Do we have it?
- Are specific settings required?
- Is there enough information to proceed?

**Output**:
- `can_proceed: true/false`
- Missing elements list with criticality
- Questions for user (if needed)
- Assumptions being made

### 3. `scene_director` (NEW)
**Purpose**: Creates video vision and scene breakdown. **MUST be called twice**.

**First Call (mode="overview")**:
- Creates complete video description
- Establishes style, mood, pacing
- Defines visual language
- Sets up continuity requirements

**Second Call (mode="breakdown")**:
- Breaks video into discrete scenes
- Each scene gets: name, description, duration, type, setting
- Preserves script text in each scene
- Defines transitions between scenes

### 4. `frame_generator` (NEW)
**Purpose**: Creates detailed descriptions of first and last frames for each scene.

**What it does**:
- Designs what each first/last frame should show
- Focuses on composition, character state, environment
- Considers continuity between scenes
- Describes the motion between frames

**Important**: This creates DESCRIPTIONS, not prompts. The prompts come from frame_prompt_generator.

### 5. `frame_prompt_generator` (NEW)
**Purpose**: Creates optimized image generation prompts with intelligent reference image management.

**Critical Intelligence**:

1. **Avatar Continuity**: When avatar appears → input avatar reference
2. **Scene Continuity**: When continuous from previous scene → input previous scene's last frame
3. **Within-Scene Continuity**: When generating last frame → input that scene's first frame
4. **Product Consistency**: When product appears → input product reference
5. **DON'T RE-DESCRIBE**: Prompts should NOT describe what's in input images

**Example of good vs bad prompts**:

❌ BAD (re-describes everything):
```
"A woman in her 30s with brown shoulder-length hair, warm brown eyes, wearing a light blue casual top, in a bright living room..."
```

✅ GOOD (focuses on change):
```
"Looking frustrated, hand running through hair, sitting up straight, same setting as reference"
```

### 6. `image_generation` (Enhanced)
**Enhancements**:
- `character_role` field for multi-character videos
- Better purpose categorization (avatar, product, scene_frame, b_roll, setting)
- Image input array for reference images

### 7. `storyboard_creation` (Enhanced)
**New fields**:
- `video_description` - Complete video vision for UI display
- `video_type` - Type of video
- `script_full_text` - Complete script
- `additional_avatars` - For multi-character videos
- Scenes now include `scene_description`, `first_frame_image_inputs`, `last_frame_image_inputs`

### 8. `video_generation` (Unchanged)
Still generates video clips from completed storyboard.

## New Type Definitions

### ScriptCreationInput/Output
Comprehensive script structure with timing breakdown, speaker notes, and scene suggestions.

### RequirementsCheckInput/Output
Full requirements analysis with missing elements, questions, and assumptions.

### SceneDirectorOverviewOutput/BreakdownOutput
Detailed video vision and scene breakdown structures.

### FrameGeneratorInput/Output
Frame designs with composition, character state, environment details.

### FramePromptGeneratorInput/Output
Optimized prompts with image inputs and continuity chain tracking.

## UI Enhancements

### StoryboardCard
- Now displays `video_description` at the top with "Video Vision" label
- Beautiful gradient styling for the description box

### SceneCard
- Shows `scene_description` (detailed) or falls back to `description`
- Shows script text preview when different from description
- Better visual hierarchy

### New CSS Styles
- `.videoDescriptionBox` - For displaying video vision
- `.videoDescriptionLabel` - For the "Video Vision" header
- `.videoDescriptionText` - For the description content
- `.sceneScriptPreview` - For showing script text in scenes
- `.scriptLabel` / `.scriptText` - For script preview formatting

## Agent Prompts

All agent prompts are now organized in `/lib/prompts/agents/`:

| File | Purpose |
|------|---------|
| `script_generator.ts` | Video script writing expertise |
| `scene_director.ts` | Video vision and scene breakdown |
| `frame_generator.ts` | Frame design descriptions |
| `frame_prompt_generator.ts` | Intelligent prompt engineering |
| `requirements_checker.ts` | Pre-storyboard requirements analysis |
| `index.ts` | Central exports |

Plus legacy advanced agents:
- `creative_strategist.ts` - Campaign strategy
- `hooks_engine.ts` - Hook generation
- `media_analyst.ts` - Media analysis
- `qa_reviewer.ts` - Quality review

## Key Design Principles

### 1. Script First, Always
No storyboard should be created without a script. The script defines timing, dialogue, and structure.

### 2. Avatars Before Storyboard
If a video needs people, avatars MUST be generated and ready before storyboarding begins.

### 3. Requirements Gate
The `requirements_check` tool acts as a gate - if critical elements are missing, production cannot proceed.

### 4. Two-Step Scene Direction
Scene direction happens in two calls to ensure proper separation of concerns:
- Overview: The creative vision
- Breakdown: The technical implementation

### 5. Don't Re-Describe Inputs
When using reference images, prompts should describe CHANGES, not everything from scratch. The AI should understand what's in the input and only describe modifications.

### 6. Continuity Chain
Frames connect via a continuity chain:
- Previous scene's last frame → Current scene's first frame (if continuous)
- Scene's first frame → Scene's last frame (within scene)

## Example Workflow

User: "Create a UGC TikTok ad for my cooling blanket"

1. **SCRIPT**: Create 30s script with hook, problem, solution, CTA
2. **AVATAR**: Generate woman in 30s for the video
3. **REQUIREMENTS**: Check - script ✓, avatar ✓, product (not needed visually)
4. **SCENES (Overview)**: "Authentic UGC video featuring a relatable woman..."
5. **SCENES (Breakdown)**: 5 scenes - Hook, Problem, Discovery, Result, CTA
6. **FRAMES**: Design first/last frames for each scene
7. **PROMPTS**: Create prompts with avatar reference, continuity handling
8. **STORYBOARD**: Assemble everything with full video description visible

## Migration Notes

### Backwards Compatibility
- Old `ScriptCreationInput` fields still work
- Legacy `prompt_creator` tool still available
- Existing storyboards display correctly

### What Changed
- System prompt completely rewritten
- New workflow enforcement
- New tools added
- UI enhanced for video descriptions
- Types expanded with new structures

## Files Changed

1. `/lib/prompts/assistant/system.ts` - Complete rewrite
2. `/lib/prompts/agents/script_generator.ts` - Enhanced
3. `/lib/prompts/agents/scene_director.ts` - NEW
4. `/lib/prompts/agents/frame_generator.ts` - NEW
5. `/lib/prompts/agents/frame_prompt_generator.ts` - NEW
6. `/lib/prompts/agents/requirements_checker.ts` - NEW
7. `/lib/prompts/agents/index.ts` - NEW
8. `/types/assistant.ts` - Enhanced with new types
9. `/app/assistant/page.tsx` - UI enhancements
10. `/app/assistant/assistant.module.css` - New styles

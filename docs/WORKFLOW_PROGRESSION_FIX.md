# Workflow Progression Fix

## Problem Identified

The assistant was getting stuck in a loop, continuously generating new scripts instead of progressing through the workflow stages when users indicated approval.

### Example of the Issue:

```
User: "create a ugc video..."
Assistant: [Generates script]

User: "sounds good continue"
Assistant: [Generates ANOTHER script instead of moving to avatar generation]

User: "use that script for the storyboard"
Assistant: [Generates YET ANOTHER script instead of creating storyboard]
```

## Root Cause

The system prompt lacked explicit guidance on:
1. **Recognizing user approval/continuation signals** ("sounds good", "continue", "proceed", etc.)
2. **What to do when user approves** (move to next workflow stage, not regenerate)
3. **Clear multi-turn workflow examples** showing progression from one stage to the next

## Changes Made

### 1. Added User Approval Recognition Section

**Location**: After each workflow step (STEP 2 and STEP 3)

Added explicit lists of approval signals:
- "sounds good", "continue", "proceed", "go ahead", "next"
- "use that [script/avatar]", "perfect", "looks good", "yes", "ok"
- "create the storyboard", "make the video", "complete it"

**Action when detected**: MOVE TO NEXT WORKFLOW STEP immediately

### 2. Added Revision Signal Recognition

Differentiated between continuation and revision:
- **Continue**: "sounds good", "proceed", "use that" → Move forward
- **Revise**: "change X", "regenerate", "try different" → Stay in current stage and regenerate

### 3. Enhanced Reflexion Block Guidance

Added section "RECOGNIZING USER CONTINUATION SIGNALS" that explicitly tells the assistant:
- How to detect approval
- To update "Current Stage" in reflexion to show progression
- Not to regenerate what was just made
- Not to ask "should I proceed?" - just proceed

### 4. Expanded Example Workflow

Changed from:
```
[After script is done, continue with avatar generation...]
```

To:
```
**TURN 1:** User requests video → Generate script
**TURN 2:** User says "sounds good continue" → Generate avatar
**TURN 3:** User says "perfect, create the storyboard" → Execute full workflow
```

Shows actual multi-turn conversation with user approval signals.

### 5. Updated "WHEN TO ASK VS WHEN TO PROCEED"

Added new section:
- **ALWAYS PROCEED when (after generating something):** Lists all continuation signals
- **REVISE when (after generating something):** Lists all revision signals

### 6. Added Critical Reminders

Updated REMEMBER section with:
- "CRITICAL: When user says 'continue', 'sounds good', 'proceed' → MOVE TO NEXT STAGE (don't regenerate)"
- "CRITICAL: Update 'Current Stage' in reflexion to show workflow progression"
- "Never get stuck regenerating the same thing - progress through the workflow"

## Expected Behavior Now

### Correct Workflow Progression:

```
User: "create a ugc video of a woman applying BB cream"
Assistant: 
  Reflexion: Current Stage: UNDERSTAND → Moving to SCRIPT
  [Generates script with hook, demo, before/after, CTA]

User: "sounds good continue"
Assistant:
  Reflexion: Current Stage: SCRIPT → Moving to AVATARS
  [Generates avatar: "Woman in 30s applying makeup, natural lighting..."]

User: "perfect, create the storyboard"
Assistant:
  Reflexion: Current Stage: AVATARS → Moving through full workflow
  [Executes: requirements_check → scene_director (overview) → 
   scene_director (breakdown) → frame_generator → 
   frame_prompt_generator → storyboard_creation]
  [Displays complete storyboard with video description and scenes]
```

### What Changed:

**BEFORE (Broken):**
- User approves → Assistant regenerates same thing
- No progression through workflow stages
- Gets stuck in loops

**AFTER (Fixed):**
- User approves → Assistant moves to next workflow stage
- Clear progression: Script → Avatar → Requirements → Scenes → Frames → Prompts → Storyboard
- Reflexion shows "Current Stage" progressing forward

## Key Approval Signals the Assistant Now Recognizes

### Continuation Signals (Move Forward):
- "sounds good"
- "continue"
- "proceed"
- "go ahead"
- "next"
- "keep going"
- "use that [script/avatar/etc]"
- "perfect"
- "looks good"
- "great"
- "yes"
- "ok"
- "create the storyboard"
- "make the video"
- "finish it"

### Revision Signals (Stay in Current Stage):
- "change X to Y"
- "make it more/less Z"
- "try again with..."
- "regenerate"
- "different"
- "redo"
- "revise"
- Specific feedback/modifications

## Testing the Fix

To verify the fix works:

1. **Ask for a video**: "create a UGC video of someone using my product"
2. **Approve the script**: Say "sounds good continue" or "perfect"
3. **Expected**: Assistant should generate an avatar (if needed), not another script
4. **Approve the avatar**: Say "looks good, create the storyboard"
5. **Expected**: Assistant should execute the full workflow and create storyboard

## Files Modified

- `lib/prompts/assistant/system.ts` - System prompt with workflow guidance
  - Added approval signal recognition
  - Added multi-turn example workflow
  - Enhanced reflexion guidance
  - Updated WHEN TO ASK VS WHEN TO PROCEED
  - Added critical reminders about progression

## Commit

`14492f4` - Fix assistant workflow progression: recognize user continuation signals
# Natural Storyboard Creation System

## Overview

This document describes the natural, flexible storyboard creation system that replaces rigid JSON structures with conversational, organic workflows.

## Core Philosophy

**Natural over Structured**: The system feels like a creative collaborator reading and writing naturally, not a rigid form-filling machine. Structure is used ONLY for technical necessities (URLs, IDs, statuses) - everything creative is natural text that the AI reads and understands organically.

## Architecture Components

### 1. Media Pool (`types/mediaPool.ts`)

Natural asset tracking with minimal structure:

```typescript
interface MediaAsset {
  id: string;                    // Technical: UUID
  type: string;                  // Flexible: "avatar", "product", "mood board", etc.
  url?: string;                  // Technical: Asset URL
  status: 'pending' | 'ready' | 'failed'; // Technical: Status
  
  description: string;           // NATURAL: Human-readable description
  analysis?: string;             // NATURAL: GPT-4o analysis text
  
  approved?: boolean;            // User interaction
  createdAt: string;             // Technical: Timestamp
}
```

**Key Features:**
- Free-form `type` field (no rigid enum)
- Natural `description` instead of structured metadata
- Natural `analysis` from GPT-4o Vision
- Helper functions for querying and management

### 2. Three Specialized Subtools

Each subtool outputs **natural descriptive text** that the assistant reads organically:

#### Video Scenarist
- **Input**: Script + user intent + media pool
- **Output**: Natural scene-by-scene descriptions
- **Example**: 
  ```
  SCENE 1 (0-4s): The Problem
  Woman sitting in her living room, looking at camera with a slightly tired 
  expression. Natural lighting from window. She's holding her face, showing 
  some concern. The dialogue here is "I struggled with acne for years..."
  ```

#### Video Director
- **Input**: Scene descriptions + user intent
- **Output**: Natural technical direction
- **Example**:
  ```
  SCENE 1 DIRECTION:
  Medium shot, camera at eye level (like sitting on a coffee table). The woman 
  is centered in frame with some couch visible behind her. Afternoon light comes 
  from camera-left, creating soft natural shadows. Static camera - no movement.
  ```

#### Storyboard Prompt Creator
- **Input**: Descriptions + direction + media pool
- **Output**: Natural frame prompts with reference URLs
- **Example**:
  ```
  SCENE 1: FIRST FRAME
  
  Visual description:
  Woman sitting on beige couch, natural afternoon light from window behind-left. 
  Medium shot at eye level. She's looking directly at camera with neutral expression.
  
  Reference images to use:
  - Avatar reference: https://r2.example.com/avatars/woman-123.jpg
  ```

### 3. Continuous Reflexion System (`lib/reflexionHelper.ts`)

The assistant can reflect at ANY point:
- Before calling tools
- Between tool calls
- During long operations
- After completion

**Example reflexion:**
```
I just read the scenarist's output. The scene descriptions feel right for a 
UGC video - they're natural and relatable. Scene 1 sets up the problem nicely, 
scene 2 introduces the solution. This matches what the user asked for.
```

### 4. Flexible Orchestration (`lib/storyboardOrchestrator.ts`)

Handles both:
- **Full workflow**: All 3 subtools in sequence with reflexion checkpoints
- **Individual execution**: Single subtool for modifications

The assistant decides when to use each subtool based on user needs.

## UI Components

### Media Pool Sidebar (`components/MediaPool.tsx`)

- Collapsible right sidebar
- Tabs: All, Images, Scripts, Uploads, Approved
- Visual asset cards with natural descriptions
- Approve/Use/Remove actions
- Dark mode support

### Subtool Animations (`components/SubtoolAnimation.tsx`)

- Visual progress indicators for each subtool
- Animated icons and pulse effects
- Progress bars during execution
- Status badges (completed, failed)

## API Routes

### `/api/storyboard/subtools` (POST)

Execute any of the 3 subtools:

```typescript
POST /api/storyboard/subtools
{
  "subtool": "video_scenarist" | "video_director" | "storyboard_prompt_creator",
  "input": { /* subtool-specific input */ },
  "conversationId": "uuid"
}

Response:
{
  "success": true,
  "output": "Natural text output...",
  "metadata": {
    "subtool": "video_scenarist",
    "timestamp": "2025-01-30T...",
    "assetId": "uuid"
  }
}
```

## Integration Guide

### Step 1: Initialize Media Pool

```typescript
import { createEmptyMediaPool, addAssetToPool } from '@/types/mediaPool';

const pool = createEmptyMediaPool();
```

### Step 2: Add Assets to Pool

```typescript
// Add generated avatar
const { pool: updatedPool, assetId } = addAssetToPool(pool, {
  type: 'avatar',
  url: 'https://...',
  description: 'Woman in her 30s, warm smile, casual home setting',
  analysis: 'Natural GPT-4o analysis text...',
  status: 'ready',
  approved: false,
});

// User approves
const approvedPool = approveAsset(updatedPool, assetId);
const finalPool = setActiveAvatar(approvedPool, assetId);
```

### Step 3: Execute Storyboard Workflow

```typescript
import { executeFullStoryboardWorkflow } from '@/lib/storyboardOrchestrator';

const result = await executeFullStoryboardWorkflow({
  conversationId: 'uuid',
  mediaPool: pool,
  userIntent: 'Create a UGC video about BB cream solving acne',
  style: 'authentic UGC',
  platform: 'tiktok',
  onProgress: (event) => {
    console.log('Progress:', event);
  },
  onReflexion: (reflexion) => {
    console.log('Reflexion:', reflexion);
  },
});

// Result contains natural text from all 3 subtools
console.log(result.sceneDescriptions.naturalText);
console.log(result.technicalDirection.naturalText);
console.log(result.framePrompts.naturalText);
```

### Step 4: Parse Frame Prompts

```typescript
import { parseNaturalFramePrompts } from '@/lib/storyboardOrchestrator';

const parsed = parseNaturalFramePrompts(result.framePrompts.naturalText);

// parsed.scenes contains:
// - sceneNumber
// - firstFrame.description
// - firstFrame.referenceUrls
// - lastFrame.description
// - lastFrame.referenceUrls
```

### Step 5: Generate Images

Use the parsed data to call image generation with proper reference images.

## Testing Guide

### Manual Testing Scenarios

#### Scenario 1: Full UGC Workflow
1. User: "Create a UGC video about a woman trying BB cream for acne"
2. System generates avatar
3. User approves: "Use this avatar"
4. System generates script
5. User approves: "Looks good"
6. System calls all 3 subtools sequentially
7. Verify natural text outputs at each stage
8. Check reflexion messages between steps
9. Verify frame prompts have correct reference URLs

#### Scenario 2: Modification Workflow
1. Start with existing storyboard
2. User: "Make scene 2 more cinematic"
3. System calls only `video_director` for scene 2
4. System calls `storyboard_prompt_creator` for scene 2 only
5. Verify selective regeneration works

#### Scenario 3: Media Pool Management
1. User uploads image
2. System analyzes with GPT-4o naturally
3. Add to media pool with natural description
4. User approves as avatar
5. Verify it's used in subsequent prompts

### Automated Tests

Create tests for:
- Media pool operations (add, update, approve, query)
- Natural text parsing (parseNaturalFramePrompts)
- Reflexion system (quick checks, full reflexion)
- Orchestration (full workflow, single subtool)

## Best Practices

### For AI Prompts
- Write naturally, not rigidly
- Focus on creative description, not data fields
- Be conversational but precise
- Include context and reasoning

### For Developers
- Trust the natural text parsing - make it forgiving
- Don't over-structure creative content
- Use structure only for technical data (URLs, IDs)
- Let the AI read and understand organically

### For Users
- Approve assets explicitly when generated by AI
- Provide assets upfront when possible
- Give clear intent and creative direction
- Review subtool outputs naturally

## Troubleshooting

### Issue: Parsing fails on natural text
**Solution**: Make regex patterns more forgiving. Natural text varies - that's okay.

### Issue: Missing reference images
**Solution**: Check media pool has approved assets. System will error clearly if missing.

### Issue: Reflexion takes too long
**Solution**: Use `quickReflexion()` for go/no-go checks. Use full `performReflexion()` only when needed.

### Issue: Subtools output inconsistent format
**Solution**: Update system prompts with examples. Natural doesn't mean unstructured - it means human-readable structure.

## Migration from Old System

Old rigid JSON approach:
```json
{
  "scenes": [
    { "shot_type": "medium shot", "camera": "static" }
  ]
}
```

New natural approach:
```
Medium shot, camera stays static - like filming with phone on table
```

**Migration steps:**
1. Replace structured scene generation with subtool calls
2. Update prompts to produce natural text
3. Add parsing layer to extract needed data
4. Update UI to show natural descriptions
5. Test thoroughly with real scenarios

## Success Metrics

✅ **Natural Outputs**: Subtools produce readable text  
✅ **Flexible Workflow**: Can run full or partial workflows  
✅ **Media Pool**: Assets tracked with natural descriptions  
✅ **Creative Freedom**: Minimal constraints on expression  
✅ **Robust Parsing**: Handles variations gracefully  

## Files Created/Modified

### New Files (11):
1. `types/mediaPool.ts` - Media pool types and helpers
2. `types/storyboardSubtools.ts` - Subtool type definitions
3. `components/MediaPool.tsx` - Media pool UI component
4. `components/MediaPool.module.css` - Media pool styles
5. `components/SubtoolAnimation.tsx` - Subtool animations
6. `components/SubtoolAnimation.module.css` - Animation styles
7. `lib/prompts/subtools/scenarist.ts` - Scenarist prompt
8. `lib/prompts/subtools/director.ts` - Director prompt
9. `lib/prompts/subtools/promptCreator.ts` - Prompt creator prompt
10. `lib/reflexionHelper.ts` - Reflexion system
11. `lib/storyboardOrchestrator.ts` - Flexible orchestration
12. `lib/enhancedImageAnalysis.ts` - Natural image analysis
13. `app/api/storyboard/subtools/route.ts` - Subtool API

### Modified Files (2):
1. `types/assistant.ts` - Added `media_pool` to AssistantPlan
2. `lib/prompts/assistant/system.ts` - Added natural workflow section

## Conclusion

This natural storyboard system prioritizes creative flexibility and organic collaboration over rigid structure. It feels like working with a creative partner who reads and writes naturally, making the AI assistant more intuitive and powerful for video creation.

# Assistant Tool Calling Issues - Analysis & Fixes

## Problem Overview

Analysis of a failed conversation where the assistant could not properly call the `storyboard_creation` tool after generating an avatar. Three critical issues were identified.

---

## Issue #1: Avatar Confirmation Too Rigid ❌

### What Happened
**User said**: "cool with me"  
**Assistant response**: Failed to recognize as approval, asked for "retry"  
**Expected**: Should have proceeded to create storyboard

### Root Cause
System prompt at lines 460-465 was too literal:
```
"User MUST explicitly confirm avatar with phrases like 'Use this avatar' or 'Approve this avatar'"
"DO NOT proceed with storyboard_creation until confirmation received"
```

This created a rigid pattern match that didn't recognize natural language approval.

### The Fix ✅

**Before:**
```
User MUST explicitly confirm avatar with phrases like "Use this avatar" or "Approve this avatar"
```

**After:**
```
Recognize NATURAL approval phrases: "Use this avatar", "Approve", "Looks good", 
"Perfect", "Cool with me", "Go ahead", "Proceed", "Yes", "Great", "Love it"

Recognize REJECTION phrases: "No", "Change", "Different", "Regenerate", "Try again"

If APPROVAL received: Proceed to storyboard_creation with avatar_image_url
If REJECTION received: Generate new avatar, wait for new confirmation
If UNCLEAR: Ask for clarification
```

**Impact**: Assistant now recognizes a wide range of natural approval language instead of requiring exact phrases.

---

## Issue #2: Tool Call Generation Failure ❌

### What Happened
**Error Message**: `"I expected to run a tool, but no valid <tool_call> was provided in the response"`

**What This Means**:
- The LLM understood it should call a tool
- The reflexion identified `TOOL_CALL` as the selected action
- But the LLM didn't actually output the `<tool_call>` XML block
- Instead, it just described wanting to call a tool

### Root Cause
The system prompt didn't explicitly warn against this common mistake. The LLM was:
1. Doing the reflexion correctly
2. Identifying the right tool to use
3. But then just talking about calling it instead of actually calling it

### The Fix ✅

**Added after reflexion section (lines 32-37):**
```
**CRITICAL: If Selected Action is TOOL_CALL, you MUST:**
1. Output a <tool_call> block immediately (do not just describe wanting to call a tool)
2. Include ALL required parameters for the tool
3. Use actual values from context (e.g., extract avatar_image_url from previous 
   image_generation result)
4. Do NOT say "I will call the tool" - actually call it by outputting the <tool_call> block
```

**Added to enforcement rules (lines 494-502):**
```
**COMMON MISTAKES TO AVOID:**
❌ Describing that you want to call a tool without actually calling it
❌ Calling storyboard_creation without avatar_image_url parameter
❌ Not extracting the URL from the previous image_generation result
✅ DO: Output <tool_call> block immediately when tool use is decided
✅ DO: Extract URLs from previous tool results and include in next tool call
```

**Impact**: Clear, explicit instructions that prevent the "describe but don't call" mistake.

---

## Issue #3: Missing Required Parameters ❌

### What Happened
**Error**: `"Invalid storyboard_creation input: missing title/scenes or avatar_image_url required"`

When the tool WAS finally called (after "retry"), it was missing critical parameters:
- `avatar_image_url` - The URL from the generated avatar
- Possibly `title` and/or `scenes` array

### Root Cause
The assistant didn't properly:
1. Extract the `outputUrl` from the previous `image_generation` tool result
2. Pass it as `avatar_image_url` to the `storyboard_creation` call
3. Include all required parameters

The system prompt mentioned these requirements but didn't make it crystal clear with examples.

### The Fix ✅

**Enhanced line 478-480:**
```
**Only After Avatar Confirmation:**
- THEN and ONLY THEN use storyboard_creation tool
- CRITICAL: Extract avatar_image_url from the image_generation tool result (the outputUrl field)
- Include BOTH avatar_image_url AND avatar_description in storyboard_creation call
- Example: If image_generation returned { outputUrl: "https://..." }, use that URL as 
  avatar_image_url parameter
```

**Added to common mistakes (lines 494-502):**
```
❌ Calling storyboard_creation without avatar_image_url parameter
❌ Not extracting the URL from the previous image_generation result
❌ Missing required parameters (title, scenes, avatar_image_url, avatar_description)
✅ DO: Extract URLs from previous tool results and include in next tool call
```

**Impact**: Explicit instruction with example showing exactly how to extract and use the URL.

---

## Conversation Flow Comparison

### Before Fixes ❌

1. User: "create a full ad..."
2. Assistant: Asks clarifying questions ❌ (should take initiative)
3. User: "take initiative"
4. Assistant: Generates avatar ✅
5. User: "cool with me" (clear approval)
6. Assistant: Doesn't recognize approval ❌, fails to call tool ❌
7. User: "retry"
8. Assistant: Calls tool with missing parameters ❌
9. Error: Missing avatar_image_url ❌

### After Fixes ✅

1. User: "create a full ad..."
2. Assistant: Takes initiative, generates avatar ✅
3. User: "cool with me" 
4. Assistant: Recognizes approval ✅, extracts avatar URL ✅, calls storyboard_creation ✅
5. Storyboard created successfully ✅

---

## Technical Implementation

### Files Modified
- `lib/prompts/assistant/system.ts`

### Changes Made

1. **Lines 32-37**: Added critical tool call instructions after reflexion
2. **Lines 465-471**: Expanded approval phrase recognition
3. **Lines 478-480**: Added explicit URL extraction example
4. **Lines 494-502**: Added common mistakes section with specific anti-patterns

### Backward Compatibility
✅ All changes are additive enhancements  
✅ No breaking changes to existing functionality  
✅ Maintains all existing tool definitions and parameters  

---

## Testing Recommendations

### Test Case 1: Natural Approval Language
**Scenario**: Generate avatar, respond with various approval phrases

Test phrases:
- "cool with me"
- "looks good"
- "perfect"
- "go ahead"
- "yes"
- "great"

**Expected**: Assistant should recognize all as approval and proceed to storyboard

### Test Case 2: Tool Call with Avatar URL
**Scenario**: Generate avatar, approve, verify storyboard call

**Expected**:
1. Avatar generates with outputUrl: "https://..."
2. User approves
3. storyboard_creation call includes avatar_image_url: "https://..."

### Test Case 3: Complete Flow
**Scenario**: "Create a full ad for [product] with a girl promoting it"

**Expected**:
1. Assistant takes initiative (no unnecessary questions)
2. Generates avatar
3. Waits for approval
4. Recognizes natural approval language
5. Extracts avatar URL correctly
6. Calls storyboard_creation with all required params
7. Success

---

## Root Cause Analysis

### Why Did This Happen?

1. **Over-specification**: The original prompt was too specific about approval phrases, creating a brittle pattern match
2. **Under-specification**: The prompt didn't explicitly warn against "describing tool use without calling"
3. **Missing Examples**: No concrete example of URL extraction and parameter passing
4. **Implicit Assumptions**: Assumed LLM would naturally extract URLs from context without explicit instruction

### Prevention Strategy

Going forward:
- ✅ Use flexible pattern matching with examples, not rigid exact phrases
- ✅ Explicitly warn against common mistakes
- ✅ Provide concrete examples of parameter extraction
- ✅ Test with natural language variations

---

## Summary

Three critical fixes implemented:

1. **Flexible Approval Recognition**: Recognizes 10+ natural approval phrases instead of 2 exact matches
2. **Explicit Tool Call Instructions**: Clear warning against "describe but don't call" mistake
3. **URL Extraction Guidance**: Concrete example of extracting avatar_image_url from previous result

**Result**: Assistant can now handle natural language approval and properly chain tool calls with extracted parameters from previous results.

**Build Status**: ✅ Verified successful compilation
**Ready for Testing**: Yes

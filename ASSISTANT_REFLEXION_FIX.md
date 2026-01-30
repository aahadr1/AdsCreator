# Assistant Reflexion & Tool Calling Fix

## Problem Summary

When users requested video generation with clear intent (e.g., "create a ugc video of a woman simply sitting in her room and trying on the product"), the assistant would:

1. **Correctly plan** in its reflexion what to do
2. **Choose FOLLOW_UP action** to ask clarifying questions
3. **Get incorrectly flagged** as making false generation claims
4. **Return error message** instead of asking the intended questions

## Root Cause Analysis

### The Issue
The user asked: *"Create a UGC video of a woman trying BB cream with before-and-after effect"*

**Assistant's Reflexion:**
```
User Intent: Create a UGC video with BB cream before-and-after
Selected Action: FOLLOW_UP
Tool To Use: storyboard_creation
Reasoning: Need to confirm details about setting, camera style, etc.
```

**What Happened:**
1. Assistant selected `FOLLOW_UP` (correct - wants to ask questions first)
2. Assistant mentioned it would "create a storyboard" after clarifying details
3. False positive detection triggered at `/app/api/assistant/chat/route.ts:3689-3695`
4. The regex pattern was too aggressive:
   ```typescript
   const claimsGeneration = /\b(creat(ing|e)|generat(ing|e)|start(ing|ed)|build(ing))\b.{0,50}\b(storyboard|avatar|image|video|script)\b/i
   ```
5. This caught mentions of FUTURE creation, not just IMMEDIATE claims
6. User received: *"⚠️ I attempted to start generation but failed to execute the tool call properly"*

### The Core Problems

1. **Over-aggressive false claim detection**: Regex caught any mention of "creating", "generating" near "storyboard", even in context of future plans or questions
2. **No context awareness**: Didn't check if Selected Action was FOLLOW_UP (where mentioning future tools is expected)
3. **Unclear reflexion guidelines**: System prompt didn't clearly distinguish when to use FOLLOW_UP vs TOOL_CALL

## The Fix

### 1. Improved False Claim Detection (`/app/api/assistant/chat/route.ts`)

**Before:**
```typescript
const claimsGeneration = /\b(creat(ing|e)|generat(ing|e)|start(ing|ed)|build(ing))\b.{0,50}\b(storyboard|avatar|image|video|script)\b/i.test(finalAssistantResponse);

if (claimsGeneration && toolCalls.length === 0 && !wantedToolCall) {
  finalAssistantResponse = '⚠️ I attempted to start generation but failed...';
}
```

**After:**
```typescript
const isFOLLOW_UP = reflexionMeta?.selectedAction === 'FOLLOW_UP';
const hasQuestionMarks = /\?/.test(finalAssistantResponse);

// More specific regex for IMMEDIATE generation claims (present continuous)
const claimsImmediateGeneration = /\b(creating|generating|starting|building)\b.{0,30}\b(your|the|a)\b.{0,30}\b(storyboard|avatar|image|video|script)\b(?!.*\?)/i.test(finalAssistantResponse);

const mentionsFutureCreation = /\b(will|would|can|could|should|need to|going to|let me|first|before)\b.{0,50}\b(creat|generat|build|mak)/i.test(finalAssistantResponse);

// Only flag if claiming IMMEDIATE generation AND not asking questions
if (claimsImmediateGeneration && toolCalls.length === 0 && !wantedToolCall && !isFOLLOW_UP && !hasQuestionMarks && !mentionsFutureCreation) {
  finalAssistantResponse = '⚠️ I attempted to start generation but failed...';
}
```

**Key Improvements:**
- ✅ Check if Selected Action is FOLLOW_UP (skip detection)
- ✅ Check for question marks (asking questions is OK)
- ✅ Only flag PRESENT CONTINUOUS tense ("creating", not "create")
- ✅ Exclude future/conditional language ("will create", "need to create")
- ✅ More specific pattern requiring "your/the/a" between verb and object

### 2. Clearer Reflexion Guidelines (`/lib/prompts/assistant/system.ts`)

**Before:**
```
**Action Types:**
- TOOL_CALL: When you need to generate/create something
- DIRECT_RESPONSE: When answering questions or providing information
- FOLLOW_UP: When asking clarifying questions

**CRITICAL:** If you select TOOL_CALL, you MUST include a valid <tool_call> block.
```

**After:**
```
**Action Types:**
- TOOL_CALL: When you have everything needed and will IMMEDIATELY execute a tool. MUST include <tool_call> block.
- DIRECT_RESPONSE: When answering questions, explaining something, or providing information only.
- FOLLOW_UP: When you need to ask clarifying questions BEFORE you can execute tools. No tool calls in this response.

**CRITICAL RULES:**
1. If you select TOOL_CALL, you MUST include a <tool_call> block in the same response.
2. If you select FOLLOW_UP, you ask questions ONLY - no tool execution, no claims of "creating" or "generating".
3. If you select DIRECT_RESPONSE, provide information only - no questions, no tool calls.
4. "Tool To Use" field indicates what tool you'll use WHEN ready (may be in future turn if FOLLOW_UP).
```

### 3. Better Guidance on When to Ask vs Proceed

Added clear decision tree:

```
**WHEN TO ASK vs WHEN TO PROCEED:**

Use FOLLOW_UP (ask questions) when:
- User uploaded images but didn't specify their purpose
- Request is ambiguous about key creative elements (style, setting, camera)
- Missing critical information that would significantly change the output

Use TOOL_CALL (proceed with smart defaults) when:
- User request is clear and specific (e.g., "Create a UGC video of woman trying BB cream")
- Can infer reasonable defaults from context (UGC = casual setting, woman = need avatar)
- Missing details are minor and can use standard defaults

**SMART DEFAULTS (when proceeding without questions):**
- UGC video → casual home setting, handheld/static camera, natural lighting
- Product demo → single location, focused on product
- Tutorial → single location, step-by-step structure
- If avatar needed but not provided → ALWAYS generate one first
- Vertical format (9:16) for TikTok/Instagram unless specified
- Natural, conversational tone unless brand voice specified
```

## Expected Behavior Now

### Scenario 1: Clear Request
**User:** "Create a UGC video of woman trying BB cream"

**Assistant Reflexion:**
```
User Intent: Create UGC video with BB cream demo
Selected Action: TOOL_CALL
Tool To Use: image_generation
Reasoning: Clear request, will generate avatar first then create storyboard
```

**Result:** ✅ Generates avatar immediately (or proceeds with storyboard if avatar exists)

### Scenario 2: Ambiguous Request
**User:** "Make a video with this image" [uploads product photo]

**Assistant Reflexion:**
```
User Intent: Create video featuring uploaded image
Selected Action: FOLLOW_UP
Tool To Use: storyboard_creation
Reasoning: Need to clarify video type, whether to show person, camera style
```

**Result:** ✅ Asks clarifying questions:
- "What type of video would you like? (UGC, product demo, tutorial, etc.)"
- "Should this video feature a person/creator?"
- "What camera style? (static, handheld, dynamic)"

### Scenario 3: Questions About Image After Generation
**User:** "Can you zoom in on the face more?"

**Assistant Reflexion:**
```
User Intent: Modify previously generated image with closer crop
Selected Action: TOOL_CALL
Tool To Use: image_generation
Reasoning: Clear modification request, will regenerate with zoom
```

**Result:** ✅ Regenerates image with modified prompt

## Testing Recommendations

Test these scenarios to verify the fix:

1. ✅ Clear UGC request → Should generate without asking questions
2. ✅ Uploaded image without context → Should ask what it is
3. ✅ Ambiguous video type → Should ask for clarification
4. ✅ Request mentioning "create storyboard" → Should not trigger false positive
5. ✅ Follow-up questions about generated content → Should handle naturally

## Files Changed

1. `/app/api/assistant/chat/route.ts` (lines 3685-3705)
   - Improved false claim detection logic
   - Added context-aware checks

2. `/lib/prompts/assistant/system.ts` (lines 30-67)
   - Clearer reflexion action definitions
   - Better guidance on when to ask vs proceed
   - Smart defaults documentation

## Impact

- ✅ **Eliminates false error messages** when assistant asks legitimate questions
- ✅ **Improves user experience** by allowing natural conversation flow
- ✅ **Maintains safety net** for actual generation failures
- ✅ **Makes assistant behavior more predictable** with clear guidelines
- ✅ **Reduces confusion** about when to ask questions vs proceed with defaults

---

**Date Fixed:** January 30, 2026
**Files Modified:** 2
**Lines Changed:** ~50
**Severity:** High (user-facing error)
**Status:** ✅ Resolved

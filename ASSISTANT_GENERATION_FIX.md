# Assistant Generation Claim Fix

## Problem

The assistant was saying "I just started generating your avatar" even when it didn't actually execute the image generation tool. This happened when:

1. The assistant mentioned in its text response that it would generate something
2. But failed to output a proper `<tool_call>` block
3. The system incorrectly detected this as successful generation

## Root Cause

In `/app/api/assistant/chat/route.ts` at line 3382, the code was checking if `filteredToolCalls` contained an avatar generation call:

```typescript
const executedAvatarGen = filteredToolCalls.some(
  (tc) => tc.tool === 'image_generation' && (tc.input as any)?.purpose === 'avatar'
);
```

This check only verified that the assistant **intended** to call the tool (parsed from response), but not whether the tool was **actually executed successfully**.

## Solution

### 1. Fixed Tool Execution Detection (route.ts)

Changed the check to verify BOTH that:
- The tool call was present in `filteredToolCalls` (parsed from response)
- The tool was actually executed and returned success in `toolResults`

```typescript
// IMPORTANT: Only claim we started generation if we ACTUALLY executed the tool call successfully
const executedAvatarGen = toolResults.some(
  (tr) => tr.tool === 'image_generation' && tr.result && (tr.result as any).success
) && filteredToolCalls.some(
  (tc) => tc.tool === 'image_generation' && (tc.input as any)?.purpose === 'avatar'
);
```

### 2. Added Detection for False Claims (route.ts)

Added a regex-based check to catch when the assistant claims it's generating but didn't execute any tools:

```typescript
// Additional check: if assistant claims it's "generating" or "starting" something but didn't execute tools
const claimsGeneration = /\b(generat(ing|e)|start(ing|ed)|creat(ing|e))\b.*\b(avatar|image|storyboard)\b/i.test(finalAssistantResponse);
if (claimsGeneration && toolCalls.length === 0 && !wantedToolCall) {
  // Assistant is claiming to generate something but didn't call any tools - this is wrong
  finalAssistantResponse =
    'I mentioned starting a generation, but I didn\'t actually call the tool properly.\n\n' +
    'Please reply **"retry"** and I\'ll make sure to execute the proper tool call.';
}
```

### 3. Updated System Prompt (system.ts)

Enhanced the avatar workflow section to emphasize that tool calls must be executed:

```
1. **Generate avatar** using image_generation with purpose="avatar"
   - **CRITICAL**: Always output a proper <tool_call> block - never just SAY you'll generate without calling the tool
   - Only after calling the tool should you mention "I'm generating your avatar"
```

Added a new behavioral guideline:

```
6. **Be Accurate**: NEVER say you're "generating" or "creating" something unless you've included a <tool_call> block in the same response
```

Added to the REMEMBER section:

```
- **NEVER claim to be generating/creating without a <tool_call> block in the same response**
```

## Files Changed

1. `/app/api/assistant/chat/route.ts`
   - Line ~3382: Enhanced `executedAvatarGen` check
   - Line ~3227: Added false claim detection

2. `/lib/prompts/assistant/system.ts`
   - Avatar workflow section: Added critical warning
   - Behavioral guidelines: Added accuracy rule
   - Remember section: Added tool call requirement

## Testing Scenarios

### Test 1: Successful Avatar Generation ✅
**User**: "Create an avatar for me"
**Expected**: 
- Assistant outputs proper `<tool_call>` block
- Message: "I just started generating your avatar. You'll see it appear above..."
- Avatar actually starts generating

### Test 2: Failed Tool Call (Malformed) ✅
**User**: "Create an avatar for me"
**Assistant**: Outputs malformed `<tool_call>` with invalid JSON
**Expected**: 
- Message: "I expected to run a tool, but no valid <tool_call> was provided in the response."
- Prompts user to reply "retry"

### Test 3: False Claim (No Tool Call) ✅
**User**: "Create an avatar for me"
**Assistant**: Says "I'll generate an avatar" but doesn't output `<tool_call>` block
**Expected**:
- Message: "I mentioned starting a generation, but I didn't actually call the tool properly."
- Prompts user to reply "retry"

### Test 4: Tool Execution Fails ✅
**User**: "Create an avatar for me"
**Assistant**: Outputs proper `<tool_call>` but Replicate API fails
**Expected**:
- Does NOT say "I just started generating your avatar"
- Shows actual error from the tool execution
- User can retry or adjust parameters

### Test 5: Storyboard Creation (No Regression) ✅
**User**: "Create a storyboard" (with confirmed avatar)
**Expected**:
- Still shows "🎬 Creating your storyboard..." during actual execution
- No false claims before tool call

## Impact

✅ **Prevents user confusion** from false generation claims
✅ **Forces assistant** to properly execute tool calls
✅ **Provides clear error messages** when tool calls fail
✅ **Maintains accurate state tracking** throughout the conversation
✅ **Better UX** - users know exactly when something is actually happening vs. when it failed

## Why This Matters

Before this fix, users would see "I just started generating your avatar" but:
- No avatar would appear
- No generation task would be created
- Users would wait indefinitely or get confused
- The conversation state would be incorrect

After this fix:
- Message only appears when tool is ACTUALLY executed successfully
- Clear error messages guide users when something goes wrong
- Users can retry with confidence
- Conversation state stays accurate

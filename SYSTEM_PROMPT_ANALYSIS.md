# Assistant System Prompt Analysis

**Date:** January 30, 2026  
**File:** `lib/prompts/assistant/system.ts`

---

## 📊 Overall Assessment

**Rating:** 7/10 - Good foundation but has critical issues

**Strengths:** ✅
- Clear tool definitions
- Strong emphasis on consistency
- Good reflexion block structure
- Comprehensive continuity rules

**Weaknesses:** ❌
- `prompt_creator` tool doesn't exist in backend
- Tool count mismatch (claims 7, only defines 4)
- Missing `video_analysis` and `motion_control` tools
- Overly complex workflow that may confuse the model
- Contradictory instructions about asking vs proceeding

---

## 🔍 Detailed Analysis

### **CRITICAL ISSUE #1: Missing Tool Implementation** 🚨

**Line 123:** "TOOL 1: prompt_creator (NEW - MANDATORY BEFORE ANY PROMPT)"

**Problem:**
```typescript
// The prompt says this is MANDATORY
"You MUST call this tool before outputting ANY image or video prompt"

// But the tool doesn't exist in the backend!
```

**Evidence:**
Looking at the backend (`app/api/assistant/chat/route.ts`), the available tools are:
1. ✅ `script_creation` - Exists
2. ✅ `image_generation` - Exists
3. ✅ `storyboard_creation` - Exists
4. ✅ `video_generation` - Exists
5. ✅ `video_analysis` - Exists (NOT in prompt!)
6. ✅ `motion_control` - Exists (NOT in prompt!)
7. ❌ `prompt_creator` - **DOES NOT EXIST**

**Impact:**
- Assistant tries to call `prompt_creator` before every image/video
- Backend ignores it (tool not implemented)
- Assistant gets confused about workflow
- Extra latency from failed tool calls
- Inconsistent behavior

**Solution:** Either implement the tool or remove references to it

---

### **CRITICAL ISSUE #2: Tool Count Mismatch** 🚨

**Line 120:** "You have 7 tools. Call them by outputting a <tool_call> block with JSON."

**Problem:**
The prompt only documents 4-5 tools:
1. `prompt_creator` (doesn't exist)
2. `script_creation`
3. `image_generation`
4. `storyboard_creation`
5. `video_generation`

**Missing from prompt:**
6. ❌ `video_analysis` - Exists in backend but not documented
7. ❌ `motion_control` - Exists in backend but not documented

**Impact:**
- Assistant doesn't know about `video_analysis` and `motion_control` tools
- Users can't use these features effectively
- Capabilities are hidden from the assistant

---

### **CRITICAL ISSUE #3: Contradictory Decision Logic** ⚠️

**Lines 52-77:** WHEN TO ASK vs WHEN TO PROCEED

The prompt gives conflicting guidance:

**Says to ask when:**
- "User uploaded images but didn't specify their purpose"
- "Request is ambiguous"

**Then says to proceed when:**
- "User request is clear and specific"
- "Can infer reasonable defaults"
- "Missing details are minor"

**But then says:**
- "NEVER ASSUME: Don't assume uploaded images are avatars"

**This creates confusion:**
- If user uploads image → Don't assume it's avatar
- But also → Proceed with smart defaults
- Which is it? 🤔

**Impact:**
- Assistant hesitates unnecessarily
- Or makes wrong assumptions
- Inconsistent behavior across conversations

---

### **ISSUE #4: Overly Complex Workflow** ⚠️

**Line 310-315:** WORKFLOW for storyboard_creation

```
1. Generate avatar with image_generation first
2. Wait for avatar to complete and user to approve
3. Use prompt_creator to plan each scene's prompts
4. Call storyboard_creation with the avatar URL
5. System generates all frames sequentially in background
```

**Problems:**
- Step 3 (`prompt_creator`) doesn't exist
- Requires 4 separate interactions minimum
- "Wait for user to approve" blocks automation
- Over-engineered for simple requests

**Better workflow:**
```
1. If needs person → Generate avatar OR ask for upload
2. Once avatar ready → Create storyboard (backend handles frame generation)
3. User reviews → Generate videos if approved
```

---

### **ISSUE #5: Reflexion Block Overhead** ⚠️

**Lines 28-49:** EVERY response must start with reflexion block

**Example Required Format:**
```xml
<reflexion>
**User Intent:** [What the user wants in one sentence]
**Selected Action:** [TOOL_CALL | DIRECT_RESPONSE | FOLLOW_UP]
**Tool To Use:** [tool_name | none]
**Reasoning:** [Brief explanation]
</reflexion>
```

**Problems:**
- Adds ~50-100 tokens to EVERY response
- User never sees it (it's hidden)
- Creates cognitive overhead for the model
- Slows down simple responses

**When it's useful:**
- ✅ Complex multi-step tasks
- ✅ Debugging assistant behavior

**When it's overkill:**
- ❌ Simple questions: "What does this do?"
- ❌ Direct answers: "How many scenes?"
- ❌ Clarifications: "Use this avatar"

---

### **ISSUE #6: Missing Tool Documentation** ⚠️

These tools exist in backend but are NOT in the prompt:

**`video_analysis` (exists in backend):**
```typescript
// Analyzes uploaded videos for:
- Duration
- People count
- Single character detection
- Motion control suitability
```

**`motion_control` (exists in backend):**
```typescript
// Creates videos with character replacement:
- Takes reference image + reference video
- Replaces character while keeping motion
```

**Impact:**
- Users can't effectively use these features
- Assistant doesn't know when to suggest them
- Hidden capabilities

---

## ✅ What Works Well

### **1. Consistency Rules (Lines 79-98)**
```
✅ Clear continuity rules
✅ First/last frame relationship explained
✅ Reference image usage defined
✅ Visual grounding emphasized
```

### **2. Dialogue Rules (Lines 100-107)**
```
✅ Native spoken dialogue support
✅ Lip-sync considerations
✅ Audio mixing guidance
✅ Timing specifications
```

### **3. Avatar Consistency (Lines 109-115)**
```
✅ Character identity maintenance
✅ Wardrobe continuity
✅ Reference image requirements
```

### **4. Tool Call Format (Lines 483-508)**
```
✅ Clear XML format: <tool_call>...</tool_call>
✅ Examples of correct vs wrong usage
✅ Warning about adding text with tool calls
```

### **5. Smart Defaults (Lines 64-71)**
```
✅ UGC video defaults
✅ Product demo defaults
✅ Vertical format default
✅ Natural tone default
```

---

## 🔧 Recommended Fixes

### **Priority 1: Remove Non-Existent Tool** (CRITICAL)

Remove all references to `prompt_creator`:
- Lines 123-234: Entire `prompt_creator` section
- Line 120: Change "7 tools" to actual count
- Line 274: Remove "you should use prompt_creator first"
- Line 319: Remove "Use prompt_creator to plan"
- Line 497: Remove "Use prompt_creator BEFORE any image/video prompt"

### **Priority 2: Add Missing Tools** (HIGH)

Add documentation for:

**Tool 6: video_analysis**
```typescript
{
  name: 'video_analysis',
  description: 'Analyze uploaded videos for duration, people count, motion control suitability',
  parameters: {
    video_url: string,
    max_duration_seconds: number
  }
}
```

**Tool 7: motion_control**
```typescript
{
  name: 'motion_control',
  description: 'Create video with character replacement using reference image and video',
  parameters: {
    image_url: string,
    video_url: string
  }
}
```

### **Priority 3: Simplify Workflow** (MEDIUM)

**Current (Complex):**
```
1. Generate avatar
2. Wait for approval
3. Use prompt_creator (doesn't exist!)
4. Create storyboard
5. Wait for frames
6. Generate videos
```

**Simplified:**
```
1. If needs person → Generate avatar OR use uploaded image
2. Create storyboard (frames auto-generate)
3. Generate videos when user approves
```

### **Priority 4: Fix Contradictions** (MEDIUM)

**Make decision logic clear:**

```
WHEN TO ASK:
- User uploaded image WITHOUT context ("What's this image for?")
- Critical creative decisions (style, tone, brand voice)
- Ambiguous requests where multiple approaches are valid

WHEN TO PROCEED:
- User uploaded image WITH context ("Use this as avatar")
- Clear requests ("Create UGC video for skincare")
- Standard defaults apply (UGC = home setting, vertical format)
```

### **Priority 5: Optimize Reflexion** (LOW)

**Make reflexion optional:**

```
WHEN REFLEXION IS REQUIRED:
- Multi-step workflows
- Complex decision trees
- Debugging needed

WHEN REFLEXION IS OPTIONAL:
- Simple tool calls
- Direct answers
- Confirmations
```

---

## 📋 Specific Issues by Line

| Line | Issue | Severity | Fix |
|------|-------|----------|-----|
| 120 | Says "7 tools" but only 4-5 exist | High | Update count |
| 123-234 | `prompt_creator` doesn't exist | **Critical** | Remove entire section |
| 274 | References non-existent tool | **Critical** | Remove sentence |
| 319 | References non-existent tool | **Critical** | Remove step 3 |
| 28-49 | Reflexion required for ALL responses | Medium | Make optional |
| 52-77 | Contradictory ask/proceed logic | Medium | Clarify rules |
| 649 | Storyboard needs avatar BEFORE call | Medium | Can generate during |
| Missing | No `video_analysis` tool | High | Add documentation |
| Missing | No `motion_control` tool | High | Add documentation |

---

## 🎯 Impact on User Experience

### **Current Issues Cause:**

1. **Confusion:**
   - Assistant tries to call `prompt_creator` (fails silently)
   - Users don't know about `video_analysis` feature
   - Users don't know about `motion_control` feature

2. **Inefficiency:**
   - Extra reflexion overhead on simple requests
   - Multi-step workflow when 1 step would work
   - Waiting for approvals unnecessarily

3. **Inconsistency:**
   - Sometimes asks, sometimes assumes
   - Contradictory rules confuse the model
   - Behavior unpredictable

### **After Fixes:**

1. **Clarity:**
   - ✅ Only calls tools that exist
   - ✅ All features documented
   - ✅ Clear decision rules

2. **Efficiency:**
   - ✅ Streamlined workflow
   - ✅ Optional reflexion
   - ✅ Fast responses

3. **Consistency:**
   - ✅ Predictable behavior
   - ✅ Clear ask/proceed rules
   - ✅ All tools accessible

---

## 🚀 Recommended Actions

### **Immediate (Critical):**
1. ❌ **Remove `prompt_creator` tool** completely
2. ✅ **Add `video_analysis` tool** documentation
3. ✅ **Add `motion_control` tool** documentation
4. ✅ **Fix tool count** (update to actual number)

### **Short Term (High Priority):**
5. ✅ **Simplify workflow** section
6. ✅ **Clarify ask/proceed logic**
7. ✅ **Add examples** for new tools
8. ✅ **Test updated prompt** with real conversations

### **Long Term (Nice to Have):**
9. Make reflexion optional
10. Add more real-world examples
11. Add common failure cases and recovery
12. Document edge cases better

---

## 📝 Summary

### **What's Wrong:**

1. 🚨 **`prompt_creator` tool doesn't exist** - Referenced 5+ times but not implemented
2. 🚨 **Missing tools** - `video_analysis` and `motion_control` not documented
3. ⚠️ **Tool count mismatch** - Says 7, actually 4-6
4. ⚠️ **Contradictory logic** - Ask vs proceed rules conflict
5. ⚠️ **Overly complex** - Workflow has unnecessary steps
6. ⚠️ **Reflexion overhead** - Required for ALL responses

### **What Works:**

1. ✅ **Continuity rules** - Excellent guidance
2. ✅ **Dialogue system** - Well defined
3. ✅ **Avatar consistency** - Clear requirements
4. ✅ **Tool format** - Good examples
5. ✅ **Smart defaults** - Helpful for UGC/demos

### **Priority:**

1. **CRITICAL:** Remove `prompt_creator` references
2. **HIGH:** Add missing tools (`video_analysis`, `motion_control`)
3. **MEDIUM:** Simplify workflow and clarify logic
4. **LOW:** Optimize reflexion usage

---

**Recommendation:** Fix critical issues (1-2) immediately to prevent assistant confusion and enable all features.

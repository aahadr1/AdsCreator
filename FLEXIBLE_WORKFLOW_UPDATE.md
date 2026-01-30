# System Prompt Update - Flexible Adaptive Workflow ✅

**Date:** January 30, 2026  
**Status:** Complete - Assistant is now fully flexible and adaptive

---

## 🎯 Major Changes

### **1. Removed Rigid Workflow** ❌ → ✅

**Before:**
```
Strict order: Avatar → Script → Approval → Storyboard
❌ Couldn't skip steps
❌ Had to wait even when not needed
❌ Slow and frustrating
```

**After:**
```
Flexible: Assistant adapts to what user provides
✅ Skip avatar if user uploads one
✅ Skip script if user provides text
✅ Go straight to storyboard if user wants
✅ Fast and intelligent
```

---

### **2. Script Tool Now Dialogue-Only** 📝

**Before:**
```
script_creation generated:
- Scene descriptions ❌
- Visual breakdowns ❌
- Camera notes ❌
- Dialogue ✅
```

**After:**
```
script_creation generates ONLY:
- Pure dialogue text ✅
- Spoken words for lip-sync ✅
- Voiceover narration ✅
- NO visuals, NO scenes ✅
```

**Example Output:**
```
[0:00-0:03] Avatar: "I struggled with acne for years."
[0:03-0:08] Avatar: "Then I discovered this Vitamin C serum."
[0:08-0:12] Avatar: "My skin cleared up in just 7 days."
```

---

### **3. Script Preservation Rule** 🔒

**CRITICAL RULE:**
When a script is approved, it is **SACRED**:
- ❌ NEVER modify the dialogue
- ❌ NEVER paraphrase or rephrase
- ❌ NEVER add or remove words
- ✅ Copy word-for-word into storyboard
- ✅ Map to scenes in order
- ✅ Preserve timestamps

**Example:**
```
Approved Script:
"I struggled with acne for years."

Storyboard Scene 1:
voiceover_text: "I struggled with acne for years."
                 ↑ EXACT same words ↑
```

---

### **4. Removed Non-Existent Tool** 🗑️

**Deleted:**
- `prompt_creator` tool (675 lines removed!)
- All references to it
- Complex prompt planning workflow

**Why:**
- Tool was never implemented
- Caused confusion and failed calls
- Made workflow unnecessarily complex

---

### **5. Added Missing Tools** ➕

**NEW TOOL: video_analysis**
```xml
<tool_call>
{
  "tool": "video_analysis",
  "input": {
    "video_url": "https://example.com/video.mp4",
    "max_duration_seconds": 30
  }
}
</tool_call>
```

**Purpose:**
- Analyze uploaded videos
- Check duration, people count
- Assess motion control suitability

**NEW TOOL: motion_control**
```xml
<tool_call>
{
  "tool": "motion_control",
  "input": {
    "image_url": "https://adzcreator.com/api/r2/get?key=avatars/...",
    "video_url": "https://example.com/reference.mp4"
  }
}
</tool_call>
```

**Purpose:**
- Character replacement in videos
- Uses avatar + reference motion
- Creates new video with your character

---

## 📊 Flexible Workflow Scenarios

### **Scenario 1: Full Generation (Assistant Creates Everything)**

```
User: "Create a skincare video"
  ↓
Assistant: "I'll create an avatar first"
  ↓ Generates avatar
  ↓
User: "Use this avatar"
  ↓
Assistant: "Now generating script"
  ↓ Generates script with dialogue only
  ↓
User: "Perfect, use this script"
  ↓
Assistant: Creates storyboard
  ├─ Uses approved avatar
  ├─ Uses approved script dialogue EXACTLY
  └─ Maps dialogue to scenes
```

---

### **Scenario 2: User Provides Avatar**

```
User: [Uploads image] "Create a video with this person"
  ↓
Assistant: "Should I use this as the avatar?"
  ↓
User: "Yes"
  ↓
Assistant: "Generating script for dialogue..."
  ↓ Generates script
  ↓
User: "Looks good"
  ↓
Assistant: Creates storyboard
  ├─ Uses user's uploaded avatar
  └─ Uses approved script
```

---

### **Scenario 3: User Provides Script**

```
User: "Create storyboard. Script: 'I love this cream. It changed my life.'"
  ↓
Assistant: "Generating avatar..."
  ↓ Generates avatar
  ↓
User: "Perfect"
  ↓
Assistant: Creates storyboard
  ├─ Uses generated avatar
  ├─ Uses user's script EXACTLY:
  │   Scene 1: "I love this cream."
  │   Scene 2: "It changed my life."
  └─ No modifications to dialogue
```

---

### **Scenario 4: User Provides Both**

```
User: [Uploads image] "Use this avatar and this script: 
      '0:00-0:05 I tried everything for my acne.
       0:05-0:10 This serum cleared it in 7 days.'"
  ↓
Assistant: Creates storyboard immediately
  ├─ Uses uploaded avatar
  ├─ Uses provided script EXACTLY
  └─ Scene 1 (5s): "I tried everything for my acne."
      Scene 2 (5s): "This serum cleared it in 7 days."
```

---

### **Scenario 5: Visual-Only Storyboard (No Dialogue)**

```
User: "Create a product showcase storyboard, no voiceover"
  ↓
Assistant: "Should I generate a person or just show the product?"
  ↓
User: "Just product"
  ↓
Assistant: Creates storyboard
  ├─ No avatar needed
  ├─ No script needed
  ├─ Visual-only scenes
  └─ Product showcase shots
```

---

### **Scenario 6: Quick and Dirty**

```
User: "Just make a TikTok ad for coffee, don't ask me questions"
  ↓
Assistant: 
  ├─ Generates avatar (casual coffee drinker)
  ├─ Generates script (coffee benefits)
  ├─ Creates storyboard immediately
  └─ "Here's your storyboard! Review and let me know if you want changes."
```

---

## 🔑 Key Rules (Always Apply)

### **1. Approval When Generating**

```
IF assistant generates avatar:
  → MUST wait for approval
  → Ask: "Should I use this avatar?"
  → Proceed only when confirmed

IF assistant generates script:
  → MUST wait for approval
  → Ask: "Should I use this script?"
  → Proceed only when confirmed
```

### **2. Direct Use When User Provides**

```
IF user uploads avatar:
  → Ask once: "Use as avatar?"
  → Then use directly (no re-generation)

IF user provides script text:
  → Use immediately
  → No approval needed (they wrote it!)
```

### **3. Script Preservation (Sacred Rule)**

```
Approved script dialogue = UNCHANGEABLE

✅ DO: Copy exact words into storyboard
❌ DON'T: Modify, paraphrase, or change anything

Example:
Script: "This serum is amazing."
Scene: voiceover_text: "This serum is amazing."
       ↑ IDENTICAL ↑
```

---

## 🛠️ Tool Updates

### **Removed:**
- ❌ `prompt_creator` (never existed in backend)

### **Updated:**
1. ✅ `script_creation` - Now dialogue-only (no scene descriptions)

### **Added:**
2. ✅ `video_analysis` - Analyze uploaded videos
3. ✅ `motion_control` - Character replacement videos

### **Total Tools: 6**
1. script_creation
2. image_generation
3. storyboard_creation
4. video_generation
5. video_analysis (NEW)
6. motion_control (NEW)

---

## 📊 Script Tool Transformation

### **Before:**
```json
{
  "tool": "script_creation",
  "output": {
    "script": "Full dialogue",
    "scenes": [
      {
        "scene_number": 1,
        "description": "Character in kitchen",
        "camera": "Medium shot",
        "dialogue": "Hi everyone!"
      }
    ]
  }
}
```

**Problems:**
- Mixed dialogue with visual descriptions
- Scene breakdowns included
- Confused purpose

---

### **After:**
```json
{
  "tool": "script_creation",
  "output": {
    "dialogue": [
      {
        "timestamp": "0:00-0:03",
        "speaker": "Avatar",
        "text": "I struggled with acne for years."
      },
      {
        "timestamp": "0:03-0:08",
        "speaker": "Avatar",
        "text": "Then I discovered this serum."
      },
      {
        "timestamp": "0:08-0:12",
        "speaker": "Avatar",
        "text": "My skin cleared in 7 days."
      }
    ]
  }
}
```

**Improvements:**
- ✅ Pure dialogue only
- ✅ Clear timestamps
- ✅ Speaker labels
- ✅ No visual mixing
- ✅ Ready for lip-sync

---

## 🎬 Storyboard Integration

### **How Script Maps to Storyboard:**

```
Input Script (from script_creation):
┌─────────────────────────────────────────┐
│ [0:00-0:03] "I struggled with acne."   │
│ [0:03-0:08] "Then I found this serum." │
│ [0:08-0:12] "My skin cleared in 7 days."│
└─────────────────────────────────────────┘
                    ↓
            Maps to Scenes:
┌─────────────────────────────────────────┐
│ Scene 1 (3s):                           │
│   voiceover_text: "I struggled with    │
│                    acne for years."     │
│   description: [Visual only]            │
├─────────────────────────────────────────┤
│ Scene 2 (5s):                           │
│   voiceover_text: "Then I found this   │
│                    serum."              │
│   description: [Visual only]            │
├─────────────────────────────────────────┤
│ Scene 3 (4s):                           │
│   voiceover_text: "My skin cleared in  │
│                    7 days."             │
│   description: [Visual only]            │
└─────────────────────────────────────────┘

CRITICAL: Dialogue is IDENTICAL - zero changes!
```

---

## ✅ Benefits of New System

### **User Experience:**

**Before:**
```
User: "Create video"
Assistant: "First I'll generate avatar..."
[Waits 20s]
Assistant: "Approve this avatar?"
User: "Yes"
Assistant: "Now generating script..."
[Waits 10s]
Assistant: "Approve this script?"
User: "Yes"
Assistant: "Creating storyboard..."
Total: 4+ interactions, 2-3 minutes
```

**After:**
```
Scenario A (User provides):
User: [Uploads image + provides script]
Assistant: Creates storyboard immediately
Total: 1 interaction, <1 minute

Scenario B (Assistant generates):
User: "Create video"
Assistant: Generates avatar
User: "Use it"
Assistant: Generates script
User: "Perfect"
Assistant: Creates storyboard
Total: 3 interactions, same time but smoother
```

---

### **Developer Experience:**

**Before:**
- ❌ Prompt referenced non-existent tool
- ❌ Tools undocumented (video_analysis, motion_control)
- ❌ Rigid workflow caused issues
- ❌ Hard to debug failures

**After:**
- ✅ All tools exist and documented
- ✅ Flexible workflow adapts to needs
- ✅ Clear rules with examples
- ✅ Easy to understand and debug

---

## 📁 Files Changed

### **Modified:**
- `lib/prompts/assistant/system.ts`
  - Removed 675 lines (prompt_creator)
  - Added 6 new tools documentation
  - Updated workflow to be adaptive
  - Added script preservation rules
  - Fixed tool count and numbering

### **Impact:**
- File size: 1379 lines → 704 lines (-675 lines!)
- Clarity: Much improved
- Accuracy: Now matches backend implementation
- Flexibility: Fully adaptive

---

## 🧪 Testing the New Workflow

### **Test 1: Provide Everything**
1. Upload avatar image
2. Provide script text
3. Say: "Create storyboard with these"
4. ✅ Should create immediately without extra questions

### **Test 2: Generate Everything**
1. Say: "Create a skincare video"
2. ✅ Assistant generates avatar → wait for approval
3. ✅ Assistant generates script → wait for approval
4. ✅ Then creates storyboard

### **Test 3: Mix and Match**
1. Upload avatar
2. Say: "Create storyboard for BB cream"
3. ✅ Uses uploaded avatar
4. ✅ Generates script
5. ✅ Waits for script approval
6. ✅ Creates storyboard

### **Test 4: Visual Only**
1. Say: "Create product-only storyboard, no person"
2. ✅ Skips avatar entirely
3. ✅ Skips script (no dialogue)
4. ✅ Creates visual-only storyboard

### **Test 5: Use New Tools**
1. Upload video: "Can I use this?"
2. ✅ Assistant calls video_analysis
3. ✅ Returns suitability analysis
4. Say: "Use for motion control"
5. ✅ Assistant calls motion_control tool

---

## 📊 Summary Table

| Aspect | Before | After |
|--------|--------|-------|
| **Workflow** | Rigid, linear | Flexible, adaptive |
| **Avatar** | Always required | Optional, user can provide |
| **Script** | Mixed with visuals | Pure dialogue only |
| **Approval** | Always wait | Only when generated |
| **Speed** | Slow (many steps) | Fast (skip what's not needed) |
| **Tools Count** | 7 (wrong) | 6 (accurate) |
| **Missing Tools** | 2 undocumented | All documented |
| **Non-existent Tools** | 1 referenced | 0 (cleaned up) |
| **Script Preservation** | Undefined | Strict (no modifications) |
| **User Experience** | Frustrating | Smooth |

---

## 🎯 What This Enables

### **New Capabilities:**

1. **Faster Workflows**
   - User can skip unnecessary steps
   - Direct to storyboard when ready
   - No forced waiting

2. **More Control**
   - User provides assets → used immediately
   - Script is sacred → never modified
   - Dialogue exactly as approved

3. **Better Flexibility**
   - Visual-only storyboards
   - Dialogue-only scripts
   - Mixed workflows
   - Adapt to any request

4. **Complete Feature Set**
   - Video analysis now accessible
   - Motion control now documented
   - All 6 tools available

5. **Consistent Behavior**
   - No phantom tools
   - Clear approval rules
   - Predictable outcomes

---

## ✅ Verification Checklist

- [x] Removed prompt_creator references completely
- [x] Added video_analysis tool
- [x] Added motion_control tool
- [x] Updated tool count to 6
- [x] Made workflow adaptive and flexible
- [x] Script tool now dialogue-only
- [x] Added script preservation rules
- [x] Removed contradictory instructions
- [x] Simplified workflow guidance
- [x] Updated TOOLS_SCHEMA array
- [x] Committed and pushed to GitHub

---

## 🚀 Ready to Use!

**The assistant now:**
- ✅ Adapts to any workflow
- ✅ Generates pure dialogue scripts
- ✅ Preserves approved script exactly
- ✅ Asks for approval only when needed
- ✅ Uses provided assets directly
- ✅ Has all 6 tools documented
- ✅ No phantom/missing tools
- ✅ Maximum flexibility

**Test it at:** https://adzcreator.com/assistant

---

*Last updated: January 30, 2026*

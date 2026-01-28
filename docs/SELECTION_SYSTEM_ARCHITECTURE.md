# Storyboard Selection System - Architecture Diagram

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     STORYBOARD PAGE                              │
│                  /app/storyboard/[id]/page.tsx                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
┌──────────────────┐                    ┌──────────────────────┐
│  SELECTION STATE │                    │   VISUAL FEEDBACK    │
└──────────────────┘                    └──────────────────────┘
        │                                           │
        │  {                                        │
        │    type: 'scene',                        │
        │    items: [                              │
        │      { sceneNumber: 1 },                 │
        │      { sceneNumber: 3 }                  │
        │    ]                                     │
        │  }                                       │
        │                                          │
        ▼                                          ▼
┌──────────────────┐                    ┌──────────────────────┐
│  TOGGLE FUNCTIONS│                    │   CSS CLASSES        │
├──────────────────┤                    ├──────────────────────┤
│ • toggleScene    │                    │ • .selected          │
│ • toggleFrame    │                    │ • .selectedFrame     │
│ • toggleScript   │                    │ • .selectedScript    │
│ • clearSelection │                    │ • .selectedIndicator │
└──────────────────┘                    └──────────────────────┘
        │
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│              MODIFICATION BAR COMPONENT                          │
│         /components/StoryboardModificationBar.tsx               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [✨ Modifying: 2 scenes (1, 3)] [Input field] [Send] [Close]  │
│                                                                  │
│  💡 Examples: [More energetic] [Shorten] [Change setting]      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
        │
        │ User types: "Make these more energetic"
        │ Presses Enter
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API ENDPOINT                                  │
│              /api/storyboard/modify                             │
└─────────────────────────────────────────────────────────────────┘
        │
        │ POST request with:
        │ {
        │   storyboard_id,
        │   selection,
        │   modification_text
        │ }
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                  LOAD STORYBOARD                                │
│              (from PostgreSQL database)                         │
└─────────────────────────────────────────────────────────────────┘
        │
        │ Get selected scenes:
        │ - Scene 1: "Hook - Creator frustrated..."
        │ - Scene 3: "Solution - Shows product..."
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BUILD AI CONTEXT                             │
├─────────────────────────────────────────────────────────────────┤
│  STORYBOARD CONTEXT:                                            │
│  - Title: "Mascara That Works"                                  │
│  - Brand: LuxeLash                                              │
│  - Product: Volume Max Mascara                                  │
│  - Platform: TikTok                                             │
│                                                                  │
│  SELECTED SCENES:                                               │
│  - Scene 1 (full data)                                          │
│  - Scene 3 (full data)                                          │
│                                                                  │
│  USER REQUEST:                                                  │
│  "Make these more energetic"                                    │
└─────────────────────────────────────────────────────────────────┘
        │
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                  GPT-4o AI PROCESSING                           │
│              (MODIFICATION_SYSTEM_PROMPT)                       │
└─────────────────────────────────────────────────────────────────┘
        │
        │ AI analyzes request and returns:
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STRUCTURED UPDATES                           │
├─────────────────────────────────────────────────────────────────┤
│  {                                                              │
│    "updated_scenes": [                                          │
│      {                                                          │
│        "scene_number": 1,                                       │
│        "changes": {                                             │
│          "description": "Creator BURSTS into frame...",         │
│          "voiceover_text": "OMG you HAVE to see this!",        │
│          "audio_mood": "High energy, upbeat"                    │
│        }                                                        │
│      },                                                         │
│      {                                                          │
│        "scene_number": 3,                                       │
│        "changes": {                                             │
│          "description": "REVEALS product with excitement...",   │
│          "voiceover_text": "THIS changed everything!",         │
│          "audio_mood": "Excited, enthusiastic"                  │
│        }                                                        │
│      }                                                          │
│    ]                                                            │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
        │
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                  APPLY UPDATES                                  │
│              (Only to selected scenes)                          │
├─────────────────────────────────────────────────────────────────┤
│  Scene 1: ✅ Updated                                            │
│  Scene 2: ⏭️  Unchanged (not selected)                          │
│  Scene 3: ✅ Updated                                            │
│  Scene 4: ⏭️  Unchanged (not selected)                          │
└─────────────────────────────────────────────────────────────────┘
        │
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│               SAVE TO DATABASE                                  │
│              UPDATE storyboards table                           │
└─────────────────────────────────────────────────────────────────┘
        │
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                  RETURN SUCCESS                                 │
│  {                                                              │
│    success: true,                                               │
│    updated_scenes: [1, 3],                                      │
│    message: "Successfully updated scenes"                       │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
        │
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│              FRONTEND RELOAD                                    │
│         Fetch updated storyboard from API                       │
└─────────────────────────────────────────────────────────────────┘
        │
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                  UI UPDATES                                     │
├─────────────────────────────────────────────────────────────────┤
│  • Selection cleared                                            │
│  • Modification bar hidden                                      │
│  • Updated scenes rendered with new content                     │
│  • "Saved" indicator shown                                      │
│  • User can continue editing                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 UI Component Hierarchy

```
StoryboardPage
├── Header
│   ├── Back button
│   ├── Title input
│   ├── Selection mode toggle (when items selected)
│   ├── Save status
│   ├── Aspect ratio selector
│   ├── Export button
│   └── Continue to Generation button
│
├── Selection Info Panel (fixed top-right)
│   ├── Selection count
│   ├── "Select All" button
│   └── "Clear Selection" button
│
├── Main Content Area
│   └── Scenes Grid
│       └── Scene Card (foreach scene)
│           ├── Scene Header [Selectable]
│           │   ├── Scene number
│           │   ├── Scene name input
│           │   ├── Duration input
│           │   └── Actions (select button, delete button)
│           │
│           ├── Description textarea
│           │
│           ├── Frames Row
│           │   ├── First Frame [Selectable]
│           │   │   ├── Image or placeholder
│           │   │   └── "Selected" badge (if selected)
│           │   ├── Arrow icon
│           │   └── Last Frame [Selectable]
│           │       ├── Image or placeholder
│           │       └── "Selected" badge (if selected)
│           │
│           └── Script Box [Selectable]
│               ├── Label + select button
│               └── Voiceover textarea
│
├── Timeline (bottom)
│   ├── Timeline header
│   │   └── "Add Scene" button
│   └── Timeline track
│       └── Scene blocks (foreach scene) [Selectable]
│
└── Modification Bar (fixed bottom, conditional)
    ├── Selection summary
    ├── Input field
    ├── Submit button
    ├── Close button
    ├── Quick suggestions
    └── Error banner (conditional)
```

---

## 🔄 State Flow Diagram

```
┌──────────────┐
│ NO SELECTION │
└──────┬───────┘
       │
       │ User clicks scene header
       │
       ▼
┌─────────────────────┐
│  SCENE SELECTED     │  ──────┐
│  items: [scene 1]   │        │ User types modification
└──────┬──────────────┘        │
       │                       │
       │ User Cmd+Clicks       │
       │ another scene         │
       │                       ▼
       ▼                ┌──────────────────┐
┌─────────────────────┐│ MODIFICATION BAR │
│  MULTIPLE SCENES    ││   SHOWS INPUT    │
│  items: [1, 3, 5]   │└──────────────────┘
└──────┬──────────────┘        │
       │                       │ User presses Enter
       │                       │
       │                       ▼
       │                ┌──────────────────┐
       │                │  API CALL        │
       │                │  Processing...   │
       │                └──────────────────┘
       │                       │
       │                       │ Success
       │                       │
       │                       ▼
       │                ┌──────────────────┐
       │                │ STORYBOARD       │
       │                │ RELOADED         │
       │                └──────────────────┘
       │                       │
       └───────────────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │ SELECTION    │
                        │ CLEARED      │
                        └──────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │ NO SELECTION │
                        │ (Ready for   │
                        │  next action)│
                        └──────────────┘
```

---

## 🎯 Selection Type Matrix

| Type | Click Target | Multi-Select | Visual Feedback | Modification Scope |
|------|-------------|--------------|----------------|-------------------|
| **Scene** | Scene header | Cmd+Click | Purple border glow | Name, description, timing, script |
| **Frame** | Frame image | Cmd+Click | Border + "Selected" badge | Frame prompts, composition |
| **Script** | Script button | Cmd+Click | Script box highlight | Voiceover text, audio mood |

---

## 🔐 Security & Authorization

**Request flow:**
```
User request
  ↓
Check auth token
  ↓
Verify user owns storyboard
  ↓
Process modification
  ↓
Save only to user's storyboard
```

**Protection:**
- Row-level security (RLS) in database
- User ID validation on every request
- Storyboard ownership verification
- No cross-user modifications possible

---

## 📊 Performance Optimization

**Frontend:**
- Optimistic UI updates (instant feedback)
- Debounced auto-save (1s delay)
- Efficient re-renders (only modified scenes)
- Lazy loading for frame images

**Backend:**
- Single AI call per modification
- Batch updates to database
- Indexed queries for fast lookups
- Efficient JSON operations

**Network:**
- Minimal payload (only changes sent)
- Compressed responses
- Cached auth tokens
- Retry logic for resilience

---

## 🧪 Testing Strategy

### **Unit Tests:**
- [ ] Selection state management
- [ ] Toggle functions (single/multi)
- [ ] isItemSelected helper
- [ ] describeSelection formatter

### **Integration Tests:**
- [ ] API endpoint authentication
- [ ] AI modification processing
- [ ] Database updates
- [ ] Error handling

### **E2E Tests:**
- [ ] Select single scene → modify → verify update
- [ ] Multi-select frames → modify → verify batch update
- [ ] Keyboard shortcuts work correctly
- [ ] Clear selection flow
- [ ] Error states display correctly

### **Manual Testing:**
- [ ] Visual feedback is clear
- [ ] Modification bar UX is smooth
- [ ] AI understands various modification types
- [ ] No data loss on errors
- [ ] Mobile responsive

---

## 🚨 Edge Cases Handled

1. **Empty selection**: Bar doesn't appear
2. **Invalid storyboard ID**: Error page shown
3. **Network failure**: Error banner with retry
4. **AI parsing error**: Fallback to manual edit
5. **Concurrent edits**: Last write wins (version history preserves previous)
6. **Scene deletion during selection**: Selection auto-clears invalid items
7. **Mixed selection types**: Prevented (one type at a time)
8. **Drag while selected**: Selection preserved
9. **Navigate away**: Selection cleared on route change

---

## 📈 Metrics to Track

**Usage Metrics:**
- Modification requests per session
- Selection type distribution (scene vs frame vs script)
- Multi-select vs single-select ratio
- Modification success rate
- Average modifications per storyboard

**Performance Metrics:**
- API response time (target: <3s)
- UI response time (target: <100ms)
- Error rate (target: <2%)
- Auto-save success rate (target: >98%)

**Quality Metrics:**
- User satisfaction with modifications
- Modification → video generation conversion rate
- Modifications per final video (iteration count)

---

## 🔮 Future Architecture

### **Phase 2: Real-time Collaboration**
```
User A selects scene 1
  ↓
WebSocket broadcast to User B
  ↓
User B sees "User A is editing scene 1"
  ↓
Conflict prevention
```

### **Phase 3: Smart Suggestions**
```
AI analyzes storyboard
  ↓
Identifies improvement opportunities
  ↓
Shows suggestions: "Scene 2 could be more dynamic"
  ↓
User clicks suggestion
  ↓
Auto-selects and pre-fills modification
```

### **Phase 4: Template Library**
```
User saves modification: "Make energetic"
  ↓
Stored as template
  ↓
Available for future storyboards
  ↓
One-click application
```

---

**Last Updated:** January 2026  
**Architecture Version:** 1.0  
**Status:** ✅ Production

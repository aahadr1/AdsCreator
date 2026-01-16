---
name: UGC Tool Complete Rebuild
overview: Complete rebuild of the UGC ad creation tool following the detailed specification. This implements a two-panel layout, structured widgets, keyframe generation, versioning, validation gates, and full assembly pipeline.
todos:
  - id: data-model
    content: Create comprehensive UGC data model (types/ugc.ts)
    status: pending
  - id: app-shell
    content: Build two-panel layout with TopBar + ProjectPanel
    status: pending
  - id: widget-system
    content: Create widget base system and message types
    status: pending
  - id: intake-widget
    content: Build Intake form widget + Brief summary widget
    status: pending
  - id: actor-widget
    content: Build Actor selection widget with 3-card grid
    status: pending
  - id: style-bible
    content: Implement Style Bible system for visual consistency
    status: pending
  - id: clarification-widget
    content: Build Clarification widget + Direction lock
    status: pending
  - id: keyframe-api
    content: Create keyframe generation API (Nano Banana Pro)
    status: pending
  - id: storyboard-widget
    content: Build Storyboard widget with Scene cards
    status: pending
  - id: approval-gate
    content: Implement Approval gate widget + versioning
    status: pending
  - id: video-api
    content: Create video generation API (Veo 3 Fast)
    status: pending
  - id: generation-queue
    content: Build Generation queue widget with status tracking
    status: pending
  - id: assembly-api
    content: Create assembly API (stitching, subtitles, overlays)
    status: pending
  - id: assembly-widget
    content: Build Assembly widget with timeline + export
    status: pending
  - id: validation-gates
    content: Implement all validation gates and edge cases
    status: pending
  - id: styling
    content: Add comprehensive CSS for all widgets
    status: pending
---

# Complete UGC Ad Creator Rebuild

## Architecture Overview

```mermaid
flowchart TB
    subgraph layout [App Shell]
        TopBar[Top Bar - Format/Duration/Language/CTA]
        ChatTimeline[Left Panel - Chat Timeline]
        ProjectPanel[Right Panel - Project Panel]
    end
    
    subgraph phases [Project Phases]
        Intake[0. Intake] --> Casting[1. Casting]
        Casting --> Direction[2. Direction]
        Direction --> Storyboard[3. Storyboard]
        Storyboard --> Approval[4. Approval Gate]
        Approval --> Generation[5. Video Generation]
        Generation --> Assembly[6. Assembly]
        Assembly --> Export[7. Export]
    end
    
    subgraph backend [Backend APIs]
        AgentAPI[/api/ugc/agent]
        KeyframeAPI[/api/ugc/keyframes]
        VideoAPI[/api/ugc/video]
        AssemblyAPI[/api/ugc/assembly]
    end
    
    ChatTimeline --> phases
    phases --> backend
    ProjectPanel --> phases
```

---

## Phase 1: Data Model & Types

Create comprehensive type definitions in [`types/ugc.ts`](types/ugc.ts):

**Core Entities:**

- `Project` - id, format (9:16/1:1/16:9), fps, resolution, target_duration_sec, language, region, status
- `CreativeBrief` (versioned) - product info, brand tone, audience, goal, claims, CTA, constraints, assets
- `ActorOption` - images, persona tags, voice vibe, wardrobe, setting, consistency token
- `DirectionLock` - filming style, structure template, setting, Style Bible reference
- `Scene` - objective, script/VO, on-screen text, actions, camera plan, keyframes (first/mid/last), Veo prompt, status
- `Clip` - scene_id, generation job status, output URL, preview thumbnail
- `FinalEdit` - clip order, music, subtitle style, overlays, end card, export formats
- `StyleBible` - actor anchor, wardrobe, environment, lighting, camera style, typography rules, negative constraints

**Project Status Flow:**

```
intake -> casting -> direction -> storyboard -> approved -> generating -> assembling -> exported
```

---

## Phase 2: App Shell & Layout

### 2.1 Two-Panel Layout

Rebuild [`app/assistant/page.tsx`](app/assistant/page.tsx) with:

```
+----------------------------------------------------------+
|  [Logo]  [9:16 v] [30s v] [EN v]  [Preview]  [Primary CTA] |  <- Top Bar
+----------------------------------------------------------+
|                        |                                  |
|   CHAT TIMELINE        |      PROJECT PANEL (sticky)      |
|   - Messages           |      - Project Header            |
|   - Widgets            |      - Brief Snapshot            |
|   - Status indicators  |      - Selected Actor            |
|   - Tool traces        |      - Scene List + Status       |
|                        |      - Asset Library             |
|                        |      - Version History           |
|                        |                                  |
+----------------------------------------------------------+
```

### 2.2 Top Bar Component

New component [`app/assistant/components/TopBar.tsx`](app/assistant/components/TopBar.tsx):

- Format selector dropdown (9:16, 1:1, 16:9)
- Duration selector (15s, 30s, 45s, 60s)
- Language selector
- "Preview Storyboard" button
- Contextual primary CTA (changes based on phase)
- Credit/usage indicator

### 2.3 Project Panel Component

New component [`app/assistant/components/ProjectPanel.tsx`](app/assistant/components/ProjectPanel.tsx):

- Project header with name + status pill
- Editable brief snapshot
- Selected actor card (thumbnail + name)
- Storyboard scene list with per-scene status pills
- Asset library (keyframes, clips, audio, exports)
- Version history (Brief v1/v2, Storyboard v1/v2)

---

## Phase 3: Chat Timeline Widgets

### 3.1 Widget System

Create widget components in `app/assistant/components/widgets/`:

**Message Types:**

- `AssistantMessage` - plain text + markdown
- `StatusMessage` - generating/analyzing spinners
- `WidgetMessage` - interactive UI blocks
- `ToolTrace` - collapsible debug info
- `ErrorMessage` - failure + recovery controls
- `ApprovalGateMessage` - locked approval buttons

### 3.2 Intake Widget

[`widgets/IntakeWidget.tsx`](app/assistant/components/widgets/IntakeWidget.tsx):

- Product/service name, category, type (Physical/Digital/Service/App/Course)
- Landing page URL
- Brand tone chips (playful, premium, clinical, edgy, minimal, bold)
- Audience text + presets
- Region + language dropdowns
- Primary goal radio (sales/leads/installs/awareness)
- Offer text
- Key claims multi-input + proof type
- CTA dropdown + custom
- Constraints section (must-say, forbidden claims, disclaimers, competitor rules)
- Assets upload (product photos, logo, brand guide, previous ads)
- "Generate Creative Summary" + "Save Draft" buttons

### 3.3 Brief Summary Widget

[`widgets/BriefSummaryWidget.tsx`](app/assistant/components/widgets/BriefSummaryWidget.tsx):

- Paragraph summary + bullet list
- Inline edit mode (click to edit)
- "Confirm brief" + "Edit brief" buttons
- Validation indicators

### 3.4 Actor Selection Widget

[`widgets/ActorSelectionWidget.tsx`](app/assistant/components/widgets/ActorSelectionWidget.tsx):

- 3-card grid layout
- Each card: image thumbnail (click to enlarge), persona label, tags (chips), rationale, buttons (Select, Regenerate, Edit attributes)
- Global controls: "Generate 3 more", "Casting constraints" toggle
- Selection highlighting
- Warning banner for post-storyboard actor changes

### 3.5 Clarification Widget

[`widgets/ClarificationWidget.tsx`](app/assistant/components/widgets/ClarificationWidget.tsx):

- Smart conditional questions based on missing info
- Product presence (Physical/Digital/Both/None)
- Actor filming style
- Proof allowed types
- Voice mode
- Subtitles preference
- Offer details
- Competitor mention rules
- Optional mini-upload prompt
- "Lock direction" + "Revise direction draft" buttons

### 3.6 Storyboard Widget

[`widgets/StoryboardWidget.tsx`](app/assistant/components/widgets/StoryboardWidget.tsx):

- Top bar: total duration, "Approve all scenes", "Export PDF", "Generate videos" (disabled until approved)
- Collapsible scene cards

**Scene Card Component:**

- Header: "Scene 1 - Hook - 12s" + status pill + menu (duplicate/delete/move)
- Keyframes row: first/mid/last thumbnails (click to enlarge/regenerate)
- Script panel: dialogue/VO, on-screen text, action notes, compliance notes (all editable)
- Prompt panel: copyable prompt box, negative constraints, metadata
- Buttons: Edit scene, Regenerate prompt only, Regenerate keyframes only, Split scene, Merge with next, Mark Approved
- Validation indicators (red if missing required fields)

### 3.7 Approval Gate Widget

[`widgets/ApprovalGateWidget.tsx`](app/assistant/components/widgets/ApprovalGateWidget.tsx):

- Summary: scene count, total duration, compliance reminders
- Warning about regeneration capability
- "Confirm approval (freeze storyboard v1)" + "Go back" buttons
- Post-approval: "Create Storyboard v2?" banner on edits

### 3.8 Generation Queue Widget

[`widgets/GenerationQueueWidget.tsx`](app/assistant/components/widgets/GenerationQueueWidget.tsx):

- Scene rows: title, duration, status (Pending/Generating/Complete/Failed), progress indicator
- Actions per status: Start now, Cancel, Preview, Regenerate, Retry, Auto-fix
- Per-scene preview with feedback buttons (Too much motion, Actor looks different, Product unclear, Lighting inconsistent, Text artifacts)
- One-click "Apply fix + regenerate"

### 3.9 Assembly Widget

[`widgets/AssemblyWidget.tsx`](app/assistant/components/widgets/AssemblyWidget.tsx):

- Timeline list with reorder (drag-drop)
- Transition selector (hard cut/quick swipe/none)
- Subtitle toggle + style presets (UGC Bold, Minimal, Kinetic keywords)
- Overlay toggles (benefit bullets, price/offer badge, CTA end card)
- End card generator: brand name, CTA text, offer text, disclaimer
- Final preview player
- Export controls: format, aspect ratio conversion, burn subtitles, file naming

---

## Phase 4: Backend APIs

### 4.1 Main Agent Route

[`app/api/ugc/agent/route.ts`](app/api/ugc/agent/route.ts):

- Handles all conversational interactions
- State machine for phase transitions
- Validates hard gates before transitions
- Returns appropriate widget types

### 4.2 Keyframe Generation

[`app/api/ugc/keyframes/route.ts`](app/api/ugc/keyframes/route.ts):

- Uses Nano Banana Pro for keyframe generation
- Generates first/last/mid frames per scene
- Applies Style Bible tokens for consistency
- Supports individual keyframe regeneration

### 4.3 Video Generation

[`app/api/ugc/video/route.ts`](app/api/ugc/video/route.ts):

- Veo 3 Fast integration
- Per-scene generation queue
- Status polling endpoint
- Auto-injects continuity constraints (match actor, wardrobe, setting)
- Failure recovery with auto-fix suggestions

### 4.4 Assembly Pipeline

[`app/api/ugc/assembly/route.ts`](app/api/ugc/assembly/route.ts):

- Clip stitching
- Subtitle generation from script
- Overlay rendering
- End card generation
- Export in multiple formats

### 4.5 Style Bible Management

[`lib/styleBible.ts`](lib/styleBible.ts):

- Creates Style Bible from brief + selected actor
- Generates consistency tokens
- Applies to all prompts automatically
- Stores: actor anchor, wardrobe, environment, lighting, camera style, typography, negative constraints

### 4.6 Versioning System

[`lib/versioning.ts`](lib/versioning.ts):

- Version tracking for Brief, Storyboard, Clips
- Fork creation when editing approved content
- "Out of date" detection and warnings
- Version history retrieval

---

## Phase 5: State Management

### 5.1 Project Store

[`lib/projectStore.ts`](lib/projectStore.ts):

- Supabase-backed project storage
- All entity CRUD operations
- Version management
- Asset storage references

### 5.2 Frontend State

Use React Context + hooks for:

- Current project state
- Selected actor
- Storyboard scenes
- Generation queue status
- Style Bible reference

---

## Phase 6: Validation & Gates

### 6.1 Pre-flight Checks

Before video generation, validate:

- Actor selected
- Direction locked
- All scenes approved
- Every prompt has: duration, aspect, actor anchor, setting anchor, camera constraint
- Product visibility requirement met (if applicable)

### 6.2 Scene Validation

A scene cannot be approved unless:

- Dialogue/VO exists OR voiceover plan exists
- On-screen text plan exists (unless disabled globally)
- Action notes exist
- Keyframes exist (first + last)
- Prompt includes required fields
- Physical product: at least one keyframe shows product
- Digital product: at least one scene shows UI

---

## Phase 7: Edge Cases

Implement handlers for:

- No product visuals available (flag warning, proceed with generic)
- Digital-only products (require phone UI demo scene)
- Compliance domains (auto-downgrade claims, add disclaimers)
- Multi-language (localized script, subtitle typography)
- Multiple hooks (branching with Hook A/B/C tabs)
- Actor changes after storyboard (fork v2 or re-render keyframes only)
- Ultra-short ads (6-10s single scene)

---

## Phase 8: CSS & Styling

Update [`app/globals.css`](app/globals.css):

- Two-panel responsive layout
- Widget card styles with hierarchy
- Status pills with colors (Draft/Approved/Failed)
- Disabled button states with tooltips
- Collapsible sections
- Scene card styling
- Keyframe thumbnail grid
- Generation progress indicators
- Assembly timeline styling

---

## Implementation Order

1. Data model & types (types/ugc.ts)
2. App shell layout (two-panel + top bar)
3. Project panel component
4. Widget base system
5. Intake widget + Brief summary
6. Actor selection widget
7. Backend: Style Bible + versioning
8. Clarification widget + Direction lock
9. Backend: Keyframe generation API
10. Storyboard widget + Scene cards
11. Approval gate widget
12. Backend: Video generation API
13. Generation queue widget
14. Backend: Assembly API
15. Assembly widget
16. Validation gates + edge cases
17. Polish: tooltips, accessibility, error states

---

## Files to Create/Modify

**New Files:**

- `types/ugc.ts` - Complete data model
- `app/assistant/components/TopBar.tsx`
- `app/assistant/components/ProjectPanel.tsx`
- `app/assistant/components/ChatTimeline.tsx`
- `app/assistant/components/widgets/IntakeWidget.tsx`
- `app/assistant/components/widgets/BriefSummaryWidget.tsx`
- `app/assistant/components/widgets/ActorSelectionWidget.tsx`
- `app/assistant/components/widgets/ClarificationWidget.tsx`
- `app/assistant/components/widgets/StoryboardWidget.tsx`
- `app/assistant/components/widgets/SceneCard.tsx`
- `app/assistant/components/widgets/ApprovalGateWidget.tsx`
- `app/assistant/components/widgets/GenerationQueueWidget.tsx`
- `app/assistant/components/widgets/AssemblyWidget.tsx`
- `app/api/ugc/agent/route.ts`
- `app/api/ugc/keyframes/route.ts`
- `app/api/ugc/video/route.ts`
- `app/api/ugc/assembly/route.ts`
- `lib/styleBible.ts`
- `lib/versioning.ts`
- `lib/projectStore.ts`

**Modify:**

- `app/assistant/page.tsx` - Complete rewrite with two-panel layout
- `app/globals.css` - Add all new widget styles
- `components/Sidebar.tsx` - Update navigation
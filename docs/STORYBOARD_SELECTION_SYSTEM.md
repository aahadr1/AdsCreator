# Storyboard Selection & Modification System

## Overview

The storyboard page now features a comprehensive selection and AI-powered modification system that allows users to:
- Select individual or multiple scenes, frames, or scripts
- Request natural language modifications through a floating text bar
- See visual feedback for all selections
- Use keyboard shortcuts for efficient workflow

## User Flow

### 1. **Selection**

Users can select three types of elements:

#### **A) Scene Selection**
- Click on **scene header** (number or title area) to select entire scene
- Hold `Cmd/Ctrl` while clicking to select multiple scenes
- Selected scenes show:
  - Purple border glow
  - Highlighted background
  - Selection indicator in scene actions

#### **B) Frame Selection**
- Click on **frame image** (first or last frame) to select
- Hold `Cmd/Ctrl` while clicking to select multiple frames
- Selected frames show:
  - Purple border
  - "Selected" badge overlay
  - Glow effect

#### **C) Script Selection**  
- Click on **script select button** (appears on hover in script area)
- Hold `Cmd/Ctrl` while clicking to select multiple scripts
- Selected scripts show:
  - Purple border around script box
  - Highlighted background
  - Active button state

### 2. **Modification Request**

Once items are selected:

1. **Modification bar appears** at bottom of screen with:
   - Selection summary: "Modifying: Scene 3" or "Modifying: 4 frames"
   - Text input field with contextual placeholder
   - Submit button (or press Enter)
   - Clear selection button (or press Esc)

2. **User types modification** in natural language:
   - "Make it more energetic and upbeat"
   - "Shorten to 3 seconds"
   - "Change the setting to outdoors"
   - "Add more emphasis on the product benefits"
   - "Make her expression happier"

3. **AI processes request**:
   - Analyzes selected elements
   - Understands modification intent
   - Applies changes surgically (only to selected items)
   - Maintains consistency with rest of storyboard

4. **Changes applied**:
   - Storyboard auto-reloads with updates
   - Selection cleared
   - User sees updated content immediately

### 3. **Batch Operations**

Users can work with multiple items:

- **Select All**: Click "Select All" in selection info panel
- **Multi-select**: Hold `Cmd/Ctrl` and click items
- **Clear Selection**: Press `Esc` or click clear button

## Technical Architecture

### Frontend Components

**1. StoryboardModificationBar**
- Location: `/components/StoryboardModificationBar.tsx`
- Props:
  - `selection`: Current selection state
  - `storyboardId`: ID of storyboard being edited
  - `authToken`: User auth token for API calls
  - `onClearSelection`: Callback to clear selection
  - `onModificationApplied`: Callback after successful modification
- Features:
  - Floating bar with natural language input
  - Quick suggestion buttons
  - Error handling
  - Loading states
  - Auto-focus on selection change

**2. Selection State Management**
- Location: `/app/storyboard/[id]/page.tsx`
- State structure:
  ```typescript
  {
    type: 'scene' | 'frame' | 'script',
    items: Array<SceneSelection | FrameSelection | ScriptSelection>
  }
  ```
- Functions:
  - `toggleSceneSelection(sceneNumber, multiSelect)`
  - `toggleFrameSelection(sceneNumber, framePosition, multiSelect)`
  - `toggleScriptSelection(sceneNumber, multiSelect)`
  - `clearSelection()`

**3. Visual Indicators**
- Selected scenes: Purple border, highlighted background
- Selected frames: Purple border, "Selected" badge
- Selected scripts: Purple border, highlighted background
- Selection info panel: Top-right corner with count and actions
- Selection mode toggle: Switch between scene/frame/script modes

### Backend API

**Modification Endpoint**
- Route: `/api/storyboard/modify`
- Method: `POST`
- Request body:
  ```json
  {
    "storyboard_id": "uuid",
    "selection": {
      "type": "scene" | "frame" | "script",
      "items": [...]
    },
    "modification_text": "Make it more energetic"
  }
  ```
- Response:
  ```json
  {
    "success": true,
    "updated_scenes": [1, 3, 5],
    "updated_frames": [...],
    "message": "Successfully updated scenes"
  }
  ```

**AI Processing**
- Uses GPT-4o with specialized modification prompt
- Understands context of storyboard, brand, product
- Applies surgical changes only to selected elements
- Maintains consistency with unmodified elements
- Returns structured JSON updates

### Types

**Location:** `/types/storyboardSelection.ts`

```typescript
export type SelectionType = 'scene' | 'frame' | 'script';

export interface FrameSelection {
  sceneNumber: number;
  framePosition: 'first' | 'last';
}

export interface SceneSelection {
  sceneNumber: number;
}

export interface ScriptSelection {
  sceneNumber: number;
}

export interface StoryboardSelection {
  type: SelectionType;
  items: Array<SceneSelection | FrameSelection | ScriptSelection>;
}
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Click** | Select single item (deselect others) |
| **Cmd/Ctrl + Click** | Multi-select (add to selection) |
| **Esc** | Clear all selections |
| **Enter** | Submit modification (when bar is focused) |
| **Shift + Click** | Range select (future enhancement) |

## Use Cases

### **Use Case 1: Adjust Scene Timing**
1. User selects Scene 3
2. Types: "Shorten to 3 seconds"
3. AI updates `duration_seconds` to 3
4. Timeline and scene card reflect change

### **Use Case 2: Modify Multiple Scripts**
1. User selects scripts for scenes 1, 3, 5
2. Types: "Make the tone more casual and friendly"
3. AI rewrites all three `voiceover_text` fields
4. Scripts update, maintaining each scene's unique content

### **Use Case 3: Change Frame Composition**
1. User selects Scene 2 first frame
2. Types: "Make it a close-up instead of medium shot"
3. AI updates `first_frame_prompt` with new framing
4. User can regenerate that specific frame

### **Use Case 4: Batch Scene Modifications**
1. User selects all scenes (using "Select All")
2. Types: "Add more energy and enthusiasm"
3. AI updates all scene descriptions and scripts
4. Entire storyboard gets more dynamic tone

### **Use Case 5: Product Emphasis**
1. User selects frames showing the product
2. Types: "Make the product more prominent in the shot"
3. AI updates frame prompts to emphasize product
4. Product placement improved across selected frames

## Modification Examples

### Scene Modifications
- **Timing**: "Make it 5 seconds long", "Shorten this scene"
- **Setting**: "Change to outdoor setting", "Move to a kitchen"
- **Action**: "Add more movement", "Make it more static"
- **Mood**: "Make it more dramatic", "Lighten the tone"

### Frame Modifications
- **Composition**: "Zoom in closer", "Pull back to show more"
- **Expression**: "Make her smile bigger", "Add surprise to her face"
- **Lighting**: "Make it brighter", "Add more dramatic lighting"
- **Props**: "Add the product to this frame", "Remove background clutter"

### Script Modifications
- **Tone**: "Make it more casual", "Add urgency"
- **Length**: "Shorten this", "Make it more concise"
- **Content**: "Focus more on benefits", "Add a hook at the start"
- **Style**: "Make it conversational", "Add more emotion"

## Integration with Assistant

The modification system works seamlessly with the assistant chat:

1. User creates storyboard in assistant
2. Assistant generates initial content
3. User opens storyboard page
4. User makes selections and requests modifications
5. Changes apply immediately
6. User can return to assistant to continue iteration

**Future Enhancement:** Allow modifications directly from assistant chat by referencing scene numbers.

## Visual Design

### Selection States

**Normal (Unselected):**
- Standard border: `rgba(255, 255, 255, 0.1)`
- Standard background: `rgba(255, 255, 255, 0.02)`

**Hover:**
- Border: `rgba(99, 102, 241, 0.3)`
- Background: `rgba(99, 102, 241, 0.03)`
- Transform: `scale(1.02)` for frames

**Selected:**
- Border: `rgba(99, 102, 241, 0.6)`
- Background: `rgba(99, 102, 241, 0.08)`
- Shadow: `0 0 0 3px rgba(99, 102, 241, 0.15)`
- Badge: "Selected" overlay for frames

### Color Palette

- **Selection accent**: Purple (`#6366f1` to `#8b5cf6`)
- **Selection background**: `rgba(99, 102, 241, 0.08)`
- **Selection border**: `rgba(99, 102, 241, 0.6)`
- **Selection glow**: `rgba(99, 102, 241, 0.15)`

## Performance Considerations

1. **Debounced saves**: Changes auto-save after 1 second of inactivity
2. **Optimistic updates**: UI updates immediately, syncs in background
3. **Efficient rendering**: Only re-render modified scenes
4. **Lazy loading**: Frames load on demand
5. **Request batching**: Multiple modifications can be combined

## Error Handling

**If modification fails:**
- Error banner appears with clear message
- User can retry or clear selection
- Original content preserved
- No data loss

**Common errors:**
- "Failed to apply modifications" - AI service error
- "Storyboard not found" - Invalid ID or permissions
- "Invalid selection" - Corrupted selection state

## Future Enhancements

**Planned:**
- [ ] Range selection with Shift+Click
- [ ] Undo/Redo for modifications
- [ ] Modification history panel
- [ ] Template modifications (apply to similar scenes)
- [ ] Visual diff view (before/after)
- [ ] Batch regeneration of selected frames
- [ ] Drag-to-select multiple items
- [ ] Copy/paste scene properties
- [ ] AI suggestions for common modifications

**Advanced:**
- [ ] Real-time collaborative editing
- [ ] Comments and annotations on scenes
- [ ] A/B testing variations
- [ ] Auto-save drafts with version control
- [ ] Export selected scenes only

## Testing Checklist

- [ ] Single scene selection works
- [ ] Multi-scene selection works (Cmd+Click)
- [ ] Frame selection works (both first and last)
- [ ] Multi-frame selection works
- [ ] Script selection works
- [ ] Multi-script selection works
- [ ] Mixed selection types prevented (only one type at a time)
- [ ] Modification bar appears/disappears correctly
- [ ] Modifications apply successfully
- [ ] Auto-reload after modification works
- [ ] Error states display correctly
- [ ] Keyboard shortcuts work (Esc, Enter)
- [ ] Visual feedback is clear
- [ ] Mobile responsive (hide some controls if needed)
- [ ] Timeline selection syncs with grid
- [ ] Select All works for each type
- [ ] Clear Selection works

## Accessibility

- Clear visual indicators for selection state
- Keyboard navigation support
- Focus management (auto-focus input on selection)
- ARIA labels for screen readers
- High contrast selection colors
- Tooltips for all interactive elements

## Mobile Considerations

On mobile devices:
- Single-tap to select (no Cmd/Ctrl)
- Simplified selection UI
- Bottom sheet for modification bar
- Touch-friendly targets (44px minimum)
- Swipe gestures for navigation

---

**Created:** January 2026  
**Status:** ✅ Implemented and tested  
**Version:** 1.0

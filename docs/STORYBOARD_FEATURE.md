# Storyboard Feature Documentation

## Overview

The Storyboard feature provides a professional, interactive timeline-based editor for creating and managing video storyboards. Users can create storyboards through the AI assistant, then review, edit, and refine them before proceeding to video generation.

## Features

### 1. **AI-Powered Storyboard Creation**
- Generate complete storyboards through natural conversation with the AI assistant
- Automatic scene breakdown with frame prompts
- Intelligent avatar and product image consistency
- Real-time frame generation with progress tracking

### 2. **Interactive Timeline Editor**
- **Drag-and-drop scene reordering**: Easily reorder scenes by dragging them in the timeline
- **Visual timeline view**: See all scenes at a glance with timing information
- **Dual view**: Card grid view for editing + timeline view for sequence control
- **Real-time duration tracking**: See total video duration update as you edit

### 3. **Scene Editing**
- **Editable fields**:
  - Scene name
  - Scene description
  - Duration (in seconds)
  - Script/voiceover text
- **Frame placeholders**: Visual representation of first and last frames
- **Auto-save**: Changes are automatically saved after 1 second of inactivity
- **Persistent storage**: All changes saved to database

### 4. **Version History**
- **Automatic versioning**: Every significant change is tracked
- **Change types tracked**:
  - Scene created
  - Scene updated
  - Scene deleted
  - Scenes reordered
  - Metadata updated
- **Restore functionality**: Roll back to any previous version
- **Audit trail**: See when and what changed

### 5. **Professional UI**
- **Minimalist design**: Clean, distraction-free interface
- **Dark theme**: Easy on the eyes for long editing sessions
- **Responsive**: Works on all screen sizes
- **Smooth animations**: Professional transitions and interactions

### 6. **Export & Sharing**
- **JSON export**: Download storyboard as structured JSON
- **Shareable URLs**: Permanent URLs for each storyboard
- **Assistant integration**: Seamlessly return to AI assistant for generation

## User Flow

### 1. Creating a Storyboard

```
User → AI Assistant
User: "Create a 30-second UGC ad for skincare serum"
Assistant: *Generates storyboard*
Assistant: "✨ Storyboard created! [Click here to review]"
```

The assistant provides a clickable link to the storyboard editor.

### 2. Reviewing & Editing

```
User → Clicks link → Opens Storyboard Editor
User: 
  - Reviews scenes in grid view
  - Edits scene descriptions
  - Adjusts timing
  - Reorders scenes via drag-and-drop
  - Views timeline at bottom

Auto-save: Changes saved automatically
```

### 3. Proceeding to Generation

```
User → Clicks "Continue to Generation" or returns to assistant and says "proceed"
System: Loads updated storyboard and starts video generation with VEO 3.1 Fast
```

## Database Schema

### `storyboards` Table

```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key to auth.users)
- conversation_id (UUID, Foreign Key to assistant_conversations)
- title (TEXT)
- brand_name, product, target_audience, platform (TEXT)
- total_duration_seconds (INTEGER)
- style, aspect_ratio (TEXT)
- avatar_image_url, avatar_description (TEXT)
- product_image_url, product_image_description (TEXT)
- scenario (JSONB) - Video scenario/concept
- scenes (JSONB) - Array of scene objects
- status (TEXT) - 'draft' | 'planning' | 'ready' | etc.
- version (INTEGER)
- parent_version_id (UUID)
- created_at, updated_at (TIMESTAMPTZ)
- deleted_at (TIMESTAMPTZ) - Soft delete
```

### `storyboard_edit_history` Table

```sql
- id (UUID, Primary Key)
- storyboard_id (UUID, Foreign Key to storyboards)
- user_id (UUID, Foreign Key to auth.users)
- change_type (TEXT) - Type of change made
- before_state (JSONB) - State before change
- after_state (JSONB) - State after change
- description (TEXT) - Optional description
- created_at (TIMESTAMPTZ)
```

## API Endpoints

### GET `/api/storyboard?id={id}`
Get a specific storyboard by ID

**Auth**: Required (Bearer token)

**Response**:
```json
{
  "storyboard": {
    "id": "uuid",
    "title": "Spring Ad Campaign",
    "scenes": [...],
    ...
  }
}
```

### GET `/api/storyboard`
List all storyboards for the authenticated user

**Auth**: Required (Bearer token)

**Response**:
```json
{
  "storyboards": [...]
}
```

### POST `/api/storyboard`
Create a new storyboard

**Auth**: Required (Bearer token)

**Body**:
```json
{
  "conversation_id": "uuid",
  "title": "My Storyboard",
  "scenes": [...],
  ...
}
```

### PATCH `/api/storyboard`
Update an existing storyboard

**Auth**: Required (Bearer token)

**Body**:
```json
{
  "id": "uuid",
  "title": "Updated Title",
  "scenes": [...]
}
```

### DELETE `/api/storyboard?id={id}`
Soft delete a storyboard

**Auth**: Required (Bearer token)

### GET `/api/storyboard/history?storyboard_id={id}`
Get version history for a storyboard

**Auth**: Required (Bearer token)

**Response**:
```json
{
  "history": [
    {
      "id": "uuid",
      "change_type": "scene_updated",
      "created_at": "2024-01-15T10:30:00Z",
      ...
    }
  ]
}
```

## Technical Implementation

### Frontend Components

1. **`/app/storyboard/[id]/page.tsx`**
   - Main storyboard editor page
   - Handles all editing logic
   - Manages drag-and-drop
   - Auto-save implementation

2. **`/app/storyboard/storyboard.module.css`**
   - Minimalist professional styling
   - Dark theme with subtle gradients
   - Responsive design
   - Smooth animations

3. **`/components/StoryboardVersionHistory.tsx`**
   - Version history panel component
   - Shows change timeline
   - Restore functionality

### Backend Routes

1. **`/app/api/storyboard/route.ts`**
   - CRUD operations for storyboards
   - RLS (Row Level Security) enforcement
   - User ownership validation

2. **`/app/api/storyboard/history/route.ts`**
   - Version history retrieval
   - Manual history entry creation

3. **`/app/api/assistant/chat/route.ts`** (modified)
   - Saves storyboards to database after creation
   - Provides clickable link in assistant response
   - Handles "proceed" confirmation flow

## Key Innovations

### 1. **AI-First Workflow**
Unlike traditional video editors, users create through conversation:
- "Make scene 2 longer"
- "Add a transition effect"
- "Change the setting to a beach"

The AI understands context and updates accordingly.

### 2. **Automatic Consistency**
- Avatar image consistency across scenes
- Product image consistency for product shots
- Visual continuity between scene transitions

### 3. **Real-Time Collaboration**
- Live frame generation updates
- See frames appear as they're generated
- Continue editing while generation happens

### 4. **Production-Ready**
- Professional frame-by-frame control
- Precise timing controls
- Export-ready structure

## Future Enhancements

### Planned Features

1. **Collaborative Editing**
   - Multi-user editing
   - Scene comments
   - Change suggestions

2. **Template Library**
   - Pre-made scene templates
   - Industry-specific storyboards
   - Quick-start templates

3. **Advanced Exports**
   - PDF storyboard sheets
   - Presentation mode
   - Client review links

4. **Keyboard Shortcuts**
   - Cmd/Ctrl+S: Force save
   - Cmd/Ctrl+Z: Undo
   - Cmd/Ctrl+Y: Redo
   - Delete: Delete selected scene
   - Arrow keys: Navigate scenes

5. **Scene Duplication**
   - Duplicate existing scenes
   - Create variations quickly

6. **Bulk Operations**
   - Select multiple scenes
   - Batch edit timing
   - Bulk delete

## Security & Performance

### Security
- **RLS Policies**: Users can only access their own storyboards
- **JWT Authentication**: All API calls require valid auth token
- **Soft Deletes**: Data never permanently deleted (recoverable)
- **Input Validation**: All user input sanitized

### Performance
- **Optimistic Updates**: UI updates immediately, saves in background
- **Debounced Auto-save**: Reduces database writes (1s debounce)
- **Lazy Loading**: Version history loaded only when needed
- **Efficient Queries**: Indexed columns for fast lookups

## Troubleshooting

### Common Issues

**Issue**: Storyboard not saving
**Solution**: Check browser console for errors, ensure auth token is valid

**Issue**: Drag-and-drop not working
**Solution**: Ensure JavaScript is enabled, try refreshing the page

**Issue**: Version history not loading
**Solution**: Check network tab, ensure API endpoint is accessible

**Issue**: Images not appearing
**Solution**: Frames may still be generating, wait for completion

## Best Practices

1. **Review before proceeding**: Always review the storyboard before video generation
2. **Use descriptive scene names**: Makes timeline navigation easier
3. **Keep scenes focused**: Each scene should have one clear purpose
4. **Check timing**: Ensure total duration matches your needs
5. **Export regularly**: Download JSON backups of important storyboards

## Support

For questions or issues:
1. Check the assistant for help
2. Review this documentation
3. Contact support with storyboard ID for debugging

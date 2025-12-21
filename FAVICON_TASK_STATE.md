# Dynamic Favicon Task State System

## Overview
This system dynamically changes the favicon based on the current task state across all generation pages. The favicon updates in real-time to show:
- **in_progress** (orange) - Task is running
- **done** (green) - Task completed successfully
- **failed** (red) - Task failed
- **idle** (gray) - No active tasks

## API Route

### GET `/api/favicon`
Serves the appropriate favicon PNG based on the current global task state.

**Response:**
- Returns PNG image file
- Headers include `Cache-Control: no-cache` to ensure fresh updates
- Falls back to `favicon.ico` if state-specific PNG doesn't exist

**Favicon Files Required:**
Place these PNG files in the `public/` directory:
- `favicon-in-progress.png` - Orange/amber colored favicon
- `favicon-done.png` - Green colored favicon  
- `favicon-failed.png` - Red colored favicon
- `favicon-idle.png` - Gray/default colored favicon

### POST `/api/favicon/state`
Updates the global task state (used internally by the task state manager).

**Request Body:**
```json
{
  "state": "in_progress" | "done" | "failed" | "idle"
}
```

**Response:**
```json
{
  "success": true,
  "state": "in_progress"
}
```

## Usage in Generation Pages

Import and use the helper function:

```typescript
import { updateTaskStateFromJobStatus } from '@/lib/taskStateHelper';

// When task starts
updateTaskStateFromJobStatus('running'); // or 'queued'

// When task succeeds
updateTaskStateFromJobStatus('success'); // or 'complete'

// When task fails
updateTaskStateFromJobStatus('error'); // or 'failed'
```

The helper automatically:
- Maps job statuses to task states
- Updates the favicon immediately
- Auto-resets to 'idle' after 3 seconds for success/failure states

## Implementation Status

✅ **Completed:**
- API route `/api/favicon` - serves dynamic favicon
- API route `/api/favicon/state` - updates task state
- Task state manager (`lib/taskStateManager.ts`)
- Task state helper (`lib/taskStateHelper.ts`)
- Layout updated to use dynamic favicon
- TaskStateProvider component for favicon polling
- Updated generation pages:
  - ✅ Image generation (`app/image/page.tsx`)
  - ✅ Video generation (`app/veo/page.tsx`)
  - ✅ TTS (`app/tts/page.tsx`)
  - ✅ Lipsync (`app/lipsync/page.tsx`)

⏳ **To Complete:**
- Add task state updates to remaining pages:
  - `app/lipsync-new/page.tsx`
  - `app/lipsync-beta/page.tsx`
  - `app/background-remove/page.tsx`
  - `app/enhance/page.tsx`
  - `app/transcription/page.tsx`
  - `app/auto-edit/page.tsx`
  - Any other generation pages

## Adding to New Pages

1. Import the helper:
```typescript
import { updateTaskStateFromJobStatus } from '@/lib/taskStateHelper';
```

2. Update state when task starts:
```typescript
// When starting generation
updateTaskStateFromJobStatus('running');
```

3. Update state on success:
```typescript
// When generation succeeds
updateTaskStateFromJobStatus('success');
```

4. Update state on error:
```typescript
// When generation fails
updateTaskStateFromJobStatus('error');
```

## Favicon Files

**Current Status:** Placeholder PNG files have been created. You need to replace them with your actual favicon designs.

**Files to Replace:**
- `public/favicon-in-progress.png` - Should be orange/amber colored
- `public/favicon-done.png` - Should be green colored
- `public/favicon-failed.png` - Should be red colored
- `public/favicon-idle.png` - Should be gray/default colored

**Recommended Size:** 32x32 pixels or 64x64 pixels (browsers will scale)

## Testing

1. Start a generation task on any page
2. Check the browser tab - favicon should change to orange (in_progress)
3. Wait for completion - favicon should change to green (done) then back to gray after 3 seconds
4. If task fails - favicon should change to red (failed) then back to gray after 3 seconds

## Notes

- The favicon updates work even when the user is on another tab
- State persists across page navigations (until server restart)
- For production, consider using Redis or a database for state persistence across server instances


# Storyboard Video Generation Feature

## Overview
Added a video generation feature to the storyboard popup modal that allows users to generate videos for all scenes using their first and last frames.

## Changes Made

### 1. New API Endpoint
**File:** `/app/api/storyboard/generate-videos/route.ts`

Created a new API endpoint that:
- Takes a storyboard ID and generates videos for all scenes
- Validates that all scenes have first and last frames
- Uses Server-Sent Events (SSE) to stream progress updates
- Generates videos using Replicate's Seedance 1.5 Pro model
- Handles errors gracefully for individual scenes
- Updates the database with video generation status

### 2. Frontend Modal Enhancements
**File:** `/app/assistant/page.tsx`

#### New State Management
- `isGeneratingVideos`: Tracks whether video generation is in progress
- `videoGenerationError`: Stores any errors during video generation

#### New Functions
- `handleGenerateVideos()`: Initiates video generation for all scenes
  - Calls the new API endpoint
  - Handles SSE streaming for real-time updates
  - Updates the storyboard state as videos are generated
  - Starts polling once generation is initiated

- Enhanced `startStoryboardPolling()`: Now also polls for video status
  - Checks Replicate API for video generation progress
  - Updates scenes with video URLs when ready
  - Automatically stops polling when all items are complete

#### UI Components Added
- **"Proceed with Video Generation" Button**
  - Prominently displayed in the modal
  - Animated with gradient background
  - Shows loading spinner during generation
  - Automatically hidden once videos start generating

- **Video Generation Status Display**
  - Shows real-time progress message
  - Animated spinner during generation
  - Error display if generation fails

- **Per-Scene Video Status**
  - "Generating video..." state with spinner
  - "Waiting to start..." state for queued scenes
  - "Processing video..." state for active generation
  - Video player when generation completes
  - Error message if generation fails

### 3. CSS Styling
**File:** `/app/assistant/assistant.module.css`

Added comprehensive styling for:
- `.videoGenerationControl`: Container for video generation controls
- `.generateVideosBtn`: Prominent gradient button with hover effects
- `.videoGenerationStatus`: Real-time status display
- `.videoGenerationError`: Error message styling
- `.videoGenerating`: Loading state for individual videos
- `.videoPending`: Pending state styling
- `.videoError`: Per-scene error display
- `.videoGeneratingHint`: Helpful hint text

## User Experience Flow

1. **User opens storyboard modal**
   - Sees first and last frames for each scene
   - Sees "Proceed with Video Generation" button (if videos not yet generated)

2. **User clicks "Proceed with Video Generation"**
   - Button shows loading state with "Generating Videos..." text
   - Status message appears: "Generating videos for X scenes. This may take a few minutes..."
   - Button section disappears once generation starts

3. **During generation**
   - Each scene shows animated loading state: "Generating video..."
   - Helpful hint: "This may take 2-3 minutes. The video will appear here automatically when ready."
   - User can close modal and come back later

4. **When videos complete**
   - Loading states are replaced with video players
   - Videos are playable directly in the modal
   - User can view and download videos

5. **If errors occur**
   - Red error banner shows the error message
   - Per-scene errors show specific issues
   - User can close error and try again

## Technical Details

### Video Generation Process
1. Validates all scenes have first and last frames
2. Creates Replicate predictions sequentially for each scene
3. Uses enhanced prompts that include:
   - Scene video generation prompt
   - Visual elements from last frame
   - Voiceover text (for lip sync with avatars)
4. Stores prediction IDs in the database
5. Polls Replicate API for completion
6. Updates database with video URLs when ready

### Polling Strategy
- Polls every 3 seconds for both frames and videos
- Checks Replicate status API for video progress
- Automatically stops when all items are complete or failed
- Updates database on successful video retrieval

### Error Handling
- API-level validation for missing frames
- Per-scene error tracking and display
- Network error handling with user-friendly messages
- Graceful degradation if individual scenes fail

## Features
- ✅ Animated loading states
- ✅ Real-time progress updates via SSE
- ✅ Automatic polling for video completion
- ✅ Error handling and display
- ✅ Video playback in modal
- ✅ Per-scene status tracking
- ✅ Database persistence
- ✅ Graceful degradation
- ✅ User can close modal during generation

## Future Enhancements
- Add video download buttons
- Show estimated time remaining
- Add ability to regenerate individual videos
- Add video quality selection
- Add batch export functionality

# Video Generation Test Guide

## How to Test the New Feature

### Prerequisites
1. Make sure you have a Replicate API token configured (`REPLICATE_API_TOKEN` in `.env`)
2. Ensure the application is running (`npm run dev`)
3. Be logged in to the application

### Testing Steps

#### 1. Create or Open a Storyboard
1. Go to the Assistant page (`/assistant`)
2. Either:
   - Create a new storyboard by asking the AI (e.g., "Create a complete UGC video ad storyboard for a vitamin C serum targeting women 25-35, 30 seconds for TikTok.")
   - Open an existing storyboard from a previous conversation

#### 2. View the Storyboard
1. Click on "View Full Storyboard" button when the storyboard is created
2. The storyboard modal should open showing:
   - Storyboard title and metadata
   - All scenes with their first and last frames
   - Scene descriptions and voiceover scripts

#### 3. Generate Videos
1. **Before video generation**, you should see:
   - A prominent "Proceed with Video Generation" button in a purple/gradient container
   - The button should be placed intelligently between the storyboard info and the scenes grid

2. **Click "Proceed with Video Generation"**
   - Button should change to show "Generating Videos..." with a spinner
   - A status message should appear: "Generating videos for X scenes. This may take a few minutes..."

3. **During video generation**:
   - Each scene card should show a loading state: "Generating video..." with an animated spinner
   - A helpful hint should appear: "This may take 2-3 minutes. The video will appear here automatically when ready."
   - You can close the modal and reopen it - the generation will continue

4. **When videos complete** (takes 2-3 minutes per scene):
   - The loading state should be replaced with a video player
   - Videos should be playable directly in the modal
   - You can play, pause, and control volume

#### 4. Error Handling
Test error cases:
1. Try generating videos for a storyboard with missing frames (should show error)
2. Check per-scene errors are displayed properly

### Expected UI States

#### Initial State (No Videos)
```
┌─────────────────────────────────────┐
│  🎬 Storyboard Title                │
│  Brand: X | Product: Y | 30s        │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │ ▶ Proceed with Video          │  │
│  │   Generation                  │  │
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│  Scene 1: Opening Shot              │
│  ┌────────┐      ┌────────┐        │
│  │ Frame1 │  →   │ Frame2 │        │
│  └────────┘      └────────┘        │
│  No video yet                       │
└─────────────────────────────────────┘
```

#### Generating State
```
┌─────────────────────────────────────┐
│  🎬 Storyboard Title                │
├─────────────────────────────────────┤
│  Scene 1: Opening Shot              │
│  ┌────────┐      ┌────────┐        │
│  │ Frame1 │  →   │ Frame2 │        │
│  └────────┘      └────────┘        │
│  ┌───────────────────────────────┐  │
│  │  ⟳ Generating video...        │  │
│  │  This may take 2-3 minutes... │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

#### Complete State
```
┌─────────────────────────────────────┐
│  🎬 Storyboard Title                │
├─────────────────────────────────────┤
│  Scene 1: Opening Shot              │
│  ┌────────┐      ┌────────┐        │
│  │ Frame1 │  →   │ Frame2 │        │
│  └────────┘      └────────┘        │
│  ┌───────────────────────────────┐  │
│  │  📹 Generated Video           │  │
│  │  [====▶====] 0:03 / 0:03      │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Troubleshooting

#### Videos Not Generating
- Check browser console for errors
- Verify Replicate API token is set
- Check if frames are valid URLs

#### Videos Stuck in "Generating" State
- Wait 2-3 minutes per scene (Replicate can be slow)
- Check the polling is working (should see periodic API calls in Network tab)
- Try closing and reopening the modal - polling should resume

#### Videos Not Appearing After Generation
- Check if polling is running (should see `/api/replicate/status` calls in Network tab)
- Verify the storyboard is being updated (check `/api/storyboard?id=...` response)
- Try refreshing the page and reopening the modal

### Performance Notes
- Video generation takes approximately 2-3 minutes per scene
- Multiple scenes are generated sequentially (not in parallel)
- Total time = (number of scenes) × 2-3 minutes
- Videos are automatically saved to the database once generated
- You can close the modal and come back later - videos will still be there

### API Monitoring
Watch these endpoints in the Network tab:
1. `/api/storyboard/generate-videos` - Initiates generation (SSE stream)
2. `/api/replicate/status?id=...` - Polls for video status
3. `/api/storyboard?id=...` - Updates storyboard with video URLs
4. `/api/proxy?type=video&url=...` - Serves the video (proxied)

### Browser Compatibility
- ✅ Chrome/Edge (tested)
- ✅ Firefox (tested)
- ✅ Safari (should work)
- ❌ IE11 (not supported - uses modern APIs)

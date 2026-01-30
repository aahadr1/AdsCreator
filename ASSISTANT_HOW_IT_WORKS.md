# How the AdsCreator Assistant Works - Complete Explanation

**Date:** January 30, 2026

---

## 🎯 Overview - What Is It?

The assistant is an **AI-powered creative director** that helps users create video ad storyboards. It:
- 📝 Understands user requests in natural language
- 🎨 Generates avatar images for actors
- 🎬 Creates multi-scene storyboards with frames
- 🎥 Generates videos from storyboards
- 💬 Has conversations to refine creative ideas

---

## 🏗️ Architecture - How It's Built

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                │
│              (Chat Interface - Frontend)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Types message
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  FRONTEND COMPONENT                         │
│              (app/assistant/page.tsx)                       │
│                                                             │
│  • Captures user input                                     │
│  • Streams to backend API                                  │
│  • Displays responses in real-time                         │
│  • Polls for media completion                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ POST /api/assistant/chat
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND API ROUTE                         │
│           (app/api/assistant/chat/route.ts)                 │
│                                                             │
│  1. Load conversation history from database                │
│  2. Build context (previous messages)                      │
│  3. Call OpenAI GPT-4o with system prompt                  │
│  4. Stream response back to frontend                       │
│  5. Parse <reflexion> and <tool_call> blocks               │
│  6. Execute tools (image gen, storyboard, etc.)            │
│  7. Save messages to database                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Uses AI Models
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                         │
│                                                             │
│  • OpenAI GPT-4o - Text generation & planning              │
│  • Replicate (Nano Banana) - Image generation              │
│  • Replicate (Seedance) - Video generation                 │
│  • Cloudflare R2 - Media storage                           │
│  • Supabase - Database (conversations, storyboards)        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Request Flow - Step by Step

### **User Types: "Create a storyboard for a skincare product"**

Let's follow this request through the entire system:

---

### **STEP 1: Frontend Receives Message**

```typescript
// app/assistant/page.tsx
1. User types in textarea
2. User hits Send button
3. Frontend captures:
   - Message text: "Create a storyboard for a skincare product"
   - User ID: abc123
   - Conversation ID: conv-xyz
   - Any uploaded files
```

---

### **STEP 2: Frontend Calls Backend API**

```typescript
// POST /api/assistant/chat
fetch('/api/assistant/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>'
  },
  body: JSON.stringify({
    conversationId: 'conv-xyz',
    message: 'Create a storyboard for a skincare product',
    stream: true
  })
})
```

**Frontend receives:** Server-Sent Events (SSE) stream

---

### **STEP 3: Backend Loads Conversation History**

```typescript
// app/api/assistant/chat/route.ts

// 1. Load from Supabase database
const { data } = await supabase
  .from('assistant_conversations')
  .select('*')
  .eq('id', conversationId)
  .single();

// 2. Extract previous messages
const existingMessages = data?.messages || [];
// Example:
[
  { role: 'user', content: 'Hi' },
  { role: 'assistant', content: 'Hello! I can help you...' },
  { role: 'user', content: 'Create a storyboard for skincare' }
]

// 3. Build conversation context
const context = buildConversationContext(existingMessages);
```

---

### **STEP 4: Backend Calls OpenAI GPT-4o**

```typescript
// Build the full prompt
const systemPrompt = ASSISTANT_SYSTEM_PROMPT; // From system.ts
const userMessage = "Create a storyboard for a skincare product";

// Call OpenAI
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    stream: true, // Real-time streaming!
    temperature: 0.7
  })
});
```

---

### **STEP 5: GPT-4o Generates Response**

**GPT-4o thinks:** 
"User wants a storyboard for skincare. I need to:
1. Generate an avatar (person) first
2. Wait for approval
3. Create storyboard with scenes"

**GPT-4o outputs:**

```xml
<reflexion>
**User Intent:** Create video storyboard for skincare product
**Selected Action:** TOOL_CALL
**Tool To Use:** image_generation
**Reasoning:** Need avatar first for person-based scenes
</reflexion>

<tool_call>
{
  "tool": "image_generation",
  "input": {
    "prompt": "Woman in her 30s with clear skin, natural makeup, warm smile, standing in bright bathroom, casual white top, looking at camera with friendly expression",
    "aspect_ratio": "9:16",
    "purpose": "avatar",
    "avatar_description": "Woman in 30s, skincare user, approachable"
  }
}
</tool_call>
```

---

### **STEP 6: Backend Parses Response**

```typescript
// Backend receives GPT-4o stream
const chunks = [];

// Parse the response for special blocks
for await (const chunk of response) {
  const text = chunk.choices[0]?.delta?.content || '';
  
  // Check for <reflexion> block
  if (text.includes('<reflexion>')) {
    // Extract reflexion text
    const reflexion = extractReflexion(text);
    // Stream to frontend
    controller.enqueue(encode({
      type: 'reflexion_chunk',
      data: reflexion
    }));
  }
  
  // Check for <tool_call> block
  if (text.includes('<tool_call>')) {
    // Parse the JSON inside
    const toolCall = parseToolCall(text);
    // Example:
    {
      tool: 'image_generation',
      input: {
        prompt: '...',
        aspect_ratio: '9:16',
        purpose: 'avatar'
      }
    }
  }
}
```

---

### **STEP 7: Backend Executes Tools**

```typescript
// Found tool_call for image_generation
if (toolCall.tool === 'image_generation') {
  // Call Replicate API to generate image
  const result = await executeImageGeneration(toolCall.input);
  
  // Replicate creates prediction
  const prediction = await replicate.predictions.create({
    model: 'google/nano-banana',
    input: {
      prompt: toolCall.input.prompt,
      aspect_ratio: '9:16',
      output_format: 'jpg'
    }
  });
  
  // Returns immediately with prediction ID
  return {
    success: true,
    output: {
      id: prediction.id,        // e.g., "abc-123-def"
      status: prediction.status  // "starting"
    }
  };
}
```

**Important:** Image generation is **async**!
- Backend returns prediction ID immediately
- Image takes 5-30 seconds to generate on Replicate
- Frontend polls for completion

---

### **STEP 8: Frontend Receives Tool Result**

```typescript
// Frontend receives SSE events

// Event 1: Reflexion (hidden from user)
{
  type: 'reflexion_chunk',
  data: 'User Intent: Create storyboard...'
}

// Event 2: Response text (shown to user)
{
  type: 'response_chunk',
  data: 'I\'ll create an avatar for your skincare video...'
}

// Event 3: Tool call (creates placeholder)
{
  type: 'tool_call',
  data: {
    tool: 'image_generation',
    input: { ... },
    message_id: 'msg-123'
  }
}

// Event 4: Tool result (prediction created)
{
  type: 'tool_result',
  data: {
    tool: 'image_generation',
    result: {
      success: true,
      output: { id: 'pred-abc123', status: 'starting' }
    }
  }
}
```

---

### **STEP 9: Frontend Polls for Image Completion**

```typescript
// ImagePredictionCard component starts polling

const poll = async () => {
  // Every 2 seconds, check status
  const response = await fetch(`/api/replicate/status?id=pred-abc123`);
  const data = await response.json();
  
  console.log('[ImageGeneration] Status:', data.status);
  
  if (data.status === 'processing') {
    // Still generating, poll again
    setTimeout(poll, 2000);
  }
  
  if (data.status === 'succeeded' && data.outputUrl) {
    // Image ready!
    console.log('[ImageGeneration] Image ready:', data.outputUrl);
    setOutputUrl(data.outputUrl);
    // Display the image in UI
  }
};
```

**User sees:**
- Spinner while generating
- Status updates: "starting" → "processing" → "succeeded"
- Image appears when ready (5-30 seconds)

---

### **STEP 10: Backend Caches Image to R2**

```typescript
// When status endpoint is called
// app/api/replicate/status/route.ts

// 1. Check Replicate for completion
const replicateResponse = await fetch(
  `https://api.replicate.com/v1/predictions/${predictionId}`
);

// 2. If succeeded, cache to R2 for permanent storage
if (status === 'succeeded' && outputUrl) {
  // Download image from Replicate
  const imageData = await fetch(outputUrl);
  
  // Upload to R2
  await r2PutObject({
    client: r2,
    bucket: 'adzbucket',
    key: `replicate/outputs/${predictionId}.jpg`,
    body: imageData
  });
  
  // Return proxy URL
  return {
    status: 'succeeded',
    outputUrl: `https://adzcreator.com/api/r2/get?key=replicate/outputs/${predictionId}.jpg`
  };
}
```

**Why cache to R2?**
- ✅ Replicate URLs expire after 24 hours
- ✅ R2 is permanent storage
- ✅ Faster subsequent loads
- ✅ Cheaper (no repeated Replicate bandwidth)

---

### **STEP 11: User Confirms Avatar**

**User types:** "Use this avatar"

**Backend receives:**
```typescript
// New message in conversation
{
  role: 'user',
  content: 'Use this avatar'
}
```

**GPT-4o detects confirmation:**
```typescript
// System prompt has this logic:
"Accept natural approval phrases:
- 'Use this avatar'
- 'Yes, use this'
- 'That looks good'
- 'Perfect'"

// GPT-4o understands and proceeds to next step
```

---

### **STEP 12: Create Storyboard**

**GPT-4o now calls storyboard_creation:**

```xml
<reflexion>
**User Intent:** Create skincare video with confirmed avatar
**Selected Action:** TOOL_CALL
**Tool To Use:** storyboard_creation
**Reasoning:** Avatar confirmed, creating 3-scene UGC storyboard
</reflexion>

<tool_call>
{
  "tool": "storyboard_creation",
  "input": {
    "title": "Clear Skin in 7 Days",
    "product": "Vitamin C Serum",
    "platform": "tiktok",
    "total_duration_seconds": 30,
    "avatar_image_url": "https://adzcreator.com/api/r2/get?key=avatars/...",
    "avatar_description": "Woman in 30s, skincare user",
    "scenes": [
      {
        "scene_number": 1,
        "scene_name": "Hook",
        "description": "Creator shows before skin state, frustrated",
        "duration_seconds": 4,
        "scene_type": "talking_head",
        "uses_avatar": true
      },
      {
        "scene_number": 2,
        "scene_name": "Product Intro",
        "description": "Creator holds up Vitamin C serum, explains benefits",
        "duration_seconds": 8,
        "scene_type": "product_showcase",
        "uses_avatar": true,
        "needs_product_image": true
      },
      {
        "scene_number": 3,
        "scene_name": "Results",
        "description": "Creator shows clear skin, happy expression",
        "duration_seconds": 5,
        "scene_type": "talking_head",
        "uses_avatar": true
      }
    ]
  }
}
</tool_call>
```

---

### **STEP 13: Backend Generates Storyboard**

```typescript
// executeStoryboardCreation function
async function executeStoryboardCreation(input, context, streamController) {
  
  // 1. Create storyboard record in database
  const storyboardId = crypto.randomUUID();
  const storyboard = {
    id: storyboardId,
    title: input.title,
    user_id: userId,
    scenes: input.scenes.map(scene => ({
      ...scene,
      first_frame_url: null,        // Will generate
      last_frame_url: null,         // Will generate
      first_frame_status: 'pending',
      last_frame_status: 'pending'
    }))
  };
  
  // 2. Save to database
  await supabase.from('storyboards').insert(storyboard);
  
  // 3. Stream link to user immediately
  streamController.enqueue({
    type: 'response_chunk',
    data: '🎬 [View Storyboard →](#storyboard:' + storyboardId + ')'
  });
  
  // 4. Generate frames for each scene (SEQUENTIAL)
  for (let i = 0; i < storyboard.scenes.length; i++) {
    const scene = storyboard.scenes[i];
    
    // 4a. Generate FIRST frame
    const firstFramePrompt = buildFirstFramePrompt({
      scene,
      avatarUrl: input.avatar_image_url,
      previousSceneLastFrame: i > 0 ? storyboard.scenes[i-1].last_frame_url : null,
      continuousFromPrevious: scene.use_prev_scene_transition
    });
    
    const firstFramePrediction = await replicate.predictions.create({
      model: 'google/nano-banana',
      input: {
        prompt: firstFramePrompt,
        aspect_ratio: '9:16',
        image_input: [input.avatar_image_url] // Reference image!
      }
    });
    
    // 4b. Wait for first frame to complete
    const firstFrameResult = await waitForPrediction(firstFramePrediction.id);
    
    // 4c. Cache first frame to R2
    const firstFrameUrl = await cacheToR2(firstFrameResult.outputUrl);
    
    // 4d. Update scene in database
    storyboard.scenes[i].first_frame_url = firstFrameUrl;
    storyboard.scenes[i].first_frame_status = 'succeeded';
    
    // 4e. Stream update to frontend
    streamController.enqueue({
      type: 'storyboard_update',
      data: { storyboard }
    });
    
    // 4f. Generate LAST frame (uses FIRST frame as reference!)
    const lastFramePrompt = buildLastFramePrompt({
      scene,
      firstFrameUrl: firstFrameUrl,  // Anchor to first frame
      avatarUrl: input.avatar_image_url
    });
    
    const lastFramePrediction = await replicate.predictions.create({
      model: 'google/nano-banana',
      input: {
        prompt: lastFramePrompt,
        aspect_ratio: '9:16',
        image_input: [
          firstFrameUrl,              // PRIMARY: First frame
          input.avatar_image_url      // Secondary: Avatar reference
        ]
      }
    });
    
    // 4g. Wait for last frame
    const lastFrameResult = await waitForPrediction(lastFramePrediction.id);
    const lastFrameUrl = await cacheToR2(lastFrameResult.outputUrl);
    
    // 4h. Update scene
    storyboard.scenes[i].last_frame_url = lastFrameUrl;
    storyboard.scenes[i].last_frame_status = 'succeeded';
    
    // 4i. Stream final scene update
    streamController.enqueue({
      type: 'storyboard_update',
      data: { storyboard }
    });
  }
  
  // 5. Return complete storyboard
  return {
    success: true,
    output: { storyboard }
  };
}
```

**Key Points:**
- ✅ Frames generate **sequentially** (one after another)
- ✅ Each scene waits for previous to complete
- ✅ **First frame** of Scene N can use **last frame** of Scene N-1 for continuity
- ✅ **Last frame** ALWAYS uses **first frame** of same scene as anchor
- ✅ Frontend updates in real-time as each frame completes

---

### **STEP 14: Frontend Displays Storyboard**

```typescript
// User clicks storyboard link
// Opens modal showing all scenes

<StoryboardModal>
  <Scene number={1}>
    <FirstFrame url="..." status="succeeded" />
    <LastFrame url="..." status="succeeded" />
    <Description>Creator shows before skin state...</Description>
    <Duration>4 seconds</Duration>
  </Scene>
  
  <Scene number={2}>
    <FirstFrame url="..." status="succeeded" />
    <LastFrame url="..." status="succeeded" />
    <Description>Creator holds up serum...</Description>
  </Scene>
  
  <Scene number={3}>
    <FirstFrame url="..." status="succeeded" />
    <LastFrame url="..." status="succeeded" />
    <Description>Creator shows results...</Description>
  </Scene>
</StoryboardModal>
```

---

## 🧠 How Reflexion Works

### **What Is Reflexion?**

**Reflexion** = The assistant's internal "thinking out loud" before responding

**Format:**
```xml
<reflexion>
**User Intent:** [What user wants]
**Selected Action:** [TOOL_CALL | DIRECT_RESPONSE | FOLLOW_UP]
**Tool To Use:** [which tool]
**Reasoning:** [Why this approach]
</reflexion>
```

### **How It Works:**

**1. GPT-4o is instructed to always start with reflexion**

```typescript
// From system prompt (line 30):
"EVERY response must start with a <reflexion> block for internal planning"
```

**2. GPT-4o generates reflexion first**

```
GPT-4o thinks:
"User wants storyboard → Need avatar first → Will use image_generation"

Outputs:
<reflexion>
**User Intent:** Create skincare storyboard
**Selected Action:** TOOL_CALL
**Tool To Use:** image_generation
**Reasoning:** Need avatar before creating scenes with person
</reflexion>
```

**3. Backend parses and streams it**

```typescript
// Detect <reflexion> block in stream
if (chunk.includes('<reflexion>')) {
  const reflexionText = extractBetweenTags(chunk, 'reflexion');
  
  // Stream to frontend
  controller.enqueue({
    type: 'reflexion_chunk',
    data: reflexionText
  });
}
```

**4. Frontend receives but hides it from user**

```typescript
// Frontend shows it in a collapsed state
<ReflexionBlock collapsed={true}>
  {reflexionText}
</ReflexionBlock>

// User can expand to see the "thinking"
// But by default it's hidden
```

### **Why Use Reflexion?**

**Benefits:**
- ✅ Makes GPT-4o plan before acting
- ✅ Reduces impulsive/wrong tool calls
- ✅ Helps debug assistant behavior
- ✅ Shows transparency to user (if expanded)

**Drawbacks:**
- ❌ Adds 50-100 tokens per response
- ❌ Slower responses (extra generation time)
- ❌ Overkill for simple questions
- ❌ User rarely looks at it

---

## 🎨 How Image Consistency Works

### **The Key Problem:**

When generating multiple frames for a video, how do you ensure the **same person** appears in every frame?

### **The Solution: Reference Images**

**Step 1: Generate Avatar (Reference)**
```
Prompt: "Woman in 30s, casual attire, warm smile"
Result: Avatar image URL
Purpose: This becomes the REFERENCE for all future frames
```

**Step 2: Use Avatar as Reference Input**

```typescript
// When generating ANY frame with this person
await replicate.predictions.create({
  model: 'google/nano-banana',
  input: {
    prompt: 'Woman holds product bottle, looking at camera',
    aspect_ratio: '9:16',
    image_input: [avatarUrl]  // ← REFERENCE IMAGE!
  }
});
```

**How It Works:**
- Nano Banana model supports **image-to-image (i2i)** generation
- You provide a reference image
- Model generates NEW image but **maintains identity** from reference
- Same face, same person, different pose/expression/scene

### **Frame Continuity Chain:**

```
Scene 1:
  First Frame: Uses [avatar reference]
  Last Frame:  Uses [first frame of Scene 1 + avatar reference]
  
Scene 2:
  First Frame: Uses [last frame of Scene 1 + avatar reference]  ← Smooth transition!
  Last Frame:  Uses [first frame of Scene 2 + avatar reference]
  
Scene 3:
  First Frame: Uses [last frame of Scene 2 + avatar reference]
  Last Frame:  Uses [first frame of Scene 3 + avatar reference]
```

**Result:**
- ✅ Same character throughout
- ✅ Smooth visual transitions between scenes
- ✅ Consistent wardrobe, lighting, setting
- ✅ Natural progression of poses/actions

---

## 🎥 How Video Generation Works

### **After Storyboard Is Created:**

**User clicks:** "Generate Videos"

**Backend flow:**
```typescript
// video_generation tool called
{
  "tool": "video_generation",
  "input": {
    "storyboard_id": "story-abc123"
  }
}

// Backend executes
async function executeVideoGeneration(input) {
  // 1. Load storyboard from database
  const storyboard = await loadStoryboard(input.storyboard_id);
  
  // 2. For each scene, create video prediction
  for (const scene of storyboard.scenes) {
    
    // Video model needs:
    // - First frame image (start point)
    // - Last frame image (end point)
    // - Motion prompt (how to transition)
    
    const prediction = await replicate.predictions.create({
      model: 'bytedance/seedance-1.5-pro',
      input: {
        start_image: scene.first_frame_url,   // Start here
        end_image: scene.last_frame_url,       // End here
        motion_prompt: scene.video_generation_prompt,
        duration: scene.duration_seconds
      }
    });
    
    // Save prediction ID
    scene.video_prediction_id = prediction.id;
    scene.video_status = 'generating';
  }
  
  // 3. Return immediately (videos generate async)
  return { success: true, output: { storyboard } };
}
```

**Frontend polls for each scene:**
```typescript
// SceneVideoPreview component
// Polls every 2.5 seconds per scene

for (const scene of scenes) {
  if (scene.video_prediction_id && !scene.video_url) {
    // Poll for this scene's video
    const status = await fetch(`/api/replicate/status?id=${scene.video_prediction_id}`);
    
    if (status.outputUrl) {
      // Video ready for this scene!
      scene.video_url = status.outputUrl;
      scene.video_status = 'succeeded';
      // Display video player in scene card
    }
  }
}
```

**Result:**
- Videos appear one by one as they complete
- Each takes 30-180 seconds
- Multiple scenes generate in parallel
- User sees progress in real-time

---

## 💭 How the Assistant Understands User Intent

### **Multi-Layer Understanding:**

**Layer 1: Direct Instructions**
```
User: "Create a 30-second TikTok ad for protein powder"

GPT-4o extracts:
- Type: Video ad
- Platform: TikTok → 9:16 vertical
- Product: Protein powder
- Duration: 30 seconds
→ Proceeds with storyboard
```

**Layer 2: Contextual Clues**
```
User: "Make a UGC video"

GPT-4o infers:
- UGC = User-Generated Content
- Style: Casual, authentic, not polished
- Setting: Home/casual environment
- Camera: Static or handheld
- Person: Needs avatar
→ Generates casual, relatable avatar
```

**Layer 3: Conversation History**
```
Message 1: "I'm launching a skincare brand"
Message 2: "Create a video"

GPT-4o remembers:
- Previous context: Skincare brand
- Can reference: Brand mentioned earlier
- Maintains: Conversation continuity
→ Creates skincare-focused storyboard
```

**Layer 4: Image Analysis**
```
User uploads image + says: "Create video with this"

GPT-4o:
1. Uses GPT-4o Vision to analyze image
2. Detects: Person, product, or scene
3. Asks: "Should I use this as the avatar?"
→ Waits for confirmation before proceeding
```

**Layer 5: Natural Language Confirmations**
```
User: "Yeah that works" / "Perfect" / "Use this"

GPT-4o has patterns:
- isAvatarConfirmation() checks for confirmation phrases
- Understands: "yes", "perfect", "use this", etc.
- Proceeds: With confirmed avatar
→ No need for exact commands
```

---

## 🛠️ Complete Tool Execution Flow

### **Example: Image Generation Tool**

**1. Tool Call Detected**
```typescript
// Backend sees:
<tool_call>
{"tool": "image_generation", "input": {"prompt": "..."}}
</tool_call>

// Parses JSON
const toolCall = {
  tool: 'image_generation',
  input: { prompt: '...', aspect_ratio: '9:16' }
};
```

**2. Tool Executed**
```typescript
// Routes to correct handler
if (toolCall.tool === 'image_generation') {
  result = await executeImageGeneration(toolCall.input);
}

// executeImageGeneration does:
async function executeImageGeneration(input) {
  // Call Replicate API
  const prediction = await replicate.predictions.create({
    model: 'google/nano-banana',
    input: {
      prompt: input.prompt,
      aspect_ratio: input.aspect_ratio || '9:16'
    }
  });
  
  // Return prediction ID (not final image!)
  return {
    success: true,
    output: {
      id: prediction.id,
      status: prediction.status  // "starting"
    }
  };
}
```

**3. Result Streamed to Frontend**
```typescript
// Backend sends SSE event
controller.enqueue({
  type: 'tool_result',
  data: {
    tool: 'image_generation',
    result: {
      success: true,
      output: { id: 'pred-123', status: 'starting' }
    }
  }
});
```

**4. Frontend Creates Placeholder**
```typescript
// Creates message with prediction ID
setMessages(prev => [...prev, {
  id: 'msg-123',
  role: 'tool_result',
  tool_name: 'image_generation',
  tool_output: {
    success: true,
    output: { id: 'pred-123', status: 'starting' }
  }
}]);

// Renders ImagePredictionCard
<ImagePredictionCard predictionId="pred-123" />
```

**5. ImagePredictionCard Polls**
```typescript
// Every 2 seconds
useEffect(() => {
  async function poll() {
    const res = await fetch('/api/replicate/status?id=pred-123');
    const data = await res.json();
    
    if (data.status === 'succeeded' && data.outputUrl) {
      // Image ready!
      setOutputUrl(data.outputUrl);
      // Display image in UI
    } else {
      // Still processing, poll again
      setTimeout(poll, 2000);
    }
  }
  poll();
}, [predictionId]);
```

**6. Image Appears**
```typescript
// When outputUrl arrives
<img src="https://adzcreator.com/api/r2/get?key=avatars/..." />

// User sees the generated image!
```

---

## 📦 Data Flow - What Gets Stored Where

### **Supabase Database:**

**`assistant_conversations` table:**
```json
{
  "id": "conv-xyz",
  "user_id": "user-123",
  "title": "Skincare Video",
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "content": "Create a storyboard",
      "timestamp": "2026-01-30T12:00:00Z"
    },
    {
      "id": "msg-2",
      "role": "assistant",
      "content": "I'll create an avatar first...",
      "timestamp": "2026-01-30T12:00:05Z"
    },
    {
      "id": "msg-3",
      "role": "tool_result",
      "tool_name": "image_generation",
      "tool_output": {
        "success": true,
        "output": { "id": "pred-123" },
        "outputUrl": "https://..."
      }
    }
  ],
  "plan": {
    "image_registry": {
      "avatar": { "url": "...", "description": "..." },
      "product": null,
      "frames": []
    }
  }
}
```

**`storyboards` table:**
```json
{
  "id": "story-abc",
  "user_id": "user-123",
  "conversation_id": "conv-xyz",
  "title": "Clear Skin in 7 Days",
  "scenes": [
    {
      "scene_number": 1,
      "scene_name": "Hook",
      "description": "Creator shows before state",
      "duration_seconds": 4,
      "first_frame_url": "https://adzcreator.com/api/r2/get?key=...",
      "last_frame_url": "https://adzcreator.com/api/r2/get?key=...",
      "first_frame_status": "succeeded",
      "last_frame_status": "succeeded",
      "video_url": null,
      "video_status": "pending"
    }
  ]
}
```

### **Cloudflare R2 Storage:**

```
adzbucket/
├── avatars/
│   └── conv-xyz/
│       └── abc123-avatar.jpg       ← Avatar reference
├── storyboards/
│   └── conv-xyz/
│       ├── scene1-first.jpg        ← Scene 1 first frame
│       ├── scene1-last.jpg         ← Scene 1 last frame
│       ├── scene2-first.jpg        ← Scene 2 first frame
│       └── scene2-last.jpg         ← Scene 2 last frame
└── replicate/
    └── outputs/
        ├── pred-123.jpg            ← Cached Replicate output
        └── pred-456.mp4            ← Cached video
```

**Why R2?**
- ✅ Permanent storage (Replicate URLs expire in 24h)
- ✅ Fast access via proxy: `/api/r2/get?key=...`
- ✅ Cheap storage ($0.015/GB/month)
- ✅ No egress fees within Cloudflare

---

## 🔍 Understanding System Prompt Structure

### **The system prompt has 3 main parts:**

**Part 1: Core Behavior Rules** (Lines 6-25)
```
What: High-level principles
- Consistency is priority #1
- Always use reference images
- Ground prompts in visible details
- Maintain user intent
```

**Part 2: Reflexion Format** (Lines 28-77)
```
What: How to structure thinking
- Always start with <reflexion>
- Choose: TOOL_CALL vs DIRECT_RESPONSE vs FOLLOW_UP
- Define when to ask vs when to proceed
```

**Part 3: Tool Definitions** (Lines 117-748)
```
What: Available tools and how to use them
- prompt_creator (doesn't exist! ❌)
- script_creation ✅
- image_generation ✅
- storyboard_creation ✅
- video_generation ✅
- (missing: video_analysis, motion_control)
```

---

## ⚙️ How Reference Images Enable Consistency

### **The Magic: Image-to-Image (i2i) Generation**

**Without References (Text-Only):**
```
Frame 1 Prompt: "Woman in white shirt, brown hair, smiling"
Frame 1 Result: → Woman A (specific person)

Frame 2 Prompt: "Woman in white shirt, brown hair, smiling, holding bottle"
Frame 2 Result: → Woman B (DIFFERENT person! ❌)
```

**With References (i2i):**
```
Frame 1:
  Prompt: "Woman in white shirt, brown hair, smiling"
  References: None (first generation)
  Result: → Woman A

Frame 2:
  Prompt: "Woman holds bottle, same expression"
  References: [Frame 1 image]  ← THE KEY!
  Result: → Woman A holding bottle (SAME person! ✅)

Frame 3:
  Prompt: "Woman raises bottle to eye level"
  References: [Frame 2 image]
  Result: → Woman A with bottle raised (SAME person! ✅)
```

**Why This Works:**
- AI model sees the reference image
- Understands: "Keep this person's identity"
- Prompt only describes: "What changes"
- Result: Consistent character across all frames

---

## 🎬 Complete Example: End-to-End

### **User Journey:**

**1. User:** "Create a TikTok video for BB cream"

**2. Assistant (Reflexion - Hidden):**
```xml
<reflexion>
**User Intent:** Create TikTok video ad for BB cream
**Selected Action:** TOOL_CALL
**Tool To Use:** image_generation
**Reasoning:** Need avatar first, then storyboard
</reflexion>
```

**3. Assistant (Visible Response):**
"I'll create an avatar for your BB cream video. Generating now..."

**4. Assistant (Tool Call - Behind Scenes):**
```xml
<tool_call>
{"tool": "image_generation", "input": {
  "prompt": "Woman in 20s, clear skin, casual home setting...",
  "purpose": "avatar"
}}
</tool_call>
```

**5. Backend → Replicate:**
- Creates prediction
- Returns prediction ID
- Image generates (15 seconds)

**6. Frontend:**
- Shows spinner: "Generating image..."
- Polls status every 2 seconds
- Image appears when ready

**7. User:** "Use this avatar"

**8. Assistant:** 
```xml
<tool_call>
{"tool": "storyboard_creation", "input": {
  "title": "BB Cream Natural Look",
  "avatar_image_url": "https://...",
  "scenes": [...]
}}
</tool_call>
```

**9. Backend Generates Storyboard:**
- Creates 3 scenes
- Generates first frame for Scene 1 (uses avatar)
- Generates last frame for Scene 1 (uses first frame + avatar)
- Generates first frame for Scene 2 (uses Scene 1 last frame + avatar)
- Generates last frame for Scene 2 (uses Scene 2 first frame + avatar)
- Generates first frame for Scene 3 (uses Scene 2 last frame + avatar)
- Generates last frame for Scene 3 (uses Scene 3 first frame + avatar)
- Each takes 10-20 seconds
- Total: 60-120 seconds for 6 frames

**10. Frontend:**
- Shows storyboard link immediately
- Updates in real-time as each frame completes
- User can view storyboard while frames generate

**11. User clicks:** "Generate Videos"

**12. Backend:**
- For each scene, calls Seedance video model
- Inputs: start_image + end_image + motion_prompt
- Each video takes 60-120 seconds

**13. Videos Appear:**
- Scene 1 video ready (90s)
- Scene 2 video ready (110s)
- Scene 3 video ready (95s)
- User can download complete video ad!

**Total Time:** ~3-5 minutes from request to final videos

---

## 🧩 Key Technologies

| Technology | Purpose | Why |
|------------|---------|-----|
| **OpenAI GPT-4o** | Assistant intelligence | Best reasoning, tool use |
| **Replicate Nano Banana** | Image generation | Best i2i consistency |
| **Replicate Seedance** | Video generation | i2i video (first→last frame) |
| **Supabase** | Database | Stores conversations, storyboards |
| **Cloudflare R2** | File storage | Permanent media storage |
| **Server-Sent Events** | Real-time streaming | Live updates to UI |
| **React Hooks** | Frontend state | Polling, updates |

---

## 🎯 Summary - How It All Works

**The assistant is a sophisticated pipeline:**

1. **User input** → GPT-4o understands intent
2. **Reflexion** → GPT-4o plans approach (hidden from user)
3. **Tool calls** → GPT-4o executes actions (avatar, storyboard, videos)
4. **Async generation** → Replicate creates media (images, videos)
5. **Polling** → Frontend checks status every 2 seconds
6. **R2 caching** → Media stored permanently
7. **Real-time updates** → User sees progress live
8. **Database persistence** → Everything saved for later

**The result:**
- ✅ Natural conversation interface
- ✅ Consistent characters across frames
- ✅ Professional video storyboards
- ✅ Full video generation
- ✅ Real-time progress updates
- ✅ Permanent storage

**It's like having a creative director who:**
- Understands what you want
- Thinks through the approach (reflexion)
- Creates visual references (images)
- Plans the shots (storyboard)
- Generates the footage (videos)
- Keeps everything organized (database)

---

*This is the complete technical explanation of how the AdsCreator assistant works!*

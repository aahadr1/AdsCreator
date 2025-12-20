export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest } from 'next/server';
import Replicate from 'replicate';
import { createSSEStream, sseHeaders } from '@/lib/sse';
import type { AssistantPlanStep, AssistantRunEvent, AssistantPlanMessage } from '@/types/assistant';

type StepResult = { url?: string | null; text?: string | null };

type RunRequestBody = {
  steps: AssistantPlanStep[];
  user_id: string;
  plan_summary?: string;
  user_messages?: AssistantPlanMessage[];
  previous_outputs?: Record<string, StepResult>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolvePlaceholders(value: any, outputs: Record<string, StepResult>): any {
  if (typeof value === 'string') {
    const matches = value.match(/{{\s*steps\.([^.}]+)(?:\.([a-z]+))?\s*}}/i);
    if (matches) {
      const stepId = matches[1];
      const prop = (matches[2] || 'url').toLowerCase();
      const out = outputs[stepId];
      if (!out) return value;
      if (prop === 'text') return out.text || value;
      if (prop === 'url' || prop === 'output') return out.url || value;
      return value;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => resolvePlaceholders(v, outputs));
  if (value && typeof value === 'object') {
    const next: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      next[k] = resolvePlaceholders(v, outputs);
    }
    return next;
  }
  return value;
}

function coerceNumeric(input: Record<string, any>): Record<string, any> {
  const next: Record<string, any> = { ...input };
  for (const [key, val] of Object.entries(next)) {
    if (typeof val === 'string') {
      const lower = val.trim().toLowerCase();
      if (lower === 'true') { next[key] = true; continue; }
      if (lower === 'false') { next[key] = false; continue; }
    }
    if (typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val.trim())) {
      const parsed = Number(val);
      if (Number.isFinite(parsed)) next[key] = parsed;
    }
  }
  return next;
}

function enforceDefaults(step: AssistantPlanStep, inputs: Record<string, any>): Record<string, any> {
  const dep = step.dependencies?.[0];
  if (dep) {
    const depRef = `{{steps.${dep}.url}}`;
    if (step.tool === 'video' && !inputs.start_image) inputs.start_image = depRef;
    if (step.tool === 'enhance' && !inputs.image) inputs.image = depRef;
    if (step.tool === 'background_remove' && !inputs.video_url) inputs.video_url = depRef;
    if (step.tool === 'lipsync' && !inputs.video) inputs.video = depRef;
  }
  if (step.tool === 'video' && step.model.includes('kling-v2.1')) {
    if (!inputs.start_image) {
      const maybeDep = step.dependencies?.[0];
      if (maybeDep) inputs.start_image = `{{steps.${maybeDep}.url}}`;
    }
    if (!inputs.duration) inputs.duration = 4;
  }
  if (step.tool === 'image' && step.model === 'openai/gpt-image-1.5') {
    if (inputs.number_of_images === undefined) inputs.number_of_images = 1;
  }
  if (step.tool === 'tts') {
    if (!inputs.provider) {
      // Default provider based on model
      if (step.model?.includes('elevenlabs')) {
        inputs.provider = 'elevenlabs';
      } else if (step.model?.includes('dia')) {
        inputs.provider = 'dia';
      } else {
        inputs.provider = 'replicate';
      }
    }
    // Ensure user_id is passed (required by TTS API)
    // This will be added in executeStep
  }
  return coerceNumeric(inputs);
}

function lastUserMessage(messages: AssistantPlanMessage[] | undefined): string {
  if (!messages || !messages.length) return '';
  const last = [...messages].reverse().find((m) => m.role === 'user');
  return last?.content || '';
}

async function analyzeImage(url: string): Promise<string | null> {
  const token = process.env.REPLICATE_API_TOKEN;
  const model = process.env.REPLICATE_VISION_MODEL || 'meta/llama-3.2-11b-vision-instruct';
  if (!token || !url) return null;
  try {
    const replicate = new Replicate({ auth: token });
    const output: any = await replicate.run(model as `${string}/${string}`, {
      input: {
        prompt: 'Describe the visual content, layout, text, and style in concise prose. Focus on elements that matter for editing or animation.',
        image: url,
      },
    });
    if (typeof output === 'string') return output.slice(0, 2000);
    if (Array.isArray(output)) {
      const str = output.map((o) => (typeof o === 'string' ? o : JSON.stringify(o))).join('\n');
      return str.slice(0, 2000);
    }
  } catch {
    return null;
  }
  return null;
}

async function draftPromptWithLlm(context: string): Promise<string | null> {
  const token = process.env.REPLICATE_API_TOKEN;
  const model = process.env.REPLICATE_PROMPT_MODEL || 'meta/llama-3.1-8b-instruct';
  if (!token) return null;
  try {
    const replicate = new Replicate({ auth: token });
    const output: any = await replicate.run(model as `${string}/${string}`, {
      input: {
        prompt: context,
        max_tokens: 500,
      },
    });
    if (typeof output === 'string') return output.trim();
    if (Array.isArray(output)) {
      const str = output.map((o) => (typeof o === 'string' ? o : JSON.stringify(o))).join('\n');
      return str.trim();
    }
    if (output && typeof output === 'object' && 'output' in (output as any)) {
      const maybe = (output as any).output;
      if (typeof maybe === 'string') return maybe.trim();
    }
  } catch {
    return null;
  }
  return null;
}

function referenceUrls(inputs: Record<string, any>): string[] {
  const keys = ['image', 'start_image', 'input_image', 'end_image'];
  const arrays = ['input_images', 'image_input', 'image_inputs'];
  const urls = new Set<string>();
  for (const key of keys) {
    const val = inputs[key];
    if (typeof val === 'string' && val.startsWith('http')) urls.add(val);
  }
  for (const key of arrays) {
    const arr = inputs[key];
    if (Array.isArray(arr)) {
      arr.forEach((v) => {
        if (typeof v === 'string' && v.startsWith('http')) urls.add(v);
      });
    }
  }
  return Array.from(urls).slice(0, 3);
}

// Tool-specific prompt generation rules
const TOOL_PROMPT_RULES = {
  image: {
    include: ['visual description', 'style', 'composition', 'lighting', 'colors', 'text to display', 'materials', 'background'],
    exclude: ['motion', 'animation', 'camera movement', 'dolly', 'pan', 'zoom', 'video', 'animate'],
    systemHint: 'Generate a prompt for IMAGE GENERATION. Describe ONLY visual elements: subject, style, composition, lighting, colors, text to render. NEVER include motion, animation, or camera movement concepts.',
  },
  video: {
    include: ['motion', 'camera movement', 'pacing', 'timing', 'movement speed', 'stability'],
    exclude: ['create', 'generate', 'design', 'style', 'colors', 'composition', 'text'],
    systemHint: 'Generate a prompt for VIDEO ANIMATION. The start_image already contains all visuals. Describe ONLY motion: camera movement, subject motion, pacing, stability. NEVER describe what to create visually.',
  },
  tts: {
    include: ['the actual text to speak'],
    exclude: ['visual', 'image', 'video', 'motion'],
    systemHint: 'Return ONLY the text that should be spoken. No descriptions, no formatting, just the speech content.',
  },
  lipsync: {
    include: ['sync quality', 'timing'],
    exclude: ['visual design', 'text'],
    systemHint: 'This is a lipsync operation. The video and audio are already provided. Just describe any sync preferences.',
  },
  enhance: {
    include: ['enhancement type', 'quality level'],
    exclude: ['motion', 'animation'],
    systemHint: 'Describe the enhancement to apply to the image.',
  },
  background_remove: {
    include: ['subject to keep'],
    exclude: ['motion', 'animation'],
    systemHint: 'Describe which subject should be kept when removing the background.',
  },
  transcription: {
    include: ['language'],
    exclude: [],
    systemHint: 'No prompt needed for transcription.',
  },
};

// Clean prompt to remove inappropriate concepts for the tool type
function cleanPromptForTool(prompt: string, tool: string): string {
  const rules = TOOL_PROMPT_RULES[tool as keyof typeof TOOL_PROMPT_RULES];
  if (!rules) return prompt;
  
  let cleaned = prompt;
  
  // For video prompts, aggressively remove visual design language
  if (tool === 'video') {
    // Remove phrases about creating/designing visuals
    cleaned = cleaned.replace(/(?:create|generate|design|make|produce|render)\s+(?:a|an|the)?\s*(?:image|visual|picture|graphic|still|card|poster)/gi, '');
    // Remove style descriptions
    cleaned = cleaned.replace(/(?:in|with)\s+(?:a\s+)?(?:cinematic|professional|modern|clean|minimal|elegant)\s+style/gi, '');
    // Remove color/material descriptions
    cleaned = cleaned.replace(/(?:with|featuring)\s+(?:soft|warm|cool|bright|dark)\s+(?:lighting|colors?)/gi, '');
    // Keep only motion-related content
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
  }
  
  // For image prompts, remove motion language
  if (tool === 'image') {
    cleaned = cleaned.replace(/(?:animate|animation|motion|moving|dolly|pan|zoom|camera\s+movement)/gi, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
  }
  
  return cleaned || prompt;
}

async function buildSmartPrompt(
  step: AssistantPlanStep,
  planSummary: string | undefined,
  outputs: Record<string, StepResult>,
  userMessages?: AssistantPlanMessage[],
): Promise<string> {
  const userRequest = lastUserMessage(userMessages);
  const depUrl = step.dependencies?.slice().reverse().map((id) => outputs[id]?.url).find(Boolean) || null;
  const inputUrls = referenceUrls(step.inputs || {});
  if (depUrl) inputUrls.unshift(depUrl);

  // Get tool-specific rules
  const rules = TOOL_PROMPT_RULES[step.tool as keyof typeof TOOL_PROMPT_RULES] || TOOL_PROMPT_RULES.image;

  // For TTS, just return the text input if available
  if (step.tool === 'tts') {
    if (step.inputs?.text && typeof step.inputs.text === 'string') {
      return step.inputs.text;
    }
    return step.title || 'Generate natural speech.';
  }

  // For transcription, no prompt needed
  if (step.tool === 'transcription') {
    return '';
  }

  // Analyze media for context (only for image/video)
  let mediaInsights: string[] = [];
  if (step.tool === 'image' || step.tool === 'video') {
    for (const url of inputUrls.slice(0, 2)) {
      const desc = await analyzeImage(url);
      if (desc) mediaInsights.push(`Visual analysis: ${desc}`);
    }
  }

  // Build tool-specific system context
  const systemContext = rules.systemHint;

  // Build the prompt request for the LLM
  const promptContext = [
    systemContext,
    '',
    `Tool type: ${step.tool.toUpperCase()}`,
    `Step title: ${step.title || 'Generate output'}`,
    planSummary ? `Workflow context: ${planSummary}` : null,
    userRequest ? `Original user request: ${userRequest}` : null,
    mediaInsights.length ? `\nMedia insights:\n${mediaInsights.join('\n')}` : null,
    '',
    step.tool === 'video' ? 'IMPORTANT: The start_image already contains all visual design. Your prompt should ONLY describe motion, camera movement, pacing, and timing. Do NOT describe what the image looks like or should look like.' : null,
    step.tool === 'image' ? 'IMPORTANT: Describe the visual output. Include style, composition, lighting, and any text to display. Do NOT include motion or animation concepts.' : null,
    '',
    'Return ONLY the final prompt text. No JSON, no explanations, no meta-commentary.',
  ]
    .filter(Boolean)
    .join('\n');

  const llmDraft = await draftPromptWithLlm(promptContext);
  if (llmDraft) {
    // Clean the draft to ensure tool-appropriateness
    return cleanPromptForTool(llmDraft, step.tool);
  }

  // Fallback: generate deterministic tool-specific prompt
  return buildAutoPrompt(step, planSummary, outputs);
}

async function updateTask(origin: string, id: string | null, patch: Record<string, any>) {
  if (!id) return;
  try {
    await fetch(`${origin}/api/tasks/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
  } catch {
    // best effort
  }
}

async function createTask(origin: string, userId: string, summary?: string, steps?: AssistantPlanStep[]): Promise<string | null> {
  try {
    const res = await fetch(`${origin}/api/tasks/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        type: 'assistant-workflow',
        status: 'running',
        backend: 'assistant',
        provider: 'assistant',
        text_input: summary || '',
        output_text: summary || '',
        options_json: {
          source: 'assistant',
          summary,
          steps: Array.isArray(steps)
            ? steps.map((s) => ({ id: s.id, title: s.title, model: s.model, tool: s.tool }))
            : undefined,
        },
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.id || null;
  } catch {
    return null;
  }
}

async function runImageStep(origin: string, step: AssistantPlanStep, inputs: Record<string, any>): Promise<StepResult> {
  const res = await fetch(`${origin}/api/image/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...inputs, model: step.model }),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  const predictionId = json?.id;
  if (!predictionId) throw new Error('Missing prediction id');

  for (let i = 0; i < 40; i++) {
    await sleep(3000);
    const statusRes = await fetch(`${origin}/api/replicate/status?id=${predictionId}`, { cache: 'no-store' });
    if (!statusRes.ok) continue;
    const statusJson = await statusRes.json();
    if (statusJson.status === 'succeeded') {
      return { url: statusJson.outputUrl || null };
    }
    if (statusJson.status === 'failed' || statusJson.status === 'canceled') {
      throw new Error(statusJson.error || 'Image generation failed');
    }
  }
  throw new Error('Image generation timed out');
}

async function runVideoStep(origin: string, step: AssistantPlanStep, inputs: Record<string, any>): Promise<StepResult> {
  console.log(`[RunVideo] Starting video generation for model: ${step.model}`);
  console.log(`[RunVideo] Inputs:`, JSON.stringify(inputs, null, 2).slice(0, 300));
  
  // Video generation can take 2-10 minutes, set generous timeout
  const TIMEOUT_MS = 600000; // 10 minutes
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error(`[RunVideo] ⏰ Timeout after ${TIMEOUT_MS / 1000}s`);
    controller.abort();
  }, TIMEOUT_MS);
  
  try {
    console.log(`[RunVideo] Calling /api/veo/run with ${TIMEOUT_MS / 1000}s timeout...`);
    const startTime = Date.now();
    
    const res = await fetch(`${origin}/api/veo/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...inputs, model: step.model }),
      signal: controller.signal,
    });
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[RunVideo] Got response after ${elapsed}s, status: ${res.status}`);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[RunVideo] ❌ API error: ${errorText}`);
      throw new Error(errorText);
    }
    
    const json = await res.json();
    const url = json?.url || (json?.raw?.url ?? null);
    
    if (!url) {
      console.error(`[RunVideo] ⚠️  No URL in response:`, JSON.stringify(json).slice(0, 200));
      throw new Error('Video generation completed but no URL returned');
    }
    
    console.log(`[RunVideo] ✓ Video generated successfully: ${url}`);
    return { url };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`[RunVideo] ❌ Request aborted due to timeout (${TIMEOUT_MS / 1000}s)`);
      throw new Error(`Video generation timed out after ${TIMEOUT_MS / 1000} seconds. The video may still be processing in the background.`);
    }
    console.error(`[RunVideo] ❌ Error:`, error);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runLipsyncStep(origin: string, step: AssistantPlanStep, inputs: Record<string, any>): Promise<StepResult> {
  const backend = (inputs.backend as string) || step.model || 'sievesync-1.1';
  const videoUrl = inputs.video || inputs.video_url || inputs.start_video || inputs.image;
  const audioUrl = inputs.audio || inputs.audio_url || inputs.voice;

  if (!videoUrl || !audioUrl) throw new Error('Missing video/image and audio URLs for lipsync');

  // Wan 2.2 S2V - uses Replicate API directly
  if (backend.includes('wan-2.2-s2v') || backend.includes('wan-2.2-s2v') || step.model?.includes('wan-2.2-s2v')) {
    console.log(`[RunLipsync] Using Wan 2.2 S2V for cinematic audio-driven video`);
    console.log(`[RunLipsync] Image: ${videoUrl}, Audio: ${audioUrl}`);
    
    const wanInput: Record<string, any> = {
      prompt: inputs.prompt || 'person speaking',
      image: videoUrl,
      audio: audioUrl,
    };
    
    if (inputs.num_frames_per_chunk !== undefined) {
      wanInput.num_frames_per_chunk = Number(inputs.num_frames_per_chunk) || 81;
    }
    if (inputs.seed !== undefined && inputs.seed !== null && inputs.seed !== '') {
      wanInput.seed = Number(inputs.seed);
    }
    if (inputs.interpolate !== undefined) {
      wanInput.interpolate = inputs.interpolate === true || inputs.interpolate === 'true';
    }
    
    console.log(`[RunLipsync] Wan inputs:`, JSON.stringify(wanInput, null, 2));
    
    const res = await fetch(`${origin}/api/replicate/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'wan-video/wan-2.2-s2v',
        input: wanInput,
      }),
    });
    
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    const predictionId = json?.id;
    if (!predictionId) throw new Error('Wan S2V missing prediction id');
    
    console.log(`[RunLipsync] Wan job created: ${predictionId}, polling status...`);
    
    for (let i = 0; i < 120; i++) { // 10 minutes max (120 * 5s)
      await sleep(5000);
      const statusRes = await fetch(`${origin}/api/replicate/status?id=${predictionId}`, { cache: 'no-store' });
      if (!statusRes.ok) continue;
      const statusJson = await statusRes.json();
      if (statusJson.status === 'succeeded') {
        const outputUrl = statusJson.outputUrl || (statusJson.output && typeof statusJson.output === 'string' ? statusJson.output : null);
        console.log(`[RunLipsync] ✓ Wan S2V completed: ${outputUrl}`);
        return { url: outputUrl || null };
      }
      if (statusJson.status === 'failed' || statusJson.status === 'canceled') {
        throw new Error(statusJson.error || 'Wan S2V failed');
      }
      if (i % 6 === 0) { // Log every 30 seconds
        console.log(`[RunLipsync] Wan S2V still processing... (${(i * 5) / 60} minutes elapsed)`);
      }
    }
    throw new Error('Wan S2V timed out after 10 minutes');
  }

  if (backend.includes('latentsync')) {
    const res = await fetch(`${origin}/api/latentsync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl, audioUrl, options: inputs.options || {} }),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    if (!json?.id) throw new Error('LatentSync missing job id');
    for (let i = 0; i < 60; i++) {
      await sleep(3000);
      const statusRes = await fetch(`${origin}/api/latentsync/status?id=${json.id}`, { cache: 'no-store' });
      if (!statusRes.ok) continue;
      const statusJson = await statusRes.json();
      if (statusJson.status === 'succeeded') return { url: statusJson.outputUrl || null };
      if (statusJson.status === 'failed' || statusJson.status === 'canceled') {
        throw new Error(statusJson.error || 'LatentSync failed');
      }
    }
    throw new Error('LatentSync timed out');
  }

  const res = await fetch(`${origin}/api/lipsync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoUrl, audioUrl, options: { backend } }),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  if (!json?.id) throw new Error('Lipsync missing job id');
  for (let i = 0; i < 60; i++) {
    await sleep(4000);
    const statusRes = await fetch(`${origin}/api/lipsync/status?id=${json.id}`, { cache: 'no-store' });
    if (!statusRes.ok) continue;
    const statusJson = await statusRes.json();
    if (statusJson.status === 'succeeded' || statusJson.status === 'finished') {
      const output = Array.isArray(statusJson.outputs) ? statusJson.outputs[0] : statusJson.outputs;
      const maybeUrl = typeof output === 'string' ? output : output?.url;
      return { url: maybeUrl || null };
    }
    if (statusJson.status === 'failed' || statusJson.status === 'error' || statusJson.status === 'cancelled') {
      throw new Error(statusJson.error || 'Lipsync failed');
    }
  }
  throw new Error('Lipsync timed out');
}

async function runBackgroundStep(origin: string, inputs: Record<string, any>): Promise<StepResult> {
  const res = await fetch(`${origin}/api/background/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_url: inputs.video_url || inputs.video }),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return { url: json?.url || null };
}

async function runEnhanceStep(origin: string, inputs: Record<string, any>): Promise<StepResult> {
  const res = await fetch(`${origin}/api/enhance/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputs),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return { url: json?.url || null };
}

async function runTranscriptionStep(origin: string, inputs: Record<string, any>): Promise<StepResult> {
  const res = await fetch(`${origin}/api/transcription/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputs),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return { text: json?.text || '', url: null };
}

async function runTtsStep(origin: string, inputs: Record<string, any>): Promise<StepResult> {
  const res = await fetch(`${origin}/api/tts/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputs),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return { url: json?.url || json?.audio || null };
}

async function executeStep(
  origin: string,
  step: AssistantPlanStep,
  outputs: Record<string, StepResult>,
  userId: string,
  resolvedInputs?: Record<string, any>,
): Promise<StepResult> {
  const injected = resolvedInputs || resolvePlaceholders(enforceDefaults(step, { ...step.inputs }), outputs);
  if (step.tool === 'image') return runImageStep(origin, step, injected);
  if (step.tool === 'video') return runVideoStep(origin, step, injected);
  if (step.tool === 'lipsync') return runLipsyncStep(origin, step, injected);
  if (step.tool === 'background_remove') return runBackgroundStep(origin, injected);
  if (step.tool === 'enhance') return runEnhanceStep(origin, injected);
  if (step.tool === 'transcription') return runTranscriptionStep(origin, injected);
  if (step.tool === 'tts') return runTtsStep(origin, { ...injected, user_id: injected.user_id || userId });
  throw new Error(`Unsupported tool: ${step.tool}`);
}

function validateSteps(steps: AssistantPlanStep[]): string | null {
  if (!Array.isArray(steps) || steps.length === 0) return 'No steps provided';
  for (const step of steps) {
    if (!step.tool) return 'Step missing tool';
    if (!step.model) return 'Step missing model';
  }
  return null;
}

function buildAutoPrompt(step: AssistantPlanStep, planSummary: string | undefined, outputs: Record<string, StepResult>): string {
  const taskLabel = (step.title || step.description || '').trim();
  
  // VIDEO: Motion-only prompts - NEVER describe visuals
  if (step.tool === 'video') {
    // Extract motion hints from step title/description
    const hasMotionHints = /(?:dolly|pan|zoom|static|stable|trembl|shak|move|motion|camera)/i.test(taskLabel);
    
    if (hasMotionHints) {
      // Use the title as-is if it already describes motion
      return `${taskLabel}. Maintain visual consistency with the start frame. Smooth motion, 4 seconds.`;
    }
    
    // Default video prompt - pure motion description
    return 'Static camera, subject remains in frame, subtle natural micro-movements for realism, smooth and stable footage, 4 second duration.';
  }
  
  // IMAGE: Visual-only prompts - NEVER describe motion
  if (step.tool === 'image') {
    // Check if step has specific content to display
    const textContent = step.inputs?.text_content || step.inputs?.display_text;
    
    if (textContent) {
      return `Professional product photography, clean composition, soft studio lighting, featuring text "${textContent}" prominently displayed, high resolution still image.`;
    }
    
    if (taskLabel) {
      // Clean any motion language from the title
      const cleanTitle = taskLabel.replace(/(?:animate|animation|motion|video)/gi, '').trim();
      return `${cleanTitle}. Professional quality, clean composition, soft lighting, high resolution still.`;
    }
    
    return 'Professional product photography, clean composition, soft studio lighting, high resolution still image.';
  }
  
  // TTS: Just the text to speak
  if (step.tool === 'tts') {
    if (step.inputs?.text && typeof step.inputs.text === 'string') {
      return step.inputs.text;
    }
    return taskLabel || 'Welcome to our presentation.';
  }
  
  // LIPSYNC: Minimal prompt needed
  if (step.tool === 'lipsync') {
    return 'Natural lip synchronization with accurate timing.';
  }
  
  // ENHANCE: Enhancement description
  if (step.tool === 'enhance') {
    return taskLabel || 'Enhance image quality and resolution.';
  }
  
  // BACKGROUND_REMOVE: Subject preservation
  if (step.tool === 'background_remove') {
    return taskLabel || 'Remove background while preserving the main subject.';
  }
  
  // TRANSCRIPTION: No prompt needed
  if (step.tool === 'transcription') {
    return '';
  }
  
  // Fallback
  return taskLabel || 'Generate the requested output.';
}

function buildAssistantOptions(summary: string | undefined, steps: AssistantPlanStep[], outputs: Record<string, StepResult>, inputs: Record<string, Record<string, any>>) {
  return {
    source: 'assistant',
    summary: summary || '',
    steps: steps.map((s) => ({
      id: s.id,
      title: s.title,
      model: s.model,
      tool: s.tool,
      inputs: inputs[s.id] || s.inputs || {},
      output: outputs[s.id] || null,
    })),
  };
}

export async function POST(req: NextRequest) {
  let body: RunRequestBody | null = null;
  try {
    body = (await req.json()) as RunRequestBody;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (!body?.user_id) return new Response('Missing user_id', { status: 401 });
  const error = validateSteps(body.steps);
  if (error) return new Response(error, { status: 400 });

  const origin = new URL(req.url).origin;
  const { stream, write, close } = createSSEStream();

  (async () => {
    const outputs: Record<string, StepResult> = { ...(body.previous_outputs || {}) };
    const usedInputs: Record<string, Record<string, any>> = {};
    let taskId: string | null = null;
    try {
      taskId = await createTask(origin, body.user_id, body.plan_summary, body.steps);
      if (taskId) write({ type: 'task', taskId });

      for (const step of body.steps) {
        const stepStartTime = Date.now();
        write({ type: 'step_start', stepId: step.id, title: step.title });
        
        try {
          const injected = resolvePlaceholders(enforceDefaults(step, { ...step.inputs }), outputs);
          
          // Generate prompt if missing
          if (!injected.prompt || (typeof injected.prompt === 'string' && injected.prompt.trim().length === 0)) {
            console.log(`[Run] ⚠️  Step ${step.id} missing prompt, generating...`);
            injected.prompt = await buildSmartPrompt(step, body.plan_summary, outputs, body.user_messages);
          }
          
          // LOG EXACT PROMPT BEING SENT
          console.log(`\n${'='.repeat(80)}`);
          console.log(`[Run] 🎯 EXECUTING STEP: ${step.title} (${step.id})`);
          console.log(`[Run] Tool: ${step.tool} | Model: ${step.model}`);
          console.log(`[Run] PROMPT BEING SENT TO API:`);
          console.log(`${'─'.repeat(80)}`);
          console.log(injected.prompt);
          console.log(`${'─'.repeat(80)}`);
          console.log(`[Run] Full inputs:`, JSON.stringify(injected, null, 2).slice(0, 500));
          console.log(`${'='.repeat(80)}\n`);
          
          // Long-running operations warning
          if (step.tool === 'video') {
            console.log(`[Run] ⏳ Video generation may take 2-10 minutes, please wait...`);
          }
          
          usedInputs[step.id] = injected;
          const result = await executeStep(origin, step, outputs, body!.user_id, injected);
          outputs[step.id] = { url: result.url || null, text: result.text || null };
          
          const stepElapsed = ((Date.now() - stepStartTime) / 1000).toFixed(1);
          console.log(`[Run] ✓ Step ${step.id} completed in ${stepElapsed}s: ${result.url || result.text || 'no output'}`);
          
          write({ type: 'step_complete', stepId: step.id, outputUrl: result.url || null, outputText: result.text || null });
          await updateTask(origin, taskId, {
            status: 'running',
            options_json: buildAssistantOptions(body.plan_summary, body.steps, outputs, usedInputs),
            output_url: result.url || null,
            output_text: result.text || null,
          });
        } catch (stepErr: any) {
          const stepElapsed = ((Date.now() - stepStartTime) / 1000).toFixed(1);
          const message = stepErr?.message || 'Step failed';
          console.error(`[Run] ❌ Step ${step.id} failed after ${stepElapsed}s: ${message}`);
          
          write({ type: 'step_error', stepId: step.id, error: message });
          await updateTask(origin, taskId, {
            status: 'error',
            options_json: buildAssistantOptions(body.plan_summary, body.steps, outputs, usedInputs),
          });
          write({ type: 'done', status: 'error', outputs });
          close();
          return;
        }
      }

      await updateTask(origin, taskId, {
        status: 'finished',
        options_json: buildAssistantOptions(body.plan_summary, body.steps, outputs, usedInputs),
      });
      write({ type: 'done', status: 'success', outputs });
      close();
    } catch (err: any) {
      const message = err?.message || 'Workflow failed';
      write({ type: 'step_error', stepId: 'workflow', error: message });
      if (taskId) await updateTask(origin, taskId, { status: 'error', options_json: { source: 'assistant', error: message } });
      write({ type: 'done', status: 'error' });
      close();
    }
  })();

  return new Response(stream, { headers: sseHeaders() });
}

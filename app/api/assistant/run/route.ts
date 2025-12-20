export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest } from 'next/server';
import { createSSEStream, sseHeaders } from '@/lib/sse';
import type { AssistantPlanStep, AssistantRunEvent } from '@/types/assistant';

type StepResult = { url?: string | null; text?: string | null };

type RunRequestBody = {
  steps: AssistantPlanStep[];
  user_id: string;
  plan_summary?: string;
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
      const prop = matches[2] || 'url';
      const out = outputs[stepId];
      if (prop === 'text') return out?.text || value;
      return out?.url || value;
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
      if (maybeDep) inputs.start_image = `{{steps.${maybeDep}.output}}`;
    }
    if (!inputs.duration) inputs.duration = 4;
  }
  if (step.tool === 'image' && step.model === 'openai/gpt-image-1.5') {
    if (inputs.number_of_images === undefined) inputs.number_of_images = 1;
  }
  if (step.tool === 'tts' && !inputs.provider) {
    inputs.provider = 'replicate';
  }
  return coerceNumeric(inputs);
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

async function createTask(origin: string, userId: string, summary?: string): Promise<string | null> {
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
        options_json: { source: 'assistant', summary },
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
  const res = await fetch(`${origin}/api/veo/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...inputs, model: step.model }),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return { url: json?.url || (json?.raw?.url ?? null) };
}

async function runLipsyncStep(origin: string, step: AssistantPlanStep, inputs: Record<string, any>): Promise<StepResult> {
  const backend = (inputs.backend as string) || step.model || 'sievesync-1.1';
  const videoUrl = inputs.video || inputs.video_url || inputs.start_video;
  const audioUrl = inputs.audio || inputs.audio_url || inputs.voice;

  if (!videoUrl || !audioUrl) throw new Error('Missing video/audio URLs for lipsync');

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

async function executeStep(origin: string, step: AssistantPlanStep, outputs: Record<string, StepResult>, userId: string): Promise<StepResult> {
  const injected = resolvePlaceholders(enforceDefaults(step, { ...step.inputs }), outputs);
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
    let taskId: string | null = null;
    try {
      taskId = await createTask(origin, body.user_id, body.plan_summary);
      if (taskId) write({ type: 'task', taskId });

      for (const step of body.steps) {
        write({ type: 'step_start', stepId: step.id, title: step.title });
        try {
          const result = await executeStep(origin, step, outputs, body!.user_id);
          outputs[step.id] = { url: result.url || null, text: result.text || null };
          write({ type: 'step_complete', stepId: step.id, outputUrl: result.url || null, outputText: result.text || null });
          await updateTask(origin, taskId, {
            status: 'running',
            options_json: { source: 'assistant', step: step.id, output: result },
            output_url: result.url || null,
            output_text: result.text || null,
          });
        } catch (stepErr: any) {
          const message = stepErr?.message || 'Step failed';
          write({ type: 'step_error', stepId: step.id, error: message });
          await updateTask(origin, taskId, { status: 'error', options_json: { source: 'assistant', error: message } });
          write({ type: 'done', status: 'error', outputs });
          close();
          return;
        }
      }

      await updateTask(origin, taskId, { status: 'finished', options_json: { source: 'assistant', outputs } });
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

export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest } from 'next/server';
import { createSSEStream, sseHeaders } from '../../../../lib/sse';
import { getReplicateClient } from '../../../../lib/replicate';
import { appendVideos, getJobAsync, savePredictions } from '../../../../lib/autoEditStore';
import { STEP1_SYSTEM_PROMPT, STEP2_SYSTEM_PROMPT } from '../../../../lib/autoEditPrompts';
import type {
  ProgressEvent,
  ScriptSegment,
  VariantGenerationPlan,
  VariantVideoAsset,
  PredictionRef,
} from '../../../../types/auto-edit';

function outputToText(out: unknown): string {
  if (Array.isArray(out)) return out.map((x) => String(x)).join('');
  return String(out);
}

function looksLikeUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

function firstUrlFromAny(obj: unknown): string | null {
  if (!obj) return null;
  if (typeof obj === 'string') return looksLikeUrl(obj) ? obj : null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const u = firstUrlFromAny(item);
      if (u) return u;
    }
    return null;
  }
  if (typeof obj === 'object') {
    const maybeOutput = (obj as any).output ?? (obj as any).video ?? (obj as any).image ?? (obj as any).images ?? (obj as any).urls;
    if (maybeOutput) {
      const u = firstUrlFromAny(maybeOutput);
      if (u) return u;
    }
    // Try common fields
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      const val = (obj as any)[key];
      const u = firstUrlFromAny(val);
      if (u) return u;
    }
  }
  return null;
}

function normalizeSegments(val: unknown): ScriptSegment[] {
  if (Array.isArray(val)) return val as ScriptSegment[];
  if (val && typeof val === 'object' && Array.isArray((val as any).segments)) return (val as any).segments as ScriptSegment[];
  throw new Error('STEP_1 returned invalid format for segments');
}

function normalizePlans(val: unknown): VariantGenerationPlan[] {
  if (Array.isArray(val)) return val as VariantGenerationPlan[];
  if (val && typeof val === 'object' && Array.isArray((val as any).plans)) return (val as any).plans as VariantGenerationPlan[];
  throw new Error('STEP_2 returned invalid format for plans');
}

function normalizePlanIndexes(plans: VariantGenerationPlan[]): VariantGenerationPlan[] {
  // Ensure segment_id is string and variant_index is finite integer per segment
  const nextIndexBySeg = new Map<string, number>();
  const result: VariantGenerationPlan[] = [];
  for (const raw of plans) {
    const segmentId = String(raw.segment_id);
    const current = nextIndexBySeg.get(segmentId) ?? 0;
    const vi = Number.isFinite(raw.variant_index) ? Math.max(0, Math.floor(Number(raw.variant_index))) : current;
    const next = vi === current ? current + 1 : current;
    nextIndexBySeg.set(segmentId, next);
    result.push({ ...raw, segment_id: segmentId, variant_index: vi });
  }
  return result;
}

async function withRetries<T>(fn: () => Promise<T>, label: string, maxAttempts = 3): Promise<T> {
  let attempt = 0;
  let lastErr: unknown = null;
  const baseDelayMs = 800;
  while (attempt < maxAttempts) {
    try {
      // eslint-disable-next-line no-plusplus
      attempt++;
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt >= maxAttempts) break;
      const jitter = Math.floor(Math.random() * 300);
      const delay = baseDelayMs * attempt + jitter;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(`Failed after retries for ${label}: ${String((lastErr as Error)?.message || lastErr)}`);
}

function tryParseJSON<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {}
  // try to extract JSON array/object
  const firstBracket = raw.indexOf('[');
  const lastBracket = raw.lastIndexOf(']');
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  const sliceA = firstBracket >= 0 && lastBracket > firstBracket ? raw.slice(firstBracket, lastBracket + 1) : '';
  const sliceB = firstBrace >= 0 && lastBrace > firstBrace ? raw.slice(firstBrace, lastBrace + 1) : '';
  const candidate = sliceA.length >= sliceB.length ? sliceA : sliceB;
  if (candidate) {
    return JSON.parse(candidate) as T;
  }
  // final throw if still invalid
  return JSON.parse(raw) as T;
}

function assembleResults(
  segments: ScriptSegment[],
  plans: VariantGenerationPlan[],
  videos: VariantVideoAsset[],
): Record<string, { segment_text: string; variants: Array<{ plan: VariantGenerationPlan | null; video: VariantVideoAsset | null } | null> }> {
  const bySeg: Record<string, { segment_text: string; variants: Array<{ plan: VariantGenerationPlan | null; video: VariantVideoAsset | null } | null> }> = {};
  // Seed segments
  for (const s of segments) {
    bySeg[String(s.segment_id)] = { segment_text: s.segment_text, variants: [null, null, null] };
  }
  // Determine max variant index per segment
  const maxIndexBySeg = new Map<string, number>();
  for (const p of plans) {
    const seg = String(p.segment_id);
    const cur = maxIndexBySeg.get(seg) || 2;
    if (p.variant_index > cur) maxIndexBySeg.set(seg, p.variant_index);
  }
  for (const v of videos) {
    const seg = String(v.segment_id);
    const cur = maxIndexBySeg.get(seg) || 2;
    if (v.variant_index > cur) maxIndexBySeg.set(seg, v.variant_index);
  }
  // Resize arrays to fit max indices
  for (const [segId, maxIdx] of maxIndexBySeg.entries()) {
    if (!bySeg[segId]) continue;
    const needLen = Math.max(3, maxIdx + 1);
    if (bySeg[segId].variants.length < needLen) {
      bySeg[segId].variants.length = needLen;
      for (let i = 0; i < needLen; i++) if (typeof bySeg[segId].variants[i] === 'undefined') bySeg[segId].variants[i] = null;
    }
  }
  // Fill plans
  for (const p of plans) {
    const seg = String(p.segment_id);
    if (!bySeg[seg]) continue;
    const safeIdx = Number.isFinite(p.variant_index) ? Math.max(0, Math.min(p.variant_index, bySeg[seg].variants.length - 1)) : 0;
    const slot = bySeg[seg].variants[safeIdx];
    if (!slot) bySeg[seg].variants[safeIdx] = { plan: p, video: null };
    else slot.plan = p;
  }
  // Fill videos
  for (const v of videos) {
    const seg = String(v.segment_id);
    if (!bySeg[seg]) continue;
    const safeIdx = Number.isFinite(v.variant_index) ? Math.max(0, Math.min(v.variant_index, bySeg[seg].variants.length - 1)) : 0;
    const slot = bySeg[seg].variants[safeIdx];
    if (!slot) bySeg[seg].variants[safeIdx] = { plan: null, video: v };
    else slot.video = v;
  }
  return bySeg;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId') || '';
  if (!jobId) return new Response('Missing jobId', { status: 400 });

  const job = await getJobAsync(jobId);
  if (!job) return new Response('Unknown jobId', { status: 404 });

  const { stream, write, close } = createSSEStream();

  (async () => {
    const send = (event: Omit<ProgressEvent, 'jobId'>) => write({ jobId, ...event });
    try {
      const replicate = getReplicateClient();
      const imageModel = (process.env.REPLICATE_IMAGE_MODEL || 'black-forest-labs/flux-1.1-pro') as `${string}/${string}`;
      const wanModel = (process.env.REPLICATE_WAN_I2V_MODEL || 'wan-video/wan-2.2-i2v-fast') as `${string}/${string}`;

      // STEP 1 — Segment & Ideate
      send({ step: 'STEP_1', label: 'Segmenting script & ideating b-roll', status: 'RUNNING' });
      const step1Out = await withRetries(
        () =>
          replicate.run('anthropic/claude-3.5-sonnet', {
            input: {
              prompt: job.script,
              system_prompt: STEP1_SYSTEM_PROMPT,
              max_tokens: 8000,
              max_image_resolution: 0.5,
            },
          }) as Promise<unknown>,
        'STEP_1',
      );
      const step1Text = outputToText(step1Out);
      const segments = normalizeSegments(tryParseJSON<any>(step1Text));
      send({ step: 'STEP_1', label: 'Segmented', status: 'DONE', payload: { count: segments.length } });

      // STEP 2 — Plan & Select Image
      send({ step: 'STEP_2', label: 'Planning prompts & selecting references', status: 'RUNNING' });
      const step2Payload = JSON.stringify({ segments, uploads: job.uploads });
      const step2Out = await withRetries(
        () =>
          replicate.run('anthropic/claude-3.5-sonnet', {
            input: {
              prompt: step2Payload,
              system_prompt: STEP2_SYSTEM_PROMPT,
              max_tokens: 8000,
              max_image_resolution: 0.5,
            },
          }) as Promise<unknown>,
        'STEP_2',
      );
      const step2Text = outputToText(step2Out);
      const plansRaw = normalizePlans(tryParseJSON<any>(step2Text));
      const plans = normalizePlanIndexes(plansRaw);
      send({ step: 'STEP_2', label: 'Planned prompts', status: 'DONE', payload: { count: plans.length } });

      // STEP 2B — Synthesize stills
      const needsSynth = plans.filter((p) => !p.selected_image);
      if (needsSynth.length > 0) {
        send({ step: 'STEP_2B', label: `Synthesizing ${needsSynth.length} still(s)`, status: 'RUNNING', payload: { model: imageModel } });
        await Promise.all(
          needsSynth.map(async (plan) => {
            try {
              const synth = await withRetries(
                () =>
                  replicate.run(imageModel, {
                    input: { prompt: plan.prompt_text },
                  }) as Promise<unknown>,
                `STEP_2B:${plan.segment_id}#${plan.variant_index}`,
              );
              const synthUrl = (firstUrlFromAny(synth) || outputToText(synth)).trim();
              plan.synth_image_url = synthUrl;
              // server logs
              // eslint-disable-next-line no-console
              console.log('[STEP_2B] Still synthesized', { seg: plan.segment_id, var: plan.variant_index, url: synthUrl });
              send({ step: 'STEP_2B', label: 'Still synthesized', status: 'RUNNING', payload: { segment_id: plan.segment_id, variant: plan.variant_index } });
            } catch (e: unknown) {
              // eslint-disable-next-line no-console
              console.error('[STEP_2B] Synthesis failed', e);
              send({ step: 'STEP_2B', label: 'Still synthesis failed', status: 'FAILED', error: e instanceof Error ? e.message : 'Failed', payload: { segment_id: plan.segment_id, variant: plan.variant_index } });
            }
          }),
        );
        send({ step: 'STEP_2B', label: 'All stills done', status: 'DONE' });
      }

      // STEP 3 — WAN I2V
      // PHASE 1: Enqueue WAN predictions in batches (no waiting)
      send({ step: 'STEP_3', label: 'Enqueuing video generations', status: 'RUNNING', payload: { model: wanModel } });
      const predictions: PredictionRef[] = [];
      const token = process.env.REPLICATE_API_TOKEN as string;
      const proxyKey = process.env.SYNC_API_KEY || process.env.SYNC_PROXY_API_KEY || undefined;
      const REPLICATE_API = 'https://api.replicate.com/v1';

      const plansCopy = [...plans];
      const batchSize = 10;
      while (plansCopy.length > 0) {
        const batch = plansCopy.splice(0, batchSize);
        // eslint-disable-next-line no-console
        console.log('[STEP_3] Creating predictions batch', { count: batch.length });
        const created = await Promise.all(batch.map(async (plan) => {
          const userImageUrl = plan.selected_image ? (job.uploads.find((u) => u.fileName === plan.selected_image)?.url || '') : '';
          const imageUrl = userImageUrl || plan.synth_image_url || '';
          if (!imageUrl) return null;
          const desiredRes = plan.resolution === '720p' || plan.resolution === '1080p' ? '720p' : '480p';
          const aspectRatio = plan.aspect === '16:9' ? '16:9' : '9:16';
          try {
            // Resolve latest version id for the model
            const modelRes = await fetch(`${REPLICATE_API}/models/${wanModel}`, { headers: { Authorization: `Token ${token}` }, cache: 'no-store' });
            if (!modelRes.ok) throw new Error(await modelRes.text());
            const modelJson = await modelRes.json();
            const versionId = modelJson?.latest_version?.id;
            if (!versionId) throw new Error('No latest version found for model');

            const inputPayload: Record<string, unknown> = {
              image: imageUrl,
              prompt: plan.prompt_text,
              num_frames: plan.num_frames ?? 81,
              frames_per_second: plan.frames_per_second ?? 16,
              resolution: desiredRes,
              aspect_ratio: aspectRatio,
              go_fast: true,
              sample_shift: 12,
            };
            if (typeof plan.seed === 'number') inputPayload.seed = plan.seed;
            if (proxyKey) inputPayload.proxy_api_key = proxyKey;

            const res = await fetch(`${REPLICATE_API}/predictions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
              body: JSON.stringify({ version: versionId, input: inputPayload }),
            });
            if (!res.ok) throw new Error(await res.text());
            const json = await res.json();
            const ref: PredictionRef = { segment_id: String(plan.segment_id), variant_index: Number.isFinite(plan.variant_index) ? plan.variant_index : 0, prediction_id: json.id };
            return ref;
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[STEP_3] Prediction create failed', e);
            return null;
          }
        }));
        for (const c of created) if (c) predictions.push(c);
      }

      await savePredictions(jobId, predictions);
      send({ step: 'STEP_3_ENQUEUED', label: 'Videos enqueued', status: 'DONE', payload: { count: predictions.length, predictions } });

      // Optionally flush any already finished predictions quickly (best-effort)
      try {
        const finished: VariantVideoAsset[] = [];
        for (const p of predictions) {
          const st = await fetch(`${REPLICATE_API}/predictions/${p.prediction_id}`, { headers: { Authorization: `Token ${token}` }, cache: 'no-store' });
          if (st.ok) {
            const j = await st.json();
            if (j.status === 'succeeded') {
              const url = (firstUrlFromAny(j.output) || '') as string;
              if (url) finished.push({ segment_id: p.segment_id, variant_index: p.variant_index, video_url: url, used_image_url: '', prompt_text: '', meta: { fps: 0, frames: 0, resolution: '' } });
            }
          }
        }
        if (finished.length) await appendVideos(jobId, finished);
      } catch {}

      // End Phase 1 stream here. Client will open /api/auto-edit/poll to gather results progressively.
      return new Response(stream, { headers: sseHeaders() });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Pipeline failed';
      // eslint-disable-next-line no-console
      console.error('[PIPELINE] Error', e);
      write({ jobId, step: 'ERROR', label: 'Error', status: 'FAILED', error: message });
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: sseHeaders() });
}



export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest } from 'next/server';
import { createSSEStream, sseHeaders } from '../../../../lib/sse';
import { getReplicateClient } from '../../../../lib/replicate';
import { getJobAsync } from '../../../../lib/autoEditStore';
import { STEP1_SYSTEM_PROMPT, STEP2_SYSTEM_PROMPT } from '../../../../lib/autoEditPrompts';
import type {
  ProgressEvent,
  ScriptSegment,
  VariantGenerationPlan,
  VariantVideoAsset,
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
      send({ step: 'STEP_3', label: 'Generating videos', status: 'RUNNING', payload: { model: wanModel } });
      const videoAssets = await Promise.all(
        plans.map(async (plan) => {
          const userImageUrl = plan.selected_image
            ? (job.uploads.find((u) => u.fileName === plan.selected_image)?.url || '')
            : '';
          const imageUrl = userImageUrl || plan.synth_image_url || '';
          if (!imageUrl) {
            send({ step: 'STEP_3', label: 'Missing image for plan', status: 'FAILED', error: `No image found for ${plan.segment_id}#${plan.variant_index}` });
            return null;
          }
          // WAN expects resolution enum ("480p" | "720p"), and aspect_ratio separately.
          const desiredRes = plan.resolution === '720p' || plan.resolution === '1080p' ? '720p' : '480p';
          const aspectRatio = plan.aspect === '16:9' ? '16:9' : '9:16';
          try {
            const wanOut = await withRetries(
              () =>
                replicate.run(wanModel, {
                  input: {
                    image: imageUrl,
                    prompt: plan.prompt_text,
                    num_frames: plan.num_frames ?? 81,
                    frames_per_second: plan.frames_per_second ?? 16,
                    resolution: desiredRes,
                    aspect_ratio: aspectRatio,
                    go_fast: true,
                    sample_shift: 12,
                    ...(typeof plan.seed === 'number' ? { seed: plan.seed } : {}),
                  },
                }) as Promise<unknown>,
              `STEP_3:${plan.segment_id}#${plan.variant_index}`,
            );
            const videoUrl = (firstUrlFromAny(wanOut) || outputToText(wanOut)).trim();
            const asset: VariantVideoAsset = {
              segment_id: String(plan.segment_id),
              variant_index: Number.isFinite(plan.variant_index) ? plan.variant_index : 0,
              video_url: videoUrl,
              used_image_url: imageUrl,
              prompt_text: plan.prompt_text,
              meta: {
                fps: plan.frames_per_second ?? 16,
                frames: plan.num_frames ?? 81,
                resolution: desiredRes,
                seed: plan.seed ?? null,
              },
            };
            // eslint-disable-next-line no-console
            console.log('[STEP_3] Video generated', { seg: plan.segment_id, var: plan.variant_index, url: videoUrl, res: desiredRes, ar: aspectRatio });
            send({ step: 'STEP_3', label: 'Video generated', status: 'RUNNING', payload: { segment_id: plan.segment_id, variant: plan.variant_index } });
            return asset;
          } catch (e: unknown) {
            // eslint-disable-next-line no-console
            console.error('[STEP_3] Video generation failed', e, { imageUrl, res: desiredRes, ar: aspectRatio, frames: plan.num_frames ?? 81, fps: plan.frames_per_second ?? 16 });
            send({ step: 'STEP_3', label: 'Video generation failed', status: 'FAILED', error: e instanceof Error ? e.message : 'Failed', payload: { segment_id: plan.segment_id, variant: plan.variant_index, imageUrl, resolution: desiredRes, aspect_ratio: aspectRatio } });
            return null;
          }
        }),
      );
      const videos: VariantVideoAsset[] = videoAssets.filter((v): v is VariantVideoAsset => Boolean(v));
      send({ step: 'STEP_3', label: 'All videos generated', status: 'DONE', payload: { count: videos.length } });

      // STEP 4 — Assemble & return
      send({ step: 'STEP_4', label: 'Assembling results', status: 'RUNNING' });
      const result = assembleResults(segments, plans, videos);
      // eslint-disable-next-line no-console
      console.log('[STEP_4] Assembled result summary', { segments: segments.length, plans: plans.length, videos: videos.length });
      send({ step: 'STEP_4', label: 'Complete', status: 'DONE', payload: result });
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



export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { createSSEStream, sseHeaders } from '../../../../lib/sse';
import { getReplicateClient } from '../../../../lib/replicate';
import { getJob } from '../../../../lib/autoEditStore';
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
  for (const s of segments) bySeg[s.segment_id] = { segment_text: s.segment_text, variants: [null, null, null] };
  for (const p of plans) {
    if (!bySeg[p.segment_id]) continue;
    if (!bySeg[p.segment_id].variants[p.variant_index]) {
      bySeg[p.segment_id].variants[p.variant_index] = { plan: p, video: null };
    } else {
      const slot = bySeg[p.segment_id].variants[p.variant_index];
      if (slot) slot.plan = p;
    }
  }
  for (const v of videos) {
    if (!bySeg[v.segment_id]) continue;
    if (!bySeg[v.segment_id].variants[v.variant_index]) {
      bySeg[v.segment_id].variants[v.variant_index] = { plan: null, video: v };
    } else {
      const slot = bySeg[v.segment_id].variants[v.variant_index];
      if (slot) slot.video = v;
    }
  }
  return bySeg;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId') || '';
  if (!jobId) return new Response('Missing jobId', { status: 400 });

  const job = getJob(jobId);
  if (!job) return new Response('Unknown jobId', { status: 404 });

  const { stream, write, close } = createSSEStream();

  (async () => {
    const send = (event: Omit<ProgressEvent, 'jobId'>) => write({ jobId, ...event });
    try {
      const replicate = getReplicateClient();

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
      const segments = tryParseJSON<ScriptSegment[]>(step1Text);
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
      const plans = tryParseJSON<VariantGenerationPlan[]>(step2Text);
      send({ step: 'STEP_2', label: 'Planned prompts', status: 'DONE', payload: { count: plans.length } });

      // STEP 2B — Synthesize stills
      const needsSynth = plans.filter((p) => !p.selected_image);
      if (needsSynth.length > 0) {
        send({ step: 'STEP_2B', label: `Synthesizing ${needsSynth.length} still(s)`, status: 'RUNNING' });
        await Promise.all(
          needsSynth.map(async (plan) => {
            try {
              const synth = await withRetries(
                () =>
                  replicate.run('black-forest-labs/flux-1.1-pro', {
                    input: { prompt: plan.prompt_text },
                  }) as Promise<unknown>,
                `STEP_2B:${plan.segment_id}#${plan.variant_index}`,
              );
              const synthUrl = outputToText(synth).trim();
              plan.synth_image_url = synthUrl;
              send({ step: 'STEP_2B', label: 'Still synthesized', status: 'RUNNING', payload: { segment_id: plan.segment_id, variant: plan.variant_index } });
            } catch (e: unknown) {
              send({ step: 'STEP_2B', label: 'Still synthesis failed', status: 'FAILED', error: e instanceof Error ? e.message : 'Failed', payload: { segment_id: plan.segment_id, variant: plan.variant_index } });
            }
          }),
        );
        send({ step: 'STEP_2B', label: 'All stills done', status: 'DONE' });
      }

      // STEP 3 — WAN I2V
      send({ step: 'STEP_3', label: 'Generating videos', status: 'RUNNING' });
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
          const resolution = plan.aspect === '9:16' ? '480x832' : '832x480';
          try {
            const wanOut = await withRetries(
              () =>
                replicate.run('wan-video/wan-2.2-i2v-fast', {
                  input: {
                    image: imageUrl,
                    prompt: plan.prompt_text,
                    num_frames: plan.num_frames ?? 81,
                    frames_per_second: plan.frames_per_second ?? 16,
                    resolution,
                    go_fast: true,
                    sample_shift: 12,
                    seed: plan.seed ?? null,
                  },
                }) as Promise<unknown>,
              `STEP_3:${plan.segment_id}#${plan.variant_index}`,
            );
            const videoUrl = outputToText(wanOut).trim();
            const asset: VariantVideoAsset = {
              segment_id: plan.segment_id,
              variant_index: plan.variant_index,
              video_url: videoUrl,
              used_image_url: imageUrl,
              prompt_text: plan.prompt_text,
              meta: {
                fps: plan.frames_per_second ?? 16,
                frames: plan.num_frames ?? 81,
                resolution,
                seed: plan.seed ?? null,
              },
            };
            send({ step: 'STEP_3', label: 'Video generated', status: 'RUNNING', payload: { segment_id: plan.segment_id, variant: plan.variant_index } });
            return asset;
          } catch (e: unknown) {
            send({ step: 'STEP_3', label: 'Video generation failed', status: 'FAILED', error: e instanceof Error ? e.message : 'Failed', payload: { segment_id: plan.segment_id, variant: plan.variant_index } });
            return null;
          }
        }),
      );
      const videos: VariantVideoAsset[] = videoAssets.filter((v): v is VariantVideoAsset => Boolean(v));
      send({ step: 'STEP_3', label: 'All videos generated', status: 'DONE', payload: { count: videos.length } });

      // STEP 4 — Assemble & return
      send({ step: 'STEP_4', label: 'Assembling results', status: 'RUNNING' });
      const result = assembleResults(segments, plans, videos);
      send({ step: 'STEP_4', label: 'Complete', status: 'DONE', payload: result });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Pipeline failed';
      write({ jobId, step: 'ERROR', label: 'Error', status: 'FAILED', error: message });
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: sseHeaders() });
}



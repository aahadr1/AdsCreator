export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest } from 'next/server';
import { createSSEStream, sseHeaders } from '../../../../lib/sse';
import { dbAppendVideos, dbListPredictions, dbListVideos, dbUpdatePrediction, dbSetJobStatus } from '../../../../lib/autoEditDb';
import type { VariantVideoAsset } from '../../../../types/auto-edit';

type PredRef = { segment_id: string; variant_index: number; prediction_id: string };

const REPLICATE_API = 'https://api.replicate.com/v1';

async function pollOnce(token: string, preds: PredRef[]): Promise<VariantVideoAsset[]> {
  const results: VariantVideoAsset[] = [];
  await Promise.all(preds.map(async (p) => {
    try {
      const res = await fetch(`${REPLICATE_API}/predictions/${p.prediction_id}`, { headers: { Authorization: `Token ${token}` }, cache: 'no-store' });
      if (!res.ok) return;
      const j = await res.json();
      if (j.status === 'succeeded') {
        const out = j.output;
        let url: string | null = null;
        if (typeof out === 'string') url = out;
        else if (Array.isArray(out)) url = typeof out[0] === 'string' ? out[0] : null;
        else if (out && typeof out === 'object' && typeof out.url === 'string') url = out.url;
        if (url) results.push({ segment_id: p.segment_id, variant_index: p.variant_index, video_url: url, used_image_url: '', prompt_text: '', meta: { fps: 0, frames: 0, resolution: '' } });
      }
    } catch {}
  }));
  return results;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId') || '';
  if (!jobId) return new Response('Missing jobId', { status: 400 });

  const preds = await dbListPredictions(jobId);
  if (preds.length === 0) return new Response('No predictions for job', { status: 404 });

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });

  const { stream, write, close } = createSSEStream();

  (async () => {
    try {
      const send = (ev: any) => write({ jobId, ...ev });
      send({ step: 'STEP_3', label: 'Polling video statuses', status: 'RUNNING' });
      const seen = new Set<string>();

      // Include any already saved videos (from best-effort quick pass)
      const existing = await dbListVideos(jobId);
      for (const ex of existing) seen.add(`${ex.segment_id}#${ex.variant_index}`);
      if (existing.length) send({ step: 'STEP_3', label: 'Recovered existing videos', status: 'RUNNING', payload: { count: existing.length } });

      const started = Date.now();
      while (Date.now() - started < 290_000) {
        const unfinished = preds.filter((p) => !seen.has(`${p.segment_id}#${p.variant_index}`));
        const batch = await pollOnce(token, unfinished.map((p) => ({ segment_id: p.segment_id, variant_index: p.variant_index, prediction_id: p.prediction_id })) as any);
        if (batch.length) {
          await dbAppendVideos(jobId, batch);
          for (const v of batch) {
            seen.add(`${v.segment_id}#${v.variant_index}`);
            send({ step: 'STEP_3', label: 'Video ready', status: 'RUNNING', payload: { segment_id: v.segment_id, variant: v.variant_index, video_url: v.video_url } });
          }
          // mark predictions succeeded where matched
          for (const pred of preds) {
            if (seen.has(`${pred.segment_id}#${pred.variant_index}`) && pred.status !== 'succeeded') {
              await dbUpdatePrediction(pred.id, { status: 'succeeded', output_url: existing.find((e) => e.segment_id === pred.segment_id && e.variant_index === pred.variant_index)?.video_url || null });
            }
          }
        }
        if (seen.size >= preds.length) break;
        await new Promise((r) => setTimeout(r, 2500));
      }

      const final = await dbListVideos(jobId);
      if (final.length >= preds.length) await dbSetJobStatus(jobId, 'DONE');
      send({ step: 'STEP_3', label: 'All videos collected (or window end)', status: 'DONE', payload: { count: final.length } });
    } catch (e: any) {
      write({ jobId, step: 'ERROR', label: 'Polling error', status: 'FAILED', error: e?.message || 'Failed' });
    } finally {
      close();
    }
  })();

  return new Response(stream, { headers: sseHeaders() });
}



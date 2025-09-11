import { createSupabaseServer } from './supabaseServer';
import type { StartJobRequest, VariantVideoAsset, PredictionRef } from '../types/auto-edit';

export async function dbInsertJob(jobId: string, data: StartJobRequest): Promise<void> {
  const sb = createSupabaseServer();
  const { error } = await sb.from('jobs').insert({ job_id: jobId, user_id: null, script: data.script, uploads: data.uploads || null, settings: data.settings || null, status: 'QUEUED' });
  if (error) throw new Error(`insert job failed: ${error.message}`);
}

export async function dbGetJob(jobId: string): Promise<{ job_id: string; script: string; uploads: any; settings: any } | null> {
  const sb = createSupabaseServer();
  const { data, error } = await sb.from('jobs').select('job_id, script, uploads, settings').eq('job_id', jobId).maybeSingle();
  if (error) throw new Error(`get job failed: ${error.message}`);
  return data as any;
}

export async function dbSetJobStatus(jobId: string, status: string): Promise<void> {
  const sb = createSupabaseServer();
  const { error } = await sb.from('jobs').update({ status }).eq('job_id', jobId);
  if (error) throw new Error(`update job status failed: ${error.message}`);
}

export async function dbSavePredictions(jobId: string, preds: PredictionRef[]): Promise<void> {
  if (preds.length === 0) return;
  const sb = createSupabaseServer();
  const rows = preds.map((p) => ({ job_id: jobId, user_id: null, segment_id: String(p.segment_id), variant_index: p.variant_index, prediction_id: p.prediction_id, status: 'starting' }));
  const { error } = await sb.from('predictions').insert(rows);
  if (error) throw new Error(`insert predictions failed: ${error.message}`);
}

export async function dbListPredictions(jobId: string): Promise<Array<{ id: string; segment_id: string; variant_index: number; prediction_id: string; status: string; output_url: string | null }>> {
  const sb = createSupabaseServer();
  const { data, error } = await sb.from('predictions').select('id, segment_id, variant_index, prediction_id, status, output_url').eq('job_id', jobId);
  if (error) throw new Error(`list predictions failed: ${error.message}`);
  return (data || []) as any;
}

export async function dbUpdatePrediction(id: string, fields: Partial<{ status: string; output_url: string | null; error: string | null; attempt_count: number }>): Promise<void> {
  const sb = createSupabaseServer();
  const { error } = await sb.from('predictions').update(fields).eq('id', id);
  if (error) throw new Error(`update prediction failed: ${error.message}`);
}

export async function dbAppendVideos(jobId: string, videos: VariantVideoAsset[]): Promise<void> {
  if (videos.length === 0) return;
  const sb = createSupabaseServer();
  const rows = videos.map((v) => ({ job_id: jobId, user_id: null, segment_id: String(v.segment_id), variant_index: v.variant_index, video_url: v.video_url, used_image_url: v.used_image_url, prompt_text: v.prompt_text, meta: v.meta }));
  const { error } = await sb.from('videos').insert(rows);
  if (error) throw new Error(`insert videos failed: ${error.message}`);
}

export async function dbListVideos(jobId: string): Promise<VariantVideoAsset[]> {
  const sb = createSupabaseServer();
  const { data, error } = await sb.from('videos').select('segment_id, variant_index, video_url, used_image_url, prompt_text, meta').eq('job_id', jobId);
  if (error) throw new Error(`list videos failed: ${error.message}`);
  return (data || []) as any;
}



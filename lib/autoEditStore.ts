import type { PredictionRef, StartJobRequest, VariantVideoAsset } from '../types/auto-edit';
import { getKvConfigFromEnv, kvGet, kvPut } from './cloudflareKv';

type JobData = StartJobRequest & { createdAt: number };

const store: Map<string, JobData> = new Map();

export function putJob(jobId: string, data: StartJobRequest): void {
  store.set(jobId, { ...data, createdAt: Date.now() });
}

export function getJob(jobId: string): JobData | null {
  return store.get(jobId) || null;
}

export function deleteJob(jobId: string): void {
  store.delete(jobId);
}

// Async variants with Cloudflare KV fallback (for serverless persistence)
export async function putJobAsync(jobId: string, data: StartJobRequest): Promise<void> {
  const cfg = getKvConfigFromEnv();
  if (cfg.accountId && cfg.namespaceId && cfg.apiToken) {
    await kvPut({ key: `autoedit:job:${jobId}`, value: { ...data, createdAt: Date.now() }, config: cfg });
    return;
  }
  putJob(jobId, data);
}

export async function getJobAsync(jobId: string): Promise<JobData | null> {
  const cfg = getKvConfigFromEnv();
  if (cfg.accountId && cfg.namespaceId && cfg.apiToken) {
    const val = await kvGet<JobData>({ key: `autoedit:job:${jobId}`, config: cfg });
    if (val) return val;
  }
  return getJob(jobId);
}

export async function savePredictions(jobId: string, preds: PredictionRef[]): Promise<void> {
  const cfg = getKvConfigFromEnv();
  if (cfg.accountId && cfg.namespaceId && cfg.apiToken) {
    await kvPut({ key: `autoedit:preds:${jobId}`, value: preds, config: cfg });
  } else {
    // memory fallback
    (store as any).set(`preds:${jobId}`, preds);
  }
}

export async function loadPredictions(jobId: string): Promise<PredictionRef[] | null> {
  const cfg = getKvConfigFromEnv();
  if (cfg.accountId && cfg.namespaceId && cfg.apiToken) {
    return (await kvGet<PredictionRef[]>({ key: `autoedit:preds:${jobId}`, config: cfg })) || null;
  }
  return ((store as any).get(`preds:${jobId}`) as PredictionRef[] | null) || null;
}

export async function appendVideos(jobId: string, videos: VariantVideoAsset[]): Promise<void> {
  const cfg = getKvConfigFromEnv();
  const key = `autoedit:videos:${jobId}`;
  if (cfg.accountId && cfg.namespaceId && cfg.apiToken) {
    const prev = (await kvGet<VariantVideoAsset[]>({ key, config: cfg })) || [];
    await kvPut({ key, value: [...prev, ...videos], config: cfg });
    return;
  }
  const k = `videos:${jobId}`;
  const prev = ((store as any).get(k) as VariantVideoAsset[] | null) || [];
  (store as any).set(k, [...prev, ...videos]);
}

export async function loadVideos(jobId: string): Promise<VariantVideoAsset[]> {
  const cfg = getKvConfigFromEnv();
  const key = `autoedit:videos:${jobId}`;
  if (cfg.accountId && cfg.namespaceId && cfg.apiToken) {
    return (await kvGet<VariantVideoAsset[]>({ key, config: cfg })) || [];
  }
  return ((store as any).get(`videos:${jobId}`) as VariantVideoAsset[] | null) || [];
}



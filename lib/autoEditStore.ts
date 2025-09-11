import type { StartJobRequest } from '../types/auto-edit';
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



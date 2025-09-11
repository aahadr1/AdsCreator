import type { StartJobRequest } from '../types/auto-edit';

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



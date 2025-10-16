import { getKvConfigFromEnv, kvGetMany, kvListKeysPage, kvListKeysPageMeta, taskListPrefix, type TaskRecord } from './cloudflareKv';

export type DashboardTask = {
  id: string;
  status: string;
  created_at: string;
  backend: string | null;
  video_url: string | null;
  audio_url: string | null;
  output_url: string | null;
  user_id?: string | null;
};

type GetTasksOptions = {
  limit?: number;
  concurrency?: number;
};

export async function getTasksFast(userId: string, opts: GetTasksOptions = {}): Promise<DashboardTask[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const concurrency = Math.min(Math.max(opts.concurrency ?? 12, 1), 32);

  if (!userId) return [];

  const config = getKvConfigFromEnv();
  if (!config.accountId || !config.namespaceId || !config.apiToken) {
    // Missing KV config; return empty swiftly
    return [];
  }

  const userPrefix = `${taskListPrefix}${userId}:`;

  // First try: list a single page of user-prefixed keys (fast path)
  const { keys, cursor } = await kvListKeysPage({ prefix: userPrefix, config, limit });
  let tasks: TaskRecord[] = [];

  if (keys.length) {
    const values = await kvGetMany<TaskRecord>({ keys, config, concurrency });
    tasks = values.filter(Boolean) as TaskRecord[];
  }

  // Fallback: scan a small global window with metadata prefilter if none found
  if (tasks.length === 0) {
    const { items } = await kvListKeysPageMeta({ prefix: taskListPrefix, config, limit: Math.min(limit, 100), cursor });
    const matched = items
      .filter((it) => (it.metadata as any)?.user_id === userId)
      .map((it) => it.name)
      .slice(0, limit);
    if (matched.length) {
      const values = await kvGetMany<TaskRecord>({ keys: matched, config, concurrency });
      tasks = values.filter(Boolean) as TaskRecord[];
    }
  }

  tasks.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  // Map to slim shape for dashboard usage
  const slim: DashboardTask[] = tasks.map((t) => ({
    id: t.id,
    status: t.status,
    created_at: t.created_at,
    backend: t.backend ?? null,
    video_url: t.video_url ?? null,
    audio_url: t.audio_url ?? null,
    output_url: t.output_url ?? null,
    user_id: t.user_id ?? null,
  }));

  return slim;
}



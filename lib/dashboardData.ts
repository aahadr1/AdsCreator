import { getKvConfigFromEnv, kvGetMany, kvListKeysPage, kvListKeysPageMeta, taskListPrefix, type TaskRecord } from './cloudflareKv';
import { fetchSupabaseTaskRecords, mergeTaskRecords, serializeTaskRecord } from './tasksData';

export type DashboardTask = {
  id: string;
  status: string;
  created_at: string;
  backend: string | null;
  video_url: string | null;
  audio_url: string | null;
  output_url: string | null;
  output_text?: string | null;
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
  const kvTasks = await getKvTasksForUser({ userId, limit, concurrency, config });
  const supabaseTasks = await fetchSupabaseTaskRecords(userId, limit);
  const merged = mergeTaskRecords(kvTasks, supabaseTasks, limit);

  // Map to slim shape for dashboard usage
  const slim: DashboardTask[] = merged.map((t) => serializeTaskRecord(t));

  return slim;
}

type KvTaskOptions = {
  userId: string;
  limit: number;
  concurrency: number;
  config: ReturnType<typeof getKvConfigFromEnv>;
};

async function getKvTasksForUser({ userId, limit, concurrency, config }: KvTaskOptions): Promise<TaskRecord[]> {
  if (!config.accountId || !config.namespaceId || !config.apiToken) {
    return [];
  }

  const userPrefix = `${taskListPrefix}${userId}:`;
  const { keys, cursor } = await kvListKeysPage({ prefix: userPrefix, config, limit });
  let tasks: TaskRecord[] = [];

  if (keys.length) {
    const values = await kvGetMany<TaskRecord>({ keys, config, concurrency });
    tasks = values.filter(Boolean) as TaskRecord[];
  }

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
  return tasks;
}




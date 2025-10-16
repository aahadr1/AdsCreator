import { NextRequest } from 'next/server';
import { getKvConfigFromEnv, kvGet, kvGetMany, kvListKeysPage, kvListKeysPageMeta, TaskRecord, taskListPrefix } from '@/lib/cloudflareKv';
import { fetchSupabaseTaskRecords, mergeTaskRecords, serializeTaskRecord } from '@/lib/tasksData';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const started = Date.now();
    const config = getKvConfigFromEnv();
    if (!config.accountId || !config.namespaceId || !config.apiToken) {
      return new Response(JSON.stringify({ tasks: [] }), { headers: { 'content-type': 'application/json' } });
    }

    const { searchParams } = new URL(req.url);
    const userId = (searchParams.get('user_id') || '').trim();
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100);
    const cursor = searchParams.get('cursor');
    const controller = new AbortController();

    // Hard overall timeout to avoid blocking UI
    const timeoutMs = Math.min(Math.max(parseInt(searchParams.get('timeout_ms') || '2500', 10) || 2500, 500), 5000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let tasks: TaskRecord[] = [];
    let nextCursor: string | null = null;

    try {
      if (userId) {
        // Fast path: user-scoped prefix prevents global scans
        const userPrefix = `${taskListPrefix}${userId}:`;
        const { keys, cursor: c } = await kvListKeysPage({ prefix: userPrefix, config, limit, cursor });
        nextCursor = c;
        if (keys.length) {
          const values = await kvGetMany<TaskRecord>({ keys, config, concurrency: 10 });
          tasks = values.filter(Boolean) as TaskRecord[];
        }
        // Fallback: if no user-prefixed keys found, scan a small global window and prefilter by metadata
        if (tasks.length === 0) {
          const { items } = await kvListKeysPageMeta({ prefix: taskListPrefix, config, limit: Math.min(limit, 100), cursor });
          const matched = items.filter(it => (it.metadata as any)?.user_id === userId).map(it => it.name).slice(0, limit);
          if (matched.length) {
            const values = await kvGetMany<TaskRecord>({ keys: matched, config, concurrency: 10 });
            tasks = values.filter(Boolean) as TaskRecord[];
          }
        }
      } else {
        // Legacy fallback: scan a small window of global tasks with strict cap
        const { keys } = await kvListKeysPage({ prefix: taskListPrefix, config, limit: Math.min(limit, 50), cursor });
        if (keys.length) {
          const values = await kvGetMany<TaskRecord>({ keys, config, concurrency: 8 });
          tasks = (values.filter(Boolean) as TaskRecord[]).slice(0, limit);
        }
        if (process.env.NODE_ENV !== 'production') {
          console.warn('tasks/list: using legacy global scan without user_id; pass user_id to avoid slow scans');
        }
      }
    } catch (err) {
      // On timeout/abort or any error, return empty, do not block UI
      tasks = [];
      nextCursor = null;
    } finally {
      clearTimeout(timeout);
    }

    const supabaseTasks = await fetchSupabaseTaskRecords(userId, limit);
    const merged = mergeTaskRecords(tasks, supabaseTasks, limit);
    const serialized = merged.map(serializeTaskRecord);
    const body = JSON.stringify({ tasks: serialized, cursor: nextCursor });
    const duration = String(Date.now() - started);
    return new Response(body, {
      headers: { 'content-type': 'application/json', 'x-response-duration-ms': duration },
    });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}



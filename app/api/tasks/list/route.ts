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
    const limitParamRaw = (searchParams.get('limit') || '').trim().toLowerCase();
    let requestedLimit: number;
    const maxAllowed = 10000;
    if (!limitParamRaw || limitParamRaw === 'all') {
      requestedLimit = maxAllowed;
    } else {
      const parsed = parseInt(limitParamRaw, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        requestedLimit = Math.min(parsed, maxAllowed);
      } else {
        requestedLimit = maxAllowed;
      }
    }
    const isUnlimited = !Number.isFinite(requestedLimit);
    const cursor = searchParams.get('cursor');
    const controller = new AbortController();

    // Hard overall timeout to avoid blocking UI (allow more time for large lists)
    const timeoutMs = Math.min(Math.max(parseInt(searchParams.get('timeout_ms') || '8000', 10) || 8000, 500), 10000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const maxPageSize = 100;
    let tasks: TaskRecord[] = [];
    let nextCursor: string | null = null;
    let metaScanUsed = false;
    let kvCursor = cursor;

    const fetchKvPage = async (pageLimit: number, cursorToken: string | null): Promise<{ pageTasks: TaskRecord[]; cursor: string | null }> => {
      let pageTasks: TaskRecord[] = [];
      let cursorValue: string | null = null;

      if (userId) {
        const userPrefix = `${taskListPrefix}${userId}:`;
        const { keys, cursor: c } = await kvListKeysPage({
          prefix: userPrefix,
          config,
          limit: pageLimit,
          cursor: cursorToken ?? undefined,
        });
        cursorValue = c;
        if (keys.length) {
          const values = await kvGetMany<TaskRecord>({ keys, config, concurrency: 10 });
          pageTasks = values.filter(Boolean) as TaskRecord[];
        }
        if (pageTasks.length === 0 && !metaScanUsed) {
          metaScanUsed = true;
          const { items } = await kvListKeysPageMeta({
            prefix: taskListPrefix,
            config,
            limit: pageLimit,
            cursor: cursorToken ?? undefined,
          });
          const matched = items
            .filter((it) => (it.metadata as any)?.user_id === userId)
            .map((it) => it.name)
            .slice(0, pageLimit);
          if (matched.length) {
            const values = await kvGetMany<TaskRecord>({ keys: matched, config, concurrency: 10 });
            pageTasks = values.filter(Boolean) as TaskRecord[];
          }
          cursorValue = null;
        }
      } else {
        const { keys, cursor: c } = await kvListKeysPage({
          prefix: taskListPrefix,
          config,
          limit: pageLimit,
          cursor: cursorToken ?? undefined,
        });
        cursorValue = c;
        if (keys.length) {
          const values = await kvGetMany<TaskRecord>({ keys, config, concurrency: 8 });
          pageTasks = values.filter(Boolean) as TaskRecord[];
        }
      }

      return { pageTasks, cursor: cursorValue };
    };

    try {
      let loops = 0;
      while (true) {
        const remaining = Number.isFinite(requestedLimit) ? (requestedLimit as number) - tasks.length : Infinity;
        if (remaining <= 0) {
          nextCursor = kvCursor;
          break;
        }
        const pageLimit = Number.isFinite(remaining) ? Math.max(1, Math.min(maxPageSize, remaining)) : maxPageSize;
        const { pageTasks, cursor: updatedCursor } = await fetchKvPage(pageLimit, kvCursor);
        if (pageTasks.length) {
          tasks.push(...pageTasks);
        }
        kvCursor = updatedCursor;
        const exhausted = !updatedCursor || pageTasks.length === 0;
        if (exhausted || (!isUnlimited && tasks.length >= requestedLimit)) {
          nextCursor = updatedCursor;
          break;
        }
        loops += 1;
        if (loops > 200) {
          nextCursor = updatedCursor;
          break;
        }
      }
    } catch (err) {
      // On timeout/abort or any error, return empty, do not block UI
      tasks = [];
      nextCursor = null;
    } finally {
      clearTimeout(timeout);
    }

    if (!Number.isFinite(requestedLimit)) {
      nextCursor = null;
    } else if (Number.isFinite(requestedLimit) && typeof requestedLimit === 'number' && requestedLimit > 0) {
      tasks = tasks.slice(0, requestedLimit);
    }

    const supabaseTasks = await fetchSupabaseTaskRecords(userId, Number.isFinite(requestedLimit) ? requestedLimit : undefined);
    const merged = mergeTaskRecords(tasks, supabaseTasks, Number.isFinite(requestedLimit) ? requestedLimit : undefined);
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

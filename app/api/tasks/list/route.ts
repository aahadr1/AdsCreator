import { NextRequest } from 'next/server';
import { getKvConfigFromEnv, kvGet, kvListKeys, TaskRecord, taskListPrefix } from '@/lib/cloudflareKv';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const config = getKvConfigFromEnv();
    if (!config.accountId || !config.namespaceId || !config.apiToken) {
      return new Response('Cloudflare KV not configured', { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const userId = (searchParams.get('user_id') || '').trim();
    const keys = await kvListKeys({ prefix: taskListPrefix, config });
    const results: TaskRecord[] = [];
    for (const k of keys) {
      const rec = await kvGet<TaskRecord>({ key: k, config });
      if (!rec) continue;
      if (userId && rec.user_id !== userId) continue;
      results.push(rec);
    }
    // Sort by created_at desc
    results.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return Response.json({ tasks: results });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}



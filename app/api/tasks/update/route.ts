import { NextRequest } from 'next/server';
import { getKvConfigFromEnv, kvGet, kvPut, TaskRecord, taskKey } from '@/lib/cloudflareKv';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const config = getKvConfigFromEnv();
    if (!config.accountId || !config.namespaceId || !config.apiToken) {
      return new Response('Cloudflare KV not configured', { status: 500 });
    }
    const body = await req.json();
    const id = (body?.id as string) || '';
    if (!id) return new Response('Missing id', { status: 400 });

    const existing = await kvGet<TaskRecord>({ key: taskKey(id), config });
    if (!existing) return new Response('Not found', { status: 404 });

    const updated: TaskRecord = {
      ...existing,
      ...body,
      id: existing.id,
      updated_at: new Date().toISOString(),
    };

    await kvPut({ key: taskKey(id), value: updated, config });
    return Response.json(updated);
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}



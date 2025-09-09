import { NextRequest } from 'next/server';
import { getKvConfigFromEnv, kvPut, TaskRecord, taskKey } from '@/lib/cloudflareKv';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const config = getKvConfigFromEnv();
    if (!config.accountId || !config.namespaceId || !config.apiToken) {
      return new Response('Cloudflare KV not configured', { status: 500 });
    }

    const body = await req.json();
    const now = new Date().toISOString();
    const id: string = (body?.id as string) || crypto.randomUUID();
    const record: TaskRecord = {
      id,
      user_id: (body?.user_id as string) || null,
      type: (body?.type as string) || 'unknown',
      status: (body?.status as string) || 'queued',
      provider: (body?.provider as string) || null,
      model_id: (body?.model_id as string) || null,
      backend: (body?.backend as string) || null,
      options_json: (body?.options_json as Record<string, unknown>) || null,
      video_url: (body?.video_url as string) || null,
      audio_url: (body?.audio_url as string) || null,
      image_url: (body?.image_url as string) || null,
      text_input: (body?.text_input as string) || null,
      output_url: (body?.output_url as string) || null,
      job_id: (body?.job_id as string) || null,
      created_at: now,
      updated_at: now,
    };

    await kvPut({ key: taskKey(id), value: record, config });
    return Response.json(record);
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}



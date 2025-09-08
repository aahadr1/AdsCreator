import { NextRequest } from 'next/server';
import { SyncClient, SyncError } from '@sync.so/sdk';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoUrl, audioUrl, model, options } = body || {};
    if (!videoUrl || !audioUrl) return new Response('Missing videoUrl/audioUrl', { status: 400 });

    const apiKey = process.env.SYNC_API_KEY || process.env.NEXT_PUBLIC_SYNC_API_KEY;
    if (!apiKey) return new Response('Server misconfigured: missing SYNC_API_KEY', { status: 500 });

    const client = new SyncClient({ apiKey });
    const selectedModel: 'lipsync-2' | 'lipsync-2-pro' = model === 'lipsync-2' ? 'lipsync-2' : 'lipsync-2-pro';
    const response = await client.generations.create({
      input: [
        { type: 'video', url: videoUrl },
        { type: 'audio', url: audioUrl }
      ],
      model: selectedModel,
      options: options || {},
      outputFileName: 'lipsync'
    });

    return Response.json({ id: response.id, status: response.status });
  } catch (err: any) {
    if (err instanceof SyncError) {
      return new Response(JSON.stringify({ message: 'SyncError', statusCode: err.statusCode, error: err.body }), { status: 500 });
    }
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}

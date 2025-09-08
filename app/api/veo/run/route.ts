import { NextRequest } from 'next/server';
import Replicate from 'replicate';

type VeoInput = {
  prompt: string;
  model?: 'google/veo-3' | 'google/veo-3-fast' | 'bytedance/seedance-1-pro' | 'bytedance/seedance-1-lite';
  image?: string | null;
  negative_prompt?: string | null;
  resolution?: '720p' | '1080p';
  seed?: number | null;
  start_frame?: string | null;
  end_frame?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as (Partial<VeoInput> & { input?: Record<string, any> | null }) | null;
    if (!body || !body.prompt || typeof body.prompt !== 'string') {
      return new Response('Missing required field: prompt', { status: 400 });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });

    const replicate = new Replicate({ auth: token });

    const allowedModels = new Set([
      'google/veo-3',
      'google/veo-3-fast',
      'bytedance/seedance-1-pro',
      'bytedance/seedance-1-lite',
    ]);
    const model = allowedModels.has((body.model as string) || '')
      ? (body.model as string)
      : 'google/veo-3-fast';

    // Prefer client-provided input object when present for maximum flexibility per model
    let input: Record<string, any> | null = null;
    if (body.input && typeof body.input === 'object') {
      const cleaned: Record<string, any> = {};
      for (const [k, v] of Object.entries(body.input)) {
        if (v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '')) cleaned[k] = v;
      }
      // Ensure prompt is included
      cleaned.prompt = body.prompt;
      input = cleaned;
    } else {
      // Back-compat: construct minimal input based on known fields
      const base: Record<string, any> = { prompt: body.prompt };
      if (model.startsWith('google/veo')) {
        base.resolution = body.resolution || '720p';
        if (body.image) base.image = body.image;
        if (body.negative_prompt) base.negative_prompt = body.negative_prompt;
        if (typeof body.seed === 'number') base.seed = body.seed;
        if (body.start_frame) base.start_image = body.start_frame;
        if (body.end_frame) base.end_image = body.end_frame;
      }
      input = base;
    }

    const output = (await replicate.run(model, { input: input! })) as unknown;

    let url: string | null = null;
    if (output && typeof output === 'object' && 'url' in (output as any) && typeof (output as any).url === 'function') {
      try { url = (output as any).url(); } catch {}
    }
    if (!url && typeof output === 'string') {
      url = output;
    }
    if (!url && output && typeof (output as any).url === 'string') {
      url = (output as any).url;
    }

    return Response.json({ url, raw: output });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}



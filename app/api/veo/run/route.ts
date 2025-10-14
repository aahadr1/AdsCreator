import { NextRequest } from 'next/server';
import Replicate from 'replicate';

type VeoInput = {
  prompt: string;
  model?:
    | 'google/veo-3'
    | 'google/veo-3-fast'
    | 'bytedance/seedance-1-pro'
    | 'bytedance/seedance-1-lite'
    | 'wan-video/wan-2.2-i2v-fast'
    | 'wan-video/wan-2.2-animate-replace'
    | 'openai/sora-2'
    | 'openai/sora-2-pro';
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
    if (!body) return new Response('Missing body', { status: 400 });

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });

    const replicate = new Replicate({ auth: token });

    const allowedModels = new Set([
      'google/veo-3',
      'google/veo-3-fast',
      'bytedance/seedance-1-pro',
      'bytedance/seedance-1-lite',
      'wan-video/wan-2.2-i2v-fast',
      'wan-video/wan-2.2-animate-replace',
      'openai/sora-2',
      'openai/sora-2-pro',
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
      // Include prompt only when provided
      if (typeof body.prompt === 'string' && body.prompt.trim() !== '') cleaned.prompt = body.prompt;
      // Server-side validation for wan animate-replace
      if (model === 'wan-video/wan-2.2-animate-replace') {
        // Required fields
        if (typeof cleaned.video !== 'string' || !cleaned.video) {
          return new Response('Missing required field: video (uri)', { status: 400 });
        }
        if (typeof cleaned.character_image !== 'string' || !cleaned.character_image) {
          return new Response('Missing required field: character_image (uri)', { status: 400 });
        }
        // refert_num must be 1 or 5 if provided
        if (cleaned.refert_num !== undefined) {
          const rn = Number(cleaned.refert_num);
          if (!(rn === 1 || rn === 5)) {
            return new Response('Invalid refert_num: must be 1 or 5', { status: 400 });
          }
          cleaned.refert_num = rn;
        }
        // Coerce frames_per_second to integer when present
        if (cleaned.frames_per_second !== undefined) {
          const fps = parseInt(String(cleaned.frames_per_second), 10);
          if (!Number.isFinite(fps) || fps <= 0) {
            return new Response('Invalid frames_per_second', { status: 400 });
          }
          cleaned.frames_per_second = fps;
        }
      }
      input = cleaned;
    } else {
      // Back-compat: construct minimal input based on known fields
      const base: Record<string, any> = {};
      if (typeof body.prompt === 'string' && body.prompt.trim() !== '') base.prompt = body.prompt;
      if (model.startsWith('google/veo')) {
        base.resolution = body.resolution || '720p';
        if (body.image) base.image = body.image;
        if (body.negative_prompt) base.negative_prompt = body.negative_prompt;
        if (typeof body.seed === 'number') base.seed = body.seed;
        if (body.start_frame) base.start_image = body.start_frame;
        if (body.end_frame) base.end_image = body.end_frame;
      } else if (model === 'wan-video/wan-2.2-animate-replace') {
        // Without explicit input block, this model requires explicit URIs — reject to avoid ambiguous requests
        return new Response('Missing input for wan-video/wan-2.2-animate-replace', { status: 400 });
      }
      input = base;
    }

    const output = (await replicate.run(model as `${string}/${string}`, { input: input! })) as unknown;

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



import { NextRequest } from 'next/server';
import Replicate from 'replicate';

type FluxKontextInput = {
  prompt: string;
  input_image?: string | null;
  aspect_ratio?:
    | 'match_input_image'
    | '1:1'
    | '16:9'
    | '9:16'
    | '4:3'
    | '3:4'
    | '3:2'
    | '2:3'
    | '4:5'
    | '5:4'
    | '21:9'
    | '9:21'
    | '2:1'
    | '1:2';
  output_format?: 'jpg' | 'png';
  seed?: number | null;
  safety_tolerance?: number | null; // 0..6 (2 max when input_image used)
  prompt_upsampling?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as (Partial<FluxKontextInput> & { model?: string; image_input?: string[]; output_format?: 'jpg' | 'png' }) | null;
    if (!body || !body.prompt || typeof body.prompt !== 'string') {
      return new Response('Missing required field: prompt', { status: 400 });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });

    const replicate = new Replicate({ auth: token });

    const allowedModels = new Set([
      'black-forest-labs/flux-kontext-max',
      'google/nano-banana',
      'black-forest-labs/flux-krea-dev',
    ]);
    const model = allowedModels.has(String(body.model || ''))
      ? String(body.model)
      : 'black-forest-labs/flux-kontext-max';

    let input: Record<string, any> = { prompt: body.prompt };
    if (model === 'black-forest-labs/flux-kontext-max') {
      input = {
        prompt: body.prompt,
        aspect_ratio: body.aspect_ratio || 'match_input_image',
        output_format: body.output_format || 'png',
      };
      if (body.input_image) input.input_image = body.input_image;
      if (typeof body.seed === 'number') input.seed = body.seed;
      if (typeof body.prompt_upsampling === 'boolean') input.prompt_upsampling = body.prompt_upsampling;
      if (typeof body.safety_tolerance === 'number') input.safety_tolerance = body.safety_tolerance;
    } else if (model === 'google/nano-banana') {
      input = {
        prompt: body.prompt,
        output_format: body.output_format || 'jpg',
      };
      if (Array.isArray(body.image_input) && body.image_input.length > 0) {
        input.image_input = body.image_input;
      }
    } else if (model === 'black-forest-labs/flux-krea-dev') {
      input = {
        prompt: body.prompt,
        aspect_ratio: body.aspect_ratio || '1:1',
        output_format: (body.output_format as any) || 'webp',
      };
      if (typeof body.seed === 'number') input.seed = body.seed;
      if (body.input_image) input.image = body.input_image; // allow passing via input_image as well
      if (Array.isArray((body as any).image_input) && (body as any).image_input.length > 0) input.image = (body as any).image_input[0];
      if (typeof (body as any).guidance === 'number') input.guidance = (body as any).guidance;
      if (typeof (body as any).num_outputs === 'number') input.num_outputs = Math.min(4, Math.max(1, (body as any).num_outputs));
      if (typeof (body as any).output_quality === 'number') input.output_quality = Math.min(100, Math.max(0, (body as any).output_quality));
    }

    const output = (await replicate.run(model, { input })) as unknown;

    let url: string | null = null;
    if (Array.isArray(output) && output.length > 0) {
      // Some models return an array of URLs or file-like objects
      for (const item of output as any[]) {
        if (typeof item === 'string') {
          url = item;
          break;
        }
        if (item && typeof item === 'object') {
          if (typeof item.url === 'function') {
            try { url = item.url(); } catch {}
            if (url) break;
          }
          if (typeof item.url === 'string') {
            url = item.url;
            break;
          }
        }
      }
    }
    if (!url && output && typeof output === 'object' && 'url' in (output as any) && typeof (output as any).url === 'function') {
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



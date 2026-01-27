export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest } from 'next/server';

const REPLICATE_API = 'https://api.replicate.com/v1';

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

type OpenAiGptImageInput = {
  prompt: string;
  openai_api_key?: string;
  aspect_ratio?: string;
  input_fidelity?: string;
  input_images?: string[];
  number_of_images?: number;
  quality?: string;
  background?: string;
  output_compression?: number;
  output_format?: string;
  moderation?: string;
  user_id?: string;
};

type ImageRequestBody = Partial<FluxKontextInput> &
  Partial<OpenAiGptImageInput> & {
    model?: string;
    image_input?: string[];
    image?: string;
    resolution?: string;
    safety_filter_level?: string;
    guidance?: number;
    num_outputs?: number;
    output_quality?: number;
  };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ImageRequestBody | null;
    if (!body || !body.prompt || typeof body.prompt !== 'string') {
      return new Response('Missing required field: prompt', { status: 400 });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });

    const allowedModels = new Set([
      'black-forest-labs/flux-kontext-max',
      'black-forest-labs/flux-krea-dev',
      'openai/gpt-image-1.5',
      'google/nano-banana',
    ]);
    const model = allowedModels.has(String(body.model || ''))
      ? String(body.model)
      : 'google/nano-banana';

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
        aspect_ratio: typeof (body as any).aspect_ratio === 'string' ? (body as any).aspect_ratio : '9:16',
        output_format: typeof body.output_format === 'string' ? body.output_format : 'jpg',
      };
      if (Array.isArray(body.image_input) && body.image_input.length > 0) {
        input.image_input = body.image_input;
      }
    } else if (model === 'openai/gpt-image-1.5') {
      const format = typeof body.output_format === 'string' ? body.output_format.toLowerCase() : undefined;
      input = {
        prompt: body.prompt,
        output_format: format === 'jpg' ? 'jpeg' : (format || 'webp'),
        moderation: typeof (body as any).moderation === 'string' ? (body as any).moderation : 'low',
      };
      const maybeImages =
        Array.isArray((body as any).input_images) && (body as any).input_images.length > 0
          ? (body as any).input_images
          : Array.isArray((body as any).image_input) && (body as any).image_input.length > 0
              ? (body as any).image_input
              : null;
      if (maybeImages) {
        const sanitized = (maybeImages as unknown[])
          .map((url) => (typeof url === 'string' ? url.trim() : null))
          .filter((url): url is string => Boolean(url));
        if (sanitized.length > 0) input.input_images = sanitized;
      }
      // Validate and correct aspect_ratio for GPT Image 1.5 (only accepts: "1:1", "3:2", "2:3")
      if (typeof (body as any).aspect_ratio === 'string' && (body as any).aspect_ratio.trim()) {
        const providedRatio = (body as any).aspect_ratio.trim();
        const validRatios = ['1:1', '3:2', '2:3'];
        if (validRatios.includes(providedRatio)) {
          input.aspect_ratio = providedRatio;
        } else {
          // Invalid ratio - default to "2:3" for GPT Image 1.5
          console.warn(`[Image] Invalid aspect_ratio "${providedRatio}" for GPT Image 1.5. Valid options: ${validRatios.join(', ')}. Defaulting to "2:3".`);
          input.aspect_ratio = '2:3';
        }
      } else {
        // No aspect_ratio provided - default to "2:3" for GPT Image 1.5
        input.aspect_ratio = '2:3';
      }
      if (typeof (body as any).input_fidelity === 'string' && (body as any).input_fidelity.trim()) {
        input.input_fidelity = (body as any).input_fidelity.trim();
      }
      if (typeof (body as any).quality === 'string' && (body as any).quality.trim()) {
        input.quality = (body as any).quality.trim();
      }
      if (typeof (body as any).background === 'string' && (body as any).background.trim()) {
        input.background = (body as any).background.trim();
      }
      if (typeof (body as any).number_of_images === 'number' && Number.isFinite((body as any).number_of_images)) {
        const n = Math.min(10, Math.max(1, Math.floor((body as any).number_of_images)));
        input.number_of_images = n;
      }
      if (typeof (body as any).output_compression === 'number' && Number.isFinite((body as any).output_compression)) {
        const compression = Math.min(100, Math.max(0, Math.floor((body as any).output_compression)));
        input.output_compression = compression;
      }
      if (typeof (body as any).quality === 'string' && (body as any).quality.trim()) {
        input.quality = (body as any).quality.trim();
      }
      if (typeof (body as any).background === 'string' && (body as any).background.trim()) {
        input.background = (body as any).background.trim();
      }
      if (typeof (body as any).moderation === 'string' && (body as any).moderation.trim()) {
        input.moderation = (body as any).moderation.trim();
      } else if (!input.moderation) {
        input.moderation = 'low';
      }
      if (typeof (body as any).user_id === 'string' && (body as any).user_id.trim()) {
        input.user_id = (body as any).user_id.trim();
      }
      if (typeof (body as any).openai_api_key === 'string' && (body as any).openai_api_key.trim()) {
        input.openai_api_key = (body as any).openai_api_key.trim();
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
    const modelRes = await fetch(`${REPLICATE_API}/models/${model}`, {
      headers: { Authorization: `Token ${token}` },
      cache: 'no-store',
    });
    if (!modelRes.ok) {
      return new Response(await modelRes.text(), { status: modelRes.status });
    }
    const modelJson = await modelRes.json();
    const versionId = modelJson?.latest_version?.id;
    if (!versionId) {
      return new Response('No latest version found for model', { status: 404 });
    }

    const res = await fetch(`${REPLICATE_API}/predictions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify({ version: versionId, input }),
    });

    if (!res.ok) {
      return new Response(await res.text(), { status: res.status });
    }

    const prediction = await res.json();
    return Response.json({ id: prediction.id, status: prediction.status });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}

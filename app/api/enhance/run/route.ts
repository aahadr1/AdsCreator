import { NextRequest } from 'next/server';
import Replicate from 'replicate';

type EnhanceInput = {
  image: string;
  enhance_model?: string; // e.g., "Low Resolution V2"
  upscale_factor?: '2x' | '4x' | '6x';
  face_enhancement?: boolean;
  subject_detection?: 'Foreground' | 'Background' | 'Off';
  face_enhancement_creativity?: number; // 0..1
};

const MODEL_ID = 'topazlabs/image-upscale';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<EnhanceInput> | null;
    if (!body || !body.image || typeof body.image !== 'string') {
      return new Response('Missing required field: image', { status: 400 });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });

    const replicate = new Replicate({ auth: token });

    const input: Record<string, any> = {
      image: body.image,
    };
    if (typeof body.enhance_model === 'string') input.enhance_model = body.enhance_model;
    if (typeof body.upscale_factor === 'string') input.upscale_factor = body.upscale_factor;
    if (typeof body.face_enhancement === 'boolean') input.face_enhancement = body.face_enhancement;
    if (typeof body.subject_detection === 'string') input.subject_detection = body.subject_detection;
    if (typeof body.face_enhancement_creativity === 'number') input.face_enhancement_creativity = Math.max(0, Math.min(1, body.face_enhancement_creativity));

    const output = (await replicate.run(MODEL_ID, { input })) as unknown;

    let url: string | null = null;
    if (output && typeof (output as any).url === 'function') {
      try { url = (output as any).url(); } catch {}
    }
    if (!url && typeof (output as any).url === 'string') url = (output as any).url;
    if (!url && typeof output === 'string') url = output;

    return Response.json({ url, raw: output });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}





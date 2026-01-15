import { NextRequest } from 'next/server';
import Replicate from 'replicate';
import { loadUgcSession } from '@/lib/ugcStore';

export const runtime = 'nodejs';
export const maxDuration = 60;

const IMAGE_MODEL = 'google/nano-banana-pro';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
    const avatarId = typeof body?.avatarId === 'string' ? body.avatarId.trim() : '';
    const refinementPrompt = typeof body?.refinementPrompt === 'string' ? body.refinementPrompt.trim() : '';

    if (!sessionId) return Response.json({ error: 'Missing sessionId' }, { status: 400 });
    if (!avatarId) return Response.json({ error: 'Missing avatarId' }, { status: 400 });
    if (!refinementPrompt) return Response.json({ error: 'Missing refinementPrompt' }, { status: 400 });

    const session = await loadUgcSession(sessionId);
    if (!session) return Response.json({ error: 'Unknown session' }, { status: 404 });

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return Response.json({ error: 'Missing REPLICATE_API_TOKEN' }, { status: 500 });
    const replicate = new Replicate({ auth: token });

    const personas = Array.isArray(session.personas) ? session.personas : [];
    const persona = personas.find((p: any) => String(p?.id || '') === avatarId) || null;
    const basePrompt =
      (persona && typeof persona.imagePrompt === 'string' && persona.imagePrompt.trim())
        ? persona.imagePrompt.trim()
        : (typeof session.userRequest === 'string' ? session.userRequest : 'UGC creator portrait');

    const prompt =
      `${basePrompt}\n\nUser refinement: ${refinementPrompt}\n\n` +
      `Constraints: realistic phone camera look, vertical 9:16, selfie-style framing, natural skin texture, adult creator (21+).`;

    const prediction = await replicate.predictions.create({
      model: IMAGE_MODEL,
      input: {
        prompt,
        output_format: 'png',
        negative_prompt:
          'blurry, low quality, overprocessed, plastic skin, uncanny valley, ' +
          'cartoon, anime, illustration, CGI, 3d render, doll, mannequin, ' +
          'distorted face, asymmetrical eyes, bad teeth, extra fingers, extra limbs, ' +
          'warped hands, deformed, jpeg artifacts, watermark, logo, text, ' +
          'child, teenager, underage, school uniform',
      },
    } as any);

    return Response.json({
      avatarId,
      jobId: prediction.id,
      prompt,
      status: 'processing',
    });
  } catch (e: any) {
    console.error('[UGC Avatar Regen] Error:', e);
    return Response.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}


import { NextRequest } from 'next/server';
import Replicate from 'replicate';

export const runtime = 'nodejs';
export const maxDuration = 60;

const IMAGE_MODEL = 'google/nano-banana-pro';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sceneId, description, imagePrompt, selectedAvatarUrl, productImageUrl } = body;

    const promptToUse = (typeof imagePrompt === 'string' && imagePrompt.trim())
      ? imagePrompt
      : description;

    if (!sceneId || !promptToUse || !selectedAvatarUrl) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return Response.json({ error: 'Missing REPLICATE_API_TOKEN' }, { status: 500 });

    const replicate = new Replicate({ auth: token });

    const prediction = await replicate.predictions.create({
      model: IMAGE_MODEL,
      input: {
        prompt: `${promptToUse}\n\nConstraints: consistent character identity, realistic UGC phone camera look, 9:16 vertical.`,
        image_input:
          typeof productImageUrl === 'string' && productImageUrl.trim()
            ? [selectedAvatarUrl, productImageUrl.trim()]
            : [selectedAvatarUrl],
        output_format: "png",
        negative_prompt:
          "distorted, bad anatomy, different person, identity change, child, teenager, underage, " +
          "cartoon, anime, illustration, CGI, overprocessed, watermark, logo, text"
      }
    } as any);

    return Response.json({
      sceneId,
      jobId: prediction.id,
      status: 'processing'
    });

  } catch (error: any) {
    console.error('[UGC Scene Regen] Error:', error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}

import { NextRequest } from 'next/server';
import Replicate from 'replicate';
import { createBlock, type DynamicResponse } from '@/types/dynamicContent';
import { saveUgcSession } from '@/lib/ugcStore';

export const runtime = 'nodejs';
export const maxDuration = 60; // We'll return job IDs quickly

const VEO_MODEL = 'google/veo-3.1-fast';

function buildMotionPrompt(scene: any): string {
  const beat = (scene?.beatType as string | undefined) || '';
  const shot = (scene?.shotType as string | undefined) || '';
  const base = (scene?.motionPrompt as string | undefined) || '';
  const desc = (scene?.description as string | undefined) || '';

  if (base.trim()) return base.trim();

  const beatHints: Record<string, string> = {
    hook: 'fast pace, quick gesture, subtle push-in, energetic opening',
    problem: 'slower pace, concerned expression, small head shake',
    solution: 'confident nod, reveal moment, slight camera reposition',
    demo: 'hands demonstrate product/app, small tilts, focus on object/screen',
    cta: 'direct eye contact, assertive gesture, clear call-to-action',
  };
  const hint = beatHints[beat] || 'natural gestures, subtle movement';
  return `${desc}. ${shot ? `Shot: ${shot}. ` : ''}${hint}. Handheld phone camera micro-movements, subtle motion, UGC style. Do not change identity.`;
}

async function startVeoJob(replicate: Replicate, imageUrl: string, prompt: string, endImageUrl?: string) {
  const input: Record<string, any> = {
    image: imageUrl, // start_image
    prompt: prompt,
    resolution: '720p',
  };

  // If we have a next scene image, use it as end_frame for continuity
  if (endImageUrl) {
    input.end_image = endImageUrl;
  }
  
  const prediction = await replicate.predictions.create({
    model: VEO_MODEL,
    input
  } as any);
  
  return prediction.id;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { scenes, sessionId } = body; // Array of { id, imageUrl, description, script, motionPrompt?, beatType?, shotType? }

    if (!scenes || !Array.isArray(scenes)) return Response.json({ error: 'Missing scenes' }, { status: 400 });

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return Response.json({ error: 'Missing REPLICATE_API_TOKEN' }, { status: 500 });

    const replicate = new Replicate({ auth: token });

    const clipJobs = await Promise.all(scenes.map(async (scene: any, index: number) => {
      if (!scene?.id) return { sceneId: `unknown_${index}`, status: 'failed' as const, error: 'Missing scene id' };
      if (!scene.imageUrl) return { sceneId: scene.id, status: 'failed' as const, error: 'No image URL (scene image not ready)' };
      
      // Determine end image (next scene's image) for continuity
      // Only use if it exists and we aren't at the last scene
      const nextScene = scenes[index + 1];
      const endImageUrl = nextScene?.imageUrl;

      try {
        const prompt = buildMotionPrompt(scene);
        const jobId = await startVeoJob(replicate, scene.imageUrl, prompt, endImageUrl);
        return {
          sceneId: scene.id,
          jobId,
          status: 'processing' as const,
          prompt
        };
      } catch (e) {
        console.error(`Failed to start video job for scene ${scene.id}`, e);
        return {
          sceneId: scene.id,
          status: 'failed' as const,
          error: 'Failed to start video generation'
        };
      }
    }));

    const resultBlock = createBlock('ugc_clips_result', {
      sessionId: typeof sessionId === 'string' ? sessionId : undefined,
      clips: clipJobs
    });

    if (typeof sessionId === 'string' && sessionId.trim()) {
      await saveUgcSession(sessionId.trim(), { clips: clipJobs });
    }

    const response: DynamicResponse = {
      responseType: 'dynamic',
      blocks: [resultBlock],
      metadata: {
        nextAction: 'check_clips_status' // Frontend will poll these
      }
    };

    return Response.json(response);

  } catch (error: any) {
    console.error('[UGC Video Gen] Error:', error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}

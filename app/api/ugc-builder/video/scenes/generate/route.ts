import { NextRequest } from 'next/server';
import Replicate from 'replicate';
import { createBlock, type DynamicResponse } from '@/types/dynamicContent';

export const runtime = 'nodejs';
export const maxDuration = 60; // We'll return job IDs quickly

const VEO_MODEL = 'google/veo-3.1-fast';

async function startVeoJob(replicate: Replicate, imageUrl: string, prompt: string, endImageUrl?: string) {
  // Motion-only prompt as per plan
  const motionPrompt = `${prompt}. Handheld camera movement, subtle motion, UGC style.`;
  
  const input: Record<string, any> = {
    image: imageUrl, // start_image
    prompt: motionPrompt,
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
    const { scenes } = body; // Array of { id, imageUrl, description, script }

    if (!scenes || !Array.isArray(scenes)) return Response.json({ error: 'Missing scenes' }, { status: 400 });

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return Response.json({ error: 'Missing REPLICATE_API_TOKEN' }, { status: 500 });

    const replicate = new Replicate({ auth: token });

    const clipJobs = await Promise.all(scenes.map(async (scene: any, index: number) => {
      if (!scene.imageUrl) return { sceneId: scene.id, status: 'failed' as const, error: 'No image URL' };
      
      // Determine end image (next scene's image) for continuity
      // Only use if it exists and we aren't at the last scene
      const nextScene = scenes[index + 1];
      const endImageUrl = nextScene?.imageUrl;

      try {
        const jobId = await startVeoJob(replicate, scene.imageUrl, scene.description, endImageUrl);
        return {
          sceneId: scene.id,
          jobId,
          status: 'processing' as const,
          prompt: scene.description
        };
      } catch (e) {
        console.error(`Failed to start video job for scene ${scene.id}`, e);
        return {
          sceneId: scene.id,
          status: 'failed' as const
        };
      }
    }));

    const resultBlock = createBlock('ugc_clips_result', {
      clips: clipJobs
    });

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

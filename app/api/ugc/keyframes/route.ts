// =============================================================================
// KEYFRAME GENERATION API - Nano Banana Pro
// =============================================================================

import { NextRequest } from 'next/server';
import Replicate from 'replicate';
import { getProject, updateScene, generateId } from '@/lib/projectStore';
import { applyStyleBibleToKeyframePrompt } from '@/lib/styleBible';
import type { Keyframe, Scene } from '@/types/ugc';

export const runtime = 'nodejs';
export const maxDuration = 60;

const KEYFRAME_MODEL = 'google/imagen-3-fast';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type KeyframeRequest = {
  projectId: string;
  sceneId: string;
  keyframeId?: string; // If regenerating specific keyframe
  position?: 'first' | 'mid' | 'last';
  customPrompt?: string;
};

type KeyframeResponse = {
  success: boolean;
  keyframeId: string;
  jobId?: string;
  imageUrl?: string;
  error?: string;
};

// -----------------------------------------------------------------------------
// Generate Keyframe
// -----------------------------------------------------------------------------

async function generateKeyframe(
  replicate: Replicate,
  prompt: string,
  negativePrompt: string
): Promise<{ jobId: string }> {
  const prediction = await replicate.predictions.create({
    model: KEYFRAME_MODEL,
    input: {
      prompt,
      negative_prompt: negativePrompt,
      aspect_ratio: '9:16',
      output_format: 'png',
      safety_tolerance: 2,
    },
  } as any);
  
  return { jobId: prediction.id };
}

// -----------------------------------------------------------------------------
// POST - Generate keyframes for a scene
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body: KeyframeRequest = await req.json();
    const { projectId, sceneId, keyframeId, position, customPrompt } = body;
    
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return Response.json({ error: 'Missing REPLICATE_API_TOKEN' }, { status: 500 });
    }
    
    const project = await getProject(projectId);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }
    
    const scene = project.storyboard?.scenes.find(s => s.id === sceneId);
    if (!scene) {
      return Response.json({ error: 'Scene not found' }, { status: 404 });
    }
    
    const replicate = new Replicate({ auth: token });
    const results: KeyframeResponse[] = [];
    
    // Determine which keyframes to generate
    let keyframesToGenerate: { position: Keyframe['position']; prompt: string }[] = [];
    
    if (keyframeId) {
      // Regenerate specific keyframe
      const existingKf = scene.keyframes.find(k => k.id === keyframeId);
      if (existingKf) {
        keyframesToGenerate.push({
          position: existingKf.position,
          prompt: customPrompt || existingKf.prompt,
        });
      }
    } else if (position) {
      // Generate specific position
      keyframesToGenerate.push({
        position,
        prompt: customPrompt || scene.veoPrompt || scene.actionNotes || '',
      });
    } else {
      // Generate all keyframes for scene
      keyframesToGenerate = [
        { position: 'first', prompt: scene.veoPrompt || scene.actionNotes || '' },
        { position: 'last', prompt: scene.veoPrompt || scene.actionNotes || '' },
      ];
    }
    
    // Apply style bible if available
    const styleBible = project.styleBible;
    
    for (const kf of keyframesToGenerate) {
      let finalPrompt = kf.prompt;
      let negativePrompt = 'blurry, low quality, distorted, watermark';
      
      if (styleBible) {
        const styled = applyStyleBibleToKeyframePrompt(kf.prompt, styleBible, scene);
        finalPrompt = styled.positivePrompt;
        negativePrompt = styled.negativePrompt;
      }
      
      // Add position-specific details
      if (kf.position === 'first') {
        finalPrompt += '\n\nThis is the OPENING frame of the scene. Show the initial state.';
      } else if (kf.position === 'last') {
        finalPrompt += '\n\nThis is the ENDING frame of the scene. Show the final state.';
      } else {
        finalPrompt += '\n\nThis is a MIDDLE frame showing transition.';
      }
      
      try {
        const { jobId } = await generateKeyframe(replicate, finalPrompt, negativePrompt);
        
        const newKeyframeId = keyframeId || `${sceneId}_kf_${kf.position}_${Date.now()}`;
        
        // Update scene with new keyframe job
        const updatedKeyframes = scene.keyframes.map(k => {
          if (k.id === keyframeId || (k.position === kf.position && !keyframeId)) {
            return { ...k, id: newKeyframeId, status: 'processing' as const, imageJobId: jobId, prompt: finalPrompt };
          }
          return k;
        });
        
        // Add new keyframe if it doesn't exist
        if (!scene.keyframes.some(k => k.position === kf.position)) {
          updatedKeyframes.push({
            id: newKeyframeId,
            position: kf.position,
            status: 'processing',
            prompt: finalPrompt,
            imageJobId: jobId,
          } as Keyframe);
        }
        
        await updateScene(projectId, sceneId, { keyframes: updatedKeyframes });
        
        results.push({
          success: true,
          keyframeId: newKeyframeId,
          jobId,
        });
      } catch (error: any) {
        results.push({
          success: false,
          keyframeId: keyframeId || `${sceneId}_kf_${kf.position}`,
          error: error?.message || 'Generation failed',
        });
      }
    }
    
    return Response.json({ results });
    
  } catch (error: any) {
    console.error('[Keyframes API] Error:', error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// GET - Check keyframe job status
// -----------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const projectId = searchParams.get('projectId');
    const sceneId = searchParams.get('sceneId');
    const keyframeId = searchParams.get('keyframeId');
    
    if (!jobId) {
      return Response.json({ error: 'Missing jobId' }, { status: 400 });
    }
    
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return Response.json({ error: 'Missing REPLICATE_API_TOKEN' }, { status: 500 });
    }
    
    const replicate = new Replicate({ auth: token });
    const prediction = await replicate.predictions.get(jobId);
    
    const response: any = {
      jobId,
      status: prediction.status,
    };
    
    if (prediction.status === 'succeeded' && prediction.output) {
      const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
      response.imageUrl = outputUrl;
      
      // Update project if IDs provided
      if (projectId && sceneId && keyframeId) {
        const project = await getProject(projectId);
        const scene = project?.storyboard?.scenes.find(s => s.id === sceneId);
        if (scene) {
          const updatedKeyframes = scene.keyframes.map(k =>
            k.id === keyframeId
              ? { ...k, status: 'complete' as const, imageUrl: outputUrl }
              : k
          );
          await updateScene(projectId, sceneId, { keyframes: updatedKeyframes });
        }
      }
    } else if (prediction.status === 'failed') {
      response.error = prediction.error || 'Generation failed';
      
      // Update keyframe status to failed
      if (projectId && sceneId && keyframeId) {
        const project = await getProject(projectId);
        const scene = project?.storyboard?.scenes.find(s => s.id === sceneId);
        if (scene) {
          const updatedKeyframes = scene.keyframes.map(k =>
            k.id === keyframeId ? { ...k, status: 'failed' as const } : k
          );
          await updateScene(projectId, sceneId, { keyframes: updatedKeyframes });
        }
      }
    }
    
    return Response.json(response);
    
  } catch (error: any) {
    console.error('[Keyframes API] Status check error:', error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}

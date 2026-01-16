// =============================================================================
// VIDEO GENERATION API - Veo / Kling for clips
// =============================================================================

import { NextRequest } from 'next/server';
import Replicate from 'replicate';
import { getProject, addClip, updateClip, generateId } from '@/lib/projectStore';
import { applyStyleBibleToVideoPrompt } from '@/lib/styleBible';
import type { Clip, Scene } from '@/types/ugc';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Use Kling as video model (more accessible than Veo)
const VIDEO_MODEL = 'kwaivgi/kling-v1.6-pro';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type VideoRequest = {
  projectId: string;
  sceneId: string;
  clipId?: string; // If regenerating
  customPrompt?: string;
  feedback?: string[];
};

type VideoResponse = {
  success: boolean;
  clipId: string;
  jobId?: string;
  error?: string;
};

// -----------------------------------------------------------------------------
// Generate Video Clip
// -----------------------------------------------------------------------------

async function generateVideoClip(
  replicate: Replicate,
  prompt: string,
  negativePrompt: string,
  duration: number,
  startImageUrl?: string,
  endImageUrl?: string
): Promise<{ jobId: string }> {
  const input: any = {
    prompt,
    negative_prompt: negativePrompt,
    duration: Math.min(duration, 10), // Kling max 10s per clip
    aspect_ratio: '9:16',
    cfg_scale: 0.5,
  };
  
  // Add start/end images for continuity
  if (startImageUrl) {
    input.start_image = startImageUrl;
  }
  if (endImageUrl) {
    input.end_image = endImageUrl;
  }
  
  const prediction = await replicate.predictions.create({
    model: VIDEO_MODEL,
    input,
  } as any);
  
  return { jobId: prediction.id };
}

// -----------------------------------------------------------------------------
// Build Prompt with Auto-Fix
// -----------------------------------------------------------------------------

function buildPromptWithFeedback(
  basePrompt: string,
  feedback?: string[]
): string {
  if (!feedback || feedback.length === 0) return basePrompt;
  
  const fixes: string[] = [];
  
  for (const f of feedback) {
    switch (f) {
      case 'too-much-motion':
        fixes.push('IMPORTANT: Minimize camera movement, keep subject stable, smooth subtle motion only');
        break;
      case 'actor-looks-different':
        fixes.push('CRITICAL: Maintain exact same face, hair, and features throughout. Do not morph or change appearance.');
        break;
      case 'product-unclear':
        fixes.push('IMPORTANT: Keep product clearly visible and in focus. Show product prominently.');
        break;
      case 'lighting-inconsistent':
        fixes.push('IMPORTANT: Maintain consistent lighting throughout. No sudden changes in exposure or color temperature.');
        break;
      case 'text-artifacts':
        fixes.push('IMPORTANT: Avoid any text, letters, or symbols in the video. Clean visual only.');
        break;
    }
  }
  
  if (fixes.length > 0) {
    return `${basePrompt}\n\nAUTO-FIX REQUIREMENTS:\n${fixes.join('\n')}`;
  }
  
  return basePrompt;
}

// -----------------------------------------------------------------------------
// POST - Generate video for a scene
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body: VideoRequest = await req.json();
    const { projectId, sceneId, clipId, customPrompt, feedback } = body;
    
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return Response.json({ error: 'Missing REPLICATE_API_TOKEN' }, { status: 500 });
    }
    
    const project = await getProject(projectId);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }
    
    if (!project.storyboard?.isApproved) {
      return Response.json({ error: 'Storyboard must be approved before generating videos' }, { status: 400 });
    }
    
    const scene = project.storyboard.scenes.find(s => s.id === sceneId);
    if (!scene) {
      return Response.json({ error: 'Scene not found' }, { status: 404 });
    }
    
    // Check keyframes are ready
    const readyKeyframes = scene.keyframes.filter(k => k.status === 'complete' && k.imageUrl);
    if (readyKeyframes.length < 2) {
      return Response.json({ error: 'Scene needs at least 2 completed keyframes' }, { status: 400 });
    }
    
    const replicate = new Replicate({ auth: token });
    
    // Build prompt
    let basePrompt = customPrompt || scene.veoPrompt || scene.actionNotes || '';
    
    // Apply style bible
    if (project.styleBible) {
      const styled = applyStyleBibleToVideoPrompt(
        basePrompt,
        project.styleBible,
        scene,
        scene.keyframes
      );
      basePrompt = styled.positivePrompt;
    }
    
    // Apply feedback fixes
    const finalPrompt = buildPromptWithFeedback(basePrompt, feedback);
    const negativePrompt = project.styleBible?.negativePrompt || 
      'blurry, low quality, distorted, text, watermark, flickering';
    
    // Get keyframe images
    const firstKeyframe = scene.keyframes.find(k => k.position === 'first' && k.status === 'complete');
    const lastKeyframe = scene.keyframes.find(k => k.position === 'last' && k.status === 'complete');
    
    try {
      const { jobId } = await generateVideoClip(
        replicate,
        finalPrompt,
        negativePrompt,
        scene.duration,
        firstKeyframe?.imageUrl,
        lastKeyframe?.imageUrl
      );
      
      const newClipId = clipId || generateId();
      
      // Create or update clip
      if (clipId) {
        // Regenerating - update existing
        await updateClip(projectId, clipId, {
          jobId,
          status: 'processing',
          feedback: feedback as any,
        });
      } else {
        // New clip
        const clip: Omit<Clip, 'createdAt'> = {
          id: newClipId,
          sceneId,
          version: 1,
          jobId,
          status: 'processing',
          feedback: feedback as any,
        };
        await addClip(projectId, clip);
      }
      
      return Response.json({
        success: true,
        clipId: newClipId,
        jobId,
      } as VideoResponse);
      
    } catch (error: any) {
      return Response.json({
        success: false,
        clipId: clipId || '',
        error: error?.message || 'Video generation failed',
      } as VideoResponse);
    }
    
  } catch (error: any) {
    console.error('[Video API] Error:', error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// GET - Check video job status
// -----------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const projectId = searchParams.get('projectId');
    const clipId = searchParams.get('clipId');
    
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
    
    if (prediction.status === 'processing') {
      // Estimate progress based on logs if available
      response.progress = prediction.logs ? 50 : 25;
    }
    
    if (prediction.status === 'succeeded' && prediction.output) {
      const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
      response.videoUrl = outputUrl;
      
      // Update clip in project
      if (projectId && clipId) {
        await updateClip(projectId, clipId, {
          status: 'complete',
          videoUrl: outputUrl,
        });
      }
    } else if (prediction.status === 'failed') {
      response.error = prediction.error || 'Video generation failed';
      response.autoFixSuggestion = suggestAutoFix(prediction.error);
      
      // Update clip status
      if (projectId && clipId) {
        await updateClip(projectId, clipId, {
          status: 'failed',
          autoFixSuggestion: response.autoFixSuggestion,
        });
      }
    }
    
    return Response.json(response);
    
  } catch (error: any) {
    console.error('[Video API] Status check error:', error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// Auto-fix Suggestions
// -----------------------------------------------------------------------------

function suggestAutoFix(error?: string): string {
  if (!error) return 'Try regenerating with simpler prompt';
  
  const errorLower = error.toLowerCase();
  
  if (errorLower.includes('nsfw') || errorLower.includes('safety')) {
    return 'Content was flagged. Try making the prompt more conservative.';
  }
  
  if (errorLower.includes('timeout') || errorLower.includes('duration')) {
    return 'Generation took too long. Try shorter duration or simpler scene.';
  }
  
  if (errorLower.includes('image') || errorLower.includes('keyframe')) {
    return 'Issue with reference images. Try regenerating keyframes first.';
  }
  
  return 'Try regenerating with adjusted prompt or different keyframes.';
}

// -----------------------------------------------------------------------------
// POST /batch - Generate videos for all scenes
// -----------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId } = body;
    
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return Response.json({ error: 'Missing REPLICATE_API_TOKEN' }, { status: 500 });
    }
    
    const project = await getProject(projectId);
    if (!project?.storyboard?.isApproved) {
      return Response.json({ error: 'Storyboard must be approved' }, { status: 400 });
    }
    
    const replicate = new Replicate({ auth: token });
    const results: VideoResponse[] = [];
    
    for (const scene of project.storyboard.scenes) {
      // Skip if clip already exists and is complete
      const existingClip = project.clips.find(c => c.sceneId === scene.id && c.status === 'complete');
      if (existingClip) {
        results.push({ success: true, clipId: existingClip.id });
        continue;
      }
      
      // Check keyframes
      const readyKeyframes = scene.keyframes.filter(k => k.status === 'complete');
      if (readyKeyframes.length < 2) {
        results.push({ success: false, clipId: '', error: `Scene ${scene.order + 1} needs keyframes` });
        continue;
      }
      
      // Build and send request
      let prompt = scene.veoPrompt || scene.actionNotes || '';
      if (project.styleBible) {
        const styled = applyStyleBibleToVideoPrompt(prompt, project.styleBible, scene, scene.keyframes);
        prompt = styled.positivePrompt;
      }
      
      const firstKf = scene.keyframes.find(k => k.position === 'first');
      const lastKf = scene.keyframes.find(k => k.position === 'last');
      
      try {
        const { jobId } = await generateVideoClip(
          replicate,
          prompt,
          project.styleBible?.negativePrompt || 'blurry, distorted',
          scene.duration,
          firstKf?.imageUrl,
          lastKf?.imageUrl
        );
        
        const clipId = generateId();
        await addClip(projectId, {
          id: clipId,
          sceneId: scene.id,
          version: 1,
          jobId,
          status: 'processing',
        });
        
        results.push({ success: true, clipId, jobId });
      } catch (e: any) {
        results.push({ success: false, clipId: '', error: e?.message });
      }
    }
    
    return Response.json({ results });
    
  } catch (error: any) {
    console.error('[Video API] Batch error:', error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}

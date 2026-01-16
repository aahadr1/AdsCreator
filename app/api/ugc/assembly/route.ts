// =============================================================================
// ASSEMBLY API - Stitch clips, add subtitles, overlays, export
// =============================================================================

import { NextRequest } from 'next/server';
import { getProject, updateProject, setFinalEdit, generateId } from '@/lib/projectStore';
import type { FinalEdit, Clip, SubtitleConfig, OverlayConfig, EndCard, TransitionType } from '@/types/ugc';

export const runtime = 'nodejs';
export const maxDuration = 120;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type AssemblyRequest = {
  projectId: string;
  clipOrder?: string[]; // Override default order
  transitions?: Record<string, TransitionType>;
  subtitles?: SubtitleConfig;
  overlays?: OverlayConfig;
  endCard?: EndCard;
  musicTrackUrl?: string;
  musicVolume?: number;
  exportFormats?: ('9:16' | '1:1' | '16:9')[];
};

type AssemblyResponse = {
  success: boolean;
  finalEditId?: string;
  jobId?: string;
  previewUrl?: string;
  error?: string;
};

// -----------------------------------------------------------------------------
// Generate Subtitles from Script
// -----------------------------------------------------------------------------

function generateSubtitleTrack(
  clips: Clip[],
  scenes: { id: string; script: string; duration: number; onScreenText?: string }[]
): { text: string; start: number; end: number; style?: string }[] {
  const subtitles: { text: string; start: number; end: number; style?: string }[] = [];
  let currentTime = 0;
  
  for (const scene of scenes) {
    const clip = clips.find(c => c.sceneId === scene.id);
    if (!clip) continue;
    
    const duration = scene.duration;
    const script = scene.script || scene.onScreenText || '';
    
    if (script) {
      // Split into sentences for natural pacing
      const sentences = script.match(/[^.!?]+[.!?]+/g) || [script];
      const timePerSentence = duration / sentences.length;
      
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        if (sentence) {
          subtitles.push({
            text: sentence,
            start: currentTime + (i * timePerSentence),
            end: currentTime + ((i + 1) * timePerSentence),
          });
        }
      }
    }
    
    currentTime += duration;
  }
  
  return subtitles;
}

// -----------------------------------------------------------------------------
// Build Assembly Manifest
// -----------------------------------------------------------------------------

function buildAssemblyManifest(
  clips: Clip[],
  storyboard: any,
  config: AssemblyRequest
): any {
  const orderedClips = config.clipOrder
    ? config.clipOrder.map(id => clips.find(c => c.id === id)).filter(Boolean)
    : clips.sort((a, b) => {
        const sceneA = storyboard.scenes.find((s: any) => s.id === a.sceneId);
        const sceneB = storyboard.scenes.find((s: any) => s.id === b.sceneId);
        return (sceneA?.order || 0) - (sceneB?.order || 0);
      });
  
  const manifest: any = {
    version: '1.0',
    format: config.exportFormats?.[0] || '9:16',
    clips: orderedClips.map((clip, i) => ({
      id: clip!.id,
      url: clip!.videoUrl,
      sceneId: clip!.sceneId,
      order: i,
      transition: config.transitions?.[clip!.id] || 'cut',
    })),
    audio: {
      musicUrl: config.musicTrackUrl,
      musicVolume: config.musicVolume || 0.3,
      preserveOriginalAudio: true,
    },
  };
  
  // Add subtitles
  if (config.subtitles?.enabled) {
    const scenes = storyboard.scenes.map((s: any) => ({
      id: s.id,
      script: s.script,
      duration: s.duration,
      onScreenText: s.onScreenText,
    }));
    
    manifest.subtitles = {
      enabled: true,
      style: config.subtitles.style || 'ugc-bold',
      burnIn: config.subtitles.burnIn || false,
      track: generateSubtitleTrack(clips, scenes),
    };
  }
  
  // Add overlays
  if (config.overlays) {
    manifest.overlays = {
      benefitBullets: config.overlays.benefitBullets || false,
      priceOfferBadge: config.overlays.priceOfferBadge || false,
      ctaEndCard: config.overlays.ctaEndCard || false,
    };
  }
  
  // Add end card
  if (config.endCard) {
    manifest.endCard = {
      duration: 3,
      brandName: config.endCard.brandName,
      ctaText: config.endCard.ctaText,
      offerText: config.endCard.offerText,
      disclaimer: config.endCard.disclaimer,
      logoUrl: config.endCard.logoUrl,
    };
  }
  
  return manifest;
}

// -----------------------------------------------------------------------------
// POST - Create assembly job
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body: AssemblyRequest = await req.json();
    const { projectId } = body;
    
    const project = await getProject(projectId);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }
    
    // Check all clips are ready
    const readyClips = project.clips.filter(c => c.status === 'complete' && c.videoUrl);
    const sceneCount = project.storyboard?.scenes.length || 0;
    
    if (readyClips.length < sceneCount) {
      return Response.json({
        error: `Only ${readyClips.length}/${sceneCount} clips ready. Please wait for all clips to complete.`,
      }, { status: 400 });
    }
    
    // Build assembly manifest
    const manifest = buildAssemblyManifest(readyClips, project.storyboard, body);
    
    // For now, we'll simulate assembly (in production, this would call a video processing service)
    // The manifest would be sent to FFmpeg-based service or similar
    
    const finalEditId = generateId();
    const jobId = `assembly_${finalEditId}`;
    
    // Create final edit record
    const finalEdit: Omit<FinalEdit, 'id' | 'projectId' | 'createdAt' | 'updatedAt'> = {
      storyboardVersion: project.storyboardVersion,
      clipOrder: body.clipOrder || readyClips.map(c => c.id),
      transitions: body.transitions || {},
      subtitles: body.subtitles || { enabled: true, style: 'ugc-bold', burnIn: false },
      overlays: body.overlays || {},
      endCard: body.endCard,
      musicTrackUrl: body.musicTrackUrl,
      musicVolume: body.musicVolume,
      exportFormats: body.exportFormats || ['9:16'],
      exportJobId: jobId,
      exportStatus: 'processing',
    };
    
    await setFinalEdit(projectId, finalEdit);
    
    // In production: Send manifest to video processing service
    // For demo: Simulate completion after delay
    simulateAssemblyCompletion(projectId, finalEditId, readyClips[0].videoUrl!);
    
    return Response.json({
      success: true,
      finalEditId,
      jobId,
      manifest, // Include for debugging
    } as AssemblyResponse);
    
  } catch (error: any) {
    console.error('[Assembly API] Error:', error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// Simulate Assembly (Demo Mode)
// -----------------------------------------------------------------------------

async function simulateAssemblyCompletion(
  projectId: string,
  finalEditId: string,
  firstClipUrl: string
) {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const project = await getProject(projectId);
  if (!project?.finalEdit) return;
  
  // In demo mode, just return the first clip as "final"
  // In production, this would be the actual assembled video
  await setFinalEdit(projectId, {
    ...project.finalEdit,
    exportStatus: 'complete',
    finalVideoUrl: firstClipUrl, // Would be actual assembled video
  });
}

// -----------------------------------------------------------------------------
// GET - Check assembly status
// -----------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    
    if (!projectId) {
      return Response.json({ error: 'Missing projectId' }, { status: 400 });
    }
    
    const project = await getProject(projectId);
    if (!project?.finalEdit) {
      return Response.json({ error: 'No assembly job found' }, { status: 404 });
    }
    
    const response: any = {
      status: project.finalEdit.exportStatus,
      storyboardVersion: project.finalEdit.storyboardVersion,
    };
    
    if (project.finalEdit.exportStatus === 'complete') {
      response.finalVideoUrl = project.finalEdit.finalVideoUrl;
      response.downloadReady = true;
    } else if (project.finalEdit.exportStatus === 'processing') {
      response.progress = 50; // Simulated
      response.estimatedTimeRemaining = '30 seconds';
    }
    
    return Response.json(response);
    
  } catch (error: any) {
    console.error('[Assembly API] Status check error:', error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PATCH - Update assembly config
// -----------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const body: Partial<AssemblyRequest> = await req.json();
    const { projectId } = body as any;
    
    if (!projectId) {
      return Response.json({ error: 'Missing projectId' }, { status: 400 });
    }
    
    const project = await getProject(projectId);
    if (!project?.finalEdit) {
      return Response.json({ error: 'No final edit to update' }, { status: 404 });
    }
    
    const updates: Partial<FinalEdit> = {};
    
    if (body.clipOrder) updates.clipOrder = body.clipOrder;
    if (body.transitions) updates.transitions = body.transitions;
    if (body.subtitles) updates.subtitles = body.subtitles;
    if (body.overlays) updates.overlays = body.overlays;
    if (body.endCard) updates.endCard = body.endCard;
    if (body.musicTrackUrl !== undefined) updates.musicTrackUrl = body.musicTrackUrl;
    if (body.musicVolume !== undefined) updates.musicVolume = body.musicVolume;
    
    await setFinalEdit(projectId, {
      ...project.finalEdit,
      ...updates,
    });
    
    return Response.json({ success: true });
    
  } catch (error: any) {
    console.error('[Assembly API] Update error:', error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}

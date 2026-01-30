/**
 * Storyboard Orchestrator
 * 
 * Flexible orchestration of the 3 storyboard subtools.
 * The assistant can call these in sequence or individually as needed.
 */

import { MediaPool, checkRequiredAssets, getAsset, getApprovedScript } from '../types/mediaPool';
import { performReflexion, quickReflexion } from './reflexionHelper';

export type SubtoolType = 'video_scenarist' | 'video_director' | 'storyboard_prompt_creator';

export interface SubtoolResult {
  subtool: SubtoolType;
  naturalText: string;
  assetId: string;
  reflexion?: string;
}

export interface OrchestrationContext {
  conversationId: string;
  mediaPool: MediaPool;
  userIntent: string;
  style?: string;
  platform?: string;
  onProgress?: (event: OrchestrationEvent) => void;
  onReflexion?: (reflexion: string) => void;
}

export type OrchestrationEvent = {
  type: 'subtool_start' | 'subtool_progress' | 'subtool_complete' | 'reflexion' | 'error';
  subtool?: SubtoolType;
  data?: any;
};

/**
 * Execute full storyboard creation workflow
 * 
 * Runs all 3 subtools in sequence with reflexion checkpoints
 */
export async function executeFullStoryboardWorkflow(
  context: OrchestrationContext
): Promise<{
  sceneDescriptions: SubtoolResult;
  technicalDirection: SubtoolResult;
  framePrompts: SubtoolResult;
}> {
  
  // Check required assets
  const missing = checkRequiredAssets(context.mediaPool, {
    needsAvatar: true, // Most storyboards need an avatar
    needsScript: true,
  });
  
  if (missing.length > 0) {
    throw new Error(`Missing required assets: ${missing.join(', ')}`);
  }
  
  // Phase 1: Video Scenarist
  context.onProgress?.({
    type: 'subtool_start',
    subtool: 'video_scenarist',
  });
  
  const sceneDescriptions = await callSubtool('video_scenarist', {
    script: getApprovedScript(context.mediaPool)?.content || '',
    userIntent: context.userIntent,
    mediaPool: context.mediaPool,
    style: context.style,
    platform: context.platform,
  }, context.conversationId);
  
  context.onProgress?.({
    type: 'subtool_complete',
    subtool: 'video_scenarist',
    data: sceneDescriptions,
  });
  
  // Reflexion checkpoint 1
  const reflexion1 = await performReflexion({
    context: `Scene descriptions have been created by the scenarist.`,
    question: 'Do these scene descriptions match the user intent? Should we proceed to technical direction?',
    lastToolResult: { preview: sceneDescriptions.naturalText.substring(0, 500) },
  });
  
  context.onReflexion?.(reflexion1);
  sceneDescriptions.reflexion = reflexion1;
  
  // Check if we should proceed
  const check1 = await quickReflexion({
    question: 'Should we proceed with these scene descriptions?',
    data: sceneDescriptions.naturalText.substring(0, 500),
  });
  
  if (!check1.shouldProceed) {
    throw new Error(`Quality check failed: ${check1.reasoning}`);
  }
  
  // Phase 2: Video Director
  context.onProgress?.({
    type: 'subtool_start',
    subtool: 'video_director',
  });
  
  const technicalDirection = await callSubtool('video_director', {
    sceneDescriptions: sceneDescriptions.naturalText,
    userIntent: context.userIntent,
    mediaPool: context.mediaPool,
  }, context.conversationId);
  
  context.onProgress?.({
    type: 'subtool_complete',
    subtool: 'video_director',
    data: technicalDirection,
  });
  
  // Reflexion checkpoint 2
  const reflexion2 = await performReflexion({
    context: `Technical direction has been added by the director.`,
    question: 'Is the technical direction appropriate for the video type and user intent?',
    lastToolResult: { preview: technicalDirection.naturalText.substring(0, 500) },
  });
  
  context.onReflexion?.(reflexion2);
  technicalDirection.reflexion = reflexion2;
  
  // Phase 3: Storyboard Prompt Creator
  context.onProgress?.({
    type: 'subtool_start',
    subtool: 'storyboard_prompt_creator',
  });
  
  const framePrompts = await callSubtool('storyboard_prompt_creator', {
    sceneDescriptions: sceneDescriptions.naturalText,
    technicalDirection: technicalDirection.naturalText,
    mediaPool: context.mediaPool,
    avatarAssetId: context.mediaPool.activeAvatarId,
    productAssetId: context.mediaPool.activeProductId,
  }, context.conversationId);
  
  context.onProgress?.({
    type: 'subtool_complete',
    subtool: 'storyboard_prompt_creator',
    data: framePrompts,
  });
  
  // Final reflexion
  const reflexion3 = await performReflexion({
    context: `Frame prompts have been created. The storyboard is ready for image generation.`,
    question: 'Are the frame prompts precise and complete?',
    lastToolResult: { preview: framePrompts.naturalText.substring(0, 500) },
  });
  
  context.onReflexion?.(reflexion3);
  framePrompts.reflexion = reflexion3;
  
  return {
    sceneDescriptions,
    technicalDirection,
    framePrompts,
  };
}

/**
 * Execute a single subtool
 * 
 * Allows for flexible, individual subtool execution for modifications
 */
export async function executeSingleSubtool(
  subtool: SubtoolType,
  input: Record<string, any>,
  context: OrchestrationContext
): Promise<SubtoolResult> {
  
  context.onProgress?.({
    type: 'subtool_start',
    subtool: subtool,
  });
  
  const result = await callSubtool(subtool, input, context.conversationId);
  
  context.onProgress?.({
    type: 'subtool_complete',
    subtool: subtool,
    data: result,
  });
  
  // Reflexion for single subtool
  const reflexion = await performReflexion({
    context: `${subtool} has completed.`,
    question: 'Does this output look good? Any issues?',
    lastToolResult: { preview: result.naturalText.substring(0, 500) },
  });
  
  context.onReflexion?.(reflexion);
  result.reflexion = reflexion;
  
  return result;
}

/**
 * Parse natural frame prompts to extract structured data for image generation
 * 
 * This parses the natural text output from prompt_creator to extract:
 * - Scene numbers
 * - Frame descriptions (first/last)
 * - Reference image URLs
 */
export function parseNaturalFramePrompts(naturalText: string): ParsedFramePrompts {
  const scenes: ParsedScene[] = [];
  
  // Regex to match scene sections (flexible, forgiving)
  const sceneRegex = /SCENE\s+(\d+):\s*FIRST\s+FRAME\s+([\s\S]*?)(?=SCENE\s+\d+:\s*FIRST\s+FRAME|$)/gi;
  
  let match;
  while ((match = sceneRegex.exec(naturalText)) !== null) {
    const sceneNumber = parseInt(match[1]);
    const sceneText = match[2];
    
    // Extract first frame
    const firstFrameMatch = sceneText.match(/Visual description:\s*([\s\S]*?)(?=Reference images to use:|SCENE\s+\d+:\s*LAST\s+FRAME|$)/i);
    const firstFrameDesc = firstFrameMatch ? firstFrameMatch[1].trim() : '';
    
    // Extract first frame references
    const firstFrameRefs = extractReferenceUrls(sceneText, 'FIRST FRAME');
    
    // Extract last frame
    const lastFrameMatch = sceneText.match(/SCENE\s+\d+:\s*LAST\s+FRAME\s+([\s\S]*?)(?=SCENE\s+\d+:|$)/i);
    const lastFrameText = lastFrameMatch ? lastFrameMatch[1] : '';
    
    const lastFrameDescMatch = lastFrameText.match(/Visual description[^:]*:\s*([\s\S]*?)(?=Reference images to use:|$)/i);
    const lastFrameDesc = lastFrameDescMatch ? lastFrameDescMatch[1].trim() : '';
    
    // Extract last frame references
    const lastFrameRefs = extractReferenceUrls(lastFrameText, 'LAST FRAME');
    
    scenes.push({
      sceneNumber,
      firstFrame: {
        description: firstFrameDesc,
        referenceUrls: firstFrameRefs,
      },
      lastFrame: {
        description: lastFrameDesc,
        referenceUrls: lastFrameRefs,
      },
    });
  }
  
  return { scenes };
}

/**
 * Helper: Extract reference image URLs from text
 */
function extractReferenceUrls(text: string, frameType: string): string[] {
  const urls: string[] = [];
  
  // Look for URLs in "Reference images to use:" section
  const urlRegex = /https?:\/\/[^\s\)]+/g;
  const matches = text.match(urlRegex);
  
  if (matches) {
    urls.push(...matches);
  }
  
  return urls;
}

/**
 * Call subtool API
 */
async function callSubtool(
  subtool: SubtoolType,
  input: Record<string, any>,
  conversationId: string
): Promise<SubtoolResult> {
  
  const response = await fetch('/api/storyboard/subtools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subtool,
      input,
      conversationId,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Subtool execution failed');
  }
  
  const data = await response.json();
  
  return {
    subtool,
    naturalText: data.output,
    assetId: data.metadata.assetId,
  };
}

// Types

export interface ParsedFramePrompts {
  scenes: ParsedScene[];
}

export interface ParsedScene {
  sceneNumber: number;
  firstFrame: {
    description: string;
    referenceUrls: string[];
  };
  lastFrame: {
    description: string;
    referenceUrls: string[];
  };
}

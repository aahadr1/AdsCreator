/**
 * Storyboard Subtools Types
 * 
 * Type definitions for the 3 specialized storyboard creation subtools.
 * These tools output NATURAL TEXT, not rigid JSON structures.
 */

import { MediaPool } from './mediaPool';

/**
 * Available subtool types
 */
export type SubtoolType = 'video_scenarist' | 'video_director' | 'storyboard_prompt_creator';

/**
 * Subtool execution status
 */
export type SubtoolStatus = 'idle' | 'running' | 'completed' | 'failed';

// ===== Video Scenarist =====

/**
 * Video Scenarist Input
 * 
 * Transforms approved script into natural scene descriptions
 */
export interface VideoScenaristInput {
  /** The approved script dialogue (exact words to be spoken) */
  script: string;
  
  /** User's original intent and creative direction */
  userIntent: string;
  
  /** Available assets in the media pool */
  mediaPool: MediaPool;
  
  /** Desired visual style (optional) */
  style?: string;
  
  /** Target platform (optional) */
  platform?: 'tiktok' | 'instagram' | 'facebook' | 'youtube_shorts';
}

/**
 * Video Scenarist Output
 * 
 * NATURAL TEXT describing scenes visually
 */
export interface VideoScenaristOutput {
  /** Natural language scene descriptions */
  naturalText: string;
  
  /** Asset ID in media pool where this was stored */
  assetId: string;
  
  /** Optional reflexion on the output quality */
  reflexion?: string;
}

// ===== Video Director =====

/**
 * Video Director Input
 * 
 * Adds technical direction to scene descriptions
 */
export interface VideoDirectorInput {
  /** Natural scene descriptions from the scenarist */
  sceneDescriptions: string;
  
  /** User's intent and style preferences */
  userIntent: string;
  
  /** Detected or specified video type */
  videoType?: 'ugc' | 'cinematic' | 'tutorial' | 'ad' | 'other';
  
  /** Media pool for context */
  mediaPool: MediaPool;
}

/**
 * Video Director Output
 * 
 * NATURAL TEXT with technical direction
 */
export interface VideoDirectorOutput {
  /** Natural language technical direction */
  naturalText: string;
  
  /** Asset ID in media pool */
  assetId: string;
  
  /** Optional reflexion */
  reflexion?: string;
}

// ===== Storyboard Prompt Creator =====

/**
 * Storyboard Prompt Creator Input
 * 
 * Creates image generation prompts from descriptions + direction
 */
export interface StoryboardPromptCreatorInput {
  /** Scene descriptions from scenarist */
  sceneDescriptions: string;
  
  /** Technical direction from director */
  technicalDirection: string;
  
  /** Media pool for finding reference images */
  mediaPool: MediaPool;
  
  /** Active avatar asset ID (if applicable) */
  avatarAssetId?: string;
  
  /** Active product asset ID (if applicable) */
  productAssetId?: string;
}

/**
 * Storyboard Prompt Creator Output
 * 
 * NATURAL TEXT frame prompts with reference URLs
 */
export interface StoryboardPromptCreatorOutput {
  /** Natural language frame prompts with reference image URLs */
  naturalText: string;
  
  /** Asset ID in media pool */
  assetId: string;
  
  /** Optional reflexion */
  reflexion?: string;
}

// ===== Subtool Execution =====

/**
 * Generic subtool execution result
 */
export interface SubtoolExecutionResult {
  success: boolean;
  subtool: SubtoolType;
  output?: string; // Natural text output
  metadata?: {
    assetId?: string;
    timestamp: string;
    conversationId: string;
  };
  error?: string;
}

/**
 * Subtool progress event
 */
export interface SubtoolProgressEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  subtool: SubtoolType;
  progress?: number; // 0-100
  message?: string;
  data?: any;
}

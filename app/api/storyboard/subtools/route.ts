import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { VIDEO_SCENARIST_PROMPT } from '../../../../lib/prompts/subtools/scenarist';
import { VIDEO_DIRECTOR_PROMPT } from '../../../../lib/prompts/subtools/director';
import { STORYBOARD_PROMPT_CREATOR_PROMPT } from '../../../../lib/prompts/subtools/promptCreator';
import { MediaPool, addAssetToPool, buildNaturalMediaPoolContext, getAsset } from '../../../../types/mediaPool';

// Lazy initialize OpenAI to avoid build-time errors
function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * POST /api/storyboard/subtools
 * 
 * Execute a storyboard subtool (scenarist, director, or prompt_creator)
 * Returns natural text output that the assistant reads organically
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subtool, input, conversationId } = body;
    
    if (!subtool || !conversationId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: subtool, conversationId' },
        { status: 400 }
      );
    }
    
    let result;
    
    switch (subtool) {
      case 'video_scenarist':
        result = await executeScenarist(input, conversationId);
        break;
      case 'video_director':
        result = await executeDirector(input, conversationId);
        break;
      case 'storyboard_prompt_creator':
        result = await executePromptCreator(input, conversationId);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unknown subtool: ${subtool}` },
          { status: 400 }
        );
    }
    
    // Minimal JSON wrapper for transport - the content is natural text
    return NextResponse.json({
      success: true,
      output: result.naturalText,
      metadata: {
        subtool: subtool,
        timestamp: new Date().toISOString(),
        conversationId: conversationId,
        assetId: result.assetId,
      }
    });
    
  } catch (error: any) {
    console.error('Subtool execution error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Execute Video Scenarist subtool
 * 
 * Transforms script + user intent into natural scene descriptions
 */
async function executeScenarist(
  input: {
    script: string;
    userIntent: string;
    mediaPool: MediaPool;
    style?: string;
    platform?: string;
  },
  conversationId: string
): Promise<{ naturalText: string; assetId: string }> {
  
  // Build natural context from media pool
  const mediaPoolContext = buildNaturalMediaPoolContext(input.mediaPool);
  
  const prompt = `User's script:
${input.script}

User's intent:
${input.userIntent}

${input.style ? `Style preference: ${input.style}` : ''}
${input.platform ? `Platform: ${input.platform}` : ''}

Available assets in media pool:
${mediaPoolContext}

Create natural scene-by-scene descriptions for this video.`;
  
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: VIDEO_SCENARIST_PROMPT },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7, // Allow creativity
  });
  
  const naturalText = response.choices[0].message.content || '';
  
  // Store in media pool as a text asset
  const updatedPool = addAssetToPool(input.mediaPool, {
    type: 'scene_descriptions',
    content: naturalText,
    description: 'Scene descriptions from video scenarist',
    status: 'ready',
    approved: false,
  });
  
  // Update conversation's media pool
  await updateConversationMediaPool(conversationId, updatedPool.pool);
  
  return {
    naturalText,
    assetId: updatedPool.assetId
  };
}

/**
 * Execute Video Director subtool
 * 
 * Adds technical direction to scene descriptions
 */
async function executeDirector(
  input: {
    sceneDescriptions: string;
    userIntent: string;
    videoType?: 'ugc' | 'cinematic' | 'tutorial' | 'ad' | 'other';
    mediaPool: MediaPool;
  },
  conversationId: string
): Promise<{ naturalText: string; assetId: string }> {
  
  const videoType = input.videoType || detectVideoType(input.userIntent);
  
  const prompt = `Scene descriptions from scenarist:
${input.sceneDescriptions}

User's intent:
${input.userIntent}

Detected video type: ${videoType}

Add natural technical direction for each scene.`;
  
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: VIDEO_DIRECTOR_PROMPT },
      { role: 'user', content: prompt }
    ],
    temperature: 0.6,
  });
  
  const naturalText = response.choices[0].message.content || '';
  
  // Store in media pool
  const updatedPool = addAssetToPool(input.mediaPool, {
    type: 'technical_direction',
    content: naturalText,
    description: 'Technical direction from video director',
    status: 'ready',
    approved: false,
  });
  
  await updateConversationMediaPool(conversationId, updatedPool.pool);
  
  return {
    naturalText,
    assetId: updatedPool.assetId
  };
}

/**
 * Execute Storyboard Prompt Creator subtool
 * 
 * Creates image generation prompts from descriptions + direction
 */
async function executePromptCreator(
  input: {
    sceneDescriptions: string;
    technicalDirection: string;
    mediaPool: MediaPool;
    avatarAssetId?: string;
    productAssetId?: string;
  },
  conversationId: string
): Promise<{ naturalText: string; assetId: string }> {
  
  // Build context about available reference images
  let referenceContext = 'Available reference images:\n';
  
  if (input.avatarAssetId) {
    const avatar = getAsset(input.mediaPool, input.avatarAssetId);
    if (avatar?.url) {
      referenceContext += `- Avatar reference URL: ${avatar.url}\n`;
      referenceContext += `  Description: ${avatar.description}\n`;
    }
  }
  
  if (input.productAssetId) {
    const product = getAsset(input.mediaPool, input.productAssetId);
    if (product?.url) {
      referenceContext += `- Product reference URL: ${product.url}\n`;
      referenceContext += `  Description: ${product.description}\n`;
    }
  }
  
  const prompt = `Scene descriptions from scenarist:
${input.sceneDescriptions}

Technical direction from director:
${input.technicalDirection}

${referenceContext}

Create natural frame prompts (first frame and last frame for each scene) with reference image URLs.`;
  
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: STORYBOARD_PROMPT_CREATOR_PROMPT },
      { role: 'user', content: prompt }
    ],
    temperature: 0.5, // More precise for prompts
  });
  
  const naturalText = response.choices[0].message.content || '';
  
  // Store in media pool
  const updatedPool = addAssetToPool(input.mediaPool, {
    type: 'frame_prompts',
    content: naturalText,
    description: 'Frame prompts from storyboard prompt creator',
    status: 'ready',
    approved: false,
  });
  
  await updateConversationMediaPool(conversationId, updatedPool.pool);
  
  return {
    naturalText,
    assetId: updatedPool.assetId
  };
}

/**
 * Helper: Detect video type from user intent
 */
function detectVideoType(userIntent: string): 'ugc' | 'cinematic' | 'tutorial' | 'ad' | 'other' {
  const lowerIntent = userIntent.toLowerCase();
  
  if (lowerIntent.includes('ugc') || lowerIntent.includes('authentic') || lowerIntent.includes('relatable')) {
    return 'ugc';
  }
  if (lowerIntent.includes('cinematic') || lowerIntent.includes('professional') || lowerIntent.includes('high-end')) {
    return 'cinematic';
  }
  if (lowerIntent.includes('tutorial') || lowerIntent.includes('how-to') || lowerIntent.includes('educational')) {
    return 'tutorial';
  }
  if (lowerIntent.includes('ad') || lowerIntent.includes('advertisement') || lowerIntent.includes('commercial')) {
    return 'ad';
  }
  
  return 'other';
}

/**
 * Helper: Update conversation's media pool in database
 */
async function updateConversationMediaPool(conversationId: string, mediaPool: MediaPool): Promise<void> {
  const supabase = getSupabase();
  
  const { error } = await supabase
    .from('assistant_conversations')
    .update({
      plan: {
        media_pool: mediaPool,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);
  
  if (error) {
    console.error('Error updating media pool:', error);
    throw new Error('Failed to update media pool');
  }
}

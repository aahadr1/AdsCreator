/**
 * API endpoint for AI-powered storyboard modifications
 * Allows users to select scenes/frames/scripts and request natural language changes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ModificationRequest, StoryboardSelection } from '@/types/storyboardSelection';
import type { Storyboard, StoryboardScene } from '@/types/assistant';
import { SCENE_REFINEMENT_PROMPT } from '@/lib/prompts/assistant/system';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_TEXT_MODEL = 'gpt-4o';

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

function requireOpenAIKey(): string {
  if (!OPENAI_API_KEY) {
    throw new Error('Server misconfigured: missing OPENAI_API_KEY');
  }
  return OPENAI_API_KEY;
}

async function callOpenAIJson<T>(opts: {
  prompt: string;
  system_prompt: string;
  max_tokens: number;
  temperature?: number;
}): Promise<T> {
  const key = requireOpenAIKey();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: ASSISTANT_TEXT_MODEL,
      messages: [
        { role: 'system', content: opts.system_prompt },
        { role: 'user', content: opts.prompt },
      ],
      max_tokens: opts.max_tokens,
      temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.4,
      stream: false,
    }),
  });
  
  if (!res.ok) {
    throw new Error(await res.text());
  }
  
  const json = await res.json();
  const content = String(json?.choices?.[0]?.message?.content || '');
  
  // Try to parse JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]) as T;
  }
  
  throw new Error('Failed to parse JSON from response');
}

/**
 * Modification system prompt - specialized for editing existing content
 */
const MODIFICATION_SYSTEM_PROMPT = `You are an AI creative director helping users refine their video storyboard.

The user has selected specific elements (scenes, frames, or scripts) and wants to modify them based on their natural language request.

Your task:
1. Understand what the user wants to change
2. Apply those changes to the selected elements only
3. Maintain consistency with the rest of the storyboard
4. Return the updated elements in JSON format

Guidelines:
- Be surgical: only change what the user requested
- Maintain visual consistency with unchanged elements
- If references exist (avatar, product), respect them
- Use natural, visual language in prompts
- Keep modifications realistic and achievable

Output JSON format depends on selection type:

**For SCENE modifications:**
{
  "updated_scenes": [
    {
      "scene_number": number,
      "changes": {
        "scene_name": "new name" (if changed),
        "description": "new description" (if changed),
        "duration_seconds": number (if changed),
        "voiceover_text": "new script" (if changed)
      }
    }
  ]
}

**For FRAME modifications:**
{
  "updated_frames": [
    {
      "scene_number": number,
      "frame_position": "first" | "last",
      "first_frame_prompt": "updated prompt" (if applicable),
      "last_frame_prompt": "updated prompt" (if applicable),
      "video_generation_prompt": "updated motion" (if changed)
    }
  ]
}

**For SCRIPT modifications:**
{
  "updated_scripts": [
    {
      "scene_number": number,
      "voiceover_text": "updated script",
      "audio_mood": "mood" (if changed)
    }
  ]
}

Return ONLY valid JSON, no markdown or commentary.`;

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    
    // Authenticate user
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json() as ModificationRequest;
    
    if (!body.storyboard_id || !body.selection || !body.modification_text) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Load storyboard from database
    const { data: storyboardData, error: loadError } = await supabase
      .from('storyboards')
      .select('*')
      .eq('id', body.storyboard_id)
      .eq('user_id', user.id)
      .single();
    
    if (loadError || !storyboardData) {
      return NextResponse.json({ error: 'Storyboard not found' }, { status: 404 });
    }
    
    const storyboard: Storyboard = {
      id: storyboardData.id,
      title: storyboardData.title,
      brand_name: storyboardData.brand_name,
      product: storyboardData.product,
      target_audience: storyboardData.target_audience,
      platform: storyboardData.platform,
      total_duration_seconds: storyboardData.total_duration_seconds,
      style: storyboardData.style,
      aspect_ratio: storyboardData.aspect_ratio,
      avatar_image_url: storyboardData.avatar_image_url,
      avatar_description: storyboardData.avatar_description,
      product_image_url: storyboardData.product_image_url,
      product_image_description: storyboardData.product_image_description,
      scenario: storyboardData.scenario,
      scenes: storyboardData.scenes as StoryboardScene[],
      created_at: storyboardData.created_at,
      status: storyboardData.status,
    };
    
    // Build context for AI
    const selection = body.selection;
    const selectedSceneNumbers = new Set<number>();
    
    if (selection.type === 'scene') {
      selection.items.forEach((item: any) => selectedSceneNumbers.add(item.sceneNumber));
    } else if (selection.type === 'frame') {
      selection.items.forEach((item: any) => selectedSceneNumbers.add(item.sceneNumber));
    } else if (selection.type === 'script') {
      selection.items.forEach((item: any) => selectedSceneNumbers.add(item.sceneNumber));
    }
    
    const selectedScenes = storyboard.scenes.filter((s) => selectedSceneNumbers.has(s.scene_number));
    
    // Build prompt for AI
    const promptParts: string[] = [];
    promptParts.push(`STORYBOARD CONTEXT:`);
    promptParts.push(`Title: ${storyboard.title}`);
    promptParts.push(`Brand: ${storyboard.brand_name || 'N/A'}`);
    promptParts.push(`Product: ${storyboard.product || 'N/A'}`);
    promptParts.push(`Platform: ${storyboard.platform || 'N/A'}`);
    promptParts.push(`Aspect Ratio: ${storyboard.aspect_ratio || '9:16'}`);
    promptParts.push(``);
    promptParts.push(`SELECTION TYPE: ${selection.type}`);
    promptParts.push(`SELECTED ITEMS: ${selection.items.length}`);
    promptParts.push(``);
    promptParts.push(`SELECTED SCENES:`);
    promptParts.push(JSON.stringify(selectedScenes, null, 2));
    promptParts.push(``);
    promptParts.push(`USER MODIFICATION REQUEST:`);
    promptParts.push(body.modification_text);
    promptParts.push(``);
    
    if (selection.type === 'frame') {
      promptParts.push(`The user wants to modify specific FRAMES. Update the frame prompts accordingly.`);
    } else if (selection.type === 'script') {
      promptParts.push(`The user wants to modify SCRIPTS/VOICEOVER. Update the voiceover_text accordingly.`);
    } else {
      promptParts.push(`The user wants to modify SCENES. Update scene descriptions, timing, scripts, and prompts as needed.`);
    }
    
    const prompt = promptParts.join('\n');
    
    // Call AI to generate modifications
    const modifications = await callOpenAIJson<any>({
      prompt,
      system_prompt: MODIFICATION_SYSTEM_PROMPT,
      max_tokens: 2000,
      temperature: 0.3,
    });
    
    // Apply modifications to storyboard
    const updatedScenes = [...storyboard.scenes];
    const modifiedSceneNumbers: number[] = [];
    const modifiedFrames: Array<{ sceneNumber: number; framePosition: 'first' | 'last' }> = [];
    const changedFields: string[] = []; // Track what actually changed
    
    if (modifications.updated_scenes) {
      for (const update of modifications.updated_scenes) {
        const sceneIndex = updatedScenes.findIndex((s) => s.scene_number === update.scene_number);
        if (sceneIndex >= 0) {
          const changes = update.changes || {};
          const oldScene = { ...updatedScenes[sceneIndex] };
          updatedScenes[sceneIndex] = {
            ...updatedScenes[sceneIndex],
            ...changes,
          };
          modifiedSceneNumbers.push(update.scene_number);
          
          // Track which fields changed
          Object.keys(changes).forEach((key) => {
            if (oldScene[key as keyof typeof oldScene] !== changes[key]) {
              changedFields.push(`scene_${update.scene_number}_${key}`);
            }
          });
        }
      }
    }
    
    if (modifications.updated_frames) {
      for (const update of modifications.updated_frames) {
        const sceneIndex = updatedScenes.findIndex((s) => s.scene_number === update.scene_number);
        if (sceneIndex >= 0) {
          if (update.first_frame_prompt) {
            updatedScenes[sceneIndex].first_frame_prompt = update.first_frame_prompt;
            modifiedFrames.push({ sceneNumber: update.scene_number, framePosition: 'first' });
            changedFields.push(`scene_${update.scene_number}_first_frame_prompt`);
            
            // Mark frame for regeneration
            updatedScenes[sceneIndex].first_frame_status = 'pending';
            updatedScenes[sceneIndex].first_frame_needs_regeneration = true;
          }
          if (update.last_frame_prompt) {
            updatedScenes[sceneIndex].last_frame_prompt = update.last_frame_prompt;
            modifiedFrames.push({ sceneNumber: update.scene_number, framePosition: 'last' });
            changedFields.push(`scene_${update.scene_number}_last_frame_prompt`);
            
            // Mark frame for regeneration
            updatedScenes[sceneIndex].last_frame_status = 'pending';
            updatedScenes[sceneIndex].last_frame_needs_regeneration = true;
          }
          if (update.video_generation_prompt) {
            updatedScenes[sceneIndex].video_generation_prompt = update.video_generation_prompt;
            changedFields.push(`scene_${update.scene_number}_video_generation_prompt`);
          }
          if (!modifiedSceneNumbers.includes(update.scene_number)) {
            modifiedSceneNumbers.push(update.scene_number);
          }
        }
      }
    }
    
    if (modifications.updated_scripts) {
      for (const update of modifications.updated_scripts) {
        const sceneIndex = updatedScenes.findIndex((s) => s.scene_number === update.scene_number);
        if (sceneIndex >= 0) {
          updatedScenes[sceneIndex].voiceover_text = update.voiceover_text;
          changedFields.push(`scene_${update.scene_number}_voiceover_text`);
          if (update.audio_mood) {
            updatedScenes[sceneIndex].audio_mood = update.audio_mood;
            changedFields.push(`scene_${update.scene_number}_audio_mood`);
          }
          if (!modifiedSceneNumbers.includes(update.scene_number)) {
            modifiedSceneNumbers.push(update.scene_number);
          }
        }
      }
    }
    
    // Save updated storyboard to database
    const { error: saveError } = await supabase
      .from('storyboards')
      .update({
        scenes: updatedScenes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.storyboard_id)
      .eq('user_id', user.id);
    
    if (saveError) {
      console.error('Error saving modifications:', saveError);
      return NextResponse.json({ error: 'Failed to save modifications' }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      updated_scenes: modifiedSceneNumbers,
      updated_frames: modifiedFrames.length > 0 ? modifiedFrames : undefined,
      changed_fields: changedFields,
      message: `Successfully updated ${selection.type === 'scene' ? 'scenes' : selection.type === 'frame' ? 'frames' : 'scripts'}`,
      details: `Modified ${modifiedSceneNumbers.length} scene(s). ${changedFields.length} field(s) changed.`,
    });
    
  } catch (error: any) {
    console.error('Modification error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to process modification' 
    }, { status: 500 });
  }
}

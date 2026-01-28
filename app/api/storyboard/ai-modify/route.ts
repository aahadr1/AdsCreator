/**
 * AI-Powered Storyboard Modification with Real Generation
 * 
 * This endpoint:
 * 1. Analyzes user's modification request with GPT-4o
 * 2. Determines what needs to be regenerated (frames, scripts, scenes)
 * 3. Triggers actual AI generation (images, prompts, etc.)
 * 4. Stores versions in history
 * 5. Returns updated storyboard with new content
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ModificationRequest } from '@/types/storyboardSelection';
import type { Storyboard, StoryboardScene } from '@/types/assistant';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const REPLICATE_API = 'https://api.replicate.com/v1';
const ASSISTANT_IMAGE_MODEL = 'google/nano-banana';

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function callOpenAIJson<T>(opts: {
  prompt: string;
  system_prompt: string;
  max_tokens: number;
}): Promise<T> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: opts.system_prompt },
        { role: 'user', content: opts.prompt },
      ],
      max_tokens: opts.max_tokens,
      temperature: 0.3,
    }),
  });
  
  const json = await res.json();
  const content = String(json?.choices?.[0]?.message?.content || '');
  const parsed = content.match(/\{[\s\S]*\}/)?.[0];
  if (!parsed) throw new Error('No JSON in response');
  return JSON.parse(parsed) as T;
}

/**
 * REFLEXION PROMPT: Analyzes user modification request
 * Determines what needs to be regenerated
 */
const MODIFICATION_REFLEXION_PROMPT = `You are an AI analyzing a user's modification request for their video storyboard.

Your task: Understand EXACTLY what the user wants to modify and what needs to be regenerated.

OUTPUT STRICT JSON:
{
  "understanding": "One sentence: what the user wants",
  "affected_elements": {
    "scenes": [1, 3, 5],  // Which scene numbers
    "frames_to_regenerate": [
      { "scene": 1, "position": "first" },
      { "scene": 1, "position": "last" }
    ],
    "scripts_to_rewrite": [2, 3],
    "prompts_to_update": ["first_frame", "last_frame", "video"]
  },
  "regeneration_strategy": "frame_only" | "frame_and_prompt" | "script_only" | "full_scene",
  "modifications": {
    "visual_changes": "What changes visually",
    "script_changes": "What changes in script",
    "timing_changes": "What changes in timing"
  }
}

Examples:

User: "Make scene 3 more energetic"
→ {
  "understanding": "User wants scene 3 to be more dynamic and high-energy",
  "affected_elements": { "scenes": [3], "scripts_to_rewrite": [3] },
  "regeneration_strategy": "script_only",
  "modifications": { "script_changes": "Rewrite with more energy and enthusiasm" }
}

User: "Zoom in closer on the face in scene 2 first frame"
→ {
  "understanding": "User wants tighter framing on face in scene 2 opening",
  "affected_elements": { 
    "scenes": [2], 
    "frames_to_regenerate": [{ "scene": 2, "position": "first" }],
    "prompts_to_update": ["first_frame", "video"]
  },
  "regeneration_strategy": "frame_and_prompt",
  "modifications": { 
    "visual_changes": "Tighter crop, close-up on face",
    "script_changes": "none"
  }
}

User: "Make her smile bigger in all frames"
→ {
  "understanding": "User wants bigger smile expression across all frames",
  "affected_elements": { 
    "scenes": [1,2,3,4,5],
    "frames_to_regenerate": [/* all frames */],
    "prompts_to_update": ["first_frame", "last_frame"]
  },
  "regeneration_strategy": "frame_and_prompt",
  "modifications": { "visual_changes": "Increase smile, more joyful expression" }
}

Be precise. Identify EXACTLY what needs regeneration.`;

/**
 * Generate new image with Replicate (Nano Banana)
 */
async function regenerateFrame(
  prompt: string,
  aspectRatio: string,
  referenceImages: string[]
): Promise<{ url: string | null; error: string | null }> {
  try {
    const token = REPLICATE_API_TOKEN;
    if (!token) throw new Error('Missing REPLICATE_API_TOKEN');
    
    // Get model version
    const modelRes = await fetch(`${REPLICATE_API}/models/${ASSISTANT_IMAGE_MODEL}`, {
      headers: { Authorization: `Token ${token}` },
    });
    const modelData = await modelRes.json();
    const versionId = modelData.latest_version?.id;
    if (!versionId) throw new Error('No model version found');
    
    // Create prediction
    const predRes = await fetch(`${REPLICATE_API}/predictions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify({
        version: versionId,
        input: {
          prompt,
          aspect_ratio: aspectRatio,
          output_format: 'jpg',
          image_input: referenceImages.length > 0 ? referenceImages : undefined,
        },
      }),
    });
    
    const prediction = await predRes.json();
    const predictionId = prediction.id;
    
    // Poll for completion (max 90 seconds)
    const maxWait = 90000;
    const pollInterval = 2500;
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const statusRes = await fetch(`${REPLICATE_API}/predictions/${predictionId}`, {
        headers: { Authorization: `Token ${token}` },
      });
      const status = await statusRes.json();
      
      if (status.status === 'succeeded') {
        const outputUrl = Array.isArray(status.output) ? status.output[0] : status.output;
        return { url: outputUrl, error: null };
      }
      
      if (status.status === 'failed' || status.status === 'canceled') {
        return { url: null, error: status.error || 'Generation failed' };
      }
      
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
    
    return { url: null, error: 'Timeout waiting for generation' };
    
  } catch (error: any) {
    return { url: null, error: error.message };
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    
    // Authenticate
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const body = await req.json() as ModificationRequest;
    
    if (!body.storyboard_id || !body.modification_text) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Load storyboard
    const { data: storyboardData, error: loadError } = await supabase
      .from('storyboards')
      .select('*')
      .eq('id', body.storyboard_id)
      .eq('user_id', user.id)
      .single();
    
    if (loadError || !storyboardData) {
      return NextResponse.json({ error: 'Storyboard not found' }, { status: 404 });
    }
    
    const storyboard = storyboardData as any;
    const scenes = storyboard.scenes as StoryboardScene[];
    
    // STEP 1: AI REFLEXION - Analyze modification request
    const selectedSceneNumbers = new Set<number>();
    const selection = body.selection;
    
    if (selection?.type === 'scene') {
      selection.items.forEach((item: any) => selectedSceneNumbers.add(item.sceneNumber));
    } else if (selection?.type === 'frame') {
      selection.items.forEach((item: any) => selectedSceneNumbers.add(item.sceneNumber));
    } else if (selection?.type === 'script') {
      selection.items.forEach((item: any) => selectedSceneNumbers.add(item.sceneNumber));
    }
    
    const selectedScenes = scenes.filter((s) => selectedSceneNumbers.has(s.scene_number));
    
    const reflexionPrompt = `
STORYBOARD CONTEXT:
Title: ${storyboard.title}
Brand: ${storyboard.brand_name || 'N/A'}
Product: ${storyboard.product || 'N/A'}
Aspect Ratio: ${storyboard.aspect_ratio || '9:16'}

SELECTED ITEMS:
Selection Type: ${selection?.type || 'none'}
${JSON.stringify(selectedScenes.map(s => ({
  scene_number: s.scene_number,
  scene_name: s.scene_name,
  description: s.description,
  voiceover: s.voiceover_text,
  first_frame_prompt: s.first_frame_prompt,
  last_frame_prompt: s.last_frame_prompt,
})), null, 2)}

USER MODIFICATION REQUEST:
"${body.modification_text}"

Analyze what needs to be regenerated.`;
    
    const reflexion = await callOpenAIJson<any>({
      prompt: reflexionPrompt,
      system_prompt: MODIFICATION_REFLEXION_PROMPT,
      max_tokens: 1000,
    });
    
    console.log('[AI Modify] Reflexion:', reflexion);
    
    // STEP 2: Execute regenerations based on reflexion
    const updatedScenes = [...scenes];
    const regenerationResults: any[] = [];
    const framesToRegenerate = reflexion.affected_elements?.frames_to_regenerate || [];
    const scriptsToRewrite = reflexion.affected_elements?.scripts_to_rewrite || [];
    
    // REGENERATE FRAMES
    for (const frameSpec of framesToRegenerate) {
      const sceneIndex = updatedScenes.findIndex((s) => s.scene_number === frameSpec.scene);
      if (sceneIndex < 0) continue;
      
      const scene = updatedScenes[sceneIndex];
      const isFirstFrame = frameSpec.position === 'first';
      const currentPrompt = isFirstFrame ? scene.first_frame_prompt : scene.last_frame_prompt;
      
      // Build modified prompt incorporating user request
      const modificationContext = reflexion.modifications?.visual_changes || body.modification_text;
      const newPrompt = `${currentPrompt}\n\nMODIFICATION: ${modificationContext}`;
      
      // Collect reference images
      const references: string[] = [];
      if (storyboard.avatar_image_url) references.push(storyboard.avatar_image_url);
      if (storyboard.product_image_url && scene.needs_product_image) references.push(storyboard.product_image_url);
      if (!isFirstFrame && scene.first_frame_url) references.push(scene.first_frame_url);
      
      console.log(`[AI Modify] Regenerating scene ${frameSpec.scene} ${frameSpec.position} frame...`);
      
      const result = await regenerateFrame(
        newPrompt,
        storyboard.aspect_ratio || '9:16',
        references
      );
      
      if (result.url) {
        // Update scene with new frame
        if (isFirstFrame) {
          updatedScenes[sceneIndex].first_frame_url = result.url;
          updatedScenes[sceneIndex].first_frame_raw_url = result.url;
          updatedScenes[sceneIndex].first_frame_prompt = newPrompt;
          updatedScenes[sceneIndex].first_frame_status = 'succeeded';
        } else {
          updatedScenes[sceneIndex].last_frame_url = result.url;
          updatedScenes[sceneIndex].last_frame_raw_url = result.url;
          updatedScenes[sceneIndex].last_frame_prompt = newPrompt;
          updatedScenes[sceneIndex].last_frame_status = 'succeeded';
        }
        
        regenerationResults.push({
          type: 'frame',
          scene: frameSpec.scene,
          position: frameSpec.position,
          success: true,
          url: result.url,
        });
      } else {
        regenerationResults.push({
          type: 'frame',
          scene: frameSpec.scene,
          position: frameSpec.position,
          success: false,
          error: result.error,
        });
      }
    }
    
    // REWRITE SCRIPTS
    if (scriptsToRewrite.length > 0 && reflexion.modifications?.script_changes) {
      const scriptPrompt = `
Original scripts:
${scriptsToRewrite.map((sceneNum: number) => {
  const scene = scenes.find((s) => s.scene_number === sceneNum);
  return `Scene ${sceneNum}: "${scene?.voiceover_text || ''}"`;
}).join('\n')}

Modification request: ${reflexion.modifications.script_changes}

Rewrite each script. Return JSON:
{
  "scripts": [
    { "scene_number": 1, "voiceover_text": "new text", "audio_mood": "mood" }
  ]
}`;
      
      const scriptResult = await callOpenAIJson<any>({
        prompt: scriptPrompt,
        system_prompt: 'You are a scriptwriter. Rewrite voiceover scripts based on the modification request. Keep them natural and engaging. Return strict JSON only.',
        max_tokens: 1500,
      });
      
      if (scriptResult.scripts) {
        for (const scriptUpdate of scriptResult.scripts) {
          const sceneIndex = updatedScenes.findIndex((s) => s.scene_number === scriptUpdate.scene_number);
          if (sceneIndex >= 0) {
            updatedScenes[sceneIndex].voiceover_text = scriptUpdate.voiceover_text;
            if (scriptUpdate.audio_mood) {
              updatedScenes[sceneIndex].audio_mood = scriptUpdate.audio_mood;
            }
            
            regenerationResults.push({
              type: 'script',
              scene: scriptUpdate.scene_number,
              success: true,
            });
          }
        }
      }
    }
    
    // STEP 3: Save to database with version history
    const { error: saveError } = await supabase
      .from('storyboards')
      .update({
        scenes: updatedScenes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.storyboard_id)
      .eq('user_id', user.id);
    
    if (saveError) {
      console.error('[AI Modify] Save error:', saveError);
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }
    
    // STEP 4: Return results
    const successCount = regenerationResults.filter((r) => r.success).length;
    const failureCount = regenerationResults.filter((r) => !r.success).length;
    
    return NextResponse.json({
      success: true,
      reflexion: reflexion.understanding,
      regenerated: regenerationResults,
      summary: `Regenerated ${successCount} element(s)` + (failureCount > 0 ? `, ${failureCount} failed` : ''),
      changed_fields: regenerationResults.map((r) => 
        r.type === 'frame' 
          ? `scene_${r.scene}_${r.position}_frame` 
          : `scene_${r.scene}_script`
      ),
    });
    
  } catch (error: any) {
    console.error('[AI Modify] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to process modification' 
    }, { status: 500 });
  }
}

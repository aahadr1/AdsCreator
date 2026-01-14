import { NextRequest } from 'next/server';
import Replicate from 'replicate';
import { createBlock, type DynamicResponse } from '@/types/dynamicContent';

export const runtime = 'nodejs';
export const maxDuration = 300; // Longer due to multiple image gens

const LLM_MODEL = 'meta/llama-3.1-8b-instruct';
const IMAGE_MODEL = 'google/nano-banana-pro';

async function generateScriptAndScenes(replicate: Replicate, context: string, avatarDescription?: string) {
  const prompt = `You are a creative director for TikTok UGC ads.
  Create a 5-scene storyboard for a UGC video ad based on this request: "${context}".
  
  The avatar is: ${avatarDescription || "a content creator"}.
  
  Format as JSON:
  {
    "script": "Full script text...",
    "scenes": [
      {
        "id": "scene_1",
        "description": "Visual description for image generator...",
        "script": "Spoken text for this scene..."
      },
      ...
    ]
  }
  
  Keep visual descriptions concrete and "selfie-style" or "handheld" where appropriate.
  Scenes should flow: Hook -> Problem -> Solution -> Demo -> CTA.
  Return ONLY JSON.`;

  const output: any = await replicate.run(LLM_MODEL, {
    input: {
      prompt: prompt,
      max_tokens: 1500,
      temperature: 0.7,
      system_prompt: "You are a JSON-only API. Output valid JSON."
    }
  });

  let text = '';
  if (Array.isArray(output)) text = output.join('');
  else if (typeof output === 'string') text = output;
  
  // Basic cleanup
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();
  
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse LLM JSON:", text);
    // Fallback structure
    return {
      script: "Check this out! [Generated fallback]",
      scenes: Array(5).fill(0).map((_, i) => ({
        id: `scene_${i+1}`,
        description: `Scene ${i+1} showing the product`,
        script: `Line ${i+1}`
      }))
    };
  }
}

async function startImageJob(replicate: Replicate, prompt: string, refImageUrl: string) {
  // Use nano-banana-pro with image_input for identity consistency
  const prediction = await replicate.predictions.create({
    model: IMAGE_MODEL,
    input: {
      prompt: `${prompt}, consistent character, UGC style, 9:16 vertical`,
      image_input: [refImageUrl], // As seen in api/image/run
      output_format: "png",
      negative_prompt: "distorted, bad anatomy, different person, cartoon, sketch"
    }
  } as any);
  return prediction.id;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { selectedAvatarUrl, context, avatarId } = body;

    if (!selectedAvatarUrl) return new Response('Missing selectedAvatarUrl', { status: 400 });

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return new Response('Missing REPLICATE_API_TOKEN', { status: 500 });

    const replicate = new Replicate({ auth: token });

    // 1. Generate Script & Scenes
    // We don't have avatar description, so we assume generic or pass user context
    const storyboardData = await generateScriptAndScenes(replicate, context || "UGC ad");

    // 2. Start Image Generation for each scene
    // We do this in parallel, but maybe limit concurrency if 5 is too many? 
    // Replicate handles it, but rate limits might apply. 5 is usually fine.
    const scenesWithJobs = await Promise.all(storyboardData.scenes.map(async (scene: any) => {
      try {
        const jobId = await startImageJob(replicate, scene.description, selectedAvatarUrl);
        return {
          ...scene,
          imageJobId: jobId,
          status: 'processing'
        };
      } catch (e) {
        console.error(`Failed to start job for scene ${scene.id}`, e);
        return {
          ...scene,
          status: 'failed'
        };
      }
    }));

    // 3. Construct Response
    const storyboardBlock = createBlock('ugc_storyboard_link', {
      storyboard: {
        scenes: scenesWithJobs,
        globalScript: storyboardData.script,
        metadata: {
          context
        }
      },
      selectedAvatarUrl,
      isOpen: false // Initially closed, user clicks "Open"
    });

    const response: DynamicResponse = {
      responseType: 'dynamic',
      blocks: [storyboardBlock],
      metadata: {
        nextAction: 'ugc_storyboard_open'
      }
    };

    return Response.json(response);

  } catch (error: any) {
    console.error('[UGC Storyboard] Error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

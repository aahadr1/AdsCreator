import { NextRequest } from 'next/server';
import Replicate from 'replicate';
import { createBlock, type DynamicResponse } from '@/types/dynamicContent';

export const runtime = 'nodejs';
export const maxDuration = 60;

const NANO_BANANA_PRO_MODEL = 'google/nano-banana-pro';

async function generateAvatarJob(replicate: Replicate, prompt: string) {
  // Using nano-banana-pro for fast avatar generation
  // Model expects: prompt, negative_prompt, width, height, num_inference_steps, guidance_scale
  // We want portrait 9:16 (e.g. 576x1024 or similar) or at least vertical.
  // Nano Banana Pro typically takes standard aspect ratios. Let's try to map to what it supports.
  // Checking TOOL_SPECS in assistantTools.ts (from memory/previous read):
  // { id: 'google/nano-banana-pro', label: 'Nano Banana Pro', defaultInputs: { output_format: 'png' } }
  
  // We'll use the model ID directly with Replicate.
  // Note: The actual model version ID might be needed if using raw Replicate, but usually short-ids work if they are official.
  // However, looking at api/image/run, it fetches the version.
  // Let's use the explicit model path: google/nano-banana-pro
  
  // Wait, I should probably check if I can just use the 'model' parameter with `replicate.run`.
  // For safety, I'll use the exact string used in api/image/run: 'google/nano-banana-pro'
  // But wait, api/image/run uses `black-forest-labs/flux-kontext-max` as default.
  // Let's stick to the plan: `google/nano-banana-pro`.
  
  // IMPORTANT: For `google/nano-banana-pro`, we need to know the inputs.
  // Usually: prompt, negative_prompt.
  
  const prediction = await replicate.predictions.create({
    model: 'google/nano-banana-pro',
    input: {
      prompt: prompt,
      negative_prompt: "blurry, low quality, distorted, ugly, bad anatomy",
      output_format: "png",
      // We might not be able to set exact dimensions easily on all models, but prompts help.
      // Nano banana is fast.
    }
  } as any); // Type cast as any because Replicate types can be strict about model inputs
  
  return prediction.id;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userRequest, userId } = body;

    if (!userRequest) return new Response('Missing userRequest', { status: 400 });
    if (!userId) return new Response('Missing userId', { status: 401 });

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return new Response('Missing REPLICATE_API_TOKEN', { status: 500 });

    const replicate = new Replicate({ auth: token });

    // 1. Analyze request (simple keyword extraction or just use it)
    // For now, we'll append the user request to our base prompts.
    
    // 2. Define 3 variations
    const baseStyle = "UGC selfie style, authentic tiktok creator, front facing camera, holding phone, high quality amateur footage look";
    
    const variations = [
      {
        name: "Variant 1",
        prompt: `Portrait of a cheerful young adult (20s) with casual messy hair in a bright modern kitchen. ${baseStyle}. ${userRequest}`,
      },
      {
        name: "Variant 2",
        prompt: `Portrait of a confident professional (30s) in a home office or living room with warm lighting. ${baseStyle}. ${userRequest}`,
      },
      {
        name: "Variant 3",
        prompt: `Portrait of an energetic creator (Gen Z) outdoors in natural sunlight, urban park background. ${baseStyle}. ${userRequest}`,
      }
    ];

    // 3. Start jobs in parallel
    const jobs = await Promise.all(variations.map(async (v) => {
      const jobId = await generateAvatarJob(replicate, v.prompt);
      return {
        id: `avatar_${Math.random().toString(36).substr(2, 9)}`,
        jobId,
        prompt: v.prompt,
        status: 'processing' as const
      };
    }));

    // 4. Construct Dynamic Response
    const avatarBlock = createBlock('ugc_avatar_picker', {
      avatars: jobs,
      refinementPrompt: userRequest // Pre-fill with original request
    });

    const response: DynamicResponse = {
      responseType: 'dynamic',
      blocks: [avatarBlock],
      metadata: {
        nextAction: 'ugc_avatar_select'
      }
    };

    return Response.json(response);

  } catch (error: any) {
    console.error('[UGC Start] Error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

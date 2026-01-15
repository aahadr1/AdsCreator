import { NextRequest } from 'next/server';
import Replicate from 'replicate';
import { createBlock, type DynamicResponse } from '@/types/dynamicContent';
import { loadUgcSession, saveUgcSession } from '@/lib/ugcStore';
import { checkQualityGate } from '@/lib/safetyGates';

export const runtime = 'nodejs';
export const maxDuration = 300; // Longer due to multiple image gens

const LLM_MODEL = 'meta/llama-3.1-8b-instruct';
const IMAGE_MODEL = 'google/nano-banana-pro';

function chunkToString(chunk: any): string {
  if (!chunk && chunk !== 0) return '';
  if (typeof chunk === 'string' || typeof chunk === 'number') return String(chunk);
  if (Array.isArray(chunk)) return chunk.map(chunkToString).join('');
  if (typeof chunk === 'object') {
    if (typeof chunk.text === 'string') return chunk.text;
    if (typeof chunk.delta === 'string') return chunk.delta;
    if (chunk.output !== undefined) return chunkToString(chunk.output);
    if (Array.isArray(chunk.content)) return chunk.content.map(chunkToString).join('');
  }
  try {
    return JSON.stringify(chunk);
  } catch {
    return '';
  }
}

function safeJsonParse<T>(raw: string): T | null {
  const cleaned = (raw || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

async function generateScriptAndScenes(
  replicate: Replicate,
  context: string,
  avatarDescription?: string,
  brief?: Record<string, any> | null,
  personas?: any[] | null
) {
  const prompt =
    `You are a senior UGC ad director + storyboard artist.\n\n` +
    `Goal: Create an excellent 5-scene UGC ad storyboard that can be turned into images + short clips.\n\n` +
    `Inputs:\n- User brief/context:\n${context}\n\n` +
    `- Selected creator/persona (casting + visual vibe):\n${avatarDescription || 'adult content creator'}\n\n` +
    `Output ONLY valid JSON (no markdown) in this exact schema:\n{\n  \"globalScript\": string,\n  \"scenes\": [\n    {\n      \"id\": \"scene_1\",\n      \"beatType\": \"hook\"|\"problem\"|\"solution\"|\"demo\"|\"cta\",\n      \"shotType\": string,\n      \"onScreenText\": string,\n      \"actorAction\": string,\n      \"description\": string,\n      \"script\": string,\n      \"imagePrompt\": string,\n      \"motionPrompt\": string\n    }\n  ]\n}\n\n` +
    `Rules:\n- Scenes must flow Hook → Problem → Solution → Demo → CTA.\n- Keep it UGC-realistic: selfie/handheld, small apartments, natural lighting, phone camera feel.\n- \"imagePrompt\" must be optimized for an image model with identity reference (it will receive image_input). Make it vertical 9:16.\n- \"motionPrompt\" must be realistic for image-to-video (handheld micro-movements, gestures, subtle head movement), and MUST NOT change identity.\n- Never include minors.\n- Avoid generic filler; be specific to the product, target customer, and offer.\n` +
    (brief ? `\nStructured brief (authoritative):\n${JSON.stringify(brief, null, 2)}\n` : '') +
    (personas && Array.isArray(personas) && personas.length
      ? `\nCasting options generated earlier (for consistency):\n${JSON.stringify(personas, null, 2)}\n`
      : '');

  const output: any = await replicate.run(LLM_MODEL as `${string}/${string}`, {
    input: {
      prompt: prompt,
      max_tokens: 1500,
      temperature: 0.55,
      system_prompt: "You are a JSON-only API. Output valid JSON only."
    }
  });

  const parsed = safeJsonParse<any>(chunkToString(output));
  if (parsed?.globalScript && Array.isArray(parsed?.scenes)) {
    // Quality gate: if script is too generic, retry once with stricter instructions.
    const gate = checkQualityGate(parsed.globalScript, 'script');
    if (gate && gate.severity === 'blocking') {
      const retryPrompt = `${prompt}\n\nQuality gate failed (${gate.noveltyScore}/${gate.threshold}). Fix it:\n- Avoid generic ad clichés\n- Include specific scenario details and at least 1 concrete number\n- Make hook sharp and product-specific\nReturn ONLY JSON.`;
      const retryOut: any = await replicate.run(LLM_MODEL as `${string}/${string}`, {
        input: {
          prompt: retryPrompt,
          max_tokens: 1600,
          temperature: 0.4,
          system_prompt: "You are a JSON-only API. Output valid JSON only.",
        },
      });
      const retryParsed = safeJsonParse<any>(chunkToString(retryOut));
      if (retryParsed?.globalScript && Array.isArray(retryParsed?.scenes)) return retryParsed;
    }
    return parsed;
  }

  console.error("Failed to parse LLM storyboard JSON:", chunkToString(output));
  return {
    globalScript: "Check this out! [Generated fallback]",
    scenes: Array(5).fill(0).map((_, i) => ({
      id: `scene_${i + 1}`,
      beatType: ['hook', 'problem', 'solution', 'demo', 'cta'][i] || 'demo',
      shotType: 'Selfie (handheld)',
      onScreenText: '',
      actorAction: 'Talk to camera',
      description: `Scene ${i + 1} showing the product`,
      script: `Line ${i + 1}`,
      imagePrompt: `Vertical 9:16 selfie-style UGC frame showing the product. Scene ${i + 1}.`,
      motionPrompt: 'Handheld camera micro-movements, natural blinking, subtle head movement.',
    })),
  };
}

async function startImageJob(replicate: Replicate, prompt: string, refImageUrl: string, productImageUrl?: string | null) {
  // Use nano-banana-pro with image_input for identity consistency
  const prediction = await replicate.predictions.create({
    model: IMAGE_MODEL,
    input: {
      prompt: `${prompt}\n\nConstraints: consistent character identity, realistic UGC phone camera look, 9:16 vertical.`,
      image_input: productImageUrl ? [refImageUrl, productImageUrl] : [refImageUrl], // avatar identity + optional product reference
      output_format: "png",
      negative_prompt:
        "distorted, bad anatomy, different person, identity change, child, teenager, underage, " +
        "cartoon, anime, illustration, CGI, overprocessed, watermark, logo, text"
    }
  } as any);
  return prediction.id;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { selectedAvatarUrl, context, avatarId, avatarPrompt, sessionId, productImageUrl } = body;

    if (!selectedAvatarUrl) return Response.json({ error: 'Missing selectedAvatarUrl' }, { status: 400 });

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return Response.json({ error: 'Missing REPLICATE_API_TOKEN' }, { status: 500 });

    const replicate = new Replicate({ auth: token });

    const session = (typeof sessionId === 'string' && sessionId.trim())
      ? await loadUgcSession(sessionId.trim())
      : null;

    // 1. Generate Script & Scenes
    const storyboardData = await generateScriptAndScenes(
      replicate,
      context || "UGC ad",
      typeof avatarPrompt === 'string' && avatarPrompt.trim() ? avatarPrompt : undefined
      , session?.brief || null
      , (session?.personas as any) || null
    );

    // 2. Start Image Generation for each scene
    // We do this in parallel, but maybe limit concurrency if 5 is too many? 
    // Replicate handles it, but rate limits might apply. 5 is usually fine.
    const scenesWithJobs = await Promise.all(storyboardData.scenes.map(async (scene: any) => {
      try {
        const imagePrompt = scene.imagePrompt || scene.description;
        const jobId = await startImageJob(
          replicate,
          imagePrompt,
          selectedAvatarUrl,
          typeof productImageUrl === 'string' && productImageUrl.trim()
            ? productImageUrl.trim()
            : (typeof session?.productImageUrl === 'string' ? session.productImageUrl : null)
        );
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
        globalScript: storyboardData.globalScript,
        metadata: {
          context,
          avatarId,
          sessionId: typeof sessionId === 'string' ? sessionId : undefined,
          productImageUrl: typeof productImageUrl === 'string' ? productImageUrl : (session?.productImageUrl || undefined)
        }
      },
      selectedAvatarUrl,
      isOpen: false // Initially closed, user clicks "Open"
    });

    if (typeof sessionId === 'string' && sessionId.trim()) {
      await saveUgcSession(sessionId.trim(), {
        selectedAvatarUrl,
        selectedAvatarPrompt: typeof avatarPrompt === 'string' ? avatarPrompt : null,
        storyboard: {
          scenes: scenesWithJobs,
          globalScript: storyboardData.globalScript,
          metadata: { context, avatarId },
        },
      });
    }

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
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}

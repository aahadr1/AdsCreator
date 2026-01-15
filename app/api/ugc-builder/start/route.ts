import { NextRequest } from 'next/server';
import Replicate from 'replicate';
import { createBlock, type DynamicResponse } from '@/types/dynamicContent';
import { saveUgcSession } from '@/lib/ugcStore';

export const runtime = 'nodejs';
export const maxDuration = 60;

const NANO_BANANA_PRO_MODEL = 'google/nano-banana-pro';
const CLAUDE_MODEL = 'anthropic/claude-4.5-sonnet';
const UGC_BRIEF_MODEL = process.env.REPLICATE_CHAT_MODEL || CLAUDE_MODEL;

async function generateAvatarJob(replicate: Replicate, prompt: string) {
  const prediction = await replicate.predictions.create({
    model: 'google/nano-banana-pro',
    input: {
      prompt: prompt,
      negative_prompt:
        'blurry, low quality, overprocessed, plastic skin, uncanny valley, ' +
        'cartoon, anime, illustration, CGI, 3d render, doll, mannequin, ' +
        'distorted face, asymmetrical eyes, bad teeth, extra fingers, extra limbs, ' +
        'warped hands, deformed, jpeg artifacts, watermark, logo, text, ' +
        'child, teenager, underage, school uniform',
      output_format: "png",
    }
  } as any); // Type cast as any because Replicate types can be strict about model inputs
  
  return prediction.id;
}

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

type UgcBrief = {
  product_or_service?: string;
  target_customer?: string;
  platform?: string;
  offer_cta?: string;
  brand_vibe?: string;
  language?: string;
  constraints?: string;
  must_include?: string;
};

type PersonaSpec = {
  id: string;
  label: string;
  ageRange: string;
  genderPresentation: string;
  ethnicityOrRegionalLook: string;
  skinTone: string;
  hair: string;
  faceFeatures: string;
  wardrobe: string;
  setting: string;
  backgroundProps: string[];
  cameraFraming: string;
  lighting: string;
  vibe: string;
  whyFit: string;
  imagePrompt: string;
};

type BriefAndPersonas = {
  brief: UgcBrief;
  missing: Array<keyof UgcBrief>;
  personas: PersonaSpec[];
};

function needsSafetyBlock(userRequest: string): boolean {
  const t = (userRequest || '').toLowerCase();
  return /\b(teen|teenager|minor|child|kid|underage|high school|middle school)\b/.test(t);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userRequest, userId, productImageUrl, sessionId: incomingSessionId } = body;

    if (!userRequest) return Response.json({ error: 'Missing userRequest' }, { status: 400 });
    if (!userId) return Response.json({ error: 'Missing userId' }, { status: 401 });

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return Response.json({ error: 'Missing REPLICATE_API_TOKEN' }, { status: 500 });

    const replicate = new Replicate({ auth: token });

    if (needsSafetyBlock(userRequest)) {
      const response: DynamicResponse = {
        responseType: 'dynamic',
        blocks: [
          createBlock('text', {
            style: 'error',
            format: 'plain',
            content:
              'This UGC tool only supports adult creators (21+). Please revise the request to remove any minors/teen references and try again.',
          }),
        ],
      };
      return Response.json(response);
    }

    // 1) Create a structured brief + 3 contextual personas (LLM)
    const llmPrompt = `You are a senior UGC casting director and prompt engineer.\n\nUser request:\n${userRequest}\n\n${typeof productImageUrl === 'string' && productImageUrl.trim() ? `Product image URL (for context only): ${productImageUrl}\n\n` : ''}Return ONLY valid JSON (no markdown).\n\nSchema:\n{\n  \"brief\": {\n    \"product_or_service\": string,\n    \"target_customer\": string,\n    \"platform\": string,\n    \"offer_cta\": string,\n    \"brand_vibe\": string,\n    \"language\": string,\n    \"constraints\": string,\n    \"must_include\": string\n  },\n  \"missing\": string[],\n  \"personas\": [\n    {\n      \"id\": \"p1\",\n      \"label\": string,\n      \"ageRange\": \"21-45\" | \"25-40\" | \"30-45\" | string,\n      \"genderPresentation\": string,\n      \"ethnicityOrRegionalLook\": string,\n      \"skinTone\": string,\n      \"hair\": string,\n      \"faceFeatures\": string,\n      \"wardrobe\": string,\n      \"setting\": string,\n      \"backgroundProps\": string[],\n      \"cameraFraming\": string,\n      \"lighting\": string,\n      \"vibe\": string,\n      \"whyFit\": string,\n      \"imagePrompt\": string\n    }\n  ]\n}\n\nRules:\n- Adult creators only (21+). Never mention or depict minors.\n- Personas must be tightly contextual to the product and target customer. No generic defaults.\n- Include: age, face vibe, ethnicity/regional look, skin tone, pose, setting/background, lighting, wardrobe.\n- \"imagePrompt\" must be a single, production-quality prompt for a vertical 9:16 selfie-style UGC creator photo, realistic, natural phone camera look, clean skin texture, believable.\n- Avoid stereotypes and avoid slurs.\n- If the brief is missing critical info, fill what you can but list missing keys in \"missing\".\n- Output EXACTLY 3 personas with diverse but relevant casting choices.`;

    const llmOut = await replicate.run(UGC_BRIEF_MODEL as `${string}/${string}`, {
      input: {
        // Match the same interface used by /api/assistant/chat for Claude on Replicate
        system_prompt: 'You are a JSON-only API. Output valid JSON only.',
        prompt: llmPrompt,
        max_tokens: 1800,
      },
    });

    const parsed = safeJsonParse<BriefAndPersonas>(chunkToString(llmOut));
    const brief = parsed?.brief || {};
    const missing = Array.isArray(parsed?.missing) ? parsed!.missing : [];
    const personas = Array.isArray(parsed?.personas) ? parsed!.personas : [];

    const criticalMissing =
      missing.includes('product_or_service') ||
      missing.includes('platform') ||
      !String(brief.product_or_service || '').trim() ||
      !String(brief.platform || '').trim();

    // If critical brief info is missing, ask intake questions instead of guessing.
    if (criticalMissing) {
      const intake = createBlock('question', {
        title: 'Quick UGC brief (so casting is accurate)',
        description: 'Answer these and I’ll generate 3 creator options tailored to your product and audience.',
        submitLabel: 'Generate creators',
        submitAction: 'ugc_intake_submit',
        questions: [
          {
            id: 'product_or_service',
            question: 'What is the product/service?',
            type: 'text',
            required: true,
            placeholder: 'e.g., collagen gummies for women 30+',
          },
          {
            id: 'target_customer',
            question: 'Who is the target customer?',
            type: 'text',
            required: false,
            placeholder: 'e.g., busy parents, gym beginners, SMB founders…',
          },
          {
            id: 'platform',
            question: 'Platform?',
            type: 'choice',
            required: true,
            options: ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'Other'],
          },
          {
            id: 'offer_cta',
            question: 'Offer / CTA?',
            type: 'text',
            required: false,
            placeholder: 'e.g., 20% off first order, try free, subscribe, book a demo…',
          },
          {
            id: 'brand_vibe',
            question: 'Brand vibe?',
            type: 'choice',
            required: false,
            options: ['Premium', 'Friendly', 'Playful', 'Clinical', 'Bold', 'Minimal', 'Other'],
          },
          {
            id: 'language',
            question: 'Language / country?',
            type: 'text',
            required: false,
            placeholder: 'e.g., English (US), French (FR), Spanish (MX)…',
          },
          {
            id: 'constraints',
            question: 'Any constraints (must avoid / must include)?',
            type: 'text',
            required: false,
            placeholder: 'e.g., no medical claims, no kids, show product in hand…',
          },
          {
            id: 'must_include',
            question: 'Anything specific the creator should say/show?',
            type: 'text',
            required: false,
            placeholder: 'e.g., show app screen, unboxing, before/after angle…',
          },
        ],
      });

      const response: DynamicResponse = {
        responseType: 'dynamic',
        blocks: [intake],
      };
      return Response.json(response);
    }

    const sessionId: string = (typeof incomingSessionId === 'string' && incomingSessionId.trim())
      ? incomingSessionId.trim()
      : crypto.randomUUID();

    // 2) Start 3 avatar image jobs based on persona prompts
    const finalPersonas = personas.slice(0, 3).map((p, i) => ({
      ...p,
      id: p?.id || `p${i + 1}`,
      label: p?.label || `Persona ${i + 1}`,
      imagePrompt:
        (p?.imagePrompt && String(p.imagePrompt)) ||
        `Realistic vertical 9:16 selfie-style UGC creator portrait. ${brief.platform || 'TikTok'} ad context: ${brief.product_or_service || userRequest}.`,
    }));

    await saveUgcSession(sessionId, {
      userRequest,
      brief,
      personas: finalPersonas,
      productImageUrl: typeof productImageUrl === 'string' ? productImageUrl : null,
    });

    // 3. Start jobs in parallel
    const jobs = await Promise.all(finalPersonas.map(async (p) => {
      const prompt = `${p.imagePrompt}\n\nConstraints: realistic phone camera look, vertical 9:16, creator holds phone or is framed like a selfie, natural skin texture, believable environment.`;
      const jobId = await generateAvatarJob(replicate, prompt);
      return {
        // Stable ID so we can regenerate a single variant later
        id: p.id,
        jobId,
        prompt: prompt,
        label: p.label,
        description: typeof (p as any)?.whyFit === 'string' ? (p as any).whyFit : undefined,
        status: 'processing' as const
      };
    }));

    // 4. Construct Dynamic Response
    const avatarBlock = createBlock('ugc_avatar_picker', {
      sessionId,
      brief,
      productImageUrl: typeof productImageUrl === 'string' ? productImageUrl : undefined,
      avatars: jobs,
      refinementPrompt: userRequest // Pre-fill with original request
    });

    const response: DynamicResponse = {
      responseType: 'dynamic',
      blocks: [avatarBlock],
      metadata: {
        nextAction: 'ugc_avatar_continue'
      }
    };

    return Response.json(response);

  } catch (error: any) {
    console.error('[UGC Start] Error:', error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}

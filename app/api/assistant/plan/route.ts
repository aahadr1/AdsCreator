export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest } from 'next/server';
import Replicate from 'replicate';
import { buildPlannerSystemPrompt, buildRequestAnalyzerPrompt, normalizePlannerOutput, fallbackPlanFromMessages } from '@/lib/assistantTools';
import type { AnalyzedRequest } from '@/lib/assistantTools';
import type { AssistantPlan, AssistantPlanMessage, AssistantMedia } from '@/types/assistant';

const DEFAULT_PLANNER_MODEL = process.env.REPLICATE_PLANNER_MODEL || 'anthropic/claude-3.5-sonnet';
const ANALYZER_MODEL = process.env.REPLICATE_ANALYZER_MODEL || 'meta/llama-3.1-8b-instruct';

async function recordPlanTask(origin: string, userId: string, plan: AssistantPlan, messages: AssistantPlanMessage[]) {
  try {
    const lastUser = messages.slice().reverse().find((m) => m.role === 'user');
    const res = await fetch(`${origin}/api/tasks/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        type: 'assistant-plan',
        status: 'finished',
        backend: 'assistant',
        provider: 'assistant',
        text_input: lastUser?.content || '',
        output_text: plan.summary,
        options_json: {
          source: 'assistant',
          steps: plan.steps.map((s) => ({ id: s.id, title: s.title, model: s.model, tool: s.tool })),
        },
      }),
    });
    if (!res.ok) {
      await res.text();
    }
  } catch {
    // best-effort; ignore errors
  }
}

function parseJSONFromString(raw: string): any | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {}
  const fenced = raw.match(/```json([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {}
  }
  const braceStart = raw.indexOf('{');
  const braceEnd = raw.lastIndexOf('}');
  if (braceStart >= 0 && braceEnd > braceStart) {
    const slice = raw.slice(braceStart, braceEnd + 1);
    try {
      return JSON.parse(slice);
    } catch {}
  }
  return null;
}

function normalizeMessages(msgs: any[]): AssistantPlanMessage[] {
  return (Array.isArray(msgs) ? msgs : [])
    .map((m) => {
      const role: AssistantPlanMessage['role'] =
        m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user';
      return { role, content: String(m.content || '') };
    })
    .filter((m) => m.content.trim().length > 0);
}

function normalizeMedia(list: any[]): AssistantMedia[] {
  return (Array.isArray(list) ? list : []).map((m) => ({
    type: (m?.type as AssistantMedia['type']) || 'unknown',
    url: String(m?.url || ''),
    label: typeof m?.label === 'string' ? m.label : undefined,
  })).filter((m) => m.url);
}

// Phase 1: Analyze the request to understand structure
async function analyzeRequest(
  replicate: Replicate,
  messages: AssistantPlanMessage[],
  media: AssistantMedia[],
): Promise<AnalyzedRequest | null> {
  try {
    const lastUser = messages.slice().reverse().find((m) => m.role === 'user');
    if (!lastUser) return null;

    const analyzerPrompt = buildRequestAnalyzerPrompt();
    const mediaInfo = media.length > 0 
      ? `\n\nUser has attached ${media.length} file(s): ${media.map(m => m.type).join(', ')}`
      : '';
    
    const userInput = `Analyze this request:\n\n${lastUser.content}${mediaInfo}`;

    const output = await replicate.run(ANALYZER_MODEL as `${string}/${string}`, {
      input: {
        prompt: `${analyzerPrompt}\n\n${userInput}`,
        max_tokens: 1000,
        temperature: 0.1,
      },
    });

    let rawText = '';
    if (Array.isArray(output)) {
      rawText = output.map((o) => (typeof o === 'string' ? o : JSON.stringify(o))).join('');
    } else if (typeof output === 'string') {
      rawText = output;
    }

    const parsed = parseJSONFromString(rawText);
    if (parsed && typeof parsed === 'object') {
      // Clean the video scene description to ensure it has no text content
      let sceneDesc = parsed.videoSceneDescription || parsed.motionDescription || undefined;
      if (sceneDesc) {
        // Remove any quoted text content that shouldn't be in video prompts
        sceneDesc = sceneDesc
          .replace(/["«»''"""][^"«»''"""]*["«»''""]/g, '') // Remove quoted strings
          .replace(/\s+/g, ' ')
          .trim();
        // If it became too short, use a sensible default
        if (sceneDesc.length < 30) {
          sceneDesc = 'A person holds the card in their hands, showing it to the camera. Hands steady with subtle natural trembling. Static camera, 4 seconds.';
        }
      }

      return {
        totalImageSteps: parsed.totalImageSteps || 0,
        totalVideoSteps: parsed.totalVideoSteps || 0,
        totalTtsSteps: parsed.totalTtsSteps || 0,
        totalTranscriptionSteps: parsed.totalTranscriptionSteps || 0,
        totalLipsyncSteps: parsed.totalLipsyncSteps || 0,
        totalEnhanceSteps: parsed.totalEnhanceSteps || 0,
        totalBackgroundRemoveSteps: parsed.totalBackgroundRemoveSteps || 0,
        contentVariations: Array.isArray(parsed.contentVariations) ? parsed.contentVariations : [],
        imageModificationInstruction: parsed.imageModificationInstruction || undefined,
        videoSceneDescription: sceneDesc,
        imageToVideoMapping: parsed.imageToVideoMapping || 'none',
        hasUploadedMedia: parsed.hasUploadedMedia || media.length > 0,
        uploadedMediaUsage: parsed.uploadedMediaUsage || 'none',
      };
    }
  } catch (err) {
    console.error('Request analysis failed:', err);
  }
  return null;
}

// Build enhanced user prompt with analysis context
function buildEnhancedUserPrompt(
  messages: AssistantPlanMessage[],
  media: AssistantMedia[],
  analysis: AnalyzedRequest | null,
): string {
  const mediaLines = media.map((m) => `- ${m.type}: ${m.url}${m.label ? ` (${m.label})` : ''}`).join('\n');
  
  const analysisContext = analysis ? `
## PRE-ANALYSIS RESULTS (USE THESE TO BUILD PROMPTS)

### STEP COUNTS (create exactly this many)
- IMAGE steps: ${analysis.totalImageSteps}
- VIDEO steps: ${analysis.totalVideoSteps}
- TTS steps: ${analysis.totalTtsSteps}
- LIPSYNC steps: ${analysis.totalLipsyncSteps}
- ENHANCE steps: ${analysis.totalEnhanceSteps}
- BACKGROUND_REMOVE steps: ${analysis.totalBackgroundRemoveSteps}

### IMAGE PROMPT CONSTRUCTION
${analysis.imageModificationInstruction ? `Base instruction: "${analysis.imageModificationInstruction}"` : 'No modification instruction - create new images'}
${analysis.contentVariations.length > 0 ? `Content variations (one per image step):${analysis.contentVariations.map((c, i) => `\n  Image ${i + 1}: "${c}"`).join('')}` : 'No content variations'}
${analysis.hasUploadedMedia && analysis.uploadedMediaUsage === 'to-modify' ? '\n**IMPORTANT: ALL image steps must use the SAME original uploaded image as input_images. Do NOT chain image outputs!**' : ''}

**FOR EACH IMAGE STEP, prompt format:**
"${analysis.imageModificationInstruction || 'Modify this image to change the text to'}: '[content variation]'"

### VIDEO SCENE PROMPT (USE THIS FOR ALL VIDEOS)
${analysis.videoSceneDescription ? `"${analysis.videoSceneDescription}"` : '"A person holds the card in their hands, showing it to the camera. Hands steady with subtle natural trembling. Static camera, 4 seconds."'}

**CRITICAL: ALL video steps use the SAME scene prompt above. Only start_image differs (each video uses its corresponding image output).**
**NEVER copy the user's original message into video prompts!**

### RELATIONSHIPS
- Image-to-video mapping: ${analysis.imageToVideoMapping}
- User uploaded media: ${analysis.hasUploadedMedia ? 'YES' : 'NO'}
- Upload usage: ${analysis.uploadedMediaUsage}
` : '';

  return [
    '## USER CONVERSATION (most recent last)',
    ...messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`),
    '',
    mediaLines ? `## ATTACHED MEDIA\n${mediaLines}` : '## NO MEDIA ATTACHED',
    analysisContext,
    '',
    'Generate the JSON plan now. Use the exact prompts specified above.',
  ].join('\n');
}

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {}

  const messages = normalizeMessages(body?.messages || []);
  const media = normalizeMedia(body?.media || []);
  const userId = typeof body?.user_id === 'string' ? body.user_id : '';

  if (!messages.length) {
    return new Response('Missing messages', { status: 400 });
  }
  if (!userId) {
    return new Response('Missing user_id', { status: 401 });
  }

  let usedModel = DEFAULT_PLANNER_MODEL;
  let parsed: AssistantPlan | null = null;
  let rawText = '';
  let analysisResult: AnalyzedRequest | null = null;

  const token = process.env.REPLICATE_API_TOKEN;
  if (token) {
    try {
      const replicate = new Replicate({ auth: token });

      // PHASE 1: Analyze the request to understand structure
      analysisResult = await analyzeRequest(replicate, messages, media);

      // PHASE 2: Generate the plan with analysis context
      const systemPrompt = buildPlannerSystemPrompt();
      const userPrompt = buildEnhancedUserPrompt(messages, media, analysisResult);

      // Calculate max tokens based on expected step count
      const expectedSteps = analysisResult 
        ? (analysisResult.totalImageSteps + analysisResult.totalVideoSteps + 
           analysisResult.totalTtsSteps + analysisResult.totalLipsyncSteps +
           analysisResult.totalEnhanceSteps + analysisResult.totalBackgroundRemoveSteps +
           analysisResult.totalTranscriptionSteps)
        : 2;
      // ~200 tokens per step, minimum 1500, max 8000
      const maxTokens = Math.min(8000, Math.max(1500, expectedSteps * 250));

      const output = await replicate.run(usedModel as `${string}/${string}`, {
        input: {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.2,
          top_p: 0.9,
        },
      });

      if (Array.isArray(output)) {
        rawText = output.map((o) => (typeof o === 'string' ? o : JSON.stringify(o))).join('\n');
      } else if (typeof output === 'string') {
        rawText = output;
      } else if (output && typeof output === 'object') {
        rawText = JSON.stringify(output);
      }
      
      const rawJson = parseJSONFromString(rawText);
      parsed = normalizePlannerOutput(rawJson, messages, media, analysisResult);
    } catch (err) {
      parsed = null;
      rawText = (err as Error)?.message || 'planner failed';
    }
  }

  const plan: AssistantPlan = parsed || fallbackPlanFromMessages(messages, media);

  const origin = new URL(req.url).origin;
  recordPlanTask(origin, userId, plan, messages).catch(() => {});

  return Response.json({
    plan,
    usedModel,
    analysis: analysisResult,
    debug: process.env.NODE_ENV !== 'production' ? { rawText: rawText.slice(0, 4000) } : undefined,
  });
}

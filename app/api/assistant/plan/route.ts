export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest } from 'next/server';
import Replicate from 'replicate';
import {
  buildPlannerSystemPrompt,
  buildPromptAuthorSystemPrompt,
  buildRequestAnalyzerPrompt,
  buildDecompositionUserPrompt,
  buildAuthoringUserPrompt,
  normalizePlannerOutput,
  fallbackPlanFromMessages,
} from '@/lib/assistantTools';
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
          sceneDesc = 'Follow the described scene with stable framing and natural motion (around 4 seconds).';
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
        goals: parsed.goals,
        intents: Array.isArray(parsed.intents) ? parsed.intents : [],
        styleCues: Array.isArray(parsed.styleCues) ? parsed.styleCues : [],
        motionCues: Array.isArray(parsed.motionCues) ? parsed.motionCues : [],
        tone: parsed.tone,
        risks: Array.isArray(parsed.risks) ? parsed.risks : [],
        openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions : [],
        requiredAssets: Array.isArray(parsed.requiredAssets) ? parsed.requiredAssets : [],
        missingInfo: Array.isArray(parsed.missingInfo) ? parsed.missingInfo : [],
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
  let rawTextDraft = '';
  let analysisResult: AnalyzedRequest | null = null;

  const token = process.env.REPLICATE_API_TOKEN;
  if (token) {
    try {
      const replicate = new Replicate({ auth: token });

      // PHASE 1: Analyze the request to understand structure
      analysisResult = await analyzeRequest(replicate, messages, media);

      // Estimate steps for token budgeting
      const expectedSteps = analysisResult
        ? (analysisResult.totalImageSteps +
            analysisResult.totalVideoSteps +
            analysisResult.totalTtsSteps +
            analysisResult.totalLipsyncSteps +
            analysisResult.totalEnhanceSteps +
            analysisResult.totalBackgroundRemoveSteps +
            analysisResult.totalTranscriptionSteps || 0)
        : 4;

      // PHASE 2: Decomposition (structure only, prompt outlines)
      const decompositionSystem = buildPlannerSystemPrompt();
      const decompositionUser = buildDecompositionUserPrompt(messages, media, analysisResult);
      const maxTokensDraft = Math.min(6000, Math.max(1200, expectedSteps * 180));

      const draftOutput = await replicate.run(usedModel as `${string}/${string}`, {
        input: {
          messages: [
            { role: 'system', content: decompositionSystem },
            { role: 'user', content: decompositionUser },
          ],
          max_tokens: maxTokensDraft,
          temperature: 0.2,
          top_p: 0.9,
        },
      });

      if (Array.isArray(draftOutput)) {
        rawTextDraft = draftOutput.map((o) => (typeof o === 'string' ? o : JSON.stringify(o))).join('\n');
      } else if (typeof draftOutput === 'string') {
        rawTextDraft = draftOutput;
      } else if (draftOutput && typeof draftOutput === 'object') {
        rawTextDraft = JSON.stringify(draftOutput);
      }

      const draftPlanJson = parseJSONFromString(rawTextDraft);

      // PHASE 3: Prompt authoring (turn outlines into full prompts)
      const authorSystem = buildPromptAuthorSystemPrompt();
      const authorUser = buildAuthoringUserPrompt(messages, media, analysisResult, draftPlanJson || rawTextDraft);
      const maxTokensFinal = Math.min(9000, Math.max(2000, expectedSteps * 260));

      const finalOutput = await replicate.run(usedModel as `${string}/${string}`, {
        input: {
          messages: [
            { role: 'system', content: authorSystem },
            { role: 'user', content: authorUser },
          ],
          max_tokens: maxTokensFinal,
          temperature: 0.35,
          top_p: 0.9,
        },
      });

      if (Array.isArray(finalOutput)) {
        rawText = finalOutput.map((o) => (typeof o === 'string' ? o : JSON.stringify(o))).join('\n');
      } else if (typeof finalOutput === 'string') {
        rawText = finalOutput;
      } else if (finalOutput && typeof finalOutput === 'object') {
        rawText = JSON.stringify(finalOutput);
      }

      const finalJson = parseJSONFromString(rawText) || draftPlanJson;
      parsed = normalizePlannerOutput(finalJson, messages, media, analysisResult);
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
    debug: process.env.NODE_ENV !== 'production'
      ? { rawText: rawText.slice(0, 4000), rawTextDraft: rawTextDraft.slice(0, 4000) }
      : undefined,
  });
}

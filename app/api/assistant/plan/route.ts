export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest } from 'next/server';
import Replicate from 'replicate';
import { buildPlannerSystemPrompt, normalizePlannerOutput, fallbackPlanFromMessages } from '@/lib/assistantTools';
import type { AssistantPlan, AssistantPlanMessage, AssistantMedia } from '@/types/assistant';

const DEFAULT_PLANNER_MODEL = process.env.REPLICATE_PLANNER_MODEL || 'anthropic/claude-3.5-sonnet';

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

  const systemPrompt = buildPlannerSystemPrompt();
  const mediaLines = media.map((m) => `- ${m.type}: ${m.url}${m.label ? ` (${m.label})` : ''}`).join('\n');
  const userPrompt = [
    'You are planning a multimodal workflow.',
    'User chat (most recent last):',
    ...messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`),
    mediaLines ? `Attached media:\n${mediaLines}` : 'No media provided yet.',
    'Return the JSON plan now.',
  ].join('\n');

  let usedModel = DEFAULT_PLANNER_MODEL;
  let parsed: AssistantPlan | null = null;
  let rawText = '';

  const token = process.env.REPLICATE_API_TOKEN;
  if (token) {
    try {
      const replicate = new Replicate({ auth: token });
      const output = await replicate.run(usedModel as `${string}/${string}`, {
        input: {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 1200,
          temperature: 0.25,
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
      parsed = normalizePlannerOutput(rawJson, messages, media);
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
    debug: process.env.NODE_ENV !== 'production' ? { rawText: rawText.slice(0, 4000) } : undefined,
  });
}

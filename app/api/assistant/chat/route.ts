export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest } from 'next/server';
import Replicate from 'replicate';
import type { AssistantPlanMessage, AssistantMedia } from '@/types/assistant';

const SONNET_4_5_MODEL = 'anthropic/claude-4.5-sonnet';
const DEFAULT_CHAT_MODEL = process.env.REPLICATE_CHAT_MODEL || SONNET_4_5_MODEL;

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
  return (Array.isArray(list) ? list : [])
    .map((m) => ({
      type: (m?.type as AssistantMedia['type']) || 'unknown',
      url: String(m?.url || ''),
      label: typeof m?.label === 'string' ? m.label : undefined,
    }))
    .filter((m) => m.url);
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

function buildChatSystemPrompt(): string {
  return `You are AdzCreator's Assistant.

Answer the user normally in plain English.

Critical rules:
- Do NOT output a workflow/plan JSON unless the user explicitly asks for a "plan", "workflow", or "step-by-step steps" to generate assets.
- If the user asks for a workflow plan, you may briefly acknowledge and tell them to request a workflow plan (e.g., "Ask: create a workflow plan for ...") rather than emitting JSON here.
- Keep responses concise and helpful. Ask at most 1-2 clarifying questions only if truly required.`;
}

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const messages = normalizeMessages(body?.messages || []);
  const media = normalizeMedia(body?.media || []);
  const userId = typeof body?.user_id === 'string' ? body.user_id : '';

  if (!messages.length) return new Response('Missing messages', { status: 400 });
  if (!userId) return new Response('Missing user_id', { status: 401 });

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return new Response('Missing REPLICATE_API_TOKEN', { status: 500 });

  const replicate = new Replicate({ auth: token });

  const systemPrompt = buildChatSystemPrompt();
  const conversation = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const mediaLines =
    media.length > 0
      ? `\n\nATTACHED MEDIA:\n${media
          .map((m) => `- ${m.type}: ${m.url}${m.label ? ` (${m.label})` : ''}`)
          .join('\n')}`
      : '';

  const userPrompt = `${conversation}${mediaLines}\n\nRespond to the last USER message.`;

  const usedModel = DEFAULT_CHAT_MODEL;
  const output = await replicate.run(usedModel as `${string}/${string}`, {
    input: {
      system_prompt: systemPrompt,
      prompt: userPrompt,
      max_tokens: 1200,
    },
  });

  const message = chunkToString(output).trim();
  if (!message) {
    return Response.json({ error: 'Empty model response', usedModel }, { status: 500 });
  }

  return Response.json({ message, usedModel });
}


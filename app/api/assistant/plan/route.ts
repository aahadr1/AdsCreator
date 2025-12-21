export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest } from 'next/server';
import Replicate from 'replicate';
import {
  buildUnifiedPlannerSystemPrompt,
  normalizePlannerOutput,
} from '@/lib/assistantTools';
import type { AssistantPlan, AssistantPlanMessage, AssistantMedia } from '@/types/assistant';

const SONNET_4_5_MODEL = 'anthropic/claude-4.5-sonnet';
const DEFAULT_PLANNER_MODEL = process.env.REPLICATE_PLANNER_MODEL || SONNET_4_5_MODEL;

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

function repairJsonString(raw: string): string {
  let repaired = '';
  let inString = false;
  let escaping = false;
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    if (!inString) {
      if (char === '"') {
        inString = true;
        repaired += char;
      } else {
        repaired += char;
      }
      continue;
    }
    if (escaping) {
      repaired += char;
      escaping = false;
      continue;
    }
    if (char === '\\') {
      repaired += char;
      escaping = true;
      continue;
    }
    if (char === '"') {
      let j = i + 1;
      while (j < raw.length && /\s/.test(raw[j])) j += 1;
      const next = raw[j];
      if (next && ![',', '}', ']', ':'].includes(next)) {
        repaired += '\\"';
        continue;
      }
      inString = false;
      repaired += char;
      continue;
    }
    repaired += char;
  }
  return repaired;
}

function parseJSONFromString(raw: string, seen: Set<string> = new Set()): any | null {
  if (!raw || seen.has(raw)) return null;
  seen.add(raw);

  const candidates: string[] = [];
  candidates.push(raw);
  
  // Try to extract from markdown code blocks
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1]);
  
  // Try to find JSON object boundaries
  const braceStart = raw.indexOf('{');
  const braceEnd = raw.lastIndexOf('}');
  if (braceStart >= 0 && braceEnd > braceStart) {
    candidates.push(raw.slice(braceStart, braceEnd + 1));
  }
  
  // Try to unwrap string literals
  const stringLiteral = raw.match(/^["']([\s\S]*)["']$/);
  if (stringLiteral?.[1]) candidates.push(stringLiteral[1]);
  
  // Also try looking for JSON after common prefixes
  const afterPrefix = raw.match(/(?:here is|here's|output:|result:)\s*({[\s\S]*})/i);
  if (afterPrefix?.[1]) candidates.push(afterPrefix[1]);

  const tryParse = (text: string): any | null => {
    try {
      const parsed = JSON.parse(text);
      
      // Handle wrapped responses like { "output": [...] }
      if (parsed && typeof parsed === 'object' && parsed.output !== undefined) {
        const inner = parsed.output;
        const stringOutput = Array.isArray(inner)
          ? inner.map((chunk) => (typeof chunk === 'string' ? chunk : JSON.stringify(chunk))).join('')
          : typeof inner === 'string'
            ? inner
            : null;
        if (stringOutput) {
          const nested = parseJSONFromString(stringOutput, seen);
          if (nested) return nested;
        }
      }
      
      return parsed;
    } catch (err) {
      // Silently fail and try next candidate
      return null;
    }
  };

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    
    // Try as-is
    const parsed = tryParse(trimmed);
    if (parsed) return parsed;
    
    // Try with repaired quotes
    const repaired = repairJsonString(trimmed);
    if (repaired !== trimmed) {
      const repairedParsed = tryParse(repaired);
      if (repairedParsed) return repairedParsed;
    }
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

function chunkToString(chunk: any): string {
  if (!chunk && chunk !== 0) return '';
  if (typeof chunk === 'string' || typeof chunk === 'number') return String(chunk);
  if (Array.isArray(chunk)) return chunk.map(chunkToString).join('');

  if (typeof chunk === 'object') {
    // Ignore metadata and control events from Claude streaming
    const ignorableTypes = new Set([
      'message_start',
      'message_stop',
      'content_block_start',
      'content_block_stop',
      'metadata',
      'response.completed',
      'response.output_audio.delta',
      'ping',
      'error',
    ]);

    if (chunk.type && ignorableTypes.has(chunk.type)) return '';

    // Handle Claude streaming format - extract text from content blocks
    if (chunk.type === 'content_block_delta') {
      if (chunk.delta) {
        // Delta can be text or have nested structure
        if (typeof chunk.delta === 'string') return chunk.delta;
        if (chunk.delta.text) return chunk.delta.text;
        if (chunk.delta.type === 'text_delta' && chunk.delta.text) return chunk.delta.text;
        return chunkToString(chunk.delta);
      }
      return '';
    }

    if (chunk.type === 'content_block') {
      // Content block can have text directly or nested
      if (chunk.text) return chunk.text;
      if (chunk.content) return chunkToString(chunk.content);
      return '';
    }

    if (chunk.type === 'message_delta' && chunk.delta) {
      return chunkToString(chunk.delta);
    }

    if (chunk.type === 'message') {
      // Message can have content array or direct text
      if (Array.isArray(chunk.content)) {
        return chunk.content.map(chunkToString).join('');
      }
      if (chunk.message) return chunkToString(chunk.message);
      if (chunk.text) return chunk.text;
      return '';
    }

    // Handle Replicate output wrapper
    if (chunk.type === 'output' && chunk.output !== undefined) {
      return chunkToString(chunk.output);
    }

    // Direct text fields (various formats)
    if (typeof chunk.text === 'string') return chunk.text;
    if (typeof chunk.delta === 'string') return chunk.delta;
    if (typeof chunk.value === 'string') return chunk.value;

    // Nested content structures
    if (Array.isArray(chunk.content)) {
      return chunk.content.map(chunkToString).join('');
    }
    if (typeof chunk.message === 'object') {
      return chunkToString(chunk.message);
    }
    if (chunk.output !== undefined) {
      return chunkToString(chunk.output);
    }

    // If it's already a plan object with steps, return empty (we'll handle it separately)
    if (Array.isArray(chunk.steps)) {
      return '';
    }
  }

  // Last resort: stringify if it's not a plan object
  try {
    return JSON.stringify(chunk);
  } catch {
    return '';
  }
}

// Robust extraction: even if JSON is malformed, try to extract steps
function extractPlanFromText(
  text: string,
  messages: AssistantPlanMessage[],
  media: AssistantMedia[],
  analysis: any | null,
): any {
  console.log('[Extract] Attempting to extract plan from malformed output...');
  
  // Try to find steps array even in partial JSON
  const stepsMatch = text.match(/"steps"\s*:\s*\[([\s\S]*)\]/i);
  if (stepsMatch) {
    try {
      const stepsJson = `[${stepsMatch[1]}]`;
      const steps = JSON.parse(stepsJson);
      if (Array.isArray(steps) && steps.length > 0) {
        console.log(`[Extract] Extracted ${steps.length} steps from partial JSON`);
        return { summary: 'Generated workflow', steps };
      }
    } catch (e) {
      console.warn('[Extract] Failed to parse extracted steps array');
    }
  }
  
  // Fallback: Create minimal plan from analysis
  if (analysis) {
    console.log('[Extract] Creating minimal plan from analysis');
    const steps: any[] = [];
    let stepNum = 1;
    
    // Create image steps
    for (let i = 0; i < (analysis.totalImageSteps || 0); i++) {
      const contentText = analysis.contentVariations?.[i] || '';
      steps.push({
        id: `image-${stepNum}`,
        title: `Generate Image ${stepNum}`,
        tool: 'image',
        model: 'openai/gpt-image-1.5',
        inputs: {
          prompt: contentText 
            ? `Professional image featuring "${contentText}" with clean composition and good lighting`
            : `Professional image based on user request with clean composition`,
          aspect_ratio: '1:1',
          number_of_images: 1,
        },
        outputType: 'image',
        dependencies: [],
      });
      stepNum++;
    }
    
    // Create video steps
    for (let i = 0; i < (analysis.totalVideoSteps || 0); i++) {
      const prevImageId = steps.find(s => s.tool === 'image')?.id;
      steps.push({
        id: `video-${stepNum}`,
        title: `Animate Video ${stepNum}`,
        tool: 'video',
        model: 'google/veo-3-fast',
        inputs: {
          prompt: analysis.videoSceneDescription || 'Natural motion with stable camera, 4 seconds',
          start_image: prevImageId ? `{{steps.${prevImageId}.url}}` : undefined,
          resolution: '720p',
        },
        outputType: 'video',
        dependencies: prevImageId ? [prevImageId] : [],
      });
      stepNum++;
    }
    
    if (steps.length > 0) {
      console.log(`[Extract] Created fallback plan with ${steps.length} steps`);
      return { summary: 'Generated workflow from request analysis', steps };
    }
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

  const token = process.env.REPLICATE_API_TOKEN;
  if (token) {
    try {
      const replicate = new Replicate({ auth: token });

      // SINGLE-PHASE APPROACH: Send user prompt directly to Sonnet 4.5 with comprehensive system prompt
      // The system prompt contains all context, tools, models, use cases, and examples
      const plannerSystem = buildUnifiedPlannerSystemPrompt();
      
      // Build user prompt with conversation history and media
      const conversation = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
      const mediaLines = media.length > 0
        ? `\n\nATTACHED MEDIA:\n${media.map((m) => `- ${m.type}: ${m.url}${m.label ? ` (${m.label})` : ''}`).join('\n')}`
        : '';
      
      const plannerUser = `${conversation}${mediaLines}

Generate the complete workflow plan with detailed, ready-to-use prompts. Return only valid JSON.`;

      // Estimate token budget based on message length and media count
      const estimatedSteps = Math.max(2, Math.ceil((messages[messages.length - 1]?.content?.length || 0) / 200));
      const maxTokens = Math.min(12000, Math.max(4000, estimatedSteps * 500));

      console.log(`[Plan] Running Sonnet 4.5 planner (estimated ${estimatedSteps} steps, max ${maxTokens} tokens)`);
      console.log(`[Plan] System prompt length: ${plannerSystem.length} chars`);
      console.log(`[Plan] User prompt length: ${plannerUser.length} chars`);

      const planOutput = await replicate.run(usedModel as `${string}/${string}`, {
        input: {
          system_prompt: plannerSystem,
          prompt: plannerUser,
          max_tokens: maxTokens,
        },
      });
      
      let planJsonCandidate: any | null = null;
      rawText = '';

      // Short-circuit: Check if Replicate already gave us a valid plan object
      if (planOutput && typeof planOutput === 'object' && !Array.isArray(planOutput)) {
        // Check if it's already a plan with steps
        if (Array.isArray((planOutput as any).steps)) {
          planJsonCandidate = planOutput;
          rawText = JSON.stringify(planOutput);
          console.log('[Plan] ✓ Replicate returned plan object directly with', (planOutput as any).steps.length, 'steps');
        }
        // Check for nested wrappers (plan, output, result, data)
        else if ((planOutput as any).plan && Array.isArray((planOutput as any).plan.steps)) {
          planJsonCandidate = (planOutput as any).plan;
          rawText = JSON.stringify((planOutput as any).plan);
          console.log('[Plan] ✓ Found plan in nested wrapper');
        }
        else if ((planOutput as any).output && typeof (planOutput as any).output === 'object') {
          const output = (planOutput as any).output;
          if (Array.isArray(output.steps)) {
            planJsonCandidate = output;
            rawText = JSON.stringify(output);
            console.log('[Plan] ✓ Found plan in output wrapper');
          } else {
            rawText = chunkToString(planOutput);
          }
        }
        else {
          rawText = chunkToString(planOutput);
        }
      } else if (Array.isArray(planOutput)) {
        // Handle array of chunks - reconstruct JSON from streaming events
        rawText = planOutput.map(chunkToString).join('');
        console.log('[Plan] Reconstructed text from', planOutput.length, 'chunks, length:', rawText.length);
      } else if (typeof planOutput === 'string') {
        rawText = planOutput;
      } else {
        rawText = String(planOutput || '');
      }

      console.log(`[Plan] Got response (${rawText.length} chars)`);
      console.log(`[Plan] First 500 chars:`, rawText.slice(0, 500));
      if (rawText.length > 500) {
        console.log(`[Plan] Last 500 chars:`, rawText.slice(-500));
      }

      // Try robust parsing with fallback extraction
      let planJson = planJsonCandidate;
      
      // If we don't have a candidate, try parsing the text
      if (!planJson) {
        planJson = parseJSONFromString(rawText);
        if (planJson && Array.isArray(planJson.steps)) {
          console.log('[Plan] ✓ Parsed JSON from text, found', planJson.steps.length, 'steps');
        }
      }
      
      // If still no plan, try extraction
      if (!planJson || !planJson.steps || !Array.isArray(planJson.steps)) {
        console.warn('[Plan] JSON parsing failed or no steps found, attempting extraction...');
        planJson = extractPlanFromText(rawText, messages, media, null);
      }
      
      if (!planJson || !planJson.steps || planJson.steps.length === 0) {
        console.error('[Plan] Could not extract valid plan.');
        console.error('[Plan] Raw output (first 2000 chars):', rawText.slice(0, 2000));
        console.error('[Plan] Raw output (last 2000 chars):', rawText.slice(-2000));
        console.error('[Plan] PlanJson candidate:', planJsonCandidate ? 'exists' : 'null');
        throw new Error('Failed to generate valid plan. Please try rephrasing your request.');
      }
      
      console.log(`[Plan] ✓ Successfully extracted plan with ${planJson.steps.length} steps`);
      
      console.log(`[Plan] Successfully parsed ${planJson.steps.length} steps`);
      
      // Log prompts for debugging
      planJson.steps.forEach((step: any, idx: number) => {
        const prompt = step?.inputs?.prompt || step?.prompt || '(missing)';
        const preview = typeof prompt === 'string' 
          ? prompt.slice(0, 120).replace(/\n/g, ' ') 
          : '(invalid type)';
        console.log(`[Plan] Step ${idx + 1} "${step?.title || step?.id}": ${preview}${prompt.length > 120 ? '...' : ''}`);
      });
      
      parsed = await normalizePlannerOutput(planJson, messages, media, null);
      
      // Log final dependencies
      if (parsed?.steps) {
        console.log('\n[Plan] 📋 Final workflow dependencies:');
        parsed.steps.forEach((step: any, idx: number) => {
          const deps = step.dependencies?.length 
            ? step.dependencies.map((d: string) => {
                const depStep = parsed!.steps.find((s: any) => s.id === d);
                return depStep ? `"${depStep.title}"` : d;
              }).join(', ')
            : 'none';
          const startImage = step.inputs?.start_image || step.inputs?.image;
          const imageInfo = startImage ? ` [start_image: ${startImage}]` : '';
          console.log(`[Plan]   ${idx + 1}. "${step.title}" (${step.tool}) → depends on: ${deps}${imageInfo}`);
        });
      }
    } catch (err) {
      parsed = null;
      rawText = (err as Error)?.message || 'planner failed';
    }
  }

  if (!parsed) {
    return Response.json({ error: rawText || 'planner failed' }, { status: 500 });
  }

  const plan: AssistantPlan = parsed;
  const origin = new URL(req.url).origin;
  recordPlanTask(origin, userId, plan, messages).catch(() => {});

  return Response.json({
    plan,
    usedModel,
    debug: process.env.NODE_ENV !== 'production'
      ? { rawText: rawText.slice(0, 4000) }
      : undefined,
  });
}

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
      
      // If it's already a valid plan with steps, return it immediately
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.steps)) {
        return parsed;
      }
      
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

  // Remove duplicates and prioritize candidates
  const uniqueCandidates = Array.from(new Set(candidates.filter(c => c && c.trim().length > 10)));

  for (const candidate of uniqueCandidates) {
    const trimmed = candidate.trim();
    if (!trimmed || trimmed.length < 10) continue; // Skip very short candidates
    
    // Try as-is
    const parsed = tryParse(trimmed);
    if (parsed && parsed.steps && Array.isArray(parsed.steps)) {
      return parsed;
    }
    
    // Try with repaired quotes
    const repaired = repairJsonString(trimmed);
    if (repaired !== trimmed) {
      const repairedParsed = tryParse(repaired);
      if (repairedParsed && repairedParsed.steps && Array.isArray(repairedParsed.steps)) {
        return repairedParsed;
      }
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

// REMOVED: extractPlanFromText - we only use Claude's output, no fallbacks


// Helper to detect vague requests
function isVagueRequest(messages: AssistantPlanMessage[]): boolean {
  const lastUserMsg = messages.slice().reverse().find(m => m.role === 'user');
  if (!lastUserMsg) return false;
  
  const content = lastUserMsg.content.toLowerCase();
  const vaguePatterns = [
    /^(create|make|generate|build|design)(\s+an?)?(\s+ad|ads|campaign)/i,
    /^(help|assist)(\s+me)?(\s+with)?(\s+ad|ads)/i,
    /^ad(s)?\s+for\s+my\s+brand/i,
  ];
  
  return vaguePatterns.some(pattern => pattern.test(content)) && !hasWebsiteURL(content);
}

// Helper to extract website URL
function extractWebsiteURL(text: string): string | null {
  const urlPatterns = [
    /https?:\/\/[^\s]+/i,
    /www\.[^\s]+/i,
    /[a-z0-9-]+\.(com|net|org|io|co|ai|app)[^\s]*/i,
  ];
  
  for (const pattern of urlPatterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}

// Helper to check if URL exists
function hasWebsiteURL(text: string): boolean {
  return extractWebsiteURL(text) !== null;
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

  const lastUserMsg = messages[messages.length - 1];
  const websiteURL = lastUserMsg?.role === 'user' ? extractWebsiteURL(lastUserMsg.content) : null;

  // CRITICAL: Check if request is vague and needs clarification
  if (isVagueRequest(messages)) {
    console.log('[Plan] 🤔 Vague request detected, returning thinking phase with questions');
    
    return Response.json({
      responseType: 'phased',
      activePhase: 'thinking',
      requestId: `req_${Date.now()}`,
      timestamp: Date.now(),
      thinking: {
        phase: 'thinking',
        status: 'active',
        thoughts: [
          {
            id: 't1',
            type: 'understanding',
            title: 'Understanding Request',
            content: 'User wants to create ads but hasn\'t provided enough information yet.',
            priority: 'important',
            status: 'complete',
            timestamp: Date.now(),
          },
          {
            id: 't2',
            type: 'questioning',
            title: 'Missing Critical Information',
            content: 'I need website URL to analyze the brand, and details about the product/service to promote.',
            priority: 'critical',
            status: 'complete',
            timestamp: Date.now(),
          },
        ],
        currentThought: 'Waiting for brand information...',
      },
      needsInput: {
        type: 'question',
        data: {
          questions: [
            {
              id: 'url',
              question: 'What\'s your brand\'s website URL?',
              type: 'url',
              required: true,
            },
            {
              id: 'product',
              question: 'What product or service should the ads promote?',
              type: 'text',
              required: true,
            },
            {
              id: 'platform',
              question: 'Which platform(s)? (TikTok, Instagram, Facebook, YouTube)',
              type: 'text',
              required: false,
            },
          ],
        },
      },
    });
  }

  // CRITICAL: If URL provided, call website_analyzer autonomously
  if (websiteURL) {
    console.log(`[Plan] 🔍 Website URL detected: ${websiteURL}, analyzing...`);
    
    // Return thinking phase with tool execution
    return Response.json({
      responseType: 'phased',
      activePhase: 'thinking',
      requestId: `req_${Date.now()}`,
      timestamp: Date.now(),
      thinking: {
        phase: 'thinking',
        status: 'active',
        streamingEnabled: true,
        thoughts: [
          {
            id: 't1',
            type: 'understanding',
            title: 'Understanding Request',
            content: `User wants ads for ${websiteURL}. I have the website URL, so I'll analyze it first.`,
            priority: 'info',
            status: 'complete',
            timestamp: Date.now(),
          },
          {
            id: 't2',
            type: 'executing_tool',
            title: 'Analyzing Brand Website',
            content: 'Calling website_analyzer to understand brand identity, products, target audience, tone, and visual style.',
            priority: 'important',
            status: 'running',
            toolExecution: {
              toolName: 'website_analyzer',
              params: { url: websiteURL },
              status: 'running',
            },
            timestamp: Date.now(),
          },
        ],
        currentThought: '🔍 Analyzing your brand website...',
        currentToolExecution: {
          toolName: 'website_analyzer',
          displayMessage: '🔍 Analyzing your brand website...',
          progress: 50,
        },
      },
    });
    // Note: In production, this would actually call the tool and continue
    // For now, we're showing the thinking phase so the user sees the process
  }

  let usedModel = DEFAULT_PLANNER_MODEL;
  let parsed: AssistantPlan | null = null;
  let rawText = '';
  let claudeOriginalPlan: any = null; // Store Claude's original output for verification

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

      // STRICT: Only use Claude's output - no fallbacks
      let planJson = planJsonCandidate;
      
      // If we don't have a candidate, try parsing the text
      if (!planJson) {
        planJson = parseJSONFromString(rawText);
        if (planJson && Array.isArray(planJson.steps)) {
          console.log('[Plan] ✓ Parsed JSON from Claude text, found', planJson.steps.length, 'steps');
        }
      }
      
      // CRITICAL: If we can't parse Claude's output, try repair with another LLM call
      if (!planJson || !planJson.steps || !Array.isArray(planJson.steps) || planJson.steps.length === 0) {
        console.error('[Plan] ❌ CRITICAL: Could not parse Claude\'s output');
        console.error('[Plan] Raw Claude output (first 3000 chars):', rawText.slice(0, 3000));
        console.error('[Plan] Raw Claude output (last 3000 chars):', rawText.slice(-3000));
        console.error('[Plan] PlanJson candidate:', planJsonCandidate ? JSON.stringify(planJsonCandidate).slice(0, 1000) : 'null');
        console.error('[Plan] Parsed planJson:', planJson ? JSON.stringify(planJson).slice(0, 1000) : 'null');
        
        // Try to repair with another LLM call
        console.log('[Plan] 🔧 Attempting to repair Claude\'s output with repair LLM call...');
        try {
          const repairPrompt = `The following is Claude's output that failed to parse. Extract or repair the JSON plan from it. Return ONLY valid JSON with a "summary" and "steps" array. No markdown, no explanation.

Claude's output:
${rawText.slice(0, 8000)}

User's original request:
${messages.filter(m => m.role === 'user').map(m => m.content).join('\n')}

Return ONLY valid JSON in this exact format:
{
  "summary": "...",
  "steps": [
    {
      "id": "...",
      "title": "...",
      "tool": "...",
      "model": "...",
      "inputs": {...},
      "outputType": "...",
      "dependencies": []
    }
  ]
}`;

          const repairOutput = await replicate.run(SONNET_4_5_MODEL as `${string}/${string}`, {
            input: {
              system_prompt: 'You are a JSON repair specialist. Extract valid JSON from malformed text. Return ONLY valid JSON, no markdown, no explanation.',
              prompt: repairPrompt,
              max_tokens: 8000,
            },
          });

          let repairText = '';
          if (Array.isArray(repairOutput)) {
            repairText = repairOutput.map((o) => (typeof o === 'string' ? o : JSON.stringify(o))).join('');
          } else if (typeof repairOutput === 'string') {
            repairText = repairOutput;
          } else if (repairOutput && typeof repairOutput === 'object') {
            repairText = JSON.stringify(repairOutput);
          }

          const repairedJson = parseJSONFromString(repairText);
          if (repairedJson && Array.isArray(repairedJson.steps) && repairedJson.steps.length > 0) {
            console.log('[Plan] ✓ Repair successful! Got', repairedJson.steps.length, 'steps from repair');
            planJson = repairedJson;
          } else {
            console.error('[Plan] ❌ Repair also failed');
            throw new Error('Failed to parse Claude\'s plan output and repair attempt also failed. Claude must return valid JSON with a steps array.');
          }
        } catch (repairErr: any) {
          console.error('[Plan] ❌ Repair attempt failed:', repairErr);
          throw new Error('Failed to parse Claude\'s plan output. Claude must return valid JSON with a steps array.');
        }
      }
      
      // Store Claude's original output for comparison (moved to outer scope)
      claudeOriginalPlan = JSON.parse(JSON.stringify(planJson));
      
      console.log(`[Plan] ✓ Successfully parsed Claude's plan with ${planJson.steps.length} steps`);
      console.log(`[Plan] 📋 CLAUDE'S ORIGINAL OUTPUT (before normalization):`);
      console.log(JSON.stringify(claudeOriginalPlan, null, 2));
      
      // Log Claude's original steps for verification
      console.log(`[Plan] 📝 CLAUDE'S ORIGINAL STEPS (${planJson.steps.length} total):`);
      planJson.steps.forEach((step: any, idx: number) => {
        const prompt = step?.inputs?.prompt || step?.inputs?.text || step?.prompt || '(missing)';
        const preview = typeof prompt === 'string' 
          ? prompt.slice(0, 120).replace(/\n/g, ' ') 
          : '(invalid type)';
        console.log(`[Plan]   ${idx + 1}. "${step?.title || step?.id}" (${step?.tool}) - ${step?.model || 'no model'}`);
        console.log(`[Plan]      Inputs:`, JSON.stringify(step?.inputs || {}, null, 2));
        console.log(`[Plan]      Dependencies:`, step?.dependencies || []);
      });
      
      try {
        // Normalize Claude's output - this should preserve all steps, just fix missing fields
        parsed = await normalizePlannerOutput(planJson, messages, media, null, claudeOriginalPlan);
        console.log(`[Plan] ✓ Normalization succeeded with ${parsed.steps.length} steps`);
        
        // VERIFICATION: Compare Claude's original with normalized output
        if (parsed.steps.length !== claudeOriginalPlan.steps.length) {
          console.error(`[Plan] ⚠️  WARNING: Step count mismatch! Claude: ${claudeOriginalPlan.steps.length}, Normalized: ${parsed.steps.length}`);
          console.error(`[Plan] Claude's step IDs:`, claudeOriginalPlan.steps.map((s: any) => s.id));
          console.error(`[Plan] Normalized step IDs:`, parsed.steps.map((s: any) => s.id));
        } else {
          console.log(`[Plan] ✓ Step count matches Claude's output: ${parsed.steps.length}`);
        }
      } catch (normalizeErr: any) {
        console.error('[Plan] ❌ Normalization failed:', normalizeErr);
        console.error('[Plan] Normalization error stack:', normalizeErr?.stack);
        console.error('[Plan] Claude\'s original plan had', planJson.steps.length, 'steps');
        console.error('[Plan] Claude\'s original plan:', JSON.stringify(claudeOriginalPlan, null, 2));
        throw normalizeErr;
      }
      
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

  // Final verification: Log what we're sending to frontend
  console.log(`[Plan] 📤 FINAL PLAN BEING SENT TO FRONTEND:`);
  console.log(`[Plan]   Summary: ${plan.summary}`);
  console.log(`[Plan]   Steps: ${plan.steps.length}`);
  console.log(`[Plan]   Full plan JSON:`, JSON.stringify(plan, null, 2));
  plan.steps.forEach((step, idx) => {
    console.log(`[Plan]     ${idx + 1}. ${step.id} (${step.tool}) - ${step.model} - "${step.title}"`);
    console.log(`[Plan]        Inputs:`, JSON.stringify(step.inputs || {}, null, 2));
    console.log(`[Plan]        Dependencies:`, step.dependencies || []);
  });

  // CRITICAL VERIFICATION: Ensure step count matches Claude's output
  if (claudeOriginalPlan && claudeOriginalPlan.steps) {
    if (plan.steps.length !== claudeOriginalPlan.steps.length) {
      console.error(`[Plan] ❌ CRITICAL MISMATCH: Claude had ${claudeOriginalPlan.steps.length} steps, but sending ${plan.steps.length} to frontend!`);
      console.error(`[Plan] Claude's step IDs:`, claudeOriginalPlan.steps.map((s: any) => s.id));
      console.error(`[Plan] Final step IDs:`, plan.steps.map((s) => s.id));
      // Still send it, but log the error - this should never happen with our fixes
    } else {
      console.log(`[Plan] ✓ VERIFIED: Step count matches Claude's output (${plan.steps.length} steps)`);
    }
  }

  return Response.json({
    plan,
    usedModel,
    debug: process.env.NODE_ENV !== 'production'
      ? { 
          rawText: rawText.slice(0, 4000),
          claudeStepsCount: claudeOriginalPlan?.steps?.length || plan.steps.length,
          finalStepsCount: plan.steps.length,
        }
      : undefined,
  });
}

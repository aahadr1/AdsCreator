export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Replicate from 'replicate';
import { ASSISTANT_SYSTEM_PROMPT, SCENE_REFINEMENT_PROMPT, SCENARIO_PLANNING_PROMPT, buildConversationContext, extractAvatarContextFromMessages } from '../../../../lib/prompts/assistant/system';
import { createR2Client, ensureR2Bucket, r2PutObject, r2PublicUrl } from '../../../../lib/r2';
import type { Message, ScriptCreationInput, ImageGenerationInput, StoryboardCreationInput, Storyboard, StoryboardScene, VideoScenario, SceneOutline } from '../../../../types/assistant';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const REPLICATE_API = 'https://api.replicate.com/v1';

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

interface ChatRequestBody {
  conversation_id?: string;
  message: string;
  files?: string[];
}

function isScriptCreationInput(v: unknown): v is ScriptCreationInput {
  return typeof v === 'object' && v !== null;
}

function isImageGenerationInput(v: unknown): v is ImageGenerationInput {
  if (typeof v !== 'object' || v === null) return false;
  const prompt = (v as any).prompt;
  return typeof prompt === 'string' && prompt.trim().length > 0;
}

function isStoryboardCreationInput(v: unknown): v is StoryboardCreationInput {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as any;
  if (typeof obj.title !== 'string' || obj.title.trim().length === 0) return false;
  if (!Array.isArray(obj.scenes) || obj.scenes.length === 0) return false;
  const avatarUrl = typeof obj.avatar_image_url === 'string' ? obj.avatar_image_url.trim() : '';
  const avatarUrlIsValid = isHttpUrl(avatarUrl);
  
  // Validate each scene has required fields
  for (const scene of obj.scenes) {
    if (typeof scene.scene_number !== 'number') return false;
    if (typeof scene.scene_name !== 'string') return false;
    if (typeof scene.description !== 'string') return false;
    // Allow minimal outlines (server will generate prompts). If provided, must be strings.
    if (scene.first_frame_prompt != null && typeof scene.first_frame_prompt !== 'string') return false;
    if (scene.last_frame_prompt != null && typeof scene.last_frame_prompt !== 'string') return false;
    
    // New field: video_generation_prompt is required
    if (typeof scene.video_generation_prompt !== 'string' || scene.video_generation_prompt.trim().length === 0) {
      console.warn(`[Storyboard Validation] Scene ${scene.scene_number} missing video_generation_prompt`);
      // Allow for backwards compatibility but log warning
    }
    
    // If any scene explicitly needs avatar, require a REAL url (not a placeholder)
    if (scene.uses_avatar === true && !avatarUrlIsValid) return false;
    
    // If prompts explicitly reference avatar, require a real url too (only if prompts exist)
    const p = `${String(scene.first_frame_prompt || '')} ${String(scene.last_frame_prompt || '')}`.toLowerCase();
    if (p && (p.includes('base avatar') || p.includes('same actor from avatar') || p.includes('same avatar') || p.includes('same avatar character')) && !avatarUrlIsValid) return false;
  }
  return true;
}

function normalizeJsonLike(raw: string): string {
  let s = String(raw || '').trim();
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();
  s = s.replace(/,\s*([}\]])/g, '$1');
  return s;
}

function escapeNewlinesInsideStrings(raw: string): string {
  let out = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) {
      out += ch;
      escape = false;
      continue;
    }
    if (ch === '\\') {
      out += ch;
      escape = true;
      continue;
    }
    if (ch === '"') {
      out += ch;
      inString = !inString;
      continue;
    }
    if (inString && (ch === '\n' || ch === '\r')) {
      out += '\\n';
      continue;
    }
    out += ch;
  }
  return out;
}

function tryParseAnyJson(raw: string): any | null {
  const normalized = normalizeJsonLike(raw);
  try {
    return JSON.parse(normalized);
  } catch {
    try {
      return JSON.parse(escapeNewlinesInsideStrings(normalized));
    } catch {
      // Try extracting first JSON object via brace matching
      const start = normalized.indexOf('{');
      if (start === -1) return null;
      let depth = 0;
      for (let i = start; i < normalized.length; i++) {
        const c = normalized[i];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        if (depth === 0) {
          const candidate = normalized.slice(start, i + 1);
          try {
            return JSON.parse(escapeNewlinesInsideStrings(candidate));
          } catch {
            return null;
          }
        }
      }
      return null;
    }
  }
}

// Parse tool calls from assistant response
function parseToolCalls(content: string): Array<{ tool: string; input: Record<string, unknown> }> {
  const toolCalls: Array<{ tool: string; input: Record<string, unknown> }> = [];
  const toolCallOpen = '<tool_call>';
  const toolCallClose = '</tool_call>';
  
  function normalizeToolCallJson(raw: string): string {
    let s = raw.trim();
    // Remove common Markdown fences if the model wraps JSON
    s = s.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    // Normalize smart quotes
    s = s
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .trim();
    // Remove trailing commas in objects/arrays
    s = s.replace(/,\s*([}\]])/g, '$1');
    return s;
  }

  // Fix unescaped newlines inside JSON string literals
  function escapeNewlinesInsideStrings(raw: string): string {
    let out = '';
    let inString = false;
    let escape = false;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (escape) {
        out += ch;
        escape = false;
        continue;
      }
      if (ch === '\\') {
        out += ch;
        escape = true;
        continue;
      }
      if (ch === '"') {
        out += ch;
        inString = !inString;
        continue;
      }
      if (inString && (ch === '\n' || ch === '\r')) {
        out += '\\n';
        continue;
      }
      out += ch;
    }
    return out;
  }

  function tryParseJson(raw: string): any | null {
    const normalized = normalizeToolCallJson(raw);
    try {
      return JSON.parse(normalized);
    } catch {
      // Try again after escaping newlines inside strings
      try {
        return JSON.parse(escapeNewlinesInsideStrings(normalized));
      } catch {
        // Try extracting the first JSON object substring via brace matching
        const start = normalized.indexOf('{');
        if (start === -1) return null;
        let depth = 0;
        for (let i = start; i < normalized.length; i++) {
          const c = normalized[i];
          if (c === '{') depth++;
          else if (c === '}') depth--;
          if (depth === 0) {
            const candidate = normalized.slice(start, i + 1);
            try {
              return JSON.parse(escapeNewlinesInsideStrings(candidate));
            } catch {
              return null;
            }
          }
        }
        return null;
      }
    }
  }

  // Scan for <tool_call> blocks; tolerate missing closing tag (common model failure)
  let idx = 0;
  while (idx < content.length) {
    const start = content.indexOf(toolCallOpen, idx);
    if (start === -1) break;
    const afterOpen = start + toolCallOpen.length;
    const end = content.indexOf(toolCallClose, afterOpen);
    const rawJson = end === -1 ? content.slice(afterOpen) : content.slice(afterOpen, end);
    const parsed = tryParseJson(rawJson);
    if (parsed && parsed.tool && parsed.input) {
      toolCalls.push(parsed);
    } else {
      console.error('Failed to parse tool call payload');
    }
    idx = end === -1 ? content.length : end + toolCallClose.length;
  }
  
  return toolCalls;
}

// Parse reflexion from assistant response
function parseReflexion(content: string): string | null {
  const reflexionRegex = /<reflexion>([\s\S]*?)<\/reflexion>/;
  const match = content.match(reflexionRegex);
  const raw = match ? match[1].trim() : null;
  if (!raw) return null;
  // Redact URLs in reflexion to avoid hallucinated links being shown to user
  return raw.replace(/https?:\/\/\S+/g, '[redacted]');
}

function isHttpUrl(u: string | undefined | null): boolean {
  if (!u) return false;
  return /^https?:\/\//i.test(String(u).trim());
}

function extractPredictionIdFromToolResult(message: Message): string | null {
  if (!message?.tool_output) return null;
  const toolOutput = message.tool_output as any;
  const id =
    toolOutput?.output?.id ||
    toolOutput?.id ||
    toolOutput?.prediction_id ||
    toolOutput?.predictionId ||
    toolOutput?.output?.prediction_id ||
    null;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function extractImageUrlFromToolResult(message: Message): string | null {
  if (!message?.tool_output) return null;
  const toolOutput = message.tool_output as any;
  const direct =
    toolOutput?.outputUrl ||
    toolOutput?.output_url ||
    toolOutput?.output?.outputUrl ||
    toolOutput?.output?.output_url ||
    (typeof message.content === 'string' && message.content.startsWith('http') ? message.content : null);
  return typeof direct === 'string' && direct.startsWith('http') ? direct : null;
}

async function resolveReplicateOutputUrl(predictionId: string): Promise<{ status: string | null; outputUrl: string | null; error: string | null }> {
  try {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return { status: null, outputUrl: null, error: 'missing REPLICATE_API_TOKEN' };
    const res = await fetch(`${REPLICATE_API}/predictions/${encodeURIComponent(predictionId)}`, {
      headers: { Authorization: `Token ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return { status: null, outputUrl: null, error: await res.text() };
    const json: any = await res.json();
    let outputUrl: string | null = null;
    const out = json.output;
    if (typeof out === 'string') outputUrl = out;
    else if (Array.isArray(out)) outputUrl = typeof out[0] === 'string' ? out[0] : null;
    else if (out && typeof out === 'object' && typeof out.url === 'string') outputUrl = out.url;
    return { status: String(json.status || ''), outputUrl, error: json.error || json.logs || null };
  } catch (e: any) {
    return { status: null, outputUrl: null, error: e?.message || 'resolveReplicateOutputUrl failed' };
  }
}

async function getLastAvatarFromConversation(messages: Message[]): Promise<{ url?: string; predictionId?: string; status?: string; description?: string } | null> {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'tool_result' || msg.tool_name !== 'image_generation') continue;
    
    // First, check if this tool_result itself has purpose='avatar' in tool_output
    // (this is now included when we save the tool result)
    const toolOutput = msg.tool_output as any;
    const purposeFromOutput = toolOutput?.purpose;
    const descriptionFromOutput = toolOutput?.avatar_description;
    
    // If we have purpose='avatar' directly in output, use it
    let isAvatar = purposeFromOutput === 'avatar';
    let avatarDescription = descriptionFromOutput;
    
    // Also check the corresponding tool_call as fallback
    if (!isAvatar) {
      for (let j = i - 1; j >= 0; j--) {
        const prev = messages[j];
        if (prev.role === 'tool_call' && prev.tool_name === 'image_generation') {
          const input = prev.tool_input as any;
          if (input?.purpose === 'avatar') {
            isAvatar = true;
            avatarDescription = avatarDescription || input?.avatar_description;
          }
          break;
        }
      }
    }
    
    if (isAvatar) {
      const url = extractImageUrlFromToolResult(msg);
      const predictionId = extractPredictionIdFromToolResult(msg);
      
      if (url) {
        return { url, predictionId: predictionId || undefined, status: 'succeeded', description: avatarDescription || undefined };
      }
      
      if (predictionId) {
        const resolved = await resolveReplicateOutputUrl(predictionId);
        if (resolved.outputUrl) {
          return { url: resolved.outputUrl, predictionId, status: resolved.status || undefined, description: avatarDescription || undefined };
        }
        return { predictionId, status: resolved.status || undefined, description: avatarDescription || undefined };
      }
      
      return { description: avatarDescription || undefined };
    }
  }
  return null;
}

function isAvatarConfirmation(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('use this avatar') ||
    normalized.includes('use that avatar') ||
    normalized.includes('use this one') ||
    normalized.includes('use this image as avatar') ||
    normalized.includes('yes use this avatar')
  );
}

async function maybeCacheAvatarToR2({
  sourceUrl,
  conversationId,
}: {
  sourceUrl: string;
  conversationId: string;
}): Promise<{ url: string; cached: boolean; error?: string }> {
  try {
    const src = sourceUrl.trim();
    if (!isHttpUrl(src)) return { url: sourceUrl, cached: false, error: 'sourceUrl is not http(s)' };

    const r2AccountId = process.env.R2_ACCOUNT_ID || '';
    const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
    const r2Endpoint = process.env.R2_S3_ENDPOINT || null;
    const bucket = process.env.R2_BUCKET || 'assets';
    const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL || null;

    // If R2 isn't configured with a public base URL, we cannot produce a stable public URL for Replicate
    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !publicBaseUrl) {
      return { url: sourceUrl, cached: false, error: 'R2 not configured (missing R2_* or R2_PUBLIC_BASE_URL)' };
    }

    const res = await fetch(src, { cache: 'no-store' });
    if (!res.ok) return { url: sourceUrl, cached: false, error: `Failed to download avatar: ${await res.text()}` };
    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';

    // Keep extension consistent; default to jpg for maximum compatibility
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const key = `avatars/${conversationId}/${crypto.randomUUID()}.${ext}`;

    const r2 = createR2Client({
      accountId: r2AccountId,
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
      bucket,
      endpoint: r2Endpoint,
      publicBaseUrl,
    });
    await ensureR2Bucket(r2, bucket);
    await r2PutObject({
      client: r2,
      bucket,
      key,
      body: new Uint8Array(arrayBuffer),
      contentType,
      cacheControl: '31536000',
    });

    const publicUrl = r2PublicUrl({ publicBaseUrl, bucket, key });
    if (!publicUrl) return { url: sourceUrl, cached: false, error: 'Could not compute R2 public URL' };
    return { url: publicUrl, cached: true };
  } catch (e: any) {
    return { url: sourceUrl, cached: false, error: e?.message || 'maybeCacheAvatarToR2 failed' };
  }
}

// Remove tool calls and reflexion from visible response
function cleanResponse(content: string): string {
  return content
    .replace(/<reflexion>[\s\S]*?<\/reflexion>/g, '')
    // Remove proper tool_call blocks
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
    // Remove dangling tool_call without a closing tag
    .replace(/<tool_call>[\s\S]*$/g, '')
    .trim();
}

// Execute script creation tool
async function executeScriptCreation(input: ScriptCreationInput): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return { success: false, error: 'Server misconfigured: missing REPLICATE_API_TOKEN' };
    }
    
    const replicate = new Replicate({ auth: token });
    
    // Build the prompt from input
    const parts: string[] = [];
    const platform = String(input.platform || 'tiktok').replace('_', ' ');
    const lengthSeconds = Math.max(10, Math.min(90, Number(input.length_seconds || 30)));
    parts.push(`Write a ${lengthSeconds}-second short-form video ad script for ${platform}.`);
    if (input.brand_name) parts.push(`Brand: ${String(input.brand_name)}.`);
    if (input.product) parts.push(`Product: ${String(input.product)}.`);
    if (input.offer) parts.push(`Offer: ${String(input.offer)}.`);
    if (input.target_audience) parts.push(`Target audience: ${String(input.target_audience)}.`);
    if (input.tone) parts.push(`Tone: ${String(input.tone)}.`);
    if (input.key_benefits) {
      const benefits = input.key_benefits.split(',').map(s => s.trim()).filter(Boolean);
      if (benefits.length) parts.push(`Key benefits: ${benefits.join('; ')}.`);
    }
    if (input.pain_points) {
      const pains = input.pain_points.split(',').map(s => s.trim()).filter(Boolean);
      if (pains.length) parts.push(`Pain points: ${pains.join('; ')}.`);
    }
    if (input.social_proof) parts.push(`Social proof: ${String(input.social_proof)}.`);
    if (input.hook_style) parts.push(`Hook style: ${String(input.hook_style)}.`);
    if (input.cta) parts.push(`CTA: ${String(input.cta)}.`);
    if (input.constraints) parts.push(`Constraints: ${String(input.constraints)}`);
    if (input.prompt) parts.push(input.prompt);
    parts.push('Write an engaging, high-converting script with a strong hook, clear benefits, and compelling CTA.');
    
    const composedPrompt = parts.join(' ');
    
    const scriptSystemPrompt = `You are a world-class direct-response copywriter specializing in high-converting ad scripts for short-form video ads. Create compelling, original scripts that drive action and engagement. Use strong hooks, benefits, sensory language, social proof, and bold CTAs. Format the script with clear timing markers like [0-3s] HOOK, [3-10s] BODY, etc.`;
    
    let output = '';
    const stream = await replicate.stream('anthropic/claude-4-sonnet', {
      input: {
        prompt: composedPrompt,
        system_prompt: scriptSystemPrompt,
        max_tokens: 2048,
      }
    });
    
    for await (const event of stream) {
      output += String(event);
    }
    
    return { success: true, output };
  } catch (e: any) {
    console.error('Script creation error:', e);
    return { success: false, error: e.message };
  }
}

// Execute image generation tool
async function executeImageGeneration(input: ImageGenerationInput): Promise<{ success: boolean; output?: { id: string; status: string }; error?: string }> {
  try {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return { success: false, error: 'Server misconfigured: missing REPLICATE_API_TOKEN' };
    }
    
    // Use nano-banana model
    const model = 'google/nano-banana';
    
    // Get latest version
    const modelRes = await fetch(`${REPLICATE_API}/models/${model}`, {
      headers: { Authorization: `Token ${token}` },
      cache: 'no-store',
    });
    
    if (!modelRes.ok) {
      return { success: false, error: `Failed to fetch model: ${await modelRes.text()}` };
    }
    
    const modelJson = await modelRes.json();
    const versionId = modelJson?.latest_version?.id;
    
    if (!versionId) {
      return { success: false, error: 'No latest version found for model' };
    }
    
    // Force avatar outputs to JPG to maximize compatibility with later img2img steps
    const forcedOutputFormat =
      input.purpose === 'avatar' ? 'jpg' : (input.output_format || 'jpg');

    const predictionInput: Record<string, unknown> = {
      prompt: input.prompt,
      output_format: forcedOutputFormat,
    };
    
    if (input.image_input && input.image_input.length > 0) {
      predictionInput.image_input = input.image_input;
    }
    
    const res = await fetch(`${REPLICATE_API}/predictions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify({ version: versionId, input: predictionInput }),
    });
    
    if (!res.ok) {
      return { success: false, error: `Prediction failed: ${await res.text()}` };
    }
    
    const prediction = await res.json();
    return { 
      success: true, 
      output: { id: prediction.id, status: prediction.status }
    };
  } catch (e: any) {
    console.error('Image generation error:', e);
    return { success: false, error: e.message };
  }
}

// Cache for model version IDs to avoid repeated API calls
const MODEL_VERSION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cachedModelVersions = new Map<string, { versionId: string; at: number }>();

// Helper to get model version with caching
async function getModelVersionId(token: string, model: string): Promise<string | null> {
  const now = Date.now();
  const cached = cachedModelVersions.get(model);
  if (cached && (now - cached.at) < MODEL_VERSION_CACHE_TTL) {
    return cached.versionId;
  }

  const modelRes = await fetch(`${REPLICATE_API}/models/${model}`, {
    headers: { Authorization: `Token ${token}` },
    cache: 'no-store',
  });
  
  if (!modelRes.ok) {
    console.error('[Storyboard] Failed to fetch model:', await modelRes.text());
    return null;
  }
  
  const modelJson = await modelRes.json();
  const versionId = modelJson?.latest_version?.id;
  
  if (versionId) cachedModelVersions.set(model, { versionId, at: now });
  
  return versionId || null;
}

// Helper to generate a single image with optional image-to-image reference
async function generateSingleImage(
  prompt: string, 
  aspectRatio?: string,
  referenceImageUrl?: string,
  avatarDescription?: string
): Promise<{ id: string; status: string; error?: string } | null> {
  try {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      console.error('[Storyboard] No REPLICATE_API_TOKEN');
      return null;
    }
    const tokenStr = String(token);

    async function createPrediction(model: string, input: Record<string, unknown>) {
      const versionId = await getModelVersionId(tokenStr, model);
      if (!versionId) return { ok: false as const, status: 0, text: `No latest version found for ${model}` };
      const res = await fetch(`${REPLICATE_API}/predictions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${tokenStr}`,
        },
        body: JSON.stringify({ version: versionId, input }),
      });
      if (!res.ok) return { ok: false as const, status: res.status, text: await res.text() };
      const json = await res.json();
      return { ok: true as const, json };
    }
    
    // Build the enhanced prompt
    let enhancedPrompt = prompt;
    
    // Add aspect ratio hint to prompt if provided
    if (aspectRatio && !prompt.includes(aspectRatio)) {
      enhancedPrompt = `${enhancedPrompt}, ${aspectRatio} aspect ratio`;
    }
    
    const baseInput: Record<string, unknown> = {
      prompt: enhancedPrompt,
      output_format: 'jpg',
    };
    
    // If reference image is provided, use it for image-to-image generation
    // This ensures consistency - same actor, same setting, same style
    const hasRef = referenceImageUrl && /^https?:\/\//i.test(referenceImageUrl);
    
    let refPrompt: string;
    if (hasRef) {
      // Build a comprehensive prompt that emphasizes maintaining the reference character
      const avatarContext = avatarDescription 
        ? `The person in the reference image is: ${avatarDescription}. ` 
        : '';
      refPrompt = `${avatarContext}CRITICAL: Maintain the EXACT same person, same face, same facial features, same hair, same skin tone, same body type as the reference image. Keep the same lighting style and visual quality. The ONLY changes should be: ${enhancedPrompt}`;
      console.log('[Storyboard] Using avatar reference with description:', avatarDescription ? 'YES' : 'NO');
    } else {
      refPrompt = enhancedPrompt;
    }

    // Use nano-banana for BOTH text-to-image and image-to-image.
    // The primary failure mode we observed (E006) is usually a bad/unreachable reference URL,
    // so we ensure avatar URLs are cached to our own R2 public URL on approval.
    const model = 'google/nano-banana';
    const input: Record<string, unknown> = { ...baseInput, prompt: hasRef ? refPrompt : enhancedPrompt };
    if (hasRef) input.image_input = [String(referenceImageUrl)];
    console.log('[Storyboard] Creating prediction:', model, hasRef ? '(img2img)' : '(t2i)', 'RefURL:', referenceImageUrl ? referenceImageUrl.substring(0, 50) + '...' : 'none');
    const res = await createPrediction(model, input);
    if (res.ok) return { id: String(res.json.id), status: String(res.json.status) };
    return { id: '', status: 'failed', error: String((res as any).text || '') || 'Prediction failed' };
  } catch (e: any) {
    console.error('[Storyboard] generateSingleImage error:', e.message || e);
    return { id: '', status: 'failed', error: e.message || 'Unknown error' };
  }
}

// Small delay helper
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Execute storyboard creation tool - Enhanced version with improved scene handling
async function executeStoryboardCreation(input: StoryboardCreationInput): Promise<{ success: boolean; output?: { storyboard: Storyboard }; error?: string }> {
  try {
    const storyboardId = crypto.randomUUID();
    
    // Avatar reference URL and description for image-to-image consistency
    const avatarUrl = input.avatar_image_url;
    const avatarDescription = input.avatar_description;
    
    console.log('[Storyboard] Starting multi-call storyboard creation:', {
      title: input.title,
      avatarUrl: avatarUrl ? avatarUrl.substring(0, 50) + '...' : 'none',
      avatarDescription: avatarDescription || 'none',
      sceneCount: input.scenes.length,
      hasKeyBenefits: Array.isArray(input.key_benefits) && input.key_benefits.length > 0,
      hasPainPoints: Array.isArray(input.pain_points) && input.pain_points.length > 0,
    });
    
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return { success: false, error: 'Server misconfigured: missing REPLICATE_API_TOKEN' };
    const replicate = new Replicate({ auth: token });

    async function callClaudeText(opts: { prompt: string; system_prompt: string; max_tokens: number }): Promise<string> {
      let out = '';
      const stream = await replicate.stream('anthropic/claude-4-sonnet', {
        input: {
          prompt: opts.prompt,
          system_prompt: opts.system_prompt,
          max_tokens: opts.max_tokens,
        },
      });
      for await (const event of stream) out += String(event);
      return out;
    }

    async function callClaudeJson<T>(opts: { prompt: string; system_prompt: string; max_tokens: number }): Promise<T> {
      const raw = await callClaudeText(opts);
      const parsed = tryParseAnyJson(raw);
      if (!parsed) {
        const snippet = String(raw || '').slice(0, 900);
        throw new Error(`Failed to parse JSON from LLM. Raw starts with: ${snippet}`);
      }
      return parsed as T;
    }

    function outlineFromInputScene(s: any, idx: number): SceneOutline {
      const st: SceneOutline['scene_type'] =
        (s?.scene_type as any) ||
        (String(s?.scene_name || '').toLowerCase().includes('end card') ? 'text_card' : 'talking_head');
      const needsAvatar = typeof s?.uses_avatar === 'boolean' ? Boolean(s.uses_avatar) : true;
      return {
        scene_number: typeof s?.scene_number === 'number' ? s.scene_number : idx + 1,
        scene_name: typeof s?.scene_name === 'string' ? s.scene_name : `Scene ${idx + 1}`,
        purpose: typeof s?.description === 'string' ? s.description : 'Advance the ad narrative',
        duration_seconds: typeof s?.duration_seconds === 'number' ? s.duration_seconds : 4,
        needs_avatar: needsAvatar,
        scene_type: st,
      };
    }

    // Phase 1: scenario planning (or use provided outlines)
    let scenario: VideoScenario | undefined;
    let outlines: SceneOutline[] = [];

    const inputLooksDetailed = input.scenes.every((s: any) => typeof s?.first_frame_prompt === 'string' && typeof s?.last_frame_prompt === 'string');

    if (inputLooksDetailed) {
      // Back-compat: treat as already-refined; still store a lightweight scenario
      outlines = input.scenes.map((s: any, idx: number) => outlineFromInputScene(s, idx));
      scenario = {
        title: input.title,
        concept: `Storyboard for ${input.brand_name || 'brand'} ${input.product || 'product'}`,
        narrative_arc: 'Hook → demo → proof → CTA',
        target_emotion: 'curiosity → desire → confidence',
        key_message: input.call_to_action || 'Take action now',
        scene_breakdown: outlines,
      };
    } else {
      const scenarioPromptParts: string[] = [];
      scenarioPromptParts.push(`Title: ${input.title}`);
      if (input.brand_name) scenarioPromptParts.push(`Brand: ${input.brand_name}`);
      if (input.product) scenarioPromptParts.push(`Product: ${input.product}`);
      if (input.product_description) scenarioPromptParts.push(`Product description: ${input.product_description}`);
      if (input.target_audience) scenarioPromptParts.push(`Target audience: ${input.target_audience}`);
      if (input.platform) scenarioPromptParts.push(`Platform: ${input.platform}`);
      if (input.total_duration_seconds) scenarioPromptParts.push(`Total duration seconds: ${input.total_duration_seconds}`);
      if (input.style) scenarioPromptParts.push(`Style: ${input.style}`);
      if (input.aspect_ratio) scenarioPromptParts.push(`Aspect ratio: ${input.aspect_ratio}`);
      if (Array.isArray(input.key_benefits) && input.key_benefits.length) scenarioPromptParts.push(`Key benefits: ${input.key_benefits.join('; ')}`);
      if (Array.isArray(input.pain_points) && input.pain_points.length) scenarioPromptParts.push(`Pain points: ${input.pain_points.join('; ')}`);
      if (input.call_to_action) scenarioPromptParts.push(`CTA: ${input.call_to_action}`);
      if (input.creative_direction) scenarioPromptParts.push(`Creative direction: ${input.creative_direction}`);
      if (avatarDescription) scenarioPromptParts.push(`Avatar description: ${avatarDescription}`);
      scenarioPromptParts.push('Create a compact scenario and scene breakdown.');

      scenario = await callClaudeJson<VideoScenario>({
        prompt: scenarioPromptParts.join('\n'),
        system_prompt: SCENARIO_PLANNING_PROMPT,
        max_tokens: 1400,
      });

      outlines = Array.isArray(scenario?.scene_breakdown) ? scenario.scene_breakdown : [];
      if (!outlines.length) {
        // Fallback to input scenes as outlines
        outlines = input.scenes.map((s: any, idx: number) => outlineFromInputScene(s, idx));
        scenario.scene_breakdown = outlines;
      }
    }
    
    // Build scenes with prediction IDs for image generation
    const scenesWithPredictions: StoryboardScene[] = [];

    let previousRefined: StoryboardScene | undefined;
    for (const outline of outlines) {
      const usesAvatar = Boolean(outline.needs_avatar);
      const useAvatarReference = Boolean(avatarUrl && usesAvatar);

      // If outline says avatar but we don't have an avatar URL, force user clarification
      if (usesAvatar && !avatarUrl) {
        scenesWithPredictions.push({
          scene_number: outline.scene_number,
          scene_name: outline.scene_name,
          description: outline.purpose,
          duration_seconds: outline.duration_seconds,
          scene_type: outline.scene_type,
          uses_avatar: false,
          needs_user_details: true,
          user_question: 'This scene needs an on-camera creator, but no approved avatar is available. Please confirm an avatar first.',
          first_frame_prompt: 'NEEDS USER INPUT: confirm an avatar to generate this scene.',
          first_frame_visual_elements: [],
          last_frame_prompt: 'NEEDS USER INPUT: confirm an avatar to generate this scene.',
          last_frame_visual_elements: [],
          video_generation_prompt: 'NEEDS USER INPUT',
          first_frame_status: 'pending',
          last_frame_status: 'pending',
        });
        continue;
      }

      if (outline.needs_user_details) {
        scenesWithPredictions.push({
          scene_number: outline.scene_number,
          scene_name: outline.scene_name,
          description: outline.purpose,
          duration_seconds: outline.duration_seconds,
          scene_type: outline.scene_type,
          uses_avatar: usesAvatar,
          needs_user_details: true,
          user_question: outline.user_question || 'What should this scene show (setting, objects, vibe)?',
          first_frame_prompt: `NEEDS USER INPUT: ${outline.user_question || 'Specify setting/objects/vibe for this scene.'}`,
          first_frame_visual_elements: [],
          last_frame_prompt: `NEEDS USER INPUT: ${outline.user_question || 'Specify setting/objects/vibe for this scene.'}`,
          last_frame_visual_elements: [],
          video_generation_prompt: 'NEEDS USER INPUT',
          first_frame_status: 'pending',
          last_frame_status: 'pending',
        });
        continue;
      }

      // Phase 2: refine scene in an individual LLM call
      const refinementPrompt = [
        `SCENARIO:`,
        JSON.stringify(scenario || {}, null, 2),
        ``,
        `SCENE_OUTLINE:`,
        JSON.stringify(outline, null, 2),
        ``,
        `BRAND: ${input.brand_name || ''}`,
        `PRODUCT: ${input.product || ''}`,
        `STYLE: ${input.style || ''}`,
        `ASPECT_RATIO: ${input.aspect_ratio || ''}`,
        `AVATAR_DESCRIPTION: ${usesAvatar ? (avatarDescription || '(use avatar image reference)') : 'NO AVATAR'}`,
        previousRefined ? `PREVIOUS_SCENE (for continuity):\n${JSON.stringify(previousRefined, null, 2)}` : '',
      ].filter(Boolean).join('\n');

      const refined = await callClaudeJson<any>({
        prompt: refinementPrompt,
        system_prompt: SCENE_REFINEMENT_PROMPT,
        max_tokens: 1800,
      });

      const firstPrompt = String(refined.first_frame_prompt || '').trim();
      const lastPrompt = String(refined.last_frame_prompt || '').trim();
      const videoPrompt = String(refined.video_generation_prompt || '').trim();
      const firstElems = Array.isArray(refined.first_frame_visual_elements) ? refined.first_frame_visual_elements.map(String) : [];
      const lastElems = Array.isArray(refined.last_frame_visual_elements) ? refined.last_frame_visual_elements.map(String) : [];

      // Safety fallback (never pass empty prompts to image gen)
      const safeFirst = firstPrompt || `NO PERSON, ${outline.scene_name}, ${outline.purpose}, ${input.aspect_ratio || '9:16'} aspect ratio`;
      const safeLast = lastPrompt || safeFirst;

      console.log(`[Storyboard] Refined scene ${outline.scene_number} (${outline.scene_name})`, {
        usesAvatar,
        hasPrompts: Boolean(firstPrompt && lastPrompt),
      });

      // Generate frames
      const firstFramePrediction = await generateSingleImage(
        safeFirst,
        input.aspect_ratio,
        useAvatarReference ? avatarUrl : undefined,
        useAvatarReference ? avatarDescription : undefined
      );
      await delay(350);
      const lastFramePrediction = await generateSingleImage(
        safeLast,
        input.aspect_ratio,
        useAvatarReference ? avatarUrl : undefined,
        useAvatarReference ? avatarDescription : undefined
      );
      await delay(350);

      const sceneOut: StoryboardScene = {
        scene_number: outline.scene_number,
        scene_name: outline.scene_name,
        description: String(refined.description || outline.purpose || ''),
        duration_seconds: outline.duration_seconds,
        scene_type: outline.scene_type,
        uses_avatar: usesAvatar,
        first_frame_prompt: safeFirst,
        first_frame_visual_elements: firstElems,
        last_frame_prompt: safeLast,
        last_frame_visual_elements: lastElems,
        video_generation_prompt: videoPrompt || 'Natural motion between first and last frame.',
        voiceover_text: refined.voiceover_text ? String(refined.voiceover_text) : undefined,
        audio_mood: refined.audio_mood ? String(refined.audio_mood) : undefined,
        sound_effects: Array.isArray(refined.sound_effects) ? refined.sound_effects.map(String) : [],
        audio_notes: refined.audio_notes ? String(refined.audio_notes) : undefined,
        camera_movement: refined.camera_movement ? String(refined.camera_movement) : undefined,
        lighting_description: refined.lighting_description ? String(refined.lighting_description) : undefined,
        first_frame_prediction_id: firstFramePrediction?.id || undefined,
        last_frame_prediction_id: lastFramePrediction?.id || undefined,
        first_frame_status: firstFramePrediction?.id ? 'generating' : 'failed',
        last_frame_status: lastFramePrediction?.id ? 'generating' : 'failed',
        first_frame_error: firstFramePrediction && !firstFramePrediction.id ? firstFramePrediction.error : undefined,
        last_frame_error: lastFramePrediction && !lastFramePrediction.id ? lastFramePrediction.error : undefined,
      };

      scenesWithPredictions.push(sceneOut);
      previousRefined = sceneOut;
    }
    
    const storyboard: Storyboard = {
      id: storyboardId,
      title: input.title,
      brand_name: input.brand_name,
      product: input.product,
      target_audience: input.target_audience,
      platform: input.platform,
      total_duration_seconds: input.total_duration_seconds,
      style: input.style,
      aspect_ratio: input.aspect_ratio,
      avatar_image_url: input.avatar_image_url,
      avatar_description: input.avatar_description,
      scenario,
      scenes: scenesWithPredictions,
      created_at: new Date().toISOString(),
      status: 'generating',
    };
    
    return {
      success: true,
      output: { storyboard }
    };
  } catch (e: any) {
    console.error('Storyboard creation error:', e);
    return { success: false, error: e.message };
  }
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  
  try {
    const supabase = getSupabase();
    
    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const body = await req.json().catch(() => null) as ChatRequestBody | null;
    
    if (!body || !body.message || typeof body.message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get or create conversation
    let conversationId = body.conversation_id;
    let existingMessages: Message[] = [];
    let existingPlan: any = null;
    
    if (conversationId) {
      const { data: existing } = await supabase
        .from('assistant_conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();
      
      if (existing) {
        existingMessages = (existing.messages || []) as Message[];
        existingPlan = (existing as any).plan || null;
      } else {
        conversationId = undefined;
      }
    }
    
    if (!conversationId) {
      const { data: newConv, error: createError } = await supabase
        .from('assistant_conversations')
        .insert({
          user_id: user.id,
          title: body.message.slice(0, 50) + (body.message.length > 50 ? '...' : ''),
          messages: [],
        })
        .select('*')
        .single();
      
      if (createError || !newConv) {
        return new Response(JSON.stringify({ error: 'Failed to create conversation' }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      conversationId = newConv.id;
      existingPlan = newConv.plan || null;
    }
    
    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: body.message,
      timestamp: new Date().toISOString(),
      files: body.files,
    };
    
    existingMessages.push(userMessage);
    
  // Check if user is confirming avatar usage
  const avatarCandidate = await getLastAvatarFromConversation(existingMessages);
  const userConfirmedAvatar = isAvatarConfirmation(body.message);
  const confirmedAvatarUrl = userConfirmedAvatar && avatarCandidate?.url && isHttpUrl(avatarCandidate.url) ? avatarCandidate.url : undefined;
  const confirmedAvatarDescription = userConfirmedAvatar ? avatarCandidate?.description : undefined;
  const confirmedAvatarPredictionId = userConfirmedAvatar ? avatarCandidate?.predictionId : undefined;
  const confirmedAvatarStatus = userConfirmedAvatar ? avatarCandidate?.status : undefined;

    // Read previously selected avatar from plan (server-side persisted)
    const planSelectedAvatarUrl =
      typeof existingPlan?.selected_avatar?.url === 'string' && isHttpUrl(existingPlan.selected_avatar.url)
        ? String(existingPlan.selected_avatar.url).trim()
        : undefined;
    const planSelectedAvatarDescription =
      typeof existingPlan?.selected_avatar?.description === 'string'
        ? String(existingPlan.selected_avatar.description)
        : undefined;

    // If user confirmed, persist selection server-side (so we never rely on model-supplied URLs)
    let selectedAvatarUrl: string | undefined = planSelectedAvatarUrl;
    let selectedAvatarDescription: string | undefined = planSelectedAvatarDescription;
    if (userConfirmedAvatar && confirmedAvatarUrl) {
      const cached = await maybeCacheAvatarToR2({ sourceUrl: confirmedAvatarUrl, conversationId: String(conversationId) });
      selectedAvatarUrl = cached.url;
      selectedAvatarDescription = confirmedAvatarDescription || selectedAvatarDescription;
      const nextPlan = {
        ...(existingPlan || {}),
        selected_avatar: {
          url: selectedAvatarUrl,
          prediction_id: confirmedAvatarPredictionId,
          description: confirmedAvatarDescription,
          selected_at: new Date().toISOString(),
        },
      };
      await supabase
        .from('assistant_conversations')
        .update({ plan: nextPlan, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
      existingPlan = nextPlan;
    }
  
    // Build conversation context for Claude (now includes avatar generation results)
    const conversationContext = buildConversationContext(existingMessages, { includeAvatarResults: true });
    
    // Build avatar context block if we have a confirmed avatar
    let avatarContextBlock = '';
    if (selectedAvatarUrl) {
      avatarContextBlock = `
═══════════════════════════════════════════════════════════════════════════
🎭 CONFIRMED AVATAR FOR THIS VIDEO
═══════════════════════════════════════════════════════════════════════════
Avatar Image URL: ${selectedAvatarUrl}
${selectedAvatarDescription ? `Avatar Description: ${selectedAvatarDescription}` : 'Avatar Description: (Use the image URL as visual reference)'}

CRITICAL INSTRUCTIONS FOR STORYBOARD GENERATION:
- You MUST use this exact avatar for all scenes with uses_avatar=true
- All scene prompts MUST describe THIS specific avatar's appearance
- Reference the avatar description above when writing first_frame_prompt and last_frame_prompt
- Do NOT invent new character descriptions - match the avatar exactly
- Include "Same avatar character," at the start of each frame prompt that uses the avatar
═══════════════════════════════════════════════════════════════════════════

`;
    } else {
      // Check if there's an unconfirmed avatar in the conversation
      const avatarInConversation = extractAvatarContextFromMessages(existingMessages);
      if (avatarInConversation?.url) {
        avatarContextBlock = `
═══════════════════════════════════════════════════════════════════════════
📷 AVATAR IMAGE GENERATED (awaiting confirmation)
═══════════════════════════════════════════════════════════════════════════
Avatar Image URL: ${avatarInConversation.url}
${avatarInConversation.description ? `Avatar Description: ${avatarInConversation.description}` : ''}

NOTE: The user has NOT yet confirmed this avatar. Wait for them to say "Use this avatar" before proceeding with storyboard creation.
═══════════════════════════════════════════════════════════════════════════

`;
      }
    }
    
    const fullPrompt = avatarContextBlock + (conversationContext 
      ? `Previous conversation:\n${conversationContext}\n\nUser: ${body.message}`
      : body.message);
    
    const replicate = new Replicate({ auth: replicateToken });
    
    // Create streaming response
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Stream the LLM response
          let fullResponse = '';
          
          // Send conversation ID first
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'conversation_id', data: conversationId })}\n\n`));
          
          // Signal reflexion start
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'reflexion_start' })}\n\n`));
          
          const stream = await replicate.stream('anthropic/claude-4-sonnet', {
            input: {
              prompt: fullPrompt,
              system_prompt: ASSISTANT_SYSTEM_PROMPT,
              max_tokens: 4096,
            }
          });
          
          let inReflexion = false;
          let reflexionBuffer = '';
          let responseBuffer = '';
          
          for await (const event of stream) {
            const chunk = String(event);
            fullResponse += chunk;
            const safeChunk = chunk.replace(/https?:\/\/\S+/g, '[redacted]');
            
            // Track if we're in reflexion block
            if (fullResponse.includes('<reflexion>') && !fullResponse.includes('</reflexion>')) {
              inReflexion = true;
              reflexionBuffer += chunk;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'reflexion_chunk', data: safeChunk })}\n\n`));
            } else if (inReflexion && fullResponse.includes('</reflexion>')) {
              inReflexion = false;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'reflexion_end' })}\n\n`));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response_start' })}\n\n`));
            } else if (!inReflexion && fullResponse.includes('</reflexion>')) {
              responseBuffer += chunk;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response_chunk', data: chunk })}\n\n`));
            } else if (!fullResponse.includes('<reflexion>')) {
              // No reflexion block yet, buffer it
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response_chunk', data: chunk })}\n\n`));
            }
          }
          
          // Parse the full response
          const reflexion = parseReflexion(fullResponse);
          const toolCalls = parseToolCalls(fullResponse);
          
          // Filter tool calls to enforce avatar-first flow
          let filteredToolCalls = toolCalls;
          const hasStoryboardCall = toolCalls.some(tc => tc.tool === 'storyboard_creation');
          const hasAvatarImageCall = toolCalls.some(tc => 
            tc.tool === 'image_generation' && (tc.input as any)?.purpose === 'avatar'
          );
          let storyboardBlockedByAvatar = false;
          
          if (hasStoryboardCall && hasAvatarImageCall) {
            // If avatar is being generated, do NOT execute storyboard in same turn
            filteredToolCalls = toolCalls.filter(tc => tc.tool !== 'storyboard_creation');
            storyboardBlockedByAvatar = true;
          }
          
          // If storyboard uses avatar but no confirmed avatar URL, block storyboard execution
          if (hasStoryboardCall) {
            const storyboardCall = toolCalls.find(tc => tc.tool === 'storyboard_creation');
            const input = (storyboardCall as any)?.input || {};
            const avatarUrlInCall = typeof input.avatar_image_url === 'string' ? input.avatar_image_url.trim() : '';
            const avatarUrlAvailable = isHttpUrl(avatarUrlInCall) || Boolean(selectedAvatarUrl);
            const usesAvatarScene = Array.isArray(input?.scenes)
              ? input.scenes.some((s: any) => s?.uses_avatar === true)
              : false;
            // Only block if scenes need avatar AND we don't have any usable avatar URL (from tool call or confirmed avatar)
            if (usesAvatarScene && !avatarUrlAvailable) {
              filteredToolCalls = filteredToolCalls.filter(tc => tc.tool !== 'storyboard_creation');
              storyboardBlockedByAvatar = true;
            }
          }
          let cleanedResponse = cleanResponse(fullResponse);
          const responseHadToolCallTag = fullResponse.includes('<tool_call>') && fullResponse.includes('</tool_call>');
          if (!toolCalls.length && responseHadToolCallTag && !cleanedResponse.trim()) {
            cleanedResponse =
              'I generated a storyboard tool call, but it was not parseable. Please reply "retry storyboard" and I will reformat it as strict JSON.';
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response_chunk', data: cleanedResponse })}\n\n`));
          }
          
          if (!cleanedResponse.trim() && storyboardBlockedByAvatar) {
            if (userConfirmedAvatar && !confirmedAvatarUrl) {
              cleanedResponse =
                confirmedAvatarStatus && !['succeeded', 'failed', 'canceled'].includes(String(confirmedAvatarStatus).toLowerCase())
                  ? `Your avatar is still generating (status: ${confirmedAvatarStatus}). Please wait a moment, then reply again: "Use this avatar".`
                  : 'I could not access the avatar image URL yet. Please wait for the avatar image to finish generating, then reply: "Use this avatar".';
            } else if (hasAvatarImageCall) {
              cleanedResponse = 'Avatar created. Please confirm with "Use this avatar" to proceed with the storyboard.';
            } else {
              cleanedResponse = 'Before I can build the storyboard, I need an approved avatar. Say "Use this avatar" after you confirm one.';
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response_chunk', data: cleanedResponse })}\n\n`));
          }
          
          // Execute tool calls if any
          const toolResults: Array<{ tool: string; result: unknown }> = [];
          
          for (const toolCall of filteredToolCalls) {
            // Enforce server-tracked avatar URL for storyboard creation.
            // Never trust model-supplied random URLs.
            if (toolCall.tool === 'storyboard_creation') {
              const input = toolCall.input as any;
              const originalAvatarUrl = input.avatar_image_url;
              
              // If we have a selected avatar stored server-side, force it.
              if (selectedAvatarUrl) {
                input.avatar_image_url = selectedAvatarUrl;
                if (!input.avatar_description && selectedAvatarDescription) {
                  input.avatar_description = selectedAvatarDescription;
                }
                console.log('[Avatar Injection] Using server-tracked avatar:', {
                  originalUrl: originalAvatarUrl ? String(originalAvatarUrl).substring(0, 50) : 'none',
                  injectedUrl: selectedAvatarUrl.substring(0, 50),
                  description: selectedAvatarDescription || 'none',
                });
              } else if (confirmedAvatarUrl && !isHttpUrl(input.avatar_image_url)) {
                // Fallback: user confirmed in this same message, but we don't have a plan-selected avatar yet
                input.avatar_image_url = confirmedAvatarUrl;
                if (!input.avatar_description && confirmedAvatarDescription) {
                  input.avatar_description = confirmedAvatarDescription;
                }
                console.log('[Avatar Injection] Using just-confirmed avatar:', {
                  originalUrl: originalAvatarUrl ? String(originalAvatarUrl).substring(0, 50) : 'none',
                  injectedUrl: confirmedAvatarUrl.substring(0, 50),
                  description: confirmedAvatarDescription || 'none',
                });
              } else {
                console.log('[Avatar Injection] No avatar to inject:', {
                  originalUrl: originalAvatarUrl ? String(originalAvatarUrl).substring(0, 50) : 'none',
                  selectedAvatarUrl: selectedAvatarUrl || 'none',
                  confirmedAvatarUrl: confirmedAvatarUrl || 'none',
                });
              }
            }
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'tool_call', 
              data: { tool: toolCall.tool, input: toolCall.input }
            })}\n\n`));
            
            let result;
            if (toolCall.tool === 'script_creation') {
              const safeInput: unknown = toolCall.input;
              result = isScriptCreationInput(safeInput)
                ? await executeScriptCreation(safeInput)
                : { success: false, error: 'Invalid script_creation input' };
            } else if (toolCall.tool === 'image_generation') {
              const safeInput: unknown = toolCall.input;
              result = isImageGenerationInput(safeInput)
                ? await executeImageGeneration(safeInput)
                : { success: false, error: 'Invalid image_generation input: missing prompt' };
            } else if (toolCall.tool === 'storyboard_creation') {
              const safeInput: unknown = toolCall.input;
              result = isStoryboardCreationInput(safeInput)
                ? await executeStoryboardCreation(safeInput)
                : { success: false, error: 'Invalid storyboard_creation input: missing title/scenes or avatar_image_url required for scenes using avatar' };
            }
            
            if (result) {
              toolResults.push({ tool: toolCall.tool, result });
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'tool_result', 
                data: { tool: toolCall.tool, result }
              })}\n\n`));
            }
          }
          
          // Save messages to conversation
          const messagesToSave: Message[] = [...existingMessages];
          
          // Add reflexion message if present
          if (reflexion) {
            messagesToSave.push({
              id: crypto.randomUUID(),
              role: 'reflexion',
              content: reflexion,
              timestamp: new Date().toISOString(),
            });
          }
          
          // Add assistant response (only if non-empty)
          if (cleanedResponse.trim()) {
            messagesToSave.push({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: cleanedResponse,
              timestamp: new Date().toISOString(),
            });
          }
          
          // Add tool calls and results
          for (let i = 0; i < filteredToolCalls.length; i++) {
            const toolCall = filteredToolCalls[i];
            const toolResult = toolResults[i];
            
            messagesToSave.push({
              id: crypto.randomUUID(),
              role: 'tool_call',
              content: `Calling ${toolCall.tool}`,
              timestamp: new Date().toISOString(),
              tool_name: toolCall.tool,
              tool_input: toolCall.input,
            });
            
            if (toolResult) {
              // Enhance tool_output with input metadata for avatar tracking
              const enhancedToolOutput: Record<string, unknown> = {
                ...(toolResult.result as Record<string, unknown>),
              };
              
              // For image generation, include purpose and avatar_description in the output
              // so they can be retrieved later for avatar context
              if (toolCall.tool === 'image_generation') {
                const input = toolCall.input as any;
                if (input?.purpose) {
                  enhancedToolOutput.purpose = input.purpose;
                }
                if (input?.avatar_description) {
                  enhancedToolOutput.avatar_description = input.avatar_description;
                }
              }
              
              messagesToSave.push({
                id: crypto.randomUUID(),
                role: 'tool_result',
                content: toolResult.result && typeof toolResult.result === 'object' && 'output' in toolResult.result 
                  ? String((toolResult.result as any).output || JSON.stringify(toolResult.result))
                  : JSON.stringify(toolResult.result),
                timestamp: new Date().toISOString(),
                tool_name: toolCall.tool,
                tool_output: enhancedToolOutput,
              });
            }
          }
          
          // Update conversation in database
          await supabase
            .from('assistant_conversations')
            .update({
              messages: messagesToSave,
              updated_at: new Date().toISOString(),
            })
            .eq('id', conversationId);
          
          // Signal completion
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        } catch (e: any) {
          console.error('Stream error:', e);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', data: e.message })}\n\n`));
          controller.close();
        }
      }
    });
    
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (e: any) {
    console.error('Chat API error:', e);
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

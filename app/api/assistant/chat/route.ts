export const runtime = 'nodejs';
// Storyboard generation can be slower; allow more headroom where the platform supports it.
// Vercel Pro plan max: 800 seconds
export const maxDuration = 800;

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Replicate from 'replicate';
import { ASSISTANT_SYSTEM_PROMPT, SCENE_REFINEMENT_PROMPT, SCENARIO_PLANNING_PROMPT, CREATIVE_IDEATION_PROMPT, IMAGE_REFERENCE_SELECTION_PROMPT, buildConversationContext, extractAvatarContextFromMessages } from '../../../../lib/prompts/assistant/system';
import { createR2Client, ensureR2Bucket, r2PutObject } from '../../../../lib/r2';
import type { Message, ScriptCreationInput, ImageGenerationInput, StoryboardCreationInput, VideoGenerationInput, Storyboard, StoryboardScene, VideoScenario, SceneOutline, ImageReferenceReflexion } from '../../../../types/assistant';
import type { ImageRegistry, RegisteredImage, ReferenceImagesResult } from '../../../../types/imageRegistry';
import { createEmptyRegistry, registerImage, updateRegisteredImage, getReferenceImagesForGeneration, setActiveAvatar, setActiveProduct, queryImages } from '../../../../types/imageRegistry';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const REPLICATE_API = 'https://api.replicate.com/v1';
// Nano Banana is the ONLY assistant image model
const ASSISTANT_IMAGE_MODEL = 'google/nano-banana';
const DEFAULT_IMAGE_ASPECT_RATIO = '9:16';

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

function normalizeText(s: string): string {
  return String(s || '').trim().toLowerCase();
}

function userWantsToProceed(text: string): boolean {
  const t = normalizeText(text);
  // Accept short confirmations and explicit "proceed/generate"
  if (t === 'proceed' || t === 'generate' || t === 'yes' || t === 'ok' || t === 'go' || t === 'continue') return true;
  if (t.includes('proceed') || t.includes('generate') || t.includes('start generation') || t.includes('make the video') || t.includes('render')) return true;
  return false;
}

function extractLatestStoryboard(messages: Message[]): Storyboard | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'tool_result' || m.tool_name !== 'storyboard_creation') continue;
    const storyboard =
      (m.tool_output as any)?.output?.storyboard ||
      (m.tool_output as any)?.storyboard ||
      null;
    if (storyboard && typeof storyboard === 'object' && Array.isArray((storyboard as any).scenes)) {
      return storyboard as Storyboard;
    }
  }
  return null;
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
    if (scene.uses_avatar === true && !avatarUrlIsValid) {
      console.warn(`[Storyboard Validation] Scene ${scene.scene_number} needs avatar but no valid avatar_image_url provided`);
      return false;
    }
    
    // If prompts explicitly reference avatar, require a real url too (only if prompts exist)
    const p = `${String(scene.first_frame_prompt || '')} ${String(scene.last_frame_prompt || '')}`.toLowerCase();
    if (p && (p.includes('base avatar') || p.includes('same actor from avatar') || p.includes('same avatar') || p.includes('same avatar character')) && !avatarUrlIsValid) {
      console.warn(`[Storyboard Validation] Scene ${scene.scene_number} references avatar in prompts but no valid avatar_image_url provided`);
      return false;
    }
  }
  return true;
}

function isVideoGenerationInput(v: unknown): v is VideoGenerationInput {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as any;
  if (typeof obj.storyboard_id !== 'string' || obj.storyboard_id.trim().length === 0) return false;
  return true;
}

function isVideoAnalysisInput(v: unknown): v is import('../../../../types/assistant').VideoAnalysisInput {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as any;
  // At least one of video_url or video_file must be provided
  return typeof obj.video_url === 'string' || typeof obj.video_file === 'string';
}

function isMotionControlInput(v: unknown): v is import('../../../../types/assistant').MotionControlInput {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as any;
  // Both video_url and image_url are required
  return typeof obj.video_url === 'string' && typeof obj.image_url === 'string';
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

type ReflexionMeta = {
  selectedAction?: 'DIRECT_RESPONSE' | 'FOLLOW_UP' | 'TOOL_CALL';
  toolToUse?: import('../../../../types/assistant').ToolName | 'none';
};

function parseReflexionMeta(content: string): ReflexionMeta | null {
  const m = content.match(/<reflexion>([\s\S]*?)<\/reflexion>/);
  if (!m?.[1]) return null;
  const raw = m[1];

  // Handles both Markdown-bold and plain formats:
  // "**Selected Action:** TOOL_CALL" or "Selected Action: TOOL_CALL"
  const actionMatch = raw.match(/Selected Action:\s*\**\s*\[?\s*([A-Z_]+)\s*\]?\s*/i);
  const toolMatch = raw.match(/Tool To Use:\s*\**\s*\[?\s*([a-z_]+|none)\s*\]?\s*/i);

  const selectedActionRaw = actionMatch?.[1]?.toUpperCase();
  const toolToUseRaw = toolMatch?.[1]?.toLowerCase();

  const meta: ReflexionMeta = {};
  if (selectedActionRaw === 'DIRECT_RESPONSE' || selectedActionRaw === 'FOLLOW_UP' || selectedActionRaw === 'TOOL_CALL') {
    meta.selectedAction = selectedActionRaw as ReflexionMeta['selectedAction'];
  }
  if (toolToUseRaw) meta.toolToUse = toolToUseRaw as ReflexionMeta['toolToUse'];
  return meta;
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

// Lightweight prediction status check (no caching, just return raw status and output)
async function checkPredictionStatus(token: string, predictionId: string): Promise<{ status: string | null; outputUrl: string | null; error: string | null }> {
  try {
    const res = await fetch(`${REPLICATE_API}/predictions/${encodeURIComponent(predictionId)}`, {
      headers: { Authorization: `Token ${token}` },
      cache: 'no-store',
    });
    
    if (!res.ok) {
      return { status: null, outputUrl: null, error: await res.text() };
    }
    
    const json: any = await res.json();
    let outputUrl: string | null = null;
    const out = json.output;
    if (typeof out === 'string') outputUrl = out;
    else if (Array.isArray(out)) outputUrl = typeof out[0] === 'string' ? out[0] : null;
    else if (out && typeof out === 'object' && typeof out.url === 'string') outputUrl = out.url;
    return { status: String(json.status || ''), outputUrl, error: json.error || json.logs || null };
  } catch (e: any) {
    return { status: null, outputUrl: null, error: e.message };
  }
}

async function resolveReplicateOutputUrl(params: {
  predictionId: string;
  conversationId?: string;
  origin?: string;
  type?: 'avatar' | 'product' | 'frame';
}): Promise<{ status: string | null; outputUrl: string | null; error: string | null }> {
  try {
    const { predictionId, conversationId, origin, type = 'frame' } = params;
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return { status: null, outputUrl: null, error: 'missing REPLICATE_API_TOKEN' };
    
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const res = await fetch(`${REPLICATE_API}/predictions/${encodeURIComponent(predictionId)}`, {
      headers: { Authorization: `Token ${token}` },
      cache: 'no-store',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[resolveReplicateOutputUrl] HTTP ${res.status} for ${predictionId}:`, errorText);
      return { status: null, outputUrl: null, error: errorText };
    }
    
    const json: any = await res.json();
    let outputUrl: string | null = null;
    const out = json.output;
    if (typeof out === 'string') outputUrl = out;
    else if (Array.isArray(out)) outputUrl = typeof out[0] === 'string' ? out[0] : null;
    else if (out && typeof out === 'object' && typeof out.url === 'string') outputUrl = out.url;

    // If we have a successful output and caching context, immediately store it in R2 so we never rely on replicate.delivery URLs.
    if (String(json.status || '').toLowerCase() === 'succeeded' && outputUrl && conversationId && origin) {
      const cached = await maybeCacheImageToR2({ sourceUrl: outputUrl, conversationId, origin, type });
      outputUrl = cached.url || outputUrl;
    }

    return { status: String(json.status || ''), outputUrl, error: json.error || json.logs || null };
  } catch (e: any) {
    const errorMessage = e.name === 'AbortError' 
      ? 'Request timed out after 15 seconds'
      : `Network error: ${e.message}`;
    console.error(`[resolveReplicateOutputUrl] ${errorMessage} for ${params.predictionId}`);
    return { status: null, outputUrl: null, error: errorMessage };
  }
}

async function getLastAvatarFromConversation(
  messages: Message[],
  ctx?: { conversationId?: string; origin?: string }
): Promise<{ url?: string; predictionId?: string; status?: string; description?: string } | null> {
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
        const resolved = await resolveReplicateOutputUrl({
          predictionId,
          conversationId: ctx?.conversationId,
          origin: ctx?.origin,
          type: 'avatar',
        });
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

function isProductImageConfirmation(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('use this product') ||
    normalized.includes('use that product') ||
    normalized.includes('use this product image') ||
    normalized.includes('yes use this product') ||
    normalized.includes('use this as product image')
  );
}

/**
 * Get the last product image from the conversation (similar to avatar tracking)
 */
async function getLastProductFromConversation(
  messages: Message[],
  ctx?: { conversationId?: string; origin?: string }
): Promise<{ url?: string; predictionId?: string; status?: string; description?: string } | null> {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'tool_result' || msg.tool_name !== 'image_generation') continue;
    
    const toolOutput = msg.tool_output as any;
    const purposeFromOutput = toolOutput?.purpose;
    const descriptionFromOutput = toolOutput?.product_description || toolOutput?.prompt;
    
    let isProduct = purposeFromOutput === 'product';
    let productDescription = descriptionFromOutput;
    
    // Check the corresponding tool_call as fallback
    if (!isProduct) {
      for (let j = i - 1; j >= 0; j--) {
        const prev = messages[j];
        if (prev.role === 'tool_call' && prev.tool_name === 'image_generation') {
          const input = prev.tool_input as any;
          if (input?.purpose === 'product') {
            isProduct = true;
            productDescription = productDescription || input?.prompt;
          }
          break;
        }
      }
    }
    
    if (isProduct) {
      const url = extractImageUrlFromToolResult(msg);
      const predictionId = extractPredictionIdFromToolResult(msg);
      
      if (url) {
        return { url, predictionId: predictionId || undefined, status: 'succeeded', description: productDescription || undefined };
      }
      
      if (predictionId) {
        const resolved = await resolveReplicateOutputUrl({
          predictionId,
          conversationId: ctx?.conversationId,
          origin: ctx?.origin,
          type: 'product',
        });
        if (resolved.outputUrl) {
          return { url: resolved.outputUrl, predictionId, status: resolved.status || undefined, description: productDescription || undefined };
        }
        return { predictionId, status: resolved.status || undefined, description: productDescription || undefined };
      }
      
      return { description: productDescription || undefined };
    }
  }
  return null;
}

async function maybeCacheImageToR2({
  sourceUrl,
  conversationId,
  origin,
  type = 'avatar',
}: {
  sourceUrl: string;
  conversationId: string;
  origin: string;
  type?: 'avatar' | 'product' | 'frame';
}): Promise<{ url: string; cached: boolean; error?: string }> {
  try {
    const src = sourceUrl.trim();
    if (!isHttpUrl(src)) return { url: sourceUrl, cached: false, error: 'sourceUrl is not http(s)' };

    const r2AccountId = process.env.R2_ACCOUNT_ID || '';
    const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
    const r2Endpoint = process.env.R2_S3_ENDPOINT || null;
    const bucket = process.env.R2_BUCKET || 'assets';
    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) {
      return { url: sourceUrl, cached: false, error: 'R2 not configured (missing R2_* credentials)' };
    }

    const res = await fetch(src, { cache: 'no-store' });
    if (!res.ok) return { url: sourceUrl, cached: false, error: `Failed to download ${type}: ${await res.text()}` };
    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';

    // Keep extension consistent; default to jpg for maximum compatibility
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const folder = type === 'product' ? 'products' : type === 'frame' ? 'storyboards' : 'avatars';
    const key = `${folder}/${conversationId}/${crypto.randomUUID()}.${ext}`;

    const r2 = createR2Client({
      accountId: r2AccountId,
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
      bucket,
      endpoint: r2Endpoint,
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

    const base = origin.replace(/\/$/, '');
    const appUrl = `${base}/api/r2/get?key=${encodeURIComponent(key)}`;
    return { url: appUrl, cached: true };
  } catch (e: any) {
    return { url: sourceUrl, cached: false, error: e?.message || `maybeCacheImageToR2 (${type}) failed` };
  }
}

// Backwards-compatible alias
async function maybeCacheAvatarToR2({
  sourceUrl,
  conversationId,
  origin,
}: {
  sourceUrl: string;
  conversationId: string;
  origin: string;
}): Promise<{ url: string; cached: boolean; error?: string }> {
  return maybeCacheImageToR2({ sourceUrl, conversationId, origin, type: 'avatar' });
}

// Remove tool calls and reflexion from visible response
function cleanResponse(content: string): string {
  return content
    .replace(/<reflexion>[\s\S]*?<\/reflexion>/g, '')
    // Remove dangling reflexion without a closing tag (prevents UI getting stuck mid-reflexion)
    .replace(/<reflexion>[\s\S]*$/g, '')
    // Remove proper tool_call blocks
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
    // Remove dangling tool_call without a closing tag
    .replace(/<tool_call>[\s\S]*$/g, '')
    .trim();
}

function sanitizeStoryboardCreationInput(raw: any): any {
  const input = (raw && typeof raw === 'object') ? raw : {};
  const allowedTopKeys = new Set([
    'title',
    'concept',
    'brand_name',
    'product',
    'product_description',
    'target_audience',
    'platform',
    'total_duration_seconds',
    'style',
    'aspect_ratio',
    'key_benefits',
    'pain_points',
    'call_to_action',
    'creative_direction',
    'avatar_image_url',
    'avatar_description',
    'product_image_url',
    'product_image_description',
    'scenes',
    'scene_breakdown',
  ]);

  const out: any = {};
  for (const k of Object.keys(input)) {
    if (allowedTopKeys.has(k)) out[k] = input[k];
  }

  // Accept scenario-planning style scene_breakdown and map to scenes.
  const rawScenes = Array.isArray(input.scenes)
    ? input.scenes
    : (Array.isArray(input.scene_breakdown) ? input.scene_breakdown : []);
  out.scenes = rawScenes.map((s: any) => {
    const scene = (s && typeof s === 'object') ? s : {};
    // IMPORTANT: keep tool_call payload SMALL. Do NOT accept large per-scene prompt blocks from the model.
    // The server will generate first/last frame prompts and voiceover via multi-call refinement.
    const description =
      typeof scene.description === 'string'
        ? scene.description
        : (typeof scene.purpose === 'string' ? scene.purpose : undefined);
    return {
      scene_number: typeof scene.scene_number === 'number' ? scene.scene_number : undefined,
      scene_name: typeof scene.scene_name === 'string' ? scene.scene_name : undefined,
      description,
      duration_seconds: typeof scene.duration_seconds === 'number' ? scene.duration_seconds : undefined,
      scene_type: typeof scene.scene_type === 'string' ? scene.scene_type : undefined,
      uses_avatar: typeof scene.uses_avatar === 'boolean'
        ? scene.uses_avatar
        : (typeof scene.needs_avatar === 'boolean' ? scene.needs_avatar : undefined),
      transition_type: typeof scene.transition_type === 'string' ? scene.transition_type : undefined,
      setting_change: typeof scene.setting_change === 'boolean' ? scene.setting_change : undefined,
      product_focus: typeof scene.product_focus === 'boolean' ? scene.product_focus : undefined,
      text_overlay: typeof scene.text_overlay === 'string' ? scene.text_overlay : undefined,
      needs_product_image: typeof scene.needs_product_image === 'boolean' ? scene.needs_product_image : undefined,
      use_prev_scene_transition: typeof scene.use_prev_scene_transition === 'boolean' ? scene.use_prev_scene_transition : undefined,
    };
  }).filter((s: any) => s && (typeof s.scene_number === 'number' || typeof s.scene_name === 'string' || typeof s.description === 'string'));

  if (typeof out.title !== 'string' || out.title.trim().length === 0) {
    const brand = typeof out.brand_name === 'string' ? out.brand_name.trim() : '';
    const product = typeof out.product === 'string' ? out.product.trim() : '';
    const concept = typeof out.concept === 'string' ? out.concept.trim() : '';
    out.title = concept || (brand ? `${brand} Storyboard` : (product ? `${product} Storyboard` : 'Storyboard'));
  }

  return out;
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
    
    const scriptSystemPrompt = `You are the brand’s lead creative director + senior copywriter for short-form ads.

Goal: write a script that feels like a real brand campaign concept, not generic ad copy.

Rules:
- Start from a clear creative thesis (what is the fresh angle?).
- Give the creator believable, human lines. Avoid AI-ish hype and generic superlatives.
- Make the story art-directable: include specific on-screen actions, props, and setting cues in [BRACKETS].
- Use cadence and subtext. Include micro-beats (pause, glance, gesture) where helpful.
- Use the user’s tone/platform constraints. Keep it shootable.

Output format (required):
- [0-3s] HOOK: ...
- [3-8s] PROBLEM: ...
- [8-18s] MOMENT/DEMO: ...
- [18-25s] PROOF/DETAIL: ...
- [25-30s] CTA: ...

Also include at the end:
- VISUAL NOTES: 3-5 bullet points describing the signature look, palette, and props.
`;
    
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
    
    // Nano Banana only (assistant image model)
    const model = ASSISTANT_IMAGE_MODEL;

    const nanoBananaInput: Record<string, unknown> = {
      prompt: input.prompt,
      // Default aspect ratio to 9:16 (vertical) unless user/LLM specified it.
      aspect_ratio: input.aspect_ratio || DEFAULT_IMAGE_ASPECT_RATIO,
      output_format: input.output_format || 'jpg',
    };

    if (Array.isArray(input.image_input) && input.image_input.length > 0) {
      nanoBananaInput.image_input = input.image_input;
    }

    const out = await createReplicatePrediction({ token: String(token), model, input: nanoBananaInput });
    return { success: true, output: { id: out.id, status: out.status } };
  } catch (e: any) {
    console.error('Image generation error:', e);
    return { success: false, error: e.message };
  }
}

// Execute video analysis tool
async function executeVideoAnalysis(
  input: import('../../../../types/assistant').VideoAnalysisInput,
  ctx: { origin: string; conversationId: string }
): Promise<{ success: boolean; output?: import('../../../../types/assistant').VideoAnalysisOutput; error?: string }> {
  try {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return { success: false, error: 'Server misconfigured: missing REPLICATE_API_TOKEN' };
    }

    // 1. Normalize video URL (upload to R2 if it's a file)
    let videoUrl = input.video_url || '';
    
    if (input.video_file && !videoUrl) {
      // If a video file identifier is provided, we assume it's already uploaded
      // In production, you might need to handle the actual upload here
      videoUrl = input.video_file;
    }

    if (!videoUrl || !isHttpUrl(videoUrl)) {
      return { success: false, error: 'Invalid video URL provided' };
    }

    // 2. Use Replicate to extract and analyze frames
    // We'll use a dedicated Replicate model for video frame extraction and analysis
    // For now, we'll create a simplified version using the vision model on sampled frames
    
    const maxDuration = Math.min(input.max_duration_seconds || 30, 30);
    const frameInterval = 5; // Extract frames every 5 seconds
    const numFrames = Math.ceil(maxDuration / frameInterval);

    // Use a vision model to analyze the video
    // Note: In production, you'd want to use a proper video processing service
    // For now, we'll use Replicate's vision model with a prompt that simulates frame analysis
    const visionModel = 'meta/llama-3.2-11b-vision-instruct';
    
    const analysisPrompt = `Analyze this video and provide a structured assessment. Return ONLY valid JSON with no markdown formatting, no code blocks, and no additional text.

Format (strict JSON only):
{
  "duration_seconds": <number>,
  "summary": "<brief description>",
  "people_count_avg": <number>,
  "is_single_character_only": <boolean>,
  "has_b_roll": <boolean>,
  "recommended_for_motion_control": <boolean>,
  "reasoning": "<explanation>"
}

Analyze if this video is suitable for motion control/character replacement. Look for:
- Single person performing consistent actions (good for motion control)
- Multiple scene changes or b-roll footage (not suitable)
- Text overlays or complex backgrounds (may reduce quality)

Video URL: ${videoUrl}
Max duration analyzed: ${maxDuration}s`;

    // Call vision model (simplified - in production, extract actual frames)
    const replicate = new Replicate({ auth: token });
    let analysisResult = '';
    
    try {
      const stream = await replicate.stream(visionModel as any, {
        input: {
          prompt: analysisPrompt,
          max_tokens: 1024,
        }
      });

      for await (const event of stream) {
        analysisResult += String(event);
      }
    } catch (visionError: any) {
      console.error('[VideoAnalysis] Vision model error:', visionError);
      // Fallback to basic analysis
      return {
        success: true,
        output: {
          asset_id: crypto.randomUUID(),
          video_url: videoUrl,
          duration_seconds: maxDuration,
          frames: [],
          summary: 'Video uploaded for future analysis',
          eligibility: {
            is_single_character_only: false,
            has_b_roll: false,
            recommended_for_motion_control: false,
            reasoning: 'Unable to analyze video content automatically. Manual review recommended.'
          }
        }
      };
    }

    // Parse the analysis result
    let parsedAnalysis: any;
    try {
      // Try to extract JSON from the response
      const jsonMatch = analysisResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedAnalysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[VideoAnalysis] Failed to parse analysis:', analysisResult);
      parsedAnalysis = {
        duration_seconds: maxDuration,
        summary: 'Video analysis completed',
        people_count_avg: 1,
        is_single_character_only: false,
        has_b_roll: false,
        recommended_for_motion_control: false,
        reasoning: 'Analysis format error'
      };
    }

    const output: import('../../../../types/assistant').VideoAnalysisOutput = {
      asset_id: crypto.randomUUID(),
      video_url: videoUrl,
      duration_seconds: parsedAnalysis.duration_seconds || maxDuration,
      frames: [], // Simplified - would contain actual frame data in production
      summary: parsedAnalysis.summary || 'Video analyzed',
      eligibility: {
        is_single_character_only: parsedAnalysis.is_single_character_only || false,
        has_b_roll: parsedAnalysis.has_b_roll || false,
        recommended_for_motion_control: parsedAnalysis.recommended_for_motion_control || false,
        reasoning: parsedAnalysis.reasoning || 'Analysis completed'
      }
    };

    return { success: true, output };
  } catch (e: any) {
    console.error('Video analysis error:', e);
    return { success: false, error: e.message };
  }
}

// Execute motion control tool
async function executeMotionControl(
  input: import('../../../../types/assistant').MotionControlInput
): Promise<{ success: boolean; output?: { id: string; status: string }; error?: string }> {
  try {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return { success: false, error: 'Server misconfigured: missing REPLICATE_API_TOKEN' };
    }

    // Validate required inputs
    if (!input.video_url || !isHttpUrl(input.video_url)) {
      return { success: false, error: 'Valid video_url is required' };
    }
    if (!input.image_url || !isHttpUrl(input.image_url)) {
      return { success: false, error: 'Valid image_url is required' };
    }

    // Normalize internal asset URLs so Replicate/Kling can always fetch them.
    // We accept a few historical URL shapes:
    // - https://<site>/api/r2/get?key=...            (our stable proxy)
    // - https://pub-<acct>.r2.dev/<key>             (R2 public base)
    // - https://<site>/r2/<key>                     (legacy public base)
    // If possible, convert everything into https://<site>/api/r2/get?key=<key>
    // and verify it is actually retrievable before calling Replicate.
    const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || null;

    function extractKeyFromKnownUrl(u: string): string | null {
      try {
        const url = new URL(u);
        // /api/r2/get?key=...
        if (url.pathname === '/api/r2/get') {
          const k = url.searchParams.get('key');
          return k ? k.trim().replace(/^\/+/, '') : null;
        }
        // /r2/<key> (legacy)
        if (url.pathname.startsWith('/r2/')) {
          const k = url.pathname.replace(/^\/r2\//, '').trim();
          return k ? k.replace(/^\/+/, '') : null;
        }
        // pub-*.r2.dev/<key>
        if (url.hostname.endsWith('.r2.dev')) {
          const k = url.pathname.replace(/^\/+/, '').trim();
          return k ? k : null;
        }
        return null;
      } catch {
        return null;
      }
    }

    function toProxyUrl(u: string): string {
      const base = (() => {
        try {
          return new URL(u).origin;
        } catch {
          return null;
        }
      })();
      const k = extractKeyFromKnownUrl(u);
      if (!k) return u;
      // Prefer the same origin as the provided URL (likely www.adzcreator.com),
      // fall back to server's request origin via env if provided.
      const proxyOrigin = (base && base !== 'null' ? base : (origin || '')) .replace(/\/$/, '');
      if (!proxyOrigin) return u;
      return `${proxyOrigin}/api/r2/get?key=${encodeURIComponent(k)}`;
    }

    async function verifyFetchable(u: string): Promise<{ ok: boolean; status: number; finalUrl: string }> {
      // Some servers don't support HEAD well; try HEAD then small ranged GET.
      try {
        const head = await fetch(u, { method: 'HEAD', cache: 'no-store' });
        if (head.ok) return { ok: true, status: head.status, finalUrl: u };
      } catch {}
      try {
        const get = await fetch(u, { method: 'GET', headers: { Range: 'bytes=0-0' }, cache: 'no-store' });
        return { ok: get.status >= 200 && get.status < 400, status: get.status, finalUrl: u };
      } catch (e: any) {
        return { ok: false, status: 0, finalUrl: u };
      }
    }

    const normalizedImageUrl = toProxyUrl(input.image_url);
    const normalizedVideoUrl = toProxyUrl(input.video_url);

    const imgCheck = await verifyFetchable(normalizedImageUrl);
    if (!imgCheck.ok) {
      return {
        success: false,
        error:
          `Reference image URL is not retrievable (HTTP ${imgCheck.status}). ` +
          `This usually means the URL is stale/misconfigured (often /r2/... or r2.dev...). ` +
          `Please re-upload the reference image in chat (paperclip) or regenerate it, then try again.`,
      };
    }

    const vidCheck = await verifyFetchable(normalizedVideoUrl);
    if (!vidCheck.ok) {
      return {
        success: false,
        error:
          `Reference video URL is not retrievable (HTTP ${vidCheck.status}). ` +
          `Please re-upload the video in chat (paperclip) or provide a working public URL, then try again.`,
      };
    }

    const model = 'kwaivgi/kling-v2.6-motion-control';

    const motionControlInput: Record<string, unknown> = {
      video: normalizedVideoUrl,
      image: normalizedImageUrl,
    };

    // Add optional parameters
    if (input.prompt) {
      motionControlInput.prompt = input.prompt;
    }
    if (input.character_orientation) {
      motionControlInput.character_orientation = input.character_orientation;
    }
    if (input.mode) {
      motionControlInput.mode = input.mode;
    }
    if (typeof input.keep_original_sound === 'boolean') {
      motionControlInput.keep_original_sound = input.keep_original_sound;
    }

    const out = await createReplicatePrediction({ 
      token: String(token), 
      model, 
      input: motionControlInput 
    });
    
    return { success: true, output: { id: out.id, status: out.status } };
  } catch (e: any) {
    console.error('Motion control error:', e);
    return { success: false, error: e.message };
  }
}

// Cache for model version IDs to avoid repeated API calls
const MODEL_VERSION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cachedModelVersions = new Map<string, { versionId: string; at: number }>();

// Simple in-memory rate limiter for Replicate API calls
class RateLimiter {
  private requests: number[] = [];
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    
    // Clean old requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      // Calculate how long to wait
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.windowMs - (now - oldestRequest) + 100; // Add 100ms buffer
      
      console.log(`[RateLimiter] Waiting ${waitTime}ms to respect rate limits`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Recursively try again
      return this.acquire();
    }
    
    // Record this request
    this.requests.push(now);
  }
}

// Conservative rate limiter - 5 requests per minute to stay well under the 6/min limit
const replicateRateLimiter = new RateLimiter(5, 60 * 1000);

// Helper to get model version with caching
async function getModelVersionId(token: string, model: string): Promise<string | null> {
  const now = Date.now();
  const cached = cachedModelVersions.get(model);
  if (cached && (now - cached.at) < MODEL_VERSION_CACHE_TTL) {
    return cached.versionId;
  }

  try {
    console.log(`[Storyboard] Fetching model version for:`, model);
    
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const modelRes = await fetch(`${REPLICATE_API}/models/${model}`, {
      headers: { Authorization: `Token ${token}` },
      cache: 'no-store',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!modelRes.ok) {
      const errorText = await modelRes.text();
      console.error(`[Storyboard] Failed to fetch model ${model} (${modelRes.status}):`, errorText);
      return null;
    }
    
    const modelJson = await modelRes.json();
    const versionId = modelJson?.latest_version?.id;
    
    if (versionId) {
      cachedModelVersions.set(model, { versionId, at: now });
      console.log(`[Storyboard] Cached version ID for ${model}:`, versionId);
    } else {
      console.error(`[Storyboard] No latest version found for model ${model}`);
    }
    
    return versionId || null;
    
  } catch (error: any) {
    const errorMessage = error.name === 'AbortError' 
      ? 'Model fetch timed out after 15 seconds'
      : `Model fetch error: ${error.message}`;
    console.error(`[Storyboard] ${errorMessage} for model ${model}`);
    return null;
  }
}

async function createReplicatePrediction({
  token,
  model,
  input,
}: {
  token: string;
  model: string;
  input: Record<string, any>;
}): Promise<{ id: string; status: string }> {
  const versionId = await getModelVersionId(token, model);
  if (!versionId) throw new Error(`No latest version found for ${model}`);
  
  // Acquire rate limit slot before making request
  await replicateRateLimiter.acquire();
  
  const res = await fetch(`${REPLICATE_API}/predictions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${token}`,
    },
    body: JSON.stringify({ version: versionId, input }),
  });
  if (!res.ok) throw new Error(await res.text());
  const json: any = await res.json();
  const id = String(json?.id || '').trim();
  const status = String(json?.status || 'starting');
  if (!id) throw new Error(`Replicate prediction create returned no id for ${model}`);
  return { id, status };
}

/**
 * Reference images for image generation
 * Supports multiple reference types for maximum consistency
 */
interface ReferenceImages {
  avatarUrl?: string;              // Avatar image for character consistency
  avatarDescription?: string;      // Description of the avatar
  firstFrameUrl?: string;          // Scene's first frame (when generating last frame)
  productUrl?: string;             // Product image for product consistency
  productDescription?: string;     // Description of the product
  prevSceneLastFrameUrl?: string;  // Previous scene's last frame (for smooth transitions)
}

/**
 * Get AI reflexion on which reference images to use
 * Returns an array of selected image URLs for maximum consistency
 */
async function getImageReferenceReflexion(params: {
  frameType: 'first' | 'last';
  sceneNumber: number;
  sceneName: string;
  sceneDescription: string;
  framePrompt: string;
  imageRegistry: ImageRegistry;
  storyboardId: string;
  avatarUrl?: string;
  productUrl?: string;
  usesAvatar: boolean;
  needsProduct: boolean;
  usePrevSceneTransition: boolean;
  replicate: Replicate;
}): Promise<string[]> {
  try {
    const {
      frameType,
      sceneNumber,
      sceneName,
      sceneDescription,
      framePrompt,
      imageRegistry,
      storyboardId,
      avatarUrl,
      productUrl,
      usesAvatar,
      needsProduct,
      usePrevSceneTransition,
      replicate,
    } = params;

    // Build the available images pool description
    const availableImages: Array<{ url: string; description: string }> = [];
    
    // Add avatar if available
    if (avatarUrl) {
      availableImages.push({
        url: avatarUrl,
        description: 'Avatar/Character reference image (confirmed identity)',
      });
    }
    
    // Add product if available
    if (productUrl) {
      availableImages.push({
        url: productUrl,
        description: 'Product reference image (confirmed product appearance)',
      });
    }
    
    // Add all successfully generated frames from this storyboard
    const storyboardImages = queryImages(imageRegistry, {
      storyboardId,
      hasUrl: true,
      status: 'succeeded',
    });
    
    for (const img of storyboardImages) {
      if (img.url) {
        const desc = `Scene ${img.sceneNumber} ${img.framePosition} frame - ${img.sceneName || 'untitled'}`;
        availableImages.push({
          url: img.url,
          description: desc,
        });
      }
    }
    
    // Build the reflexion prompt
    const reflexionPrompt = `
FRAME TO GENERATE: Scene ${sceneNumber} "${sceneName}" - ${frameType.toUpperCase()} FRAME

SCENE CONTEXT:
- Scene Description: ${sceneDescription}
- Frame Prompt: ${framePrompt}
- Uses Avatar: ${usesAvatar}
- Needs Product: ${needsProduct}
- Smooth Transition from Previous Scene: ${usePrevSceneTransition}

AVAILABLE IMAGES IN POOL (${availableImages.length} total):
${availableImages.map((img, idx) => `${idx + 1}. ${img.description}\n   URL: ${img.url}`).join('\n')}

TASK: Select ALL relevant reference images that will help maintain consistency for this ${frameType} frame generation.
Remember: Nano Banana supports UP TO 14 input images. Use as many as relevant!

${frameType === 'last' ? `CRITICAL: Since this is a LAST frame, you MUST include the scene's first frame for consistency within the scene.` : ''}
${usePrevSceneTransition ? `CRITICAL: Since this uses smooth transition, you MUST include the previous scene's last frame.` : ''}
${usesAvatar ? `CRITICAL: Since this scene uses the avatar, you MUST include the avatar reference image.` : ''}
${needsProduct ? `CRITICAL: Since this scene needs the product, you MUST include the product reference image.` : ''}

Return STRICT JSON with selected_image_urls array.`;

    // Call Claude for reflexion
    let reflexionText = '';
    const stream = await replicate.stream('anthropic/claude-4-sonnet', {
      input: {
        prompt: reflexionPrompt,
        system_prompt: IMAGE_REFERENCE_SELECTION_PROMPT,
        max_tokens: 1024,
      },
    });
    
    for await (const event of stream) {
      reflexionText += String(event);
    }
    
    // Parse the reflexion result
    const parsed = tryParseAnyJson(reflexionText);
    if (!parsed || !Array.isArray(parsed.selected_image_urls)) {
      console.warn('[Image Reflexion] Failed to parse reflexion, falling back to manual selection');
      // Fallback to basic selection
      return buildFallbackImageReferences(params);
    }
    
    const reflexion = parsed as ImageReferenceReflexion;
    console.log('[Image Reflexion]', {
      frameType,
      sceneNumber,
      availableCount: availableImages.length,
      selectedCount: reflexion.selected_image_urls.length,
      reasoning: reflexion.reasoning.substring(0, 100),
    });
    
    // Validate and filter selected URLs
    const validUrls = reflexion.selected_image_urls
      .filter(url => typeof url === 'string' && url.startsWith('http'))
      .slice(0, 14); // Nano Banana limit
    
    return validUrls;
    
  } catch (e: any) {
    console.error('[Image Reflexion] Error:', e.message);
    // Fallback to basic selection
    return buildFallbackImageReferences(params);
  }
}

/**
 * Fallback image reference selection when AI reflexion fails
 */
function buildFallbackImageReferences(params: {
  frameType: 'first' | 'last';
  sceneNumber: number;
  imageRegistry: ImageRegistry;
  storyboardId: string;
  avatarUrl?: string;
  productUrl?: string;
  usesAvatar: boolean;
  needsProduct: boolean;
  usePrevSceneTransition: boolean;
}): string[] {
  const refs: string[] = [];
  const {
    frameType,
    sceneNumber,
    imageRegistry,
    storyboardId,
    avatarUrl,
    productUrl,
    usesAvatar,
    needsProduct,
    usePrevSceneTransition,
  } = params;
  
  // For last frame, ALWAYS include scene's first frame
  if (frameType === 'last') {
    const sceneKey = `${storyboardId}:${sceneNumber}`;
    const firstFrameId = imageRegistry.byScene[sceneKey]?.firstFrame;
    if (firstFrameId && imageRegistry.images[firstFrameId]?.url) {
      refs.push(imageRegistry.images[firstFrameId].url);
    }
  }
  
  // For smooth transitions, include previous scene's last frame
  if (usePrevSceneTransition && sceneNumber > 1) {
    const prevSceneKey = `${storyboardId}:${sceneNumber - 1}`;
    const prevLastFrameId = imageRegistry.byScene[prevSceneKey]?.lastFrame;
    if (prevLastFrameId && imageRegistry.images[prevLastFrameId]?.url) {
      const url = imageRegistry.images[prevLastFrameId].url;
      if (!refs.includes(url)) refs.push(url);
    }
  }
  
  // Include avatar if needed
  if (usesAvatar && avatarUrl && !refs.includes(avatarUrl)) {
    refs.push(avatarUrl);
  }
  
  // Include product if needed
  if (needsProduct && productUrl && !refs.includes(productUrl)) {
    refs.push(productUrl);
  }
  
  // Include recent previous frames for style consistency (limit to last 2 scenes)
  const recentFrames = queryImages(imageRegistry, {
    storyboardId,
    hasUrl: true,
    status: 'succeeded',
  }).filter(img => img.sceneNumber! < sceneNumber && img.sceneNumber! >= Math.max(1, sceneNumber - 2));
  
  for (const img of recentFrames) {
    if (img.url && !refs.includes(img.url) && refs.length < 14) {
      refs.push(img.url);
    }
  }
  
  return refs;
}

// Helper to generate a single image with multiple reference image support
async function generateSingleImage(
  prompt: string, 
  aspectRatio?: string,
  references?: ReferenceImages,
  additionalImageInputs?: string[]
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
      
      // Retry logic for network resilience
      const maxRetries = 3;
      const retryDelay = 1000; // 1 second
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[Storyboard] Creating prediction (attempt ${attempt}/${maxRetries}):`, model);
          
          // Acquire rate limit slot before making request
          await replicateRateLimiter.acquire();
          
          // Create AbortController for timeout handling
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
          
          const res = await fetch(`${REPLICATE_API}/predictions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Token ${tokenStr}`,
            },
            body: JSON.stringify({ version: versionId, input }),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (!res.ok) {
            const errorText = await res.text();
            console.error(`[Storyboard] HTTP ${res.status} on attempt ${attempt}:`, errorText);
            
            // Handle 429 rate limiting specially - this should be retried
            if (res.status === 429) {
              let retryAfter = 1; // Default to 1 second
              
              try {
                // Try to parse retry_after from error response
                const errorObj = JSON.parse(errorText);
                if (typeof errorObj.retry_after === 'number') {
                  retryAfter = errorObj.retry_after;
                } else if (res.headers.get('retry-after')) {
                  retryAfter = parseInt(res.headers.get('retry-after') || '1', 10);
                }
              } catch (e) {
                // Fallback to header or default
                retryAfter = parseInt(res.headers.get('retry-after') || '1', 10);
              }
              
              console.log(`[Storyboard] Rate limited, waiting ${retryAfter}s before retry ${attempt}/${maxRetries}`);
              
              if (attempt === maxRetries) {
                return { ok: false as const, status: res.status, text: `Rate limited: ${errorText}` };
              }
              
              // Wait for the specified retry_after time plus a small buffer
              await new Promise(resolve => setTimeout(resolve, (retryAfter * 1000) + 500));
              continue;
            }
            
            // Don't retry on other client errors (4xx), only server errors (5xx) and network issues
            if (res.status >= 400 && res.status < 500) {
              return { ok: false as const, status: res.status, text: errorText };
            }
            
            if (attempt === maxRetries) {
              return { ok: false as const, status: res.status, text: errorText };
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            continue;
          }
          
          const json = await res.json();
          console.log(`[Storyboard] Prediction created successfully:`, json.id);
          return { ok: true as const, json };
          
        } catch (error: any) {
          console.error(`[Storyboard] Network error on attempt ${attempt}:`, error.message);
          
          if (attempt === maxRetries) {
            const errorMessage = error.name === 'AbortError' 
              ? 'Request timed out after 30 seconds'
              : `Network error: ${error.message}`;
            return { ok: false as const, status: 0, text: errorMessage };
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
      }
      
      return { ok: false as const, status: 0, text: 'Max retries exceeded' };
    }
    
    // Build the enhanced prompt
    let enhancedPrompt = prompt;
    
    // Add aspect ratio hint to prompt if provided (default to 9:16)
    const ar = (aspectRatio || DEFAULT_IMAGE_ASPECT_RATIO).trim();
    if (ar && !prompt.includes(ar)) {
      enhancedPrompt = `${enhancedPrompt}, ${ar} aspect ratio`;
    }
    
    // Input is built later; keep base vars for prompt construction only.
    
    // Collect all reference image URLs - now supporting multiple images via additionalImageInputs
    const referenceUrls: string[] = [];
    
    // If additionalImageInputs provided (from AI reflexion), use those directly
    if (Array.isArray(additionalImageInputs) && additionalImageInputs.length > 0) {
      referenceUrls.push(...additionalImageInputs.filter(url => url && url.startsWith('http')));
      console.log(`[Storyboard] Using ${referenceUrls.length} reference images from AI reflexion`);
    } else {
      // Fallback to legacy ReferenceImages structure
      const hasPrevSceneRef = references?.prevSceneLastFrameUrl && /^https?:\/\//i.test(references.prevSceneLastFrameUrl);
      const hasFirstFrameRef = references?.firstFrameUrl && /^https?:\/\//i.test(references.firstFrameUrl);
      const hasAvatarRef = references?.avatarUrl && /^https?:\/\//i.test(references.avatarUrl);
      const hasProductRef = references?.productUrl && /^https?:\/\//i.test(references.productUrl);
      
      if (hasPrevSceneRef && !referenceUrls.includes(references!.prevSceneLastFrameUrl!)) {
        referenceUrls.push(references!.prevSceneLastFrameUrl!);
      }
      
      if (hasFirstFrameRef && !referenceUrls.includes(references!.firstFrameUrl!)) {
        referenceUrls.push(references!.firstFrameUrl!);
      }
      
      if (hasAvatarRef && !referenceUrls.includes(references!.avatarUrl!)) {
        referenceUrls.push(references!.avatarUrl!);
      }
      
      if (hasProductRef && !referenceUrls.includes(references!.productUrl!)) {
        referenceUrls.push(references!.productUrl!);
      }
      
      console.log('[Storyboard] Using legacy reference structure:', referenceUrls.length, 'images');
    }
    
    const hasAnyRef = referenceUrls.length > 0;
    
    // The prompt now follows the 4-block structure and is already properly formatted
    // from the scene refinement AI, so we use it directly without adding context
    let finalPrompt: string = enhancedPrompt;

    // Nano Banana only (assistant image model)
    const model = ASSISTANT_IMAGE_MODEL;
    const input: Record<string, unknown> = {
      prompt: finalPrompt,
      aspect_ratio: ar,
      output_format: 'jpg',
    };
    
    if (hasAnyRef) {
      input.image_input = referenceUrls;
    }
    
    console.log('[Storyboard] Creating prediction:', model, hasAnyRef ? '(img2img)' : '(t2i)', 
      'Total refs:', referenceUrls.length);
    
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

/**
 * Poll for prediction completion and return the output URL
 * This is essential for sequential frame generation where we need the first frame URL
 * before generating the last frame.
 */
async function waitForPredictionComplete(
  predictionId: string, 
  maxWaitMs: number = 60000,
  pollIntervalMs: number = 2000
): Promise<{ status: string; outputUrl: string | null; error: string | null }> {
  const startTime = Date.now();
  const token = process.env.REPLICATE_API_TOKEN;
  
  if (!token) {
    return { status: 'failed', outputUrl: null, error: 'missing REPLICATE_API_TOKEN' };
  }
  
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      // Create AbortController for timeout handling on each poll
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout per poll
      
      const res = await fetch(`${REPLICATE_API}/predictions/${encodeURIComponent(predictionId)}`, {
        headers: { Authorization: `Token ${token}` },
        cache: 'no-store',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      consecutiveErrors = 0; // Reset error counter on successful request
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[waitForPrediction] HTTP ${res.status} for ${predictionId}:`, errorText);
        
        // For 4xx errors, don't keep retrying
        if (res.status >= 400 && res.status < 500) {
          return { status: 'failed', outputUrl: null, error: `HTTP ${res.status}: ${errorText}` };
        }
        
        await delay(pollIntervalMs);
        continue;
      }
      
      const json: any = await res.json();
      const status = String(json.status || '');
      
      console.log(`[waitForPrediction] ${predictionId} status: ${status}`);
      
      if (status === 'succeeded') {
        let outputUrl: string | null = null;
        const out = json.output;
        if (typeof out === 'string') outputUrl = out;
        else if (Array.isArray(out)) outputUrl = typeof out[0] === 'string' ? out[0] : null;
        else if (out && typeof out === 'object' && typeof out.url === 'string') outputUrl = out.url;
        
        console.log(`[waitForPrediction] ${predictionId} succeeded, outputUrl:`, outputUrl?.substring(0, 50));
        return { status, outputUrl, error: null };
      }
      
      if (status === 'failed' || status === 'canceled') {
        const error = json.error || json.logs || 'Prediction failed';
        console.error(`[waitForPrediction] ${predictionId} ${status}:`, error);
        return { status, outputUrl: null, error };
      }
      
      // Still processing, wait and poll again
      await delay(pollIntervalMs);
      
    } catch (e: any) {
      consecutiveErrors++;
      const errorMessage = e.name === 'AbortError' 
        ? 'Poll request timed out' 
        : `Network error: ${e.message}`;
      
      console.error(`[waitForPrediction] ${errorMessage} for ${predictionId} (error ${consecutiveErrors}/${maxConsecutiveErrors})`);
      
      // If we've had too many consecutive errors, give up
      if (consecutiveErrors >= maxConsecutiveErrors) {
        return { 
          status: 'failed', 
          outputUrl: null, 
          error: `Too many consecutive polling errors: ${errorMessage}` 
        };
      }
      
      // Exponential backoff for retries
      await delay(pollIntervalMs * Math.pow(2, Math.min(consecutiveErrors, 4)));
    }
  }
  
  return { status: 'timeout', outputUrl: null, error: `Prediction ${predictionId} timed out after ${maxWaitMs}ms` };
}

// Execute video generation tool - Generate videos from a completed storyboard
async function executeVideoGeneration(input: VideoGenerationInput): Promise<{ success: boolean; output?: { storyboard: Storyboard }; error?: string }> {
  try {
    const { storyboard_id, scenes_to_generate, video_model = 'google/veo-3.1-fast', resolution = '720p' } = input;
    
    // For now, return an error indicating this functionality needs to be implemented
    // This will be handled by the streaming logic in the route handler
    return {
      success: false,
      error: 'Video generation should be handled by streaming logic, not this function'
    };
  } catch (e: any) {
    console.error('Video generation error:', e);
    return { success: false, error: e.message };
  }
}

// Execute storyboard creation tool - Enhanced version with TRULY SEQUENTIAL frame generation
// Key improvements:
// 1. Frames generated ONE BY ONE in strict order: Scene 1 Frame 1 → Scene 1 Frame 2 → Scene 2 Frame 1 → ...
// 2. Each frame WAITS for completion before starting the next
// 3. First frame of scene N uses: previous scene's last frame + avatar as inputs (up to 14 images)
// 4. Last frame of scene N uses: scene N's first frame as input
// 5. Image Registry tracks all generated images for easy reference
// 6. Product image support for consistent product appearance
async function executeStoryboardCreation(
  input: StoryboardCreationInput,
  ctx: { origin: string; conversationId: string },
  streamController?: ReadableStreamDefaultController<Uint8Array>,
  encoder?: TextEncoder
): Promise<{ success: boolean; output?: { storyboard: Storyboard; imageRegistry?: ImageRegistry }; error?: string }> {
  try {
    const storyboardId = crypto.randomUUID();
    const startedAt = Date.now();
    // Safety budget: allow more time since we're doing sequential generation with waits
    const timeBudgetMs = 7 * 60 * 1000; // 7 minutes for sequential generation
    
    // Initialize image registry
    let imageRegistry = createEmptyRegistry();
    
    // Avatar reference URL and description for image-to-image consistency
    const avatarUrl = input.avatar_image_url;
    const avatarDescription = input.avatar_description;
    
    // Product image URL and description for product consistency
    const productUrl = input.product_image_url;
    const productDescription = input.product_image_description || input.product_description;
    
    console.log('[Storyboard] Starting SEQUENTIAL multi-call storyboard creation:', {
      title: input.title,
      avatarUrl: avatarUrl ? avatarUrl.substring(0, 50) + '...' : 'none',
      avatarDescription: avatarDescription || 'none',
      productUrl: productUrl ? productUrl.substring(0, 50) + '...' : 'none',
      productDescription: productDescription || 'none',
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
    let creativeBrief: any | undefined;

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
      // Phase 0: creative ideation (brand designer / CD brief)
      const ideationParts: string[] = [];
      ideationParts.push(`TITLE: ${input.title}`);
      if (input.brand_name) ideationParts.push(`BRAND: ${input.brand_name}`);
      if (input.product) ideationParts.push(`PRODUCT: ${input.product}`);
      if (input.product_description) ideationParts.push(`PRODUCT_DESCRIPTION: ${input.product_description}`);
      if (input.target_audience) ideationParts.push(`TARGET_AUDIENCE: ${input.target_audience}`);
      if (input.platform) ideationParts.push(`PLATFORM: ${input.platform}`);
      if (input.total_duration_seconds) ideationParts.push(`TOTAL_DURATION_SECONDS: ${input.total_duration_seconds}`);
      if (input.style) ideationParts.push(`STYLE_HINT: ${input.style}`);
      ideationParts.push(`ASPECT_RATIO: ${input.aspect_ratio || DEFAULT_IMAGE_ASPECT_RATIO}`);
      if (Array.isArray(input.key_benefits) && input.key_benefits.length) ideationParts.push(`KEY_BENEFITS: ${input.key_benefits.join('; ')}`);
      if (Array.isArray(input.pain_points) && input.pain_points.length) ideationParts.push(`PAIN_POINTS: ${input.pain_points.join('; ')}`);
      if (input.call_to_action) ideationParts.push(`CTA: ${input.call_to_action}`);
      if (input.creative_direction) ideationParts.push(`CREATIVE_DIRECTION: ${input.creative_direction}`);
      if (avatarDescription) ideationParts.push(`AVATAR_DESCRIPTION: ${avatarDescription}`);
      if (productDescription) ideationParts.push(`PRODUCT_VISUAL_DESCRIPTION: ${productDescription}`);
      ideationParts.push('Create an ownable concept + visual style guide + per-scene design notes.');

      creativeBrief = await callClaudeJson<any>({
        prompt: ideationParts.join('\n'),
        system_prompt: CREATIVE_IDEATION_PROMPT,
        max_tokens: 1400,
      });

      const scenarioPromptParts: string[] = [];
      scenarioPromptParts.push(`CREATIVE_BRIEF:`);
      scenarioPromptParts.push(JSON.stringify(creativeBrief || {}, null, 2));
      scenarioPromptParts.push('');
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
    
    // Build scenes with TRULY SEQUENTIAL frame generation
    // Order: Scene 1 First Frame → (wait) → Scene 1 Last Frame → (wait) → Scene 2 First Frame → ...
    // This ensures each frame can use previous frames as input references
    const scenesWithPredictions: StoryboardScene[] = [];
    
    // Track the previous scene's last frame URL for smooth transitions
    let prevSceneLastFrameUrl: string | undefined;
    
    // Helper to send streaming updates if controller is available
    const sendStreamUpdate = (message: string) => {
      if (streamController && encoder) {
        try {
          streamController.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response_chunk', data: message })}\n\n`));
        } catch {
          // Ignore if stream is closed
        }
      }
    };
    
    // Helper to send storyboard update event
    const sendStoryboardUpdate = (messageId: string, storyboard: Storyboard) => {
      if (streamController && encoder) {
        try {
          streamController.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'video_generation_update',
            data: { message_id: messageId, storyboard }
          })}\n\n`));
        } catch {
          // Ignore if stream is closed
        }
      }
    };

    let previousRefined: StoryboardScene | undefined;
    for (const outline of outlines) {
      if (Date.now() - startedAt > timeBudgetMs) {
        console.warn('[Storyboard] Time budget exceeded; returning remaining scenes as placeholders', {
          elapsedMs: Date.now() - startedAt,
          remainingScene: outline.scene_number,
        });
        scenesWithPredictions.push({
          scene_number: outline.scene_number,
          scene_name: outline.scene_name,
          description: outline.purpose,
          duration_seconds: outline.duration_seconds,
          scene_type: outline.scene_type,
          uses_avatar: Boolean(outline.needs_avatar),
          needs_user_details: true,
          user_question: 'Storyboard is taking longer than expected. Reply “continue storyboard” to finish generating remaining frames.',
          first_frame_prompt: `PENDING: ${outline.scene_name} — ${outline.purpose}`,
          first_frame_visual_elements: [],
          last_frame_prompt: `PENDING: ${outline.scene_name} — ${outline.purpose}`,
          last_frame_visual_elements: [],
          video_generation_prompt: 'PENDING',
          first_frame_status: 'pending',
          last_frame_status: 'pending',
          needs_product_image: Boolean(outline.needs_product_image || outline.scene_type === 'product_showcase'),
          use_prev_scene_transition: false,
        });
        continue;
      }
      const usesAvatar = Boolean(outline.needs_avatar);
      const useAvatarReference = Boolean(avatarUrl && usesAvatar);
      const needsProductImage = Boolean(outline.needs_product_image || outline.scene_type === 'product_showcase');
      const usePrevSceneTransition = Boolean(outline.use_prev_scene_transition && prevSceneLastFrameUrl);

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
          needs_product_image: needsProductImage,
          use_prev_scene_transition: false,
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
          needs_product_image: needsProductImage,
          use_prev_scene_transition: false,
        });
        continue;
      }

      // Phase 2: refine scene in an individual LLM call
      const refinementPrompt = [
        `CREATIVE_BRIEF:`,
        JSON.stringify(creativeBrief || {}, null, 2),
        ``,
        `SCENARIO:`,
        JSON.stringify(scenario || {}, null, 2),
        ``,
        `SCENE_OUTLINE:`,
        JSON.stringify(outline, null, 2),
        ``,
        `BRAND: ${input.brand_name || ''}`,
        `PRODUCT: ${input.product || ''}`,
        `PRODUCT_DESCRIPTION: ${productDescription || ''}`,
        `STYLE: ${input.style || ''}`,
        `ASPECT_RATIO: ${input.aspect_ratio || ''}`,
        `AVATAR_DESCRIPTION: ${usesAvatar ? (avatarDescription || '(use avatar image reference)') : 'NO AVATAR'}`,
        `NEEDS_PRODUCT_IMAGE: ${needsProductImage}`,
        `USE_PREV_SCENE_TRANSITION: ${usePrevSceneTransition}`,
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
        needsProductImage,
        usePrevSceneTransition,
        hasPrompts: Boolean(firstPrompt && lastPrompt),
      });

      // =================================================================
      // FRAME GENERATION (TRULY SEQUENTIAL - BLOCKING WAITS)
      // =================================================================
      //
      // Nano Banana accepts up to 14 input images, making it ideal for reference chaining.
      // We generate frames ONE BY ONE with blocking waits:
      // 1. First Frame: Uses previous scene's last frame + avatar + product as inputs
      // 2. Wait for first frame to complete
      // 3. Last Frame: Uses this scene's first frame as input
      // 4. Wait for last frame to complete
      // 5. Store URLs for next scene's first frame reference
      //
      // =================================================================
      
      sendStreamUpdate(`\n🎬 **Scene ${outline.scene_number}: ${outline.scene_name}**\n`);
      
      // =================================================================
      // AI REFLEXION: Select optimal reference images for first frame
      // =================================================================
      sendStreamUpdate(`  🧠 AI analyzing available images for optimal references...\n`);
      
      const firstFrameReferences = await getImageReferenceReflexion({
        frameType: 'first',
        sceneNumber: outline.scene_number,
        sceneName: outline.scene_name,
        sceneDescription: String(refined.description || outline.purpose || ''),
        framePrompt: safeFirst,
        imageRegistry,
        storyboardId,
        avatarUrl,
        productUrl,
        usesAvatar,
        needsProduct: needsProductImage,
        usePrevSceneTransition,
        replicate,
      });
      
      console.log(`[Storyboard] Scene ${outline.scene_number}: AI selected ${firstFrameReferences.length} reference images for first frame`);
      sendStreamUpdate(`  ✓ Selected ${firstFrameReferences.length} reference images\n`);
      
      // =================================================================
      // STEP 1: Generate FIRST FRAME and WAIT for completion
      // =================================================================
      sendStreamUpdate(`  📸 Generating first frame with ${firstFrameReferences.length} reference images...`);
      console.log(`[Storyboard] Scene ${outline.scene_number}: Generating FIRST FRAME (sequential) with ${firstFrameReferences.length} references...`);
      
      const firstFramePrediction = await generateSingleImage(
        safeFirst,
        input.aspect_ratio,
        undefined, // Legacy references not used
        firstFrameReferences // AI-selected references
      );
      
      let firstFrameStatus: 'pending' | 'generating' | 'succeeded' | 'failed' = 'failed';
      let firstFrameError: string | undefined;
      let firstFrameUrl: string | undefined;
      let firstFrameRawUrl: string | undefined;
      
      if (firstFramePrediction?.id) {
        firstFrameStatus = 'generating';
        
        // Register the first frame in the image registry
        const { registry: reg1, imageId: firstFrameImageId } = registerImage(imageRegistry, {
          predictionId: firstFramePrediction.id,
          status: 'generating',
          type: 'scene_first_frame',
          prompt: safeFirst,
          aspectRatio: input.aspect_ratio,
          storyboardId,
          sceneNumber: outline.scene_number,
          sceneName: outline.scene_name,
          framePosition: 'first',
          inputReferenceIds: firstFrameReferences.length > 0 ? [] : undefined, // Would track reference IDs if needed
        });
        imageRegistry = reg1;
        
        // WAIT for first frame to complete (up to 90 seconds per frame)
        console.log(`[Storyboard] Scene ${outline.scene_number}: Waiting for first frame ${firstFramePrediction.id}...`);
        const firstFrameResult = await waitForPredictionComplete(firstFramePrediction.id, 90000, 2500);
        
        if (firstFrameResult.outputUrl) {
          // Cache to R2 for stable URL
          const cached = await maybeCacheImageToR2({
            sourceUrl: firstFrameResult.outputUrl,
            conversationId: ctx.conversationId,
            origin: ctx.origin,
            type: 'frame',
          });
          
          firstFrameUrl = cached.url;
          firstFrameRawUrl = firstFrameResult.outputUrl;
          firstFrameStatus = 'succeeded';
          
          // Update registry
          imageRegistry = updateRegisteredImage(imageRegistry, firstFrameImageId, {
            url: firstFrameUrl,
            rawUrl: firstFrameRawUrl,
            status: 'succeeded',
          });
          
          sendStreamUpdate(` ✅\n`);
          console.log(`[Storyboard] Scene ${outline.scene_number}: First frame COMPLETE: ${firstFrameUrl?.substring(0, 50)}...`);
        } else {
          firstFrameStatus = 'failed';
          firstFrameError = firstFrameResult.error || 'First frame generation failed or timed out';
          
          // Update registry
          imageRegistry = updateRegisteredImage(imageRegistry, firstFrameImageId, {
            status: 'failed',
            error: firstFrameError,
          });
          
          sendStreamUpdate(` ❌ (${firstFrameError})\n`);
          console.error(`[Storyboard] Scene ${outline.scene_number}: First frame FAILED:`, firstFrameError);
        }
      } else {
        firstFrameError = firstFramePrediction?.error || 'Failed to start first frame generation';
        sendStreamUpdate(` ❌ (${firstFrameError})\n`);
      }
      
      // =================================================================
      // STEP 2: Generate LAST FRAME using first frame as reference
      // =================================================================
      let lastFrameStatus: 'pending' | 'generating' | 'succeeded' | 'failed' = 'pending';
      let lastFrameError: string | undefined;
      let lastFrameUrl: string | undefined;
      let lastFrameRawUrl: string | undefined;
      let lastFramePredictionId: string | undefined;
      
      // Only generate last frame if first frame succeeded
      if (firstFrameUrl && firstFrameStatus === 'succeeded') {
        // =================================================================
        // AI REFLEXION: Select optimal reference images for last frame
        // =================================================================
        sendStreamUpdate(`  🧠 AI analyzing images for last frame...\n`);
        
        const lastFrameReferences = await getImageReferenceReflexion({
          frameType: 'last',
          sceneNumber: outline.scene_number,
          sceneName: outline.scene_name,
          sceneDescription: String(refined.description || outline.purpose || ''),
          framePrompt: safeLast,
          imageRegistry,
          storyboardId,
          avatarUrl,
          productUrl,
          usesAvatar,
          needsProduct: needsProductImage,
          usePrevSceneTransition: false, // Last frames don't use prev scene transition
          replicate,
        });
        
        console.log(`[Storyboard] Scene ${outline.scene_number}: AI selected ${lastFrameReferences.length} reference images for last frame`);
        sendStreamUpdate(`  ✓ Selected ${lastFrameReferences.length} reference images\n`);
        sendStreamUpdate(`  📸 Generating last frame with ${lastFrameReferences.length} reference images...`);
        console.log(`[Storyboard] Scene ${outline.scene_number}: Generating LAST FRAME with ${lastFrameReferences.length} references...`);
        
        const lastFramePrediction = await generateSingleImage(
          safeLast,
          input.aspect_ratio,
          undefined, // Legacy references not used
          lastFrameReferences // AI-selected references
        );
        
        if (lastFramePrediction?.id) {
          lastFramePredictionId = lastFramePrediction.id;
          lastFrameStatus = 'generating';
          
          // Register the last frame in the image registry
          const { registry: reg2, imageId: lastFrameImageId } = registerImage(imageRegistry, {
            predictionId: lastFramePrediction.id,
            status: 'generating',
            type: 'scene_last_frame',
            prompt: safeLast,
            aspectRatio: input.aspect_ratio,
            storyboardId,
            sceneNumber: outline.scene_number,
            sceneName: outline.scene_name,
            framePosition: 'last',
          });
          imageRegistry = reg2;
          
          // WAIT for last frame to complete
          console.log(`[Storyboard] Scene ${outline.scene_number}: Waiting for last frame ${lastFramePrediction.id}...`);
          const lastFrameResult = await waitForPredictionComplete(lastFramePrediction.id, 90000, 2500);
          
          if (lastFrameResult.outputUrl) {
            // Cache to R2 for stable URL
            const cached = await maybeCacheImageToR2({
              sourceUrl: lastFrameResult.outputUrl,
              conversationId: ctx.conversationId,
              origin: ctx.origin,
              type: 'frame',
            });
            
            lastFrameUrl = cached.url;
            lastFrameRawUrl = lastFrameResult.outputUrl;
            lastFrameStatus = 'succeeded';
            
            // Update registry
            imageRegistry = updateRegisteredImage(imageRegistry, lastFrameImageId, {
              url: lastFrameUrl,
              rawUrl: lastFrameRawUrl,
              status: 'succeeded',
            });
            
            // Store this last frame URL for the NEXT scene's first frame
            prevSceneLastFrameUrl = lastFrameUrl;
            
            sendStreamUpdate(` ✅\n`);
            console.log(`[Storyboard] Scene ${outline.scene_number}: Last frame COMPLETE: ${lastFrameUrl?.substring(0, 50)}...`);
          } else {
            lastFrameStatus = 'failed';
            lastFrameError = lastFrameResult.error || 'Last frame generation failed or timed out';
            
            // Update registry
            imageRegistry = updateRegisteredImage(imageRegistry, lastFrameImageId, {
              status: 'failed',
              error: lastFrameError,
            });
            
            sendStreamUpdate(` ❌ (${lastFrameError})\n`);
            console.error(`[Storyboard] Scene ${outline.scene_number}: Last frame FAILED:`, lastFrameError);
          }
        } else {
          lastFrameStatus = 'failed';
          lastFrameError = lastFramePrediction?.error || 'Failed to start last frame generation';
          sendStreamUpdate(` ❌ (${lastFrameError})\n`);
        }
      } else if (firstFrameStatus === 'failed') {
        lastFrameStatus = 'failed';
        lastFrameError = 'Cannot generate last frame: first frame generation failed';
      }

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
        // Now populated with actual URLs from sequential generation
        first_frame_prediction_id: firstFramePrediction?.id || undefined,
        last_frame_prediction_id: lastFramePredictionId,
        first_frame_url: firstFrameUrl,
        last_frame_url: lastFrameUrl,
        first_frame_raw_url: firstFrameRawUrl,
        last_frame_raw_url: lastFrameRawUrl,
        first_frame_status: firstFrameStatus,
        last_frame_status: lastFrameStatus,
        first_frame_error: firstFrameError,
        last_frame_error: lastFrameError,
        needs_product_image: needsProductImage,
        use_prev_scene_transition: usePrevSceneTransition,
      };

      scenesWithPredictions.push(sceneOut);
      previousRefined = sceneOut;
      
      // Small delay between scenes to reduce burstiness
      await delay(200);
    }
    
    // Identify which scenes need product image
    const scenesNeedingProduct = scenesWithPredictions
      .filter(s => s.needs_product_image)
      .map(s => s.scene_number);
    
    // Determine overall status
    const allFramesSucceeded = scenesWithPredictions.every(
      s => s.first_frame_status === 'succeeded' && s.last_frame_status === 'succeeded'
    );
    const anyFrameFailed = scenesWithPredictions.some(
      s => s.first_frame_status === 'failed' || s.last_frame_status === 'failed'
    );
    const anyFrameGenerating = scenesWithPredictions.some(
      s => s.first_frame_status === 'generating' || s.last_frame_status === 'generating'
    );
    
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
      product_image_url: input.product_image_url,
      product_image_description: productDescription,
      scenario,
      scenes: scenesWithPredictions,
      created_at: new Date().toISOString(),
      status: allFramesSucceeded ? 'ready' : (anyFrameFailed && !anyFrameGenerating) ? 'failed' : 'generating',
      scenes_needing_product: scenesNeedingProduct.length > 0 ? scenesNeedingProduct : undefined,
    };
    
    // Log final status
    const successfulScenes = scenesWithPredictions.filter(
      s => s.first_frame_status === 'succeeded' && s.last_frame_status === 'succeeded'
    ).length;
    sendStreamUpdate(`\n✨ **Storyboard Complete**: ${successfulScenes}/${scenesWithPredictions.length} scenes with all frames ready\n`);
    
    console.log(`[Storyboard] Sequential generation complete:`, {
      storyboardId,
      totalScenes: scenesWithPredictions.length,
      successfulScenes,
      registryImages: Object.keys(imageRegistry.images).length,
      elapsedMs: Date.now() - startedAt,
    });
    
    return {
      success: true,
      output: { storyboard, imageRegistry }
    };
  } catch (e: any) {
    console.error('Storyboard creation error:', e);
    return { success: false, error: e.message };
  }
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const origin = new URL(req.url).origin;
  
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
  const avatarCandidate = await getLastAvatarFromConversation(existingMessages, { conversationId: String(conversationId || ''), origin });
  const userConfirmedAvatar = isAvatarConfirmation(body.message);
  const confirmedAvatarUrl = userConfirmedAvatar && avatarCandidate?.url && isHttpUrl(avatarCandidate.url) ? avatarCandidate.url : undefined;
  const confirmedAvatarDescription = userConfirmedAvatar ? avatarCandidate?.description : undefined;
  const confirmedAvatarPredictionId = userConfirmedAvatar ? avatarCandidate?.predictionId : undefined;
  const confirmedAvatarStatus = userConfirmedAvatar ? avatarCandidate?.status : undefined;

  // Check if user is confirming product image usage
  const productCandidate = await getLastProductFromConversation(existingMessages, { conversationId: String(conversationId || ''), origin });
  const userConfirmedProduct = isProductImageConfirmation(body.message);
  const confirmedProductUrl = userConfirmedProduct && productCandidate?.url && isHttpUrl(productCandidate.url) ? productCandidate.url : undefined;
  const confirmedProductDescription = userConfirmedProduct ? productCandidate?.description : undefined;
  const confirmedProductPredictionId = userConfirmedProduct ? productCandidate?.predictionId : undefined;

    // Read previously selected avatar from plan (server-side persisted)
    const planSelectedAvatarUrl =
      typeof existingPlan?.selected_avatar?.url === 'string' && isHttpUrl(existingPlan.selected_avatar.url)
        ? String(existingPlan.selected_avatar.url).trim()
        : undefined;
    const planSelectedAvatarDescription =
      typeof existingPlan?.selected_avatar?.description === 'string'
        ? String(existingPlan.selected_avatar.description)
        : undefined;

    // Read previously selected product from plan (server-side persisted)
    const planSelectedProductUrl =
      typeof existingPlan?.selected_product?.url === 'string' && isHttpUrl(existingPlan.selected_product.url)
        ? String(existingPlan.selected_product.url).trim()
        : undefined;
    const planSelectedProductDescription =
      typeof existingPlan?.selected_product?.description === 'string'
        ? String(existingPlan.selected_product.description)
        : undefined;

    // If user confirmed avatar, persist selection server-side
    let selectedAvatarUrl: string | undefined = planSelectedAvatarUrl;
    let selectedAvatarDescription: string | undefined = planSelectedAvatarDescription;
    if (userConfirmedAvatar && confirmedAvatarUrl) {
      const cached = await maybeCacheAvatarToR2({ sourceUrl: confirmedAvatarUrl, conversationId: String(conversationId), origin });
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

    // If user confirmed product, persist selection server-side
    let selectedProductUrl: string | undefined = planSelectedProductUrl;
    let selectedProductDescription: string | undefined = planSelectedProductDescription;
    if (userConfirmedProduct && confirmedProductUrl) {
      const cached = await maybeCacheImageToR2({ sourceUrl: confirmedProductUrl, conversationId: String(conversationId), origin, type: 'product' });
      selectedProductUrl = cached.url;
      selectedProductDescription = confirmedProductDescription || selectedProductDescription;
      const nextPlan = {
        ...(existingPlan || {}),
        selected_product: {
          url: selectedProductUrl,
          prediction_id: confirmedProductPredictionId,
          description: confirmedProductDescription,
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
    
    // Build context blocks for avatar and product images
    let contextBlock = '';
    
    // Avatar context
    if (selectedAvatarUrl) {
      contextBlock += `
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
      // Prefer server-resolved/cached avatarCandidate (may include R2 URL even if client hasn't polled yet)
      const avatarUrlCandidate = avatarCandidate?.url || extractAvatarContextFromMessages(existingMessages)?.url;
      const avatarDescCandidate = avatarCandidate?.description || extractAvatarContextFromMessages(existingMessages)?.description;
      if (avatarUrlCandidate) {
        contextBlock += `
═══════════════════════════════════════════════════════════════════════════
📷 AVATAR IMAGE GENERATED (awaiting confirmation)
═══════════════════════════════════════════════════════════════════════════
Avatar Image URL: ${avatarUrlCandidate}
${avatarDescCandidate ? `Avatar Description: ${avatarDescCandidate}` : ''}

NOTE: The user has NOT yet confirmed this avatar. Wait for them to say "Use this avatar" before proceeding with storyboard creation.
═══════════════════════════════════════════════════════════════════════════

`;
      }
    }
    
    // Product image context
    if (selectedProductUrl) {
      contextBlock += `
═══════════════════════════════════════════════════════════════════════════
📦 CONFIRMED PRODUCT IMAGE FOR THIS VIDEO
═══════════════════════════════════════════════════════════════════════════
Product Image URL: ${selectedProductUrl}
${selectedProductDescription ? `Product Description: ${selectedProductDescription}` : 'Product Description: (Use the image URL as visual reference)'}

CRITICAL INSTRUCTIONS FOR STORYBOARD GENERATION:
- You MUST use this exact product image for all scenes with needs_product_image=true
- Mark scenes that display the product with needs_product_image: true
- The product will be rendered IDENTICALLY across all product scenes
- Include "Same product from reference," when describing the product in prompts
═══════════════════════════════════════════════════════════════════════════

`;
    } else if (productCandidate?.url) {
      contextBlock += `
═══════════════════════════════════════════════════════════════════════════
📦 PRODUCT IMAGE GENERATED (awaiting confirmation)
═══════════════════════════════════════════════════════════════════════════
Product Image URL: ${productCandidate.url}
${productCandidate.description ? `Product Description: ${productCandidate.description}` : ''}

NOTE: The user has NOT yet confirmed this product image. Wait for them to say "Use this product image" before proceeding.
═══════════════════════════════════════════════════════════════════════════

`;
    }
    
    const avatarContextBlock = contextBlock;
    
    const fullPrompt = avatarContextBlock + (conversationContext 
      ? `Previous conversation:\n${conversationContext}\n\nUser: ${body.message}`
      : body.message);
    
    const replicate = new Replicate({ auth: replicateToken });
    
    // Create streaming response
    const readable = new ReadableStream({
      async start(controller) {
        let heartbeat: ReturnType<typeof setInterval> | null = null;
        try {
          // Heartbeat to keep intermediaries/browser from treating the stream as idle.
          // (Helps reduce flaky HTTP/2/SSE disconnects in the real world.)
          heartbeat = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
            } catch {
              // ignore
            }
          }, 15000);

          // ---------------------------------------------------------------------------
          // Storyboard post-step gate: if we are awaiting user choice, handle proceed
          // ---------------------------------------------------------------------------
          const pendingStoryboardId =
            typeof existingPlan?.pending_storyboard_action?.storyboard_id === 'string'
              ? String(existingPlan.pending_storyboard_action.storyboard_id)
              : null;

          if (pendingStoryboardId && userWantsToProceed(body.message)) {
            const storyboard = extractLatestStoryboard(existingMessages);
            if (!storyboard || storyboard.id !== pendingStoryboardId) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response_chunk', data: 'I could not find the storyboard you want to proceed with. Please regenerate the storyboard, then say "proceed".' })}\n\n`));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
              controller.close();
              return;
            }

            // Normalize internal asset URLs so Replicate/VEO can always fetch them.
            // We accept:
            // - https://<site>/api/r2/get?key=...   (our stable proxy)
            // - https://pub-<acct>.r2.dev/<key>    (R2 public base)
            // - https://<site>/r2/<key>            (legacy)
            // We'll convert to https://<site>/api/r2/get?key=<key> when possible, and verify it is fetchable.
            const appOriginForAssets = (process.env.NEXT_PUBLIC_APP_URL?.trim() || origin).replace(/\/$/, '');
            function extractKeyFromKnownUrl(u: string): string | null {
              try {
                const url = new URL(u);
                if (url.pathname === '/api/r2/get') {
                  const k = url.searchParams.get('key');
                  return k ? k.trim().replace(/^\/+/, '') : null;
                }
                if (url.pathname.startsWith('/r2/')) {
                  const k = url.pathname.replace(/^\/r2\//, '').trim();
                  return k ? k.replace(/^\/+/, '') : null;
                }
                if (url.hostname.endsWith('.r2.dev')) {
                  const k = url.pathname.replace(/^\/+/, '').trim();
                  return k ? k : null;
                }
                return null;
              } catch {
                return null;
              }
            }
            function toProxyUrl(u: string): string {
              const k = extractKeyFromKnownUrl(u);
              if (!k) return u;
              return `${appOriginForAssets}/api/r2/get?key=${encodeURIComponent(k)}`;
            }
            async function verifyFetchable(u: string): Promise<boolean> {
              try {
                const head = await fetch(u, { method: 'HEAD', cache: 'no-store' });
                if (head.ok) return true;
              } catch {}
              try {
                const get = await fetch(u, { method: 'GET', headers: { Range: 'bytes=0-0' }, cache: 'no-store' });
                return get.status >= 200 && get.status < 400;
              } catch {
                return false;
              }
            }

            // Check if frames are still generating
            const scenesWithPendingFrames = storyboard.scenes.filter(s => {
              const firstNotReady = s.first_frame_prediction_id && !s.first_frame_url;
              const lastNotReady = s.last_frame_prediction_id && !s.last_frame_url;
              const lastNeedsCreate = !s.last_frame_prediction_id && !s.last_frame_url && Boolean(s.first_frame_url) && Boolean(s.last_frame_prompt);
              return firstNotReady || lastNotReady || lastNeedsCreate;
            });

            // If frames are still generating, poll for completion with timeout
            if (scenesWithPendingFrames.length > 0) {
              const tokenStr = String(replicateToken);
              console.log(`[Storyboard Proceed] ${scenesWithPendingFrames.length} scenes have pending frames, polling...`);
              
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'conversation_id', data: conversationId })}\n\n`));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response_start' })}\n\n`));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response_chunk', data: `I see some storyboard frames are still generating. Let me check their status...\n\n` })}\n\n`));

              // Poll each pending frame with a reasonable timeout (max 60s total)
              const maxPollTime = 60_000;
              const pollStart = Date.now();
              let allReady = false;
              
              while (Date.now() - pollStart < maxPollTime) {
                let anyPending = false;
                
                for (const scene of scenesWithPendingFrames) {
                  // Check first frame
                  if (scene.first_frame_prediction_id && !scene.first_frame_url) {
                    const result = await checkPredictionStatus(tokenStr, scene.first_frame_prediction_id);
                    if (result.outputUrl) {
                      const cached = await maybeCacheImageToR2({
                        sourceUrl: result.outputUrl,
                        conversationId: String(conversationId),
                        origin,
                        type: 'frame',
                      });
                      // Update storyboard in messages with the URL (prefer our stable R2 proxy)
                      scene.first_frame_url = cached.url;
                      scene.first_frame_status = 'succeeded';
                    } else if (result.status === 'failed' || result.status === 'canceled') {
                      scene.first_frame_status = 'failed';
                      scene.first_frame_error = result.error || 'Frame generation failed';
                    } else {
                      anyPending = true;
                    }
                  }

                  // If first frame is ready but we haven't created the last frame prediction yet,
                  // create it now using the FIRST FRAME URL as the input reference.
                  if (!scene.last_frame_prediction_id && !scene.last_frame_url && scene.first_frame_url && scene.last_frame_prompt) {
                    const lp = String(scene.last_frame_prompt || '').trim();
                    // Avoid creating for placeholder/user-input scenes
                    if (lp && !lp.startsWith('NEEDS USER INPUT') && !lp.startsWith('PENDING:')) {
                      try {
                        const refs: ReferenceImages = { firstFrameUrl: scene.first_frame_url };
                        const pred = await generateSingleImage(lp, storyboard.aspect_ratio, refs);
                        if (pred?.id) {
                          scene.last_frame_prediction_id = pred.id;
                          scene.last_frame_status = 'generating';
                          anyPending = true;
                        } else {
                          scene.last_frame_status = 'failed';
                          scene.last_frame_error = pred?.error || 'Failed to start last frame generation';
                        }
                      } catch (e: any) {
                        scene.last_frame_status = 'failed';
                        scene.last_frame_error = e?.message || 'Failed to start last frame generation';
                      }
                    }
                  }
                  
                  // Check last frame
                  if (scene.last_frame_prediction_id && !scene.last_frame_url) {
                    const result = await checkPredictionStatus(tokenStr, scene.last_frame_prediction_id);
                    if (result.outputUrl) {
                      const cached = await maybeCacheImageToR2({
                        sourceUrl: result.outputUrl,
                        conversationId: String(conversationId),
                        origin,
                        type: 'frame',
                      });
                      scene.last_frame_url = cached.url;
                      scene.last_frame_status = 'succeeded';
                    } else if (result.status === 'failed' || result.status === 'canceled') {
                      scene.last_frame_status = 'failed';
                      scene.last_frame_error = result.error || 'Frame generation failed';
                    } else {
                      anyPending = true;
                    }
                  }
                }
                
                if (!anyPending) {
                  allReady = true;
                  break;
                }
                
                // Wait before next poll
                await delay(2000);
              }

              if (!allReady) {
                const waitMsg = `⏳ Some storyboard frames are still generating. This can take 30-60 seconds.\n\nYou can:\n- Wait a moment and say "proceed" again\n- Or check the frames above - they'll appear as they complete`;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response_chunk', data: waitMsg })}\n\n`));
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
                controller.close();
                return;
              }

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response_chunk', data: `✅ All frames are ready! Starting video generation...\n\n` })}\n\n`));
            } else {
              // Send conversation id first (client expects this sometimes)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'conversation_id', data: conversationId })}\n\n`));

              // Emit an initial assistant response message (non-LLM path)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response_start' })}\n\n`));
            }
            
            const proceedText = `Perfect! I'll now generate videos from your storyboard using the video_generation tool with VEO 3.1 Fast (which includes audio output). I'll use the first frame image and incorporate the last frame information into the prompt to guide the motion between frames.`;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response_chunk', data: proceedText })}\n\n`));
            
            // Show the tool call
            const videoToolCall = {
              tool: 'video_generation',
              input: {
                storyboard_id: storyboard.id,
                quality_priority: 'quality',
                resolution: '720p'
              }
            };
            
            const toolCallText = `\n\n<tool_call>\n${JSON.stringify(videoToolCall, null, 2)}\n</tool_call>`;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response_chunk', data: toolCallText })}\n\n`));

            const videoMessageId = crypto.randomUUID();
            const model = 'google/veo-3.1-fast'; // Keep VEO 3.1 Fast for audio output support

            // Build a storyboard copy with video placeholders
            const nextStoryboard: Storyboard = {
              ...storyboard,
              status: 'generating',
              scenes: storyboard.scenes.map((s) => ({
                ...s,
                video_model: model,
                video_status: 'pending',
              })),
            };

            // Create a tool_result message placeholder for video generation and tell the client to render it
            const videoToolResultMessage: Message = {
              id: videoMessageId,
              role: 'tool_result',
              content: JSON.stringify({ storyboard_id: storyboard.id, status: 'generating' }, null, 2),
              timestamp: new Date().toISOString(),
              tool_name: 'video_generation',
              tool_output: { success: true, output: { storyboard: nextStoryboard } } as any,
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'tool_result',
              data: { tool: 'video_generation', result: { success: true, output: { storyboard: nextStoryboard }, message_id: videoMessageId } },
            })}\n\n`));

            // Launch predictions sequentially to show results one-by-one
            const tokenStr = String(replicateToken);
            for (let idx = 0; idx < nextStoryboard.scenes.length; idx++) {
              const scene = nextStoryboard.scenes[idx];
              const startImage = scene.first_frame_url;
              const endImage = scene.last_frame_url;
              const prompt = String(scene.video_generation_prompt || '').trim();

              if (!startImage || !/^https?:\/\//i.test(startImage)) {
                nextStoryboard.scenes[idx] = {
                  ...scene,
                  video_status: 'failed',
                  video_error: 'Missing or invalid first_frame_url. Please regenerate the frame.',
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'video_generation_update',
                  data: { message_id: videoMessageId, storyboard: nextStoryboard },
                })}\n\n`));
                continue;
              }

              if (!endImage || !/^https?:\/\//i.test(endImage)) {
                nextStoryboard.scenes[idx] = {
                  ...scene,
                  video_status: 'failed',
                  video_error: 'Missing or invalid last_frame_url. Please regenerate the frame.',
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'video_generation_update',
                  data: { message_id: videoMessageId, storyboard: nextStoryboard },
                })}\n\n`));
                continue;
              }

              // Normalize + verify both frame URLs are fetchable by Replicate
              const normalizedStartImage = toProxyUrl(startImage);
              const normalizedEndImage = toProxyUrl(endImage);

              const startOk = await verifyFetchable(normalizedStartImage);
              if (!startOk) {
                nextStoryboard.scenes[idx] = {
                  ...scene,
                  video_status: 'failed',
                  video_error: 'First frame URL is unreachable. Please regenerate or re-upload the frame.',
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'video_generation_update',
                  data: { message_id: videoMessageId, storyboard: nextStoryboard },
                })}\n\n`));
                continue;
              }

              const endOk = await verifyFetchable(normalizedEndImage);
              if (!endOk) {
                nextStoryboard.scenes[idx] = {
                  ...scene,
                  video_status: 'failed',
                  video_error: 'Last frame URL is unreachable. Please regenerate or re-upload the frame.',
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'video_generation_update',
                  data: { message_id: videoMessageId, storyboard: nextStoryboard },
                })}\n\n`));
                continue;
              }

              if (!prompt) {
                nextStoryboard.scenes[idx] = {
                  ...scene,
                  video_status: 'failed',
                  video_error: 'Missing video_generation_prompt for this scene.',
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'video_generation_update',
                  data: { message_id: videoMessageId, storyboard: nextStoryboard },
                })}\n\n`));
                continue;
              }

              // Warn if avatar scene is missing voiceover text
              const voiceoverText = scene.voiceover_text ? String(scene.voiceover_text).trim() : '';
              if (scene.uses_avatar && scene.scene_type === 'talking_head' && !voiceoverText) {
                console.warn(`[Video Generation] Scene ${scene.scene_number} is a talking head with avatar but missing voiceover_text. This may result in poor lip sync.`);
              }

              nextStoryboard.scenes[idx] = { ...scene, video_status: 'generating' };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'video_generation_update',
                data: { message_id: videoMessageId, storyboard: nextStoryboard },
              })}\n\n`));

              try {
                // Build comprehensive video generation prompt with all scene context
                const voiceoverText = scene.voiceover_text ? String(scene.voiceover_text).trim() : '';
                const lastFrameContext = scene.last_frame_visual_elements ? 
                  ` Target end state should show: ${scene.last_frame_visual_elements.join(', ')}` : '';
                
                // Create enhanced prompt with voiceover, motion, and visual context
                let enhancedPrompt =
                  `START_FRAME_URL (image input): ${normalizedStartImage}\n` +
                  `END_FRAME_URL (end_image input): ${normalizedEndImage}\n\n` +
                  `${prompt}${lastFrameContext}`;
                
                // Add voiceover context for lip sync and expressions
                if (voiceoverText && scene.uses_avatar) {
                  enhancedPrompt += ` DIALOGUE: The person is saying: "${voiceoverText}". Generate appropriate lip movements, facial expressions, and gestures that match the speech content. Sync mouth movements naturally with the spoken words.`;
                } else if (voiceoverText) {
                  enhancedPrompt += ` AUDIO CONTEXT: Scene includes voiceover: "${voiceoverText}". Generate visuals that complement and support this narrative.`;
                }
                
                // Add motion direction and timing
                enhancedPrompt += ` MOTION DIRECTION: Use the provided START frame (image) and END frame (end_image) to interpolate motion between them. Preserve identity, scene layout, lighting, and product placement. The output video should begin matching the start frame and end matching the end frame, with natural motion between.`;
                
                // Add scene-specific enhancements based on scene type
                if (scene.scene_type === 'talking_head' && scene.uses_avatar) {
                  enhancedPrompt += ` PERFORMANCE: Focus on natural talking head movement with authentic expressions, subtle head movements, and engaging eye contact with camera.`;
                } else if (scene.scene_type === 'product_showcase') {
                  enhancedPrompt += ` PRODUCT FOCUS: Highlight the product with smooth camera movement or hand gestures that draw attention to key features.`;
                } else if (scene.scene_type === 'demonstration') {
                  enhancedPrompt += ` DEMONSTRATION: Show clear, instructional movements that demonstrate the action or process described.`;
                }
                
                // Log the enhanced prompt for debugging
                console.log(`[Video Generation] Scene ${scene.scene_number} enhanced prompt:`, {
                  originalPrompt: prompt,
                  voiceoverText: voiceoverText,
                  hasVoiceover: Boolean(voiceoverText),
                  usesAvatar: scene.uses_avatar,
                  sceneType: scene.scene_type,
                  enhancedPromptLength: enhancedPrompt.length
                });
                
                const prediction = await createReplicatePrediction({
                  token: tokenStr,
                  model: model,
                  input: {
                    prompt: enhancedPrompt,
                    resolution: '720p',
                    // VEO start + end frame guidance
                    image: normalizedStartImage,
                    start_image: normalizedStartImage,
                    end_image: normalizedEndImage,
                  },
                });
                
                // Update scene with video model
                nextStoryboard.scenes[idx] = {
                  ...nextStoryboard.scenes[idx],
                  video_model: model,
                };
                nextStoryboard.scenes[idx] = {
                  ...nextStoryboard.scenes[idx],
                  video_prediction_id: prediction.id,
                  video_status: 'generating',
                };
              } catch (e: any) {
                nextStoryboard.scenes[idx] = {
                  ...nextStoryboard.scenes[idx],
                  video_status: 'failed',
                  video_error: e?.message || 'Failed to start video generation',
                };
              }

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'video_generation_update',
                data: { message_id: videoMessageId, storyboard: nextStoryboard },
              })}\n\n`));
            }

            // Persist: clear pending_storyboard_action, and save messages including the video tool result message.
            // Ensure we store the final storyboard snapshot (with prediction ids / errors)
            (videoToolResultMessage.tool_output as any) = { success: true, output: { storyboard: nextStoryboard } };
            videoToolResultMessage.content = JSON.stringify({ storyboard_id: storyboard.id, status: 'generating' }, null, 2);
            const messagesToSave: Message[] = [
              ...existingMessages,
              videoToolResultMessage,
              {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: proceedText,
                timestamp: new Date().toISOString(),
              },
            ];

            const nextPlan = {
              ...(existingPlan || {}),
              pending_storyboard_action: null,
            };
            await supabase
              .from('assistant_conversations')
              .update({ plan: nextPlan, messages: messagesToSave, updated_at: new Date().toISOString() })
              .eq('id', conversationId);

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            controller.close();
            return;
          }

          // If the user replied with modifications (i.e., not "proceed"), clear the pending gate and continue normal LLM flow.
          if (pendingStoryboardId && !userWantsToProceed(body.message)) {
            const nextPlan = { ...(existingPlan || {}), pending_storyboard_action: null };
            await supabase
              .from('assistant_conversations')
              .update({ plan: nextPlan, updated_at: new Date().toISOString() })
              .eq('id', conversationId);
            existingPlan = nextPlan;
          }

          // Stream the LLM response
          let fullResponse = '';
          
          // Send conversation ID first
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'conversation_id', data: conversationId })}\n\n`));
          
          // Signal reflexion start
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'reflexion_start' })}\n\n`));
          
          // Retry Claude streaming with rate limit handling
          let stream: any;
          const maxStreamRetries = 3;
          const streamRetryDelay = 1000;
          
          for (let attempt = 1; attempt <= maxStreamRetries; attempt++) {
            try {
              console.log(`[Assistant] Starting Claude stream (attempt ${attempt}/${maxStreamRetries})`);
              
              // Acquire rate limit slot before making request
              await replicateRateLimiter.acquire();
              
              stream = await replicate.stream('anthropic/claude-4-sonnet', {
                input: {
                  prompt: fullPrompt,
                  system_prompt: ASSISTANT_SYSTEM_PROMPT,
                  // Higher budget to reduce mid-reflexion truncation for longer requests
                  max_tokens: 8192,
                }
              });
              
              console.log(`[Assistant] Claude stream started successfully`);
              break; // Success, exit retry loop
              
            } catch (error: any) {
              console.error(`[Assistant] Claude stream error on attempt ${attempt}:`, error.message);
              
              // Check if this is a rate limiting error
              const isRateLimit = error.message?.includes('429') || 
                                 error.message?.includes('Too Many Requests') ||
                                 error.message?.includes('throttled');
              
              if (isRateLimit) {
                let retryAfter = 1;
                
                // Try to extract retry_after from error message
                const retryMatch = error.message.match(/retry_after['":](\d+)/);
                if (retryMatch) {
                  retryAfter = parseInt(retryMatch[1], 10);
                } else if (error.message.includes('resets in ~')) {
                  // Parse "resets in ~1s" format
                  const resetMatch = error.message.match(/resets in ~(\d+)s/);
                  if (resetMatch) {
                    retryAfter = parseInt(resetMatch[1], 10);
                  }
                }
                
                console.log(`[Assistant] Rate limited, waiting ${retryAfter}s before retry ${attempt}/${maxStreamRetries}`);
                
                if (attempt === maxStreamRetries) {
                  throw new Error(`Claude API rate limited after ${maxStreamRetries} attempts: ${error.message}`);
                }
                
                // Wait for retry_after time plus buffer
                await new Promise(resolve => setTimeout(resolve, (retryAfter * 1000) + 500));
                continue;
              } else {
                // Non-rate-limit error
                if (attempt === maxStreamRetries) {
                  throw error;
                }
                
                // Exponential backoff for other errors
                await new Promise(resolve => setTimeout(resolve, streamRetryDelay * attempt));
                continue;
              }
            }
          }
          
          let inReflexion = false;
          let didSendReflexionEnd = false;
          let didSendResponseStart = false;
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
              didSendReflexionEnd = true;
              didSendResponseStart = true;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'reflexion_end' })}\n\n`));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response_start' })}\n\n`));
            } else if (!inReflexion && fullResponse.includes('</reflexion>')) {
              // Buffer assistant response text; we will decide what to show after
              // parsing tool calls and executing any tools. This prevents the UI
              // from showing "I did X" hallucinations before tools actually run.
              responseBuffer += chunk;
            } else if (!fullResponse.includes('<reflexion>')) {
              // No reflexion block yet, buffer it
              responseBuffer += chunk;
            }
          }

          // If the model got cut off mid-reflexion (missing </reflexion>), unblock the UI.
          // We'll still parse tool calls from whatever was produced, and cleanResponse() strips dangling reflexion.
          if (fullResponse.includes('<reflexion>') && !fullResponse.includes('</reflexion>')) {
            if (!didSendReflexionEnd) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'reflexion_end' })}\n\n`));
              didSendReflexionEnd = true;
            }
            if (!didSendResponseStart) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response_start' })}\n\n`));
              didSendResponseStart = true;
            }
          }
          
          // Parse the full response
          const reflexion = parseReflexion(fullResponse);
          let toolCalls = parseToolCalls(fullResponse);
          const reflexionMeta = parseReflexionMeta(fullResponse);
          
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
            cleanedResponse = 'I generated a tool call, but it was not parseable. Please reply "retry" and I will reformat it as strict JSON.';
          }
          const wantedToolCall = reflexionMeta?.selectedAction === 'TOOL_CALL';
          if (wantedToolCall && toolCalls.length === 0) {
            // Do NOT allow the assistant to claim it executed a tool if no tool_call was provided.
            cleanedResponse = '';
          }
          
          // Default assistant response (may be overridden after tools run)
          let finalAssistantResponse = cleanedResponse.trim();
          if (wantedToolCall && toolCalls.length === 0) {
            finalAssistantResponse =
              'I expected to run a tool, but no valid <tool_call> was provided in the response.\n\n' +
              'Please reply **"retry"** so I can return a proper tool_call.';
          }
          
          // Execute tool calls if any
          const toolResults: Array<{ tool: string; result: unknown }> = [];
          
          for (const toolCall of filteredToolCalls) {
            const toolMessageId = crypto.randomUUID();
            // Normalize/sanitize tool inputs to avoid massive payloads (and to force server-side multi-call refinement).
            if (toolCall.tool === 'storyboard_creation') {
              toolCall.input = sanitizeStoryboardCreationInput(toolCall.input);
            }

            // Enforce server-tracked avatar and product URLs for storyboard creation.
            // Never trust model-supplied random URLs.
            if (toolCall.tool === 'storyboard_creation') {
              const input = toolCall.input as any;
              const originalAvatarUrl = input.avatar_image_url;
              const originalProductUrl = input.product_image_url;
              
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
              
              // If we have a selected product stored server-side, force it.
              if (selectedProductUrl) {
                input.product_image_url = selectedProductUrl;
                if (!input.product_image_description && selectedProductDescription) {
                  input.product_image_description = selectedProductDescription;
                }
                console.log('[Product Injection] Using server-tracked product:', {
                  originalUrl: originalProductUrl ? String(originalProductUrl).substring(0, 50) : 'none',
                  injectedUrl: selectedProductUrl.substring(0, 50),
                  description: selectedProductDescription || 'none',
                });
              } else if (confirmedProductUrl && !isHttpUrl(input.product_image_url)) {
                // Fallback: user confirmed in this same message
                input.product_image_url = confirmedProductUrl;
                if (!input.product_image_description && confirmedProductDescription) {
                  input.product_image_description = confirmedProductDescription;
                }
                console.log('[Product Injection] Using just-confirmed product:', {
                  originalUrl: originalProductUrl ? String(originalProductUrl).substring(0, 50) : 'none',
                  injectedUrl: confirmedProductUrl.substring(0, 50),
                  description: confirmedProductDescription || 'none',
                });
              } else {
                console.log('[Product Injection] No product to inject:', {
                  originalUrl: originalProductUrl ? String(originalProductUrl).substring(0, 50) : 'none',
                  selectedProductUrl: selectedProductUrl || 'none',
                  confirmedProductUrl: confirmedProductUrl || 'none',
                });
              }
            }
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'tool_call', 
              data: { tool: toolCall.tool, input: toolCall.input, message_id: toolMessageId }
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
              // Pass stream controller and encoder for real-time progress updates during sequential generation
              result = isStoryboardCreationInput(safeInput)
                ? await executeStoryboardCreation(safeInput, { origin, conversationId: String(conversationId) }, controller, encoder)
                : { success: false, error: 'Invalid storyboard_creation input: missing title/scenes or avatar_image_url required for scenes using avatar' };
              
              // If storyboard creation returned an image registry, persist it to the plan
              if (result?.success && (result as any)?.output?.imageRegistry) {
                const nextPlan = {
                  ...(existingPlan || {}),
                  image_registry: (result as any).output.imageRegistry,
                };
                await supabase
                  .from('assistant_conversations')
                  .update({ plan: nextPlan, updated_at: new Date().toISOString() })
                  .eq('id', conversationId);
                existingPlan = nextPlan;
              }
            } else if (toolCall.tool === 'video_generation') {
              const safeInput: unknown = toolCall.input;
              result = isVideoGenerationInput(safeInput)
                ? await executeVideoGeneration(safeInput)
                : { success: false, error: 'Invalid video_generation input: missing storyboard_id' };
            } else if (toolCall.tool === 'video_analysis') {
              const safeInput: unknown = toolCall.input;
              result = isVideoAnalysisInput(safeInput)
                ? await executeVideoAnalysis(safeInput, { origin, conversationId: String(conversationId) })
                : { success: false, error: 'Invalid video_analysis input: missing video_url or video_file' };
            } else if (toolCall.tool === 'motion_control') {
              const safeInput: unknown = toolCall.input;
              result = isMotionControlInput(safeInput)
                ? await executeMotionControl(safeInput)
                : { success: false, error: 'Invalid motion_control input: missing video_url or image_url' };
            }
            
            if (result) {
              const resultWithMessageId =
                result && typeof result === 'object'
                  ? { ...(result as any), message_id: toolMessageId }
                  : { success: false, error: 'Invalid tool result', message_id: toolMessageId };

              toolResults.push({ tool: toolCall.tool, result: resultWithMessageId });
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'tool_result', 
                data: { tool: toolCall.tool, result: resultWithMessageId }
              })}\n\n`));
            }
          }

          // Enforce step-by-step UX: when avatar generation is started, do NOT let the model
          // claim completion. Always ask for explicit confirmation in a separate message.
          const executedAvatarGen = filteredToolCalls.some(
            (tc) => tc.tool === 'image_generation' && (tc.input as any)?.purpose === 'avatar'
          );
          if (executedAvatarGen) {
            finalAssistantResponse =
              'I just started generating your avatar. You’ll see it appear above as soon as it finishes.\n\n' +
              'If you want to use it, reply **"Use this avatar"**.\n' +
              'If you want a different look (age, vibe, setting, ethnicity, style), tell me what to change and I’ll regenerate.';
          } else if (!finalAssistantResponse && storyboardBlockedByAvatar) {
            if (userConfirmedAvatar && !confirmedAvatarUrl) {
              finalAssistantResponse =
                confirmedAvatarStatus && !['succeeded', 'failed', 'canceled'].includes(String(confirmedAvatarStatus).toLowerCase())
                  ? `Your avatar is still generating (status: ${confirmedAvatarStatus}). Please wait a moment, then reply again: "Use this avatar".`
                  : 'I could not access the avatar image URL yet. Please wait for the avatar image to finish generating, then reply: "Use this avatar".';
            } else if (avatarCandidate?.url || avatarCandidate?.predictionId) {
              finalAssistantResponse =
                'Before I can create the storyboard, please confirm the avatar.\n\n' +
                'Reply **"Use this avatar"** to proceed, or tell me what to change.';
            } else {
              finalAssistantResponse =
                'This video needs a person/actor. Before I can create the storyboard, I need an avatar reference and your approval.\n\n' +
                'Reply **"Generate an avatar"** to create one, or upload an image and tell me to use it as the avatar.';
            }
          }
          
          // Save messages to conversation (keep tool results before the final assistant "wrap-up")
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

          // Add tool calls and results
          for (let i = 0; i < filteredToolCalls.length; i++) {
            const toolCall = filteredToolCalls[i];
            const toolResult = toolResults[i];

            // Ensure we persist a sanitized input for storyboard_creation (DB size + determinism).
            const toolInputToStore =
              toolCall.tool === 'storyboard_creation'
                ? sanitizeStoryboardCreationInput(toolCall.input)
                : toolCall.input;
            
            messagesToSave.push({
              id: crypto.randomUUID(),
              role: 'tool_call',
              content: `Calling ${toolCall.tool}`,
              timestamp: new Date().toISOString(),
              tool_name: toolCall.tool,
              tool_input: toolInputToStore,
            });
            
            if (toolResult) {
              // Enhance tool_output with input metadata for avatar tracking
              const enhancedToolOutput: Record<string, unknown> = {
                ...(toolResult.result as Record<string, unknown>),
              };
              
              // For image generation, include purpose and descriptions in the output
              // so they can be retrieved later for avatar/product context
              if (toolCall.tool === 'image_generation') {
                const input = toolCall.input as any;
                if (input?.purpose) {
                  enhancedToolOutput.purpose = input.purpose;
                }
                if (input?.avatar_description) {
                  enhancedToolOutput.avatar_description = input.avatar_description;
                }
                if (input?.prompt) {
                  // Store prompt for product description retrieval
                  enhancedToolOutput.prompt = input.prompt;
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

          // If a storyboard was generated successfully, ask user to modify or proceed and set a server-side flag.
          const storyboardToolResult = toolResults.find((tr) => tr.tool === 'storyboard_creation')?.result as any;
          const storyboardObj: Storyboard | null =
            storyboardToolResult?.success && storyboardToolResult?.output?.storyboard ? (storyboardToolResult.output.storyboard as Storyboard) : null;
          // Accept storyboards even if frames are still generating (UI will poll for completion)
          const shouldPromptProceed =
            Boolean(storyboardObj?.id) &&
            (storyboardObj?.status === 'ready' || storyboardObj?.status === 'generating') &&
            Array.isArray(storyboardObj?.scenes) &&
            storyboardObj.scenes.length > 0 &&
            storyboardToolResult?.success === true;

          if (shouldPromptProceed && storyboardObj) {
            // Save storyboard to database for persistence
            try {
              const { error: saveError } = await supabase
                .from('storyboards')
                .upsert({
                  id: storyboardObj.id,
                  user_id: user.id,
                  conversation_id: conversationId,
                  title: storyboardObj.title,
                  brand_name: storyboardObj.brand_name || null,
                  product: storyboardObj.product || null,
                  product_description: null,
                  target_audience: storyboardObj.target_audience || null,
                  platform: storyboardObj.platform || null,
                  total_duration_seconds: storyboardObj.total_duration_seconds || null,
                  style: storyboardObj.style || null,
                  aspect_ratio: storyboardObj.aspect_ratio || '9:16',
                  avatar_image_url: storyboardObj.avatar_image_url || null,
                  avatar_description: storyboardObj.avatar_description || null,
                  product_image_url: storyboardObj.product_image_url || null,
                  product_image_description: storyboardObj.product_image_description || null,
                  scenario: storyboardObj.scenario || null,
                  scenes: storyboardObj.scenes,
                  status: storyboardObj.status,
                  scenes_needing_product: storyboardObj.scenes_needing_product || null,
                  created_at: storyboardObj.created_at,
                  updated_at: new Date().toISOString(),
                });
              
              if (saveError) {
                console.error('Error saving storyboard to database:', saveError);
              }
            } catch (error) {
              console.error('Exception saving storyboard:', error);
            }

            // Check if frames are still generating
            const anyFramesGenerating = storyboardObj.scenes.some(
              s => s.first_frame_status === 'generating' || s.last_frame_status === 'generating' ||
                   (s.first_frame_prediction_id && !s.first_frame_url) ||
                   (s.last_frame_prediction_id && !s.last_frame_url)
            );
            
            const storyboardUrl = `${origin}/storyboard/${storyboardObj.id}`;
            
            const promptLine = anyFramesGenerating
              ? `✨ **Storyboard created!** Frame images are generating in the background (you'll see them appear as they complete).\n\n` +
                `📋 **[Click here to review and edit your storyboard](${storyboardUrl})**\n\n` +
                `You can edit scene descriptions, timings, and scripts in the storyboard editor. Any changes you make will be used for video generation.\n\n` +
                `Once you're happy with the storyboard:\n` +
                `- Reply **"proceed"** or click "Continue to Generation" in the storyboard page to generate videos\n` +
                `- Or reply with any modifications (e.g. "make scene 2 longer")\n\n` +
                `The frames will populate automatically - feel free to say "proceed" whenever you're ready!`
              : `✨ **Storyboard is ready!**\n\n` +
                `📋 **[Click here to review and edit your storyboard](${storyboardUrl})**\n\n` +
                `You can edit scene descriptions, timings, and scripts in the interactive editor. Drag scenes to reorder them, or click "Continue to Generation" when you're ready.\n\n` +
                `Next steps:\n` +
                `- Reply **"proceed"** to start video generation using VEO 3.1 Fast\n` +
                `- Or describe any modifications you'd like to make`;
            finalAssistantResponse = finalAssistantResponse ? `${finalAssistantResponse}\n\n${promptLine}` : promptLine;

            const nextPlan = {
              ...(existingPlan || {}),
              pending_storyboard_action: { storyboard_id: String(storyboardObj.id), created_at: new Date().toISOString() },
            };
            await supabase
              .from('assistant_conversations')
              .update({ plan: nextPlan, updated_at: new Date().toISOString() })
              .eq('id', conversationId);
            existingPlan = nextPlan;
          }
          
          // Stream final assistant response once (reliable, post-tool execution).
          if (finalAssistantResponse.trim()) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'response_chunk', data: finalAssistantResponse })}\n\n`));
          }

          // Add assistant response (only if non-empty)
          if (finalAssistantResponse.trim()) {
            messagesToSave.push({
              id: crypto.randomUUID(),
              role: 'assistant',
              content: finalAssistantResponse,
              timestamp: new Date().toISOString(),
            });
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
          if (heartbeat) clearInterval(heartbeat);
          controller.close();
        } catch (e: any) {
          console.error('Stream error:', e);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', data: e.message })}\n\n`));
          if (heartbeat) clearInterval(heartbeat);
          controller.close();
        }
      }
    });
    
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        // Try to prevent buffering in some proxies
        'X-Accel-Buffering': 'no',
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

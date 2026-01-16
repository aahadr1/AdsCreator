export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Replicate from 'replicate';
import { ASSISTANT_SYSTEM_PROMPT, buildConversationContext } from '../../../../lib/prompts/assistant/system';
import type { Message, ScriptCreationInput, ImageGenerationInput, StoryboardCreationInput, Storyboard, StoryboardScene } from '../../../../types/assistant';

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
    if (typeof scene.first_frame_prompt !== 'string') return false;
    if (typeof scene.last_frame_prompt !== 'string') return false;
    // If any scene explicitly needs avatar, require a REAL url (not a placeholder)
    if (scene.uses_avatar === true && !avatarUrlIsValid) return false;
    // If prompts explicitly reference avatar, require a real url too
    const p = `${scene.first_frame_prompt} ${scene.last_frame_prompt}`.toLowerCase();
    if ((p.includes('base avatar') || p.includes('same actor from avatar') || p.includes('same avatar')) && !avatarUrlIsValid) return false;
  }
  return true;
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
    // Find the closest previous tool_call to determine if it was an avatar generation
    for (let j = i - 1; j >= 0; j--) {
      const prev = messages[j];
      if (prev.role === 'tool_call' && prev.tool_name === 'image_generation') {
        const input = prev.tool_input as any;
        if (input?.purpose === 'avatar') {
          const url = extractImageUrlFromToolResult(msg);
          const predictionId = extractPredictionIdFromToolResult(msg);
          if (url) return { url, predictionId: predictionId || undefined, status: 'succeeded', description: input?.avatar_description || undefined };
          if (predictionId) {
            const resolved = await resolveReplicateOutputUrl(predictionId);
            if (resolved.outputUrl) {
              return { url: resolved.outputUrl, predictionId, status: resolved.status || undefined, description: input?.avatar_description || undefined };
            }
            return { predictionId, status: resolved.status || undefined, description: input?.avatar_description || undefined };
          }
          return { description: input?.avatar_description || undefined };
        }
        break;
      }
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
    
    const predictionInput: Record<string, unknown> = {
      prompt: input.prompt,
      output_format: input.output_format || 'jpg',
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

// Cache for model version ID to avoid repeated API calls
let cachedModelVersionId: string | null = null;
let cachedModelVersionTime: number = 0;
const MODEL_VERSION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper to get model version with caching
async function getModelVersionId(token: string): Promise<string | null> {
  const now = Date.now();
  if (cachedModelVersionId && (now - cachedModelVersionTime) < MODEL_VERSION_CACHE_TTL) {
    return cachedModelVersionId;
  }
  
  const model = 'google/nano-banana';
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
  
  if (versionId) {
    cachedModelVersionId = versionId;
    cachedModelVersionTime = now;
  }
  
  return versionId || null;
}

// Helper to generate a single image with optional image-to-image reference
async function generateSingleImage(
  prompt: string, 
  aspectRatio?: string,
  referenceImageUrl?: string
): Promise<{ id: string; status: string; error?: string } | null> {
  try {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      console.error('[Storyboard] No REPLICATE_API_TOKEN');
      return null;
    }
    
    const versionId = await getModelVersionId(token);
    if (!versionId) {
      console.error('[Storyboard] Could not get model version ID');
      return null;
    }
    
    // Build the enhanced prompt
    let enhancedPrompt = prompt;
    
    // Add aspect ratio hint to prompt if provided
    if (aspectRatio && !prompt.includes(aspectRatio)) {
      enhancedPrompt = `${enhancedPrompt}, ${aspectRatio} aspect ratio`;
    }
    
    const predictionInput: Record<string, unknown> = {
      prompt: enhancedPrompt,
      output_format: 'jpg',
    };
    
    // If reference image is provided, use it for image-to-image generation
    // This ensures consistency - same actor, same setting, same style
    if (referenceImageUrl && /^https?:\/\//i.test(referenceImageUrl)) {
      predictionInput.image_input = [referenceImageUrl];
      // Add consistency instructions to the prompt
      predictionInput.prompt = `Maintain exact same person, same face, same setting, same camera angle, same lighting as reference image. Only change: ${enhancedPrompt}`;
    }
    
    console.log('[Storyboard] Creating prediction with prompt:', (predictionInput.prompt as string).substring(0, 100) + '...');
    
    const maxRetries = 2;
    let attempt = 0;
    while (attempt <= maxRetries) {
      const res = await fetch(`${REPLICATE_API}/predictions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({ version: versionId, input: predictionInput }),
      });
      
      if (res.ok) {
        const prediction = await res.json();
        console.log('[Storyboard] Prediction created:', prediction.id, prediction.status);
        return { id: prediction.id, status: prediction.status };
      }
      
      const errorText = await res.text();
      console.error('[Storyboard] Prediction creation failed:', res.status, errorText);
      
      // Retry on rate limits or transient errors
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        attempt += 1;
        if (attempt <= maxRetries) {
          await delay(600 * attempt);
          continue;
        }
      }
      
      return { id: '', status: 'failed', error: errorText || `HTTP ${res.status}` };
    }
    
    return null;
  } catch (e: any) {
    console.error('[Storyboard] generateSingleImage error:', e.message || e);
    return { id: '', status: 'failed', error: e.message || 'Unknown error' };
  }
}

// Small delay helper
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Execute storyboard creation tool
async function executeStoryboardCreation(input: StoryboardCreationInput): Promise<{ success: boolean; output?: { storyboard: Storyboard }; error?: string }> {
  try {
    const storyboardId = crypto.randomUUID();
    
    // Avatar reference URL for image-to-image consistency
    const avatarUrl = input.avatar_image_url;
    
    function inferUsesAvatar(scene: StoryboardCreationInput['scenes'][number]): boolean {
      if (typeof scene.uses_avatar === 'boolean') return scene.uses_avatar;
      if (scene.setting_change === true) return false;
      const text = `${scene.description} ${scene.first_frame_prompt} ${scene.last_frame_prompt}`.toLowerCase();
      const noActorSignals = ['product only', 'no actor', 'no people', 'b-roll', 'b roll', 'flat lay', 'packaging', 'end card', 'logo', 'text card'];
      if (noActorSignals.some((s) => text.includes(s))) return false;
      const actorSignals = ['creator', 'actor', 'person', 'woman', 'man', 'she', 'he', 'facecam', 'talk', 'speaking', 'holding', 'applying', 'unboxing', 'reaction'];
      return actorSignals.some((s) => text.includes(s));
    }
    
    // Build scenes with prediction IDs for image generation
    const scenesWithPredictions: StoryboardScene[] = [];
    
    for (const scene of input.scenes) {
      // Determine if this scene should use the avatar reference
      // Only use avatar when explicitly marked as uses_avatar
      const usesAvatar = inferUsesAvatar(scene);
      const useAvatarReference = avatarUrl && usesAvatar;
      
      // Generate first frame image with optional avatar reference
      const firstFramePrediction = await generateSingleImage(
        scene.first_frame_prompt,
        input.aspect_ratio,
        useAvatarReference ? avatarUrl : undefined
      );
      
      // Small delay to avoid rate limits
      await delay(350);
      
      // Generate last frame image with optional avatar reference
      const lastFramePrediction = await generateSingleImage(
        scene.last_frame_prompt,
        input.aspect_ratio,
        useAvatarReference ? avatarUrl : undefined
      );
      
      await delay(350);
      
      scenesWithPredictions.push({
        scene_number: scene.scene_number,
        scene_name: scene.scene_name,
        description: scene.description,
        duration_seconds: scene.duration_seconds,
        first_frame_prompt: scene.first_frame_prompt,
        last_frame_prompt: scene.last_frame_prompt,
        transition_type: scene.transition_type,
        camera_angle: scene.camera_angle,
        setting_change: scene.setting_change,
        uses_avatar: usesAvatar,
        video_generation_prompt: scene.video_generation_prompt,
        audio_notes: scene.audio_notes,
        first_frame_prediction_id: firstFramePrediction?.id || undefined,
        last_frame_prediction_id: lastFramePrediction?.id || undefined,
        first_frame_status: firstFramePrediction?.id ? 'generating' : 'failed',
        last_frame_status: lastFramePrediction?.id ? 'generating' : 'failed',
        first_frame_error: firstFramePrediction && !firstFramePrediction.id ? firstFramePrediction.error : undefined,
        last_frame_error: lastFramePrediction && !lastFramePrediction.id ? lastFramePrediction.error : undefined,
      });
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
    
    if (conversationId) {
      const { data: existing } = await supabase
        .from('assistant_conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();
      
      if (existing) {
        existingMessages = (existing.messages || []) as Message[];
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
  
    // Build conversation context for Claude
    const conversationContext = buildConversationContext(existingMessages);
    
    const fullPrompt = conversationContext 
      ? `Previous conversation:\n${conversationContext}\n\nUser: ${body.message}`
      : body.message;
    
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
            const avatarUrlAvailable = isHttpUrl(avatarUrlInCall) || Boolean(confirmedAvatarUrl);
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
            // Inject confirmed avatar URL if user just confirmed
            if (toolCall.tool === 'storyboard_creation' && confirmedAvatarUrl) {
              const input = toolCall.input as any;
              // Only override when the model did NOT already provide a real URL
              if (!isHttpUrl(input.avatar_image_url)) {
                input.avatar_image_url = confirmedAvatarUrl;
              }
              if (!input.avatar_description && confirmedAvatarDescription) {
                input.avatar_description = confirmedAvatarDescription;
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
              messagesToSave.push({
                id: crypto.randomUUID(),
                role: 'tool_result',
                content: toolResult.result && typeof toolResult.result === 'object' && 'output' in toolResult.result 
                  ? String((toolResult.result as any).output || JSON.stringify(toolResult.result))
                  : JSON.stringify(toolResult.result),
                timestamp: new Date().toISOString(),
                tool_name: toolCall.tool,
                tool_output: toolResult.result as Record<string, unknown>,
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

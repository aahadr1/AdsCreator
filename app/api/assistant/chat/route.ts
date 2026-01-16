export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Replicate from 'replicate';
import { ASSISTANT_SYSTEM_PROMPT, buildConversationContext } from '../../../../lib/prompts/assistant/system';
import type { Message, ScriptCreationInput, ImageGenerationInput } from '../../../../types/assistant';

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

// Parse tool calls from assistant response
function parseToolCalls(content: string): Array<{ tool: string; input: Record<string, unknown> }> {
  const toolCalls: Array<{ tool: string; input: Record<string, unknown> }> = [];
  const toolCallRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
  let match;
  
  while ((match = toolCallRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.tool && parsed.input) {
        toolCalls.push(parsed);
      }
    } catch (e) {
      console.error('Failed to parse tool call:', e);
    }
  }
  
  return toolCalls;
}

// Parse reflexion from assistant response
function parseReflexion(content: string): string | null {
  const reflexionRegex = /<reflexion>([\s\S]*?)<\/reflexion>/;
  const match = content.match(reflexionRegex);
  return match ? match[1].trim() : null;
}

// Remove tool calls and reflexion from visible response
function cleanResponse(content: string): string {
  return content
    .replace(/<reflexion>[\s\S]*?<\/reflexion>/g, '')
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
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
    const stream = await replicate.stream('anthropic/claude-sonnet-4-20250514', {
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
          
          const stream = await replicate.stream('anthropic/claude-sonnet-4-20250514', {
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
            
            // Track if we're in reflexion block
            if (fullResponse.includes('<reflexion>') && !fullResponse.includes('</reflexion>')) {
              inReflexion = true;
              reflexionBuffer += chunk;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'reflexion_chunk', data: chunk })}\n\n`));
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
          const cleanedResponse = cleanResponse(fullResponse);
          
          // Execute tool calls if any
          const toolResults: Array<{ tool: string; result: unknown }> = [];
          
          for (const toolCall of toolCalls) {
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
          
          // Add assistant response
          messagesToSave.push({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: cleanedResponse,
            timestamp: new Date().toISOString(),
          });
          
          // Add tool calls and results
          for (let i = 0; i < toolCalls.length; i++) {
            const toolCall = toolCalls[i];
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

export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest } from 'next/server';
import Replicate from 'replicate';
import { buildUnifiedPlannerSystemPrompt } from '@/lib/assistantTools';
import type { AssistantPlanMessage, AssistantMedia } from '@/types/assistant';

const SONNET_4_5_MODEL = 'anthropic/claude-4.5-sonnet';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, media, user_id } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'Missing messages' }, { status: 400 });
    }
    if (!user_id) {
      return Response.json({ error: 'Missing user_id' }, { status: 401 });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return Response.json({ error: 'Missing REPLICATE_API_TOKEN' }, { status: 500 });
    }

    const replicate = new Replicate({ auth: token });
    const plannerSystem = buildUnifiedPlannerSystemPrompt();
    
    const conversation = messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    const mediaLines = (media || []).length > 0
      ? `\n\nATTACHED MEDIA:\n${media.map((m: any) => `- ${m.type}: ${m.url}`).join('\n')}`
      : '';
    
    const plannerUser = `${conversation}${mediaLines}

Generate the complete workflow plan with detailed, ready-to-use prompts. Return only valid JSON.`;

    const planOutput = await replicate.run(SONNET_4_5_MODEL as `${string}/${string}`, {
      input: {
        system_prompt: plannerSystem,
        prompt: plannerUser,
        max_tokens: 12000,
      },
    });

    // Extract text from response
    let rawText = '';
    if (Array.isArray(planOutput)) {
      rawText = planOutput.map((o) => (typeof o === 'string' ? o : JSON.stringify(o))).join('');
    } else if (typeof planOutput === 'string') {
      rawText = planOutput;
    } else if (planOutput && typeof planOutput === 'object') {
      rawText = JSON.stringify(planOutput);
    }

    // Try to parse
    let claudePlan: any = null;
    try {
      claudePlan = JSON.parse(rawText);
    } catch {
      // Try extracting from markdown
      const jsonMatch = rawText.match(/```(?:json)?\s*({[\s\S]*})\s*```/);
      if (jsonMatch) {
        claudePlan = JSON.parse(jsonMatch[1]);
      }
    }

    return Response.json({
      success: true,
      claudeRawOutput: rawText,
      claudeParsedPlan: claudePlan,
      stepCount: claudePlan?.steps?.length || 0,
      steps: claudePlan?.steps || [],
    });
  } catch (err: any) {
    return Response.json({ 
      success: false, 
      error: err?.message || 'Verification failed' 
    }, { status: 500 });
  }
}


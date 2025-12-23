/**
 * Creative Strategist Agent Endpoint
 * Phase 2: Sub-agent endpoints implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { buildCreativeStrategistPrompt } from '@/lib/prompts/agents/creative_strategist';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PLANNER_MODEL = process.env.REPLICATE_PLANNER_MODEL || 'anthropic/claude-4.5-sonnet';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { product, targetAudience, competitors, platforms, budget } = body;

    if (!product) {
      return NextResponse.json(
        { error: 'Product description required' },
        { status: 400 }
      );
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // Build context for the agent
    const context = `
Product: ${product}
${targetAudience ? `Target Audience: ${targetAudience}` : ''}
${competitors && competitors.length > 0 ? `Competitors: ${competitors.join(', ')}` : ''}
${platforms && platforms.length > 0 ? `Platforms: ${platforms.join(', ')}` : ''}
${budget ? `Budget: ${budget}` : ''}

Generate a comprehensive creative strategy following the JSON schema.
`;

    const systemPrompt = buildCreativeStrategistPrompt();

    // Call LLM with creative strategist prompt
    const output: any = await replicate.run(PLANNER_MODEL as `${string}/${string}`, {
      input: {
        prompt: context,
        system_prompt: systemPrompt,
        max_tokens: 4000,
        temperature: 0.7,
      },
    });

    // Parse output
    let responseText = '';
    if (typeof output === 'string') {
      responseText = output;
    } else if (Array.isArray(output)) {
      responseText = output.join('');
    } else {
      responseText = JSON.stringify(output);
    }

    // Try to extract JSON
    let strategy;
    try {
      // Try direct parse
      strategy = JSON.parse(responseText);
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        strategy = JSON.parse(jsonMatch[1]);
      } else {
        // Try to find JSON object
        const objMatch = responseText.match(/\{[\s\S]*\}/);
        if (objMatch) {
          strategy = JSON.parse(objMatch[0]);
        } else {
          throw new Error('Could not parse JSON from response');
        }
      }
    }

    return NextResponse.json({
      success: true,
      strategy,
      metadata: {
        model: PLANNER_MODEL,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Creative Strategist] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Strategy generation failed' },
      { status: 500 }
    );
  }
}


/**
 * QA Reviewer Agent Endpoint
 * Phase 2: Sub-agent endpoints implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { buildQAReviewerPrompt } from '@/lib/prompts/agents/qa_reviewer';
import { calculateNoveltyScore } from '@/lib/advertisingTools';

export const runtime = 'nodejs';
export const maxDuration = 30;

const REVIEWER_MODEL = process.env.REPLICATE_PLANNER_MODEL || 'anthropic/claude-4.5-sonnet';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, contentType, context, brandGuidelines } = body;

    if (!content || !contentType) {
      return NextResponse.json(
        { error: 'Content and contentType required' },
        { status: 400 }
      );
    }

    // Calculate novelty score
    const noveltyScore = calculateNoveltyScore(content);

    // Build review context
    const reviewContext = `
Content to review: ${content}
Content type: ${contentType}
Context: ${JSON.stringify(context || {})}
${brandGuidelines ? `Brand Guidelines: ${JSON.stringify(brandGuidelines)}` : ''}

Evaluate this content and return JSON.
`;

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    const systemPrompt = buildQAReviewerPrompt();

    const output: any = await replicate.run(REVIEWER_MODEL as `${string}/${string}`, {
      input: {
        prompt: reviewContext,
        system_prompt: systemPrompt,
        max_tokens: 2000,
        temperature: 0.3, // Lower temperature for consistent evaluation
      },
    });

    // Parse output
    let responseText = '';
    if (typeof output === 'string') {
      responseText = output;
    } else if (Array.isArray(output)) {
      responseText = output.join('');
    }

    // Extract JSON
    let review;
    try {
      review = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        review = JSON.parse(jsonMatch[1]);
      } else {
        const objMatch = responseText.match(/\{[\s\S]*\}/);
        if (objMatch) {
          review = JSON.parse(objMatch[0]);
        } else {
          throw new Error('Could not parse JSON from review');
        }
      }
    }

    // Add calculated novelty score to review
    review.novelty_score = noveltyScore;

    return NextResponse.json({
      success: true,
      review,
      metadata: {
        model: REVIEWER_MODEL,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[QA Reviewer] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Review failed' },
      { status: 500 }
    );
  }
}


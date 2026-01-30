export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

/**
 * POST /api/influencer/enrich-description
 * Enrich user's influencer description with detailed, modern elements using LLM
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_description } = body;

    if (!user_description || typeof user_description !== 'string') {
      return NextResponse.json(
        { error: 'user_description is required' },
        { status: 400 }
      );
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'Server misconfigured: missing OPENAI_API_KEY' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    console.log('Enriching description:', user_description);

    const systemPrompt = `You are an expert at creating detailed, realistic influencer personas for AI image generation.

Your role is to enhance user descriptions by:
1. PRESERVING all user intentions and core characteristics (NEVER change what the user explicitly wants)
2. Adding realistic, modern details that make the influencer feel current (2025-2026)
3. Inferring subtle details that were implied but not explicitly stated
4. Adding contemporary fashion, style, and cultural elements
5. Making the description vivid and specific for hyperrealistic AI image generation

Guidelines:
- Keep the description under 200 words
- Focus on visual details: appearance, style, clothing, accessories
- Use modern 2025-2026 fashion trends
- Be specific about colors, textures, patterns
- Include lighting and mood hints
- Make it feel like a real person living today
- DO NOT add fantasy elements or unrealistic features
- DO NOT change age, ethnicity, gender, or core identity traits specified by the user
- DO NOT add implied nudity or inappropriate content
- Keep it professional and suitable for a photoshoot

Output ONLY the enriched description, no explanations or meta-commentary.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Enrich this influencer description:\n\n${user_description}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const enrichedDescription = completion.choices[0]?.message?.content?.trim();

    if (!enrichedDescription) {
      return NextResponse.json(
        { error: 'Failed to generate enriched description' },
        { status: 500 }
      );
    }

    console.log('✓ Enriched description created');

    return NextResponse.json({
      enriched_description: enrichedDescription,
      original_description: user_description,
    });
  } catch (error: any) {
    console.error('POST /api/influencer/enrich-description error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

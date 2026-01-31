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

    const systemPrompt = `You are an expert creative director & casting producer for modern (2025–2026) influencer campaigns.

Your job: rewrite the user's description into a SINGLE, photorealistic "identity + styling" prompt that will be used to generate a studio photoshoot.

Critical goals:
1) Preserve ALL explicit user constraints (age, gender, ethnicity, core traits). Never contradict them.
2) Make the person feel like a real, current influencer (not a generic AI person).
3) Add SPECIFIC, distinctive visual anchors so the identity stays consistent across multiple angles.

Hard rules:
- Output ONE paragraph only. No bullet points. No headings. No meta text.
- 120–220 words.
- Photorealistic, contemporary, suitable for commercial studio photography.
- Do NOT reference real celebrities, public figures, or brand names.
- No fantasy/anime/cyberpunk/sci‑fi.
- No nudity or sexual content.

Required content to reduce "generic faces":
- Include at least 3 unique identity anchors chosen from: distinctive hairstyle + hairline details, eyebrow shape, a small scar/freckle pattern, a subtle asymmetry, a signature accessory (glasses/earring), a specific makeup/grooming detail, a particular smile or expression.
- Include a modern, believable influencer niche & vibe (e.g. fitness, tech, skincare, fashion, cooking, travel, gaming, parenting, design) but DO NOT stereotype—anyone can be an influencer.
- Include realistic skin texture + camera realism cues (natural pores/texture, high-end DSLR look).
- Include an outfit that fits the niche (colors/materials) and 1–2 accessories.
- Mention "clean white studio / seamless white backdrop / softbox lighting" as the setting (this is for a studio photoshoot series).`;

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

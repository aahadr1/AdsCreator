export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { PHOTOSHOOT_ANGLES } from '@/types/influencer';

const REPLICATE_API = 'https://api.replicate.com/v1';
const NANO_BANANA_MODEL = 'google/nano-banana';

/**
 * POST /api/influencer/generate-photoshoot
 * Generate a complete 5-angle photoshoot for an influencer
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { influencer_id, generation_prompt, input_images } = body;

    if (!influencer_id || !generation_prompt) {
      return NextResponse.json(
        { error: 'influencer_id and generation_prompt are required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: influencer, error: fetchError } = await supabase
      .from('influencers')
      .select('*')
      .eq('id', influencer_id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !influencer) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
    }

    // Update status to generating
    await supabase
      .from('influencers')
      .update({ status: 'generating' })
      .eq('id', influencer_id);

    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      return NextResponse.json(
        { error: 'Server misconfigured: missing REPLICATE_API_TOKEN' },
        { status: 500 }
      );
    }

    // Generate 5 photos for different angles
    const generationResults: Record<string, string> = {};
    const errors: string[] = [];

    for (const angle of PHOTOSHOOT_ANGLES) {
      try {
        const fullPrompt = `${generation_prompt}. ${angle.prompt_suffix}`;
        
        const input: Record<string, any> = {
          prompt: fullPrompt,
          aspect_ratio: '9:16',
          output_format: 'jpg',
        };

        // Add input images if provided (for consistency)
        if (Array.isArray(input_images) && input_images.length > 0) {
          input.image_input = input_images;
        }

        console.log(`Generating ${angle.type} for influencer ${influencer_id}...`);

        // Create prediction
        const response = await fetch(`${REPLICATE_API}/predictions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${replicateToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'wait',
          },
          body: JSON.stringify({
            version: NANO_BANANA_MODEL,
            input,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error generating ${angle.type}:`, errorText);
          errors.push(`${angle.type}: ${errorText}`);
          continue;
        }

        const prediction = await response.json();

        // Wait for completion (with timeout)
        let finalPrediction = prediction;
        let attempts = 0;
        const maxAttempts = 60; // 60 * 2 seconds = 2 minutes max per image

        while (
          finalPrediction.status !== 'succeeded' &&
          finalPrediction.status !== 'failed' &&
          attempts < maxAttempts
        ) {
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const statusResponse = await fetch(
            `${REPLICATE_API}/predictions/${finalPrediction.id}`,
            {
              headers: {
                'Authorization': `Bearer ${replicateToken}`,
              },
            }
          );

          if (!statusResponse.ok) {
            console.error(`Error polling ${angle.type}:`, await statusResponse.text());
            break;
          }

          finalPrediction = await statusResponse.json();
          attempts++;
        }

        if (finalPrediction.status === 'succeeded' && finalPrediction.output) {
          const imageUrl = Array.isArray(finalPrediction.output)
            ? finalPrediction.output[0]
            : finalPrediction.output;
          
          generationResults[angle.field_name] = imageUrl;
          console.log(`✓ Generated ${angle.type}: ${imageUrl}`);
        } else {
          const errorMsg = finalPrediction.error || 'Generation timeout or failed';
          errors.push(`${angle.type}: ${errorMsg}`);
          console.error(`✗ Failed to generate ${angle.type}:`, errorMsg);
        }
      } catch (error: any) {
        console.error(`Error generating ${angle.type}:`, error);
        errors.push(`${angle.type}: ${error.message}`);
      }
    }

    // Update influencer with generated photos
    const hasAnyPhoto = Object.keys(generationResults).length > 0;
    const updateData: Record<string, any> = {
      ...generationResults,
      status: hasAnyPhoto ? 'completed' : 'failed',
    };

    if (errors.length > 0) {
      updateData.generation_error = errors.join('; ');
    }

    const { data: updatedInfluencer, error: updateError } = await supabase
      .from('influencers')
      .update(updateData)
      .eq('id', influencer_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating influencer:', updateError);
      return NextResponse.json(
        { error: 'Failed to update influencer with generated photos' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      influencer: updatedInfluencer,
      generated_count: Object.keys(generationResults).length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('POST /api/influencer/generate-photoshoot error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

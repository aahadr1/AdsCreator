export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { PHOTOSHOOT_ANGLES } from '@/types/influencer';

const REPLICATE_API = 'https://api.replicate.com/v1';
const NANO_BANANA_MODEL = 'google/nano-banana';
const MAIN_COLLAGE_PROMPT = 'organize these 5 images all in the same image, intelligently';

async function getModelVersionId(token: string, model: string): Promise<string | null> {
  try {
    const res = await fetch(`${REPLICATE_API}/models/${model}`, {
      headers: { Authorization: `Token ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error(`Failed to fetch Replicate model ${model}:`, await res.text());
      return null;
    }
    const json: any = await res.json();
    const versionId = json?.latest_version?.id;
    return typeof versionId === 'string' && versionId.trim().length > 0 ? versionId.trim() : null;
  } catch (e: any) {
    console.error(`Error fetching Replicate model ${model}:`, e);
    return null;
  }
}

/**
 * POST /api/influencer/generate-photoshoot
 * Generate a complete 5-angle photoshoot for an influencer with cumulative references
 * 
 * Cumulative Generation Strategy:
 * - 1st image (face closeup): Uses only user's input images (if provided) or pure text prompt
 * - 2nd image (full body): Uses 1st generated image + user's input images
 * - 3rd image (right side): Uses 1st + 2nd generated images + user's input images
 * - 4th image (left side): Uses 1st + 2nd + 3rd generated images + user's input images
 * - 5th image (back/top): Uses all 4 previous generated images + user's input images
 * 
 * This cumulative approach ensures maximum consistency across all angles.
 * Nano Banana supports up to 14 reference images, so this works perfectly.
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
    const { influencer_id, generation_prompt, input_images, force_main_regen } = body;

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

    const nanoBananaVersionId = await getModelVersionId(String(replicateToken), NANO_BANANA_MODEL);
    if (!nanoBananaVersionId) {
      return NextResponse.json(
        { error: `Server misconfigured: could not resolve latest version for ${NANO_BANANA_MODEL}` },
        { status: 500 }
      );
    }

    // Generate 5 photos for different angles with cumulative reference images
    const generationResults: Record<string, string> = {};
    const errors: string[] = [];
    const cumulativeImages: string[] = [];

    // Start with user's input images (if provided)
    if (Array.isArray(input_images) && input_images.length > 0) {
      cumulativeImages.push(...input_images);
    }

    for (let i = 0; i < PHOTOSHOOT_ANGLES.length; i++) {
      const angle = PHOTOSHOOT_ANGLES[i];
      try {
        const fullPrompt = `${generation_prompt}. ${angle.prompt_suffix}`;
        
        const input: Record<string, any> = {
          prompt: fullPrompt,
          aspect_ratio: '9:16',
          output_format: 'jpg',
        };

        // Add cumulative images for consistency (all previous generations + user images)
        if (cumulativeImages.length > 0) {
          input.image_input = [...cumulativeImages];
          console.log(`Generating ${angle.type} for influencer ${influencer_id} with ${cumulativeImages.length} reference image(s)...`);
        } else {
          console.log(`Generating ${angle.type} for influencer ${influencer_id} (no reference images)...`);
        }

        // Create prediction
        const response = await fetch(`${REPLICATE_API}/predictions`, {
          method: 'POST',
          headers: {
            Authorization: `Token ${replicateToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'wait',
          },
          body: JSON.stringify({
            version: nanoBananaVersionId,
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
                Authorization: `Token ${replicateToken}`,
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
          
          // Add this generated image to cumulative array for next generation
          cumulativeImages.push(imageUrl);
          console.log(`  → Added to reference pool. Total references: ${cumulativeImages.length}`);
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

    // Generate and store MAIN influencer image (6th image) if we have all 5 angles.
    // Prefer newly generated URLs; fall back to existing row values (idempotency / reruns).
    const face = generationResults.photo_face_closeup || influencer.photo_face_closeup;
    const full = generationResults.photo_full_body || influencer.photo_full_body;
    const right = generationResults.photo_right_side || influencer.photo_right_side;
    const left = generationResults.photo_left_side || influencer.photo_left_side;
    const back = generationResults.photo_back_top || influencer.photo_back_top;

    const canBuildMain = !!(face && full && right && left && back);
    const shouldBuildMain = canBuildMain && (force_main_regen === true || !influencer.photo_main);

    if (shouldBuildMain) {
      try {
        const mainInput: Record<string, any> = {
          prompt: MAIN_COLLAGE_PROMPT,
          aspect_ratio: '1:1',
          output_format: 'jpg',
          image_input: [face, full, right, left, back],
        };

        const mainRes = await fetch(`${REPLICATE_API}/predictions`, {
          method: 'POST',
          headers: {
            Authorization: `Token ${replicateToken}`,
            'Content-Type': 'application/json',
            Prefer: 'wait',
          },
          body: JSON.stringify({
            version: nanoBananaVersionId,
            input: mainInput,
          }),
        });

        if (!mainRes.ok) {
          const errorText = await mainRes.text();
          console.error('Error generating MAIN influencer image:', errorText);
          errors.push(`main: ${errorText}`);
        } else {
          const prediction = await mainRes.json();

          let finalPrediction = prediction;
          let attempts = 0;
          const maxAttempts = 60;
          while (
            finalPrediction.status !== 'succeeded' &&
            finalPrediction.status !== 'failed' &&
            attempts < maxAttempts
          ) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const statusResponse = await fetch(`${REPLICATE_API}/predictions/${finalPrediction.id}`, {
              headers: { Authorization: `Token ${replicateToken}` },
            });
            if (!statusResponse.ok) {
              console.error('Error polling MAIN influencer image:', await statusResponse.text());
              break;
            }
            finalPrediction = await statusResponse.json();
            attempts++;
          }

          if (finalPrediction.status === 'succeeded' && finalPrediction.output) {
            const imageUrl = Array.isArray(finalPrediction.output)
              ? finalPrediction.output[0]
              : finalPrediction.output;
            updateData.photo_main = imageUrl;
            console.log(`✓ Generated MAIN influencer image: ${imageUrl}`);
          } else {
            const errorMsg = finalPrediction.error || 'Generation timeout or failed';
            errors.push(`main: ${errorMsg}`);
            console.error('✗ Failed to generate MAIN influencer image:', errorMsg);
          }
        }
      } catch (e: any) {
        console.error('Error generating MAIN influencer image:', e);
        errors.push(`main: ${e.message}`);
      }
    }

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

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import type { Storyboard, StoryboardScene } from '@/types/assistant';

// Replicate API helpers
async function verifyFetchable(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

function toProxyUrl(url: string): string {
  if (!url) return url;
  // If already a proxy URL, return as is
  if (url.includes('/api/proxy')) return url;
  // Otherwise, wrap it in our proxy
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adscreator.app';
  return `${baseUrl}/api/proxy?type=image&url=${encodeURIComponent(url)}`;
}

export async function POST(req: NextRequest) {
  try {
    console.log('[Generate Videos] Starting video generation request');
    
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.error('[Generate Videos] Unauthorized: No user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Generate Videos] User authenticated:', user.id);

    const body = await req.json();
    const { storyboard_id } = body;

    if (!storyboard_id) {
      console.error('[Generate Videos] Missing storyboard_id in request');
      return NextResponse.json({ error: 'Missing storyboard_id' }, { status: 400 });
    }

    console.log('[Generate Videos] Fetching storyboard:', storyboard_id);

    // Fetch the storyboard
    const { data: storyboardData, error: fetchError } = await supabase
      .from('storyboards')
      .select('*')
      .eq('id', storyboard_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !storyboardData) {
      console.error('[Generate Videos] Storyboard not found:', fetchError?.message);
      return NextResponse.json({ error: 'Storyboard not found' }, { status: 404 });
    }

    const storyboard = storyboardData as unknown as Storyboard;
    console.log('[Generate Videos] Storyboard loaded with', storyboard.scenes.length, 'scenes');

    // Validate that all scenes have first and last frames
    const invalidScenes = storyboard.scenes.filter(
      (s) => !s.first_frame_url || !s.last_frame_url
    );

    if (invalidScenes.length > 0) {
      console.error('[Generate Videos] Missing frames for scenes:', invalidScenes.map((s) => s.scene_number).join(', '));
      return NextResponse.json(
        {
          error: `Missing frames for scenes: ${invalidScenes.map((s) => s.scene_number).join(', ')}. Please ensure all frames are generated before creating videos.`,
        },
        { status: 400 }
      );
    }

    console.log('[Generate Videos] All scenes have frames, checking Replicate API token...');

    // Create a readable stream for server-sent events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const replicateToken = process.env.REPLICATE_API_TOKEN;
          if (!replicateToken) {
            console.error('[Generate Videos] REPLICATE_API_TOKEN is not set in environment variables');
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'error', message: 'Server configuration error: Replicate API token not configured. Please contact support.' })}\n\n`
              )
            );
            controller.close();
            return;
          }

          const model = 'bytedance/seedance-1.5-pro';
          const nextStoryboard: Storyboard = {
            ...storyboard,
            status: 'generating',
            scenes: storyboard.scenes.map((s) => ({
              ...s,
              video_model: model,
              video_status: 'pending',
            })),
          };

          console.log('[Generate Videos] Replicate API token found, starting generation for', nextStoryboard.scenes.length, 'scenes');

          // Send initial update
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'storyboard_update', storyboard: nextStoryboard })}\n\n`
            )
          );

          // Save initial status to database
          await supabase
            .from('storyboards')
            .update({
              status: 'generating',
              scenes: nextStoryboard.scenes,
            })
            .eq('id', storyboard_id);

          // Generate videos for each scene
          for (let idx = 0; idx < nextStoryboard.scenes.length; idx++) {
            const scene = nextStoryboard.scenes[idx];
            console.log(`[Generate Videos] Processing scene ${scene.scene_number}/${nextStoryboard.scenes.length}: ${scene.scene_name}`);
            
            const startImage = scene.first_frame_url;
            const endImage = scene.last_frame_url;
            const prompt = String(scene.video_generation_prompt || '').trim();

            // Validate frame URLs
            if (!startImage || !/^https?:\/\//i.test(startImage)) {
              console.error(`[Generate Videos] Scene ${scene.scene_number}: Invalid first_frame_url:`, startImage);
              nextStoryboard.scenes[idx] = {
                ...scene,
                video_status: 'failed',
                video_error: 'Missing or invalid first_frame_url',
              };
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'storyboard_update', storyboard: nextStoryboard })}\n\n`
                )
              );
              continue;
            }

            if (!endImage || !/^https?:\/\//i.test(endImage)) {
              nextStoryboard.scenes[idx] = {
                ...scene,
                video_status: 'failed',
                video_error: 'Missing or invalid last_frame_url',
              };
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'storyboard_update', storyboard: nextStoryboard })}\n\n`
                )
              );
              continue;
            }

            // Normalize and verify URLs
            const normalizedStartImage = toProxyUrl(startImage);
            const normalizedEndImage = toProxyUrl(endImage);
            
            console.log(`[Generate Videos] Scene ${scene.scene_number}: Verifying frame URLs...`);
            console.log(`[Generate Videos] Scene ${scene.scene_number}: Start image:`, normalizedStartImage.substring(0, 100));
            console.log(`[Generate Videos] Scene ${scene.scene_number}: End image:`, normalizedEndImage.substring(0, 100));

            const startOk = await verifyFetchable(normalizedStartImage);
            if (!startOk) {
              console.error(`[Generate Videos] Scene ${scene.scene_number}: First frame URL is unreachable:`, normalizedStartImage);
              nextStoryboard.scenes[idx] = {
                ...scene,
                video_status: 'failed',
                video_error: 'First frame URL is unreachable. Try regenerating the first frame.',
              };
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'storyboard_update', storyboard: nextStoryboard })}\n\n`
                )
              );
              continue;
            }

            const endOk = await verifyFetchable(normalizedEndImage);
            if (!endOk) {
              console.error(`[Generate Videos] Scene ${scene.scene_number}: Last frame URL is unreachable:`, normalizedEndImage);
              nextStoryboard.scenes[idx] = {
                ...scene,
                video_status: 'failed',
                video_error: 'Last frame URL is unreachable. Try regenerating the last frame.',
              };
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'storyboard_update', storyboard: nextStoryboard })}\n\n`
                )
              );
              continue;
            }
            
            console.log(`[Generate Videos] Scene ${scene.scene_number}: Frame URLs verified successfully`);

            if (!prompt) {
              nextStoryboard.scenes[idx] = {
                ...scene,
                video_status: 'failed',
                video_error: 'Missing video_generation_prompt',
              };
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'storyboard_update', storyboard: nextStoryboard })}\n\n`
                )
              );
              continue;
            }

            // Update status to generating
            nextStoryboard.scenes[idx] = { ...scene, video_status: 'generating' };
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'storyboard_update', storyboard: nextStoryboard })}\n\n`
              )
            );

            try {
              // Build enhanced prompt
              const voiceoverText = scene.voiceover_text ? String(scene.voiceover_text).trim() : '';
              const lastFrameContext = scene.last_frame_visual_elements
                ? ` Target end state should show: ${scene.last_frame_visual_elements.join(', ')}`
                : '';

              let enhancedPrompt = `${prompt}${lastFrameContext}`;

              if (voiceoverText && scene.uses_avatar) {
                enhancedPrompt += ` The person says: "${voiceoverText}". Generate natural lip movements, facial expressions, and gestures synchronized with the speech.`;
              } else if (voiceoverText) {
                enhancedPrompt += ` Voiceover: "${voiceoverText}". Generate visuals and audio that complement this narrative.`;
              }

              console.log(`[Generate Videos] Scene ${scene.scene_number}: Calling Replicate API with prompt:`, enhancedPrompt.substring(0, 150));
              console.log(`[Generate Videos] Scene ${scene.scene_number}: Duration: ${scene.duration_seconds || 3}s`);

              // Create Replicate prediction
              const replicateRes = await fetch('https://api.replicate.com/v1/predictions', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${replicateToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  version:
                    'd14bfb84e55b7ba98916c3c0fedf7ad64f0b0c4745e1fa6a4af3cf5b2084c0f4',
                  input: {
                    prompt: enhancedPrompt,
                    image: normalizedStartImage,
                    last_frame_image: normalizedEndImage,
                    video_length: scene.duration_seconds || 3,
                    enable_audio: true,
                    num_inference_steps: 50,
                    guidance_scale: 7.5,
                  },
                }),
              });

              if (!replicateRes.ok) {
                const errorText = await replicateRes.text();
                console.error(`[Generate Videos] Scene ${scene.scene_number}: Replicate API error (${replicateRes.status}):`, errorText);
                
                let userFriendlyError = 'Video generation API error';
                if (replicateRes.status === 401) {
                  userFriendlyError = 'API authentication failed. Please contact support.';
                } else if (replicateRes.status === 402) {
                  userFriendlyError = 'API quota exceeded. Please try again later.';
                } else if (replicateRes.status === 429) {
                  userFriendlyError = 'Too many requests. Please wait a moment and try again.';
                } else if (errorText) {
                  userFriendlyError = `API error: ${errorText.substring(0, 200)}`;
                }
                
                nextStoryboard.scenes[idx] = {
                  ...scene,
                  video_status: 'failed',
                  video_error: userFriendlyError,
                };
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'storyboard_update', storyboard: nextStoryboard })}\n\n`
                  )
                );
                continue;
              }

              const prediction = await replicateRes.json();
              const predictionId = prediction.id;
              
              console.log(`[Generate Videos] Scene ${scene.scene_number}: Replicate prediction created:`, predictionId);

              nextStoryboard.scenes[idx] = {
                ...scene,
                video_prediction_id: predictionId,
                video_status: 'generating',
              };

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'storyboard_update', storyboard: nextStoryboard })}\n\n`
                )
              );

              // Save prediction ID to database
              await supabase
                .from('storyboards')
                .update({
                  scenes: nextStoryboard.scenes,
                })
                .eq('id', storyboard_id);
                
              console.log(`[Generate Videos] Scene ${scene.scene_number}: Saved to database`);
            } catch (err: any) {
              console.error(`[Generate Videos] Scene ${scene.scene_number}: Unexpected error:`, err);
              nextStoryboard.scenes[idx] = {
                ...scene,
                video_status: 'failed',
                video_error: err.message || 'Unexpected error during video generation',
              };
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'storyboard_update', storyboard: nextStoryboard })}\n\n`
                )
              );
            }
          }

          // Send completion
          console.log('[Generate Videos] All scenes processed, sending completion event');
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'complete', storyboard: nextStoryboard })}\n\n`
            )
          );
          controller.close();
        } catch (error: any) {
          console.error('[Generate Videos] Fatal error in stream:', error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', message: error.message || 'Unexpected server error' })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('[Generate Videos] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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
    const supabase = createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { storyboard_id } = body;

    if (!storyboard_id) {
      return NextResponse.json({ error: 'Missing storyboard_id' }, { status: 400 });
    }

    // Fetch the storyboard
    const { data: storyboardData, error: fetchError } = await supabase
      .from('storyboards')
      .select('*')
      .eq('id', storyboard_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !storyboardData) {
      return NextResponse.json({ error: 'Storyboard not found' }, { status: 404 });
    }

    const storyboard = storyboardData as unknown as Storyboard;

    // Validate that all scenes have first and last frames
    const invalidScenes = storyboard.scenes.filter(
      (s) => !s.first_frame_url || !s.last_frame_url
    );

    if (invalidScenes.length > 0) {
      return NextResponse.json(
        {
          error: `Missing frames for scenes: ${invalidScenes.map((s) => s.scene_number).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Create a readable stream for server-sent events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const replicateToken = process.env.REPLICATE_API_TOKEN;
          if (!replicateToken) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'error', message: 'Replicate API token not configured' })}\n\n`
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
            const startImage = scene.first_frame_url;
            const endImage = scene.last_frame_url;
            const prompt = String(scene.video_generation_prompt || '').trim();

            // Validate frame URLs
            if (!startImage || !/^https?:\/\//i.test(startImage)) {
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

            const startOk = await verifyFetchable(normalizedStartImage);
            if (!startOk) {
              nextStoryboard.scenes[idx] = {
                ...scene,
                video_status: 'failed',
                video_error: 'First frame URL is unreachable',
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
              nextStoryboard.scenes[idx] = {
                ...scene,
                video_status: 'failed',
                video_error: 'Last frame URL is unreachable',
              };
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'storyboard_update', storyboard: nextStoryboard })}\n\n`
                )
              );
              continue;
            }

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
                nextStoryboard.scenes[idx] = {
                  ...scene,
                  video_status: 'failed',
                  video_error: `Replicate API error: ${errorText}`,
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
            } catch (err: any) {
              nextStoryboard.scenes[idx] = {
                ...scene,
                video_status: 'failed',
                video_error: err.message || 'Failed to start video generation',
              };
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'storyboard_update', storyboard: nextStoryboard })}\n\n`
                )
              );
            }
          }

          // Send completion
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'complete', storyboard: nextStoryboard })}\n\n`
            )
          );
          controller.close();
        } catch (error: any) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`
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

export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { PHOTOSHOOT_ANGLES } from '@/types/influencer';
import { createR2Client, ensureR2Bucket, r2PutObject } from '@/lib/r2';

const REPLICATE_API = 'https://api.replicate.com/v1';
const NANO_BANANA_MODEL = 'google/nano-banana';
const MAIN_COLLAGE_PROMPT =
  'Create a clean square collage from the 5 provided studio photos. Keep each photo unmodified and photorealistic. Arrange them in a neat grid layout with thin white gutters, balanced spacing, and consistent framing. No text, no logos, no watermarks.';

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test((s || '').trim());
}

function getPublicAppOrigin(): string | null {
  const candidate =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    null;
  if (!candidate) return null;
  try {
    const u = new URL(candidate);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function toAbsoluteFromApp(url: string, appOrigin: string | null): string {
  const u = String(url || '').trim();
  if (!u) return u;
  if (isHttpUrl(u)) return u;
  if (!appOrigin) return u;
  if (u.startsWith('/')) return `${appOrigin}${u}`;
  return u;
}

function guessExtFromContentType(contentType: string | null): string {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  return 'bin';
}

async function persistToR2FromUrl(params: { url: string; keyPrefix: string; cacheControl?: string | null }): Promise<string> {
  const { url, keyPrefix, cacheControl } = params;
  const inputUrl = String(url || '').trim();
  if (!isHttpUrl(inputUrl)) return inputUrl;

  const r2AccountId = process.env.R2_ACCOUNT_ID || '';
  const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  const r2Endpoint = process.env.R2_S3_ENDPOINT || null;
  const bucket = process.env.R2_BUCKET || 'assets';

  // If R2 isn't configured, fail in production (we must not store ephemeral URLs).
  if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing R2 credentials: cannot persist influencer photos');
    }
    return inputUrl;
  }

  const res = await fetch(inputUrl, { cache: 'no-store' });
  if (!res.ok) return inputUrl;
  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const ext = guessExtFromContentType(contentType);
  const safePrefix = keyPrefix.replace(/[^a-zA-Z0-9/_-]/g, '_').replace(/\/{2,}/g, '/');
  const key = `${safePrefix}.${ext}`;

  const r2 = createR2Client({ accountId: r2AccountId, accessKeyId: r2AccessKeyId, secretAccessKey: r2SecretAccessKey, bucket, endpoint: r2Endpoint });
  await ensureR2Bucket(r2, bucket);
  await r2PutObject({
    client: r2,
    bucket,
    key,
    body: new Uint8Array(arrayBuffer),
    contentType,
    cacheControl: cacheControl || process.env.R2_UPLOAD_CACHE_CONTROL || 'public, max-age=31536000',
  });

  // Store RELATIVE URL for stability across environments.
  return `/api/r2/get?key=${encodeURIComponent(key)}`;
}

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

async function pollPrediction({
  replicateToken,
  predictionId,
  label,
}: {
  replicateToken: string;
  predictionId: string;
  label: string;
}): Promise<{ status: string; output?: any; error?: string }> {
  let attempts = 0;
  const maxAttempts = 90; // 90 * 2 seconds = 3 minutes max

  while (attempts < maxAttempts) {
    const statusResponse = await fetch(`${REPLICATE_API}/predictions/${predictionId}`, {
      headers: { Authorization: `Token ${replicateToken}` },
      cache: 'no-store',
    });
    if (!statusResponse.ok) {
      const t = await statusResponse.text();
      console.error(`Error polling ${label}:`, t);
      return { status: 'failed', error: t };
    }
    const json = await statusResponse.json();
    const status = String(json?.status || '');
    if (status === 'succeeded' || status === 'failed' || status === 'canceled') {
      return { status, output: json?.output, error: json?.error };
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    attempts++;
  }

  return { status: 'failed', error: 'timeout' };
}

async function generateImageWithNanoBanana({
  replicateToken,
  nanoBananaVersionId,
  prompt,
  aspect_ratio,
  image_input,
  label,
}: {
  replicateToken: string;
  nanoBananaVersionId: string;
  prompt: string;
  aspect_ratio: string;
  image_input?: string[];
  label: string;
}): Promise<{ url?: string; error?: string }> {
  const input: Record<string, any> = {
    prompt,
    aspect_ratio,
    output_format: 'jpg',
  };
  if (Array.isArray(image_input) && image_input.length > 0) {
    input.image_input = image_input;
  }

  const res = await fetch(`${REPLICATE_API}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${replicateToken}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({
      version: nanoBananaVersionId,
      input,
    }),
  });

  if (!res.ok) return { error: await res.text() };
  const created = await res.json();
  const id = String(created?.id || '').trim();
  if (!id) return { error: 'Replicate returned no prediction id' };

  const final = await pollPrediction({ replicateToken, predictionId: id, label });
  if (final.status !== 'succeeded' || !final.output) {
    return { error: final.error || 'Generation failed' };
  }

  const url = Array.isArray(final.output) ? final.output[0] : final.output;
  return { url: typeof url === 'string' ? url : String(url || '') };
}

async function runInfluencerPhotoshootInBackground(params: {
  influencerId: string;
  userId: string;
  generationPrompt: string;
  inputImages: string[] | null;
  forceMainRegen: boolean;
  replicateToken: string;
  nanoBananaVersionId: string;
}) {
  const supabase = createSupabaseServer();
  const appOrigin = getPublicAppOrigin();
  const {
    influencerId,
    userId,
    generationPrompt,
    inputImages,
    forceMainRegen,
    replicateToken,
    nanoBananaVersionId,
  } = params;

  const { data: influencer, error: fetchError } = await supabase
    .from('influencers')
    .select('*')
    .eq('id', influencerId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !influencer) {
    console.error('[Influencer Photoshoot] Influencer not found for background job:', fetchError);
    return;
  }

  const errors: string[] = [];
  const cumulativeImages: string[] = [];
  if (Array.isArray(inputImages) && inputImages.length > 0) cumulativeImages.push(...inputImages);

  // Include any previously-generated angle photos as references (resume support)
  const existingAngleUrls: string[] = [
    influencer.photo_face_closeup,
    influencer.photo_full_body,
    influencer.photo_right_side,
    influencer.photo_left_side,
    influencer.photo_back_top,
  ].filter(Boolean);
  for (const u of existingAngleUrls) {
    if (typeof u === 'string' && u.length > 0) cumulativeImages.push(toAbsoluteFromApp(u, appOrigin));
  }

  // Generate missing angles sequentially; update DB after each success so UI can display instantly.
  for (let i = 0; i < PHOTOSHOOT_ANGLES.length; i++) {
    const angle = PHOTOSHOOT_ANGLES[i];

    // Skip if already present (resume/idempotent)
    const already = influencer[angle.field_name];
    if (typeof already === 'string' && already.trim().length > 0) continue;

    try {
      const fullPrompt = `${generationPrompt}. ${angle.prompt_suffix}`;
      const out = await generateImageWithNanoBanana({
        replicateToken,
        nanoBananaVersionId,
        prompt: fullPrompt,
        aspect_ratio: '9:16',
        image_input: cumulativeImages.length > 0 ? cumulativeImages : undefined,
        label: angle.type,
      });

      if (!out.url || !out.url.trim()) {
        errors.push(`${angle.type}: ${out.error || 'unknown error'}`);
        continue;
      }

      const rawUrl = out.url.trim();
      const persistedRelative = await persistToR2FromUrl({
        url: rawUrl,
        keyPrefix: `influencers/${influencerId}/${angle.type}-${Date.now()}`,
        cacheControl: 'public, max-age=31536000',
      });
      const persistedAbsoluteForRefs = toAbsoluteFromApp(persistedRelative, appOrigin);
      // Use stable URL for downstream references whenever possible.
      cumulativeImages.push(isHttpUrl(persistedAbsoluteForRefs) ? persistedAbsoluteForRefs : rawUrl);

      await supabase
        .from('influencers')
        .update({
          // Store stable R2-backed URL (relative to our app).
          [angle.field_name]: persistedRelative,
          status: 'generating',
          generation_error: errors.length > 0 ? errors.join('; ') : null,
        })
        .eq('id', influencerId)
        .eq('user_id', userId);
    } catch (e: any) {
      errors.push(`${angle.type}: ${e?.message || 'unknown error'}`);
      await supabase
        .from('influencers')
        .update({
          status: 'generating',
          generation_error: errors.join('; '),
        })
        .eq('id', influencerId)
        .eq('user_id', userId);
    }
  }

  // Reload to compute MAIN using persisted URLs (also covers resume runs)
  const { data: afterAngles } = await supabase
    .from('influencers')
    .select('*')
    .eq('id', influencerId)
    .eq('user_id', userId)
    .single();

  const face = afterAngles?.photo_face_closeup;
  const full = afterAngles?.photo_full_body;
  const right = afterAngles?.photo_right_side;
  const left = afterAngles?.photo_left_side;
  const back = afterAngles?.photo_back_top;

  const hasAll5 = !!(face && full && right && left && back);
  const shouldBuildMain = hasAll5 && (forceMainRegen || !afterAngles?.photo_main);

  if (shouldBuildMain) {
    const refs = [face, full, right, left, back].map((u) => toAbsoluteFromApp(String(u || ''), appOrigin));
    const out = await generateImageWithNanoBanana({
      replicateToken,
      nanoBananaVersionId,
      prompt: MAIN_COLLAGE_PROMPT,
      aspect_ratio: '1:1',
      image_input: refs,
      label: 'main',
    });

    if (out.url && out.url.trim().length > 0) {
      const persistedRelative = await persistToR2FromUrl({
        url: out.url.trim(),
        keyPrefix: `influencers/${influencerId}/main-${Date.now()}`,
        cacheControl: 'public, max-age=31536000',
      });
      await supabase
        .from('influencers')
        .update({
          photo_main: persistedRelative,
          generation_error: errors.length > 0 ? errors.join('; ') : null,
        })
        .eq('id', influencerId)
        .eq('user_id', userId);
    } else if (out.error) {
      errors.push(`main: ${out.error}`);
      await supabase
        .from('influencers')
        .update({
          generation_error: errors.join('; '),
        })
        .eq('id', influencerId)
        .eq('user_id', userId);
    }
  }

  // Finalize status
  const { data: finalRow } = await supabase
    .from('influencers')
    .select('photo_face_closeup,photo_full_body,photo_right_side,photo_left_side,photo_back_top,photo_main')
    .eq('id', influencerId)
    .eq('user_id', userId)
    .single();

  const anyPhoto =
    !!finalRow?.photo_face_closeup ||
    !!finalRow?.photo_full_body ||
    !!finalRow?.photo_right_side ||
    !!finalRow?.photo_left_side ||
    !!finalRow?.photo_back_top ||
    !!finalRow?.photo_main;

  await supabase
    .from('influencers')
    .update({
      status: anyPhoto ? 'completed' : 'failed',
      generation_error: errors.length > 0 ? errors.join('; ') : null,
    })
    .eq('id', influencerId)
    .eq('user_id', userId);
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

    // Update status to generating immediately (so UI can start polling instantly)
    await supabase
      .from('influencers')
      .update({ status: 'generating', generation_error: null })
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

    // Kickoff background generation so the client can navigate away safely.
    // The UI can poll `/api/influencer` and will see photos appear as they are saved.
    void runInfluencerPhotoshootInBackground({
      influencerId: String(influencer_id),
      userId: String(user.id),
      generationPrompt: String(generation_prompt),
      inputImages: Array.isArray(input_images) ? input_images : null,
      forceMainRegen: force_main_regen === true,
      replicateToken: String(replicateToken),
      nanoBananaVersionId: String(nanoBananaVersionId),
    }).catch((e) => {
      console.error('[Influencer Photoshoot] Background job crashed:', e);
    });

    return NextResponse.json({ started: true, influencer_id: String(influencer_id) }, { status: 202 });
  } catch (error: any) {
    console.error('POST /api/influencer/generate-photoshoot error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

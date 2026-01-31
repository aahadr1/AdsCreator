export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { createR2Client, ensureR2Bucket, r2PutObject } from '@/lib/r2';

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test((s || '').trim());
}

function guessExtFromContentType(contentType: string | null): string {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  return 'bin';
}

async function persistToR2FromUrl(params: { url: string; keyPrefix: string }): Promise<string> {
  const inputUrl = String(params.url || '').trim();
  if (!isHttpUrl(inputUrl)) return inputUrl;

  const r2AccountId = process.env.R2_ACCOUNT_ID || '';
  const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  const r2Endpoint = process.env.R2_S3_ENDPOINT || null;
  const bucket = process.env.R2_BUCKET || 'assets';
  const cacheControl = process.env.R2_UPLOAD_CACHE_CONTROL || 'public, max-age=31536000';

  if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) return inputUrl;

  const res = await fetch(inputUrl, { cache: 'no-store' });
  if (!res.ok) return inputUrl;
  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const ext = guessExtFromContentType(contentType);
  const safePrefix = params.keyPrefix.replace(/[^a-zA-Z0-9/_-]/g, '_').replace(/\/{2,}/g, '/');
  const key = `${safePrefix}.${ext}`;

  const r2 = createR2Client({
    accountId: r2AccountId,
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
    bucket,
    endpoint: r2Endpoint,
  });
  await ensureR2Bucket(r2, bucket);
  await r2PutObject({
    client: r2,
    bucket,
    key,
    body: new Uint8Array(arrayBuffer),
    contentType,
    cacheControl,
  });

  return `/api/r2/get?key=${encodeURIComponent(key)}`;
}

/**
 * POST /api/influencer/persist-photos
 * Body: { influencer_id: string }
 *
 * Converts existing remote URLs (e.g. replicate.delivery) into stable R2-backed URLs.
 * Safe to call multiple times.
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
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const influencerId = String(body?.influencer_id || '').trim();
    if (!influencerId) return NextResponse.json({ error: 'Missing influencer_id' }, { status: 400 });

    const { data: influencer, error: fetchError } = await supabase
      .from('influencers')
      .select('*')
      .eq('id', influencerId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !influencer) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
    }

    const fields = [
      'photo_face_closeup',
      'photo_full_body',
      'photo_right_side',
      'photo_left_side',
      'photo_back_top',
      'photo_main',
    ] as const;

    const updates: Record<string, string> = {};
    for (const field of fields) {
      const current = String((influencer as any)[field] || '').trim();
      if (!current) continue;
      // Already persisted (/api/r2/get) or some other internal path.
      if (!isHttpUrl(current)) continue;
      const persisted = await persistToR2FromUrl({
        url: current,
        keyPrefix: `influencers/${influencerId}/backfill/${field}-${Date.now()}`,
      });
      if (persisted && persisted !== current) updates[field] = persisted;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true, influencer, updated: false });
    }

    const { data: updated, error: updateError } = await supabase
      .from('influencers')
      .update(updates)
      .eq('id', influencerId)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: 'Failed to persist photos' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, influencer: updated, updated: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}


import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Replicate from 'replicate';

export const runtime = 'nodejs';

type MediaKind = 'image' | 'video';

async function generateDescription({ url, kind, replicate }: { url: string; kind: MediaKind; replicate: Replicate }): Promise<string> {
  // Apollo 7B ONLY for videos
  if (kind !== 'video') {
    throw new Error('Only video analysis is supported');
  }
  try {
    // Resolve latest version id to avoid 404s on model slug
    const token = process.env.REPLICATE_API_TOKEN as string;
    const modelRes = await fetch('https://api.replicate.com/v1/models/lucataco/apollo-7b', {
      headers: { Authorization: `Token ${token}` },
      cache: 'no-store',
    });
    if (!modelRes.ok) {
      const text = await modelRes.text().catch(() => '');
      throw new Error(text || `Failed to resolve model version (${modelRes.status})`);
    }
    const modelJson = await modelRes.json();
    const versionId = modelJson?.latest_version?.id as string | undefined;
    if (!versionId) throw new Error('No latest version found for lucataco/apollo-7b');

    const out = await replicate.run(`lucataco/apollo-7b:${versionId}`, {
      input: {
        video: url,
        prompt: '1) Briefly describe what happens in the video in 2–3 sentences. 2) Then, in exactly one sentence, state what this video is. Plain text only.',
        temperature: 0.4,
        max_new_tokens: 256,
        top_p: 0.7,
      },
    });
    const text = typeof out === 'string' ? out : Array.isArray(out) ? out.join('\n') : JSON.stringify(out);
    return String(text).trim().replace(/\s+/g, ' ');
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Apollo call failed';
    throw new Error(message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) return new Response('Server misconfigured: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY', { status: 500 });

    const replicateToken = process.env.REPLICATE_API_TOKEN || '';
    if (!replicateToken) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });
    const replicate = new Replicate({ auth: replicateToken });

    const body = await req.json() as { asset_id?: string; storage_path?: string; public_url?: string; type?: MediaKind; dry_run?: boolean };
    const { asset_id, storage_path, public_url, type, dry_run } = body || {};

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // Resolve the asset and URL
    let asset: any = null;
    if (asset_id) {
      const { data, error } = await supabase.from('media_assets').select('*').eq('id', asset_id).single();
      if (error) return new Response(`Asset fetch error: ${error.message}`, { status: 404 });
      asset = data;
    } else if (storage_path) {
      const { data, error } = await supabase.from('media_assets').select('*').eq('storage_path', storage_path).single();
      if (error) return new Response(`Asset fetch error: ${error.message}`, { status: 404 });
      asset = data;
    }

    const url = public_url || asset?.public_url || '';
    if (!url) return new Response('Asset URL not found', { status: 404 });

    const inferKind = (u: string, fallback: MediaKind): MediaKind => {
      const lower = u.toLowerCase();
      if (/\.(png|jpg|jpeg|webp|gif)(\?|$)/.test(lower)) return 'image';
      if (/\.(mp4|mov|webm|m4v)(\?|$)/.test(lower)) return 'video';
      return fallback;
    };
    const kind: MediaKind = (type || inferKind(url, (asset?.type as MediaKind) || 'video')) as MediaKind;
    if (kind !== 'video') return new Response('Only video assets are supported for analysis', { status: 400 });

    // Generate a concise description
    const description = await generateDescription({ url, kind, replicate });
    if (dry_run) return Response.json({ ok: true, description });

    // Persist results
    const assetId = asset?.id || asset_id || null;
    if (!assetId) return new Response('Asset id missing', { status: 400 });

    // Persist: ensure a single description row by replacing any existing
    try { await supabase.from('media_descriptions').delete().eq('asset_id', assetId); } catch {}
    try { if (description) await supabase.from('media_descriptions').insert({ asset_id: assetId, description, source: 'replicate' }); } catch {}
    try { await supabase.from('media_assets').update({ status: 'ready' }).eq('id', assetId); } catch {}

    return Response.json({ ok: true, asset_id: assetId, description });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}




import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const bucket = process.env.SUPABASE_BUCKET || 'assets';
    const publicBucket = (process.env.SUPABASE_BUCKET_PUBLIC || 'true').toLowerCase() === 'true';
    if (!supabaseUrl || !serviceRoleKey) return new Response('Server misconfigured: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY', { status: 500 });

    const body = await req.json() as { url?: string; filename?: string | null; folder?: string | null } | null;
    const url = (body?.url || '').trim();
    if (!url) return new Response('Missing url', { status: 400 });

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    // Ensure bucket
    try {
      const { data: bucketInfo } = await supabase.storage.getBucket(bucket);
      if (!bucketInfo) await supabase.storage.createBucket(bucket, { public: publicBucket });
    } catch {}

    // Fetch
    const res = await fetch(url);
    if (!res.ok) return new Response(`Fetch failed: ${res.statusText}`, { status: 400 });
    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'application/octet-stream';

    // Path
    const folder = (body?.folder || 'outputs').replace(/[^a-zA-Z0-9_\/-]/g, '_');
    const namePart = (body?.filename || url.split('/').pop() || 'file').split('?')[0].replace(/[^a-zA-Z0-9_.-]/g, '_');
    const path = `${folder}/${Date.now()}-${namePart}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, new Uint8Array(arrayBuffer), { upsert: false, cacheControl: '31536000', contentType });
    if (uploadError) return new Response(`Upload failed: ${uploadError.message}`, { status: 500 });

    const publicUrl = publicBucket
      ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
      : (await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365)).data?.signedUrl || '';

    return Response.json({ url: publicUrl, path, bucket });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}






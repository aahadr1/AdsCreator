import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function detectTypeFromMime(mime: string): 'image' | 'video' {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  return /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(m) ? 'image' : 'video';
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const bucket = process.env.SUPABASE_ASSETS_BUCKET || 'assets';
    const publicBucket = (process.env.SUPABASE_BUCKET_PUBLIC || 'true').toLowerCase() === 'true';
    if (!supabaseUrl || !serviceRoleKey) return new Response('Server misconfigured: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY', { status: 500 });

    const form = await req.formData();
    // Resolve user from Authorization header if provided
    let userId: string | null = null;
    try {
      const authHeader = req.headers.get('authorization') || '';
      const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : '';
      if (token) {
        const authSb = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
        const { data: { user } } = await authSb.auth.getUser();
        if (user?.id) userId = user.id;
      }
    } catch {}
    const file = form.get('file');
    const filename = form.get('filename') as string | null;
    if (!file || !(file instanceof Blob)) return new Response('No file provided', { status: 400 });

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    try {
      let { data: bucketInfo } = await supabase.storage.getBucket(bucket);
      if (!bucketInfo) {
        // Attempt to create (requires service role). Ignore errors but verify existence after.
        await supabase.storage.createBucket(bucket, { public: publicBucket }).catch(() => {});
        const check = await supabase.storage.getBucket(bucket);
        bucketInfo = check.data as any;
        if (!bucketInfo) {
          return new Response(
            `Bucket missing: "${bucket}" does not exist and could not be created. ` +
              `Create it in Supabase Storage or set SUPABASE_SERVICE_ROLE_KEY on the server.`,
            { status: 500 },
          );
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return new Response(`Bucket check failed: ${message}`, { status: 500 });
    }

    const safeName = (filename || (typeof (file as any).name === 'string' ? (file as any).name : 'upload.bin')).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const path = `uploads/${Date.now()}-${safeName}`;
    const arrayBuffer = await file.arrayBuffer();
    const contentType = (file as any).type || 'application/octet-stream';
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, new Uint8Array(arrayBuffer), { upsert: false, cacheControl: '3600', contentType });
    if (uploadError) return new Response(`Upload failed: ${uploadError.message}`, { status: 500 });

    const publicUrl = publicBucket ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : (await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60)).data?.signedUrl || '';
    const type = detectTypeFromMime(contentType);

    // Create media_assets row
    const { data: asset, error } = await supabase
      .from('media_assets')
      .insert({ storage_path: path, bucket, type, mime_type: contentType, public_url: publicUrl, status: 'pending', created_by: userId })
      .select('*')
      .single();
    if (error) return new Response(error.message, { status: 500 });

    return Response.json({ ok: true, id: asset.id, url: publicUrl, path, type, mime: contentType });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}



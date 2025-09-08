import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const bucket = process.env.SUPABASE_BUCKET || 'inputs';
    const publicBucket = (process.env.SUPABASE_BUCKET_PUBLIC || 'true').toLowerCase() === 'true';

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response('Server misconfigured: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY', { status: 500 });
    }

    const form = await req.formData();
    const file = form.get('file');
    const filename = form.get('filename') as string | null;
    if (!file || !(file instanceof Blob)) {
      return new Response('No file provided', { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // Ensure bucket exists (auto-create if missing). Don't hard-fail if create errors (e.g., already exists).
    try {
      const { data: bucketInfo } = await supabase.storage.getBucket(bucket);
      if (!bucketInfo) {
        await supabase.storage.createBucket(bucket, { public: publicBucket });
      }
    } catch (_) {
      // Ignore; proceed to upload. If bucket truly doesn't exist, upload will error with a clear message.
    }

    const fileExt = typeof (file as any).name === 'string' ? (file as any).name.split('.').pop() : (filename || 'bin').split('.').pop();
    const safeName = (filename || (typeof (file as any).name === 'string' ? (file as any).name : `upload.${fileExt}`))
      .replace(/[^a-zA-Z0-9_.-]/g, '_');
    const path = `inputs/${Date.now()}-${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const contentType = (file as any).type || 'application/octet-stream';
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, new Uint8Array(arrayBuffer), { upsert: false, cacheControl: '3600', contentType });

    if (uploadError) {
      return new Response(`Upload failed: ${uploadError.message}`, { status: 500 });
    }

    if (publicBucket) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return Response.json({ url: data.publicUrl, path });
    } else {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
      if (error) return new Response(`Signed URL failed: ${error.message}`, { status: 500 });
      return Response.json({ url: data.signedUrl, path });
    }
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}

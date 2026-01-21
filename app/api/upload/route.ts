import { NextRequest } from 'next/server';
import { createR2Client, ensureR2Bucket, r2PutObject, r2PublicUrl } from '@/lib/r2';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const origin = new URL(req.url).origin;
    const r2AccountId = process.env.R2_ACCOUNT_ID || '';
    const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
    // Use the same default bucket as the rest of the app (and /api/r2/get).
    const bucket = process.env.R2_BUCKET || 'assets';
    const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL || null;
    const cacheControl = process.env.R2_UPLOAD_CACHE_CONTROL || '3600';

    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) {
      return new Response('Server misconfigured: missing R2 credentials', { status: 500 });
    }

    const form = await req.formData();
    const file = form.get('file');
    const filename = form.get('filename') as string | null;
    if (!file || !(file instanceof Blob)) {
      return new Response('No file provided', { status: 400 });
    }

    const r2 = createR2Client({ accountId: r2AccountId, accessKeyId: r2AccessKeyId, secretAccessKey: r2SecretAccessKey, bucket, publicBaseUrl });
    try {
      await ensureR2Bucket(r2, bucket);
    } catch (err: any) {
      // If bucket already exists or caller lacks create permissions, continue and attempt upload.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('ensureR2Bucket skipped:', err?.message || err);
      }
    }

    const fileExt = typeof (file as any).name === 'string' ? (file as any).name.split('.').pop() : (filename || 'bin').split('.').pop();
    const safeName = (filename || (typeof (file as any).name === 'string' ? (file as any).name : `upload.${fileExt}`))
      .replace(/[^a-zA-Z0-9_.-]/g, '_');
    const path = `inputs/${Date.now()}-${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const contentType = (file as any).type || 'application/octet-stream';
    await r2PutObject({ client: r2, bucket, key: path, body: new Uint8Array(arrayBuffer), contentType, cacheControl });

    // Prefer proxy URL for reliability (works even if R2 public bucket is private/misconfigured).
    const proxyUrl = `${origin.replace(/\/$/, '')}/api/r2/get?key=${encodeURIComponent(path)}`;
    const publicUrl = r2PublicUrl({ publicBaseUrl, bucket, key: path }) || '';
    return Response.json({ url: proxyUrl, proxyUrl, publicUrl, path });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}

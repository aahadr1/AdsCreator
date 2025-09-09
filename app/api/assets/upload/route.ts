import { NextRequest } from 'next/server';
import { createR2Client, ensureR2Bucket, r2PutObject, r2PublicUrl } from '../../../lib/r2';

export const runtime = 'nodejs';

function detectTypeFromMime(mime: string): 'image' | 'video' {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  return /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(m) ? 'image' : 'video';
}

export async function POST(req: NextRequest) {
  try {
    const r2AccountId = process.env.R2_ACCOUNT_ID || '';
    const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
    const r2Endpoint = process.env.R2_S3_ENDPOINT || null;
    const bucket = process.env.R2_BUCKET || 'assets';
    const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL || null;
    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) return new Response('Server misconfigured: missing R2 credentials', { status: 500 });

    const form = await req.formData();
    const file = form.get('file');
    const filename = form.get('filename') as string | null;
    if (!file || !(file instanceof Blob)) return new Response('No file provided', { status: 400 });

    const r2 = createR2Client({ accountId: r2AccountId, accessKeyId: r2AccessKeyId, secretAccessKey: r2SecretAccessKey, bucket, endpoint: r2Endpoint });
    await ensureR2Bucket(r2, bucket);

    const safeName = (filename || (typeof (file as any).name === 'string' ? (file as any).name : 'upload.bin')).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const path = `uploads/${Date.now()}-${safeName}`;
    const arrayBuffer = await file.arrayBuffer();
    const contentType = (file as any).type || 'application/octet-stream';
    await r2PutObject({ client: r2, bucket, key: path, body: new Uint8Array(arrayBuffer), contentType, cacheControl: '3600' });
    const publicUrl = r2PublicUrl({ publicBaseUrl, bucket, key: path }) || '';
    const type = detectTypeFromMime(contentType);

    return Response.json({ ok: true, url: publicUrl, path, type, mime: contentType });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}



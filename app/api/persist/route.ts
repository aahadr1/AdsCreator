import { NextRequest } from 'next/server';
import { createR2Client, ensureR2Bucket, r2PutObject, r2PublicUrl } from '@/lib/r2';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const origin = new URL(req.url).origin;
    const r2AccountId = process.env.R2_ACCOUNT_ID || '';
    const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
    const r2Endpoint = process.env.R2_S3_ENDPOINT || null;
    const bucket = process.env.R2_BUCKET || 'assets';
    const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL || null;
    const cacheControl = '31536000';
    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) return new Response('Server misconfigured: missing R2 credentials', { status: 500 });

    const body = await req.json() as { url?: string; filename?: string | null; folder?: string | null } | null;
    const url = (body?.url || '').trim();
    if (!url) return new Response('Missing url', { status: 400 });

    const r2 = createR2Client({ accountId: r2AccountId, accessKeyId: r2AccessKeyId, secretAccessKey: r2SecretAccessKey, bucket, endpoint: r2Endpoint });
    await ensureR2Bucket(r2, bucket);

    // Fetch
    const res = await fetch(url);
    if (!res.ok) return new Response(`Fetch failed: ${res.statusText}`, { status: 400 });
    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'application/octet-stream';

    // Path
    const folder = (body?.folder || 'outputs').replace(/[^a-zA-Z0-9_\/-]/g, '_');
    const namePart = (body?.filename || url.split('/').pop() || 'file').split('?')[0].replace(/[^a-zA-Z0-9_.-]/g, '_');
    const path = `${folder}/${Date.now()}-${namePart}`;

    await r2PutObject({ client: r2, bucket, key: path, body: new Uint8Array(arrayBuffer), contentType, cacheControl });
    // IMPORTANT: For maximum reliability (and for 3rd-party providers like Replicate),
    // return a stable app proxy URL that always works even if the R2 public bucket is not configured.
    const proxyUrl = `${origin.replace(/\/$/, '')}/api/r2/get?key=${encodeURIComponent(path)}`;
    const publicUrl = r2PublicUrl({ publicBaseUrl, bucket, key: path }) || '';

    return Response.json({ url: proxyUrl, proxyUrl, publicUrl, path, bucket });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}






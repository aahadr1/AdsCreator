import { NextRequest } from 'next/server';
import { createR2Client, ensureR2Bucket, r2GetObject } from '@/lib/r2';

export const runtime = 'nodejs';

function sanitizeKey(input: string): string | null {
  const key = (input || '').trim().replace(/^\/+/, '');
  if (!key) return null;
  if (key.includes('..')) return null;
  return key;
}

export async function GET(req: NextRequest) {
  try {
    const r2AccountId = process.env.R2_ACCOUNT_ID || '';
    const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
    const r2Endpoint = process.env.R2_S3_ENDPOINT || null;
    const bucket = process.env.R2_BUCKET || 'assets';
    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) {
      return new Response('Server misconfigured: missing R2 credentials', { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const keyRaw = searchParams.get('key') || '';
    const key = sanitizeKey(keyRaw);
    if (!key) return new Response('Missing or invalid key', { status: 400 });

    const r2 = createR2Client({
      accountId: r2AccountId,
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
      bucket,
      endpoint: r2Endpoint,
    });
    await ensureR2Bucket(r2, bucket);

    const obj = await r2GetObject({ client: r2, bucket, key });
    const headers: Record<string, string> = {
      'Cache-Control': obj.cacheControl || '31536000',
      'Content-Type': obj.contentType || 'application/octet-stream',
    };
    // Next.js/undici Response typing can be picky; Buffer is a safe BodyInit in node runtime.
    return new Response(Buffer.from(obj.body), { status: 200, headers });
  } catch (e: any) {
    const msg = e?.message || 'Internal error';
    // Avoid leaking internal details for common not-found cases
    if (String(msg).toLowerCase().includes('nosuchkey') || String(msg).toLowerCase().includes('notfound')) {
      return new Response('Not found', { status: 404 });
    }
    return new Response(`Error: ${msg}`, { status: 500 });
  }
}


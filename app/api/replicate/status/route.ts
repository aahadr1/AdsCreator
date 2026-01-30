import { NextRequest } from 'next/server';
import { createR2Client, ensureR2Bucket, r2PutObject, r2PublicUrl } from '@/lib/r2';

const REPLICATE_API = 'https://api.replicate.com/v1';

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

async function persistToR2FromUrl(params: { url: string; keyPrefix: string; origin: string }): Promise<string> {
  const { url, keyPrefix } = params;
  if (!isHttpUrl(url)) return url;

  const r2AccountId = process.env.R2_ACCOUNT_ID || '';
  const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  const r2Endpoint = process.env.R2_S3_ENDPOINT || null;
  const bucket = process.env.R2_BUCKET || 'assets';
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL || null;

  // If R2 isn't configured, return original URL.
  if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) return url;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return url;
  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const ext = guessExtFromContentType(contentType);
  // Keep keys filesystem-friendly to avoid weird encoding in object names.
  const safePrefix = keyPrefix.replace(/[^a-zA-Z0-9/_-]/g, '_').replace(/\/{2,}/g, '/');
  const key = `${safePrefix}.${ext}`;

  const r2 = createR2Client({ accountId: r2AccountId, accessKeyId: r2AccessKeyId, secretAccessKey: r2SecretAccessKey, bucket, endpoint: r2Endpoint });
  await ensureR2Bucket(r2, bucket);
  await r2PutObject({ client: r2, bucket, key, body: new Uint8Array(arrayBuffer), contentType, cacheControl: '31536000' });

  // Prefer our stable app endpoint for reliability.
  // IMPORTANT: return a RELATIVE URL so we don't depend on potentially-wrong Host/origin (e.g. 0.0.0.0).
  return `/api/r2/get?key=${encodeURIComponent(key)}`;
}

export async function GET(req: NextRequest) {
  try {
    const origin = new URL(req.url).origin;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return new Response('Missing id', { status: 400 });

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });

    const res = await fetch(`${REPLICATE_API}/predictions/${id}`, {
      headers: { 'Authorization': `Token ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return new Response(await res.text(), { status: res.status });
    const json = await res.json();

    // Normalize outputs (Replicate can return string, array, or object with url/image)
    let outputUrl: string | null = null;
    const out = json.output;
    if (typeof out === 'string') outputUrl = out;
    else if (Array.isArray(out)) outputUrl = typeof out[0] === 'string' ? out[0] : null;
    else if (out && typeof out === 'object') {
      if (typeof out.url === 'string') outputUrl = out.url;
      else if (typeof out.image === 'string') outputUrl = out.image;
      else if (typeof out.output === 'string') outputUrl = out.output;
    }

    const statusLower = String(json.status || '').toLowerCase();

    // If succeeded, persist the output to R2 so we never rely on replicate.delivery URLs.
    if (statusLower === 'succeeded' && outputUrl) {
      const pid = String(json.id || id);
      const persisted = await persistToR2FromUrl({ url: outputUrl, keyPrefix: `replicate/outputs/${pid}`, origin });
      outputUrl = persisted || outputUrl;
    }

    // Only send error when prediction actually failed/canceled - Replicate often puts logs in error/logs even on success
    const errorForClient =
      statusLower === 'failed' || statusLower === 'canceled'
        ? (json.error || json.logs || null)
        : null;

    return Response.json({ id: json.id, status: json.status, outputUrl, error: errorForClient });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}



export {}
import { NextRequest } from 'next/server';
import { SyncClient, SyncError } from '@sync.so/sdk';

export const runtime = 'nodejs';

const REPLICATE_API = 'https://api.replicate.com/v1';

async function getLatestVersionId(modelSlug: string, token: string): Promise<string | null> {
  const res = await fetch(`${REPLICATE_API}/models/${modelSlug}/versions?limit=1`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const json = await res.json();
  const id = json?.results?.[0]?.id || json?.versions?.[0]?.id || null;
  return id;
}

async function upscaleWithEsrgan(inputUrl: string, token: string): Promise<string | null> {
  const FALLBACK_ESRGAN_MODELS = [
    process.env.REPLICATE_ESRGAN_MODEL,
    'nightmareai/real-esrgan',
    'cjwbw/real-esrgan'
  ].filter(Boolean) as string[];

  let version: string | null = process.env.REPLICATE_ESRGAN_VERSION || null;
  if (!version) {
    for (const slug of FALLBACK_ESRGAN_MODELS) {
      const v = await getLatestVersionId(slug, token);
      if (v) { version = v; break; }
    }
  }
  if (!version) return null;

  const payload = { version, input: { image: inputUrl, scale: 4 } } as any;
  const res = await fetch(`${REPLICATE_API}/predictions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (!res.ok) return null;
  const json = await res.json();

  let status = json.status;
  let out = json.output;
  while (status !== 'succeeded' && status !== 'failed' && status !== 'canceled') {
    await new Promise(r => setTimeout(r, 2000));
    const r2 = await fetch(`${REPLICATE_API}/predictions/${json.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r2.ok) break;
    const j2 = await r2.json();
    status = j2.status;
    out = j2.output;
  }

  const outUrl = Array.isArray(out) ? out[0] : out;
  return typeof outUrl === 'string' ? outUrl : null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const enhancer = (searchParams.get('enhancer') || '').toLowerCase() === 'true';
    if (!id) return new Response('Missing id', { status: 400 });

    const apiKey = process.env.SYNC_API_KEY || process.env.NEXT_PUBLIC_SYNC_API_KEY;
    if (!apiKey) return new Response('Server misconfigured: missing SYNC_API_KEY', { status: 500 });

    const client = new SyncClient({ apiKey });
    const generation = await client.generations.get(id);

    const outputUrl = (generation as any).output_url || (generation as any).outputUrl || null;
    let upscaledUrl: string | null = null;
    let enhancerError: any = null;

    if (enhancer && typeof outputUrl === 'string' && generation.status === 'COMPLETED') {
      const token = process.env.REPLICATE_API_TOKEN;
      if (!token) {
        enhancerError = 'Missing REPLICATE_API_TOKEN for enhancer upscaling';
      } else {
        try {
          upscaledUrl = await upscaleWithEsrgan(outputUrl, token);
        } catch (e: any) {
          enhancerError = e?.message || 'Enhancer failed';
        }
      }
    }

    return Response.json({
      id: generation.id,
      status: generation.status,
      outputUrl,
      upscaledUrl,
      error: (generation as any).error || enhancerError || null,
    });
  } catch (err: any) {
    if (err instanceof SyncError) {
      return new Response(JSON.stringify({ message: 'SyncError', statusCode: err.statusCode, error: err.body }), { status: 500 });
    }
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}

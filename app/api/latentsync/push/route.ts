export {}
import { NextRequest } from 'next/server';

const REPLICATE_API = 'https://api.replicate.com/v1';
const FALLBACK_LATENTSYNC_MODELS = [
  process.env.REPLICATE_LATENTSYNC_MODEL,
  'bytedance/latentsync',
].filter(Boolean) as string[];

async function getLatestVersionId(modelSlug: string, token: string): Promise<string | null> {
  const res = await fetch(`${REPLICATE_API}/models/${modelSlug}/versions?limit=1`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const json = await res.json();
  const id = json?.results?.[0]?.id || json?.versions?.[0]?.id || null;
  return id;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoUrl, audioUrl, options } = body || {};
    if (!videoUrl || !audioUrl) return new Response('Missing videoUrl/audioUrl', { status: 400 });

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });

    let version: string | null = process.env.REPLICATE_LATENTSYNC_VERSION || null;
    if (!version) {
      for (const slug of FALLBACK_LATENTSYNC_MODELS) {
        const v = await getLatestVersionId(slug, token);
        if (v) { version = v; break; }
      }
    }
    if (!version) {
      return new Response('LatentSync model not found on Replicate. Set REPLICATE_LATENTSYNC_VERSION or REPLICATE_LATENTSYNC_MODEL.', { status: 500 });
    }

    const payload: any = {
      version,
      input: {
        video: videoUrl,
        audio: audioUrl,
      }
    };
    if (options?.inference_steps) payload.input.inference_steps = options.inference_steps;
    if (options?.guidance_scale) payload.input.guidance_scale = options.guidance_scale;

    const res = await fetch(`${REPLICATE_API}/predictions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    if (!res.ok) return new Response(text, { status: res.status });
    const json = JSON.parse(text);
    return Response.json({ id: json.id, status: json.status });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}

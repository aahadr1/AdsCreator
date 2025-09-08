import { NextRequest } from 'next/server';

const REPLICATE_API = 'https://api.replicate.com/v1';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { model, input } = body || {};
    if (!model) return new Response('Missing model', { status: 400 });
    if (!input || typeof input !== 'object') return new Response('Missing input', { status: 400 });

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });

    // Resolve latest version id for the model
    const modelRes = await fetch(`${REPLICATE_API}/models/${model}`, {
      headers: { 'Authorization': `Token ${token}` },
      cache: 'no-store',
    });
    if (!modelRes.ok) return new Response(await modelRes.text(), { status: modelRes.status });
    const modelJson = await modelRes.json();
    const versionId = modelJson?.latest_version?.id;
    if (!versionId) return new Response('No latest version found for model', { status: 404 });

    // Optionally include proxy key if provided (some sync models require it)
    const proxyKey = process.env.SYNC_API_KEY || process.env.SYNC_PROXY_API_KEY || undefined;
    const inputPayload = proxyKey ? { ...input, proxy_api_key: proxyKey } : input;

    // Create prediction using version id
    const res = await fetch(`${REPLICATE_API}/predictions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${token}`,
      },
      body: JSON.stringify({ version: versionId, input: inputPayload })
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(text, { status: res.status });
    }

    const json = await res.json();
    return Response.json({ id: json.id, status: json.status });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}



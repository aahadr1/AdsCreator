import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { url?: string | null } | null;
    const targetUrl = (body?.url || '').trim();
    if (!targetUrl) return new Response('Missing required field: url', { status: 400 });

    const base = process.env.TIKHUB_API_BASE || 'https://api.tikhub.io';
    const apiKey = process.env.TIKHUB_API_KEY || '';
    if (!apiKey) {
      return new Response('Server misconfigured: missing TIKHUB_API_KEY', { status: 500 });
    }

    // Attempt a generic TikHub endpoint. Adjust path if your account uses a different route.
    const endpoint = `${base.replace(/\/$/, '')}/v1/download`; // e.g. https://api.tikhub.io/v1/download

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ url: targetUrl }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return new Response(txt || 'TikHub error', { status: res.status });
    }

    const json = await res.json();
    // Normalize a few common shapes
    const directUrl = json?.download_url || json?.url || json?.video_url || null;
    return Response.json({ url: directUrl, raw: json });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}



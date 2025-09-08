import { NextRequest } from 'next/server';

export async function GET(_req: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return new Response('Missing ELEVENLABS_API_KEY', { status: 500 });

    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': apiKey,
        'accept': 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text();
      return new Response(text || 'Failed to fetch voices', { status: res.status });
    }
    const json = await res.json();
    return Response.json(json);
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}



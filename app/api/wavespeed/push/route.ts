import { NextRequest } from 'next/server';

const WAVESPEED_API_BASE = 'https://api.wavespeed.ai/api/v3';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { model, input } = body || {};
    
    if (!model) return new Response('Missing model', { status: 400 });
    if (!input || typeof input !== 'object') return new Response('Missing input', { status: 400 });

    const apiKey = process.env.WAVESPEED_API_KEY;
    if (!apiKey) {
      return new Response('Server misconfigured: missing WAVESPEED_API_KEY', { status: 500 });
    }

    // Map model names to API endpoints
    const modelEndpoints: Record<string, string> = {
      'wavespeed-ai/infinitetalk': `${WAVESPEED_API_BASE}/wavespeed-ai/infinitetalk`,
      'wavespeed-ai/infinitetalk/multi': `${WAVESPEED_API_BASE}/wavespeed-ai/infinitetalk/multi`,
      'wavespeed-ai/infinitetalk/video-to-video': `${WAVESPEED_API_BASE}/wavespeed-ai/infinitetalk/video-to-video`,
    };

    const endpoint = modelEndpoints[model];
    if (!endpoint) {
      return new Response(`Unknown model: ${model}`, { status: 400 });
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(text, { status: res.status });
    }

    const json = await res.json();
    
    // Wavespeed returns { code, message, data: { id, status, ... } }
    if (json.code === 200 && json.data) {
      return Response.json({ 
        id: json.data.id, 
        status: json.data.status || 'created',
        model: json.data.model,
      });
    }
    
    return new Response(JSON.stringify(json), { status: res.status });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}


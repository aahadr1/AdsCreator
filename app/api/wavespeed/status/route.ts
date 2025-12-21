import { NextRequest } from 'next/server';

const WAVESPEED_API_BASE = 'https://api.wavespeed.ai/api/v3';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return new Response('Missing id parameter', { status: 400 });
    }

    const apiKey = process.env.WAVESPEED_API_KEY;
    if (!apiKey) {
      return new Response('Server misconfigured: missing WAVESPEED_API_KEY', { status: 500 });
    }

    const res = await fetch(`${WAVESPEED_API_BASE}/predictions/${id}/result`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(text, { status: res.status });
    }

    const json = await res.json();
    
    // Wavespeed returns { code, message, data: { id, status, outputs, ... } }
    if (json.code === 200 && json.data) {
      const data = json.data;
      
      // Map Wavespeed status to our status format
      let status = 'queued';
      if (data.status === 'completed') status = 'finished';
      else if (data.status === 'failed') status = 'error';
      else if (data.status === 'processing') status = 'running';
      else if (data.status === 'created') status = 'queued';
      
      // Extract output URL
      let outputUrl: string | null = null;
      if (Array.isArray(data.outputs) && data.outputs.length > 0) {
        outputUrl = data.outputs[0] || null;
      } else if (typeof data.outputs === 'string') {
        outputUrl = data.outputs;
      }
      
      return Response.json({
        id: data.id,
        status,
        outputUrl,
        error: data.error || null,
        outputs: data.outputs || [],
      });
    }
    
    return new Response(JSON.stringify(json), { status: res.status });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}


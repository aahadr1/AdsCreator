export {}
import { NextRequest } from 'next/server';

const REPLICATE_API = 'https://api.replicate.com/v1';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return new Response('Missing id', { status: 400 });

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });

    const res = await fetch(`${REPLICATE_API}/predictions/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const text = await res.text();
    if (!res.ok) return new Response(text, { status: res.status });

    const json = JSON.parse(text);
    const output = Array.isArray(json.output) ? json.output[0] : json.output;
    return Response.json({
      id: json.id,
      status: json.status,
      outputUrl: typeof output === 'string' ? output : null,
      error: json.error || null,
      logs: json.logs || null,
    });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}

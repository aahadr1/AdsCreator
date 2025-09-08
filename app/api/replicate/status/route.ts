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
      headers: { 'Authorization': `Token ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return new Response(await res.text(), { status: res.status });
    const json = await res.json();

    // Normalize outputs
    let outputUrl: string | null = null;
    const out = json.output;
    if (typeof out === 'string') outputUrl = out;
    else if (Array.isArray(out)) outputUrl = typeof out[0] === 'string' ? out[0] : null;
    else if (out && typeof out === 'object' && typeof out.url === 'string') outputUrl = out.url;

    return Response.json({ id: json.id, status: json.status, outputUrl, error: json.error || json.logs || null });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}



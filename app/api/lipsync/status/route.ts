import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return new Response('Missing id', { status: 400 });

  const apiKey = process.env.SIEVE_API_KEY;
  if (!apiKey) return new Response('Server misconfigured: missing SIEVE_API_KEY', { status: 500 });

  const res = await fetch(`https://mango.sievedata.com/v2/jobs/${id}`, {
    headers: { 'X-API-Key': apiKey }
  });

  if (!res.ok) {
    const text = await res.text();
    return new Response(text, { status: res.status });
  }

  const json = await res.json();
  // Return subset for UI
  return Response.json({
    id: json.id,
    status: json.status,
    outputs: json.outputs ?? json.data ?? null,
    error: json.error || json.message || json?.last_error || null,
    logs: json.logs || json.events || null,
  });
}

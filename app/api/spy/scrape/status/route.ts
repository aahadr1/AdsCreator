import { NextRequest } from 'next/server';

// Poll the status of an Apify run by id

export async function GET(req: NextRequest) {
  try {
    const token = process.env.APIFY_TOKEN;
    if (!token) return new Response('Server misconfigured: missing APIFY_TOKEN', { status: 500 });

    const { searchParams } = new URL(req.url);
    const runId = searchParams.get('runId');
    if (!runId) return new Response('Missing runId', { status: 400 });

    const res = await fetch(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}?token=${encodeURIComponent(token)}`);
    if (!res.ok) {
      const errTxt = await res.text();
      return new Response(errTxt || 'Apify API error when fetching run status', { status: res.status });
    }
    const json = await res.json();
    return Response.json({
      runId,
      status: json?.data?.status || json?.status,
      defaultDatasetId: json?.data?.defaultDatasetId || json?.defaultDatasetId,
      finishedAt: json?.data?.finishedAt || json?.finishedAt || null,
      raw: json,
    });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}



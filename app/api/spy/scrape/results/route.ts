import { NextRequest } from 'next/server';

// Fetch dataset items for a given datasetId from Apify
// Supports pagination params: limit, offset

export async function GET(req: NextRequest) {
  try {
    const token = process.env.APIFY_TOKEN;
    if (!token) return new Response('Server misconfigured: missing APIFY_TOKEN', { status: 500 });

    const { searchParams } = new URL(req.url);
    const datasetId = searchParams.get('datasetId');
    if (!datasetId) return new Response('Missing datasetId', { status: 400 });
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const url = `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?token=${encodeURIComponent(token)}&limit=${limit}&offset=${offset}&clean=true`;
    const res = await fetch(url);
    if (!res.ok) {
      const errTxt = await res.text();
      return new Response(errTxt || 'Apify API error when fetching dataset items', { status: res.status });
    }
    const items = await res.json();
    return Response.json({ items });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}



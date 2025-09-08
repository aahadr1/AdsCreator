import { NextRequest } from 'next/server';

// Starts a run of Apify's Facebook Page Ads Scraper actor
// Docs: https://docs.apify.com/api/v2#/reference/actors/run-collection/run-actor

type StartInput = {
  startUrls: { url: string; method?: 'GET' | 'POST' }[];
  resultsLimit?: number;
  onlyTotal?: boolean;
  isDetailsPerAd?: boolean;
  activeStatus?: '' | 'active' | 'inactive';
};

export async function POST(req: NextRequest) {
  try {
    const token = process.env.APIFY_TOKEN;
    if (!token) return new Response('Server misconfigured: missing APIFY_TOKEN', { status: 500 });

    const body = (await req.json()) as StartInput | null;
    if (!body || !Array.isArray(body.startUrls) || body.startUrls.length === 0) {
      return new Response('Missing required startUrls', { status: 400 });
    }

    const runInput: any = {
      startUrls: body.startUrls,
      resultsLimit: body.resultsLimit ?? 99999,
      onlyTotal: body.onlyTotal ?? false,
      isDetailsPerAd: body.isDetailsPerAd ?? false,
      activeStatus: body.activeStatus ?? '',
    };

    // NOTE: REST path uses tilde between username and actor name
    const url = `https://api.apify.com/v2/acts/apify~facebook-ads-scraper/runs?token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(runInput),
    });

    if (!res.ok) {
      const errTxt = await res.text();
      return new Response(errTxt || 'Apify API error when starting run', { status: res.status });
    }

    const json = await res.json();
    // Common fields: id (runId), status, defaultDatasetId
    return Response.json({
      runId: json?.data?.id || json?.id,
      status: json?.data?.status || json?.status,
      defaultDatasetId: json?.data?.defaultDatasetId || json?.defaultDatasetId,
      raw: json,
    });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}



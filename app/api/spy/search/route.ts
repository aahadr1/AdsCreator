import { NextRequest } from 'next/server';

// Minimal proxy to Meta Ads Library API so we don't expose the token to the client
// Docs: https://www.facebook.com/ads/library/api

const GRAPH_BASE = 'https://graph.facebook.com';
const GRAPH_VERSION = 'v18.0';

type SearchPayload = {
  search_terms?: string;
  ad_reached_countries?: string[] | string;
  ad_active_status?: 'ALL' | 'ACTIVE' | 'INACTIVE';
  ad_type?: string;
  publisher_platforms?: string[] | string; // e.g., ['facebook','instagram']
  media_type?: string; // VIDEO_AND_IMAGE, IMAGE, VIDEO
  page_ids?: string[] | string;
  ad_delivery_date_min?: string; // YYYY-MM-DD
  ad_delivery_date_max?: string; // YYYY-MM-DD
  limit?: number;
  after?: string; // paging cursor
  fields?: string;
};

function encodeArray(value: string[] | string | undefined): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    // Graph API accepts CSV or JSON array; JSON array is safest
    return JSON.stringify(value);
  }
  return value;
}

export async function POST(req: NextRequest) {
  try {
    const token = process.env.META_ADS_ACCESS_TOKEN || process.env.FACEBOOK_ADS_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
    if (!token) return new Response('Server misconfigured: missing META_ADS_ACCESS_TOKEN', { status: 500 });

    const body = (await req.json()) as SearchPayload | null;
    if (!body) return new Response('Missing body', { status: 400 });

    const params = new URLSearchParams();
    const fields = body.fields || [
      'ad_creation_time',
      'ad_creative_body',
      'ad_creative_link_caption',
      'ad_creative_link_description',
      'ad_creative_link_title',
      'ad_delivery_start_time',
      'ad_delivery_stop_time',
      'ad_snapshot_url',
      'bylines',
      'currency',
      'demographic_distribution',
      'delivery_by_region',
      'delivery_by_country',
      'funding_entity',
      'impressions',
      'spend',
      'page_id',
      'page_name',
      'publisher_platforms',
      'instagram_actor_name',
      'languages',
      'region_distribution',
    ].join(',');
    params.set('fields', fields);

    if (body.search_terms) params.set('search_terms', body.search_terms);
    if (body.ad_active_status) params.set('ad_active_status', body.ad_active_status);
    if (body.ad_type) params.set('ad_type', body.ad_type);
    if (body.media_type) params.set('media_type', body.media_type);
    if (body.ad_delivery_date_min) params.set('ad_delivery_date_min', body.ad_delivery_date_min);
    if (body.ad_delivery_date_max) params.set('ad_delivery_date_max', body.ad_delivery_date_max);
    if (body.limit) params.set('limit', String(body.limit));
    if (body.after) params.set('after', body.after);

    const countries = encodeArray(body.ad_reached_countries);
    if (countries) params.set('ad_reached_countries', countries);
    const platforms = encodeArray(body.publisher_platforms);
    if (platforms) params.set('publisher_platforms', platforms);
    const pageIds = encodeArray(body.page_ids);
    if (pageIds) params.set('page_ids', pageIds);

    const url = `${GRAPH_BASE}/${GRAPH_VERSION}/ads_archive?${params.toString()}`;
    const res = await fetch(url + `&access_token=${encodeURIComponent(token)}`);
    if (!res.ok) {
      const errTxt = await res.text();
      return new Response(errTxt || 'Meta Ads API error', { status: res.status });
    }
    const json = await res.json();
    return Response.json(json);
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}



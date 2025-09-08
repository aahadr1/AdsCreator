import { NextRequest } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

type TikwmApiSuccess = {
  code: number;
  msg?: string;
  data?: {
    play?: string;
    hdplay?: string;
    wmplay?: string;
    title?: string;
    music?: string;
    cover?: string;
  };
};

const BodySchema = z.object({ url: z.string().trim().url() });

async function fetchTikwm({ targetUrl, endpointBase }: { targetUrl: string; endpointBase: string }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const url = `${endpointBase}?hd=1&web=1&url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'referer': 'https://www.tikwm.com/',
        'origin': 'https://www.tikwm.com',
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      return { ok: false as const, reason: `Upstream ${res.status}` };
    }
    const json = (await res.json()) as TikwmApiSuccess;
    if (typeof json?.code !== 'number' || json.code !== 0) {
      return { ok: false as const, reason: json?.msg || 'Non-zero code' };
    }
    const hd = json?.data?.hdplay;
    const noWm = json?.data?.play;
    let candidate = typeof hd === 'string' && hd.length > 0 ? hd : (typeof noWm === 'string' ? noWm : '');
    // Prefer URLs that end with .mp4 to avoid HLS/m3u8
    if (typeof hd === 'string' && /\.mp4(\?|$)/i.test(hd)) candidate = hd;
    else if (typeof noWm === 'string' && /\.mp4(\?|$)/i.test(noWm)) candidate = noWm;
    if (!candidate) {
      return { ok: false as const, reason: 'Missing play/hdplay in response' };
    }
    const baseOrigin = new URL(endpointBase).origin;
    let absoluteUrl = candidate.trim();
    if (absoluteUrl.startsWith('//')) {
      absoluteUrl = `https:${absoluteUrl}`;
    } else if (absoluteUrl.startsWith('/')) {
      absoluteUrl = `${baseOrigin}${absoluteUrl}`;
    } else if (!/^https?:\/\//i.test(absoluteUrl)) {
      absoluteUrl = `https://${absoluteUrl}`;
    }
    // Strip download=1 to avoid forced attachment disposition
    try {
      const u = new URL(absoluteUrl);
      if (u.searchParams.has('download')) {
        u.searchParams.delete('download');
        absoluteUrl = u.toString();
      }
    } catch {}
    return { ok: true as const, url: absoluteUrl, raw: json };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      return new Response('Missing or invalid field: url', { status: 400 });
    }
    const { url: targetUrl } = parsed.data;

    const primary = await fetchTikwm({ targetUrl, endpointBase: 'https://www.tikwm.com/api/' });
    const result = primary.ok ? primary : await fetchTikwm({ targetUrl, endpointBase: 'https://tikwm.com/api/' });

    if (!result.ok) {
      return new Response(`Failed to fetch from TikWM: ${primary.ok ? result.reason : primary.reason}`, { status: 502 });
    }

    return Response.json({ url: result.url, raw: result.raw });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}


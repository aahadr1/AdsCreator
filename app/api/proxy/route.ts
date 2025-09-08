import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let target = searchParams.get('url');
    const typeHint = (searchParams.get('type') || '').toLowerCase();
    const asDownload = (searchParams.get('download') || '').toLowerCase() === 'true';
    if (!target) return new Response('Missing url', { status: 400 });

    // Basic allowlist: only http(s)
    if (!target && req.headers.get('x-target-url')) {
      target = req.headers.get('x-target-url') || null;
    }
    if (!target) {
      return new Response('Missing url', { status: 400 });
    }

    try {
      // Allow already proxied relative URLs like /api/proxy?url=...
      // Decode nested encodes
      while (/%2F|%3A/i.test(target)) {
        const decoded = decodeURIComponent(target);
        if (decoded === target) break;
        target = decoded;
      }
    } catch {}

    if (!/^https?:\/\//i.test(String(target))) {
      return new Response('Invalid url', { status: 400 });
    }

    // Forward Range headers for video streaming
    const range = req.headers.get('range') || undefined;
    const targetUrl = new URL(String(target));
    const hostname = targetUrl.hostname.toLowerCase();
    const isTikwmHost = /(^|\.)tikwm\.com$/i.test(hostname) || /(^|\.)tikcdn\./i.test(hostname);
    const isTikTokCdn = /tiktok|bytecdn|ttwcdn|tiktokcdn|tiktokv/i.test(hostname);
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept': '*/*',
      'Connection': 'keep-alive',
    };
    if (range) fetchHeaders['Range'] = range;
    if (isTikwmHost) {
      fetchHeaders['Referer'] = 'https://www.tikwm.com/';
      fetchHeaders['Origin'] = 'https://www.tikwm.com';
    } else if (isTikTokCdn) {
      fetchHeaders['Referer'] = 'https://www.tiktok.com/';
      fetchHeaders['Origin'] = 'https://www.tiktok.com';
    }
    // First attempt: forward request as-is (including Range if present)
    let upstream = await fetch(target, {
      cache: 'no-store',
      headers: Object.keys(fetchHeaders).length ? fetchHeaders : undefined,
    }).catch((e: any) => {
      throw new Error(`Upstream fetch error: ${e?.message || 'unknown error'}`);
    });
    // Retry without Range if server rejects partial content
    if ((!upstream.ok || !upstream.body) || (upstream.status >= 400 && upstream.status !== 206)) {
      try {
        const retryHeaders = { ...fetchHeaders };
        delete (retryHeaders as any)['Range'];
        upstream = await fetch(target, {
          cache: 'no-store',
          headers: Object.keys(retryHeaders).length ? retryHeaders : undefined,
        });
      } catch {}
    }
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      return new Response(text || 'Upstream fetch failed', { status: upstream.status || 502 });
    }

    // Pass through relevant headers and status for proper playback
    let contentType = upstream.headers.get('content-type') || '';
    const urlPath = targetUrl.pathname.toLowerCase();
    // Only coerce content-type when upstream didn't provide one
    if (!contentType && (typeHint === 'video' || urlPath.endsWith('.mp4'))) contentType = 'video/mp4';
    const headers: Record<string, string> = {
      'Content-Type': contentType || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Content-Disposition': 'inline',
    };
    const passHeaders = ['etag', 'last-modified', 'content-length', 'accept-ranges', 'content-range'];
    for (const h of passHeaders) {
      const v = upstream.headers.get(h);
      if (!v) continue;
      const proper = h
        .split('-')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join('-');
      headers[proper] = v;
    }
    if (!headers['Accept-Ranges'] && (typeHint === 'video' || urlPath.endsWith('.mp4'))) headers['Accept-Ranges'] = 'bytes';
    // Force download if requested
    if (asDownload) {
      const filename = targetUrl.pathname.split('/').pop() || 'download';
      headers['Content-Disposition'] = `attachment; filename="${filename}"`;
    } else {
      headers['Content-Disposition'] = 'inline';
    }

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}



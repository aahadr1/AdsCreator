import type { NextRequest } from 'next/server';

function cleanOrigin(origin: string | null | undefined): string | null {
  const v = String(origin || '').trim();
  if (!v) return null;
  // Ensure we only return scheme://host[:port] with no trailing slash
  try {
    const u = new URL(v);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function firstForwardedValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(',')[0]?.trim();
  return first || null;
}

/**
 * Compute a public, Replicate-reachable origin for this deployment.
 *
 * Why:
 * - On Railway, `new URL(req.url).origin` can be `http(s)://0.0.0.0:PORT` depending on proxying,
 *   which is not reachable from Replicate servers.
 *
 * Strategy (highest priority first):
 * - Explicit env (recommended): NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_BASE_URL / NEXT_PUBLIC_API_BASE_URL / APP_URL
 * - Railway env fallback: RAILWAY_PUBLIC_DOMAIN
 * - Forwarded headers: x-forwarded-proto + x-forwarded-host
 * - Host header + guessed proto
 * - Finally: req.url origin
 */
export function getPublicOrigin(req: NextRequest): string {
  const envOrigin =
    cleanOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    cleanOrigin(process.env.NEXT_PUBLIC_BASE_URL) ||
    cleanOrigin(process.env.NEXT_PUBLIC_API_BASE_URL) ||
    cleanOrigin(process.env.APP_URL);
  if (envOrigin) return envOrigin;

  const railwayDomain = String(process.env.RAILWAY_PUBLIC_DOMAIN || '').trim();
  if (railwayDomain) {
    const guess = cleanOrigin(`https://${railwayDomain}`);
    if (guess) return guess;
  }

  const xfProto = firstForwardedValue(req.headers.get('x-forwarded-proto'));
  const xfHost = firstForwardedValue(req.headers.get('x-forwarded-host'));
  if (xfHost) {
    const proto = xfProto || 'https';
    const guess = cleanOrigin(`${proto}://${xfHost}`);
    if (guess) return guess;
  }

  const host = firstForwardedValue(req.headers.get('host'));
  if (host) {
    const proto = xfProto || (host.includes('localhost') ? 'http' : 'https');
    const guess = cleanOrigin(`${proto}://${host}`);
    if (guess) return guess;
  }

  return new URL(req.url).origin.replace(/\/$/, '');
}


import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

const PUBLIC_PATHS = new Set<string>([
  '/',
  '/auth',
  '/billing',
]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip Next internals and public endpoints
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/api/stripe/webhook') ||
    pathname.startsWith('/api/debug') ||
    pathname.startsWith('/api/proxy') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/billing')
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res: response });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Require auth for everything except public paths
  if (!user && !PUBLIC_PATHS.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // If no user (public path) allow
  if (!user) return response;

  const isSubscribed = Boolean((user.user_metadata as Record<string, unknown> | null)?.is_subscribed);

  // For API routes, block unauthenticated or unsubscribed
  if (pathname.startsWith('/api')) {
    if (!isSubscribed) {
      return NextResponse.json({ error: 'Payment required' }, { status: 402 });
    }
    return response;
  }

  // For app routes, redirect unsubscribed users to billing except for billing/auth
  if (!isSubscribed && !PUBLIC_PATHS.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/billing';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all except static and image optimizations
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};



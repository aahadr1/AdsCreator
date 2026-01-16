export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest } from 'next/server';

/**
 * Legacy run endpoint.
 *
 * The UGC Creator assistant feature has been removed.
 * This endpoint is kept only to avoid breaking older clients.
 */

export async function POST(req: NextRequest) {
  try {
    return Response.json({
      error: 'Assistant execution is no longer available.',
      message: 'The UGC Creator assistant feature was removed. Use the tool pages in the sidebar instead.',
    }, { status: 410 });
    
  } catch (error: any) {
    console.error('[Run] Error:', error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}

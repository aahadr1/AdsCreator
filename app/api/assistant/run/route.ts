export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextRequest } from 'next/server';

/**
 * Legacy run endpoint - redirects to UGC agent
 * 
 * The assistant is now UGC-only. This endpoint now redirects
 * to the UGC video generation pipeline.
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // For UGC-only, we don't need this multi-step runner
    // Video generation is handled by the UGC agent pipeline
    return Response.json({
      error: 'This endpoint is deprecated. Use /api/ugc-builder/agent instead.',
      message: 'The assistant is now UGC-only. Please use the UGC Creator interface.',
    }, { status: 410 });
    
  } catch (error: any) {
    console.error('[Run] Error:', error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}

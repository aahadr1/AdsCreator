/**
 * API Endpoint for Competitor Analyst Tool
 * 
 * This endpoint handles requests to analyze competitor ads from Meta Ads Library.
 * It uses Playwright for web scraping, FFmpeg for media processing, and OpenAI for analysis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeCompetitorAds } from '@/lib/agents/tools/competitorAnalyst';

export const maxDuration = 300; // 5 minutes for video processing
export const dynamic = 'force-dynamic';

type CompetitorAnalystRequest = {
  brand: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CompetitorAnalystRequest;
    
    // Validate input
    if (!body.brand || typeof body.brand !== 'string') {
      return NextResponse.json(
        { error: 'Brand name is required' },
        { status: 400 }
      );
    }
    
    console.log(`[API] Starting competitor analysis for: ${body.brand}`);
    
    // Execute analysis
    const result = await analyzeCompetitorAds(body.brand);
    
    console.log(`[API] Analysis complete. Analyzed ${result.videosAnalyzed} videos.`);
    
    // Return results
    return NextResponse.json({
      success: true,
      data: result,
    });
    
  } catch (error: any) {
    console.error('[API] Competitor analysis error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to analyze competitor ads',
        message: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}


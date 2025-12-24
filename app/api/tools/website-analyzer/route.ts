/**
 * API Endpoint for Website Analyzer Tool
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeWebsite } from '@/lib/agents/tools/websiteAnalyzer';

export const maxDuration = 120; // 2 minutes
export const dynamic = 'force-dynamic';

type WebsiteAnalyzerRequest = {
  url: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WebsiteAnalyzerRequest;
    
    if (!body.url || typeof body.url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }
    
    console.log(`[API] Starting website analysis for: ${body.url}`);
    
    const result = await analyzeWebsite(body.url);
    
    console.log(`[API] Analysis complete. Brand: ${result.brandName}`);
    
    return NextResponse.json({
      success: true,
      data: result,
    });
    
  } catch (error: any) {
    console.error('[API] Website analysis error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to analyze website',
        message: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}


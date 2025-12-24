/**
 * API Endpoint for Web Search Tool
 * 
 * This endpoint handles web search requests for trends, data, and research.
 * Uses Tavily API for AI-optimized search results.
 */

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

type WebSearchRequest = {
  query: string;
};

type TavilySearchResult = {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content?: string;
};

type TavilyResponse = {
  results: TavilySearchResult[];
  query: string;
  answer?: string;
  images?: string[];
};

async function searchWithTavily(query: string): Promise<any> {
  const apiKey = process.env.TAVILY_API_KEY;
  
  if (!apiKey) {
    console.warn('[Web Search] TAVILY_API_KEY not set, using fallback');
    return {
      query,
      results: [
        {
          title: 'Web search requires API key',
          snippet: 'To enable web search, set TAVILY_API_KEY environment variable. Get your API key at https://tavily.com',
          url: 'https://tavily.com',
          content: 'Web search functionality requires a Tavily API key to be configured.',
        },
      ],
      summary: `Unable to search for "${query}" - API key not configured.`,
      provider: 'fallback',
    };
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic', // or 'advanced' for more thorough search
        include_answer: true,
        include_raw_content: false,
        max_results: 5,
        include_domains: [],
        exclude_domains: [],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Web Search] Tavily API error:', errorText);
      throw new Error(`Tavily API error: ${response.status}`);
    }

    const data: TavilyResponse = await response.json();
    
    // Format results for our use case
    return {
      query,
      results: data.results.map((r) => ({
        title: r.title,
        snippet: r.content.slice(0, 300) + (r.content.length > 300 ? '...' : ''),
        url: r.url,
        content: r.content,
        score: r.score,
      })),
      summary: data.answer || `Found ${data.results.length} results for "${query}"`,
      provider: 'tavily',
    };
  } catch (error: any) {
    console.error('[Web Search] Tavily search failed:', error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WebSearchRequest;
    
    // Validate input
    if (!body.query || typeof body.query !== 'string') {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }
    
    console.log(`[Web Search] Searching for: ${body.query}`);
    
    const result = await searchWithTavily(body.query);
    
    console.log(`[Web Search] ✅ Found ${result.results.length} results`);
    
    return NextResponse.json({
      success: true,
      data: result,
    });
    
  } catch (error: any) {
    console.error('[Web Search] Error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to perform web search',
        message: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

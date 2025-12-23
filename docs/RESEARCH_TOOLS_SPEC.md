# Research Tools Specification

**Version**: 1.0  
**Status**: Implementation-Ready

---

## Overview

Research tools enable the Adz Creator Agent to autonomously gather competitive intelligence and trending advertising data from public sources.

All research is **citation-tracked**, **confidence-scored**, and **never fabricated**.

---

## Research Endpoints

### 1. TikTok Creative Center Search

**Endpoint**: `POST /api/research/tiktok-creative`

**Purpose**: Find top-performing ads by category, industry, or keyword from TikTok Creative Center.

**Request Schema**:
```typescript
{
  category?: string; // e.g., "fitness", "food", "finance", "beauty"
  keyword?: string; // e.g., "meal prep", "skincare routine"
  region?: string; // e.g., "US", "UK", "CA"
  dateRange?: '7d' | '30d' | '90d'; // Default: '30d'
  limit?: number; // Max results, default: 10
}
```

**Response Schema**:
```typescript
{
  insights: Array<{
    adId: string;
    brand: string;
    hookPreview: string; // First 3 seconds text/concept
    format: string; // e.g., "UGC", "Demo", "Founder"
    viewsEstimate: string; // e.g., "1M-5M", "5M-10M"
    engagementRate: string; // e.g., "high", "medium", "low"
    url: string; // Link to ad in TikTok Creative Center
    hashtags?: string[];
    soundUsed?: string;
  }>;
  trends: Array<{
    trend: string; // e.g., "UGC-style demos with voiceover"
    confidence: 'high' | 'medium' | 'low';
    examples: number; // Count of ads using this trend
    description: string;
  }>;
  citations: string[]; // Source URLs
  metadata: {
    searchDate: string;
    totalResults: number;
    region: string;
  };
}
```

**Implementation Approach**:
- **Method**: Web scraping of TikTok Creative Center public pages
- **No API Key Required**: Public data only
- **Caching**: Cache results for 24 hours per query
- **Rate Limiting**: Max 10 requests/minute to avoid blocking

**Example Implementation** (`app/api/research/tiktok-creative/route.ts`):
```typescript
export async function POST(req: NextRequest) {
  const { category, keyword, region = 'US', dateRange = '30d' } = await req.json();
  
  // TODO: Implement scraping logic
  // 1. Construct TikTok Creative Center URL
  // 2. Scrape results page
  // 3. Extract ad data
  // 4. Identify trends
  // 5. Return structured response
  
  return NextResponse.json({
    insights: [],
    trends: [],
    citations: ['https://ads.tiktok.com/business/creativecenter/...'],
    metadata: {
      searchDate: new Date().toISOString(),
      totalResults: 0,
      region
    }
  });
}
```

---

### 2. Meta Ads Library Search

**Endpoint**: `POST /api/research/meta-ads-library`

**Purpose**: Search competitor ads on Facebook/Instagram via Meta Ads Library.

**Request Schema**:
```typescript
{
  query: string; // Competitor name or keyword (required)
  region?: string; // e.g., "US", "ALL"
  adType?: 'all' | 'video' | 'image';
  platform?: 'facebook' | 'instagram' | 'all';
  limit?: number; // Default: 10
}
```

**Response Schema**:
```typescript
{
  ads: Array<{
    adId: string;
    advertiser: string;
    creativeUrl: string; // Image or video URL
    copyText: string; // Ad copy
    cta: string; // Call to action
    platforms: string[]; // ["facebook", "instagram"]
    startDate: string; // When ad started running
    endDate?: string; // When ad stopped (if inactive)
    isActive: boolean;
    impressions?: string; // e.g., "10K-50K" (if available)
  }>;
  patterns: Array<{
    pattern: string; // e.g., "80% of ads use urgency framing"
    confidence: 'high' | 'medium' | 'low';
    examples: string[]; // Example ad IDs
  }>;
  citations: string[]; // Meta Ads Library URLs
  metadata: {
    searchDate: string;
    totalResults: number;
    query: string;
  };
}
```

**Implementation Approach**:
- **Method**: Web scraping of Meta Ads Library public pages
- **URL**: `https://www.facebook.com/ads/library/`
- **No Authentication Required**: Public data
- **Caching**: Cache for 24 hours
- **Rate Limiting**: Max 10 requests/minute

**Example Implementation** (`app/api/research/meta-ads-library/route.ts`):
```typescript
export async function POST(req: NextRequest) {
  const { query, region = 'US', adType = 'all', platform = 'all' } = await req.json();
  
  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }
  
  // TODO: Implement scraping logic
  // 1. Construct Meta Ads Library search URL
  // 2. Scrape results
  // 3. Extract ad creatives and copy
  // 4. Identify patterns
  // 5. Return structured response
  
  return NextResponse.json({
    ads: [],
    patterns: [],
    citations: ['https://www.facebook.com/ads/library/...'],
    metadata: {
      searchDate: new Date().toISOString(),
      totalResults: 0,
      query
    }
  });
}
```

---

### 3. Trends Summary

**Endpoint**: `POST /api/research/trends-summary`

**Purpose**: Aggregate current advertising trends across platforms for a specific category.

**Request Schema**:
```typescript
{
  category: string; // e.g., "fitness", "food", "finance" (required)
  platforms?: string[]; // Default: ["tiktok", "instagram", "youtube"]
  dateRange?: '7d' | '30d' | '90d'; // Default: '30d'
}
```

**Response Schema**:
```typescript
{
  hookTrends: Array<{
    hook: string; // e.g., "If you're [specific problem]..."
    prevalence: 'high' | 'medium' | 'low';
    platforms: string[]; // Where this hook is trending
    examples: string[]; // Example usage
  }>;
  formatTrends: Array<{
    format: string; // e.g., "UGC", "Founder", "Demo"
    popularity: number; // 0-100
    platforms: string[];
    description: string;
  }>;
  musicTrends?: Array<{
    track: string;
    usage: string; // e.g., "Trending on TikTok"
    examples?: string[];
  }>;
  visualTrends?: Array<{
    style: string; // e.g., "High contrast text overlays"
    prevalence: 'high' | 'medium' | 'low';
  }>;
  citations: string[];
  metadata: {
    searchDate: string;
    category: string;
    platforms: string[];
  };
}
```

**Implementation Approach**:
- **Method**: Aggregate data from TikTok Creative Center + Meta Ads Library + YouTube trends
- **Analysis**: Use LLM to identify patterns across scraped data
- **Caching**: Cache for 12 hours (trends change frequently)

**Example Implementation** (`app/api/research/trends-summary/route.ts`):
```typescript
export async function POST(req: NextRequest) {
  const { category, platforms = ['tiktok', 'instagram', 'youtube'], dateRange = '30d' } = await req.json();
  
  if (!category) {
    return NextResponse.json({ error: 'Category required' }, { status: 400 });
  }
  
  // TODO: Implement aggregation logic
  // 1. Call TikTok Creative Center search
  // 2. Call Meta Ads Library search
  // 3. Aggregate results
  // 4. Use LLM to identify patterns
  // 5. Return structured trends
  
  return NextResponse.json({
    hookTrends: [],
    formatTrends: [],
    citations: [],
    metadata: {
      searchDate: new Date().toISOString(),
      category,
      platforms
    }
  });
}
```

---

### 4. Citation Manager

**Endpoint**: `POST /api/research/citation-manager`

**Purpose**: Track and format research citations for transparency.

**Request Schema**:
```typescript
{
  source: string; // e.g., "TikTok Creative Center"
  url: string;
  data: string; // The specific data point cited
  timestamp?: string; // Default: now
}
```

**Response Schema**:
```typescript
{
  citationId: string; // Unique ID
  formatted: string; // e.g., "[1] TikTok Creative Center - Fitness Category, accessed Dec 23, 2025"
  source: string;
  url: string;
  timestamp: string;
}
```

**Implementation Approach**:
- **Storage**: Store citations in database (Supabase)
- **Format**: Follow academic citation style
- **Linking**: Link citations to specific insights/outputs

**Example Implementation** (`app/api/research/citation-manager/route.ts`):
```typescript
import { createServerClient } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  const { source, url, data, timestamp = new Date().toISOString() } = await req.json();
  
  if (!source || !url || !data) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  
  const supabase = createServerClient();
  
  // Store citation
  const { data: citation, error } = await supabase
    .from('research_citations')
    .insert({
      source,
      url,
      data_point: data,
      timestamp
    })
    .select()
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Format citation
  const formatted = `[${citation.id}] ${source}, accessed ${new Date(timestamp).toLocaleDateString()}. ${url}`;
  
  return NextResponse.json({
    citationId: citation.id,
    formatted,
    source,
    url,
    timestamp
  });
}
```

---

## Research Integration Flow

### When to Trigger Research

The Orchestrator should call research tools when:

1. **User explicitly asks**:
   - "What's working in [category] ads?"
   - "Show me competitor ads"
   - "What are the trends?"

2. **Category unfamiliar**:
   - If agent has low confidence in category knowledge

3. **Stakes are high**:
   - Campaign launch
   - Large budget
   - Brand-critical project

4. **User uploads competitor ad**:
   - Call Meta Ads Library to find more from same advertiser
   - Call TikTok Creative Center for similar formats

### Research → Strategy Flow

```
User Request: "What's working in fitness ads on TikTok?"
    ↓
Orchestrator detects research need
    ↓
Call: POST /api/research/tiktok-creative { category: "fitness" }
    ↓
Receive: Insights (top ads, trends, hooks)
    ↓
Present to user with citations
    ↓
User asks: "Make ads using these trends"
    ↓
Orchestrator calls Creative Strategist with research insights
    ↓
Generate strategy + execution plan
```

---

## Confidence Scoring

All research outputs include confidence scores:

- **High**: Data from multiple sources, recent, clear patterns
- **Medium**: Data from single source, or older data
- **Low**: Limited data, no clear patterns, uncertain

**Never fabricate data**. If data is unavailable, return:
```json
{
  "insights": [],
  "message": "No data available for this category/region",
  "confidence": "low"
}
```

---

## Citation Tracking

Every research insight MUST be cited:

```json
{
  "insight": "UGC-style demos are trending in fitness category",
  "citation": "[1] TikTok Creative Center - Fitness Category, accessed Dec 23, 2025",
  "url": "https://ads.tiktok.com/business/creativecenter/...",
  "confidence": "high"
}
```

---

## Rate Limiting & Caching

**Rate Limits**:
- TikTok Creative Center: 10 requests/minute
- Meta Ads Library: 10 requests/minute
- Trends Summary: 5 requests/minute (more expensive)

**Caching Strategy**:
- TikTok/Meta data: 24 hours
- Trends aggregation: 12 hours
- User-specific queries: No cache (always fresh)

**Cache Keys**:
```typescript
`research:tiktok:${category}:${region}:${dateRange}`
`research:meta:${query}:${region}`
`research:trends:${category}:${platforms.join(',')}`
```

---

## Error Handling

**Graceful degradation**:
- If TikTok scraping fails → Return cached data + warning
- If Meta scraping fails → Skip Meta, use TikTok only
- If both fail → Return error, suggest manual research

**Error Response**:
```json
{
  "error": "Failed to fetch data from TikTok Creative Center",
  "fallback": "cached_data",
  "cached": true,
  "cacheAge": "12 hours",
  "recommendation": "Try again later or use cached data"
}
```

---

## Database Schema

### `research_citations` table

```sql
CREATE TABLE research_citations (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  data_point TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  metadata JSONB
);
```

### `research_cache` table

```sql
CREATE TABLE research_cache (
  id SERIAL PRIMARY KEY,
  cache_key TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cache_key ON research_cache(cache_key);
CREATE INDEX idx_expires_at ON research_cache(expires_at);
```

---

## Implementation Checklist

- [ ] Create `/app/api/research/tiktok-creative/route.ts`
- [ ] Create `/app/api/research/meta-ads-library/route.ts`
- [ ] Create `/app/api/research/trends-summary/route.ts`
- [ ] Create `/app/api/research/citation-manager/route.ts`
- [ ] Set up database tables (`research_citations`, `research_cache`)
- [ ] Implement web scraping logic (TikTok, Meta)
- [ ] Implement caching layer
- [ ] Implement rate limiting
- [ ] Add citation tracking to all insights
- [ ] Test with real queries
- [ ] Document API in OpenAPI/Swagger

---

## Security & Compliance

**Scraping Ethics**:
- ✅ Only scrape public data (no authentication bypass)
- ✅ Respect robots.txt
- ✅ Implement rate limiting
- ✅ Cache aggressively to reduce load
- ✅ Attribute all data with citations

**Privacy**:
- ❌ Never scrape personal user data
- ❌ Never store PII from ads
- ✅ Only store public ad metadata

---

## Future Enhancements

1. **YouTube Ads Integration**: Scrape YouTube ad formats
2. **LinkedIn Ads**: B2B advertising trends
3. **Trend Prediction**: ML model to predict emerging trends
4. **Competitor Tracking**: Auto-track specific competitors
5. **Real-time Alerts**: Notify when new trends emerge

---

**Status**: Specification complete, ready for implementation


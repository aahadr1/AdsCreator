/**
 * Website & Brand Analyzer Tool
 * 
 * Autonomously scrapes and analyzes a website to understand:
 * - Brand identity (colors, fonts, tone of voice)
 * - Products/services offered
 * - Target audience signals
 * - Existing marketing style
 * - Key value propositions
 */

import OpenAI from 'openai';
import * as cheerio from 'cheerio';

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Lightweight fallback scraper (no browser needed)
async function scrapeWithFetch(url: string): Promise<{
  title: string;
  description: string;
  bodyText: string;
  headings: string[];
  links: string[];
}> {
  // Ensure URL has protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AdzCreator/1.0; +https://adzcreator.com)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract content
  const title = $('title').text() || $('meta[property="og:title"]').attr('content') || '';
  const description = 
    $('meta[name="description"]').attr('content') || 
    $('meta[property="og:description"]').attr('content') || 
    '';

  // Get main content (remove script, style, nav, footer)
  $('script, style, nav, footer, header').remove();
  const bodyText = $('body').text()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000); // Limit to 5000 chars

  // Get headings
  const headings: string[] = [];
  $('h1, h2, h3').each((_, el) => {
    const text = $(el).text().trim();
    if (text && headings.length < 10) {
      headings.push(text);
    }
  });

  // Get key links
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && links.length < 5) {
      links.push(href);
    }
  });

  return { title, description, bodyText, headings, links };
}

export type BrandAnalysis = {
  url: string;
  brandName: string | null;
  tagline: string | null;
  description: string | null;
  products: string[];
  targetAudience: string | null;
  toneOfVoice: string | null;
  visualStyle: {
    primaryColors: string[];
    typography: string | null;
    imageStyle: string | null;
  };
  valuePropositions: string[];
  competitors: string[];
  adRecommendations: string[];
  rawContent: {
    title: string | null;
    metaDescription: string | null;
    headings: string[];
    keyPhrases: string[];
  };
};

/**
 * Scrape website content (with Playwright fallback to fetch)
 */
async function scrapeWebsite(url: string): Promise<{
  title: string;
  metaDescription: string;
  headings: string[];
  bodyText: string;
  links: string[];
  images: string[];
  colors: string[];
}> {
  // Ensure URL has protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  // Try Playwright first (for local dev)
  try {
    const { chromium } = await import('playwright');
    console.log(`[Website Analyzer] Using Playwright for ${url}`);
    
    const browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      
      const data = await page.evaluate(() => {
        const title = document.title || '';
        const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        
        const headings: string[] = [];
        document.querySelectorAll('h1, h2, h3').forEach((h) => {
          const text = h.textContent?.trim();
          if (text && text.length > 2 && text.length < 200) headings.push(text);
        });
        
        const bodyText = document.body.innerText.slice(0, 10000);
        
        const links: string[] = [];
        document.querySelectorAll('a[href]').forEach((a) => {
          const href = a.getAttribute('href');
          if (href && !href.startsWith('#') && !href.startsWith('javascript:')) links.push(href);
        });
        
        const images: string[] = [];
        document.querySelectorAll('img[src]').forEach((img) => {
          const src = img.getAttribute('src');
          if (src) images.push(src);
        });
        
        const colors: string[] = [];
        const styles = getComputedStyle(document.body);
        if (styles.backgroundColor) colors.push(styles.backgroundColor);
        if (styles.color) colors.push(styles.color);
        
        return { title, metaDescription: metaDesc, headings: headings.slice(0, 20), bodyText, links: links.slice(0, 50), images: images.slice(0, 20), colors };
      });
      
      await browser.close();
      console.log(`[Website Analyzer] ✓ Scraped with Playwright`);
      return data;
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (playwrightError: any) {
    // Fallback to fetch + cheerio (for serverless)
    console.log(`[Website Analyzer] Playwright unavailable, using fetch fallback:`, playwrightError.message);
    
    try {
      const result = await scrapeWithFetch(url);
      console.log(`[Website Analyzer] ✓ Scraped with fetch`);
      
      return {
        title: result.title,
        metaDescription: result.description,
        headings: result.headings,
        bodyText: result.bodyText,
        links: result.links,
        images: [], // No images in simple scrape
        colors: [], // No colors in simple scrape
      };
    } catch (fetchError: any) {
      throw new Error(`Failed to scrape website: ${fetchError.message}`);
    }
  }
}

/**
 * Analyze scraped content with GPT
 */
async function analyzeWithGPT(scrapedData: any, url: string): Promise<BrandAnalysis> {
  const openai = getOpenAIClient();
  
  const prompt = `You are a brand analyst. Analyze this website content and extract brand insights.

URL: ${url}
Title: ${scrapedData.title}
Meta Description: ${scrapedData.metaDescription}

Headings:
${scrapedData.headings.join('\n')}

Body Content (excerpt):
${scrapedData.bodyText.slice(0, 5000)}

Analyze and return a JSON object with:
{
  "brandName": "The brand/company name",
  "tagline": "Their main tagline or slogan if any",
  "description": "1-2 sentence description of what they do",
  "products": ["List of main products or services"],
  "targetAudience": "Who their ideal customer is",
  "toneOfVoice": "How they communicate (professional, casual, luxury, friendly, etc.)",
  "visualStyle": {
    "primaryColors": ["Any brand colors mentioned or inferred"],
    "typography": "Style of text (modern, classic, bold, etc.)",
    "imageStyle": "Type of imagery they use"
  },
  "valuePropositions": ["Their main selling points"],
  "competitors": ["Likely competitors in the same space"],
  "adRecommendations": ["3-5 specific ad recommendations based on brand analysis"]
}

Be specific and actionable. If something isn't clear, make educated inferences based on the industry.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are an expert brand and marketing analyst. Return only valid JSON.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 2000,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content || '{}';
  
  // Parse JSON from response (handle markdown code blocks)
  let parsed: any = {};
  try {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    parsed = JSON.parse(jsonStr);
  } catch {
    console.error('[BrandAnalyzer] Failed to parse GPT response');
  }

  return {
    url,
    brandName: parsed.brandName || null,
    tagline: parsed.tagline || null,
    description: parsed.description || null,
    products: parsed.products || [],
    targetAudience: parsed.targetAudience || null,
    toneOfVoice: parsed.toneOfVoice || null,
    visualStyle: {
      primaryColors: parsed.visualStyle?.primaryColors || scrapedData.colors,
      typography: parsed.visualStyle?.typography || null,
      imageStyle: parsed.visualStyle?.imageStyle || null,
    },
    valuePropositions: parsed.valuePropositions || [],
    competitors: parsed.competitors || [],
    adRecommendations: parsed.adRecommendations || [],
    rawContent: {
      title: scrapedData.title,
      metaDescription: scrapedData.metaDescription,
      headings: scrapedData.headings,
      keyPhrases: [],
    },
  };
}

/**
 * Main function: Analyze a website
 */
export async function analyzeWebsite(url: string): Promise<BrandAnalysis> {
  console.log(`[Website Analyzer] Analyzing: ${url}`);
  
  // Normalize URL
  if (!url.startsWith('http')) {
    url = 'https://' + url;
  }
  
  // Step 1: Scrape
  console.log('[Website Analyzer] Scraping website...');
  const scrapedData = await scrapeWebsite(url);
  
  // Step 2: Analyze with GPT
  console.log('[Website Analyzer] Analyzing with AI...');
  const analysis = await analyzeWithGPT(scrapedData, url);
  
  console.log(`[Website Analyzer] Complete. Brand: ${analysis.brandName}`);
  
  return analysis;
}

export const websiteAnalyzerTool = {
  name: 'website_analyzer',
  description: 'Scrapes and analyzes a website to understand brand identity, products, target audience, tone of voice, visual style, and generates ad recommendations.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The website URL to analyze (e.g., "example.com" or "https://example.com")',
      },
    },
    required: ['url'],
  },
  execute: analyzeWebsite,
};


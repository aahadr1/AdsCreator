/**
 * Competitor Analyst Tool - The "Eyes & Ears" of the Agency
 * 
 * Autonomously browses Meta Ads Library, downloads competitor videos,
 * transcribes audio, analyzes visuals, and provides strategic insights.
 */

import { chromium, Browser, Page } from 'playwright';
import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import OpenAI from 'openai';
import https from 'https';
import http from 'http';

/**
 * Get OpenAI client (lazy initialization)
 */
function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

type CompetitorAnalysisResult = {
  brand: string;
  videosAnalyzed: number;
  analyses: Array<{
    videoUrl: string;
    transcript: string;
    visualAnalysis: string;
    strategicInsights: string;
    screenshots: string[]; // Base64 encoded
  }>;
  summary: string;
  recommendations: string[];
};

/**
 * Download file from URL to local path
 */
async function downloadFile(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const file = require('fs').createWriteStream(outputPath);
    
    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      require('fs').unlink(outputPath, () => {});
      reject(err);
    });
  });
}

/**
 * Extract audio from video and save as MP3
 */
async function extractAudio(videoPath: string, audioPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .output(audioPath)
      .audioCodec('libmp3lame')
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Extract screenshots from video at specific timestamps
 */
async function extractScreenshots(
  videoPath: string,
  outputDir: string,
  count: number = 4
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const screenshotPaths: string[] = [];
    
    // Get video duration first
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      
      const duration = metadata.format.duration || 10;
      const timestamps = [];
      
      // Extract at 0%, 25%, 50%, 75%
      for (let i = 0; i < count; i++) {
        timestamps.push((duration / count) * i);
      }
      
      let completed = 0;
      
      timestamps.forEach((timestamp, index) => {
        const outputPath = path.join(outputDir, `screenshot_${index}.jpg`);
        screenshotPaths.push(outputPath);
        
        ffmpeg(videoPath)
          .screenshots({
            timestamps: [timestamp],
            filename: `screenshot_${index}.jpg`,
            folder: outputDir,
          })
          .on('end', () => {
            completed++;
            if (completed === timestamps.length) {
              resolve(screenshotPaths);
            }
          })
          .on('error', reject);
      });
    });
  });
}

/**
 * Transcribe audio using OpenAI Whisper
 */
async function transcribeAudio(audioPath: string): Promise<string> {
  try {
    const openai = getOpenAIClient();
    const audioFile = await fs.readFile(audioPath);
    const audioBuffer = Buffer.from(audioFile);
    
    // Create a File-like object for the API
    const file = new File([audioBuffer], path.basename(audioPath), {
      type: 'audio/mpeg',
    });
    
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en',
    });
    
    return transcription.text;
  } catch (error: any) {
    console.error('[Transcription Error]:', error);
    return '[Transcription failed]';
  }
}

/**
 * Analyze ad using GPT-4o-mini with transcript and screenshots
 */
async function analyzeAd(
  transcript: string,
  screenshotPaths: string[]
): Promise<{ visualAnalysis: string; strategicInsights: string }> {
  try {
    const openai = getOpenAIClient();
    
    // Read screenshots and convert to base64
    const screenshots = await Promise.all(
      screenshotPaths.map(async (path) => {
        const image = await fs.readFile(path);
        return image.toString('base64');
      })
    );
    
    // Prepare messages with images
    const imageMessages = screenshots.map((screenshot, index) => ({
      type: 'image_url' as const,
      image_url: {
        url: `data:image/jpeg;base64,${screenshot}`,
      },
    }));
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert advertising analyst. Analyze competitor ads to extract strategic insights.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this advertisement.

**Transcript:**
${transcript}

**Task:**
1. What is the visual hook? (First 3 seconds)
2. What is the script structure? (Problem, Solution, CTA)
3. Is it aggressive sales or storytelling?
4. What emotions does it target?
5. What makes it effective (or not)?

Give me a 1-paragraph summary I can use to inspire a new ad. Be specific about techniques used.`,
            },
            ...imageMessages,
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });
    
    const analysis = response.choices[0]?.message?.content || 'Analysis failed';
    
    return {
      visualAnalysis: analysis,
      strategicInsights: analysis,
    };
  } catch (error: any) {
    console.error('[Analysis Error]:', error);
    return {
      visualAnalysis: '[Analysis failed]',
      strategicInsights: '[Analysis failed]',
    };
  }
}

/**
 * Main function: Analyze competitor ads
 */
export async function analyzeCompetitorAds(brand: string): Promise<CompetitorAnalysisResult> {
  console.log(`[Competitor Analyst] Analyzing ads for: ${brand}`);
  
  let browser: Browser | null = null;
  const tempFiles: string[] = [];
  
  try {
    // Step 1: Launch Playwright
    browser = await chromium.launch({
      headless: true,
    });
    
    const page = await browser.newPage();
    
    // Step 2: Navigate to Meta Ads Library
    const metaAdsUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&q=${encodeURIComponent(brand)}&search_type=keyword_unordered&media_type=all`;
    
    console.log(`[Competitor Analyst] Navigating to Meta Ads Library...`);
    await page.goto(metaAdsUrl, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Handle cookie banner if present
    try {
      const rejectButton = page.locator('button:has-text("Reject"), button:has-text("Decline")').first();
      if (await rejectButton.isVisible({ timeout: 3000 })) {
        await rejectButton.click();
        await page.waitForTimeout(1000);
      }
    } catch {
      // Cookie banner not found, continue
    }
    
    // Step 3: Scroll to trigger lazy loading
    console.log(`[Competitor Analyst] Scrolling to load ads...`);
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(2000);
    }
    
    // Find video elements
    const videoElements = await page.locator('video').all();
    console.log(`[Competitor Analyst] Found ${videoElements.length} video ads`);
    
    if (videoElements.length === 0) {
      await browser.close();
      return {
        brand,
        videosAnalyzed: 0,
        analyses: [],
        summary: 'No video ads found for this brand in Meta Ads Library.',
        recommendations: ['Try a different brand name', 'Check if the brand runs ads in your selected region'],
      };
    }
    
    // Step 4: Extract video URLs (top 2)
    const videoUrls: string[] = [];
    for (let i = 0; i < Math.min(2, videoElements.length); i++) {
      const src = await videoElements[i].getAttribute('src');
      if (src && src.startsWith('http')) {
        videoUrls.push(src);
      }
    }
    
    console.log(`[Competitor Analyst] Extracted ${videoUrls.length} video URLs`);
    
    // Close browser early to free resources
    await browser.close();
    browser = null;
    
    // Step 5-7: Process videos
    const analyses: CompetitorAnalysisResult['analyses'] = [];
    
    for (const [index, videoUrl] of videoUrls.entries()) {
      console.log(`[Competitor Analyst] Processing video ${index + 1}/${videoUrls.length}`);
      
      const tempDir = `/tmp/competitor_${Date.now()}_${index}`;
      await fs.mkdir(tempDir, { recursive: true });
      
      const videoPath = path.join(tempDir, 'video.mp4');
      const audioPath = path.join(tempDir, 'audio.mp3');
      
      tempFiles.push(videoPath, audioPath);
      
      try {
        // Download video
        console.log(`[Competitor Analyst] Downloading video...`);
        await downloadFile(videoUrl, videoPath);
        
        // Extract audio
        console.log(`[Competitor Analyst] Extracting audio...`);
        await extractAudio(videoPath, audioPath);
        
        // Transcribe audio
        console.log(`[Competitor Analyst] Transcribing audio...`);
        const transcript = await transcribeAudio(audioPath);
        
        // Extract screenshots
        console.log(`[Competitor Analyst] Extracting screenshots...`);
        const screenshotPaths = await extractScreenshots(videoPath, tempDir, 4);
        tempFiles.push(...screenshotPaths);
        
        // Analyze with GPT-4o-mini
        console.log(`[Competitor Analyst] Analyzing with AI...`);
        const { visualAnalysis, strategicInsights } = await analyzeAd(transcript, screenshotPaths);
        
        // Read screenshots as base64 for return
        const screenshots = await Promise.all(
          screenshotPaths.map(async (p) => {
            const img = await fs.readFile(p);
            return img.toString('base64');
          })
        );
        
        analyses.push({
          videoUrl,
          transcript,
          visualAnalysis,
          strategicInsights,
          screenshots,
        });
        
        // Cleanup this video's files
        for (const file of [videoPath, audioPath, ...screenshotPaths]) {
          try {
            await fs.unlink(file);
          } catch (error) {
            console.warn(`[Cleanup] Failed to delete ${file}:`, error);
          }
        }
        
        // Remove temp directory
        try {
          await fs.rmdir(tempDir);
        } catch {}
        
      } catch (error: any) {
        console.error(`[Competitor Analyst] Error processing video ${index + 1}:`, error);
      }
    }
    
    // Generate overall summary
    const summary = generateSummary(analyses);
    const recommendations = generateRecommendations(analyses);
    
    console.log(`[Competitor Analyst] Analysis complete. Processed ${analyses.length} videos.`);
    
    return {
      brand,
      videosAnalyzed: analyses.length,
      analyses,
      summary,
      recommendations,
    };
    
  } catch (error: any) {
    console.error('[Competitor Analyst] Fatal error:', error);
    throw new Error(`Competitor analysis failed: ${error.message}`);
  } finally {
    // Final cleanup
    if (browser) {
      await browser.close();
    }
    
    // Clean up any remaining temp files
    for (const file of tempFiles) {
      try {
        await fs.unlink(file);
      } catch {}
    }
  }
}

/**
 * Generate overall summary from analyses
 */
function generateSummary(analyses: CompetitorAnalysisResult['analyses']): string {
  if (analyses.length === 0) {
    return 'No ads were successfully analyzed.';
  }
  
  const insights = analyses.map((a) => a.strategicInsights).join(' ');
  
  // Extract key patterns
  const patterns: string[] = [];
  
  if (/ASMR|sound|audio/i.test(insights)) {
    patterns.push('ASMR/audio-focused content');
  }
  if (/close-up|zoom|product shot/i.test(insights)) {
    patterns.push('close-up product shots');
  }
  if (/story|narrative|testimonial/i.test(insights)) {
    patterns.push('storytelling approach');
  }
  if (/urgent|limited|offer|discount/i.test(insights)) {
    patterns.push('urgency-driven offers');
  }
  if (/problem|solution|pain/i.test(insights)) {
    patterns.push('problem-solution structure');
  }
  
  return `Analyzed ${analyses.length} competitor ads. Key patterns: ${patterns.length > 0 ? patterns.join(', ') : 'diverse approaches'}. ${analyses[0]?.strategicInsights.slice(0, 200)}...`;
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(analyses: CompetitorAnalysisResult['analyses']): string[] {
  if (analyses.length === 0) {
    return ['Try analyzing a different brand', 'Ensure the brand runs ads in your target region'];
  }
  
  const recommendations: string[] = [];
  const insights = analyses.map((a) => a.strategicInsights).join(' ');
  
  if (/ASMR|sound/i.test(insights)) {
    recommendations.push('Consider using ASMR or sound-focused content like competitors');
  }
  if (/story|testimonial/i.test(insights)) {
    recommendations.push('Use storytelling format similar to top-performing ads');
  }
  if (/product shot|close-up/i.test(insights)) {
    recommendations.push('Feature close-up product shots for visual impact');
  }
  if (/urgent|limited/i.test(insights)) {
    recommendations.push('Test urgency-driven offers (limited time, scarcity)');
  }
  
  recommendations.push(`Adapt the hook style: ${analyses[0]?.strategicInsights.slice(0, 100)}...`);
  
  return recommendations.slice(0, 5);
}

/**
 * Export for use in assistant tools
 */
export const competitorAnalystTool = {
  name: 'competitor_analyst',
  description: 'Autonomously browses Meta Ads Library, downloads competitor video ads, transcribes audio, analyzes visuals with AI, and provides strategic insights. Use this BEFORE generating creative to understand what works in the market.',
  parameters: {
    type: 'object',
    properties: {
      brand: {
        type: 'string',
        description: 'The competitor brand name to analyze (e.g., "Starbucks", "Nike", "HelloFresh")',
      },
    },
    required: ['brand'],
  },
  execute: analyzeCompetitorAds,
};


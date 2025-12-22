import { NextRequest, NextResponse } from 'next/server';
import type { EditorSequence, EditorAsset } from '@/types/editor';
import {
  generateFFmpegCommand,
  generateTimelineJSON,
  validateTimeline,
  estimateRenderTime,
  type FFmpegExportOptions,
} from '@/lib/ffmpegRenderer';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

/**
 * POST /api/editor/export
 * Initiate server-side video export
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sequence, assets, options } = body as {
      sequence: EditorSequence;
      assets: EditorAsset[];
      options: {
        format: 'mp4' | 'mov' | 'webm' | 'gif' | 'mp3';
        resolution: '480p' | '720p' | '1080p' | '1440p' | '4k' | 'source';
        quality: 'low' | 'medium' | 'high' | 'ultra';
        fps: number;
        codec: 'h264' | 'h265' | 'vp9' | 'prores';
        preset: 'ultrafast' | 'fast' | 'medium' | 'slow' | 'veryslow';
      };
    };

    // Validate timeline
    const validation = validateTimeline(sequence, assets);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Invalid timeline',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    // Generate job ID
    const jobId = `export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Estimate render time
    const estimatedTime = estimateRenderTime(sequence, options);

    // Generate FFmpeg command
    const outputPath = `/tmp/${jobId}.${options.format}`;
    const command = generateFFmpegCommand(sequence, assets, options, outputPath);

    // Generate timeline JSON for reference
    const timelineJSON = generateTimelineJSON(sequence, assets);

    // In a production environment, you would:
    // 1. Store the job in a database/queue
    // 2. Trigger a background worker to process the export
    // 3. Upload the result to R2/S3
    // 4. Send a webhook notification when complete

    // For now, return the job information
    return NextResponse.json({
      jobId,
      status: 'queued',
      estimatedTime,
      command, // For debugging
      timeline: JSON.parse(timelineJSON),
      message: 'Export job queued successfully',
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process export request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/editor/export?jobId=xxx
 * Get export job status
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId parameter' },
        { status: 400 }
      );
    }

    // In production, query job status from database/queue
    // For now, return mock status
    return NextResponse.json({
      jobId,
      status: 'processing',
      progress: 45,
      message: 'Rendering video...',
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check job status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


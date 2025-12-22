import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/editor/export-status?jobId=xxx
 * Poll export job status
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

    // In production, this would:
    // 1. Query the job from database/queue
    // 2. Return current status and progress
    // 3. Return download URL if completed

    // Mock response for now
    const mockProgress = Math.min(100, Math.floor(Math.random() * 100));
    const mockStatus = mockProgress === 100 ? 'completed' : 'processing';

    return NextResponse.json({
      jobId,
      status: mockStatus,
      progress: mockProgress,
      startTime: Date.now() - 60000,
      estimatedTimeRemaining: mockStatus === 'completed' ? 0 : Math.floor(Math.random() * 120),
      outputUrl: mockStatus === 'completed' ? `/exports/${jobId}.mp4` : null,
      message: mockStatus === 'completed' ? 'Export completed successfully' : 'Rendering video...',
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


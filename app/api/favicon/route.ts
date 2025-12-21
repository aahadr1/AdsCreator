import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { taskStateStore, type TaskState } from '@/lib/taskStateStore';

export async function GET(req: NextRequest) {
  try {
    const state = taskStateStore.getState();
    
    // Map state to favicon filename
    const faviconMap: Record<TaskState, string> = {
      'in_progress': 'favicon-in-progress.png',
      'done': 'favicon-done.png',
      'failed': 'favicon-failed.png',
      'idle': 'favicon-idle.png',
    };

    const faviconFile = faviconMap[state];
    const publicPath = join(process.cwd(), 'public', faviconFile);
    
    try {
      const fileBuffer = await readFile(publicPath);
      return new NextResponse(fileBuffer as any, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    } catch {
      // Fallback: return default icon if state-specific icon doesn't exist
      const defaultPath = join(process.cwd(), 'public', 'favicon.ico');
      try {
        const fileBuffer = await readFile(defaultPath);
        return new NextResponse(fileBuffer as any, {
          headers: {
            'Content-Type': 'image/x-icon',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        });
      } catch {
        return new NextResponse('Not Found', { status: 404 });
      }
    }
  } catch (error) {
    console.error('Error serving favicon:', error);
    return new NextResponse('Error', { status: 500 });
  }
}

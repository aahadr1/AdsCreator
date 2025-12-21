import { NextRequest, NextResponse } from 'next/server';
import { taskStateStore } from '@/lib/taskStateStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { state } = body;
    
    if (!state || !['in_progress', 'done', 'failed', 'idle'].includes(state)) {
      return NextResponse.json({ error: 'Invalid state' }, { status: 400 });
    }
    
    taskStateStore.setState(state as 'in_progress' | 'done' | 'failed' | 'idle');
    
    return NextResponse.json({ success: true, state });
  } catch (error) {
    console.error('Error setting task state:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


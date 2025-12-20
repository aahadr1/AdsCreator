import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

// Save a task execution from assistant workflow
export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const body = await req.json();
    const {
      conversation_id,
      task_id,
      step_id,
      step_title,
      step_tool,
      step_model,
      step_inputs,
      step_output_url,
      step_output_text,
      step_status,
    } = body;

    if (!conversation_id || !task_id || !step_id) {
      return NextResponse.json(
        { error: 'conversation_id, task_id, and step_id required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('assistant_tasks')
      .insert({
        conversation_id,
        task_id,
        step_id,
        step_title,
        step_tool,
        step_model,
        step_inputs: step_inputs || null,
        step_output_url,
        step_output_text,
        step_status: step_status || 'running',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Also update the tasks table to link it to the conversation
    await supabase
      .from('tasks')
      .update({ assistant_conversation_id: conversation_id })
      .eq('id', task_id);

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Update task execution status
export async function PUT(req: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const body = await req.json();
    const { task_id, step_status, step_output_url, step_output_text } = body;

    if (!task_id) {
      return NextResponse.json({ error: 'task_id required' }, { status: 400 });
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    if (step_status !== undefined) updateData.step_status = step_status;
    if (step_output_url !== undefined) updateData.step_output_url = step_output_url;
    if (step_output_text !== undefined) updateData.step_output_text = step_output_text;

    const { data, error } = await supabase
      .from('assistant_tasks')
      .update(updateData)
      .eq('task_id', task_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Get tasks for a conversation
export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversation_id');

    if (!conversationId) {
      return NextResponse.json({ error: 'conversation_id required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('assistant_tasks')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


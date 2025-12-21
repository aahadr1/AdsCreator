import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const conversationId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    if (conversationId) {
      // Get single conversation
      const { data, error } = await supabase
        .from('assistant_conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    } else {
      // List all conversations for user
      const { data, error } = await supabase
        .from('assistant_conversations')
        .select('id, title, created_at, updated_at, plan')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return NextResponse.json(data || []);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const body = await req.json();
    const { user_id, messages, plan, title } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('assistant_conversations')
      .insert({
        user_id,
        messages: messages || [],
        plan: plan || null,
        title: title || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const body = await req.json();
    const { id, user_id, messages, plan, title } = body;

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    if (messages !== undefined) updateData.messages = messages;
    if (plan !== undefined) updateData.plan = plan;
    if (title !== undefined) updateData.title = title;

    const query = supabase
      .from('assistant_conversations')
      .update(updateData)
      .eq('id', id);
    
    if (user_id) {
      query.eq('user_id', user_id);
    }

    const { data, error } = await query.select().single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const token = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!token) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, token);

    const { error } = await supabase
      .from('assistant_conversations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting conversation:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


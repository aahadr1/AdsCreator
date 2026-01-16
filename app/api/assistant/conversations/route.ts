import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Conversation, Message } from '../../../../types/assistant';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// GET - List conversations for authenticated user
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    
    // Get user from auth header or cookie
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { data: conversations, error } = await supabase
      .from('assistant_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('Error fetching conversations:', error);
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }
    
    return NextResponse.json({ conversations: conversations || [] });
  } catch (err: any) {
    console.error('GET conversations error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST - Create a new conversation
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json().catch(() => ({}));
    const { title, initial_message } = body;
    
    const messages: Message[] = [];
    
    if (initial_message) {
      messages.push({
        id: crypto.randomUUID(),
        role: 'user',
        content: initial_message,
        timestamp: new Date().toISOString(),
      });
    }
    
    const { data: conversation, error } = await supabase
      .from('assistant_conversations')
      .insert({
        user_id: user.id,
        title: title || null,
        messages: messages,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    
    if (error) {
      console.error('Error creating conversation:', error);
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
    }
    
    return NextResponse.json({ conversation });
  } catch (err: any) {
    console.error('POST conversation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH - Update conversation (add messages, update title)
export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase();
    
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json().catch(() => ({}));
    const { conversation_id, title, messages, add_message } = body;
    
    if (!conversation_id) {
      return NextResponse.json({ error: 'conversation_id is required' }, { status: 400 });
    }
    
    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('assistant_conversations')
      .select('*')
      .eq('id', conversation_id)
      .eq('user_id', user.id)
      .single();
    
    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    if (title !== undefined) {
      updates.title = title;
    }
    
    if (messages !== undefined) {
      updates.messages = messages;
    } else if (add_message) {
      // Append a new message
      const currentMessages = (existing.messages || []) as Message[];
      const newMessage: Message = {
        id: crypto.randomUUID(),
        role: add_message.role,
        content: add_message.content,
        timestamp: new Date().toISOString(),
        tool_name: add_message.tool_name,
        tool_input: add_message.tool_input,
        tool_output: add_message.tool_output,
        files: add_message.files,
      };
      updates.messages = [...currentMessages, newMessage];
    }
    
    const { data: conversation, error } = await supabase
      .from('assistant_conversations')
      .update(updates)
      .eq('id', conversation_id)
      .select('*')
      .single();
    
    if (error) {
      console.error('Error updating conversation:', error);
      return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
    }
    
    return NextResponse.json({ conversation });
  } catch (err: any) {
    console.error('PATCH conversation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE - Delete a conversation
export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase();
    
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('id');
    
    if (!conversationId) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    
    const { error } = await supabase
      .from('assistant_conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', user.id);
    
    if (error) {
      console.error('Error deleting conversation:', error);
      return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('DELETE conversation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';

/**
 * GET /api/storyboard/history?storyboard_id=xxx - Get edit history for a storyboard
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const storyboard_id = url.searchParams.get('storyboard_id');

    if (!storyboard_id) {
      return NextResponse.json({ error: 'Storyboard ID required' }, { status: 400 });
    }

    // Verify ownership of storyboard
    const { data: storyboard, error: storyboardError } = await supabase
      .from('storyboards')
      .select('id')
      .eq('id', storyboard_id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (storyboardError || !storyboard) {
      return NextResponse.json({ error: 'Storyboard not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('storyboard_edit_history')
      .select('*')
      .eq('storyboard_id', storyboard_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching history:', error);
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }

    return NextResponse.json({ history: data });
  } catch (error: any) {
    console.error('GET /api/storyboard/history error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/storyboard/history - Create a manual history entry (for undo/redo)
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { storyboard_id, change_type, before_state, after_state, description } = body;

    if (!storyboard_id || !change_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('storyboard_edit_history')
      .insert({
        storyboard_id,
        user_id: user.id,
        change_type,
        before_state: before_state || null,
        after_state: after_state || null,
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating history entry:', error);
      return NextResponse.json({ error: 'Failed to create history entry' }, { status: 500 });
    }

    return NextResponse.json({ history_entry: data }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/storyboard/history error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '../../../lib/supabaseServer';

export const runtime = 'nodejs';

// GET - List user's ad creatives
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const step = url.searchParams.get('step');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase
      .from('ad_creatives_with_stats')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }
    
    if (step) {
      query = query.eq('current_step', step);
    }

    const { data, error, count } = await query;
    
    if (error) {
      console.error('Error fetching ad creatives:', error);
      return NextResponse.json({ error: 'Failed to fetch creatives' }, { status: 500 });
    }

    return NextResponse.json({
      creatives: data || [],
      total: count,
      limit,
      offset
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new ad creative
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      hook,
      message,
      cta,
      angles = [],
      current_step = 'concept'
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Creative name is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('ad_creatives')
      .insert({
        user_id: user.id,
        name,
        hook,
        message,
        cta,
        angles,
        current_step,
        status: 'draft'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating ad creative:', error);
      return NextResponse.json({ error: 'Failed to create creative' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

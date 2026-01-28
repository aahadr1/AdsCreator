import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { Storyboard } from '@/types/assistant';

/**
 * GET /api/storyboard?id=xxx - Fetch a specific storyboard
 * GET /api/storyboard - List all storyboards for current user
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
    const id = url.searchParams.get('id');

    if (id) {
      // Fetch specific storyboard
      const { data, error } = await supabase
        .from('storyboards')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single();

      if (error) {
        console.error('Error fetching storyboard:', error);
        return NextResponse.json({ error: 'Storyboard not found' }, { status: 404 });
      }

      return NextResponse.json({ storyboard: data });
    } else {
      // List all storyboards for user
      const { data, error } = await supabase
        .from('storyboards')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error listing storyboards:', error);
        return NextResponse.json({ error: 'Failed to list storyboards' }, { status: 500 });
      }

      return NextResponse.json({ storyboards: data });
    }
  } catch (error: any) {
    console.error('GET /api/storyboard error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/storyboard - Create a new storyboard
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
    const {
      conversation_id,
      title,
      brand_name,
      product,
      product_description,
      target_audience,
      platform,
      total_duration_seconds,
      style,
      aspect_ratio,
      avatar_image_url,
      avatar_description,
      product_image_url,
      product_image_description,
      scenario,
      scenes,
      status,
      scenes_needing_product,
    } = body;

    const { data, error } = await supabase
      .from('storyboards')
      .insert({
        user_id: user.id,
        conversation_id: conversation_id || null,
        title,
        brand_name,
        product,
        product_description,
        target_audience,
        platform,
        total_duration_seconds,
        style,
        aspect_ratio: aspect_ratio || '9:16',
        avatar_image_url,
        avatar_description,
        product_image_url,
        product_image_description,
        scenario: scenario || null,
        scenes: scenes || [],
        status: status || 'draft',
        scenes_needing_product: scenes_needing_product || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating storyboard:', error);
      return NextResponse.json({ error: 'Failed to create storyboard' }, { status: 500 });
    }

    return NextResponse.json({ storyboard: data }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/storyboard error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/storyboard - Update an existing storyboard
 */
export async function PATCH(req: NextRequest) {
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
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Storyboard ID required' }, { status: 400 });
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('storyboards')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Storyboard not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('storyboards')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating storyboard:', error);
      return NextResponse.json({ error: 'Failed to update storyboard' }, { status: 500 });
    }

    return NextResponse.json({ storyboard: data });
  } catch (error: any) {
    console.error('PATCH /api/storyboard error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/storyboard?id=xxx - Soft delete a storyboard
 */
export async function DELETE(req: NextRequest) {
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
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Storyboard ID required' }, { status: 400 });
    }

    // Soft delete
    const { error } = await supabase
      .from('storyboards')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting storyboard:', error);
      return NextResponse.json({ error: 'Failed to delete storyboard' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/storyboard error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

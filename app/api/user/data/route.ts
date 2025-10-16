import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '../../../../lib/supabaseServer';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Fast data endpoint that uses Supabase as primary source
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });

    const supabase = createSupabaseServer();
    
    // Parallel fetch all user data from Supabase
    const [tasksResult, userResult, creditsResult, subResult] = await Promise.all([
      // 1. Tasks from Supabase (most reliable)
      supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100),
      
      // 2. User info
      supabase.auth.admin.getUserById(userId),
      
      // 3. Credits
      supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(),
      
      // 4. Subscription
      supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
    ]);

    // Format tasks data
    const tasks = tasksResult.data?.map(t => ({
      id: t.id,
      status: t.status || 'unknown',
      created_at: t.created_at,
      backend: t.backend || t.model_id || null,
      video_url: t.video_url || null,
      audio_url: t.audio_url || null,
      output_url: t.output_url || null,
      type: t.type || null,
      text_input: t.text_input || null,
    })) || [];

    // Build response
    const response = {
      tasks,
      user: {
        email: userResult.data.user?.email || '',
        id: userId
      },
      credits: creditsResult.data ? {
        used: creditsResult.data.used_credits,
        limit: creditsResult.data.monthly_limit,
        remaining: creditsResult.data.monthly_limit - creditsResult.data.used_credits
      } : null,
      subscription: subResult.data ? {
        status: subResult.data.status,
        plan: subResult.data.price_id,
        expires: subResult.data.current_period_end
      } : null,
      timestamp: Date.now()
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=5, stale-while-revalidate=10'
      }
    });
  } catch (error) {
    console.error('User data fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
  }
}

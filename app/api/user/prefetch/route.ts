import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '../../../../lib/supabaseServer';
import { getKvConfigFromEnv, kvListKeysPage, kvGetMany, taskListPrefix, type TaskRecord } from '../../../../lib/cloudflareKv';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Ultra-fast parallel data fetcher running on edge
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });

    // Start ALL data fetches in parallel
    const [tasksData, userData, creditsData] = await Promise.all([
      // 1. Tasks from KV (super fast)
      fetchTasksFast(userId),
      // 2. User email + subscription
      fetchUserData(userId),
      // 3. Credits status
      fetchCreditsQuick(userId)
    ]);

    // Return aggregated data with cache headers for edge caching
    return NextResponse.json({
      tasks: tasksData,
      user: userData,
      credits: creditsData,
      timestamp: Date.now()
    }, {
      headers: {
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
        'CDN-Cache-Control': 'max-age=10'
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to prefetch' }, { status: 500 });
  }
}

async function fetchTasksFast(userId: string): Promise<any[]> {
  const config = getKvConfigFromEnv();
  if (!config.accountId || !config.namespaceId || !config.apiToken) return [];
  
  try {
    const userPrefix = `${taskListPrefix}${userId}:`;
    const { keys } = await kvListKeysPage({ prefix: userPrefix, config, limit: 100 });
    
    if (keys.length === 0) {
      // Fallback: scan with metadata filter
      const { items } = await kvListKeysPageMeta({ prefix: taskListPrefix, config, limit: 100 });
      const matched = items
        .filter(it => (it.metadata as any)?.user_id === userId)
        .map(it => it.name)
        .slice(0, 50);
      if (matched.length === 0) return [];
      
      const values = await kvGetMany<TaskRecord>({ keys: matched, config, concurrency: 20 });
      return values.filter(Boolean).map(formatTask);
    }
    
    // Fast path with high concurrency
    const values = await kvGetMany<TaskRecord>({ keys: keys.slice(0, 50), config, concurrency: 20 });
    return values.filter(Boolean).map(formatTask);
  } catch {
    return [];
  }
}

function formatTask(t: TaskRecord) {
  return {
    id: t.id,
    status: t.status,
    created_at: t.created_at,
    backend: t.backend || null,
    video_url: t.video_url || null,
    audio_url: t.audio_url || null,
    output_url: t.output_url || null,
  };
}

async function fetchUserData(userId: string) {
  try {
    const supabase = createSupabaseServer();
    const [authResult, subResult] = await Promise.all([
      supabase.auth.admin.getUserById(userId),
      supabase.from('subscriptions').select('*').eq('user_id', userId).maybeSingle()
    ]);
    
    return {
      email: authResult.data.user?.email || '',
      subscription: subResult.data ? {
        status: subResult.data.status,
        plan: subResult.data.price_id,
        expires: subResult.data.current_period_end
      } : null
    };
  } catch {
    return { email: '', subscription: null };
  }
}

async function fetchCreditsQuick(userId: string) {
  try {
    const supabase = createSupabaseServer();
    const { data } = await supabase
      .from('user_credits')
      .select('used_credits, monthly_limit')
      .eq('user_id', userId)
      .single();
    
    return data ? {
      used: data.used_credits,
      limit: data.monthly_limit,
      remaining: data.monthly_limit - data.used_credits
    } : null;
  } catch {
    return null;
  }
}

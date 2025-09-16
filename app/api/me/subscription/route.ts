import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '../../../../lib/supabaseServer';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });

    const supabase = createSupabaseServer();
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (!data) {
      return NextResponse.json({ status: 'none' }, { status: 200 });
    }

    return NextResponse.json({
      status: data.status,
      plan_price_id: data.price_id,
      stripe_customer_id: data.stripe_customer_id,
      stripe_subscription_id: data.stripe_subscription_id,
      current_period_end: data.current_period_end,
      cancel_at_period_end: data.cancel_at_period_end,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch subscription';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



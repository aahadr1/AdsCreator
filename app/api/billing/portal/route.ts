import { NextRequest, NextResponse } from 'next/server';
import { stripe, isStripeEnabled } from '../../../../lib/stripe';
import { createSupabaseServer } from '../../../../lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    if (!isStripeEnabled()) {
      return NextResponse.json({ error: 'Billing is not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .limit(1)
      .single();
    if (error || !data?.stripe_customer_id) {
      return NextResponse.json({ error: 'No customer found' }, { status: 400 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${appUrl}/billing`,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to create portal session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}





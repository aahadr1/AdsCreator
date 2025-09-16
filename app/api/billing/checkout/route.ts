import { NextRequest, NextResponse } from 'next/server';
import { stripe, isStripeEnabled } from '../../../../lib/stripe';
import { createSupabaseServer } from '../../../../lib/supabaseServer';

type CheckoutBody = {
  priceId?: string;
  mode?: 'subscription' | 'payment';
  successUrl?: string | null;
  cancelUrl?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    if (!isStripeEnabled()) {
      return NextResponse.json({ error: 'Billing is not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as CheckoutBody;
    const mode = body.mode || 'subscription';

    const allowedPriceIds = [
      process.env.NEXT_PUBLIC_PRICE_BASIC,
      process.env.NEXT_PUBLIC_PRICE_PRO,
    ].filter(Boolean) as string[];

    if (!body.priceId || !allowedPriceIds.includes(body.priceId)) {
      return NextResponse.json({ error: 'Invalid priceId' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = body.successUrl || `${appUrl}/billing?success=1`;
    const cancelUrl = body.cancelUrl || `${appUrl}/billing?canceled=1`;

    // Look up existing Stripe customer for this user
    const supabase = createSupabaseServer();
    let customerId: string | null = null;
    try {
      const { data } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .limit(1)
        .single();
      customerId = data?.stripe_customer_id || null;
    } catch {
      // Table may not exist yet; continue without
    }

    const session = await stripe.checkout.sessions.create({
      mode,
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer: customerId || undefined,
      line_items: [
        { price: body.priceId, quantity: 1 },
      ],
      metadata: {
        user_id: userId,
      },
      subscription_data: mode === 'subscription' ? {
        metadata: { user_id: userId },
      } : undefined,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to create checkout session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



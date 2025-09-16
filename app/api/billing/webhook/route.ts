import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe';
import { createSupabaseServer } from '../../../../lib/supabaseServer';
import type Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET as string;
  if (!secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });

  const buf = Buffer.from(await req.arrayBuffer());
  const sig = req.headers.get('stripe-signature') as string;

  let event: Stripe.Event;
  try {
    // Dynamically import to keep type; use default version
    const { default: Stripe } = await import('stripe');
    event = (new Stripe('unused')).webhooks.constructEvent(buf, sig, secret);
  } catch (err) {
    return new NextResponse('Invalid signature', { status: 400 });
  }

  try {
    const supabase = createSupabaseServer();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const userId = session.metadata?.user_id || session.subscription_metadata?.user_id || null;
        const customerId = session.customer as string | null;
        const subscriptionId = session.subscription as string | null;
        const priceId = session?.line_items?.data?.[0]?.price?.id || session?.subscription_details?.default_price || null;

        if (userId && customerId) {
          await supabase.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            price_id: priceId,
            status: 'active',
          }, { onConflict: 'user_id' });
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as any;
        const userId = sub.metadata?.user_id || null;
        const status = sub.status as string;
        const priceId = sub.items?.data?.[0]?.price?.id as string | null;
        const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
        const cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);
        if (userId) {
          await supabase.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: sub.customer as string,
            stripe_subscription_id: sub.id as string,
            price_id: priceId,
            status,
            current_period_end: currentPeriodEnd,
            cancel_at_period_end: cancelAtPeriodEnd,
          }, { onConflict: 'user_id' });
        }
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Webhook error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



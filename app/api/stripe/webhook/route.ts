import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature') as string;

  let event: Stripe.Event;
  try {
    // Lazy import type only to avoid edge type issues
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const StripeTypes = (await import('stripe')).default;
    event = (new StripeTypes('sk_test', { apiVersion: '2024-06-20' })).webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    return new NextResponse(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as { customer_email?: string | null; metadata?: Record<string, string> | null };
      const email = session.customer_email || session.metadata?.email;
      if (email) {
        await supabaseAdmin.auth.admin.updateUserByEmail(email, { user_metadata: { is_subscribed: true } });
      }
    }

    if (
      event.type === 'customer.subscription.deleted' ||
      event.type === 'customer.subscription.canceled' ||
      event.type === 'invoice.payment_failed'
    ) {
      const obj = event.data.object as { customer_email?: string | null; customer?: string | null } & Record<string, unknown>;
      const email = (obj as { customer_email?: string }).customer_email;
      if (email) {
        await supabaseAdmin.auth.admin.updateUserByEmail(email, { user_metadata: { is_subscribed: false } });
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('webhook handling error', error);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export const config = { api: { bodyParser: false } } as const;



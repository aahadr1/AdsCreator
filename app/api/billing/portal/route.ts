import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { stripe } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // We rely on email to locate a customer; for production, persist customer id
    const customers = await stripe.customers.list({ email: user.email || undefined, limit: 1 });
    const customer = customers.data[0];
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const portal = await stripe.billingPortal.sessions.create({
      customer: customer?.id,
      return_url: `${origin}/billing`,
    });

    return NextResponse.json({ url: portal.url }, { status: 200 });
  } catch (error) {
    console.error('portal error', error);
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
  }
}



import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET(_request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ isSubscribed: false, reason: 'unauthenticated' }, { status: 200 });

    const isSubscribed = Boolean((user.user_metadata as Record<string, unknown> | null)?.is_subscribed);
    return NextResponse.json({ isSubscribed }, { status: 200 });
  } catch (error) {
    console.error('billing status error', error);
    return NextResponse.json({ isSubscribed: false }, { status: 200 });
  }
}



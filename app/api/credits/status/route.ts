import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '../../../../lib/supabaseServer';
import { UserCredits, SubscriptionTier, CREDIT_LIMITS } from '../../../../types/credits';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id parameter' }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    
    // Check if user credits record exists (maybeSingle: returns null when not found)
    const { data: existingCredits, error: fetchError } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching user credits:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
    }

    if (!existingCredits) {
      // Initialize credits for new user
      // First, get their subscription tier
      // Default to 'basic' to satisfy DB constraint in credits.sql (basic|pro)
      let subscriptionTier: SubscriptionTier = 'basic';
      
      try {
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('price_id')
          .eq('user_id', userId)
          .single();

        if (subscription?.price_id === process.env.NEXT_PUBLIC_PRICE_PRO) {
          subscriptionTier = 'pro';
        } else if (subscription?.price_id === process.env.NEXT_PUBLIC_PRICE_BASIC) {
          subscriptionTier = 'basic';
        }
      } catch (err) {
        console.warn('Could not fetch subscription info, defaulting to free:', err);
      }

      // Initialize user credits
      const monthlyLimit = CREDIT_LIMITS[subscriptionTier];
      
      const { data: newCredits, error: initError } = await supabase
        .from('user_credits')
        .insert({
          user_id: userId,
          subscription_tier: subscriptionTier,
          monthly_limit: monthlyLimit,
          used_credits: 0,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          last_reset_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (initError) {
        console.error('Error initializing user credits:', initError);
        return NextResponse.json({ error: 'Failed to initialize credits' }, { status: 500 });
      }

      const userCredits: UserCredits = {
        ...newCredits,
        remaining_credits: newCredits.monthly_limit - newCredits.used_credits,
      };

      return NextResponse.json(userCredits);
    }

    // Check if credits need reset (monthly cycle)
    const now = new Date();
    const currentPeriodEnd = new Date(existingCredits.current_period_end);
    
    if (now > currentPeriodEnd) {
      // Reset credits for new month
      const newPeriodStart = new Date();
      const newPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      const { data: resetCredits, error: resetError } = await supabase
        .from('user_credits')
        .update({
          used_credits: 0,
          current_period_start: newPeriodStart.toISOString(),
          current_period_end: newPeriodEnd.toISOString(),
          last_reset_date: newPeriodStart.toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (resetError) {
        console.error('Error resetting credits:', resetError);
        return NextResponse.json({ error: 'Failed to reset credits' }, { status: 500 });
      }

      // Log reset transaction
      await supabase
        .from('credit_transactions')
        .insert({
          user_id: userId,
          type: 'reset',
          credits: resetCredits.monthly_limit,
          balance_before: existingCredits.used_credits,
          balance_after: 0,
          description: 'Monthly credit reset',
        });

      const userCredits: UserCredits = {
        ...resetCredits,
        remaining_credits: resetCredits.monthly_limit - resetCredits.used_credits,
      };

      return NextResponse.json(userCredits);
    }

    // Return existing credits with calculated remaining
    const userCredits: UserCredits = {
      ...existingCredits,
      remaining_credits: existingCredits.monthly_limit - existingCredits.used_credits,
    };

    return NextResponse.json(userCredits);

  } catch (error) {
    console.error('Credit status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '../../../../lib/supabaseServer';
import { getCreditCost, MODEL_COSTS } from '../../../../types/credits';

interface UseCreditsRequest {
  user_id: string;
  model_name: string;
  credits?: number; // Optional override
  task_id?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    const body: UseCreditsRequest = await req.json();
    const { user_id, model_name, credits, task_id, metadata = {} } = body;

    if (!user_id || !model_name) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, model_name' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServer();
    
    // Get credit cost for the model
    const creditCost = credits || getCreditCost(model_name);
    const modelInfo = MODEL_COSTS[model_name];
    const modelCategory = modelInfo?.category || 'other';

    // Get current user credits
    const { data: userCredits, error: fetchError } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (fetchError) {
      console.error('Error fetching user credits:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user credits. Please refresh and try again.' },
        { status: 500 }
      );
    }

    if (!userCredits) {
      return NextResponse.json(
        { success: false, error: 'User credits not found. Please refresh and try again.' },
        { status: 404 }
      );
    }

    // Check if credits need reset (monthly cycle)
    const now = new Date();
    const currentPeriodEnd = new Date(userCredits.current_period_end);
    let currentUsedCredits = userCredits.used_credits;
    
    if (now > currentPeriodEnd) {
      // Reset credits for new month
      const newPeriodStart = new Date();
      const newPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      const { error: resetError } = await supabase
        .from('user_credits')
        .update({
          used_credits: 0,
          current_period_start: newPeriodStart.toISOString(),
          current_period_end: newPeriodEnd.toISOString(),
          last_reset_date: newPeriodStart.toISOString(),
        })
        .eq('user_id', user_id);

      if (resetError) {
        console.error('Error resetting credits:', resetError);
        return NextResponse.json(
          { success: false, error: 'Failed to reset credits' },
          { status: 500 }
        );
      }

      // Log reset transaction
      await supabase
        .from('credit_transactions')
        .insert({
          user_id,
          type: 'reset',
          credits: userCredits.monthly_limit,
          balance_before: currentUsedCredits,
          balance_after: 0,
          description: 'Monthly credit reset',
        });

      currentUsedCredits = 0;
    }

    // Check if user has enough credits
    const remainingCredits = userCredits.monthly_limit - currentUsedCredits;
    if (remainingCredits < creditCost) {
      return NextResponse.json({
        success: false,
        error: `Insufficient credits. You need ${creditCost} credits but only have ${remainingCredits} remaining.`,
        required: creditCost,
        available: remainingCredits,
      });
    }

    const newUsedCredits = currentUsedCredits + creditCost;

    // Start transaction
    const { error: updateError } = await supabase
      .from('user_credits')
      .update({
        used_credits: newUsedCredits,
      })
      .eq('user_id', user_id);

    if (updateError) {
      console.error('Error updating user credits:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update credits' },
        { status: 500 }
      );
    }

    // Log the usage
    const { error: usageError } = await supabase
      .from('credit_usage')
      .insert({
        user_id,
        model_name,
        model_category: modelCategory,
        credits_used: creditCost,
        task_id,
        metadata,
      });

    if (usageError) {
      console.error('Error logging credit usage:', usageError);
      // Don't fail the request for logging errors, but log it
    }

    // Log transaction
    const { error: transactionError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id,
        type: 'usage',
        credits: creditCost,
        balance_before: currentUsedCredits,
        balance_after: newUsedCredits,
        model_name,
        task_id,
        description: `Used ${creditCost} credits for ${model_name}`,
      });

    if (transactionError) {
      console.error('Error logging credit transaction:', transactionError);
      // Don't fail the request for logging errors
    }

    return NextResponse.json({
      success: true,
      credits_used: creditCost,
      remaining_credits: userCredits.monthly_limit - newUsedCredits,
      model_name,
      model_category: modelCategory,
    });

  } catch (error) {
    console.error('Use credits error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

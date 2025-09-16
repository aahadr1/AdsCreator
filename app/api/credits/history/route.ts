import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '../../../../lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type'); // 'usage', 'transactions', or null for both

    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id parameter' }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    
    if (type === 'usage') {
      // Get credit usage history
      const { data: usage, error: usageError } = await supabase
        .from('credit_usage')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (usageError) {
        console.error('Error fetching credit usage:', usageError);
        return NextResponse.json({ error: 'Failed to fetch usage history' }, { status: 500 });
      }

      return NextResponse.json({ usage: usage || [] });
    }

    if (type === 'transactions') {
      // Get credit transactions history
      const { data: transactions, error: transactionError } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (transactionError) {
        console.error('Error fetching credit transactions:', transactionError);
        return NextResponse.json({ error: 'Failed to fetch transaction history' }, { status: 500 });
      }

      return NextResponse.json({ transactions: transactions || [] });
    }

    // Get both usage and transactions
    const [usageResult, transactionResult] = await Promise.all([
      supabase
        .from('credit_usage')
        .select('*, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(0, 24), // Recent 25 usage records
      
      supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(0, 24) // Recent 25 transactions
    ]);

    if (usageResult.error) {
      console.error('Error fetching credit usage:', usageResult.error);
      return NextResponse.json({ error: 'Failed to fetch usage history' }, { status: 500 });
    }

    if (transactionResult.error) {
      console.error('Error fetching credit transactions:', transactionResult.error);
      return NextResponse.json({ error: 'Failed to fetch transaction history' }, { status: 500 });
    }

    // Combine and sort by date
    const combined = [
      ...(usageResult.data || []).map(item => ({ ...item, type: 'usage' })),
      ...(transactionResult.data || []).map(item => ({ ...item, type: 'transaction' })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({
      history: combined.slice(0, limit),
      usage: usageResult.data || [],
      transactions: transactionResult.data || [],
    });

  } catch (error) {
    console.error('Credit history error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

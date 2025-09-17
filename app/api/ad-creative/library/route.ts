import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '../../../../lib/supabaseServer';

export const runtime = 'nodejs';

// GET - Fetch library data (angles, messages, CTAs)
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    
    const url = new URL(request.url);
    const type = url.searchParams.get('type'); // 'angles', 'messages', 'ctas', or 'all'

    if (type && !['angles', 'messages', 'ctas', 'all'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    }

    const result: any = {};

    if (!type || type === 'all' || type === 'angles') {
      const { data: angles, error: anglesError } = await supabase
        .from('ad_angles')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });
        
      if (anglesError) {
        console.error('Error fetching angles:', anglesError);
        return NextResponse.json({ error: 'Failed to fetch angles' }, { status: 500 });
      }
      
      result.angles = angles;
    }

    if (!type || type === 'all' || type === 'messages') {
      const { data: messages, error: messagesError } = await supabase
        .from('ad_messages')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('title', { ascending: true });
        
      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
      }
      
      result.messages = messages;
    }

    if (!type || type === 'all' || type === 'ctas') {
      const { data: ctas, error: ctasError } = await supabase
        .from('ad_ctas')
        .select('*')
        .eq('is_active', true)
        .order('urgency_level', { ascending: false })
        .order('text', { ascending: true });
        
      if (ctasError) {
        console.error('Error fetching CTAs:', ctasError);
        return NextResponse.json({ error: 'Failed to fetch CTAs' }, { status: 500 });
      }
      
      result.ctas = ctas;
    }

    // If specific type requested, return just that data
    if (type && type !== 'all') {
      return NextResponse.json(result[type] || []);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

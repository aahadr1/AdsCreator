import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { Influencer } from '@/types/influencer';

function normalizeUsername(input: string): string {
  // Lowercase, strip accents, keep [a-z0-9_], collapse repeats.
  const ascii = input
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, ''); // remove diacritics
  const cleaned = ascii
    .replace(/[^a-z0-9]+/g, '_') // convert non-alnum runs to _
    .replace(/^_+|_+$/g, '') // trim _
    .replace(/_{2,}/g, '_'); // collapse __
  return cleaned;
}

function escapeLikePatternExact(input: string): string {
  // Escape LIKE wildcards so we can use ilike() as case-insensitive equality.
  // In Postgres, backslash is the default escape character for LIKE patterns.
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

async function usernameExistsCaseInsensitive(supabase: any, username: string): Promise<boolean> {
  const pattern = escapeLikePatternExact(username);
  const { data, error } = await supabase
    .from('influencers')
    .select('id')
    .ilike('username', pattern)
    .is('deleted_at', null)
    .limit(1);

  if (error) {
    console.error('Error checking username uniqueness:', error);
    // Fail closed: treat as taken to avoid duplicates.
    return true;
  }
  return Array.isArray(data) && data.length > 0;
}

async function buildUniqueUsername(supabase: any, base: string): Promise<string> {
  const normalizedBase = normalizeUsername(base);
  if (!normalizedBase || normalizedBase.length < 2) {
    throw new Error('Username is too short after normalization');
  }
  // Keep it within our intended constraints (and DB check constraint for new rows).
  const cappedBase = normalizedBase.slice(0, 28); // leave room for suffix digits

  // Try base first, then base2, base3...
  if (!(await usernameExistsCaseInsensitive(supabase, cappedBase))) return cappedBase;
  for (let i = 2; i <= 999; i++) {
    const candidate = `${cappedBase}${i}`;
    if (candidate.length > 32) continue;
    if (!(await usernameExistsCaseInsensitive(supabase, candidate))) return candidate;
  }
  throw new Error('Could not allocate a unique username (too many collisions)');
}

/**
 * GET /api/influencer?id=xxx - Fetch a specific influencer
 * GET /api/influencer - List all influencers for current user
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (id) {
      // Fetch specific influencer
      const { data, error } = await supabase
        .from('influencers')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single();

      if (error) {
        console.error('Error fetching influencer:', error);
        return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
      }

      return NextResponse.json({ influencer: data });
    } else {
      // List all influencers for user
      const { data, error } = await supabase
        .from('influencers')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error listing influencers:', error);
        return NextResponse.json({ error: 'Failed to list influencers' }, { status: 500 });
      }

      return NextResponse.json({ influencers: data });
    }
  } catch (error: any) {
    console.error('GET /api/influencer error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/influencer - Create a new influencer
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      username,
      user_description,
      enriched_description,
      status,
      input_images,
    } = body;

    if (!name || !user_description) {
      return NextResponse.json(
        { error: 'name and user_description are required' },
        { status: 400 }
      );
    }

    // Server-authoritative, globally unique username with auto-suffixing on collisions.
    const desiredBase = typeof username === 'string' && username.trim().length > 0 ? username : name;
    const finalUsername = await buildUniqueUsername(supabase, String(desiredBase));

    // Retry loop: in case of rare race-condition collisions with the unique index.
    let lastError: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidateUsername = attempt === 0 ? finalUsername : `${finalUsername}${attempt + 1}`;

      const { data, error } = await supabase
        .from('influencers')
        .insert({
          user_id: user.id,
          name,
          username: candidateUsername || null,
          // Legacy columns: keep older DB constraints happy if they exist
          short_description: user_description,
          full_description: enriched_description || null,
          user_description,
          enriched_description: enriched_description || null,
          generation_prompt: enriched_description || user_description, // For backward compatibility
          input_images: input_images || null,
          status: status || 'draft',
        })
        .select()
        .single();

      if (!error) {
        return NextResponse.json({ influencer: data }, { status: 201 });
      }

      lastError = error;
      // 23505 = unique_violation
      if (String((error as any)?.code) === '23505') {
        continue;
      }
      console.error('Error creating influencer:', error);
      return NextResponse.json({ error: 'Failed to create influencer' }, { status: 500 });
    }

    console.error('Error creating influencer after retries:', lastError);
    return NextResponse.json({ error: 'Failed to create influencer' }, { status: 500 });
  } catch (error: any) {
    console.error('POST /api/influencer error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/influencer - Update an existing influencer
 */
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Influencer ID required' }, { status: 400 });
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('influencers')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('influencers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating influencer:', error);
      return NextResponse.json({ error: 'Failed to update influencer' }, { status: 500 });
    }

    return NextResponse.json({ influencer: data });
  } catch (error: any) {
    console.error('PATCH /api/influencer error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/influencer?id=xxx - Soft delete an influencer
 */
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Influencer ID required' }, { status: 400 });
    }

    // Soft delete
    const { error } = await supabase
      .from('influencers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting influencer:', error);
      return NextResponse.json({ error: 'Failed to delete influencer' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/influencer error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) return new Response('Server misconfigured: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY', { status: 500 });

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const sql = `
      -- Create tables if they don't exist
      create table if not exists public.media_descriptions (
        asset_id uuid not null,
        description text,
        source text default 'replicate',
        created_at timestamp with time zone default now()
      );

      create table if not exists public.media_analysis (
        asset_id uuid not null,
        analysis jsonb,
        created_at timestamp with time zone default now()
      );

      create table if not exists public.media_labels (
        asset_id uuid not null,
        label text not null,
        source text default 'replicate',
        created_at timestamp with time zone default now()
      );

      create table if not exists public.media_index (
        asset_id uuid not null,
        embedding double precision[] not null,
        index_version integer default 1,
        created_at timestamp with time zone default now()
      );

      -- Enable RLS
      alter table public.media_descriptions enable row level security;
      alter table public.media_analysis enable row level security;
      alter table public.media_labels enable row level security;
      alter table public.media_index enable row level security;

      -- Create read policies if missing
      do $$
      begin
        if not exists (
          select 1 from pg_policies
          where schemaname = 'public' and tablename = 'media_descriptions' and policyname = 'allow_read_media_descriptions'
        ) then
          create policy allow_read_media_descriptions on public.media_descriptions for select using (true);
        end if;

        if not exists (
          select 1 from pg_policies
          where schemaname = 'public' and tablename = 'media_analysis' and policyname = 'allow_read_media_analysis'
        ) then
          create policy allow_read_media_analysis on public.media_analysis for select using (true);
        end if;

        if not exists (
          select 1 from pg_policies
          where schemaname = 'public' and tablename = 'media_labels' and policyname = 'allow_read_media_labels'
        ) then
          create policy allow_read_media_labels on public.media_labels for select using (true);
        end if;

        if not exists (
          select 1 from pg_policies
          where schemaname = 'public' and tablename = 'media_index' and policyname = 'allow_read_media_index'
        ) then
          create policy allow_read_media_index on public.media_index for select using (true);
        end if;
      end$$;
    `;

    // Use PostgREST RPC via SQL function call is not available; use HTTP fetch to Supabase REST / query? We can't here. Instead, rely on Supabase SQL func via pg_net not available. Use REST 'execute' not available.
    // Workaround: use the service role PostgREST to upsert a no-op; we cannot run raw SQL via client. As an alternative, call Supabase SQL REST from Supabase dashboard is typical.
    // Fallback: create each table individually via supabase.rpc is not applicable. We'll attempt to insert/select to detect existence and return instructions if missing.

    // Attempt to detect existence via select; if 42P01 (undefined_table), report missing.
    const probes = [] as Array<{ table: string; exists: boolean; error?: string }>;
    for (const table of ['media_descriptions','media_analysis','media_labels','media_index']) {
      try {
        await supabase.from(table as any).select('*').limit(1);
        probes.push({ table, exists: true });
      } catch (e: unknown) {
        probes.push({ table, exists: false, error: e instanceof Error ? e.message : 'Unknown error' });
      }
    }

    return Response.json({ ok: true, note: 'If tables missing, run the provided SQL in Supabase SQL editor.', sql, probes });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}



import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) return new Response('Server misconfigured: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY', { status: 500 });

    const body = await req.json() as { asset_id?: string } | null;
    const assetId = String(body?.asset_id || '').trim();
    if (!assetId) return new Response('Missing asset_id', { status: 400 });

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const [{ data: asset }, { data: labels }, { data: desc }, { data: analysis }] = await Promise.all([
      supabase.from('media_assets').select('id, type, storage_path, status, public_url, mime_type, created_at').eq('id', assetId).single(),
      supabase.from('media_labels').select('asset_id, label').eq('asset_id', assetId),
      supabase.from('media_descriptions').select('asset_id, description').eq('asset_id', assetId).single(),
      supabase.from('media_analysis').select('asset_id, analysis').eq('asset_id', assetId).single(),
    ]);

    return Response.json({
      ok: true,
      asset: asset || null,
      labels: (labels as Array<{ asset_id: string; label: string }>) || [],
      description: (desc as { asset_id: string; description: string } | null)?.description || '',
      analysis: (analysis as { asset_id: string; analysis: Record<string, unknown> } | null)?.analysis || null,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}



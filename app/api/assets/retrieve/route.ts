import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Replicate from 'replicate';

export const runtime = 'nodejs';

type QueryPart = { id: string; text: string; top_k?: number };

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) return new Response('Server misconfigured: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY', { status: 500 });

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });
    const replicate = new Replicate({ auth: token });

    const body = await req.json() as { parts: QueryPart[] } | null;
    const parts = (body?.parts || []).filter((p) => p && typeof p.text === 'string');
    if (!parts.length) return new Response('Missing parts', { status: 400 });

    // Embed queries in batch
    const embedModel = process.env.REPLICATE_EMBED_MODEL || 'lucataco/snowflake-arctic-embed-l:38f2c666dd6a9f96c50eca69bbb0029ed03cba002a289983dc0b487a93cfb1b4';
    const embeddings: number[][] = [];
    for (const p of parts) {
      const embOut = (await replicate.run(embedModel, { input: { prompt: p.text } })) as unknown;
      const vec = Array.isArray(embOut)
        ? (embOut as unknown[]).map((v) => Number(v))
        : Array.isArray((embOut as { data?: unknown[] }).data)
          ? ((embOut as { data: unknown[] }).data.map((v) => Number(v)))
          : [];
      embeddings.push(vec);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // Vector search via Postgres function if available; fallback to cosine on client side (less ideal)
    const results: Record<string, any[]> = {};
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      const vec = embeddings[i];
      const k = Math.max(1, Math.min(50, Number(part.top_k) || 8));

      let rows: any[] | null = null;
      try {
        const { data } = await supabase.rpc('match_assets', { query_embedding: vec, match_count: k });
        rows = (data as any[]) || null;
      } catch {}

      if (!rows) {
        // Fallback naive similarity: fetch subset (limit) and compute cosine in JS
        const { data } = await supabase.from('assets').select('id, title, description, labels, keywords, public_url, kind, embedding').limit(200);
        const pool = (data as any[]) || [];
        const scored = pool.map((r) => {
          const e: number[] = Array.isArray(r.embedding) ? r.embedding.map((v: unknown) => Number(v)) : [];
          const dot = e.length === vec.length ? e.reduce((acc, v, idx) => acc + v * vec[idx], 0) : 0;
          const magA = Math.sqrt(e.reduce((acc, v) => acc + v * v, 0));
          const magB = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
          const cos = magA > 0 && magB > 0 ? dot / (magA * magB) : 0;
          return { ...r, score: cos };
        }).sort((a, b) => b.score - a.score).slice(0, k);
        rows = scored;
      }
      results[part.id] = rows;
    }

    return Response.json({ ok: true, results });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}




import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Replicate from 'replicate';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) return new Response('Server misconfigured: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY', { status: 500 });
    const token = process.env.REPLICATE_API_TOKEN || '';
    if (!token) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });

    const body = await req.json() as { script_id?: string; segments?: Array<{ id?: string; text: string; intent?: string; keywords?: string[]; visual_style?: string }>; dry_run?: boolean } | null;
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    let segments: Array<{ id: string; text: string; intent: string; keywords: string[]; visual_style: string } > = [];
    if (body?.segments && Array.isArray(body.segments)) {
      segments = body.segments.map((s, i) => ({ id: s.id || `seg_${i}`, text: s.text, intent: s.intent || '', keywords: Array.isArray(s.keywords) ? s.keywords : [], visual_style: s.visual_style || '' }));
    } else if (body?.script_id) {
      const { data } = await supabase.from('script_segments').select('id, text, intent, keywords, visual_style').eq('script_id', body.script_id).order('id', { ascending: true });
      segments = ((data as any[]) || []).map((r) => ({ id: String(r.id), text: r.text || '', intent: r.intent || '', keywords: (r.keywords as string[]) || [], visual_style: r.visual_style || '' }));
    } else {
      return new Response('Provide segments or script_id', { status: 400 });
    }

    const replicate = new Replicate({ auth: token });
    const embedModel = (process.env.REPLICATE_EMBED_MODEL || 'lucataco/snowflake-arctic-embed-l:38f2c666dd6a9f96c50eca69bbb0029ed03cba002a289983dc0b487a93cfb1b4') as `${string}/${string}`;
    const chooserModel = process.env.REPLICATE_SEQUENCE_MODEL || 'meta/meta-llama-3-70b-instruct';

    // Top-k retrieval per segment
    const candidates: Record<string, any[]> = {};
    for (const s of segments) {
      const query = [s.text, s.intent, s.keywords?.join(' '), s.visual_style].filter(Boolean).join('\n');
      const embOut = (await replicate.run(embedModel, { input: { prompt: query } })) as any;
      const vec: number[] = Array.isArray(embOut) ? embOut.map((v: unknown) => Number(v)) : Array.isArray(embOut?.data) ? embOut.data.map((v: unknown) => Number(v)) : [];

      let rows: any[] | null = null;
      try {
        const { data } = await supabase.rpc('match_assets', { query_embedding: vec, match_count: 12 });
        rows = (data as any[]) || null;
      } catch {}
      if (!rows) {
        const { data } = await supabase.from('media_assets').select('id, type');
        const pool = (data as any[]) || [];
        const { data: idx } = await supabase.from('media_index').select('asset_id, embedding');
        const byId = new Map<string, number[]>(); (idx as any[] || []).forEach((r) => byId.set(String(r.asset_id), (r.embedding as number[]) || []));
        const scored = pool.map((r) => {
          const e: number[] = byId.get(String(r.id)) || [];
          const dot = e.length === vec.length ? e.reduce((acc, v, i) => acc + v * vec[i], 0) : 0;
          const magA = Math.sqrt(e.reduce((a, v) => a + v * v, 0));
          const magB = Math.sqrt(vec.reduce((a, v) => a + v * v, 0));
          const cos = magA > 0 && magB > 0 ? dot / (magA * magB) : 0;
          return { id: r.id, score: cos };
        }).sort((a, b) => b.score - a.score).slice(0, 12);
        rows = scored;
      }
      candidates[s.id] = rows;
    }

    // Choose best via LLM
    const chooserInput = segments.map((s) => ({
      segment_id: s.id,
      text: s.text,
      intent: s.intent,
      keywords: s.keywords,
      visual_style: s.visual_style,
      candidates: (candidates[s.id] || []).map((c) => ({ id: c.id, score: c.score }))
    }));

    const chooserPrompt = `You are an expert UGC editor. For each segment, pick one candidate asset id and provide a one-sentence rationale and a confidence 0..1. Return JSON { items: [{ segment_id, chosen_asset_id, rationale, confidence }] } only.\n\nDATA:\n${JSON.stringify(chooserInput)}`;
    const chooserOut = (await replicate.run(chooserModel as `${string}/${string}`, { input: { prompt: chooserPrompt, temperature: 0.1 } })) as unknown;
    const chooserTxt = typeof chooserOut === 'string' ? chooserOut : Array.isArray(chooserOut) ? chooserOut.join('\n') : JSON.stringify(chooserOut);
    const sIdx = chooserTxt.indexOf('{'); const eIdx = chooserTxt.lastIndexOf('}');
    const parsed = sIdx >= 0 && eIdx >= 0 ? (() => { try { return JSON.parse(chooserTxt.slice(sIdx, eIdx + 1)) as { items?: any[] } } catch { return { items: [] as any[] } } })() : { items: [] as any[] };
    const items = Array.isArray(parsed.items) ? parsed.items : [];

    if (body?.dry_run) return Response.json({ ok: true, items, candidates });

    // Persist to sequence_map when script_id provided
    if (body?.script_id) {
      for (const it of items) {
        try {
          await supabase.from('sequence_map').insert({ script_segment_id: it.segment_id, asset_id: it.chosen_asset_id, rationale: it.rationale || '', confidence: typeof it.confidence === 'number' ? it.confidence : null });
        } catch {}
      }
    }

    return Response.json({ ok: true, items, candidates });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}




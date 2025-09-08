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

    const body = await req.json() as { text?: string; source_type?: string; dry_run?: boolean } | null;
    const text = (body?.text || '').trim();
    if (!text) return new Response('Missing text', { status: 400 });

    const replicate = new Replicate({ auth: token });
    const model = (process.env.REPLICATE_SEGMENT_MODEL || 'meta/meta-llama-3-8b-instruct') as `${string}/${string}`;
    const sys = 'Segment ad script. Return JSON array of items: { start_sec|null, end_sec|null, text, intent, keywords[], visual_style }.';
    const out = (await replicate.run(model as `${string}/${string}`, { input: { prompt: `${sys}\n\nSCRIPT:\n${text}\n\nReturn JSON array only.`, temperature: 0.1 } })) as unknown;
    const raw = typeof out === 'string' ? out : Array.isArray(out) ? out.join('\n') : JSON.stringify(out);
    const s = raw.indexOf('['), e = raw.lastIndexOf(']');
    const arr = s >= 0 && e >= 0 ? (() => { try { return JSON.parse(raw.slice(s, e + 1)) as unknown[] } catch { return [] as unknown[] } })() : [] as unknown[];
    const segments = Array.isArray(arr) ? arr.map((x, i) => {
      const o = (x && typeof x === 'object') ? x as Record<string, unknown> : {};
      return {
        index: i,
        start_sec: typeof o.start_sec === 'number' ? o.start_sec : null,
        end_sec: typeof o.end_sec === 'number' ? o.end_sec : null,
        text: typeof o.text === 'string' ? o.text : '',
        intent: typeof o.intent === 'string' ? o.intent : '',
        keywords: Array.isArray(o.keywords) ? (o.keywords as unknown[]).filter((v) => typeof v === 'string') as string[] : [],
        visual_style: typeof o.visual_style === 'string' ? o.visual_style : '',
      };
    }) : [];

    if ((body?.dry_run) === true) return Response.json({ ok: true, segments });

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: scriptRow } = await supabase.from('scripts').insert({ raw_text: text, source_type: body?.source_type || 'manual' }).select('*').single();
    if (scriptRow?.id) {
      const rows = segments.map((s) => ({
        script_id: scriptRow.id,
        start_sec: s.start_sec,
        end_sec: s.end_sec,
        text: s.text,
        intent: s.intent,
        keywords: s.keywords,
        visual_style: s.visual_style,
      }));
      if (rows.length) {
        try { await supabase.from('script_segments').insert(rows); } catch {}
      }
    }

    return Response.json({ ok: true, script_id: scriptRow?.id, segments });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}






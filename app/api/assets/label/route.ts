import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Replicate from 'replicate';

export const runtime = 'nodejs';

type MediaKind = 'image' | 'video';

type LabelResult = {
  title: string;
  description: string;
  labels: string[];
  keywords: string[];
  embedding: number[];
};

async function runLabeling({ url, kind, replicate }: { url: string; kind: MediaKind; replicate: Replicate }): Promise<LabelResult> {
  const system = 'You are an expert UGC ads creative editor. Given a media URL, return concise JSON with: title, description (1-2 sentences), labels (5-10 tags), keywords (8-20 search terms). Focus on what the clip visually contains and potential B-roll use cases. Return JSON only.';
  const prompt = `Media kind: ${kind}. Media URL: ${url}. Produce JSON.`;
  const model = 'meta/meta-llama-3-8b-instruct';
  const llmOut = (await replicate.run(model, {
    input: { prompt: `${system}\n\n${prompt}`, max_tokens: 512, temperature: 0.2 },
  })) as unknown;

  const text = typeof llmOut === 'string' ? llmOut : Array.isArray(llmOut) ? llmOut.join('\n') : JSON.stringify(llmOut);
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  const trimmed = jsonStart >= 0 && jsonEnd >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text;
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(trimmed) as Record<string, unknown>; } catch {}

  const title = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : 'Untitled asset';
  const description = typeof parsed.description === 'string' ? (parsed.description as string).trim() : '';
  const labels = Array.isArray(parsed.labels) ? (parsed.labels as unknown[]).filter((v) => typeof v === 'string').slice(0, 16) as string[] : [];
  const keywords = Array.isArray(parsed.keywords) ? (parsed.keywords as unknown[]).filter((v) => typeof v === 'string').slice(0, 24) as string[] : [];

  const embeddingText = [title, description, labels.join(' '), keywords.join(' ')].filter(Boolean).join('\n');
  const embedModel = process.env.REPLICATE_EMBED_MODEL || 'lucataco/snowflake-arctic-embed-l:38f2c666dd6a9f96c50eca69bbb0029ed03cba002a289983dc0b487a93cfb1b4';
  const embOut = (await replicate.run(embedModel, { input: { prompt: embeddingText } })) as unknown;
  const embedding = Array.isArray(embOut)
    ? (embOut as unknown[]).map((v) => Number(v))
    : Array.isArray((embOut as { data?: unknown[] }).data)
      ? ((embOut as { data: unknown[] }).data.map((v) => Number(v)))
      : [];

  return { title, description, labels, keywords, embedding };
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) return new Response('Server misconfigured: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY', { status: 500 });

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });
    const replicate = new Replicate({ auth: token });

    const body = await req.json() as { asset_id?: string; storage_path?: string; public_url?: string; kind?: MediaKind };
    const { asset_id: assetId, storage_path: storagePath, public_url: publicUrl, kind } = body || {};
    if (!assetId && !storagePath && !publicUrl) return new Response('Provide one of asset_id, storage_path, or public_url', { status: 400 });

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    let asset: { id: string; public_url: string | null; storage_path: string; kind: MediaKind } | null = null;
    if (assetId) {
      const { data } = await supabase.from('assets').select('id, public_url, storage_path, kind').eq('id', assetId).single();
      asset = (data as typeof asset) || null;
    } else if (storagePath) {
      const { data } = await supabase.from('assets').select('id, public_url, storage_path, kind').eq('storage_path', storagePath).single();
      asset = (data as typeof asset) || null;
    }

    const url = publicUrl || asset?.public_url;
    const resolvedKind: MediaKind = (kind || asset?.kind || 'video') as MediaKind;
    if (!url) return new Response('Asset URL not found', { status: 404 });

    const labeled = await runLabeling({ url, kind: resolvedKind, replicate });
    const { data, error } = await supabase
      .from('assets')
      .update({
        title: labeled.title,
        description: labeled.description,
        labels: labeled.labels,
        keywords: labeled.keywords,
        embedding: labeled.embedding,
        status: 'indexed',
      })
      .eq('storage_path', asset?.storage_path || storagePath || '')
      .select('*')
      .single();
    if (error) return new Response(error.message, { status: 500 });

    return Response.json({ ok: true, asset: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}




import { NextRequest } from 'next/server';
import Replicate from 'replicate';

export const runtime = 'nodejs';

type Segment = { id: string; text: string; desired_rush_description?: string; rush_ideas?: string[] };
type Candidate = { id: string; public_url: string; title?: string | null; description?: string | null; score?: number };

export async function POST(req: NextRequest) {
  try {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });
    const replicate = new Replicate({ auth: token });

    const body = await req.json() as { segments: Segment[]; candidates: Record<string, Candidate[]> } | null;
    if (!body || !Array.isArray(body.segments) || typeof body.candidates !== 'object') {
      return new Response('Missing segments/candidates', { status: 400 });
    }

    const system = [
      'You are an expert UGC ads creative editor. Given segments of a script and candidate B-roll options per segment,',
      'consider each segment\'s three rush ideas (if provided) and desired rush description when choosing the best single candidate.',
      'Return JSON only with fields: items: [{ segment_id, chosen_asset_id, reason }]. Keep reasons concise (<= 1 sentence).'
    ].join(' ');

    const summary = body.segments.map((s, i) => {
      const cs = (body.candidates[s.id] || []).slice(0, 10).map((c) => ({ id: c.id, url: c.public_url, title: c.title, desc: c.description, score: c.score })).filter(Boolean);
      return { index: i, segment_id: s.id, text: s.text, desired: s.desired_rush_description || '', rush_ideas: Array.isArray(s.rush_ideas) ? s.rush_ideas.slice(0, 3) : [], candidates: cs };
    });

    const model = 'meta/meta-llama-3-70b-instruct';
    const out = (await replicate.run(model as `${string}/${string}`, {
      input: {
        prompt: `${system}\n\nDATA (JSON):\n${JSON.stringify(summary)}\n\nReturn JSON for { items: [...] } only.`,
        max_tokens: 1200,
        temperature: 0.1,
      }
    })) as unknown;

    const text = typeof out === 'string' ? out : Array.isArray(out) ? out.join('\n') : JSON.stringify(out);
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    const trimmed = jsonStart >= 0 && jsonEnd >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text;
    let parsed: { items?: { segment_id: string; chosen_asset_id: string; reason?: string }[] } = {};
    try { parsed = JSON.parse(trimmed) as typeof parsed; } catch {}
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return Response.json({ ok: true, items });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}




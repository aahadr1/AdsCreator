import { NextRequest } from 'next/server';
import Replicate from 'replicate';

export const runtime = 'nodejs';

type Segment = {
  index: number;
  text: string;
  duration_hint_sec?: number | null;
  desired_rush_description: string;
  keywords?: string[];
  rush_ideas: string[];
};

function extractJsonArray(text: string): unknown[] | null {
  // Try fenced code block first
  const fenceIdx = text.indexOf('```');
  if (fenceIdx >= 0) {
    const rest = text.slice(fenceIdx + 3);
    let lang = '';
    let i = 0;
    while (i < rest.length && rest[i] !== '\n') { lang += rest[i]; i += 1; }
    const bodyStart = fenceIdx + 3 + lang.length + 1;
    const fenceEnd = text.indexOf('```', bodyStart);
    if (fenceEnd > bodyStart) {
      const inside = text.slice(bodyStart, fenceEnd).trim();
      const arr = extractJsonArray(inside);
      if (arr) return arr;
    }
  }
  // Try bracket extraction
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  const sliced = start >= 0 && end >= 0 ? text.slice(start, end + 1) : text;
  try {
    const parsed = JSON.parse(sliced) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });
    const replicate = new Replicate({ auth: token });

    const body = await req.json() as { script?: string; transcript?: string } | null;
    const script = (body?.script || body?.transcript || '').trim();
    if (!script) return new Response('Missing script/transcript', { status: 400 });

    const system = [
      'You are a senior UGC ads creative editor. Segment the script into concise parts.',
      'Return a JSON array only. Each item must contain:',
      '{ index (0-based number), text (string), duration_hint_sec (number|null),',
      'desired_rush_description (string), keywords (string[]), rush_ideas (string[3]) }.',
      'rush_ideas must be exactly three short, concrete visual B-roll ideas. No numbering or prose.',
    ].join(' ');

    const prompt = `SCRIPT:\n${script}\n\nReturn JSON array only. No code fences, no extra text.`;
    const modelCandidates = [
      process.env.REPLICATE_SEGMENT_MODEL || 'meta/meta-llama-3-8b-instruct',
      'meta/meta-llama-3-70b-instruct',
    ];

    let textOut = '';
    let arr: unknown[] | null = null;
    let lastErr: string | null = null;
    for (const m of modelCandidates) {
      try {
        const out = (await replicate.run(m as `${string}/${string}`, { input: { prompt: `${system}\n\n${prompt}`, temperature: 0.1 } })) as unknown;
        textOut = typeof out === 'string' ? out : Array.isArray(out) ? out.join('\n') : JSON.stringify(out);
        arr = extractJsonArray(textOut);
        if (arr) break;
      } catch (e: unknown) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }

    if (!arr) {
      // Second pass: ask model to reformat strictly as JSON using stronger instruction and fallback model
      const reformatPrompt = [
        'Reformat the following into a strict JSON array. Only output JSON, no prose, no code fences.',
        'Each item must be: { index:number, text:string, duration_hint_sec:number|null, desired_rush_description:string, keywords:string[], rush_ideas:string[3] }.\n',
        'INPUT:\n',
        textOut,
      ].join('');
      const reformCandidates = modelCandidates;
      for (const m of reformCandidates) {
        try {
          const out2 = (await replicate.run(m as `${string}/${string}`, { input: { prompt: reformatPrompt, temperature: 0.0 } })) as unknown;
          const txt2 = typeof out2 === 'string' ? out2 : Array.isArray(out2) ? out2.join('\n') : JSON.stringify(out2);
          arr = extractJsonArray(txt2);
          if (arr) break;
        } catch {}
      }
    }

    if (!arr) {
      // Final fallback: naive sentence segmentation so UX can continue
      const sentences = script
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const segments: Segment[] = sentences.map((t, i) => ({
        index: i,
        text: t,
        duration_hint_sec: null,
        desired_rush_description: '',
        keywords: [],
        rush_ideas: [],
      }));
      return Response.json({ ok: true, segments, fallback: 'naive' });
    }

    const segments: Segment[] = [];
    let i = 0;
    for (const item of arr) {
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const tryIdeas = (): string[] => {
          const candidates: unknown[] = [
            (obj as Record<string, unknown>).rush_ideas,
            (obj as Record<string, unknown>).rushIdeas,
            (obj as Record<string, unknown>).ideas,
            (obj as Record<string, unknown>).broll_ideas,
            (obj as Record<string, unknown>).brollIdeas,
          ].filter(Boolean) as unknown[];
          for (const c of candidates) {
            if (Array.isArray(c)) {
              return (c as unknown[]).filter((v) => typeof v === 'string').slice(0, 3) as string[];
            }
          }
          return [];
        };
        const seg: Segment = {
          index: typeof obj.index === 'number' ? obj.index : i,
          text: typeof obj.text === 'string' ? (obj.text as string) : '',
          duration_hint_sec: typeof obj.duration_hint_sec === 'number' ? (obj.duration_hint_sec as number) : null,
          desired_rush_description: typeof obj.desired_rush_description === 'string' ? (obj.desired_rush_description as string) : '',
          keywords: Array.isArray(obj.keywords) ? (obj.keywords as unknown[]).filter((v) => typeof v === 'string') as string[] : [],
          rush_ideas: tryIdeas(),
        };
        segments.push(seg);
        i += 1;
      }
    }

    if (!segments.length) return new Response('Segmenter produced empty result', { status: 422 });

    // Ensure rush_ideas are present: if any segment lacks exactly 3, run a second pass to generate them
    const needsIdeas = segments.some((s) => !Array.isArray(s.rush_ideas) || s.rush_ideas.length !== 3);
    let ideasSecondPassAttempted = false;
    if (needsIdeas) {
      ideasSecondPassAttempted = true;
      try {
        const ideasModel = process.env.REPLICATE_SEGMENT_IDEAS_MODEL || 'meta/meta-llama-3-70b-instruct';
        const ideasPrompt = [
          'For each segment below, generate exactly three short, concrete visual B-roll ideas (no numbering, no prose).',
          'Return JSON array only, items like: { index:number, rush_ideas:string[3] }.',
          `SEGMENTS (JSON):\n${JSON.stringify(segments.map((s) => ({ index: s.index, text: s.text, desired: s.desired_rush_description, keywords: s.keywords || [] })))}`,
        ].join('\n');
        const out = (await replicate.run(ideasModel as `${string}/${string}`, { input: { prompt: ideasPrompt, temperature: 0.1 } })) as unknown;
        const txt = typeof out === 'string' ? out : Array.isArray(out) ? out.join('\n') : JSON.stringify(out);
        const arr2 = extractJsonArray(txt);
        if (arr2) {
          for (const item of arr2) {
            if (item && typeof item === 'object') {
              const obj = item as Record<string, unknown>;
              const idx = typeof obj.index === 'number' ? (obj.index as number) : null;
              const ideasArr = (() => {
                const cands: unknown[] = [
                  (obj as Record<string, unknown>).rush_ideas,
                  (obj as Record<string, unknown>).rushIdeas,
                  (obj as Record<string, unknown>).ideas,
                  (obj as Record<string, unknown>).broll_ideas,
                  (obj as Record<string, unknown>).brollIdeas,
                ].filter(Boolean) as unknown[];
                for (const c of cands) {
                  if (Array.isArray(c)) return (c as unknown[]).filter((v) => typeof v === 'string') as string[];
                }
                return [] as string[];
              })();
              if (idx !== null) {
                const seg = segments.find((s) => s.index === idx);
                if (seg && ideasArr.length > 0) {
                  seg.rush_ideas = ideasArr.slice(0, 3);
                }
              }
            }
          }
        }
      } catch {}
      // Fill any remaining gaps with empty array to satisfy client rendering
      const generateHeuristicIdeas = ({ text, desired, keywords }: { text: string; desired: string; keywords: string[] }): string[] => {
        const topKeyword = (keywords && keywords[0]) ? keywords[0] : '';
        const shortText = (text || '').slice(0, 80);
        const want = desired || topKeyword || shortText;
        const base = want || 'the topic';
        const ideas: string[] = [];
        ideas.push(`Close-up shot showing ${base}`.trim());
        ideas.push(`Hands-on demo / product-in-use related to ${base}`.trim());
        ideas.push(`Reaction shot of a person experiencing ${base}`.trim());
        return ideas.slice(0, 3);
      };
      for (const s of segments) {
        if (!Array.isArray(s.rush_ideas)) s.rush_ideas = [];
        if (s.rush_ideas.length > 3) s.rush_ideas = s.rush_ideas.slice(0, 3);
        if (s.rush_ideas.length === 0) {
          s.rush_ideas = generateHeuristicIdeas({ text: s.text, desired: s.desired_rush_description, keywords: s.keywords || [] });
        }
      }
    }

    const ideasCompleted = segments.filter((s) => Array.isArray(s.rush_ideas) && s.rush_ideas.length === 3).length;
    return Response.json({ ok: true, segments, ideas_second_pass: ideasSecondPassAttempted, ideas_completed: ideasCompleted });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}



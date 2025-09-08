import Replicate from 'replicate';
import { NextRequest } from 'next/server';

type TranscriptionInput = {
  audio_file: string;
  language?: string | null;
  prompt?: string | null;
  temperature?: number | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<TranscriptionInput> | null;
    if (!body || !body.audio_file || typeof body.audio_file !== 'string') {
      return new Response('Missing required field: audio_file', { status: 400 });
    }

    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });

    const replicate = new Replicate({ auth: replicateToken });

    const input: Record<string, any> = {
      audio_file: body.audio_file,
    };
    if (typeof body.language === 'string' && body.language.trim() !== '') input.language = body.language;
    if (typeof body.prompt === 'string' && body.prompt.trim() !== '') input.prompt = body.prompt;
    if (typeof body.temperature === 'number') input.temperature = Math.max(0, Math.min(1, body.temperature));

    let rawText = '';
    for await (const event of replicate.stream('openai/gpt-4o-transcribe', { input })) {
      rawText += String(event);
    }

    // Optional: post-process via OpenAI to humanize transcript when OPENAI_API_KEY is provided
    const openaiKey = process.env.OPENAI_API_KEY;
    let humanized = rawText;
    if (openaiKey && humanized.trim().length > 0) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a helpful editor. Clean up ASR transcripts: fix punctuation, casing, and paragraphing without changing meaning.' },
              { role: 'user', content: humanized },
            ],
            temperature: 0.2,
          }),
        });
        if (response.ok) {
          const json = await response.json();
          const content = json?.choices?.[0]?.message?.content;
          if (typeof content === 'string' && content.trim() !== '') humanized = content.trim();
        }
      } catch (_) {}
    }

    return Response.json({ text: humanized, raw: { length: rawText.length } });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}



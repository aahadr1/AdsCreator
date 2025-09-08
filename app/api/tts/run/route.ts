import { NextRequest } from 'next/server';
import Replicate from 'replicate';
import { Buffer } from 'node:buffer';

type TtsInput = {
  text: string;
  voice_id?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  emotion?: 'auto' | 'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised';
  sample_rate?: 8000 | 16000 | 22050 | 24000 | 32000 | 44100;
  bitrate?: 32000 | 64000 | 128000 | 256000;
  channel?: 'mono' | 'stereo';
  language_boost?:
    | 'None'
    | 'Automatic'
    | 'Chinese'
    | 'Chinese,Yue'
    | 'English'
    | 'Arabic'
    | 'Russian'
    | 'Spanish'
    | 'French'
    | 'Portuguese'
    | 'German'
    | 'Turkish'
    | 'Dutch'
    | 'Ukrainian'
    | 'Vietnamese'
    | 'Indonesian'
    | 'Japanese'
    | 'Italian'
    | 'Korean'
    | 'Thai'
    | 'Polish'
    | 'Romanian'
    | 'Greek'
    | 'Czech'
    | 'Finnish'
    | 'Hindi';
  english_normalization?: boolean;
  provider?: 'replicate' | 'elevenlabs';
  model_id?: string; // ElevenLabs
  output_format?: string; // ElevenLabs, e.g. mp3_44100_128
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<TtsInput> | null;
    if (!body || !body.text || typeof body.text !== 'string') {
      return new Response('Missing required field: text', { status: 400 });
    }

    const provider = (body.provider || 'replicate') as 'replicate' | 'elevenlabs';

    if (provider === 'elevenlabs') {
      const elKey = process.env.ELEVENLABS_API_KEY;
      if (!elKey) return new Response('Server misconfigured: missing ELEVENLABS_API_KEY', { status: 500 });

      const voiceId = body.voice_id || 'JBFqnCBsd6RMkjVDRZzb';
      const modelId = body.model_id || 'eleven_multilingual_v2';
      const outputFormat = body.output_format || 'mp3_44100_128';

      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': elKey,
          'accept': 'audio/mpeg',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          text: body.text,
          model_id: modelId,
          output_format: outputFormat,
        }),
      });
      if (!res.ok) {
        const errTxt = await res.text();
        return new Response(errTxt || 'ElevenLabs error', { status: res.status });
      }
      const mime = res.headers.get('content-type') || 'audio/mpeg';
      const arrayBuffer = await res.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const dataUrl = `data:${mime};base64,${base64}`;
      return Response.json({ url: dataUrl, contentType: mime });
    }

    // Default provider: Replicate (minimax/speech-02-hd)
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });
    const replicate = new Replicate({ auth: token });

    const input: Record<string, any> = { text: body.text };
    if (body.voice_id) input.voice_id = body.voice_id;
    if (typeof body.speed === 'number') input.speed = body.speed;
    if (typeof body.pitch === 'number') input.pitch = body.pitch;
    if (typeof body.volume === 'number') input.volume = body.volume;
    if (body.emotion) input.emotion = body.emotion;
    if (body.sample_rate) input.sample_rate = body.sample_rate;
    if (body.bitrate) input.bitrate = body.bitrate;
    if (body.channel) input.channel = body.channel;
    if (typeof body.english_normalization === 'boolean') input.english_normalization = body.english_normalization;
    if (body.language_boost) input.language_boost = body.language_boost;

    const output = (await replicate.run('minimax/speech-02-hd', { input })) as unknown;
    let url: string | null = null;
    if (output && typeof output === 'object' && 'url' in (output as any) && typeof (output as any).url === 'function') {
      try { url = (output as any).url(); } catch {}
    }
    if (!url && typeof output === 'string') {
      url = output;
    }
    if (!url && output && typeof (output as any).url === 'string') {
      url = (output as any).url;
    }
    return Response.json({ url, raw: output });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}



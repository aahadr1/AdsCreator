import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { Buffer } from 'node:buffer';

type TtsInput = {
  text: string;
  user_id: string; // Required for credit tracking
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
  provider?: 'replicate' | 'elevenlabs' | 'dia';
  model_id?: string; // ElevenLabs
  output_format?: string; // ElevenLabs, e.g. mp3_44100_128
  // Dia-specific inputs
  audio_prompt?: string | null;
  audio_prompt_text?: string | null;
  max_new_tokens?: number;
  max_audio_prompt_seconds?: number;
  cfg_scale?: number;
  temperature?: number;
  top_p?: number;
  cfg_filter_top_k?: number;
  speed_factor?: number;
  seed?: number | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<TtsInput> | null;
    if (!body || !body.text || typeof body.text !== 'string') {
      return new Response('Missing required field: text', { status: 400 });
    }

    if (!body.user_id || typeof body.user_id !== 'string') {
      return new Response('Missing required field: user_id', { status: 400 });
    }

    const provider = (body.provider || 'replicate') as 'replicate' | 'elevenlabs' | 'dia';
    
    // Determine model name for credit tracking
    let modelName: string;
    if (provider === 'elevenlabs') {
      modelName = 'elevenlabs-tts';
    } else if (provider === 'dia') {
      modelName = 'dia-tts';
    } else {
      modelName = 'minimax-speech-02-hd';
    }

    // Check and use credits before processing
    const creditResponse = await fetch(`${req.nextUrl.origin}/api/credits/use`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: body.user_id,
        model_name: modelName,
        metadata: {
          provider,
          text_length: body.text.length,
          voice_id: body.voice_id,
        },
      }),
    });

    if (!creditResponse.ok) {
      const errorText = await creditResponse.text();
      return new Response(`Credit error: ${errorText}`, { status: 402 }); // Payment Required
    }

    const creditResult = await creditResponse.json();
    if (!creditResult.success) {
      return new Response(`Insufficient credits: ${creditResult.error}`, { status: 402 });
    }

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

    if (provider === 'dia') {
      const token = process.env.REPLICATE_API_TOKEN;
      if (!token) return new Response('Server misconfigured: missing REPLICATE_API_TOKEN', { status: 500 });
      const replicate = new Replicate({ auth: token });

      const input: Record<string, unknown> = { text: body.text };
      if (typeof body.audio_prompt === 'string' && body.audio_prompt.trim() !== '') input.audio_prompt = body.audio_prompt;
      if (typeof body.audio_prompt_text === 'string' && body.audio_prompt_text.trim() !== '') input.audio_prompt_text = body.audio_prompt_text;
      if (typeof body.max_new_tokens === 'number') input.max_new_tokens = body.max_new_tokens;
      if (typeof body.max_audio_prompt_seconds === 'number') input.max_audio_prompt_seconds = body.max_audio_prompt_seconds;
      if (typeof body.cfg_scale === 'number') input.cfg_scale = body.cfg_scale;
      if (typeof body.temperature === 'number') input.temperature = body.temperature;
      if (typeof body.top_p === 'number') input.top_p = body.top_p;
      if (typeof body.cfg_filter_top_k === 'number') input.cfg_filter_top_k = body.cfg_filter_top_k;
      if (typeof body.speed_factor === 'number') input.speed_factor = body.speed_factor;
      if (typeof body.seed === 'number') input.seed = body.seed;

      const output = (await replicate.run('zsxkib/dia', { input })) as unknown;
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



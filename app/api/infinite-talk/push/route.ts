import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { inputUrl, audioUrl, options } = body || {};

  if (!inputUrl || !audioUrl) {
    return new Response('Missing inputUrl/audioUrl', { status: 400 });
  }

  const apiKey = process.env.WAVESPEED_API_KEY;
  if (!apiKey) {
    return new Response('Server misconfigured: missing WAVESPEED_API_KEY', { status: 500 });
  }

  try {
    // Use the actual InfiniteTalk API via Wavespeed
    const payload = {
      audio: audioUrl,
      image: inputUrl,
      prompt: options?.prompt || "",
      resolution: options?.resolution === '720' ? '720p' : '480p',
      seed: options?.seed || -1,
      // Optional mask image for multi-person scenarios
      ...(options?.mask_image && { mask_image: options.mask_image })
    };

    const res = await fetch('https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Wavespeed InfiniteTalk API error:', text);
      return new Response(`Wavespeed API error: ${text}`, { status: res.status });
    }

    const json = await res.json();
    
    // Return the task ID and status
    return Response.json({ 
      id: json.data?.id,
      status: json.data?.status || 'created',
      model: json.data?.model,
      message: json.message,
      get_url: json.data?.urls?.get,
    });
  } catch (error: any) {
    console.error('Failed to connect to Wavespeed InfiniteTalk API:', error);
    return new Response(
      `InfiniteTalk API error: ${error.message}`, 
      { status: 500 }
    );
  }
}

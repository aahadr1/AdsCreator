import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { videoUrl, audioUrl, options } = body || {};

  if (!videoUrl || !audioUrl) {
    return new Response('Missing videoUrl/audioUrl', { status: 400 });
  }

  const apiKey = process.env.SIEVE_API_KEY;
  if (!apiKey) {
    return new Response('Server misconfigured: missing SIEVE_API_KEY', { status: 500 });
  }

  const payload = {
    function: 'sieve/lipsync',
    inputs: {
      file: { url: videoUrl },
      audio: { url: audioUrl },
      backend: options?.backend ?? 'sievesync-1.1',
      enable_multispeaker: options?.enable_multispeaker ?? false,
      enhance: options?.enhance ?? 'default',
      check_quality: options?.check_quality ?? false,
      downsample: options?.downsample ?? false,
      cut_by: options?.cut_by ?? 'audio',
    },
  };

  const res = await fetch('https://mango.sievedata.com/v2/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    return new Response(text, { status: res.status });
  }

  const json = await res.json();
  // Return only essentials
  return Response.json({ id: json.id, status: json.status });
}

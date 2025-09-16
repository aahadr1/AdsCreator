import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return new Response('Missing id', { status: 400 });

  const apiKey = process.env.WAVESPEED_API_KEY;
  if (!apiKey) return new Response('Server misconfigured: missing WAVESPEED_API_KEY', { status: 500 });

  try {
    // Get result from Wavespeed InfiniteTalk API
    const res = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${id}/result`, {
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Wavespeed InfiniteTalk status error:', text);
      return new Response(`Wavespeed API error: ${text}`, { status: res.status });
    }

    const json = await res.json();

    // Map Wavespeed status to our standard format
    const mappedStatus = mapWavespeedStatus(json.data?.status);

    // Normalize outputs to an array with url fields to match UI expectations
    const outputs = normalizeOutputs(json?.data);

    // Return subset for UI (matches your existing pattern)
    return Response.json({
      id: json.data?.id || id,
      status: mappedStatus,
      outputs,
      error: json.data?.error || null,
      logs: json.data?.timings ? [`Inference time: ${json.data.timings.inference}ms`] : null,
      has_nsfw_contents: json.data?.has_nsfw_contents || null,
      model: json.data?.model,
      created_at: json.data?.created_at,
    });
  } catch (error: any) {
    console.error('Failed to connect to Wavespeed InfiniteTalk API:', error);
    return new Response(
      `InfiniteTalk API error: ${error.message}`, 
      { status: 500 }
    );
  }
}

function mapWavespeedStatus(status: string): string {
  // Map Wavespeed status values to our standard format
  switch (status?.toLowerCase()) {
    case 'completed':
      return 'finished';
    case 'succeeded':
    case 'success':
    case 'complete':
    case 'done':
      return 'finished';
    case 'failed':
      return 'error';
    case 'processing':
      return 'running';
    case 'created':
      return 'queued';
    default:
      return status || 'unknown';
  }
}

function normalizeOutputs(data: any): Array<{ url?: string; data?: { url?: string } }> | null {
  try {
    if (!data) return null;

    // If provider already returns an outputs array, ensure it has url
    if (Array.isArray(data.outputs) && data.outputs.length > 0) {
      return data.outputs;
    }

    // Common single-url fields observed in hosted inference APIs
    const candidateUrls: Array<unknown> = [
      data.url,
      data.output,
      data.output_url,
      data.result_url,
      data.result?.url,
      data.urls?.get,
      data.urls?.download,
      data.urls?.result,
    ];

    for (const c of candidateUrls) {
      if (typeof c === 'string' && /^https?:\/\//i.test(c)) {
        return [{ url: c }];
      }
    }

    return null;
  } catch {
    return null;
  }
}

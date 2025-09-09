import { NextRequest } from 'next/server';
import { createR2Client, ensureR2Bucket, r2PutObject, r2PublicUrl } from '../../../lib/r2';

export const runtime = 'nodejs';

type MediaKind = 'image' | 'video';

async function labelAndEmbed({
  assetUrl,
  kind,
  replicate,
}: {
  assetUrl: string;
  kind: MediaKind;
  replicate: Replicate;
}): Promise<{
  title: string;
  description: string;
  labels: string[];
  keywords: string[];
  embedding: number[];
  analysis?: Record<string, unknown> | null;
} | null> {
  try {
    const analysisFields = [
      'title',
      'summary',
      'scene_category',
      'subjects',
      'actions',
      'product_present',
      'product_names',
      'brand_logos',
      'has_text',
      'text_in_scene',
      'emotion_tone',
      'shot_types',
      'camera_movements',
      'duration_seconds',
      'key_moments'
    ];
    const jsonSpec = `Return strictly valid JSON with keys: { ${analysisFields.join(
      ', '
    )} }. Types: title:string; summary:string; scene_category:string; subjects:string[]; actions:string[]; product_present:boolean; product_names:string[]; brand_logos:string[]; has_text:boolean; text_in_scene:string; emotion_tone:string[]; shot_types:string[]; camera_movements:string[]; duration_seconds:number|null; key_moments:Array<{timestamp:string,label:string}>.`;

    let modelOutput: unknown;
    if (kind === 'video') {
      const prompt = `${jsonSpec} Focus on what is visually happening and what would help an auto-editor pick B-roll.`;
      modelOutput = await replicate.run('lucataco/apollo-7b', {
        input: {
          video: assetUrl,
          prompt,
          temperature: 0.2,
          max_new_tokens: 512,
          top_p: 0.7,
        },
      });
    } else {
      const prompt = `${jsonSpec} The media is an image. Analyze the image and output the JSON only.`;
      modelOutput = await replicate.run('openai/gpt-4.1-mini', {
        input: {
          prompt,
          image_input: [assetUrl],
          temperature: 0.2,
          max_completion_tokens: 512,
          system_prompt: 'You are a precise visual analyst. Respond with JSON only.'
        },
      });
    }

    const rawText = (() => {
      if (typeof modelOutput === 'string') return modelOutput as string;
      if (Array.isArray(modelOutput)) return (modelOutput as unknown[]).map((v) => String(v)).join('\n');
      return JSON.stringify(modelOutput);
    })();
    const jStart = rawText.indexOf('{');
    const jEnd = rawText.lastIndexOf('}');
    const trimmed = jStart >= 0 && jEnd >= 0 ? rawText.slice(jStart, jEnd + 1) : rawText;

    let parsed: any = {};
    try { parsed = JSON.parse(trimmed); } catch {}

    const title: string = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : 'Untitled asset';
    const summary: string = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    const subjects: string[] = Array.isArray(parsed.subjects) ? parsed.subjects.filter((v: unknown) => typeof v === 'string') : [];
    const actions: string[] = Array.isArray(parsed.actions) ? parsed.actions.filter((v: unknown) => typeof v === 'string') : [];
    const productNames: string[] = Array.isArray(parsed.product_names) ? parsed.product_names.filter((v: unknown) => typeof v === 'string') : [];
    const brandLogos: string[] = Array.isArray(parsed.brand_logos) ? parsed.brand_logos.filter((v: unknown) => typeof v === 'string') : [];
    const emotionTone: string[] = Array.isArray(parsed.emotion_tone) ? parsed.emotion_tone.filter((v: unknown) => typeof v === 'string') : [];
    const sceneCategory: string = typeof parsed.scene_category === 'string' ? parsed.scene_category : '';

    const derivedLabels = [
      ...subjects,
      ...actions,
      ...productNames,
      ...brandLogos,
      sceneCategory,
      ...emotionTone,
    ].filter((v) => typeof v === 'string' && v.trim()).slice(0, 24);

    const description: string = [title, summary].filter(Boolean).join(' — ');
    const labels: string[] = derivedLabels;
    const keywords: string[] = labels;

    const embeddingText = [title, summary, labels.join(' ')].filter(Boolean).join('\n');
    let embedding: number[] = [];
    try {
      const embedModel = (process.env.REPLICATE_EMBED_MODEL || 'lucataco/snowflake-arctic-embed-l:38f2c666dd6a9f96c50eca69bbb0029ed03cba002a289983dc0b487a93cfb1b4') as `${string}/${string}`;
      const embOut = (await replicate.run(embedModel, { input: { prompt: embeddingText } })) as any;
      embedding = Array.isArray(embOut) ? embOut : (embOut?.data || embOut?.embedding || []);
    } catch {
      // Skip embedding if model fails
      embedding = [];
    }

    const analysis: Record<string, unknown> = {
      title,
      summary,
      scene_category: sceneCategory,
      subjects,
      actions,
      product_present: Boolean(parsed.product_present),
      product_names: productNames,
      brand_logos: brandLogos,
      has_text: Boolean(parsed.has_text),
      text_in_scene: typeof parsed.text_in_scene === 'string' ? parsed.text_in_scene : '',
      emotion_tone: emotionTone,
      shot_types: Array.isArray(parsed.shot_types) ? parsed.shot_types : [],
      camera_movements: Array.isArray(parsed.camera_movements) ? parsed.camera_movements : [],
      duration_seconds: typeof parsed.duration_seconds === 'number' ? parsed.duration_seconds : null,
      key_moments: Array.isArray(parsed.key_moments) ? parsed.key_moments : [],
      source_model: kind === 'video' ? 'lucataco/apollo-7b' : 'openai/gpt-4.1-mini',
    };

    return {
      title,
      description,
      labels,
      keywords,
      embedding: Array.isArray(embedding) ? embedding.map((v) => Number(v)) : [],
      analysis,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const r2AccountId = process.env.R2_ACCOUNT_ID || '';
    const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
    const r2Endpoint = process.env.R2_S3_ENDPOINT || null;
    const bucket = process.env.R2_BUCKET || 'assets';
    const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL || null;
    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) return new Response('Server misconfigured: missing R2 credentials', { status: 500 });

    const body = await req.json();
    const { url, kind } = body || {} as { url?: string; kind?: MediaKind };
    if (!url || typeof url !== 'string') return new Response('Missing url', { status: 400 });
    const mediaKind: MediaKind = (kind === 'image' || kind === 'video') ? kind : (/\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(url) ? 'image' : 'video');

    const r2 = createR2Client({ accountId: r2AccountId, accessKeyId: r2AccessKeyId, secretAccessKey: r2SecretAccessKey, bucket, endpoint: r2Endpoint });
    await ensureR2Bucket(r2, bucket);

    // Download
    const response = await fetch(url);
    if (!response.ok) return new Response(`Failed to fetch media: ${response.statusText}`, { status: 400 });
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || (mediaKind === 'image' ? 'image/png' : 'video/mp4');
    const extFromType = contentType.includes('png') ? 'png' : contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : contentType.includes('webp') ? 'webp' : contentType.includes('gif') ? 'gif' : contentType.includes('mp4') ? 'mp4' : contentType.includes('quicktime') ? 'mov' : 'bin';

    const safeName = url.split('/').pop()?.split('?')[0]?.replace(/[^a-zA-Z0-9_.-]/g, '_') || `asset.${extFromType}`;
    const path = `assets/${Date.now()}-${safeName}`;

    await r2PutObject({ client: r2, bucket, key: path, body: new Uint8Array(arrayBuffer), contentType, cacheControl: '3600' });
    const publicUrl = r2PublicUrl({ publicBaseUrl, bucket, key: path }) || '';

    return Response.json({
      ok: true,
      bucket,
      path,
      publicUrl,
    });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}



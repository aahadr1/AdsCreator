import { NextRequest } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createR2Client, ensureR2Bucket, r2PutObject, r2PublicUrl } from '@/lib/r2';
import { createBlock, type DynamicResponse } from '@/types/dynamicContent';
import { saveUgcSession } from '@/lib/ugcStore';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Prefer system ffmpeg (or set FFMPEG_PATH). We intentionally avoid @ffmpeg-installer/ffmpeg
// because it can fail to resolve platform packages during Next build.
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}

type ClipInput = { sceneId?: string; url: string };

async function fetchToFile(url: string, path: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path, buf);
}

function runFfmpegConcat(listFilePath: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listFilePath)
      .inputOptions(['-f concat', '-safe 0'])
      // Re-encode to be safe across mismatched sources; no audio for now.
      .outputOptions([
        '-c:v libx264',
        '-preset veryfast',
        '-crf 20',
        '-pix_fmt yuv420p',
        '-movflags +faststart',
        '-an',
      ])
      .output(outPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const clips: ClipInput[] = Array.isArray(body?.clips) ? body.clips : [];
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';

    if (!clips.length) return new Response('Missing clips', { status: 400 });
    if (!clips.every((c) => c?.url && typeof c.url === 'string')) return new Response('Invalid clips', { status: 400 });

    const r2AccountId = process.env.R2_ACCOUNT_ID || '';
    const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
    const r2Endpoint = process.env.R2_S3_ENDPOINT || null;
    const bucket = process.env.R2_BUCKET || 'outputs';
    const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL || null;
    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) {
      return new Response('Server misconfigured: missing R2 credentials', { status: 500 });
    }

    const workDir = join(tmpdir(), 'ugc-assemble');
    await mkdir(workDir, { recursive: true });

    // Download clips
    const localPaths: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const filePath = join(workDir, `clip_${i + 1}.mp4`);
      await fetchToFile(clip.url, filePath);
      localPaths.push(filePath);
    }

    // Write concat list
    const listFile = join(workDir, `concat_${Date.now()}.txt`);
    const listContent = localPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    await writeFile(listFile, listContent);

    // Render assembled mp4
    const outPath = join(workDir, `ugc_final_${Date.now()}.mp4`);
    await runFfmpegConcat(listFile, outPath);

    const outBuf = await readFile(outPath);

    // Upload to R2
    const r2 = createR2Client({
      accountId: r2AccountId,
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
      bucket,
      endpoint: r2Endpoint,
    });
    await ensureR2Bucket(r2, bucket);
    const key = `ugc/assembled/${Date.now()}-${crypto.randomUUID()}.mp4`;
    await r2PutObject({
      client: r2,
      bucket,
      key,
      body: outBuf,
      contentType: 'video/mp4',
      cacheControl: '31536000',
    });
    const publicUrl = r2PublicUrl({ publicBaseUrl, bucket, key }) || '';
    if (!publicUrl) return new Response('Assembled but no public URL configured (set R2_PUBLIC_BASE_URL)', { status: 500 });

    if (sessionId) {
      await saveUgcSession(sessionId, { assembledVideoUrl: publicUrl });
    }

    const response: DynamicResponse = {
      responseType: 'dynamic',
      blocks: [
        createBlock('text', { style: 'success', format: 'plain', content: 'Final video assembled.' }),
        createBlock('media', {
          layout: 'list',
          items: [{ url: publicUrl, type: 'video', caption: 'Final UGC ad (assembled)' }],
        }),
      ],
    };

    return Response.json(response);
  } catch (e: any) {
    console.error('[UGC Assemble] Error:', e);
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}


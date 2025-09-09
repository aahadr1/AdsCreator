import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { createR2Client, ensureR2Bucket, r2PutObject, r2PublicUrl } from '../../../lib/r2';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { video_url?: string | null, output_basename?: string | null } | null;
    if (!body || !body.video_url) return new Response('Missing video_url', { status: 400 });

    const supabaseUrl = process.env.SUPABASE_URL as string;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    const r2AccountId = process.env.R2_ACCOUNT_ID || '';
    const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
    const r2Endpoint = process.env.R2_S3_ENDPOINT || null;
    const outputsBucket = process.env.R2_BUCKET || 'outputs';
    const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL || null;
    if (!supabaseUrl || !serviceRoleKey) return new Response('Server misconfigured: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY', { status: 500 });
    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) return new Response('Server misconfigured: missing R2 credentials', { status: 500 });

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const r2 = createR2Client({ accountId: r2AccountId, accessKeyId: r2AccessKeyId, secretAccessKey: r2SecretAccessKey, bucket: outputsBucket, endpoint: r2Endpoint });
    await ensureR2Bucket(r2, outputsBucket);

    // Download the input video to temp
    const tmpDir = await fs.mkdtemp(`${os.tmpdir()}${path.sep}bgremove-`);
    const inputPath = path.join(tmpDir, 'input.mp4');
    const outputBasename = (body.output_basename || 'output').replace(/[^a-zA-Z0-9_.-]/g, '_');
    const outputPath = path.join(tmpDir, `${outputBasename}.mov`);

    const res = await fetch(body.video_url);
    if (!res.ok || !res.body) return new Response('Failed to download input', { status: 400 });
    const file = await res.arrayBuffer();
    await fs.writeFile(inputPath, Buffer.from(file));

    // Use backgroundremover CLI via Python module to avoid PATH issues
    const py = process.env.PYTHON_PATH || 'python3';
    const cliArgs = ['-m', 'backgroundremover.cmd.cli', '-i', inputPath, '-tv', '-o', outputPath];
    const child = spawn(py, cliArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    const logs: string[] = [];
    child.stdout.on('data', (d) => logs.push(String(d)));
    child.stderr.on('data', (d) => logs.push(String(d)));

    const exitCode: number = await new Promise((resolve) => child.on('close', resolve));
    if (exitCode !== 0) {
      return new Response(`Background removal failed (exit ${exitCode})\n${logs.join('')}`, { status: 500 });
    }

    // Upload output to R2
    const outputBuf = await fs.readFile(outputPath);
    const objectPath = `bgremove/${Date.now()}-${outputBasename}.mov`;
    await r2PutObject({ client: r2, bucket: outputsBucket, key: objectPath, body: outputBuf, contentType: 'video/quicktime', cacheControl: '3600' });
    const url = r2PublicUrl({ publicBaseUrl, bucket: outputsBucket, key: objectPath }) || '';
    return Response.json({ url });
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}



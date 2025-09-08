import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import { createClient } from '@supabase/supabase-js';
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
    const bucket = process.env.SUPABASE_BUCKET || 'inputs';
    const outputsBucket = process.env.SUPABASE_OUTPUTS_BUCKET || 'outputs';
    if (!supabaseUrl || !serviceRoleKey) return new Response('Server misconfigured: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY', { status: 500 });

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

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

    // Upload output
    const outputBuf = await fs.readFile(outputPath);
    const objectPath = `bgremove/${Date.now()}-${outputBasename}.mov`;
    const { error: uploadErr } = await supabase.storage.from(outputsBucket).upload(objectPath, outputBuf, {
      contentType: 'video/quicktime',
      upsert: false,
      cacheControl: '3600',
    });
    if (uploadErr) return new Response(`Upload failed: ${uploadErr.message}`, { status: 500 });

    const publicBucket = (process.env.SUPABASE_OUTPUTS_BUCKET_PUBLIC || 'true').toLowerCase() === 'true';
    if (publicBucket) {
      const { data } = supabase.storage.from(outputsBucket).getPublicUrl(objectPath);
      return Response.json({ url: data.publicUrl });
    } else {
      const { data, error } = await supabase.storage.from(outputsBucket).createSignedUrl(objectPath, 60 * 60);
      if (error) return new Response(`Signed URL failed: ${error.message}`, { status: 500 });
      return Response.json({ url: data.signedUrl });
    }
  } catch (e: any) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}



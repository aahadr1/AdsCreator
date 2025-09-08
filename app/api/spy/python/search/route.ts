import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = body?.query;
    if (!query) return new Response('Missing query', { status: 400 });

    const projectRoot = process.cwd();
    const scriptPath = path.join(projectRoot, 'vendor', 'fb_ad_scraper', 'api_wrapper.py');

    const payload = JSON.stringify({ mode: 'search', query });

    const py = spawn('python3', [scriptPath], { cwd: path.dirname(scriptPath) });
    py.stdin.write(payload);
    py.stdin.end();

    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    py.stdout.on('data', (d) => chunks.push(Buffer.from(d)));
    py.stderr.on('data', (d) => errChunks.push(Buffer.from(d)));

    const exitCode: number = await new Promise((resolve) => {
      py.on('close', (code) => resolve(code ?? 0));
    });

    if (exitCode !== 0) {
      const err = Buffer.concat(errChunks).toString('utf-8') || 'Python script failed';
      return new Response(err, { status: 500 });
    }

    const out = Buffer.concat(chunks).toString('utf-8');
    return new Response(out, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(e?.message || 'Error', { status: 500 });
  }
}











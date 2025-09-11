export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import type { StartJobRequest, StartJobResponse } from '../../../../types/auto-edit';
import { dbInsertJob } from '../../../../lib/autoEditDb';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as StartJobRequest | null;
    if (!body || typeof body.script !== 'string' || !Array.isArray(body.uploads)) {
      return new Response('Invalid payload: expected { script: string, uploads: UserUpload[] }', { status: 400 });
    }

    const jobId = randomUUID();
    await dbInsertJob(jobId, {
      script: body.script,
      uploads: body.uploads,
      settings: body.settings || {},
    });

    const resp: StartJobResponse = { jobId };
    return Response.json(resp);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to start job';
    return new Response(message, { status: 500 });
  }
}



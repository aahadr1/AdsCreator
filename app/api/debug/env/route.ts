import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const present = {
      NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      REPLICATE_API_TOKEN: Boolean(process.env.REPLICATE_API_TOKEN),
      SUPABASE_ASSETS_BUCKET: Boolean(process.env.SUPABASE_ASSETS_BUCKET || 'assets'),
      SUPABASE_BUCKET_PUBLIC: Boolean((process.env.SUPABASE_BUCKET_PUBLIC || 'true').toLowerCase() === 'true'),
    };
    return Response.json({ ok: true, present });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return new Response(`Error: ${message}`, { status: 500 });
  }
}



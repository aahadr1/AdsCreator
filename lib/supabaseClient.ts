'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazily initialize Supabase only in the browser, avoiding build-time/SSR env requirements
let cachedClient: SupabaseClient | null = null;

function initClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  // Only attempt to create the client when running in the browser or when envs are available
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // During build/SSR, avoid throwing or constructing the client. Accessing methods server-side will error.
    if (typeof window === 'undefined') {
      // Return a proxy that will throw if actually used on the server, but won't break static analysis
      return new Proxy({}, {
        get() {
          throw new Error('Supabase client is unavailable during build/SSR without env vars.');
        }
      }) as unknown as SupabaseClient;
    }
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  cachedClient = createClient(url, anonKey, { auth: { persistSession: true } });
  return cachedClient;
}

export const supabaseClient = new Proxy({}, {
  get(_target, prop, _receiver) {
    const client = initClient() as unknown as Record<string, unknown>;
    return (client as any)[prop as keyof typeof client];
  },
}) as unknown as SupabaseClient;

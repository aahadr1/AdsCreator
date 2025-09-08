export function safeUrl(input?: string) {
  if (!input || input === 'REPLACE_ME/' || input.includes('REPLACE_ME')) {
    throw new Error(`Missing or invalid URL env: ${input}`);
  }
  try { 
    return new URL(input); 
  } catch { 
    throw new Error(`Invalid URL env: ${input}`); 
  }
}

export function getBaseUrlClient() {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (fromEnv && fromEnv !== 'REPLACE_ME/') return fromEnv;
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  // On server prerender, use empty string to avoid crashes
  return '';
}

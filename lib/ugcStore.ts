import { getKvConfigFromEnv, kvGet, kvPut } from './cloudflareKv';

export type UgcSessionState = {
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  userRequest?: string;
  brief?: Record<string, any>;
  personas?: any[];
  productImageUrl?: string | null;
  selectedAvatarUrl?: string | null;
  selectedAvatarPrompt?: string | null;
  storyboard?: any;
  clips?: any;
  assembledVideoUrl?: string | null;
};

const mem = new Map<string, UgcSessionState>();

const keyFor = (sessionId: string) => `ugc:session:${sessionId}`;

export async function loadUgcSession(sessionId: string): Promise<UgcSessionState | null> {
  if (!sessionId) return null;
  const cfg = getKvConfigFromEnv();
  if (cfg.accountId && cfg.namespaceId && cfg.apiToken) {
    return (await kvGet<UgcSessionState>({ key: keyFor(sessionId), config: cfg })) || null;
  }
  return mem.get(sessionId) || null;
}

export async function saveUgcSession(sessionId: string, next: Partial<UgcSessionState>): Promise<UgcSessionState> {
  const now = Date.now();
  const prev = (await loadUgcSession(sessionId)) || {
    sessionId,
    createdAt: now,
    updatedAt: now,
  };
  const merged: UgcSessionState = {
    ...prev,
    ...next,
    sessionId,
    updatedAt: now,
  };

  const cfg = getKvConfigFromEnv();
  if (cfg.accountId && cfg.namespaceId && cfg.apiToken) {
    await kvPut({ key: keyFor(sessionId), value: merged, config: cfg, metadata: null });
  } else {
    mem.set(sessionId, merged);
  }
  return merged;
}


type KvConfig = {
  accountId: string;
  namespaceId: string;
  apiToken: string;
};

function apiBase({ accountId, namespaceId }: { accountId: string; namespaceId: string }): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}`;
}

export function getKvConfigFromEnv(): KvConfig {
  const accountId = process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '';
  const namespaceId = process.env.CF_KV_NAMESPACE_ID_TASKS || process.env.CLOUDFLARE_KV_NAMESPACE_ID_TASKS || '';
  const apiToken = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '';
  return { accountId, namespaceId, apiToken };
}

export async function kvPut({ key, value, config, metadata }: { key: string; value: unknown; config: KvConfig; metadata?: Record<string, unknown> | null }): Promise<void> {
  const url = `${apiBase(config)}/values/${encodeURIComponent(key)}`;
  const body = typeof value === 'string' ? value : JSON.stringify(value);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiToken}`,
    'Content-Type': 'text/plain',
  };
  if (metadata && Object.keys(metadata).length) {
    headers['X-Object-Meta'] = JSON.stringify(metadata);
  }
  const res = await fetch(url, { method: 'PUT', headers, body });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`KV put failed: ${res.status} ${res.statusText} ${text}`);
  }
}

export async function kvGet<T>({ key, config }: { key: string; config: KvConfig }): Promise<T | null> {
  const url = `${apiBase(config)}/values/${encodeURIComponent(key)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${config.apiToken}` } });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`KV get failed: ${res.status} ${res.statusText} ${text}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export async function kvListKeys({ prefix, config, limit = 1000 }: { prefix: string; config: KvConfig; limit?: number }): Promise<string[]> {
  let cursor: string | null = null;
  const keys: string[] = [];
  do {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (prefix) params.set('prefix', prefix);
    if (cursor) params.set('cursor', cursor);
    const url = `${apiBase(config)}/keys?${params.toString()}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${config.apiToken}` } });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`KV list failed: ${res.status} ${res.statusText} ${text}`);
    }
    const json = (await res.json()) as { result: Array<{ name: string }>; result_info?: { cursor?: string | null } };
    for (const k of json.result || []) keys.push(k.name);
    cursor = json.result_info?.cursor || null;
  } while (cursor);
  return keys;
}

export type TaskRecord = {
  id: string;
  user_id: string | null;
  type: string;
  status: string;
  provider?: string | null;
  model_id?: string | null;
  backend?: string | null;
  options_json?: Record<string, unknown> | null;
  video_url?: string | null;
  audio_url?: string | null;
  image_url?: string | null;
  text_input?: string | null;
  output_url?: string | null;
  job_id?: string | null;
  created_at: string; // ISO
  updated_at: string; // ISO
};

export const taskKey = (id: string) => `tasks:${id}`;
export const taskListPrefix = 'tasks:';



import { createSupabaseServer } from './supabaseServer';
import { type TaskRecord } from './cloudflareKv';

type Nullable<T> = T | null | undefined;

const TRUTHY_STRING = /\S/;

function isMeaningful<T>(value: Nullable<T>): value is T {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return TRUTHY_STRING.test(value);
  return true;
}

function overlayTaskRecord(base: TaskRecord, incoming: TaskRecord): TaskRecord {
  const merged: TaskRecord = { ...base };

  const scalarFields: Array<keyof TaskRecord> = [
    'status',
    'provider',
    'model_id',
    'backend',
    'video_url',
    'audio_url',
    'image_url',
    'text_input',
    'output_url',
    'output_text',
    'job_id',
    'type',
    'user_id',
  ];

  for (const field of scalarFields) {
    const incomingValue = incoming[field];
    if (isMeaningful(incomingValue)) {
      merged[field] = incomingValue as never;
    }
  }

  merged.options_json = incoming.options_json ?? merged.options_json ?? null;

  const incomingUpdated = incoming.updated_at || incoming.created_at;
  const baseUpdated = merged.updated_at || merged.created_at;

  if (incomingUpdated && (!baseUpdated || incomingUpdated > baseUpdated)) {
    merged.updated_at = incoming.updated_at || incomingUpdated;
  }

  if (!merged.created_at && incoming.created_at) {
    merged.created_at = incoming.created_at;
  }

  return merged;
}

export function mergeTaskRecords(
  primary: TaskRecord[],
  secondary: TaskRecord[],
  limit?: number,
): TaskRecord[] {
  if (!secondary.length && !primary.length) return [];

  const byId = new Map<string, TaskRecord>();

  for (const record of primary) {
    if (record && record.id) {
      byId.set(record.id, { ...record });
    }
  }

  for (const record of secondary) {
    if (!record || !record.id) continue;
    const existing = byId.get(record.id);
    if (existing) {
      byId.set(record.id, overlayTaskRecord(existing, record));
    } else {
      byId.set(record.id, { ...record });
    }
  }

  const merged = Array.from(byId.values());

  merged.sort((a, b) => {
    const aDate = a.created_at || '';
    const bDate = b.created_at || '';
    return bDate.localeCompare(aDate);
  });

  return typeof limit === 'number' ? merged.slice(0, limit) : merged;
}

export async function fetchSupabaseTaskRecords(userId: string, limit?: number): Promise<TaskRecord[]> {
  if (!userId) return [];

  try {
    const supabase = createSupabaseServer();
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (typeof limit === 'number' && Number.isFinite(limit)) {
      query = query.limit(Math.max(1, limit));
    }

    const { data, error } = await query;

    if (error || !Array.isArray(data) || data.length === 0) {
      return [];
    }

    return data
      .filter((row) => row && typeof row.id === 'string')
      .map(mapSupabaseRowToTaskRecord);
  } catch {
    return [];
  }
}

export function mapSupabaseRowToTaskRecord(row: Record<string, any>): TaskRecord {
  const nowIso = new Date().toISOString();

  return {
    id: String(row.id),
    user_id: row.user_id ?? null,
    type: row.type ?? 'unknown',
    status: row.status ?? 'unknown',
    provider: row.provider ?? null,
    model_id: row.model_id ?? null,
    backend: row.backend ?? row.model_id ?? null,
    options_json: (row.options_json as Record<string, unknown> | null) ?? null,
    video_url: row.video_url ?? null,
    audio_url: row.audio_url ?? null,
    image_url: row.image_url ?? null,
    text_input: row.text_input ?? null,
    output_url: row.output_url ?? null,
    output_text: row.output_text ?? null,
    job_id: row.job_id ?? null,
    created_at: row.created_at ?? nowIso,
    updated_at: row.updated_at ?? row.created_at ?? nowIso,
  };
}

export type SerializedTask = {
  id: string;
  status: string;
  created_at: string;
  backend: string | null;
  model_id: string | null;
  provider: string | null;
  video_url: string | null;
  audio_url: string | null;
  image_url: string | null;
  output_url: string | null;
  output_text: string | null;
  text_input: string | null;
  type: string | null;
  options_json: Record<string, unknown> | null;
  user_id: string | null;
};

export function serializeTaskRecord(record: TaskRecord): SerializedTask {
  return {
    id: record.id,
    status: record.status,
    created_at: record.created_at,
    backend: record.backend ?? null,
    model_id: record.model_id ?? null,
    provider: record.provider ?? null,
    video_url: record.video_url ?? null,
    audio_url: record.audio_url ?? null,
    image_url: record.image_url ?? null,
    output_url: record.output_url ?? null,
    output_text: record.output_text ?? null,
    text_input: record.text_input ?? null,
    type: record.type ?? null,
    options_json: record.options_json ?? null,
    user_id: record.user_id ?? null,
  };
}


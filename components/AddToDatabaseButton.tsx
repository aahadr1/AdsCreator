'use client';

import { useState, KeyboardEvent } from 'react';
import { supabaseClient as supabase } from '../lib/supabaseClient';

type MediaKind = 'image' | 'video';
type ContextInfo = {
  prompt?: string;
  model?: string;
  inputs?: Array<{ type: 'image' | 'video' | 'text'; url?: string; text?: string; label?: string }>;
  extra?: Record<string, unknown>;
};

export function AddToDatabaseButton({ mediaUrl, kind, context, size = 'default' }: { mediaUrl: string; kind: MediaKind; context?: ContextInfo; size?: 'default' | 'large' }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'pending' | 'indexing' | 'ready' | 'error'>('idle');

  async function handleAdd() {
    if (!mediaUrl) return;
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in at /auth to save assets.');

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || '';

      setStatus('pending');
      const res = await fetch('/api/assets/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ url: mediaUrl, kind, context })
      });
      if (!res.ok) throw new Error(await res.text());
      setSuccess(true);
      setStatus('indexing');
      // Best-effort poll for status change to ready
      try {
        const json = await res.json() as any;
        const assetId: string | undefined = json?.asset?.id;
        if (assetId) {
          const timer = setInterval(async () => {
            try {
              const { data } = await supabase.from('media_assets').select('status').eq('id', assetId).single();
              const st = (data as any)?.status || 'pending';
              if (st === 'ready') { setStatus('ready'); clearInterval(timer); }
              if (st === 'error') { setStatus('error'); clearInterval(timer); }
            } catch {}
          }, 2000);
          setTimeout(() => clearInterval(timer), 20000);
        } else {
          setStatus('ready');
        }
      } catch { setStatus('ready'); }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to add to database';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown({ event, onActivate }: { event: KeyboardEvent<HTMLButtonElement>; onActivate: () => void }) {
    if (event.key === 'Enter' || event.key === ' ') onActivate();
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <button
        className="btn"
        type="button"
        aria-label="Add this media to database"
        onClick={handleAdd}
        onKeyDown={(e)=> onKeyDown({ event: e, onActivate: handleAdd })}
        disabled={loading}
        style={{ padding: size === 'large' ? '12px 14px' : '6px 10px', width: size === 'large' ? '100%' : undefined, fontSize: size === 'large' ? 16 : undefined }}
      >
        {loading ? 'Saving to database…' : success ? 'Saved ✓' : 'Save to database'}
      </button>
      {status !== 'idle' && (
        <span className="badge" aria-live="polite">{status === 'pending' ? 'Pending' : status === 'indexing' ? 'Indexing' : status === 'ready' ? 'Ready' : status === 'error' ? 'Error' : ''}</span>
      )}
      {error && <div className="small" style={{ color: '#ff7878' }}>{error}</div>}
    </div>
  );
}

export default AddToDatabaseButton;



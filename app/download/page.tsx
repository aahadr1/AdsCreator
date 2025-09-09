'use client';

import '../globals.css';
import { useState, KeyboardEvent } from 'react';
import Image from 'next/image';
import { supabaseClient as supabase } from '../../lib/supabaseClient';

type DownloadResponse = { url?: string | null; raw?: any };

export default function DownloadPage() {
  const [link, setLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [rawUrl, setRawUrl] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  function handleButtonKeyDown({ event, onActivate }: { event: KeyboardEvent<HTMLButtonElement>; onActivate: () => void }) {
    if (event.key === 'Enter' || event.key === ' ') onActivate();
  }

  async function runDownload() {
    setIsLoading(true);
    setError(null);
    setMediaUrl(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in at /auth before creating a task.');

      const { data: inserted, error: insertErr } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          type: 'download',
          status: 'queued',
          provider: 'tikwm',
          backend: 'tikwm-downloader',
          text_input: link,
        })
        .select('*')
        .single();
      if (insertErr || !inserted) throw new Error(insertErr?.message || 'Failed to create task');
      setTaskId(inserted.id);

      const res = await fetch('/api/download/tiktok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as DownloadResponse;
      if (!json.url) throw new Error('No media URL returned');
      setRawUrl(json.url);
      setMediaUrl(`/api/proxy?type=video&url=${encodeURIComponent(json.url)}`);

      if (inserted?.id) {
        await supabase
          .from('tasks')
          .update({ status: 'finished', output_url: json.url })
          .eq('id', inserted.id);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to download';
      setError(message);
      if (taskId) {
        await supabase.from('tasks').update({ status: 'error' }).eq('id', taskId);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function runOpenSourceDownload() {
    setIsLoading(true);
    setError(null);
    setMediaUrl(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in at /auth before creating a task.');

      const { data: inserted, error: insertErr } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          type: 'download',
          status: 'queued',
          provider: 'yt-dlp',
          backend: 'yt-dlp',
          text_input: link,
        })
        .select('*')
        .single();
      if (insertErr || !inserted) throw new Error(insertErr?.message || 'Failed to create task');
      setTaskId(inserted.id);

      const res = await fetch('/api/download/tiktok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as DownloadResponse;
      if (!json.url) throw new Error('No media URL returned');
      setRawUrl(json.url);
      setMediaUrl(`/api/proxy?type=video&url=${encodeURIComponent(json.url)}`);

      if (inserted?.id) {
        await supabase
          .from('tasks')
          .update({ status: 'succeeded', output_url: json.url })
          .eq('id', inserted.id);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to download';
      setError(message);
      if (taskId) {
        await supabase.from('tasks').update({ status: 'failed' }).eq('id', taskId);
      }
    } finally {
      setIsLoading(false);
    }
  }

  const isImage = /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(String(rawUrl || mediaUrl || ''));

  return (
    <div className="container">
      <div className="panel output">
        <div className="header">
          <h2 style={{margin:0}}>Output</h2>
        </div>
        <div className="outputArea">
          {mediaUrl ? (
            isImage ? (
              <>
                <Image src={mediaUrl} alt="Downloaded image" width={1280} height={720} style={{ maxWidth: '100%', height: 'auto', borderRadius: 8 }} />
                {/* Database functionality removed */}
              </>
            ) : (
              <>
                <video
                  controls
                  preload="metadata"
                  playsInline
                  style={{ maxWidth: '100%', borderRadius: 8 }}
                  onError={() => setError('Failed to load video. Try the direct link below.')}
               >
                  <source src={mediaUrl} type="video/mp4" />
                  {rawUrl && rawUrl !== mediaUrl ? (
                    <source src={rawUrl} />
                  ) : null}
                </video>
                <div className="small" style={{ marginTop: 8 }}>
                  <a href={mediaUrl} target="_blank" rel="noreferrer">Open via proxy</a>
                  {rawUrl ? (
                    <>
                      {' '}
                      |{' '}
                      <a href={rawUrl} target="_blank" rel="noreferrer">Open direct</a>
                    </>
                  ) : null}
                </div>
                {/* Database functionality removed */}
              </>
            )
          ) : (
            <div style={{fontSize:16, color:'#b7c2df'}}>Downloaded media will appear here.</div>
          )}
        </div>
        {error && (
          <div className="small" style={{ color: '#ff7878' }}>{error}</div>
        )}
      </div>

      <div className="panel">
        <div className="header">
          <h3 style={{margin:0}}>Inputs</h3>
        </div>

        <div>
          <div className="small">Video URL (TikTok/TikTok Ads)</div>
          <input className="input" value={link} onChange={(e)=>setLink(e.target.value)} placeholder="https://..." />
        </div>

        <button
          className="btn"
          type="button"
          style={{ marginTop: 12 }}
          disabled={!link.trim() || isLoading}
          onClick={runDownload}
          onKeyDown={(e)=>handleButtonKeyDown({ event: e, onActivate: runDownload })}
        >
          {isLoading ? 'Downloading…' : 'Download'}
        </button>
        <button
          className="btn"
          type="button"
          style={{ marginTop: 12 }}
          disabled={!link.trim() || isLoading}
          onClick={runOpenSourceDownload}
          onKeyDown={(e)=>handleButtonKeyDown({ event: e, onActivate: runOpenSourceDownload })}
        >
          {isLoading ? 'Downloading…' : 'Download via Open Source (yt-dlp)'}
        </button>
      </div>
    </div>
  );
}



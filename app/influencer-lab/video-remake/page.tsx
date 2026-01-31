'use client';

import '../../globals.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ReplicateStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'queued' | 'unknown';

const MODEL_ID = 'kwaivgi/kling-v2.6-motion-control';

function bytesToMb(bytes: number): string {
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
}

function isHttpUrl(s: string | null | undefined): boolean {
  return /^https?:\/\//i.test(String(s || '').trim());
}

function statusBadgeClass(status: ReplicateStatus): string {
  if (status === 'succeeded') return 'badge badge-success';
  if (status === 'failed' || status === 'canceled') return 'badge badge-error';
  if (status === 'processing' || status === 'starting') return 'badge badge-warning';
  if (status === 'queued') return 'badge badge-accent';
  return 'badge';
}

type FileCardProps = {
  title: string;
  subtitle: string;
  icon: string;
  accept: string;
  file: File | null;
  uploaded: boolean;
  previewUrl?: string | null;
  onPick: (file: File) => void;
};

function FileCard(props: FileCardProps) {
  const { title, subtitle, icon, accept, file, uploaded, previewUrl, onPick } = props;
  const [drag, setDrag] = useState(false);

  const pickViaDialog = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const f = input.files?.[0] || null;
      if (f) onPick(f);
    };
    input.click();
  };

  return (
    <div
      className={`dnd ${drag ? 'drag' : ''}`}
      style={{ minHeight: 180, padding: 'var(--space-8)' }}
      tabIndex={0}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onPick(f);
      }}
      onClick={pickViaDialog}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pickViaDialog();
        }
      }}
    >
      <div className="dnd-icon">{icon}</div>
      <div className="dnd-title">{title}</div>
      <div className="dnd-subtitle">{subtitle}</div>

      {previewUrl ? (
        <div style={{ width: '100%', marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {accept.startsWith('image') ? (
            <img
              src={previewUrl}
              alt={`${title} preview`}
              style={{ maxHeight: 140, borderRadius: 12, border: '1px solid var(--border)' }}
            />
          ) : (
            <video
              src={previewUrl}
              muted
              controls
              style={{ maxHeight: 140, borderRadius: 12, border: '1px solid var(--border)' }}
            />
          )}
        </div>
      ) : null}

      {file ? (
        <div className="fileInfo">
          <span>
            {file.name} ({bytesToMb(file.size)})
          </span>
          {uploaded ? <span>• Uploaded</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export default function VideoRemakePage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [prompt, setPrompt] = useState<string>('');
  const [characterOrientation, setCharacterOrientation] = useState<'image' | 'video'>('image');
  const [mode, setMode] = useState<'std' | 'pro'>('pro');
  const [keepOriginalSound, setKeepOriginalSound] = useState<boolean>(true);

  const [status, setStatus] = useState<ReplicateStatus>('unknown');
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<ReplicateStatus | null>(null);

  const pushLog = (line: string) => setLogLines((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${line}`]);

  const selectVideo = useCallback((file: File) => {
    setVideoFile(file);
    setVideoUrl(null);
    setOutputUrl(null);
    setPredictionId(null);

    setVideoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  const selectImage = useCallback((file: File) => {
    setImageFile(file);
    setImageUrl(null);
    setOutputUrl(null);
    setPredictionId(null);

    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready = useMemo(() => {
    if (!videoFile || !imageFile) return false;
    // Guardrails (soft): size
    if (videoFile.size > 100 * 1024 * 1024) return false;
    if (imageFile.size > 10 * 1024 * 1024) return false;
    return true;
  }, [videoFile, imageFile]);

  async function uploadOnce(file: File) {
    const form = new FormData();
    form.append('file', file);
    form.append('filename', file.name);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as { url: string; path: string };
  }

  async function uploadIfNeeded(): Promise<{ video: string; image: string }> {
    if (!videoFile || !imageFile) throw new Error('Missing files');
    let v = videoUrl;
    let i = imageUrl;

    if (!v) {
      pushLog('Uploading reference video...');
      const out = await uploadOnce(videoFile);
      v = out.url;
      setVideoUrl(out.url);
    }
    if (!i) {
      pushLog('Uploading reference image...');
      const out = await uploadOnce(imageFile);
      i = out.url;
      setImageUrl(out.url);
    }
    pushLog('Uploaded.');
    return { video: v, image: i };
  }

  const effectiveOutputUrl = useMemo(() => {
    if (!outputUrl) return null;
    if (isHttpUrl(outputUrl)) return `/api/proxy?url=${encodeURIComponent(outputUrl)}&type=video`;
    return outputUrl;
  }, [outputUrl]);

  async function startGeneration() {
    try {
      setStatus('queued');
      setLogLines([]);
      setOutputUrl(null);
      setPredictionId(null);

      if (!ready) {
        pushLog('Please provide a valid reference video (≤ 100MB) and reference image (≤ 10MB).');
        setStatus('unknown');
        return;
      }

      const urls = await uploadIfNeeded();

      const input: Record<string, unknown> = {
        prompt: prompt.trim() || undefined,
        image: urls.image,
        video: urls.video,
        character_orientation: characterOrientation,
        mode,
        keep_original_sound: keepOriginalSound,
      };

      pushLog(`Submitting to Replicate model: ${MODEL_ID}`);
      const res = await fetch('/api/replicate/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL_ID, input }),
      });

      if (!res.ok) {
        pushLog('Submission failed: ' + (await res.text()));
        setStatus('failed');
        return;
      }

      const data = (await res.json()) as { id?: string; status?: ReplicateStatus };
      const id = data.id || null;
      setPredictionId(id);
      setStatus(data.status || 'queued');
      if (id) pushLog(`Prediction created: ${id}`);

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        if (!id) return;
        const s = await fetch(`/api/replicate/status?id=${encodeURIComponent(id)}`);
        if (!s.ok) return;
        const j = (await s.json()) as { status?: ReplicateStatus; outputUrl?: string | null; error?: unknown };
        const st: ReplicateStatus = j.status || 'unknown';
        if (lastStatusRef.current !== st) {
          pushLog(`Status: ${st}`);
          lastStatusRef.current = st;
        }
        setStatus(st);
        if (typeof j.outputUrl === 'string' && j.outputUrl) {
          setOutputUrl(j.outputUrl);
        }
        if (st === 'succeeded' || st === 'failed' || st === 'canceled') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          if (j.error) {
            pushLog(`Error: ${typeof j.error === 'string' ? j.error : JSON.stringify(j.error)}`);
          }
        }
      }, 2000);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      pushLog(`Error: ${message}`);
      setStatus('failed');
    }
  }

  return (
    <div className="page-template generator fade-in">
      <header className="page-hero">
        <div>
          <p className="page-eyebrow">Influencer Lab</p>
          <h1>Video Remake</h1>
          <p className="page-description">
            Upload a reference video + a character/background image, then guide the remake with an optional prompt.
          </p>
        </div>
        <div className="page-hero-actions">
          <a href="/influencer-lab" className="hero-link">
            Back to lab
          </a>
          <a href="/tasks" className="hero-link">
            View tasks
          </a>
        </div>
      </header>

      <div className="generator-workspace">
        <div className="panel">
          <div className="header">
            <h3 style={{ margin: 0 }}>Inputs</h3>
            <span className="badge">Kling Motion Control</span>
          </div>

          <div className="options" style={{ marginTop: 0 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <div className="small">Prompt (optional)</div>
              <textarea
                className="input"
                rows={4}
                placeholder="Describe what to change (style, outfit, background elements, lighting, vibe) while keeping the motion from the reference video."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-5)', display: 'grid', gap: 'var(--space-4)' }}>
            <FileCard
              title="Reference video"
              subtitle="MP4/MOV • up to 100MB • motion + timing source"
              icon="🎬"
              accept="video/*"
              file={videoFile}
              uploaded={!!videoUrl}
              previewUrl={videoPreviewUrl}
              onPick={selectVideo}
            />
            <FileCard
              title="Reference image (character/background)"
              subtitle="PNG/JPG • up to 10MB • defines appearance + scene"
              icon="🖼️"
              accept="image/*"
              file={imageFile}
              uploaded={!!imageUrl}
              previewUrl={imagePreviewUrl}
              onPick={selectImage}
            />
          </div>

          <div className="options">
            <div>
              <div className="small">Mode</div>
              <select className="select" value={mode} onChange={(e) => setMode(e.target.value as any)}>
                <option value="std">Standard (std)</option>
                <option value="pro">Professional (pro)</option>
              </select>
            </div>
            <div>
              <div className="small">Character orientation</div>
              <select
                className="select"
                value={characterOrientation}
                onChange={(e) => setCharacterOrientation(e.target.value as any)}
              >
                <option value="image">Match image orientation (max ~10s)</option>
                <option value="video">Match video orientation (max ~30s)</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="small" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={keepOriginalSound}
                  onChange={(e) => setKeepOriginalSound(e.target.checked)}
                />
                Keep original sound
              </label>
            </div>
          </div>

          <button className="btn" onClick={startGeneration} disabled={!ready || status === 'processing' || status === 'starting'}>
            Generate remake
          </button>

          {!ready && (videoFile || imageFile) ? (
            <div className="small" style={{ marginTop: 'var(--space-3)', color: 'var(--status-warn)' }}>
              Ensure video is ≤ 100MB and image is ≤ 10MB.
            </div>
          ) : null}
        </div>

        <div className="panel output">
          <div className="header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0 }}>Output</h2>
              <span className={statusBadgeClass(status)}>{String(status).toUpperCase()}</span>
            </div>
            <div className="small">Prediction ID: {predictionId ?? '—'}</div>
          </div>

          <div className="outputArea">
            {status === 'succeeded' && effectiveOutputUrl ? (
              <div style={{ width: '100%' }}>
                <video
                  src={effectiveOutputUrl}
                  controls
                  style={{ width: '100%', maxHeight: 520, borderRadius: 12 }}
                  onError={() => pushLog('Video failed to play. Try opening the link below in a new tab.')}
                />
                <div className="small" style={{ marginTop: 10 }}>
                  <a href={effectiveOutputUrl} target="_blank" rel="noreferrer">
                    Open output in new tab
                  </a>
                </div>
              </div>
            ) : (
              <div style={{ width: '100%' }}>
                <div style={{ fontSize: 16, color: '#b7c2df' }}>Your remade video will appear here.</div>
                <div className="kv" style={{ marginTop: 12 }}>
                  <div>Video URL</div>
                  <div className="small">{videoUrl ?? '—'}</div>
                  <div>Image URL</div>
                  <div className="small">{imageUrl ?? '—'}</div>
                </div>
              </div>
            )}
          </div>

          <div>
            <div style={{ margin: '8px 0 6px' }}>Log</div>
            <pre className="log">{logLines.join('\n')}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

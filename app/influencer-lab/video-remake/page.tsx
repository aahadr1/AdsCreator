'use client';

import '../../globals.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseClient } from '@/lib/supabaseClient';
import type { Influencer } from '@/types/influencer';

type ReplicateStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'queued' | 'unknown';

const MODEL_ID = 'kwaivgi/kling-v2.6-motion-control';
const NANO_BANANA_MODEL = 'google/nano-banana';
const AVATAR_SWAP_PROMPT = 'replace the character in the image by the character you have the photoshoot of';

function bytesToMb(bytes: number): string {
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
}

function isHttpUrl(s: string | null | undefined): boolean {
  return /^https?:\/\//i.test(String(s || '').trim());
}

function toAbsoluteUrl(url: string, origin: string): string {
  const u = String(url || '').trim();
  if (!u) return u;
  if (u.startsWith('/')) return `${origin}${u}`;
  return u;
}

function pickBestInfluencerImage(influencer: Influencer | null): string | null {
  if (!influencer) return null;
  const main = (influencer as any).photo_main as string | null | undefined;
  const face = (influencer as any).photo_face_closeup as string | null | undefined;
  const url = String(main || face || '').trim();
  return url.length > 0 ? url : null;
}

function statusBadgeClass(status: ReplicateStatus): string {
  if (status === 'succeeded') return 'badge badge-success';
  if (status === 'failed' || status === 'canceled') return 'badge badge-error';
  if (status === 'processing' || status === 'starting') return 'badge badge-warning';
  if (status === 'queued') return 'badge badge-accent';
  return 'badge';
}

async function extractFirstFrameFromVideoFile(videoFile: File): Promise<Blob> {
  const url = URL.createObjectURL(videoFile);
  try {
    const video = document.createElement('video');
    video.src = url;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Failed to load video metadata'));
    });

    // Some browsers need a tiny seek to trigger decode reliably.
    video.currentTime = 0;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to encode first frame'))),
        'image/jpeg',
        0.9
      );
    });
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function guessAspectRatioFromDimensions(width: number, height: number): '9:16' | '16:9' | '1:1' {
  if (!width || !height) return '9:16';
  const r = width / height;
  if (Math.abs(r - 1) < 0.12) return '1:1';
  return r > 1 ? '16:9' : '9:16';
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

  const [referenceMode, setReferenceMode] = useState<'upload' | 'avatar'>('upload');

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [avatarQuery, setAvatarQuery] = useState<string>('');
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [firstFramePreviewUrl, setFirstFramePreviewUrl] = useState<string | null>(null);
  const [firstFrameUrl, setFirstFrameUrl] = useState<string | null>(null);
  const [avatarCompositeStatus, setAvatarCompositeStatus] = useState<ReplicateStatus>('unknown');
  const [avatarCompositePredictionId, setAvatarCompositePredictionId] = useState<string | null>(null);
  const [avatarCompositeImageUrl, setAvatarCompositeImageUrl] = useState<string | null>(null);

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
  const avatarPrepPollRef = useRef<NodeJS.Timeout | null>(null);
  const avatarPrepKeyRef = useRef<string>('');

  const pushLog = (line: string) => setLogLines((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${line}`]);

  const origin = useMemo(() => (typeof window !== 'undefined' ? window.location.origin : ''), []);

  useEffect(() => {
    const boot = async () => {
      try {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        const token = session?.access_token || null;
        setAuthToken(token);
        if (!token) return;

        const res = await fetch('/api/influencer', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { influencers?: Influencer[] };
        setInfluencers(Array.isArray(data.influencers) ? data.influencers : []);
      } catch {
        // Non-fatal: tagging will be disabled without auth
      }
    };
    void boot();
  }, []);

  const selectVideo = useCallback((file: File) => {
    setVideoFile(file);
    setVideoUrl(null);
    setOutputUrl(null);
    setPredictionId(null);
    setFirstFrameUrl(null);
    setAvatarCompositeStatus('unknown');
    setAvatarCompositePredictionId(null);
    setAvatarCompositeImageUrl(null);

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
      if (avatarPrepPollRef.current) clearInterval(avatarPrepPollRef.current);
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      if (firstFramePreviewUrl) URL.revokeObjectURL(firstFramePreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const influencerImageUrl = useMemo(() => pickBestInfluencerImage(selectedInfluencer), [selectedInfluencer]);

  const ready = useMemo(() => {
    if (!videoFile) return false;
    if (videoFile.size > 100 * 1024 * 1024) return false;
    if (referenceMode === 'upload') {
      if (!imageFile) return false;
      if (imageFile.size > 10 * 1024 * 1024) return false;
      return true;
    }
    // avatar mode
    if (!selectedInfluencer) return false;
    if (!influencerImageUrl) return false;
    return true;
  }, [videoFile, imageFile, referenceMode, selectedInfluencer, influencerImageUrl]);

  async function uploadOnce(file: File) {
    const form = new FormData();
    form.append('file', file);
    form.append('filename', file.name);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as { url: string; path: string };
  }

  async function uploadIfNeeded(): Promise<{ video: string; image: string }> {
    if (!videoFile) throw new Error('Missing video');
    let v = videoUrl;
    let i = imageUrl;

    if (!v) {
      pushLog('Uploading reference video...');
      const out = await uploadOnce(videoFile);
      v = out.url;
      setVideoUrl(out.url);
    }

    if (referenceMode === 'upload') {
      if (!imageFile) throw new Error('Missing reference image');
      if (!i) {
        pushLog('Uploading reference image...');
        const out = await uploadOnce(imageFile);
        i = out.url;
        setImageUrl(out.url);
      }
    } else {
      // avatar mode: ensure we have a prepared composite image (Nano Banana output)
      const absComposite = avatarCompositeImageUrl ? toAbsoluteUrl(avatarCompositeImageUrl, origin) : null;
      if (!absComposite) {
        throw new Error('Avatar composite image is not ready yet');
      }
      i = absComposite;
      setImageUrl(absComposite);
    }

    pushLog('Uploaded.');
    return { video: v, image: i };
  }

  const effectiveOutputUrl = useMemo(() => {
    if (!outputUrl) return null;
    if (isHttpUrl(outputUrl)) return `/api/proxy?url=${encodeURIComponent(outputUrl)}&type=video`;
    return outputUrl;
  }, [outputUrl]);

  const avatarCompositeEffectiveUrl = useMemo(() => {
    if (!avatarCompositeImageUrl) return null;
    const raw = avatarCompositeImageUrl;
    if (raw.startsWith('/')) return `${raw}`; // local route works for <img> in-app
    if (isHttpUrl(raw)) return `/api/proxy?url=${encodeURIComponent(raw)}&type=image`;
    return raw;
  }, [avatarCompositeImageUrl]);

  const firstFrameEffectiveUrl = useMemo(() => {
    if (!firstFramePreviewUrl) return null;
    return firstFramePreviewUrl;
  }, [firstFramePreviewUrl]);

  const filteredSuggestions = useMemo(() => {
    if (!avatarQuery.trim()) return influencers.slice(0, 6);
    const q = avatarQuery.trim().replace(/^@/, '').toLowerCase();
    return influencers
      .filter((inf) => {
        const u = String((inf as any).username || '').toLowerCase();
        const n = String((inf as any).name || '').toLowerCase();
        return u.includes(q) || n.includes(q);
      })
      .slice(0, 8);
  }, [avatarQuery, influencers]);

  const clearAvatar = useCallback(() => {
    setSelectedInfluencer(null);
    setAvatarQuery('');
    setShowSuggestions(false);
    setFirstFrameUrl(null);
    setAvatarCompositeStatus('unknown');
    setAvatarCompositePredictionId(null);
    setAvatarCompositeImageUrl(null);
    setImageUrl(null);
  }, []);

  async function ensureFirstFrameUploaded(): Promise<{ frameUrl: string; aspect: '9:16' | '16:9' | '1:1' }> {
    if (!videoFile) throw new Error('Missing video');
    if (firstFrameUrl) {
      // We don't know aspect from stored URL; default to 9:16
      return { frameUrl: firstFrameUrl, aspect: '9:16' };
    }

    pushLog('Extracting first frame from video...');
    const blob = await extractFirstFrameFromVideoFile(videoFile);
    setFirstFramePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });

    // Determine aspect ratio from extracted image size (via an Image element)
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      const tmp = URL.createObjectURL(blob);
      img.onload = () => {
        const w = (img as any).naturalWidth || 0;
        const h = (img as any).naturalHeight || 0;
        URL.revokeObjectURL(tmp);
        resolve({ w, h });
      };
      img.onerror = () => {
        URL.revokeObjectURL(tmp);
        resolve({ w: 0, h: 0 });
      };
      img.src = tmp;
    });
    const aspect = guessAspectRatioFromDimensions(dims.w, dims.h);

    pushLog('Uploading extracted first frame...');
    const frameFile = new File([blob], `first-frame-${Date.now()}.jpg`, { type: 'image/jpeg' });
    const out = await uploadOnce(frameFile);
    setFirstFrameUrl(out.url);
    pushLog('First frame ready.');
    return { frameUrl: out.url, aspect };
  }

  async function prepareAvatarCompositeIfNeeded(): Promise<string> {
    if (!videoFile) throw new Error('Missing video');
    if (!selectedInfluencer) throw new Error('No influencer selected');
    const influencerImg = influencerImageUrl;
    if (!influencerImg) throw new Error('Selected influencer has no MAIN/face image yet');

    const key = `${(selectedInfluencer as any).id || (selectedInfluencer as any).username || 'inf'}::${videoFile.name}::${videoFile.size}`;
    avatarPrepKeyRef.current = key;

    // If already prepared, return it.
    const absExisting = avatarCompositeImageUrl ? toAbsoluteUrl(avatarCompositeImageUrl, origin) : null;
    if (absExisting) return absExisting;

    setAvatarCompositeStatus('queued');
    setAvatarCompositePredictionId(null);
    setAvatarCompositeImageUrl(null);

    const { frameUrl, aspect } = await ensureFirstFrameUploaded();
    const frameAbs = toAbsoluteUrl(frameUrl, origin);
    const influencerAbs = toAbsoluteUrl(influencerImg, origin);

    pushLog(`Running Nano Banana (avatar swap) using @${(selectedInfluencer as any).username || 'avatar'}...`);
    const res = await fetch('/api/image/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: NANO_BANANA_MODEL,
        prompt: AVATAR_SWAP_PROMPT,
        aspect_ratio: aspect,
        output_format: 'jpg',
        image_input: [frameAbs, influencerAbs],
      }),
    });
    if (!res.ok) {
      setAvatarCompositeStatus('failed');
      throw new Error(await res.text());
    }
    const data = (await res.json()) as { id?: string; status?: ReplicateStatus };
    const pid = data.id || null;
    setAvatarCompositePredictionId(pid);
    setAvatarCompositeStatus((data.status as ReplicateStatus) || 'queued');
    if (pid) pushLog(`Nano Banana prediction: ${pid}`);

    // Poll using the shared status endpoint (also persists outputs to R2).
    if (avatarPrepPollRef.current) clearInterval(avatarPrepPollRef.current);
    avatarPrepPollRef.current = setInterval(async () => {
      if (!pid) return;
      // Cancel if a newer prepare run started.
      if (avatarPrepKeyRef.current !== key) return;
      const s = await fetch(`/api/replicate/status?id=${encodeURIComponent(pid)}`);
      if (!s.ok) return;
      const j = (await s.json()) as { status?: ReplicateStatus; outputUrl?: string | null; error?: unknown };
      const st: ReplicateStatus = j.status || 'unknown';
      setAvatarCompositeStatus(st);
      if (st === 'succeeded' && j.outputUrl) {
        setAvatarCompositeImageUrl(j.outputUrl);
        pushLog('Avatar composite image ready.');
        if (avatarPrepPollRef.current) clearInterval(avatarPrepPollRef.current);
        avatarPrepPollRef.current = null;
      }
      if (st === 'failed' || st === 'canceled') {
        if (avatarPrepPollRef.current) clearInterval(avatarPrepPollRef.current);
        avatarPrepPollRef.current = null;
        if (j.error) pushLog(`Nano Banana error: ${typeof j.error === 'string' ? j.error : JSON.stringify(j.error)}`);
      }
    }, 2000);

    // Return when done (await-style): poll server status so we don't rely on React state closures.
    const startedAt = Date.now();
    while (Date.now() - startedAt < 180000) {
      if (avatarPrepKeyRef.current !== key) throw new Error('Avatar preparation was superseded');
      if (!pid) throw new Error('Missing Nano Banana prediction id');

      const s = await fetch(`/api/replicate/status?id=${encodeURIComponent(pid)}`);
      if (s.ok) {
        const j = (await s.json()) as { status?: ReplicateStatus; outputUrl?: string | null; error?: unknown };
        const st: ReplicateStatus = j.status || 'unknown';
        setAvatarCompositeStatus(st);
        if (st === 'succeeded' && j.outputUrl) {
          setAvatarCompositeImageUrl(j.outputUrl);
          return toAbsoluteUrl(j.outputUrl, origin);
        }
        if (st === 'failed' || st === 'canceled') {
          throw new Error(typeof j.error === 'string' ? j.error : 'Avatar preparation failed');
        }
      }

      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error('Avatar preparation timed out');
  }

  // Auto-run avatar preparation when the user has selected both a video + influencer.
  useEffect(() => {
    if (referenceMode !== 'avatar') return;
    if (!videoFile) return;
    if (!selectedInfluencer) return;
    if (!influencerImageUrl) return;
    // Don’t auto-run if already ready or currently running.
    if (avatarCompositeStatus === 'processing' || avatarCompositeStatus === 'queued' || avatarCompositeStatus === 'starting') return;
    if (avatarCompositeImageUrl) return;
    // Fire-and-forget; errors are logged.
    void prepareAvatarCompositeIfNeeded().catch((e) => pushLog(`Avatar prep error: ${e?.message || String(e)}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceMode, videoFile, selectedInfluencer?.id, influencerImageUrl]);

  async function startGeneration() {
    try {
      setStatus('queued');
      setLogLines([]);
      setOutputUrl(null);
      setPredictionId(null);

      if (!ready) {
        pushLog(
          referenceMode === 'upload'
            ? 'Please provide a valid reference video (≤ 100MB) and reference image (≤ 10MB).'
            : 'Please provide a valid reference video (≤ 100MB) and select a valid influencer avatar (@tag).'
        );
        setStatus('unknown');
        return;
      }

      // In avatar mode, ensure the composite is actually ready before proceeding.
      if (referenceMode === 'avatar') {
        if (!selectedInfluencer) throw new Error('No influencer selected');
        if (!influencerImageUrl) throw new Error('Selected influencer has no MAIN/face image');
        if (!avatarCompositeImageUrl) {
          pushLog('Preparing avatar composite image...');
          await prepareAvatarCompositeIfNeeded();
        }
      }

      const urls = await uploadIfNeeded();

      const input: Record<string, unknown> = {
        prompt: prompt.trim() || undefined,
        image: referenceMode === 'avatar' ? toAbsoluteUrl(urls.image, origin) : urls.image,
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
            <div>
              <div className="small">Reference image source</div>
              <select
                className="select"
                value={referenceMode}
                onChange={(e) => {
                  const next = e.target.value as 'upload' | 'avatar';
                  setReferenceMode(next);
                  setImageUrl(null);
                  setOutputUrl(null);
                  setPredictionId(null);
                  if (next === 'upload') {
                    clearAvatar();
                  } else {
                    setImageFile(null);
                    setImagePreviewUrl(null);
                  }
                }}
              >
                <option value="upload">Upload reference image</option>
                <option value="avatar" disabled={!authToken}>
                  Use influencer avatar (@tag)
                </option>
              </select>
              {!authToken ? (
                <div className="small" style={{ marginTop: 6 }}>
                  Sign in to tag an influencer avatar.
                </div>
              ) : null}
            </div>
            {referenceMode === 'avatar' ? (
              <div style={{ position: 'relative' }}>
                <div className="small">Avatar tag</div>
                <input
                  className="input"
                  placeholder="@username"
                  value={avatarQuery}
                  onChange={(e) => {
                    const v = e.target.value;
                    setAvatarQuery(v);
                    setShowSuggestions(true);
                    // If user edits after selecting, clear selection to avoid mismatch.
                    if (selectedInfluencer) setSelectedInfluencer(null);
                    setAvatarCompositeStatus('unknown');
                    setAvatarCompositePredictionId(null);
                    setAvatarCompositeImageUrl(null);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                />

                {showSuggestions && filteredSuggestions.length > 0 ? (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 'auto 0 0 0',
                      transform: 'translateY(calc(100% + 8px))',
                      background: 'var(--panel)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: 8,
                      boxShadow: 'var(--shadow-lg)',
                      zIndex: 20,
                      maxHeight: 320,
                      overflow: 'auto',
                    }}
                  >
                    {filteredSuggestions.map((inf) => {
                      const username = String((inf as any).username || '').trim();
                      const name = String((inf as any).name || '').trim();
                      const img = pickBestInfluencerImage(inf);
                      const disabled = !img;
                      return (
                        <button
                          key={(inf as any).id || username || name}
                          className="btn ghost"
                          style={{
                            width: '100%',
                            justifyContent: 'flex-start',
                            gap: 10,
                            padding: 10,
                            marginTop: 0,
                            opacity: disabled ? 0.5 : 1,
                            cursor: disabled ? 'not-allowed' : 'pointer',
                          }}
                          disabled={disabled}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSelectedInfluencer(inf);
                            setAvatarQuery(`@${username}`);
                            setShowSuggestions(false);
                            setAvatarCompositeStatus('unknown');
                            setAvatarCompositePredictionId(null);
                            setAvatarCompositeImageUrl(null);
                            pushLog(`Detected avatar: @${username}`);
                          }}
                        >
                          <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {img ? <img src={img} alt={name || username || 'Influencer'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>
                              {name || username || 'Influencer'}
                              {username ? <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontWeight: 500 }}>@{username}</span> : null}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {img ? 'Ready (MAIN/face image found)' : 'Not ready (no MAIN/face image yet)'}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {selectedInfluencer ? (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      ✓ Detected: @{String((selectedInfluencer as any).username || '').trim()}
                    </div>
                    <button className="btn small secondary" type="button" onClick={clearAvatar}>
                      Clear
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
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
            {referenceMode === 'upload' ? (
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
            ) : (
              <div className="panel" style={{ padding: 'var(--space-5)', margin: 0 }}>
                <div className="header" style={{ marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-3)' }}>
                  <h3 style={{ margin: 0, fontSize: 'var(--font-lg)' }}>Avatar swap (auto)</h3>
                  <span className={statusBadgeClass(avatarCompositeStatus)}>
                    {avatarCompositeStatus === 'unknown' ? 'READY' : String(avatarCompositeStatus).toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--panel-muted)' }}>
                    <div className="small">First frame (auto extracted)</div>
                    {firstFrameEffectiveUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={firstFrameEffectiveUrl} alt="First frame preview" style={{ width: '100%', borderRadius: 10, marginTop: 10 }} />
                    ) : (
                      <div className="small" style={{ marginTop: 10 }}>
                        Upload a video to extract the first frame.
                      </div>
                    )}
                  </div>

                  <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--panel-muted)' }}>
                    <div className="small">Kling image input (Nano Banana result)</div>
                    {avatarCompositeEffectiveUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarCompositeEffectiveUrl} alt="Prepared reference image" style={{ width: '100%', borderRadius: 10, marginTop: 10 }} />
                    ) : (
                      <div className="small" style={{ marginTop: 10 }}>
                        Select an avatar tag and we’ll prepare the reference image automatically.
                      </div>
                    )}
                    {avatarCompositePredictionId ? (
                      <div className="small" style={{ marginTop: 8 }}>
                        Nano Banana ID: {avatarCompositePredictionId}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
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

          {!ready && (videoFile || imageFile || selectedInfluencer) ? (
            <div className="small" style={{ marginTop: 'var(--space-3)', color: 'var(--status-warn)' }}>
              {referenceMode === 'upload'
                ? 'Ensure video is ≤ 100MB and image is ≤ 10MB.'
                : 'Ensure video is ≤ 100MB and the tagged influencer has a MAIN/face image ready.'}
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
                  <div className="small">
                    {referenceMode === 'avatar'
                      ? (avatarCompositeImageUrl ? toAbsoluteUrl(avatarCompositeImageUrl, origin) : '—')
                      : (imageUrl ?? '—')}
                  </div>
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

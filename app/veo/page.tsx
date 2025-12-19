'use client';

import '../globals.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';

type VideoModelValue =
  | 'google/veo-3-fast'
  | 'google/veo-3'
  | 'google/veo-3.1-fast'
  | 'google/veo-3.1'
  | 'openai/sora-2'
  | 'openai/sora-2-pro'
  | 'bytedance/seedance-1-pro'
  | 'bytedance/seedance-1-lite'
  | 'wan-video/wan-2.2-i2v-fast'
  | 'wan-video/wan-2.2-animate-replace'
  | 'kwaivgi/kling-v2.5-turbo-pro'
  | 'kwaivgi/kling-v2.1';

type VideoModelMeta = {
  value: VideoModelValue;
  label: string;
  description?: string;
  badge?: string;
};

const VIDEO_MODELS: readonly VideoModelMeta[] = [
  {
    value: 'google/veo-3-fast',
    label: 'Google VEO 3 Fast',
    badge: 'Recommended',
    description: 'Balanced quality and speed with strong prompt following for social edits.',
  },
  {
    value: 'google/veo-3',
    label: 'Google VEO 3',
    badge: 'Premium',
    description: 'Highest fidelity version of VEO with longer queue times but incredible detail.',
  },
  {
    value: 'google/veo-3.1-fast',
    label: 'Google VEO 3.1 Fast',
    badge: 'New',
    description: 'Latest 3.1 release with upgraded motion intelligence at production-ready speeds.',
  },
  {
    value: 'google/veo-3.1',
    label: 'Google VEO 3.1',
    badge: 'Ultra',
    description: 'Top-tier VEO quality with cinematic depth, better camera reasoning, and longer durations.',
  },
  {
    value: 'openai/sora-2',
    label: 'OpenAI Sora 2',
    badge: 'Audio-synced',
    description: 'Ideal for cinematic shots with synced audio and precise lighting controls.',
  },
  {
    value: 'openai/sora-2-pro',
    label: 'OpenAI Sora 2 Pro',
    badge: 'Pro',
    description: 'Extended duration, fine-grain controls, and better consistency for complex scenes.',
  },
  {
    value: 'bytedance/seedance-1-pro',
    label: 'ByteDance Seedance 1 Pro',
    description: 'High-energy motion tuned for short-form ads, especially character work.',
  },
  {
    value: 'bytedance/seedance-1-lite',
    label: 'ByteDance Seedance 1 Lite',
    description: 'Budget-friendly Seedance with faster responses for concept exploration.',
  },
  {
    value: 'wan-video/wan-2.2-i2v-fast',
    label: 'Pruna WAN 2.2 i2v Fast',
    description: 'Image-to-video workflow with quick turnarounds for animating stills.',
  },
  {
    value: 'wan-video/wan-2.2-animate-replace',
    label: 'Wan 2.2 Animate Replace',
    description: 'Swap characters inside existing footage using Wan’s character replacement.',
  },
  {
    value: 'kwaivgi/kling-v2.5-turbo-pro',
    label: 'Kling 2.5 Turbo Pro',
    badge: 'New',
    description: 'Pro-level text-to-video and image-to-video with silky motion and cinematic depth.',
  },
  {
    value: 'kwaivgi/kling-v2.1',
    label: 'Kling 2.1 (Image-to-Video)',
    description: 'Use a start image to animate 5s or 10s clips in 720p or 1080p.',
    badge: 'Image-to-Video',
  },
];

type ModelDocExample = {
  title: string;
  input: Record<string, unknown>;
  output: string;
  link?: string;
};

type ModelDoc = {
  title: string;
  description: string;
  inputs: string[];
  outputSchema: string;
  examples: ModelDocExample[];
  tips: string[];
};

const VIDEO_MODEL_DOCS: Record<string, ModelDoc> = {
  'kwaivgi/kling-v2.5-turbo-pro': {
    title: 'Kling 2.5 Turbo Pro',
    description: 'Unlock pro-level text-to-video and image-to-video clips with smooth motion, cinematic depth, and remarkable prompt adherence.',
    inputs: [
      'prompt (required) — describe the shot, camera moves, and pacing',
      'duration — total run time in seconds',
      'aspect_ratio — e.g. 16:9, 9:16, 1:1 (ignored when a start image is supplied)',
      'start_image — first frame when converting an image to video',
      'image (deprecated) — legacy alias for start_image',
      'negative_prompt — force elements to stay out of the scene',
      'guidance controls — some presets expose guidance_scale and other fine-grained knobs via schema',
    ],
    outputSchema: `{
  "type": "string",
  "title": "Output",
  "format": "uri"
}`,
    examples: [
      {
        title: 'Woman is dancing',
        link: 'https://replicate.com/p/75wknmxbfnrme0csg84vagt5qr',
        input: {
          prompt: 'a woman is dancing',
          duration: 5,
          aspect_ratio: '16:9',
          guidance_scale: 0.5,
        },
        output: 'https://replicate.delivery/xezq/17c3JG1SzH6NCduMiKp1Cxyqvpad0GXRf507Pqq5GOqNsZsKA/tmpg4w3kyjz.mp4',
      },
    ],
    tips: [
      'Better prompt understanding: chain causal instructions for multi-beat shots and Kling will plan motion accordingly.',
      'More realistic motion: balanced training keeps frames stable even with aggressive camera moves.',
      'Detail consistency: refined conditioning locks palette, lighting, and wardrobe even through fast action.',
      'Designed for marketing, creators, studios, and education teams needing smooth, cinematic loops.',
    ],
  },
  'kwaivgi/kling-v2.1': {
    title: 'Kling v2.1 (Image-to-Video)',
    description: 'Upload a start image and let Kling v2.1 animate a 5s or 10s clip at 24fps in 720p (standard) or 1080p (pro).',
    inputs: [
      'prompt (required) — describe the movement, gestures, or context for the animation',
      'start_image (required) — first frame; Kling v2.1 always needs a reference',
      'mode — standard (720p) or pro (1080p). Use pro when also providing an end_image.',
      'duration — 5 or 10 seconds today',
      'negative_prompt — elements to keep out of the render',
      'end_image — optional final frame; requires mode="pro"',
    ],
    outputSchema: `{
  "type": "string",
  "title": "Output",
  "format": "uri"
}`,
    examples: [
      {
        title: 'Point at words',
        link: 'https://replicate.com/p/7v2d7djbn1rma0cqh6rbxwpxv0',
        input: {
          mode: 'standard',
          prompt: 'a woman points at the words',
          duration: 5,
          start_image: 'https://replicate.delivery/xezq/rfKExHkg7L2UAyYNJj3p1YrW1M3ZROTQQXupJSOyM5RkwQcKA/tmpowaafuyw.png',
        },
        output: 'https://replicate.delivery/xezq/ueemmhGfowaxnp2zx4rQAwZWkIGMkeoEFGwDMB8FJDDUPGiTB/tmpsam6b5v3.mp4',
      },
      {
        title: 'Gestures in the rain',
        link: 'https://replicate.com/p/a5fszgjzvdrmc0cqh6srsz53g4',
        input: {
          mode: 'standard',
          prompt: 'a woman takes her hands out her pockets and gestures to the words with both hands, she is excited, behind her it is raining',
          duration: 5,
          start_image: 'https://replicate.delivery/xezq/rfKExHkg7L2UAyYNJj3p1YrW1M3ZROTQQXupJSOyM5RkwQcKA/tmpowaafuyw.png',
        },
        output: 'https://replicate.delivery/xezq/yitkxodvCK7eJK9BFufsMBaHIfnHgJhlNNIiaQi8g8QebGiTB/tmpby0sgn7w.mp4',
      },
    ],
    tips: [
      'Always provide a crisp start image; Kling v2.1 refuses to run without one.',
      'Use mode="pro" for 1080p or when supplying an end_image to control the final pose.',
      'Stick to 5s clips for fastest turnaround; 10s generations may wait in queue longer.',
      'Pair negative prompts with precise gestures to keep hands and products framed cleanly.',
    ],
  },
};

type VideoModel = VideoModelValue;
const DEFAULT_MODEL: VideoModel = 'google/veo-3-fast';
const GOOGLE_MODELS = new Set<VideoModel>(
  VIDEO_MODELS.filter((m) => m.value.startsWith('google/veo')).map((m) => m.value as VideoModel)
);
const KLING_MODELS = new Set<VideoModel>(['kwaivgi/kling-v2.5-turbo-pro', 'kwaivgi/kling-v2.1']);

type VeoResponse = { url?: string | null; raw?: any };

export default function VeoPage() {
  const [model, setModel] = useState<VideoModel>(DEFAULT_MODEL);
  const [prompt, setPrompt] = useState('Woman holding the product facing the camera with slight but sharp hand movements. Keep her face locked on camera and avoid rotating the product.');
  const [imageUrl, setImageUrl] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [seed, setSeed] = useState<string>('');
  const [startFrameUrl, setStartFrameUrl] = useState('');
  const [endFrameUrl, setEndFrameUrl] = useState('');

  const [dragImage, setDragImage] = useState(false);
  const [dragStart, setDragStart] = useState(false);
  const [dragEnd, setDragEnd] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [rawVideoUrl, setRawVideoUrl] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [kvTaskId, setKvTaskId] = useState<string | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [inputSchema, setInputSchema] = useState<any | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, any>>({});

  const selectedModelMeta = useMemo(() => VIDEO_MODELS.find((m) => m.value === model), [model]);
  const selectedModelDoc = useMemo(() => VIDEO_MODEL_DOCS[model] || null, [model]);
  const isGoogleModel = useMemo(() => GOOGLE_MODELS.has(model), [model]);
  const isKlingModel = useMemo(() => KLING_MODELS.has(model), [model]);
  const klingRequiresStartImage = model === 'kwaivgi/kling-v2.1';
  const supportsNegativePrompt = isGoogleModel || Boolean(inputSchema?.properties?.negative_prompt);

  const uploadImage = useCallback(async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    form.append('filename', file.name);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { url: string };
    return json.url;
  }, []);

  const uploadMedia = useCallback(async (file: File): Promise<string> => {
    // Generic uploader for images/videos
    const form = new FormData();
    form.append('file', file);
    form.append('filename', file.name);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { url: string };
    return json.url;
  }, []);

  useEffect(() => {
    const loadSchema = async () => {
      setSchemaLoading(true);
      setSchemaError(null);
      setInputSchema(null);
      setInputValues({});
      try {
        const res = await fetch(`/api/replicate/schema?model=${encodeURIComponent(model)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        setInputSchema(json.input || null);
      } catch (e: any) {
        setSchemaError(e?.message || 'Failed to load schema');
      } finally {
        setSchemaLoading(false);
      }
    };
    loadSchema();
  }, [model]);

  const uriFields = useMemo(() => {
    if (!inputSchema?.properties) return [] as string[];
    const out: string[] = [];
    for (const [key, prop] of Object.entries<any>(inputSchema.properties)) {
      if (key === 'prompt') continue;
      if ((prop as any)?.format === 'uri') out.push(key);
    }
    return out;
  }, [inputSchema]);

  const nonUriFields = useMemo(() => {
    if (!inputSchema?.properties) return [] as Array<{ key: string; schema: any }>;
    const out: Array<{ key: string; schema: any }> = [];
    for (const [key, prop] of Object.entries<any>(inputSchema.properties)) {
      if (key === 'prompt') continue;
      if ((prop as any)?.format === 'uri') continue;
      out.push({ key, schema: prop });
    }
    return out;
  }, [inputSchema]);

  async function persistUrlIfPossible(url: string): Promise<string> {
    try {
      const res = await fetch('/api/persist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, filename: url.split('/').pop() || null, folder: 'veo' }) });
      if (!res.ok) return url;
      const j = await res.json();
      return typeof j?.url === 'string' ? j.url : url;
    } catch { return url; }
  }

  async function runVeo() {
    let kvIdLocal: string | null = null;
    setIsLoading(true);
    setError(null);
    setVideoUrl(null);
    try {
      // Create task records so it appears in /tasks (KV) and optionally Supabase if needed
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Please sign in at /auth before creating a task.');
      }

      const isGoogle = isGoogleModel;
      const dynamicInput: Record<string, any> = { ...inputValues };
      if (isGoogle) {
        if (imageUrl) dynamicInput.image = imageUrl;
        dynamicInput.resolution = resolution;
        if (seed.trim() !== '') dynamicInput.seed = Number(seed);
        if (startFrameUrl) dynamicInput.start_frame = startFrameUrl;
        if (endFrameUrl) dynamicInput.end_frame = endFrameUrl;
      }
      const trimmedNegative = negativePrompt.trim();
      if (supportsNegativePrompt && trimmedNegative) {
        dynamicInput.negative_prompt = trimmedNegative;
      }
      // Client-side validation for Wan Animate Replace
      if (model === 'wan-video/wan-2.2-animate-replace') {
        const v = dynamicInput.video;
        const ci = dynamicInput.character_image;
        if (!v || typeof v !== 'string' || !ci || typeof ci !== 'string') {
          throw new Error('Please provide both video and character_image files.');
        }
        if (dynamicInput.refert_num !== undefined) {
          const rn = Number(dynamicInput.refert_num);
          if (!(rn === 1 || rn === 5)) {
            throw new Error('refert_num must be 1 or 5.');
          }
        }
        if (dynamicInput.frames_per_second !== undefined) {
          const fps = parseInt(String(dynamicInput.frames_per_second), 10);
          if (!Number.isFinite(fps) || fps <= 0) {
            throw new Error('frames_per_second must be a positive integer.');
          }
        }
      }

      // Coerce types based on loaded schema to avoid string values for numbers/integers
      if (inputSchema?.properties && typeof inputSchema.properties === 'object') {
        for (const [key, prop] of Object.entries<any>(inputSchema.properties)) {
          if (!(key in dynamicInput)) continue;
          const val = dynamicInput[key];
          if (val === undefined || val === null || val === '') continue;
          const declaredType = prop?.type;
          // If enum is numeric but type missing, infer from first enum
          const isEnumNumeric = Array.isArray(prop?.enum) && prop.enum.length > 0 && typeof prop.enum[0] === 'number';
          if (declaredType === 'integer' || (isEnumNumeric && Number.isInteger(Number(val)))) {
            const parsed = parseInt(String(val));
            if (!Number.isNaN(parsed)) dynamicInput[key] = parsed;
          } else if (declaredType === 'number' || (isEnumNumeric && !Number.isInteger(Number(val)))) {
            const parsed = parseFloat(String(val));
            if (!Number.isNaN(parsed)) dynamicInput[key] = parsed;
          }
        }
      }

      const options = { model, ...dynamicInput } as Record<string, any>;

      // Create KV task
      try {
        const createRes = await fetch('/api/tasks/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            type: 'video',
            status: 'queued',
            provider: 'replicate',
            model_id: model,
            options_json: options,
            text_input: prompt,
            image_url: dynamicInput.image || null,
          })
        });
        if (createRes.ok) {
          const created = await createRes.json();
          kvIdLocal = created?.id || null;
          setKvTaskId(kvIdLocal);
        }
      } catch {}

      const res = await fetch('/api/veo/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          input: dynamicInput,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as VeoResponse;
      if (!json.url) throw new Error('No video URL returned');
      const persisted = await persistUrlIfPossible(json.url);
      const proxied = `/api/proxy?type=video&url=${encodeURIComponent(persisted)}`;
      setRawVideoUrl(persisted);
      setVideoUrl(proxied);

      // Update KV task
      if (kvIdLocal) {
        try {
          await fetch('/api/tasks/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: kvIdLocal, status: 'finished', output_url: persisted })
          });
        } catch {}
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to generate video');
      if (kvTaskId) {
        try { await fetch('/api/tasks/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: kvTaskId, status: 'error' }) }); } catch {}
      }
    } finally {
      setIsLoading(false);
    }
  }

  const isAnimateReplace = model === 'wan-video/wan-2.2-animate-replace';
  const animateMissingRequired = isAnimateReplace && (!inputValues.video || !inputValues.character_image);
  const klingStartMissing = klingRequiresStartImage && !inputValues.start_image;

  return (
    <div className="page-template generator fade-in">
      <header className="page-hero">
        <div>
          <p className="page-eyebrow">Video Generation</p>
          <h1>VEO · Kling · Sora Studio</h1>
          <p className="page-description">
            Storyboard cinematic spots from text, animate reference images, and experiment with the latest models. Kling 2.5 Turbo Pro docs now live in the sidebar.
          </p>
        </div>
        <div className="page-hero-actions">
          <a href="/tasks" className="hero-link">Monitor tasks</a>
          <a href="/credits" className="hero-link">Check credits</a>
        </div>
      </header>

      <div className="page-grid">
        <div className="page-main">
          <div className="generator-workspace">
            <div className="panel output">
              <div className="header">
                <h2 style={{margin:0}}>Output</h2>
              </div>
              <div className="outputArea">
                {videoUrl ? (
                  <div>
                    <video controls preload="metadata" playsInline style={{ width: '100%', borderRadius: 8 }} onError={()=> setError('Failed to load video. Try the direct link below.') }>
                      <source src={videoUrl} type="video/mp4" />
                      {rawVideoUrl && rawVideoUrl !== videoUrl ? (
                        <source src={rawVideoUrl} />
                      ) : null}
                    </video>
                    <div className="small" style={{ marginTop: 8, display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
                      <a href={videoUrl} target="_blank" rel="noreferrer" style={{padding:'8px 12px', background:'var(--panel-elevated)', borderRadius:'6px', textDecoration:'none'}}>Open via proxy</a>
                      {rawVideoUrl ? (
                        <a href={rawVideoUrl} target="_blank" rel="noreferrer" style={{padding:'8px 12px', background:'var(--panel-elevated)', borderRadius:'6px', textDecoration:'none'}}>Open direct</a>
                      ) : null}
                      <a href={`${videoUrl}${videoUrl.includes('?') ? '&' : '?'}download=true`} style={{padding:'8px 12px', background:'var(--accent)', color:'var(--color-black)', borderRadius:'6px', textDecoration:'none'}}>Download</a>
                    </div>
                  </div>
                ) : (
                  <div style={{fontSize:16, color:'#b7c2df'}}>Generated video will appear here.</div>
                )}
              </div>
              {error && (
                <div className="small" style={{ color: '#ff7878' }}>{error}</div>
              )}
            </div>

            <div className="panel">
              <div className="header">
                <h3 style={{margin:0}}>Video Generation</h3>
                <span className="badge">AI Video Models</span>
              </div>

              <div className="veo-control-stack">
                <section className="veo-control-card">
                  <div className="veo-control-card-header">
                    <div>
                      <div className="small">Model</div>
                      <div className="veo-control-title">{selectedModelMeta?.label || 'Select a model'}</div>
                    </div>
                    {selectedModelMeta?.badge && (
                      <span className="veo-chip">{selectedModelMeta.badge}</span>
                    )}
                  </div>
                  <select className="select" value={model} onChange={(e)=>setModel(e.target.value as VideoModel)}>
                    {VIDEO_MODELS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  {selectedModelMeta?.description && (
                    <p className="veo-control-description">{selectedModelMeta.description}</p>
                  )}
                </section>

                {isKlingModel && (
                  <section className="veo-info-banner">
                    <strong>Kling tip:</strong>{' '}
                    {klingRequiresStartImage
                      ? 'Upload a sharp start image (required) and use mode="pro" for 1080p or when supplying an end frame.'
                      : 'Provide a crisp start image for the best likeness and keep prompts focused on motion.'}
                  </section>
                )}

                <section className="veo-control-card">
                  <div className="small">Video Prompt{model === 'wan-video/wan-2.2-animate-replace' ? ' (optional)' : ''}</div>
                  <textarea
                    className="input"
                    value={prompt}
                    onChange={(e)=>setPrompt(e.target.value)}
                    rows={4}
                    placeholder="Describe the video you want to generate in detail..."
                  />
                  {supportsNegativePrompt && (
                    <div style={{marginTop:'var(--space-4)'}}>
                      <div className="small">Negative Prompt (optional)</div>
                      <textarea
                        className="input"
                        value={negativePrompt}
                        onChange={(e)=>setNegativePrompt(e.target.value)}
                        rows={3}
                        placeholder="Things to avoid in the video"
                      />
                    </div>
                  )}
                </section>

                {isGoogleModel && (
                  <section className="veo-control-card">
                    <div>
                      <div className="small">Reference image (optional)</div>
                      <div
                        className={`dnd ${dragImage ? 'drag' : ''}`}
                        onDragOver={(e)=>{e.preventDefault(); setDragImage(true);}}
                        onDragLeave={(e)=>{e.preventDefault(); setDragImage(false);}}
                        onDrop={async (e)=>{
                          e.preventDefault();
                          setDragImage(false);
                          const f = e.dataTransfer.files?.[0];
                          if (f && f.type.startsWith('image/')) {
                            try {
                              const url = await uploadImage(f);
                              setImageUrl(url);
                            } catch (err: any) {
                              setError(err?.message || 'Upload failed');
                            }
                          }
                        }}
                        onClick={()=>{
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = async ()=>{
                            const f = (input.files?.[0]) || null;
                            if (f) {
                              try {
                                const url = await uploadImage(f);
                                setImageUrl(url);
                              } catch (err: any) {
                                setError(err?.message || 'Upload failed');
                              }
                            }
                          };
                          input.click();
                        }}
                      >
                        <div className="dnd-icon">🖼️</div>
                        <div className="dnd-title">Reference Image</div>
                        <div className="dnd-subtitle">PNG/JPG • ideal 1280x720</div>
                        {imageUrl && (
                          <div className="fileInfo" style={{marginTop:'var(--space-3)'}}>
                            <img src={imageUrl} alt="reference" style={{maxWidth:240, borderRadius:'var(--radius-lg)'}} />
                            <div className="small" style={{marginTop:'var(--space-2)'}}><a href={imageUrl} target="_blank" rel="noreferrer">Open image</a></div>
                          </div>
                        )}
                      </div>
                      {imageUrl && (
                        <button className="btn" style={{marginTop:8}} onClick={()=>setImageUrl('')}>Clear image</button>
                      )}
                    </div>

                    <div className="options" style={{marginTop:12}}>
                      <div>
                        <div className="small">Start frame (optional)</div>
                        <div
                          className={`dnd ${dragStart ? 'drag' : ''}`}
                          onDragOver={(e)=>{e.preventDefault(); setDragStart(true);}}
                          onDragLeave={(e)=>{e.preventDefault(); setDragStart(false);}}
                          onDrop={async (e)=>{
                            e.preventDefault();
                            setDragStart(false);
                            const f = e.dataTransfer.files?.[0];
                            if (f && f.type.startsWith('image/')) {
                              try {
                                const url = await uploadImage(f);
                                setStartFrameUrl(url);
                              } catch (err: any) {
                                setError(err?.message || 'Upload failed');
                              }
                            }
                          }}
                          onClick={()=>{
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async ()=>{
                              const f = (input.files?.[0]) || null;
                              if (f) {
                                try {
                                  const url = await uploadImage(f);
                                  setStartFrameUrl(url);
                                } catch (err: any) {
                                  setError(err?.message || 'Upload failed');
                                }
                              }
                            };
                            input.click();
                          }}
                        >
                          <div className="dnd-icon">🎬</div>
                          <div className="dnd-title">Start Frame</div>
                          <div className="dnd-subtitle">PNG/JPG</div>
                          {startFrameUrl && (
                            <div className="fileInfo" style={{marginTop:'var(--space-3)'}}>
                              <img src={startFrameUrl} alt="start" style={{maxWidth:240, borderRadius:'var(--radius-lg)'}} />
                              <div className="small" style={{marginTop:'var(--space-2)'}}><a href={startFrameUrl} target="_blank" rel="noreferrer">Open start</a></div>
                            </div>
                          )}
                        </div>
                        {startFrameUrl && (
                          <button className="btn" style={{marginTop:8}} onClick={()=>setStartFrameUrl('')}>Clear start</button>
                        )}
                      </div>

                      <div>
                        <div className="small">End frame (optional)</div>
                        <div
                          className={`dnd ${dragEnd ? 'drag' : ''}`}
                          onDragOver={(e)=>{e.preventDefault(); setDragEnd(true);}}
                          onDragLeave={(e)=>{e.preventDefault(); setDragEnd(false);}}
                          onDrop={async (e)=>{
                            e.preventDefault();
                            setDragEnd(false);
                            const f = e.dataTransfer.files?.[0];
                            if (f && f.type.startsWith('image/')) {
                              try {
                                const url = await uploadImage(f);
                                setEndFrameUrl(url);
                              } catch (err: any) {
                                setError(err?.message || 'Upload failed');
                              }
                            }
                          }}
                          onClick={()=>{
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async ()=>{
                              const f = (input.files?.[0]) || null;
                              if (f) {
                                try {
                                  const url = await uploadImage(f);
                                  setEndFrameUrl(url);
                                } catch (err: any) {
                                  setError(err?.message || 'Upload failed');
                                }
                              }
                            };
                            input.click();
                          }}
                        >
                          <div className="dnd-icon">🏁</div>
                          <div className="dnd-title">End Frame</div>
                          <div className="dnd-subtitle">PNG/JPG</div>
                          {endFrameUrl && (
                            <div className="fileInfo" style={{marginTop:'var(--space-3)'}}>
                              <img src={endFrameUrl} alt="end" style={{maxWidth:240, borderRadius:'var(--radius-lg)'}} />
                              <div className="small" style={{marginTop:'var(--space-2)'}}><a href={endFrameUrl} target="_blank" rel="noreferrer">Open end</a></div>
                            </div>
                          )}
                        </div>
                        {endFrameUrl && (
                          <button className="btn" style={{marginTop:8}} onClick={()=>setEndFrameUrl('')}>Clear end</button>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                <section className="veo-control-card">
                  <div className="veo-control-card-header">
                    <div>
                      <div className="small">Model Inputs</div>
                      <div className="veo-control-description">Synced from Replicate schema</div>
                    </div>
                  </div>
                  {schemaLoading ? (
                    <div className="small" style={{marginTop:8}}>Loading model schema…</div>
                  ) : schemaError ? (
                    <div className="small" style={{ color: '#ff7878', marginTop:8 }}>{schemaError}</div>
                  ) : inputSchema ? (
                    <>
                      {uriFields.length > 0 && (
                        <div className="veo-subsection">
                          <div className="veo-subsection-title">Reference media</div>
                          {uriFields.map((fieldKey) => (
                            <div key={fieldKey}>
                              <div className="small">{fieldKey}{Array.isArray(inputSchema?.required) && inputSchema.required.includes(fieldKey) ? ' *' : ''}</div>
                              <div
                                className={`dnd`}
                                onDragOver={(e)=>{e.preventDefault();}}
                                onDrop={async (e)=>{
                                  e.preventDefault();
                                  const f = e.dataTransfer.files?.[0];
                                  if (f) {
                                    try {
                                      const url = await uploadMedia(f);
                                      setInputValues(v => ({ ...v, [fieldKey]: url }));
                                    } catch (err: any) {
                                      setError(err?.message || 'Upload failed');
                                    }
                                  }
                                }}
                                onClick={()=>{
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = fieldKey === 'video' ? 'video/*' : (fieldKey === 'character_image' ? 'image/*' : 'image/*,video/*');
                                  input.onchange = async ()=>{
                                    const f = (input.files?.[0]) || null;
                                    if (f) {
                                      try {
                                        const url = await uploadMedia(f);
                                        setInputValues(v => ({ ...v, [fieldKey]: url }));
                                      } catch (err: any) {
                                        setError(err?.message || 'Upload failed');
                                      }
                                    }
                                  };
                                  input.click();
                                }}
                              >
                                <div className="dnd-icon">📎</div>
                                <div className="dnd-title">{fieldKey}</div>
                                <div className="dnd-subtitle">{fieldKey === 'video' ? 'Video' : (fieldKey === 'character_image' ? 'Image' : 'Image/Video')} • {Array.isArray(inputSchema?.required) && inputSchema.required.includes(fieldKey) ? 'Required' : 'Optional'}</div>
                                {inputValues[fieldKey] && (
                                  <div className="fileInfo" style={{marginTop:'var(--space-3)'}}>
                                    {String(inputValues[fieldKey]).match(/\.(mp4|mov|webm)(\?|$)/i) ? (
                                      <video src={inputValues[fieldKey]} controls style={{maxWidth:240, borderRadius:'var(--radius-lg)'}} />
                                    ) : (
                                      <img src={inputValues[fieldKey]} alt={fieldKey} style={{maxWidth:240, borderRadius:'var(--radius-lg)'}} />
                                    )}
                                    <div className="small" style={{marginTop:'var(--space-2)'}}><a href={inputValues[fieldKey]} target="_blank" rel="noreferrer">Open</a></div>
                                  </div>
                                )}
                              </div>
                              {inputValues[fieldKey] && (
                                <button className="btn" style={{marginTop:8}} onClick={()=>setInputValues(v => { const n = { ...v }; delete n[fieldKey]; return n; })}>Clear {fieldKey}</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {nonUriFields.length > 0 && (
                        <div className="veo-subsection">
                          <div className="veo-subsection-title">Model parameters</div>
                          {nonUriFields.map(({ key, schema }) => {
                            const required = Array.isArray(inputSchema?.required) && inputSchema.required.includes(key);
                            const title = schema?.title || key;
                            if (Array.isArray(schema?.enum)) {
                              const isNumericEnum = schema?.type === 'integer' || schema?.type === 'number';
                              return (
                                <div key={key}>
                                  <div className="small">{title}{required ? ' *' : ''}</div>
                                  <select
                                    className="select"
                                    value={inputValues[key] ?? schema.default ?? ''}
                                    onChange={(e)=>{
                                      const val = e.target.value;
                                      setInputValues(v=>({
                                        ...v,
                                        [key]: isNumericEnum ? (schema?.type === 'integer' ? parseInt(val) : parseFloat(val)) : val
                                      }));
                                    }}
                                  >
                                    {schema.enum.map((opt: any) => {
                                      const label = String(opt);
                                      const value = String(opt);
                                      return (
                                        <option key={label} value={value}>{label}</option>
                                      );
                                    })}
                                  </select>
                                </div>
                              );
                            }
                            if (schema?.type === 'integer' || schema?.type === 'number') {
                              const step = schema?.type === 'integer' ? 1 : (schema?.multipleOf || 0.1);
                              return (
                                <div key={key}>
                                  <div className="small">{title}{required ? ' *' : ''}</div>
                                  <input
                                    className="input"
                                    type="number"
                                    step={step}
                                    min={schema?.minimum ?? undefined}
                                    max={schema?.maximum ?? undefined}
                                    value={inputValues[key] ?? ''}
                                    onChange={(e)=>{
                                      const val = e.target.value;
                                      setInputValues(v=>({ ...v, [key]: val === '' ? undefined : (schema?.type === 'integer' ? parseInt(val) : parseFloat(val)) }));
                                    }}
                                    placeholder={schema?.description || ''}
                                  />
                                </div>
                              );
                            }
                            if (schema?.type === 'boolean') {
                              return (
                                <label key={key} className="small" style={{display:'flex', gap:8, alignItems:'center'}}>
                                  <input
                                    type="checkbox"
                                    checked={!!inputValues[key]}
                                    onChange={(e)=>setInputValues(v=>({ ...v, [key]: e.target.checked }))}
                                  /> {title}{required ? ' *' : ''}
                                </label>
                              );
                            }
                            return (
                              <div key={key}>
                                <div className="small">{title}{required ? ' *' : ''}</div>
                                <input
                                  className="input"
                                  value={inputValues[key] ?? ''}
                                  onChange={(e)=>setInputValues(v=>({ ...v, [key]: e.target.value }))}
                                  placeholder={schema?.description || ''}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {uriFields.length === 0 && nonUriFields.length === 0 && (
                        <div className="small" style={{color:'var(--text-muted)'}}>This model has no additional exposed parameters.</div>
                      )}
                    </>
                  ) : (
                    <div className="small" style={{color:'var(--text-muted)'}}>Select a model to load its inputs.</div>
                  )}
                </section>

                {isGoogleModel && (
                  <section className="veo-control-card">
                    <div className="options" style={{marginTop:0}}>
                      <div>
                        <div className="small">Resolution</div>
                        <select className="select" value={resolution} onChange={(e)=>setResolution(e.target.value as any)}>
                          <option value="720p">720p</option>
                          <option value="1080p">1080p</option>
                        </select>
                      </div>

                      <div>
                        <div className="small">Seed (optional)</div>
                        <input className="input" type="number" value={seed} onChange={(e)=>setSeed(e.target.value)} placeholder="Random if empty" />
                      </div>
                    </div>
                  </section>
                )}

                <section className="veo-control-card">
                  {klingStartMissing && (
                    <p className="small" style={{ marginBottom: 'var(--space-3)', color: '#fbbf24' }}>
                      Kling v2.1 requires a start image. Upload one under “Reference media & required files”.
                    </p>
                  )}
                  <button
                    className="btn"
                    style={{ width: '100%' }}
                    disabled={
                      isLoading ||
                      (model !== 'wan-video/wan-2.2-animate-replace' && !prompt.trim()) ||
                      animateMissingRequired ||
                      klingStartMissing
                    }
                    onClick={runVeo}
                  >
                    {isLoading ? 'Generating…' : 'Generate video'}
                  </button>
                </section>
              </div>
            </div>
          </div>
        </div>

        <div className="page-side-panel">
          <div className="side-panel-card">
            <h3>Session</h3>
            <div className="kv">
              <div>Model</div><div>{selectedModelMeta?.label || model}</div>
              <div>Negative prompt</div><div>{supportsNegativePrompt ? 'Yes' : 'Not exposed'}</div>
              <div>Schema</div><div>{schemaLoading ? 'Loading…' : (schemaError ? 'Error' : 'Loaded')}</div>
              <div>Inputs set</div><div>{Object.keys(inputValues).length}</div>
            </div>
          </div>

          {selectedModelDoc ? (
            <div className="side-panel-card model-doc-card">
              <h3>{selectedModelDoc.title}</h3>
              <p className="small">{selectedModelDoc.description}</p>

              <div className="model-doc-section">
                <strong>Inputs</strong>
                <ul>
                  {selectedModelDoc.inputs.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="model-doc-section">
                <strong>Output schema</strong>
                <pre className="model-doc-code">{selectedModelDoc.outputSchema}</pre>
              </div>

              {selectedModelDoc.examples.map((example) => (
                <div key={example.title} className="model-doc-example">
                  <div className="model-doc-example-header">
                    <strong>{example.title}</strong>
                    {example.link && <a href={example.link} target="_blank" rel="noreferrer">View</a>}
                  </div>
                  <div className="model-doc-example-body">
                    <span className="small">Input</span>
                    <pre className="model-doc-code">{JSON.stringify(example.input, null, 2)}</pre>
                    <span className="small">Output</span>
                    <a href={example.output} target="_blank" rel="noreferrer">{example.output.replace(/^https?:\/\//, '')}</a>
                  </div>
                </div>
              ))}

              <div className="model-doc-section">
                <strong>Tips</strong>
                <ul>
                  {selectedModelDoc.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="side-panel-card">
              <h3>Model Guide</h3>
              <p className="small">Select Kling 2.5 Turbo Pro to view detailed inputs, schema, example prompts, and creative tips.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

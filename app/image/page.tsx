'use client';

import '../globals.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';

const FLUX_KONTEXT_ASPECT_RATIOS = ['match_input_image','1:1','16:9','9:16','4:3','3:4','3:2','2:3','4:5','5:4','21:9','9:21','2:1','1:2'] as const;
const GENERIC_ASPECT_RATIOS = ['1:1','16:9','21:9','3:2','2:3','4:5','5:4','3:4','4:3','9:16','9:21'] as const;
const MULTI_IMAGE_MODELS = new Set(['google/nano-banana','google/nano-banana-pro','openai/gpt-image-1.5']);

type ReplicateStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'queued' | 'unknown';

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

const IMAGE_MODEL_DOCS: Record<string, ModelDoc> = {
  'openai/gpt-image-1.5': {
    title: 'GPT Image 1.5',
    description: `OpenAI's latest image model with better instruction following, precise facial fidelity, and stronger adherence to prompts.`,
    inputs: [
      'prompt (required) — Describe the scene you want to generate',
      'openai_api_key (optional) — Use your own key or fall back to the shared proxy',
      'aspect_ratio — Any freeform ratio such as "3:2" or "16:9"',
      'input_images — Supply one or more reference URLs for edits or consistency',
      'input_fidelity — low / medium / high to control likeness to references',
      'number_of_images — 1-10 renditions from a single prompt',
      'quality, background, moderation, output_format, output_compression and more for fine control',
    ],
    outputSchema: `{
  "type": "array",
  "items": { "type": "string", "format": "uri" },
  "title": "Output"
}`,
    examples: [
      {
        title: 'Chelsea, London 1970s',
        link: 'https://replicate.com/p/z3jpsevkdhrm80cv56maz0tehw',
        input: {
          prompt: 'make a scene in chelsea, london in the 1970s ... "Create what you imagine"',
          quality: 'high',
          background: 'auto',
          moderation: 'auto',
          aspect_ratio: '1:1',
          output_format: 'webp',
          input_fidelity: 'low',
          number_of_images: 1,
          output_compression: 90,
        },
        output: 'https://replicate.delivery/xezq/cfGqZx844oRYLKNR6CWBVNARYlJVBfmgeOKbGP0z1vzeAqPXB/tmp9zf8qbu4.webp',
      },
      {
        title: 'Combine two men + dog',
        link: 'https://replicate.com/p/p38pkfx4c5rm80cv589aqgsgb8',
        input: {
          prompt: 'Combine the two men and the dog in a 2000s film...',
          quality: 'high',
          background: 'auto',
          moderation: 'auto',
          aspect_ratio: '3:2',
          input_images: [
            'https://replicate.delivery/pbxt/OFNN4DH4OXYel64RkDKDp4HxwoY9tfK5OtYHkWHx3ktKsfe7/man1.webp',
            'https://replicate.delivery/pbxt/OFNN3YocTbB7SITa2UAOHgjz81miTP5Osg3C3zT7QzUJEqwq/man2.webp',
            'https://replicate.delivery/pbxt/OFNN3mVC2NEqTEOwljhVWyEsrccYY5Mzo10ynKHhKM72L2AU/dog1.webp',
          ],
          output_format: 'jpeg',
          input_fidelity: 'low',
          number_of_images: 1,
          output_compression: 90,
        },
        output: 'https://replicate.delivery/xezq/VeuqmSs6b83PbSAfcBxzE65BiHGxiJpeJBGaURgVP24Xa4nrA/tmpnzt7xhtv.jpeg',
      },
    ],
    tips: [
      'Be specific: describe lighting, materials, typography, and what should remain untouched.',
      'Use photo language (lens, depth of field, lighting) when aiming for realism.',
      'Lock critical regions by stating what must not change during edits.',
      'Put any text you need rendered in quotes for better accuracy.',
      'Iterate in small steps — reusing prior outputs as references when refining details.',
    ],
  },
};

type ImageResponse = { id?: string | null; status?: string | null };

export default function ImagePage() {
  const [model, setModel] = useState<
    | 'black-forest-labs/flux-kontext-max'
    | 'google/nano-banana'
    | 'google/nano-banana-pro'
    | 'black-forest-labs/flux-krea-dev'
    | 'stability-ai/stable-diffusion-3'
    | 'bytedance/hyper-sd'
    | 'openai/gpt-image-1.5'
  >('black-forest-labs/flux-kontext-max');
  const [prompt, setPrompt] = useState('A stunning digital artwork of a futuristic cityscape at sunset, with neon lights reflecting on wet streets');
  const [negativePrompt, setNegativePrompt] = useState('blurry, low quality, distorted, ugly');
  const [aspectRatio, setAspectRatio] = useState('match_input_image');
  const [outputFormat, setOutputFormat] = useState<'jpg' | 'png' | 'webp'>('png');
  const [seed, setSeed] = useState<string>('');
  const [safetyTolerance, setSafetyTolerance] = useState<number>(2);
  const [promptUpsampling, setPromptUpsampling] = useState(false);
  const [resolution, setResolution] = useState<string>('2K');
  const [safetyFilterLevel, setSafetyFilterLevel] = useState<string>('block_only_high');

  const [openAiApiKey, setOpenAiApiKey] = useState('');
  const [inputFidelity, setInputFidelity] = useState<'low' | 'medium' | 'high'>('low');
  const [qualityPreset, setQualityPreset] = useState<'standard' | 'high'>('high');
  const [backgroundSetting, setBackgroundSetting] = useState<'auto' | 'transparent' | 'opaque'>('auto');
  const [outputCompression, setOutputCompression] = useState<number>(90);
  const [moderationSetting, setModerationSetting] = useState<'auto' | 'lenient' | 'strict' | 'none'>('auto');
  const [userId, setUserId] = useState('');
  
  const [guidance, setGuidance] = useState<number>(7.5);
  const [outputQuality, setOutputQuality] = useState<number>(80);
  const [numOutputs, setNumOutputs] = useState<number>(1);
  const [steps, setSteps] = useState<number>(25);
  const [strength, setStrength] = useState<number>(0.8);

  const [inputImageUrl, setInputImageUrl] = useState<string>('');
  const [inputImageUrls, setInputImageUrls] = useState<string[]>([]);
  const [dragInput, setDragInput] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [kvTaskId, setKvTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<ReplicateStatus>('unknown');
  const [logLines, setLogLines] = useState<string[]>([]);
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const supportsMultipleInputImages = MULTI_IMAGE_MODELS.has(model);
  const maxImageOutputs = model === 'openai/gpt-image-1.5' ? 10 : 4;

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<ReplicateStatus | null>(null);
  const hasPersistedOutputRef = useRef(false);

  const pushLog = useCallback((line: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogLines((prev) => [...prev, `${timestamp}  ${line}`]);
  }, []);

  const selectedDoc = useMemo(() => IMAGE_MODEL_DOCS[model] || null, [model]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const uploadImage = useCallback(async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    form.append('filename', file.name);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { url: string };
    return json.url;
  }, []);

  async function persistUrlIfPossible(url: string): Promise<string> {
    try {
      const res = await fetch('/api/persist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, filename: url.split('/').pop() || null, folder: 'image' })
      });
      if (!res.ok) return url;
      const j = await res.json();
      return typeof j?.url === 'string' ? j.url : url;
    } catch {
      return url;
    }
  }

  async function runImage() {
    let kvIdLocal: string | null = null;
    let supabaseTaskId: string | null = null;
    hasPersistedOutputRef.current = false;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsLoading(true);
    setError(null);
    setImageUrl(null);
    setRawImageUrl(null);
    setPredictionId(null);
    setStatus('queued');
    setLogLines([]);
    setTaskId(null);
    setKvTaskId(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in at /auth before creating a task.');

      const buildModelOptions = (includeSensitive = false): Record<string, any> => {
        const normalizedFormat = model === 'openai/gpt-image-1.5' && outputFormat === 'jpg' ? 'jpeg' : outputFormat;
        const sanitizedFluxAspect = FLUX_KONTEXT_ASPECT_RATIOS.includes(aspectRatio as (typeof FLUX_KONTEXT_ASPECT_RATIOS)[number])
          ? aspectRatio
          : 'match_input_image';
        const sanitizedGenericAspect = GENERIC_ASPECT_RATIOS.includes(aspectRatio as (typeof GENERIC_ASPECT_RATIOS)[number])
          ? aspectRatio
          : '1:1';
        const seedNumber = seed.trim() === '' ? undefined : Number(seed);
        const uploadedImages = inputImageUrls.length ? inputImageUrls : (inputImageUrl ? [inputImageUrl] : undefined);
        const clampOutputs = (max: number) => Math.min(max, Math.max(1, Number(numOutputs) || 1));
        const base: Record<string, any> = { model, prompt, output_format: normalizedFormat };

        if (model === 'black-forest-labs/flux-kontext-max') {
          Object.assign(base, {
            input_image: inputImageUrl || undefined,
            aspect_ratio: sanitizedFluxAspect,
            seed: seedNumber,
            safety_tolerance: typeof safetyTolerance === 'number' ? safetyTolerance : undefined,
            prompt_upsampling: promptUpsampling,
          });
        } else if (model === 'google/nano-banana') {
          base.image_input = uploadedImages;
        } else if (model === 'google/nano-banana-pro') {
          base.image_input = uploadedImages;
          base.aspect_ratio = sanitizedGenericAspect;
          base.resolution = resolution;
          base.safety_filter_level = safetyFilterLevel;
        } else if (model === 'black-forest-labs/flux-krea-dev') {
          base.input_image = inputImageUrl || undefined;
          base.aspect_ratio = sanitizedGenericAspect;
          base.seed = seedNumber;
          (base as any).guidance = guidance;
          (base as any).num_outputs = clampOutputs(4);
          (base as any).output_quality = Math.min(100, Math.max(0, Number(outputQuality) || 80));
        } else if (model === 'openai/gpt-image-1.5') {
          base.aspect_ratio = sanitizedGenericAspect;
          if (uploadedImages && uploadedImages.length) base.input_images = uploadedImages;
          base.input_fidelity = inputFidelity;
          base.quality = qualityPreset;
          base.background = backgroundSetting;
          base.number_of_images = clampOutputs(10);
          base.output_compression = Math.min(100, Math.max(0, Number(outputCompression) || 0));
          base.moderation = moderationSetting;
          if (userId.trim()) base.user_id = userId.trim();
          if (includeSensitive && openAiApiKey.trim()) base.openai_api_key = openAiApiKey.trim();
        }

        return base;
      };

      const options = buildModelOptions(false);

      try {
        const createRes = await fetch('/api/tasks/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            type: 'image',
            status: 'queued',
            provider: 'replicate',
            model_id: model,
            options_json: options,
            text_input: prompt,
            image_url: inputImageUrl || (inputImageUrls[0] || null),
          })
        });
        if (createRes.ok) {
          const created = await createRes.json();
          kvIdLocal = created?.id || null;
          setKvTaskId(kvIdLocal);
        }
      } catch {}

      const { data: inserted, error: insertErr } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          type: 'image',
          status: 'queued',
          provider: 'replicate',
          model_id: model,
          options_json: options,
          text_input: prompt,
        })
        .select('*')
        .single();
      if (insertErr || !inserted) throw new Error(insertErr?.message || 'Failed to create task');
      supabaseTaskId = inserted.id;
      setTaskId(inserted.id);

      pushLog(`Submitting ${model}`);
      const res = await fetch('/api/image/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildModelOptions(true)),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as ImageResponse;
      if (!json.id) throw new Error('No prediction ID returned');
      setPredictionId(json.id);
      const initialStatus: ReplicateStatus = (json.status as ReplicateStatus) || 'queued';
      setStatus(initialStatus);
      pushLog(`Prediction created: ${json.id}`);
      if (supabaseTaskId) {
        await supabase.from('tasks').update({ status: initialStatus, job_id: json.id }).eq('id', supabaseTaskId);
      }
      if (kvIdLocal) {
        try {
          await fetch('/api/tasks/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: kvIdLocal, status: initialStatus, job_id: json.id })
          });
        } catch {}
      }

      pollRef.current = setInterval(async () => {
        if (!json.id) return;
        try {
          const statusRes = await fetch(`/api/replicate/status?id=${encodeURIComponent(json.id)}`);
          if (!statusRes.ok) return;
          const payload = await statusRes.json();
          const st: ReplicateStatus = payload.status || 'unknown';
          if (st !== lastStatusRef.current) {
            pushLog(`Status: ${st}`);
            lastStatusRef.current = st;
          }
          setStatus(st);

          const supabaseUpdate: Record<string, any> = { status: st };
          if (payload.outputUrl && typeof payload.outputUrl === 'string' && !hasPersistedOutputRef.current) {
            hasPersistedOutputRef.current = true;
            const persisted = await persistUrlIfPossible(payload.outputUrl);
            const proxied = `/api/proxy?url=${encodeURIComponent(persisted)}`;
            setRawImageUrl(persisted);
            setImageUrl(proxied);
            supabaseUpdate.output_url = proxied;
            if (kvIdLocal) {
              try {
                await fetch('/api/tasks/update', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: kvIdLocal, status: st, output_url: persisted })
                });
              } catch {}
            }
          } else if (kvIdLocal) {
            try {
              await fetch('/api/tasks/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: kvIdLocal, status: st })
              });
            } catch {}
          }
          if (supabaseTaskId) {
            await supabase.from('tasks').update(supabaseUpdate).eq('id', supabaseTaskId);
          }

          if (st === 'succeeded' || st === 'failed' || st === 'canceled') {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setIsLoading(false);
            if (st !== 'succeeded' && payload.error) {
              const errMsg = typeof payload.error === 'string' ? payload.error : 'Generation failed';
              setError(errMsg);
              pushLog(`Error: ${errMsg}`);
            }
          }
        } catch {
          // Ignore transient polling failures
        }
      }, 2000);
    } catch (e: any) {
      setIsLoading(false);
      setStatus('failed');
      const message = e?.message || 'Failed to generate image';
      setError(message);
      pushLog(`Error: ${message}`);
      if (supabaseTaskId) {
        await supabase.from('tasks').update({ status: 'error' }).eq('id', supabaseTaskId);
      }
      const kvTarget = kvIdLocal || kvTaskId;
      if (kvTarget) {
        try {
          await fetch('/api/tasks/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: kvTarget, status: 'error' })
          });
        } catch {}
      }
    }
  }

  return (
    <div className="page-template generator fade-in">
      <header className="page-hero">
        <div>
          <p className="page-eyebrow">Image Generation</p>
          <h1>Image Lab</h1>
          <p className="page-description">
            Flux, Nano Banana, GPT Image 1.5, Hyper-SD, and more in one workspace. Layer references, edit identities, and export production-ready visuals.
          </p>
        </div>
        <div className="page-hero-actions">
          <a href="/tasks" className="hero-link">View tasks</a>
          <a href="/credits" className="hero-link">Credit status</a>
        </div>
      </header>

      <div className="page-grid">
        <div className="page-main">
          <div className="generator-workspace">
            <div className="panel output">
              <div className="header">
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <h2 style={{margin:0}}>Output</h2>
                  <span className="badge">{status.toUpperCase?.() || status}</span>
                </div>
                <div className="small">Prediction ID: {predictionId ?? '—'}</div>
              </div>
              <div className="outputArea">
                {imageUrl ? (
                  <div>
                    <img
                      src={imageUrl}
                      alt="Generated image"
                      style={{ maxWidth: '100%', borderRadius: 8 }}
                      onError={()=> setError('Failed to load image. Try the direct link below.')}
                    />
                    <div className="small" style={{ marginTop: 8, display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
                      <a href={imageUrl} target="_blank" rel="noreferrer" style={{padding:'8px 12px', background:'var(--panel-elevated)', borderRadius:'6px', textDecoration:'none'}}>Open via proxy</a>
                      {rawImageUrl ? (
                        <a href={rawImageUrl} target="_blank" rel="noreferrer" style={{padding:'8px 12px', background:'var(--panel-elevated)', borderRadius:'6px', textDecoration:'none'}}>Open direct</a>
                      ) : null}
                      <a href={`${imageUrl}${imageUrl.includes('?') ? '&' : '?'}download=true`} style={{padding:'8px 12px', background:'var(--accent)', color:'var(--color-black)', borderRadius:'6px', textDecoration:'none'}}>Download</a>
                    </div>
                  </div>
                ) : (
                  <div style={{fontSize:16, color:'#b7c2df'}}>Generated image will appear here.</div>
                )}
              </div>
              {error && (
                <div className="small" style={{ color: '#ff7878', marginTop:8 }}>{error}</div>
              )}
              <div>
                <div className="small" style={{margin:'8px 0 6px'}}>Log</div>
                <pre className="log">{logLines.length ? logLines.join('\n') : 'Waiting for events…'}</pre>
              </div>
            </div>

            <div className="panel">
              <div className="header">
                <h3 style={{margin:0}}>Model Configuration</h3>
                <span className="badge">AI Image Generation</span>
              </div>

              <div className="options">
                <div style={{gridColumn: 'span 2'}}>
                  <div className="small">Model</div>
                  <select className="select" value={model} onChange={(e)=>setModel(e.target.value as any)}>
                    <option value="black-forest-labs/flux-kontext-max">FLUX Kontext Max (Best Quality)</option>
                    <option value="black-forest-labs/flux-krea-dev">FLUX Krea Dev (Fast)</option>
                    <option value="google/nano-banana">Google Nano Banana</option>
                    <option value="google/nano-banana-pro">Google Nano Banana Pro 🍌🍌</option>
                    <option value="openai/gpt-image-1.5">OpenAI GPT Image 1.5</option>
                    <option value="stability-ai/stable-diffusion-3">Stable Diffusion 3</option>
                    <option value="bytedance/hyper-sd">ByteDance Hyper-SD</option>
                  </select>
                </div>
              </div>

              <div className="options">
                <div style={{gridColumn: 'span 2'}}>
                  <div className="small">Prompt</div>
                  <textarea
                    className="input"
                    value={prompt}
                    onChange={(e)=>setPrompt(e.target.value)}
                    rows={4}
                    placeholder="Describe the image you want to generate or edit..."
                  />
                </div>
                
                <div style={{gridColumn: 'span 2'}}>
                  <div className="small">Negative Prompt (Optional)</div>
                  <textarea
                    className="input"
                    value={negativePrompt}
                    onChange={(e)=>setNegativePrompt(e.target.value)}
                    rows={2}
                    placeholder="What to avoid in the image..."
                  />
                </div>
              </div>

              <div>
                <div className="small">Input image (optional)</div>
                <div
                  className={`dnd ${dragInput ? 'drag' : ''}`}
                  onDragOver={(e)=>{e.preventDefault(); setDragInput(true);}}
                  onDragLeave={(e)=>{e.preventDefault(); setDragInput(false);}}
                  onDrop={async (e)=>{
                    e.preventDefault();
                    setDragInput(false);
                    const files = Array.from(e.dataTransfer.files || []).filter(f=>f.type.startsWith('image/'));
                    if (!files.length) return;
                    try {
                      const urls = await Promise.all(files.map(f=>uploadImage(f)));
                      if (supportsMultipleInputImages) setInputImageUrls(prev => [...prev, ...urls]);
                      else setInputImageUrl(urls[0]);
                    } catch (err: any) {
                      setError(err?.message || 'Upload failed');
                    }
                  }}
                  onClick={()=>{
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    if (supportsMultipleInputImages) (input as any).multiple = true;
                    input.onchange = async ()=>{
                      const files = Array.from(input.files || []);
                      if (!files.length) return;
                      try {
                        const urls = await Promise.all(files.map(f=>uploadImage(f)));
                        if (supportsMultipleInputImages) setInputImageUrls(prev => [...prev, ...urls]);
                        else setInputImageUrl(urls[0]);
                      } catch (err: any) {
                        setError(err?.message || 'Upload failed');
                      }
                    };
                    input.click();
                  }}
                >
                  <div className="dnd-icon">🖼️</div>
                  <div className="dnd-title">Reference Image</div>
                  <div className="dnd-subtitle">PNG/JPG/GIF/WebP • Optional for image editing</div>
                  {supportsMultipleInputImages ? (
                    inputImageUrls.length > 0 && (
                      <div className="fileInfo" style={{marginTop:'var(--space-3)', display:'flex', flexWrap:'wrap', gap:'var(--space-2)'}}>
                        {inputImageUrls.map((url, idx) => (
                          <div key={url+idx}>
                            <img src={url} alt={`input-${idx}`} style={{maxWidth:120, borderRadius:'var(--radius-lg)'}} />
                            <div className="small" style={{marginTop:'var(--space-1)'}}><a href={url} target="_blank" rel="noreferrer">Open</a></div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    inputImageUrl && (
                      <div className="fileInfo" style={{marginTop:'var(--space-3)'}}>
                        <img src={inputImageUrl} alt="input" style={{maxWidth:240, borderRadius:'var(--radius-lg)'}} />
                        <div className="small" style={{marginTop:'var(--space-2)'}}><a href={inputImageUrl} target="_blank" rel="noreferrer">Open image</a></div>
                      </div>
                    )
                  )}
                </div>
                {supportsMultipleInputImages ? (
                  inputImageUrls.length > 0 && (
                    <button className="btn" style={{marginTop:8}} onClick={()=>setInputImageUrls([])}>Clear images</button>
                  )
                ) : (
                  inputImageUrl && (
                    <button className="btn" style={{marginTop:8}} onClick={()=>setInputImageUrl('')}>Clear image</button>
                  )
                )}
              </div>

              <div className="options">
                <div>
                  <div className="small">Aspect Ratio</div>
                  <select className="select" value={aspectRatio} onChange={(e)=>setAspectRatio(e.target.value)}>
                    {model === 'black-forest-labs/flux-kontext-max'
                      ? FLUX_KONTEXT_ASPECT_RATIOS.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))
                      : GENERIC_ASPECT_RATIOS.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))
                    }
                  </select>
                </div>

                <div>
                  <div className="small">Output Format</div>
                  <select className="select" value={outputFormat} onChange={(e)=>setOutputFormat(e.target.value as any)}>
                    <option value="png">PNG</option>
                    <option value="jpg">JPG</option>
                    {(model === 'black-forest-labs/flux-krea-dev' || model === 'openai/gpt-image-1.5') && (
                      <option value="webp">WebP</option>
                    )}
                  </select>
                </div>

                <div>
                  <div className="small">Seed</div>
                  <input className="input" type="number" value={seed} onChange={(e)=>setSeed(e.target.value)} placeholder="Random if empty" />
                </div>

                <div>
                  <div className="small">Number of Images (max {maxImageOutputs})</div>
                  <input className="input" type="number" min={1} max={maxImageOutputs} value={numOutputs} onChange={(e)=>setNumOutputs(parseInt(e.target.value || '1'))} />
                </div>
              </div>

              <div className="options">
                <div>
                  <div className="small">Guidance Scale</div>
                  <input className="input" type="number" step={0.5} min={1} max={20} value={guidance} onChange={(e)=>setGuidance(parseFloat(e.target.value || '7.5'))} />
                </div>

                <div>
                  <div className="small">Steps</div>
                  <input className="input" type="number" min={1} max={100} value={steps} onChange={(e)=>setSteps(parseInt(e.target.value || '25'))} />
                </div>

                {inputImageUrl && (
                  <div>
                    <div className="small">Strength</div>
                    <input className="input" type="number" step={0.1} min={0} max={1} value={strength} onChange={(e)=>setStrength(parseFloat(e.target.value || '0.8'))} />
                  </div>
                )}

                <div>
                  <div className="small">Quality</div>
                  <input className="input" type="number" min={0} max={100} value={outputQuality} onChange={(e)=>setOutputQuality(parseInt(e.target.value || '80'))} />
                </div>
              </div>

              {model === 'black-forest-labs/flux-kontext-max' && (
                <div className="options">
                  <div>
                    <div className="small">Safety Tolerance</div>
                    <input className="input" type="number" min={0} max={6} value={safetyTolerance} onChange={(e)=>setSafetyTolerance(parseInt(e.target.value||'2'))} />
                  </div>
                  <div>
                    <label className="small" style={{display:'flex', gap:'var(--space-2)', alignItems:'center'}}>
                      <input type="checkbox" checked={promptUpsampling} onChange={(e)=>setPromptUpsampling(e.target.checked)} /> Prompt Upsampling
                    </label>
                  </div>
                </div>
              )}

              {model === 'google/nano-banana-pro' && (
                <div className="options">
                  <div>
                    <div className="small">Resolution</div>
                    <select className="select" value={resolution} onChange={(e)=>setResolution(e.target.value)}>
                      <option value="1K">1K</option>
                      <option value="2K">2K</option>
                      <option value="4K">4K</option>
                    </select>
                  </div>
                  <div>
                    <div className="small">Safety Filter Level</div>
                    <select className="select" value={safetyFilterLevel} onChange={(e)=>setSafetyFilterLevel(e.target.value)}>
                      <option value="block_low_and_above">Block Low and Above (Strictest)</option>
                      <option value="block_medium_and_above">Block Medium and Above</option>
                      <option value="block_only_high">Block Only High (Most Permissive)</option>
                    </select>
                  </div>
                </div>
              )}

              {model === 'openai/gpt-image-1.5' && (
                <>
                  <div className="options">
                    <div style={{gridColumn:'span 2'}}>
                      <div className="small">OpenAI API Key (optional)</div>
                      <input
                        className="input"
                        type="password"
                        value={openAiApiKey}
                        onChange={(e)=>setOpenAiApiKey(e.target.value)}
                        placeholder="sk-..."
                      />
                      <div className="small" style={{marginTop:4, fontSize:12, opacity:0.8}}>Leave blank to use the shared proxy key.</div>
                    </div>
                    <div>
                      <div className="small">Input Fidelity</div>
                      <select className="select" value={inputFidelity} onChange={(e)=>setInputFidelity(e.target.value as any)}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div>
                      <div className="small">Quality</div>
                      <select className="select" value={qualityPreset} onChange={(e)=>setQualityPreset(e.target.value as any)}>
                        <option value="standard">Standard</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>
                  <div className="options">
                    <div>
                      <div className="small">Background</div>
                      <select className="select" value={backgroundSetting} onChange={(e)=>setBackgroundSetting(e.target.value as any)}>
                        <option value="auto">Auto</option>
                        <option value="transparent">Transparent</option>
                        <option value="opaque">Opaque</option>
                      </select>
                    </div>
                    <div>
                      <div className="small">Moderation</div>
                      <select className="select" value={moderationSetting} onChange={(e)=>setModerationSetting(e.target.value as any)}>
                        <option value="auto">Auto</option>
                        <option value="lenient">Lenient</option>
                        <option value="strict">Strict</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                    <div>
                      <div className="small">Output Compression (%)</div>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        max={100}
                        value={outputCompression}
                        onChange={(e)=>setOutputCompression(Math.min(100, Math.max(0, parseInt(e.target.value || '0') || 0)))}
                      />
                    </div>
                    <div style={{gridColumn:'span 2'}}>
                      <div className="small">User ID (optional)</div>
                      <input
                        className="input"
                        value={userId}
                        onChange={(e)=>setUserId(e.target.value)}
                        placeholder="user-123"
                      />
                    </div>
                  </div>
                </>
              )}

              <button className="btn" style={{ marginTop: 12 }} disabled={!prompt.trim() || isLoading} onClick={runImage}>
                {isLoading ? 'Generating…' : 'Generate image'}
              </button>
            </div>
          </div>
        </div>

        <div className="page-side-panel">
          <div className="side-panel-card">
            <h3>Status</h3>
            <div className="kv">
              <div>State</div><div className="badge">{status.toUpperCase?.() || status}</div>
              <div>Prediction</div><div className="small">{predictionId ?? '—'}</div>
              <div>Task (DB)</div><div className="small">{taskId ?? '—'}</div>
              <div>Task (KV)</div><div className="small">{kvTaskId ?? '—'}</div>
            </div>
            <p className="small" style={{marginTop:12}}>
              Jobs now run asynchronously so the route never times out, even while Nano Banana Pro or GPT Image take their time.
            </p>
          </div>

          {selectedDoc ? (
            <div className="side-panel-card model-doc-card">
              <h3>{selectedDoc.title}</h3>
              <p className="small">{selectedDoc.description}</p>

              <div className="model-doc-section">
                <strong>Inputs</strong>
                <ul>
                  {selectedDoc.inputs.map((input) => (
                    <li key={input}>{input}</li>
                  ))}
                </ul>
              </div>

              <div className="model-doc-section">
                <strong>Output schema</strong>
                <pre className="model-doc-code">{selectedDoc.outputSchema}</pre>
              </div>

              {selectedDoc.examples.map((example) => (
                <div key={example.title} className="model-doc-example">
                  <div className="model-doc-example-header">
                    <strong>{example.title}</strong>
                    {example.link && (
                      <a href={example.link} target="_blank" rel="noreferrer">View</a>
                    )}
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
                  {selectedDoc.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="side-panel-card">
              <h3>Model Guide</h3>
              <p className="small">Select OpenAI GPT Image 1.5 to unlock detailed docs, examples, and prompt advice.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

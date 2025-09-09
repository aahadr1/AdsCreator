'use client';

import '../globals.css';
import { useCallback, useState } from 'react';
// Database functionality removed

type ImageResponse = { url?: string | null; raw?: any };

export default function ImagePage() {
  const [model, setModel] = useState<'black-forest-labs/flux-kontext-max' | 'google/nano-banana' | 'black-forest-labs/flux-krea-dev' | 'stability-ai/stable-diffusion-3' | 'bytedance/hyper-sd'>('black-forest-labs/flux-kontext-max');
  const [prompt, setPrompt] = useState('A stunning digital artwork of a futuristic cityscape at sunset, with neon lights reflecting on wet streets');
  const [negativePrompt, setNegativePrompt] = useState('blurry, low quality, distorted, ugly');
  const [aspectRatio, setAspectRatio] = useState('match_input_image');
  const [outputFormat, setOutputFormat] = useState<'jpg' | 'png' | 'webp'>('png');
  const [seed, setSeed] = useState<string>('');
  const [safetyTolerance, setSafetyTolerance] = useState<number>(2);
  const [promptUpsampling, setPromptUpsampling] = useState(false);
  
  // Advanced parameters
  const [guidance, setGuidance] = useState<number>(7.5);
  const [outputQuality, setOutputQuality] = useState<number>(80);
  const [numOutputs, setNumOutputs] = useState<number>(1);
  const [steps, setSteps] = useState<number>(25);
  const [strength, setStrength] = useState<number>(0.8);
  const [width, setWidth] = useState<number>(1024);
  const [height, setHeight] = useState<number>(1024);

  const [inputImageUrl, setInputImageUrl] = useState<string>('');
  const [inputImageUrls, setInputImageUrls] = useState<string[]>([]);
  const [dragInput, setDragInput] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

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
      const res = await fetch('/api/persist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, filename: url.split('/').pop() || null, folder: 'image' }) });
      if (!res.ok) return url;
      const j = await res.json();
      return typeof j?.url === 'string' ? j.url : url;
    } catch { return url; }
  }

  async function runImage() {
    setIsLoading(true);
    setError(null);
    setImageUrl(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in at /auth before creating a task.');

      const options: Record<string, any> = { model, prompt };
      if (model === 'black-forest-labs/flux-kontext-max') {
        Object.assign(options, {
          input_image: inputImageUrl || undefined,
          aspect_ratio: aspectRatio,
          output_format: outputFormat,
          seed: seed.trim() === '' ? undefined : Number(seed),
          safety_tolerance: typeof safetyTolerance === 'number' ? safetyTolerance : undefined,
          prompt_upsampling: promptUpsampling,
        });
      } else if (model === 'google/nano-banana') {
        Object.assign(options, {
          image_input: inputImageUrls.length ? inputImageUrls : (inputImageUrl ? [inputImageUrl] : undefined),
          output_format: outputFormat,
        });
      } else if (model === 'black-forest-labs/flux-krea-dev') {
        Object.assign(options, {
          image: inputImageUrl || undefined,
          // Default to 1:1 if previous value is not applicable
          aspect_ratio: ['1:1','16:9','21:9','3:2','2:3','4:5','5:4','3:4','4:3','9:16','9:21'].includes(aspectRatio) ? aspectRatio : '1:1',
          output_format: outputFormat || 'webp',
          seed: seed.trim() === '' ? undefined : Number(seed),
          guidance,
          num_outputs: Math.min(4, Math.max(1, Number(numOutputs) || 1)),
          output_quality: Math.min(100, Math.max(0, Number(outputQuality) || 80)),
        });
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          type: 'lipsync',
          status: 'queued',
          provider: 'replicate',
          model_id: model,
          options_json: options,
          text_input: prompt,
        })
        .select('*')
        .single();
      if (insertErr || !inserted) throw new Error(insertErr?.message || 'Failed to create task');
      setTaskId(inserted.id);

      const res = await fetch('/api/image/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify((() => {
          const base: Record<string, any> = { model, prompt, output_format: outputFormat };
          if (model === 'black-forest-labs/flux-kontext-max') {
            base.input_image = inputImageUrl || undefined;
            base.aspect_ratio = aspectRatio;
            base.seed = seed.trim() === '' ? undefined : Number(seed);
            base.safety_tolerance = typeof safetyTolerance === 'number' ? safetyTolerance : undefined;
            base.prompt_upsampling = promptUpsampling;
          } else if (model === 'google/nano-banana') {
            base.image_input = inputImageUrls.length ? inputImageUrls : (inputImageUrl ? [inputImageUrl] : undefined);
          } else if (model === 'black-forest-labs/flux-krea-dev') {
            // Prefer using input_image to align with server mapping, server also accepts image
            base.input_image = inputImageUrl || undefined;
            base.aspect_ratio = ['1:1','16:9','21:9','3:2','2:3','4:5','5:4','3:4','4:3','9:16','9:21'].includes(aspectRatio) ? aspectRatio : '1:1';
            base.seed = seed.trim() === '' ? undefined : Number(seed);
            (base as any).guidance = guidance;
            (base as any).num_outputs = Math.min(4, Math.max(1, Number(numOutputs) || 1));
            (base as any).output_quality = Math.min(100, Math.max(0, Number(outputQuality) || 80));
          }
          return base;
        })()),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as ImageResponse;
      if (!json.url) throw new Error('No image URL returned');
      const persisted = await persistUrlIfPossible(json.url);
      const proxied = `/api/proxy?url=${encodeURIComponent(persisted)}`;
      setRawImageUrl(persisted);
      setImageUrl(proxied);

      if (inserted?.id) {
        await supabase
          .from('tasks')
          .update({ status: 'finished', output_url: persisted })
          .eq('id', inserted.id);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to generate image');
      if (taskId) {
        await supabase.from('tasks').update({ status: 'error' }).eq('id', taskId);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="panel output">
        <div className="header">
          <h2 style={{margin:0}}>Output</h2>
        </div>
        <div className="outputArea">
          {imageUrl ? (
            <div>
              <img src={imageUrl} alt="Generated image" style={{ maxWidth: '100%', borderRadius: 8 }} onError={()=> setError('Failed to load image. Try the direct link below.')} />
              <div className="small" style={{ marginTop: 8, display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
                <a href={imageUrl} target="_blank" rel="noreferrer" style={{padding:'8px 12px', background:'var(--panel-elevated)', borderRadius:'6px', textDecoration:'none'}}>Open via proxy</a>
                {rawImageUrl ? (
                  <a href={rawImageUrl} target="_blank" rel="noreferrer" style={{padding:'8px 12px', background:'var(--panel-elevated)', borderRadius:'6px', textDecoration:'none'}}>Open direct</a>
                ) : null}
                <a href={`${imageUrl}${imageUrl.includes('?') ? '&' : '?'}download=true`} style={{padding:'8px 12px', background:'var(--accent)', color:'white', borderRadius:'6px', textDecoration:'none'}}>Download</a>
              </div>
              {/* Database functionality removed */}
            </div>
          ) : (
            <div style={{fontSize:16, color:'#b7c2df'}}>Generated image will appear here.</div>
          )}
        </div>
        {error && (
          <div className="small" style={{ color: '#ff7878' }}>{error}</div>
        )}
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
                if (model === 'google/nano-banana') setInputImageUrls(prev => [...prev, ...urls]);
                else setInputImageUrl(urls[0]);
              } catch (err: any) {
                setError(err?.message || 'Upload failed');
              }
            }}
            onClick={()=>{
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              if (model === 'google/nano-banana') (input as any).multiple = true;
              input.onchange = async ()=>{
                const files = Array.from(input.files || []);
                if (!files.length) return;
                try {
                  const urls = await Promise.all(files.map(f=>uploadImage(f)));
                  if (model === 'google/nano-banana') setInputImageUrls(prev => [...prev, ...urls]);
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
            {model === 'google/nano-banana' ? (
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
          {model === 'google/nano-banana' ? (
            inputImageUrls.length > 0 && (
              <button className="btn" style={{marginTop:8}} onClick={()=>setInputImageUrls([])}>Clear images</button>
            )
          ) : (
            inputImageUrl && (
              <button className="btn" style={{marginTop:8}} onClick={()=>setInputImageUrl('')}>Clear image</button>
            )
          )}
        </div>

        {/* Basic Parameters */}
        <div className="options">
          <div>
            <div className="small">Aspect Ratio</div>
            <select className="select" value={aspectRatio} onChange={(e)=>setAspectRatio(e.target.value)}>
              {model === 'black-forest-labs/flux-kontext-max' ? 
                ['match_input_image','1:1','16:9','9:16','4:3','3:4','3:2','2:3','4:5','5:4','21:9','9:21','2:1','1:2'].map(a => (
                  <option key={a} value={a}>{a}</option>
                )) :
                ['1:1','16:9','21:9','3:2','2:3','4:5','5:4','3:4','4:3','9:16','9:21'].map(a => (
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
              {model === 'black-forest-labs/flux-krea-dev' && (
                <option value="webp">WebP</option>
              )}
            </select>
          </div>

          <div>
            <div className="small">Seed</div>
            <input className="input" type="number" value={seed} onChange={(e)=>setSeed(e.target.value)} placeholder="Random if empty" />
          </div>

          <div>
            <div className="small">Number of Images</div>
            <input className="input" type="number" min={1} max={4} value={numOutputs} onChange={(e)=>setNumOutputs(parseInt(e.target.value || '1'))} />
          </div>
        </div>

        {/* Advanced Parameters */}
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

        {/* Model-specific options */}
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

        <button className="btn" style={{ marginTop: 12 }} disabled={!prompt.trim() || isLoading} onClick={runImage}>
          {isLoading ? 'Generating…' : 'Generate image'}
        </button>
      </div>
    </div>
  );
}



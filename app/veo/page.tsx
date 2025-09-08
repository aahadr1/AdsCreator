'use client';

export const dynamic = 'force-dynamic';

import '../globals.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';
import AddToDatabaseButton from '../../components/AddToDatabaseButton';

type VeoResponse = { url?: string | null; raw?: any };

export default function VeoPage() {
  const [model, setModel] = useState<'google/veo-3' | 'google/veo-3-fast' | 'bytedance/seedance-1-pro' | 'bytedance/seedance-1-lite'>('google/veo-3-fast');
  const [prompt, setPrompt] = useState('A cinematic drone flyover of futuristic cityscapes at sunset.');
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
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [inputSchema, setInputSchema] = useState<any | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, any>>({});

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
    setIsLoading(true);
    setError(null);
    setVideoUrl(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in at /auth before creating a task.');

      const isGoogle = model.startsWith('google/veo');
      const dynamicInput: Record<string, any> = { ...inputValues };
      if (isGoogle) {
        if (imageUrl) dynamicInput.image = imageUrl;
        if (negativePrompt) dynamicInput.negative_prompt = negativePrompt;
        dynamicInput.resolution = resolution;
        if (seed.trim() !== '') dynamicInput.seed = Number(seed);
        if (startFrameUrl) dynamicInput.start_frame = startFrameUrl;
        if (endFrameUrl) dynamicInput.end_frame = endFrameUrl;
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

      if (inserted?.id) {
        await supabase
          .from('tasks')
          .update({ status: 'finished', output_url: persisted })
          .eq('id', inserted.id);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to generate video');
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
                <a href={`${videoUrl}${videoUrl.includes('?') ? '&' : '?'}download=true`} style={{padding:'8px 12px', background:'var(--accent)', color:'white', borderRadius:'6px', textDecoration:'none'}}>Download</a>
              </div>
              <AddToDatabaseButton mediaUrl={rawVideoUrl || videoUrl} kind="video" size="large" context={{ prompt, model, inputs: [imageUrl ? { type: 'image', url: imageUrl, label: 'reference_image' } : undefined, startFrameUrl ? { type: 'image', url: startFrameUrl, label: 'start_frame' } : undefined, endFrameUrl ? { type: 'image', url: endFrameUrl, label: 'end_frame' } : undefined].filter(Boolean) as any }} />
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

        <div className="options">
          <div style={{gridColumn: 'span 2'}}>
            <div className="small">Model</div>
            <select className="select" value={model} onChange={(e)=>setModel(e.target.value as any)}>
              <option value="google/veo-3-fast">Google VEO 3 Fast (Recommended)</option>
              <option value="google/veo-3">Google VEO 3 (Highest Quality)</option>
              <option value="bytedance/seedance-1-pro">ByteDance Seedance 1 Pro</option>
              <option value="bytedance/seedance-1-lite">ByteDance Seedance 1 Lite</option>
            </select>
          </div>
        </div>

        <div className="options">
          <div style={{gridColumn: 'span 2'}}>
            <div className="small">Video Prompt</div>
            <textarea
              className="input"
              value={prompt}
              onChange={(e)=>setPrompt(e.target.value)}
              rows={4}
              placeholder="Describe the video you want to generate in detail..."
            />
          </div>
        </div>

        {model.startsWith('google/veo') && (
          <>
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
          </>
        )}

        {/* Dynamic reference media for any model's URI fields */}
        {schemaLoading ? (
          <div className="small" style={{marginTop:8}}>Loading model schema…</div>
        ) : schemaError ? (
          <div className="small" style={{ color: '#ff7878', marginTop:8 }}>{schemaError}</div>
        ) : inputSchema ? (
          <>
            {uriFields.length > 0 && (
              <div className="options" style={{marginTop:12}}>
                <div style={{fontWeight:700, marginBottom:6}}>Reference media</div>
                {uriFields.map((fieldKey) => (
                  <div key={fieldKey}>
                    <div className="small">{fieldKey}</div>
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
                        input.accept = 'image/*,video/*';
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
                      <div className="dnd-subtitle">Image/Video • Auto-configured</div>
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
              <div className="options" style={{marginTop:12}}>
                <div style={{fontWeight:700, marginBottom:6}}>Model parameters</div>
                {nonUriFields.map(({ key, schema }) => {
                  const required = Array.isArray(inputSchema?.required) && inputSchema.required.includes(key);
                  const title = schema?.title || key;
                  // Render based on schema
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
                  // default: string
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
          </>
        ) : null}

        {model.startsWith('google/veo') && (
          <div>
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

        {model.startsWith('google/veo') && (
          <div className="options" style={{marginTop:12}}>
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
        )}

        <button className="btn" style={{ marginTop: 12 }} disabled={!prompt.trim() || isLoading} onClick={runVeo}>
          {isLoading ? 'Generating…' : 'Generate video'}
        </button>
      </div>
    </div>
  );
}



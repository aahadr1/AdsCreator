'use client';

import '../globals.css';
import { useCallback, useState } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';

type EnhanceResponse = { url?: string | null; raw?: any };

export default function EnhancePage() {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [drag, setDrag] = useState(false);

  const [enhanceModel, setEnhanceModel] = useState<string>('Low Resolution V2');
  const [upscaleFactor, setUpscaleFactor] = useState<'2x' | '4x' | '6x'>('4x');
  const [faceEnhancement, setFaceEnhancement] = useState<boolean>(true);
  const [subjectDetection, setSubjectDetection] = useState<'Foreground' | 'Background' | 'Off'>('Foreground');
  const [faceEnhancementCreativity, setFaceEnhancementCreativity] = useState<number>(0.5);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [kvTaskId, setKvTaskId] = useState<string | null>(null);

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
      const res = await fetch('/api/persist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, filename: url.split('/').pop() || null, folder: 'enhance' }) });
      if (!res.ok) return url;
      const j = await res.json();
      return typeof j?.url === 'string' ? j.url : url;
    } catch { return url; }
  }

  async function runEnhance() {
    let kvIdLocal: string | null = null;
    setIsLoading(true);
    setError(null);
    setOutputUrl(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in at /auth before creating a task.');

      const options = {
        image: imageUrl,
        enhance_model: enhanceModel,
        upscale_factor: upscaleFactor,
        face_enhancement: faceEnhancement,
        subject_detection: subjectDetection,
        face_enhancement_creativity: faceEnhancementCreativity,
      };

      // Create KV task (Cloudflare KV for /tasks page)
      let kvIdLocal: string | null = null;
      try {
        const createRes = await fetch('/api/tasks/create', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            type: 'enhance',
            status: 'queued',
            provider: 'replicate',
            backend: 'topazlabs/image-upscale',
            options_json: options,
            image_url: imageUrl,
            text_input: 'enhance',
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
          type: 'lipsync',
          status: 'queued',
          provider: 'replicate',
          model_id: 'topazlabs/image-upscale',
          options_json: options,
          text_input: 'enhance',
        })
        .select('*')
        .single();
      if (insertErr || !inserted) throw new Error(insertErr?.message || 'Failed to create task');
      setTaskId(inserted.id);

      const res = await fetch('/api/enhance/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as EnhanceResponse;
      if (!json.url) throw new Error('No image URL returned');
      const persisted = await persistUrlIfPossible(json.url);
      setOutputUrl(persisted);

      if (inserted?.id) {
        await supabase
          .from('tasks')
          .update({ status: 'finished', output_url: persisted })
          .eq('id', inserted.id);
      }
      if (kvIdLocal) {
        try {
          await fetch('/api/tasks/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: kvIdLocal, status: 'finished', output_url: persisted }) });
        } catch {}
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to enhance image');
      if (taskId) {
        await supabase.from('tasks').update({ status: 'error' }).eq('id', taskId);
      }
      if (kvTaskId) {
        try { await fetch('/api/tasks/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: kvTaskId, status: 'error' }) }); } catch {}
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
          {outputUrl ? (
            <div>
              <img src={outputUrl} style={{ maxWidth: '100%', borderRadius: 8 }} />
              {/* Database functionality removed */}
            </div>
          ) : (
            <div style={{fontSize:16, color:'#b7c2df'}}>Enhanced image will appear here.</div>
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
          <div className="small">Input image</div>
          <div
            className={`dnd ${drag ? 'drag' : ''}`}
            onDragOver={(e)=>{e.preventDefault(); setDrag(true);}}
            onDragLeave={(e)=>{e.preventDefault(); setDrag(false);}}
            onDrop={async (e)=>{
              e.preventDefault();
              setDrag(false);
              const files = Array.from(e.dataTransfer.files || []).filter(f=>f.type.startsWith('image/'));
              if (!files.length) return;
              try {
                const url = await uploadImage(files[0]);
                setImageUrl(url);
              } catch (err: any) {
                setError(err?.message || 'Upload failed');
              }
            }}
            onClick={()=>{
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = async ()=>{
                const files = Array.from(input.files || []);
                if (!files.length) return;
                try {
                  const url = await uploadImage(files[0]);
                  setImageUrl(url);
                } catch (err: any) { setError(err?.message || 'Upload failed'); }
              };
              input.click();
            }}
          >
            <div style={{fontWeight:700}}>Drop image or click to upload</div>
            <div className="small">PNG/JPG/WebP</div>
            {imageUrl && (
              <div className="fileInfo" style={{marginTop:8}}>
                <img src={imageUrl} alt="input" style={{maxWidth:240, borderRadius:8}} />
                <div className="small" style={{marginTop:6}}><a href={imageUrl} target="_blank" rel="noreferrer">Open image</a></div>
              </div>
            )}
          </div>
          {imageUrl && (
            <button className="btn" style={{marginTop:8}} onClick={()=>setImageUrl('')}>Clear image</button>
          )}
        </div>

        <div className="options" style={{marginTop:12}}>
          <div>
            <div className="small">Enhance model</div>
            <input className="input" value={enhanceModel} onChange={(e)=>setEnhanceModel(e.target.value)} placeholder="Low Resolution V2" />
          </div>

          <div>
            <div className="small">Upscale factor</div>
            <select className="select" value={upscaleFactor} onChange={(e)=>setUpscaleFactor(e.target.value as any)}>
              <option value="2x">2x</option>
              <option value="4x">4x</option>
              <option value="6x">6x</option>
            </select>
          </div>

          <label className="small" style={{display:'flex', gap:8, alignItems:'center'}}>
            <input type="checkbox" checked={faceEnhancement} onChange={(e)=>setFaceEnhancement(e.target.checked)} /> Face enhancement
          </label>

          <div>
            <div className="small">Subject detection</div>
            <select className="select" value={subjectDetection} onChange={(e)=>setSubjectDetection(e.target.value as any)}>
              <option value="Foreground">Foreground</option>
              <option value="Background">Background</option>
              <option value="Off">Off</option>
            </select>
          </div>

          <div>
            <div className="small">Face enhancement creativity</div>
            <input className="input" type="number" step={0.05} min={0} max={1} value={faceEnhancementCreativity} onChange={(e)=>setFaceEnhancementCreativity(parseFloat(e.target.value||'0'))} />
          </div>
        </div>

        <button className="btn" style={{ marginTop: 12 }} disabled={!imageUrl || isLoading} onClick={runEnhance}>
          {isLoading ? 'Enhancing…' : 'Enhance image'}
        </button>
      </div>
    </div>
  );
}






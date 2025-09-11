'use client';

import '../globals.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';

type ReplicateStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'queued' | 'unknown';

export default function LipsyncNewPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);


  const [useText, setUseText] = useState(false);
  const [text, setText] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [voiceSpeed, setVoiceSpeed] = useState<number>(1);

  const [model, setModel] = useState<'kling' | 'sync2' | 'latentsync' | 'sieve'>('kling');
  const [syncMode, setSyncMode] = useState<'loop' | 'bounce' | 'cut_off' | 'silence' | 'remap'>('loop');
  const [temperature, setTemperature] = useState<number>(0.5);
  
  // Additional model parameters
  const [inferenceSteps, setInferenceSteps] = useState<number>(20);
  const [guidanceScale, setGuidanceScale] = useState<number>(7.5);
  const [enableMultispeaker, setEnableMultispeaker] = useState<boolean>(false);
  const [enhance, setEnhance] = useState<'default' | 'gfpgan' | 'codeformer'>('default');
  const [checkQuality, setCheckQuality] = useState<boolean>(false);
  const [downsample, setDownsample] = useState<boolean>(false);
  const [cutBy, setCutBy] = useState<'audio' | 'video'>('audio');

  const [status, setStatus] = useState<ReplicateStatus>('unknown');
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [kvTaskId, setKvTaskId] = useState<string | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<ReplicateStatus | null>(null);

  const pushLog = (line: string) => setLogLines((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${line}`]);


  const onSelectVideo = useCallback(async (file: File) => {
    setVideoFile(file);
  }, []);

  const onSelectAudio = useCallback(async (file: File) => {
    setAudioFile(file);
  }, []);


  async function uploadIfNeeded(): Promise<{ videoUrl: string; audioUrl?: string } | false> {
    if (!videoFile) return false;
    if (model === 'sync2' && !audioFile) return false;
    if (!useText && model === 'kling' && !audioFile) return false;

    if (videoUrl && (useText ? true : !!audioUrl)) {
      return { videoUrl, audioUrl: audioUrl || undefined } as { videoUrl: string; audioUrl?: string };
    }

    pushLog('Uploading files to storage...');
    const uploadOnce = async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      form.append('filename', file.name);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ url: string; path: string }>;
    };

    const v = await uploadOnce(videoFile);
    setVideoUrl(v.url);
    let aUrl: string | undefined;
    if (!useText && audioFile) {
      const a = await uploadOnce(audioFile);
      setAudioUrl(a.url);
      aUrl = a.url;
    }
    pushLog('Uploaded.');
    return { videoUrl: v.url, audioUrl: aUrl };
  }

  function requiredReady(): boolean {
    if (model === 'kling') {
      if (!videoFile) return false;
      if (useText) return text.trim().length > 0;
      return !!audioFile;
    }
    if (model === 'sync2') {
      return !!videoFile && !!audioFile;
    }
    return false;
  }

  async function startGeneration() {
    let kvIdLocal: string | null = null;
    try {
      setStatus('queued'); setLogLines([]); setOutputUrl(null); setPredictionId(null);
      const urls = await uploadIfNeeded();
      if (!urls) { pushLog('Please select required inputs.'); setStatus('unknown'); return; }

      const modelName = model === 'kling' ? 'kwaivgi/kling-lip-sync' : 'sync/lipsync-2';

      const input = model === 'kling' ? (
        useText ? {
          video_url: urls.videoUrl,
          text: text,
          voice_id: voiceId || undefined,
          voice_speed: Number.isFinite(voiceSpeed) ? voiceSpeed : undefined,
        } : {
          video_url: urls.videoUrl,
          audio_file: urls.audioUrl!,
        }
      ) : {
        video: urls.videoUrl,
        audio: urls.audioUrl!,
        sync_mode: syncMode,
        temperature,
      };

      pushLog(`Submitting to Replicate model: ${modelName}`);

      // Create a task row so it appears in /tasks
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        pushLog('Please sign in at /auth to save this job in Tasks.');
      }
      let createdTaskId: string | null = null;
      // Create KV task first for /tasks view
      let kvIdLocal: string | null = null;
      if (user) {
        try {
          const createRes = await fetch('/api/tasks/create', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: user.id,
              status: 'queued',
              type: 'lipsync',
              provider: 'replicate',
              backend: modelName,
              options_json: input,
              text_input: model === 'kling' && useText ? text : null,
              video_url: urls.videoUrl,
              audio_url: urls.audioUrl || null,
            })
          });
          if (createRes.ok) {
            const created = await createRes.json();
            kvIdLocal = created?.id || null;
            setKvTaskId(kvIdLocal);
          }
        } catch {}
      }
      if (user) {
        const { data: inserted, error: insertErr } = await supabase
          .from('tasks')
          .insert({
            user_id: user.id,
            status: 'queued',
            type: 'lipsync',
            provider: 'replicate',
            backend: modelName,
            options_json: input,
            text_input: model === 'kling' && useText ? text : null,
            video_url: urls.videoUrl,
            audio_url: urls.audioUrl || null,
          })
          .select('*')
          .single();
        if (insertErr || !inserted) {
          pushLog('Warning: failed to save task: ' + (insertErr?.message || 'unknown'));
        } else {
          createdTaskId = inserted.id as string;
          setTaskId(createdTaskId);
          pushLog(`Task created: ${createdTaskId}`);
        }
      }

      const res = await fetch('/api/replicate/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelName, input })
      });
      if (!res.ok) { pushLog('Submission failed: ' + (await res.text())); setStatus('failed'); return; }
      const data = await res.json();
      setPredictionId(data.id as string);
      setStatus((data.status as ReplicateStatus) || 'queued');
      pushLog(`Prediction created: ${data.id}`);

      // Save job id to task
      if (createdTaskId) {
        try { await supabase.from('tasks').update({ status: (data.status as string) || 'queued', job_id: data.id }).eq('id', createdTaskId); } catch {}
      }
      if (kvIdLocal) {
        try { await fetch('/api/tasks/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: kvIdLocal, status: (data.status as string) || 'queued', job_id: data.id }) }); } catch {}
      }

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        if (!data.id) return;
        const s = await fetch(`/api/replicate/status?id=${data.id}`);
        if (!s.ok) return;
        const j = await s.json();
        const st: ReplicateStatus = j.status || 'unknown';
        if (lastStatusRef.current !== st) {
          pushLog(`Status: ${st}`);
          lastStatusRef.current = st;
        }
        setStatus(st);
        if (j.outputUrl && typeof j.outputUrl === 'string') {
          const proxied = `/api/proxy?url=${encodeURIComponent(j.outputUrl)}`;
          setOutputUrl(proxied);
        }
        // Keep task in sync
        if (taskId || createdTaskId) {
          try {
            const proxied = j.outputUrl ? `/api/proxy?url=${encodeURIComponent(j.outputUrl)}` : null;
            await supabase.from('tasks').update({ status: st as string, output_url: proxied }).eq('id', (taskId || createdTaskId) as string);
          } catch {}
        }
        if (kvIdLocal) {
          try { await fetch('/api/tasks/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: kvIdLocal, status: st as string, output_url: j.outputUrl || null }) }); } catch {}
        }
        if (st === 'succeeded' || st === 'failed' || st === 'canceled') {
          clearInterval(pollRef.current!); pollRef.current = null;
          if (j.error) pushLog(`Error: ${typeof j.error === 'string' ? j.error : JSON.stringify(j.error)}`);
        }
      }, 2000);
    } catch (e: any) {
      pushLog('Error: ' + e.message);
      setStatus('failed');
      if (taskId) {
        try { await supabase.from('tasks').update({ status: 'failed' }).eq('id', taskId); } catch {}
      }
      if (kvIdLocal || kvTaskId) {
        try { await fetch('/api/tasks/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: (kvIdLocal || kvTaskId) as string, status: 'failed' }) }); } catch {}
      }
    }
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  return (
    <div className="container">
      <div className="panel output">
        <div className="header">
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <h2 style={{margin:0}}>Output</h2>
            <span className="badge">{status.toUpperCase?.() || status}</span>
          </div>
          <div className="small">Prediction ID: {predictionId ?? '—'}</div>
        </div>
        <div className="outputArea">
          {status === 'succeeded' && outputUrl ? (
            <div>
              <video src={outputUrl} controls style={{maxWidth:'100%', maxHeight:'100%', borderRadius:12}} onError={()=> pushLog('Video failed to play. Open in new tab using the link below.')} />
              <div className="small" style={{marginTop:8}}>
                <a href={outputUrl} target="_blank" rel="noreferrer">Open output in new tab</a>
              </div>
              {/* Database functionality removed */}
            </div>
          ) : (
            <div>
              <div style={{fontSize:16, color:'#b7c2df'}}>The result will appear here.</div>
              <div className="kv" style={{marginTop:12}}>
                <div>Video URL</div><div className="small">{videoUrl ?? '—'}</div>
                <div>Audio URL</div><div className="small">{useText ? '(using text)' : (audioUrl ?? '—')}</div>
              </div>
            </div>
          )}
        </div>
        <div>
          <div style={{margin:'8px 0 6px'}}>Log</div>
          <pre className="log">{logLines.join('\n')}</pre>
        </div>
      </div>

      <div className="panel">
        <div className="header">
          <h3 style={{margin:0}}>Model Configuration</h3>
          <span className="badge">Multiple Providers</span>
        </div>

        <div className="options">
          <div style={{gridColumn: 'span 2'}}>
            <div className="small">Model</div>
            <select className="select" value={model} onChange={(e)=> setModel(e.target.value as any)}>
              <option value="kling">Kling Lip-sync (kwaivgi/kling-lip-sync)</option>
              <option value="sync2">Sync Lipsync 2.0 (sync/lipsync-2)</option>
              <option value="latentsync">LatentSync (High Quality)</option>
              <option value="sieve">Sieve Lipsync (sievesync-1.1)</option>
            </select>
          </div>
          
          {model === 'kling' && (
            <div>
              <label className="small" style={{display:'flex', gap:'var(--space-2)', alignItems:'center'}}>
                <input type="checkbox" checked={useText} onChange={(e)=> setUseText(e.target.checked)} /> Use Text-to-Speech
              </label>
            </div>
          )}
        </div>

        {/* Model-specific parameters */}
        {model === 'sync2' && (
          <div className="options">
            <div>
              <div className="small">Sync Mode</div>
              <select className="select" value={syncMode} onChange={(e)=> setSyncMode(e.target.value as any)}>
                <option value="loop">Loop</option>
                <option value="bounce">Bounce</option>
                <option value="cut_off">Cut Off</option>
                <option value="silence">Silence</option>
                <option value="remap">Remap</option>
              </select>
            </div>
            <div>
              <div className="small">Temperature</div>
              <input className="input" type="number" step={0.1} min={0} max={1} value={temperature} onChange={(e)=> setTemperature(Math.max(0, Math.min(1, Number(e.target.value))))} />
            </div>
          </div>
        )}

        {model === 'latentsync' && (
          <div className="options">
            <div>
              <div className="small">Inference Steps</div>
              <input className="input" type="number" min={1} max={50} value={inferenceSteps} onChange={(e)=> setInferenceSteps(Math.max(1, Math.min(50, Number(e.target.value))))} />
            </div>
            <div>
              <div className="small">Guidance Scale</div>
              <input className="input" type="number" step={0.5} min={1} max={20} value={guidanceScale} onChange={(e)=> setGuidanceScale(Math.max(1, Math.min(20, Number(e.target.value))))} />
            </div>
          </div>
        )}

        {model === 'sieve' && (
          <div className="options">
            <div>
              <div className="small">Enhancement</div>
              <select className="select" value={enhance} onChange={(e)=> setEnhance(e.target.value as any)}>
                <option value="default">Default</option>
                <option value="gfpgan">GFPGAN</option>
                <option value="codeformer">CodeFormer</option>
              </select>
            </div>
            <div>
              <div className="small">Cut By</div>
              <select className="select" value={cutBy} onChange={(e)=> setCutBy(e.target.value as any)}>
                <option value="audio">Audio</option>
                <option value="video">Video</option>
              </select>
            </div>
            <div>
              <label className="small" style={{display:'flex', gap:'var(--space-2)', alignItems:'center'}}>
                <input type="checkbox" checked={enableMultispeaker} onChange={(e)=> setEnableMultispeaker(e.target.checked)} /> Multi-speaker
              </label>
            </div>
            <div>
              <label className="small" style={{display:'flex', gap:'var(--space-2)', alignItems:'center'}}>
                <input type="checkbox" checked={checkQuality} onChange={(e)=> setCheckQuality(e.target.checked)} /> Quality Check
              </label>
            </div>
            <div>
              <label className="small" style={{display:'flex', gap:'var(--space-2)', alignItems:'center'}}>
                <input type="checkbox" checked={downsample} onChange={(e)=> setDownsample(e.target.checked)} /> Downsample
              </label>
            </div>
          </div>
        )}

        {model === 'kling' && useText && (
          <div className="options" style={{marginTop: 'var(--space-5)'}}>
            <div style={{gridColumn:'span 2'}}>
              <div className="small">Text to Speech</div>
              <textarea className="input" rows={4} placeholder="Type what the person should say..." value={text} onChange={(e)=> setText(e.target.value)} />
            </div>
            <div>
              <div className="small">Voice ID</div>
              <input className="input" placeholder="en_AOT" value={voiceId} onChange={(e)=> setVoiceId(e.target.value)} />
            </div>
            <div>
              <div className="small">Voice Speed</div>
              <input className="input" type="number" step={0.1} min={0.5} max={2} value={voiceSpeed} onChange={(e)=> setVoiceSpeed(Number(e.target.value))} />
            </div>
          </div>
        )}

        <div
          className={`dnd`}
          style={{marginTop: 'var(--space-5)'}}
          onDragOver={(e)=>{e.preventDefault();}}
          onDrop={(e)=>{ e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onSelectVideo(f); }}
          onClick={()=>{ const input=document.createElement('input'); input.type='file'; input.accept='video/*'; input.onchange=()=>{ const f=(input.files?.[0])||null; if (f) onSelectVideo(f); }; input.click(); }}
        >
          <div className="dnd-icon">🎬</div>
          <div className="dnd-title">Video File</div>
          <div className="dnd-subtitle">MP4/MOV • clear face • 2–10s • 720p–1080p</div>
          {videoFile && <div className="fileInfo">📹 {videoFile.name} ({Math.round(videoFile.size/1024/1024*10)/10} MB)</div>}
          {videoUrl && <div className="fileInfo">🔗 Uploaded successfully</div>}
        </div>

        {!useText && (
          <div className={`dnd`} style={{marginTop: 'var(--space-5)'}}
            onDragOver={(e)=>{e.preventDefault();}}
            onDrop={(e)=>{ e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onSelectAudio(f); }}
            onClick={()=>{ const input=document.createElement('input'); input.type='file'; input.accept='audio/*'; input.onchange=()=>{ const f=(input.files?.[0])||null; if (f) onSelectAudio(f); }; input.click(); }}
          >
            <div className="dnd-icon">🎵</div>
            <div className="dnd-title">Audio File</div>
            <div className="dnd-subtitle">WAV/MP3/M4A/AAC • &lt; 5MB</div>
            {audioFile && <div className="fileInfo">🎙️ {audioFile.name} ({Math.round(audioFile.size/1024/1024*10)/10} MB)</div>}
            {audioUrl && <div className="fileInfo">🔗 Uploaded successfully</div>}
          </div>
        )}

        <button className="btn" style={{marginTop:12}} onClick={startGeneration} disabled={!requiredReady()}>
          Generate
        </button>
      </div>
    </div>
  );
}



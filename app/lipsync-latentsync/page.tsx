'use client';

import '../globals.css';
import { useCallback, useEffect, useRef, useState } from 'react';

export default function LatentSyncPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('unknown');
  const [logLines, setLogLines] = useState<string[]>([]);
  const [inferenceSteps, setInferenceSteps] = useState<number>(30);
  const [guidanceScale, setGuidanceScale] = useState<number>(1.5);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const pushLog = (line: string) => setLogLines((prev)=>[...prev, `${new Date().toLocaleTimeString()}  ${line}`]);

  const onSelectVideo = useCallback((file: File)=> setVideoFile(file), []);
  const onSelectAudio = useCallback((file: File)=> setAudioFile(file), []);

  async function uploadIfNeeded(): Promise<{ videoUrl: string; audioUrl: string } | false> {
    if (!videoFile || !audioFile) return false;
    if (videoUrl && audioUrl) return { videoUrl, audioUrl } as { videoUrl: string; audioUrl: string };
    pushLog('Uploading files to Supabase...');
    const uploadOnce = async (file: File) => {
      const form = new FormData(); form.append('file', file); form.append('filename', file.name);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ url: string; path: string }>;
    };
    const [v, a] = await Promise.all([uploadOnce(videoFile), uploadOnce(audioFile)]);
    setVideoUrl(v.url); setAudioUrl(a.url); pushLog('Uploaded.');
    return { videoUrl: v.url, audioUrl: a.url };
  }

  async function start() {
    try {
      const urls = await uploadIfNeeded(); if (!urls) return;
      setStatus('queued'); setLogLines([]); pushLog('Pushing LatentSync job...');
      const res = await fetch('/api/latentsync/push', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: urls.videoUrl,
          audioUrl: urls.audioUrl,
          options: { inference_steps: inferenceSteps, guidance_scale: guidanceScale }
        })
      });
      if (!res.ok) { pushLog('Push failed: ' + (await res.text())); setStatus('error'); return; }
      const data = await res.json(); setJobId(data.id); pushLog(`Job created: ${data.id}`);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async ()=>{
        const s = await fetch(`/api/latentsync/status?id=${data.id}`);
        if (!s.ok) return; const j = await s.json();
        if (j.status && j.status !== status) pushLog(`Status: ${j.status}`);
        setStatus(j.status);
        if (j.status === 'succeeded' || j.status === 'failed') {
          clearInterval(pollRef.current!); pollRef.current = null;
          if (j.outputUrl) (window as any).__LATENTSYNC_OUTPUT__ = j.outputUrl;
          if (j.error) pushLog(`Error: ${JSON.stringify(j.error)}`);
        }
      }, 2500);
    } catch (e: any) { pushLog('Error: ' + e.message); setStatus('error'); }
  }

  useEffect(()=>()=>{ if (pollRef.current) clearInterval(pollRef.current); },[]);

  const outputUrl = ((): string | null => (typeof window !== 'undefined' && (window as any).__LATENTSYNC_OUTPUT__) || null)();

  return (
    <div className="container">
      <div className="panel output">
        <div className="header">
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <h2 style={{margin:0}}>Output (LatentSync)</h2>
            <span className="badge">{status}</span>
          </div>
          <div className="small">Job ID: {jobId ?? '—'}</div>
        </div>
        <div className="outputArea">
          {status === 'succeeded' && outputUrl ? (
            <video src={outputUrl} controls style={{maxWidth:'100%', maxHeight:'100%', borderRadius:12}} />
          ) : (
            <div>
              <div style={{fontSize:16, color:'#b7c2df'}}>The result will appear here.</div>
              <div className="kv" style={{marginTop:12}}>
                <div>Video URL</div><div className="small">{videoUrl ?? '—'}</div>
                <div>Audio URL</div><div className="small">{audioUrl ?? '—'}</div>
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
          <h3 style={{margin:0}}>Inputs (LatentSync)</h3>
          <span className="badge">ByteDance</span>
        </div>

        <div className={`dnd`}
          onDragOver={(e)=>{e.preventDefault();}}
          onDrop={(e)=>{ e.preventDefault(); const f=e.dataTransfer.files?.[0]; if (f) onSelectVideo(f); }}
          onClick={()=>{ const input=document.createElement('input'); input.type='file'; input.accept='video/*'; input.onchange=()=>{ const f=(input.files?.[0])||null; if (f) onSelectVideo(f); }; input.click(); }}
        >
          <div style={{fontWeight:700}}>Video</div>
          <div className="small">MP4/MOV recommended</div>
          {videoFile && <div className="fileInfo">📹 {videoFile.name} ({Math.round(videoFile.size/1024/1024*10)/10} MB)</div>}
          {videoUrl && <div className="fileInfo">🔗 Uploaded: {videoUrl}</div>}
        </div>

        <div className={`dnd`} style={{marginTop:12}}
          onDragOver={(e)=>{e.preventDefault();}}
          onDrop={(e)=>{ e.preventDefault(); const f=e.dataTransfer.files?.[0]; if (f) onSelectAudio(f); }}
          onClick={()=>{ const input=document.createElement('input'); input.type='file'; input.accept='audio/*'; input.onchange=()=>{ const f=(input.files?.[0])||null; if (f) onSelectAudio(f); }; input.click(); }}
        >
          <div style={{fontWeight:700}}>Voiceover</div>
          <div className="small">WAV/MP3 preferred</div>
          {audioFile && <div className="fileInfo">🎙️ {audioFile.name} ({Math.round(audioFile.size/1024/1024*10)/10} MB)</div>}
          {audioUrl && <div className="fileInfo">🔗 Uploaded: {audioUrl}</div>}
        </div>

        <div style={{marginTop:16, fontWeight:700}}>Options</div>
        <div className="options">
          <div>
            <div className="small">Inference steps</div>
            <input className="select" type="number" min={20} max={50} value={inferenceSteps} onChange={(e)=>setInferenceSteps(parseInt(e.target.value||'30',10))} />
          </div>
          <div>
            <div className="small">Guidance scale</div>
            <input className="select" type="number" step={0.1} min={1.0} max={3.0} value={guidanceScale} onChange={(e)=>setGuidanceScale(parseFloat(e.target.value||'1.5'))} />
          </div>
        </div>

        <button className="btn" onClick={start} disabled={!videoFile || !audioFile}>Generate (LatentSync)</button>
      </div>
    </div>
  );
}

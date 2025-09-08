'use client';

import '../globals.css';
import { useCallback, useEffect, useRef, useState } from 'react';

type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'unknown' | 'succeeded';

export default function LipsyncBetaPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus>('unknown');
  const [logLines, setLogLines] = useState<string[]>([]);
  const [useEnhancer, setUseEnhancer] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const pushLog = (line: string) =>
    setLogLines((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${line}`]);

  const onSelectVideo = useCallback(async (file: File) => { setVideoFile(file); }, []);
  const onSelectAudio = useCallback(async (file: File) => { setAudioFile(file); }, []);

  async function uploadIfNeeded(): Promise<{ videoUrl: string; audioUrl: string } | false> {
    if (!videoFile || !audioFile) return false;
    if (videoUrl && audioUrl) return { videoUrl, audioUrl } as { videoUrl: string; audioUrl: string };

    pushLog('Uploading files to Supabase...');
    const uploadOnce = async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      form.append('filename', file.name);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ url: string; path: string }>;
    };

    const [v, a] = await Promise.all([uploadOnce(videoFile), uploadOnce(audioFile)]);
    setVideoUrl(v.url); setAudioUrl(a.url);
    pushLog('Uploaded to Supabase.');
    return { videoUrl: v.url, audioUrl: a.url };
  }

  async function startBeta() {
    try {
      const urls = await uploadIfNeeded();
      if (!urls) return;
      setStatus('QUEUED'); setLogLines([]);
      pushLog('Pushing lipsync job...');
      const pushPath = '/api/lipsync-beta/push';
      const statusPath = '/api/lipsync-beta/status';

      const res = await fetch(pushPath, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: urls.videoUrl, audioUrl: urls.audioUrl })
      });
      if (!res.ok) { pushLog('Push failed: ' + (await res.text())); setStatus('FAILED'); return; }
      const data = await res.json();
      setJobId(data.id); pushLog(`Job created: ${data.id}, status=${data.status}`);

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const s = await fetch(`${statusPath}?id=${data.id}${useEnhancer ? '&enhancer=true' : ''}`);
        if (!s.ok) return;
        const j = await s.json();
        if (j.status && j.status !== status) pushLog(`Status: ${j.status}`);
        setStatus(j.status as JobStatus);
        if ((j.status === 'COMPLETED' || j.status === 'FAILED' || j.status === 'succeeded')) {
          clearInterval(pollRef.current!); pollRef.current = null;
          if ((j.status === 'COMPLETED' || j.status === 'succeeded') && j.outputUrl) {
            (window as any).__SYNC_OUTPUT_URL__ = j.outputUrl;
            if (j.upscaledUrl) (window as any).__SYNC_UPSCALED_URL__ = j.upscaledUrl;
          }
          if (j.error) pushLog(`Error: ${typeof j.error === 'string' ? j.error : JSON.stringify(j.error)}`);
          if (j.upscaledUrl) pushLog('Enhancer upscaling complete.');
        }
      }, 2500);
    } catch (e: any) {
      pushLog('Error: ' + e.message);
      setStatus('FAILED');
    }
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const outputUrl = ((): string | null => (typeof window !== 'undefined' && (window as any).__SYNC_OUTPUT_URL__) || null)();
  const upscaledUrl = ((): string | null => (typeof window !== 'undefined' && (window as any).__SYNC_UPSCALED_URL__) || null)();

  return (
    <div className="container">
      <div className="panel output">
        <div className="header">
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <h2 style={{margin:0}}>Output (BETA)</h2>
            <span className="badge">{status}</span>
          </div>
          <div className="small">Job ID: {jobId ?? '—'}</div>
        </div>
        <div className="outputArea" style={{display:'grid', gap:12}}>
          {(status === 'COMPLETED' || status === 'succeeded') && (outputUrl || upscaledUrl) ? (
            <div style={{display:'grid', gap:12}}>
              {outputUrl && (
                <div>
                  <div className="small">Base output</div>
                  <video src={outputUrl} controls style={{maxWidth:'100%', maxHeight:'100%', borderRadius:12}} />
                </div>
              )}
              {upscaledUrl && (
                <div>
                  <div className="small">Upscaled (ENHANCER)</div>
                  <video src={upscaledUrl} controls style={{maxWidth:'100%', maxHeight:'100%', borderRadius:12}} />
                </div>
              )}
            </div>
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
          <h3 style={{margin:0}}>Inputs (BETA)</h3>
          <span className="badge">Sync.so</span>
        </div>
        <label className="small" style={{display:'flex', gap:8, alignItems:'center', marginBottom:8}}>
          <input type="checkbox" checked={useEnhancer} onChange={(e)=>setUseEnhancer(e.target.checked)} /> ENHANCER (show both)
        </label>
        <div
          className={`dnd ${videoFile ? '' : ''}`}
          onDragOver={(e)=>{e.preventDefault();}}
          onDrop={(e)=>{ e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setVideoFile(f); }}
          onClick={()=>{ const input=document.createElement('input'); input.type='file'; input.accept='video/*'; input.onchange=()=>{ const f=(input.files?.[0])||null; if (f) setVideoFile(f); }; input.click(); }}
        >
          <div style={{fontWeight:700}}>Video</div>
          <div className="small">MP4/MOV recommended</div>
          {videoFile && <div className="fileInfo">📹 {videoFile.name} ({Math.round(videoFile.size/1024/1024*10)/10} MB)</div>}
          {videoUrl && <div className="fileInfo">🔗 Uploaded: {videoUrl}</div>}
        </div>

        <div className={`dnd`} style={{marginTop:12}}
          onDragOver={(e)=>{e.preventDefault();}}
          onDrop={(e)=>{ e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setAudioFile(f); }}
          onClick={()=>{ const input=document.createElement('input'); input.type='file'; input.accept='audio/*'; input.onchange=()=>{ const f=(input.files?.[0])||null; if (f) setAudioFile(f); }; input.click(); }}
        >
          <div style={{fontWeight:700}}>Voiceover</div>
          <div className="small">WAV/MP3 preferred</div>
          {audioFile && <div className="fileInfo">🎙️ {audioFile.name} ({Math.round(audioFile.size/1024/1024*10)/10} MB)</div>}
          {audioUrl && <div className="fileInfo">🔗 Uploaded: {audioUrl}</div>}
        </div>

        <button className="btn" onClick={startBeta} disabled={!videoFile || !audioFile}>Generate (BETA)</button>
      </div>
    </div>
  );
}

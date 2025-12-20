'use client';

import '../globals.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';

type JobStatus = 'queued' | 'running' | 'finished' | 'error' | 'cancelled' | 'unknown';

export default function LipsyncPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const [dragVideo, setDragVideo] = useState(false);
  const [dragAudio, setDragAudio] = useState(false);

  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus>('unknown');
  const [logLines, setLogLines] = useState<string[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);

  // Engine selection: 'sieve' (current), 'sync' (lipsync-2-pro), or 'wan' (Wan 2.2 S2V)
  const [engine, setEngine] = useState<'sieve' | 'sync' | 'wan'>('sieve');
  const [backend, setBackend] = useState('sievesync-1.1');
  const [enhance, setEnhance] = useState<'default' | 'none'>('default');
  const [cutBy, setCutBy] = useState<'audio' | 'video' | 'shortest'>('audio');
  const [enableMultispeaker, setEnableMultispeaker] = useState(false);
  const [checkQuality, setCheckQuality] = useState(false);
  const [downsample, setDownsample] = useState(false);

  // Sync (lipsync-2-pro) specific options
  const [syncMode, setSyncMode] = useState<'loop' | 'bounce' | 'cut_off' | 'silence' | 'remap'>('loop');
  const [temperature, setTemperature] = useState<number>(0.5);
  const [activeSpeaker, setActiveSpeaker] = useState<boolean>(false);

  // Wan 2.2 S2V specific options
  const [wanPrompt, setWanPrompt] = useState<string>('person speaking');
  const [wanNumFramesPerChunk, setWanNumFramesPerChunk] = useState<number>(81);
  const [wanSeed, setWanSeed] = useState<string>('');
  const [wanInterpolate, setWanInterpolate] = useState<boolean>(false);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<JobStatus | null>(null);

  const pushLog = (line: string) =>
    setLogLines((previousLogLines) => {
      const timestamp = new Date().toLocaleTimeString();
      const formattedLine = `${timestamp}  ${line}`;
      return [...previousLogLines, formattedLine];
    });

  const onSelectVideo = useCallback(async (file: File) => {
    setVideoFile(file);
  }, []);

  const onSelectAudio = useCallback(async (file: File) => {
    setAudioFile(file);
  }, []);

  async function uploadIfNeeded(): Promise<{ videoUrl: string; audioUrl: string } | false> {
    if (!videoFile || !audioFile) return false;

    if (videoUrl && audioUrl) return { videoUrl, audioUrl } as { videoUrl: string; audioUrl: string };

    pushLog('Uploading files to Supabase...');

    const uploadOnce = async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      form.append('filename', file.name);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'upload failed');
      }
      return res.json() as Promise<{ url: string; path: string }>;
    };

    const [v, a] = await Promise.all([uploadOnce(videoFile), uploadOnce(audioFile)]);

    setVideoUrl(v.url);
    setAudioUrl(a.url);
    pushLog('Uploaded to Supabase.');
    return { videoUrl: v.url, audioUrl: a.url };
  }

  async function startLipsync() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { pushLog('Please sign in at /auth before creating a task.'); return; }

      const urls = await uploadIfNeeded();
      if (!urls) return;

      setStatus('queued');
      setLogLines([]);
      pushLog('Creating task...');

      const options = engine === 'sieve' ? {
        backend,
        enable_multispeaker: enableMultispeaker,
        enhance,
        check_quality: checkQuality,
        downsample,
        cut_by: cutBy,
      } : engine === 'sync' ? {
        sync_mode: syncMode,
        temperature,
        active_speaker: activeSpeaker,
      } : {
        // Wan options
        prompt: wanPrompt,
        num_frames_per_chunk: wanNumFramesPerChunk,
        seed: wanSeed ? Number(wanSeed) : undefined,
        interpolate: wanInterpolate,
      };

      // Database operations removed - proceeding directly to job creation
      const taskId = Date.now().toString(); // Generate local task ID
      setTaskId(taskId);
      pushLog(`Task created. Pushing lipsync job to ${engine === 'sieve' ? 'Sieve' : engine === 'sync' ? 'Sync' : 'Wan 2.2 S2V'}...`);

      if (engine === 'sieve') {
      const res = await fetch('/api/lipsync/push', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          videoUrl: urls.videoUrl,
          audioUrl: urls.audioUrl,
          options,
        })
      });

      if (!res.ok) {
        const text = await res.text();
        pushLog('Push failed: ' + text);
        setStatus('error');
        // Database operations removed
        return;
      }
      const data = await res.json();
      setJobId(data.id);
      setStatus(data.status as JobStatus);
      pushLog(`Job created: ${data.id}, status=${data.status}`);
      // Database operations removed

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        if (!data.id) return;
        const s = await fetch(`/api/lipsync/status?id=${data.id}`);
        if (!s.ok) return;
        const j = await s.json();
        if (lastStatusRef.current !== j.status) {
          pushLog(`Status: ${j.status}`);
          lastStatusRef.current = j.status;
        }
        if (j.error) {
          pushLog(`Error detail: ${typeof j.error === 'string' ? j.error : JSON.stringify(j.error)}`);
        }
        if (Array.isArray(j.logs) && j.logs.length) {
          pushLog(`Logs: ${JSON.stringify(j.logs.slice(-3))}`);
        }
        setStatus(j.status as JobStatus);
        if (j.status === 'finished' || j.status === 'error' || j.status === 'cancelled') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
        }
        if (j.outputs) {
          (window as any).__SIEVE_OUTPUTS__ = j.outputs;
          const outUrl = (() => {
            for (const o of j.outputs) {
              if (o?.data?.url && typeof o.data.url === 'string') return o.data.url;
              if (o?.url && typeof o.url === 'string') return o.url;
            }
            return null;
          })();
          // Database operations removed
        } else {
          // Database operations removed
        }
      }, 1800);
      } else if (engine === 'sync') {
        // Run via Sync API (avoids Replicate's .proxy-api-key requirement inside the container)
        const res = await fetch('/api/lipsync-beta/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoUrl: urls.videoUrl,
            audioUrl: urls.audioUrl,
            model: 'lipsync-2-pro',
            options: {
              sync_mode: syncMode,
              temperature,
              active_speaker: activeSpeaker
            }
          })
        });

        if (!res.ok) {
          const text = await res.text();
          pushLog('Push failed: ' + text);
          setStatus('error');
          // Database operations removed
          return;
        }
        const data = await res.json();
        setJobId(data.id);
        const initialStatus: JobStatus = 'queued';
        setStatus(initialStatus);
        pushLog(`Job created: ${data.id}, status=${data.status || initialStatus}`);
        // Database operations removed

        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          if (!data.id) return;
          const s = await fetch(`/api/lipsync-beta/status?id=${data.id}`);
          if (!s.ok) return;
          const j = await s.json();
          const mapped: JobStatus = j.status === 'COMPLETED' || j.status === 'succeeded' ? 'finished'
            : j.status === 'FAILED' ? 'error'
            : j.status === 'PROCESSING' ? 'running'
            : j.status === 'QUEUED' ? 'queued'
            : (j.status as JobStatus);
          if (lastStatusRef.current !== mapped) {
            pushLog(`Status: ${mapped}`);
            lastStatusRef.current = mapped;
          }
          setStatus(mapped as JobStatus);
          if (mapped === 'finished' || mapped === 'error') {
            clearInterval(pollRef.current!);
            pollRef.current = null;
          }
          if ((j.outputUrl || j.upscaledUrl)) {
            (window as any).__SYNC_OUTPUT_URL__ = j.upscaledUrl || j.outputUrl;
            const outUrl = j.upscaledUrl || j.outputUrl || null;
            // Database operations removed
          } else {
            // Database operations removed
          }
          if (j.error) {
            pushLog(`Error detail: ${typeof j.error === 'string' ? j.error : JSON.stringify(j.error)}`);
          }
        }, 2000);
      } else {
        // Wan 2.2 S2V via Replicate
        const res = await fetch('/api/replicate/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'wan-video/wan-2.2-s2v',
            input: {
              prompt: wanPrompt,
              image: urls.videoUrl,  // Wan uses 'image' param for first frame
              audio: urls.audioUrl,
              num_frames_per_chunk: wanNumFramesPerChunk,
              seed: wanSeed ? Number(wanSeed) : undefined,
              interpolate: wanInterpolate,
            }
          })
        });

        if (!res.ok) {
          const text = await res.text();
          pushLog('Push failed: ' + text);
          setStatus('error');
          return;
        }
        const data = await res.json();
        setJobId(data.id);
        setStatus('queued');
        pushLog(`Job created: ${data.id}, checking status...`);

        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          if (!data.id) return;
          const s = await fetch(`/api/replicate/status?id=${data.id}`);
          if (!s.ok) return;
          const j = await s.json();
          const mapped: JobStatus = j.status === 'succeeded' ? 'finished'
            : j.status === 'failed' ? 'error'
            : j.status === 'processing' || j.status === 'starting' ? 'running'
            : (j.status as JobStatus);
          if (lastStatusRef.current !== mapped) {
            pushLog(`Status: ${mapped}`);
            lastStatusRef.current = mapped;
          }
          setStatus(mapped as JobStatus);
          if (mapped === 'finished' || mapped === 'error') {
            clearInterval(pollRef.current!);
            pollRef.current = null;
          }
          if (j.outputUrl) {
            (window as any).__WAN_OUTPUT_URL__ = j.outputUrl;
            pushLog(`Output ready: ${j.outputUrl}`);
          }
          if (j.error) {
            pushLog(`Error detail: ${typeof j.error === 'string' ? j.error : JSON.stringify(j.error)}`);
          }
        }, 3000);
      }
    } catch (e: any) {
      pushLog('Error: ' + e.message);
      setStatus('error');
    }
  }

  const finishedVideoUrl = ((): string | null => {
    const w = (typeof window !== 'undefined') ? (window as any) : null;
    const outputs = w && w.__SIEVE_OUTPUTS__ || null;
    const syncOut = w && (w.__SYNC_OUTPUT_URL__ as string | null) || null;
    const wanOut = w && (w.__WAN_OUTPUT_URL__ as string | null) || null;
    if (wanOut) return wanOut;
    if (syncOut) return syncOut;
    if (!outputs) return null;
    for (const o of outputs) {
      if (o?.data?.url && typeof o.data.url === 'string') return o.data.url;
      if (o?.url && typeof o.url === 'string') return o.url;
    }
    return null;
  })();

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  return (
    <div className="container">
      <div className="panel output">
        <div className="header">
          <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
            <h2 style={{margin:0}}>Output</h2>
            <span className="badge">{status.toUpperCase()}</span>
          </div>
          <div className="small mobile-hide">Job ID: {jobId ?? '—'}</div>
        </div>

        <div className="outputArea">
          {status === 'finished' && finishedVideoUrl ? (
            <div>
              {(() => {
                const proxied = `/api/proxy?type=video&url=${encodeURIComponent(String(finishedVideoUrl))}`;
                return (
                  <div>
                    <video controls preload="metadata" playsInline style={{maxWidth:'100%', maxHeight:'100%', borderRadius:12}}>
                      <source src={proxied} type="video/mp4" />
                      <source src={finishedVideoUrl} />
                    </video>
                    <div className="small" style={{ marginTop: 8, display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
                      <a href={proxied} target="_blank" rel="noreferrer" style={{padding:'8px 12px', background:'var(--panel-elevated)', borderRadius:'6px', textDecoration:'none'}}>Open via proxy</a>
                      <a href={finishedVideoUrl} target="_blank" rel="noreferrer" style={{padding:'8px 12px', background:'var(--panel-elevated)', borderRadius:'6px', textDecoration:'none'}}>Open direct</a>
                      <a href={`${proxied}&download=true`} style={{padding:'8px 12px', background:'var(--accent)', color:'white', borderRadius:'6px', textDecoration:'none'}}>Download</a>
                    </div>
                  </div>
                );
              })()}
              {/* Database functionality removed */}
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
          <h3 style={{margin:0}}>Inputs</h3>
          <span className="badge">Drag & Drop</span>
        </div>

        <div
          className={`dnd ${dragVideo ? 'drag' : ''}`}
          onDragOver={(e)=>{e.preventDefault(); setDragVideo(true);}}
          onDragLeave={(e)=>{e.preventDefault(); setDragVideo(false);}}
          onDrop={(e)=>{
            e.preventDefault();
            setDragVideo(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onSelectVideo(f);
          }}
          onClick={()=>{
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'video/*';
            input.onchange = ()=>{
              const f = (input.files?.[0]) || null;
              if (f) onSelectVideo(f);
            };
            input.click();
          }}
        >
          <div style={{fontWeight:700}}>Video</div>
          <div className="small">MP4/MOV recommended • clear face, single speaker</div>
          {videoFile && <div className="fileInfo">📹 {videoFile.name} ({Math.round(videoFile.size/1024/1024*10)/10} MB)</div>}
          {videoUrl && <div className="fileInfo">🔗 Uploaded: {videoUrl}</div>}
        </div>

        <div
          className={`dnd ${dragAudio ? 'drag' : ''}`}
          style={{marginTop:12}}
          onDragOver={(e)=>{e.preventDefault(); setDragAudio(true);}}
          onDragLeave={(e)=>{e.preventDefault(); setDragAudio(false);}}
          onDrop={(e)=>{
            e.preventDefault();
            setDragAudio(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onSelectAudio(f);
          }}
          onClick={()=>{
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'audio/*';
            input.onchange = ()=>{
              const f = (input.files?.[0]) || null;
              if (f) onSelectAudio(f);
            };
            input.click();
          }}
        >
          <div style={{fontWeight:700}}>Voiceover</div>
          <div className="small">WAV/MP3 preferred • same language & pacing</div>
          {audioFile && <div className="fileInfo">🎙️ {audioFile.name} ({Math.round(audioFile.size/1024/1024*10)/10} MB)</div>}
          {audioUrl && <div className="fileInfo">🔗 Uploaded: {audioUrl}</div>}
        </div>

        <div style={{marginTop:16, fontWeight:700}}>Options</div>
        <div className="options">
          <div style={{gridColumn: 'span 2'}}>
            <div className="small">Engine</div>
            <select className="select" value={engine} onChange={(e)=>setEngine(e.target.value as 'sieve' | 'sync' | 'wan')}>
              <option value="sieve">Sieve (current)</option>
              <option value="sync">Sync lipsync-2-pro (new)</option>
              <option value="wan">Wan 2.2 S2V (audio-driven cinematic video) 🌟</option>
            </select>
          </div>
          {engine === 'sieve' ? (
            <>
          <div>
            <div className="small">Backend</div>
            <select className="select" value={backend} onChange={(e)=>setBackend(e.target.value)}>
              <option value="sievesync-1.1">sievesync-1.1 (recommended)</option>
              <option value="sync-2.0">sync-2.0</option>
              <option value="sync-1.9.0-beta">sync-1.9.0-beta</option>
              <option value="hummingbird">hummingbird</option>
              <option value="latentsync">latentsync</option>
              <option value="sievesync">sievesync</option>
              <option value="musetalk">musetalk</option>
              <option value="video_retalking">video_retalking</option>
            </select>
          </div>
          <div>
            <div className="small">Enhance</div>
            <select className="select" value={enhance} onChange={(e)=>setEnhance(e.target.value as 'default' | 'none')}>
              <option value="default">default</option>
              <option value="none">none</option>
            </select>
          </div>
          <div className="row">
            <label className="small" style={{display:'flex', gap:8, alignItems:'center'}}>
              <input type="checkbox" checked={enableMultispeaker} onChange={(e)=>setEnableMultispeaker(e.target.checked)} /> multispeaker
            </label>
            <label className="small" style={{display:'flex', gap:8, alignItems:'center'}}>
              <input type="checkbox" checked={checkQuality} onChange={(e)=>setCheckQuality(e.target.checked)} /> check quality
            </label>
          </div>
          <div className="row">
            <label className="small" style={{display:'flex', gap:8, alignItems:'center'}}>
              <input type="checkbox" checked={downsample} onChange={(e)=>setDownsample(e.target.checked)} /> downsample (720p)
            </label>
          </div>
          <div>
            <div className="small">Cut by</div>
            <select className="select" value={cutBy} onChange={(e)=>setCutBy(e.target.value as any)}>
              <option value="audio">audio</option>
              <option value="video">video</option>
              <option value="shortest">shortest</option>
            </select>
          </div>
            </>
          ) : engine === 'sync' ? (
            <>
              <div>
                <div className="small">sync_mode</div>
                <select className="select" value={syncMode} onChange={(e)=>setSyncMode(e.target.value as any)}>
                  <option value="loop">loop</option>
                  <option value="bounce">bounce</option>
                  <option value="cut_off">cut_off</option>
                  <option value="silence">silence</option>
                  <option value="remap">remap</option>
                </select>
              </div>
              <div>
                <div className="small">temperature (0-1)</div>
                <input className="select" type="number" step="0.1" min={0} max={1} value={temperature} onChange={(e)=>setTemperature(Math.max(0, Math.min(1, Number(e.target.value))))} />
              </div>
              <div className="row">
                <label className="small" style={{display:'flex', gap:8, alignItems:'center'}}>
                  <input type="checkbox" checked={activeSpeaker} onChange={(e)=>setActiveSpeaker(e.target.checked)} /> active_speaker
                </label>
              </div>
            </>
          ) : (
            <>
              {/* Wan 2.2 S2V options */}
              <div style={{gridColumn: 'span 2'}}>
                <div className="small">Prompt (describe the video content)</div>
                <input 
                  className="select" 
                  type="text" 
                  value={wanPrompt} 
                  onChange={(e)=>setWanPrompt(e.target.value)} 
                  placeholder="e.g., woman singing, man speaking, etc."
                />
              </div>
              <div>
                <div className="small">Frames per chunk</div>
                <input 
                  className="select" 
                  type="number" 
                  value={wanNumFramesPerChunk} 
                  onChange={(e)=>setWanNumFramesPerChunk(Number(e.target.value))} 
                  min={1}
                  max={200}
                />
              </div>
              <div>
                <div className="small">Seed (optional, leave empty for random)</div>
                <input 
                  className="select" 
                  type="text" 
                  value={wanSeed} 
                  onChange={(e)=>setWanSeed(e.target.value)} 
                  placeholder="Random"
                />
              </div>
              <div className="row">
                <label className="small" style={{display:'flex', gap:8, alignItems:'center'}}>
                  <input 
                    type="checkbox" 
                    checked={wanInterpolate} 
                    onChange={(e)=>setWanInterpolate(e.target.checked)} 
                  /> interpolate to 25fps
                </label>
              </div>
            </>
          )}
        </div>

        <button className="btn"
          onClick={startLipsync}
          disabled={!videoFile || !audioFile}
        >
          Lipsync it
        </button>

        <div className="small" style={{marginTop:8}}>
          Tip: clear, front‑facing face; single speaker works best.
        </div>
      </div>
    </div>
  );
}

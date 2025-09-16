'use client';

import '../globals.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';

type JobStatus = 'queued' | 'running' | 'finished' | 'error' | 'cancelled' | 'unknown';
type GenerationMode = 'image-to-video' | 'video-to-video';

export default function InfiniteTalkPage() {
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [inputUrl, setInputUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const [dragInput, setDragInput] = useState(false);
  const [dragAudio, setDragAudio] = useState(false);

  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus>('unknown');
  const [logLines, setLogLines] = useState<string[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);

  // InfiniteTalk specific options (Wavespeed API)
  const [generationMode, setGenerationMode] = useState<GenerationMode>('image-to-video');
  const [resolution, setResolution] = useState<'480' | '720'>('480');
  const [prompt, setPrompt] = useState('');
  const [seed, setSeed] = useState(-1);
  const [maskImage, setMaskImage] = useState<File | null>(null);
  const [maskImageUrl, setMaskImageUrl] = useState<string | null>(null);
  
  // Legacy options (kept for UI compatibility)
  const [streamingMode, setStreamingMode] = useState(true);
  const [sampleSteps, setSampleSteps] = useState(40);
  const [motionFrame, setMotionFrame] = useState(9);
  const [maxFrameNum, setMaxFrameNum] = useState(1000);
  const [useTeaCache, setUseTeaCache] = useState(false);
  const [useApg, setUseApg] = useState(false);
  const [teaCacheThresh, setTeaCacheThresh] = useState(0.5);
  const [textGuideScale, setTextGuideScale] = useState(5.0);
  const [audioGuideScale, setAudioGuideScale] = useState(4.0);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<JobStatus | null>(null);

  const pushLog = (line: string) =>
    setLogLines((previousLogLines) => {
      const timestamp = new Date().toLocaleTimeString();
      const formattedLine = `${timestamp}  ${line}`;
      return [...previousLogLines, formattedLine];
    });

  const onSelectInput = useCallback(async (file: File) => {
    setInputFile(file);
  }, []);

  const onSelectAudio = useCallback(async (file: File) => {
    setAudioFile(file);
  }, []);

  async function uploadIfNeeded(): Promise<{ inputUrl: string; audioUrl: string } | false> {
    if (!inputFile || !audioFile) return false;

    if (inputUrl && audioUrl) return { inputUrl, audioUrl } as { inputUrl: string; audioUrl: string };

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

    const [input, audio] = await Promise.all([uploadOnce(inputFile), uploadOnce(audioFile)]);

    setInputUrl(input.url);
    setAudioUrl(audio.url);
    pushLog('Uploaded to Supabase.');
    return { inputUrl: input.url, audioUrl: audio.url };
  }

  async function startInfiniteTalk() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { pushLog('Please sign in at /auth before creating a task.'); return; }

      const urls = await uploadIfNeeded();
      if (!urls) return;

      setStatus('queued');
      setLogLines([]);
      pushLog('Creating InfiniteTalk task...');

      const options = {
        // Wavespeed InfiniteTalk API parameters
        prompt: prompt,
        resolution: resolution,
        seed: seed,
        mask_image: maskImageUrl,
        generation_mode: generationMode,
        
        // Legacy options (kept for backward compatibility)
        mode: streamingMode ? 'streaming' : 'clip',
        size: `infinitetalk-${resolution}`,
        sample_steps: sampleSteps,
        motion_frame: motionFrame,
        max_frame_num: maxFrameNum,
        use_teacache: useTeaCache,
        use_apg: useApg,
        teacache_thresh: teaCacheThresh,
        sample_text_guide_scale: textGuideScale,
        sample_audio_guide_scale: audioGuideScale,
      };

      const taskId = Date.now().toString();
      setTaskId(taskId);
      pushLog(`Task created. Starting InfiniteTalk generation...`);

      const res = await fetch('/api/infinite-talk/push', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          inputUrl: urls.inputUrl,
          audioUrl: urls.audioUrl,
          options,
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
      setStatus(data.status as JobStatus);
      pushLog(`Job created: ${data.id}, status=${data.status}`);

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        if (!data.id) return;
        const s = await fetch(`/api/infinite-talk/status?id=${data.id}`);
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
        // Keep polling a bit after finished until outputs contain a playable URL
        const shouldStop = (j.status === 'error' || j.status === 'cancelled') || (j.status === 'finished' && Array.isArray(j.outputs) && j.outputs.length > 0);
        if (shouldStop) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
        }
        if (j.outputs) {
          (window as any).__INFINITE_TALK_OUTPUTS__ = j.outputs;
          const outUrl = (() => {
            for (const o of j.outputs) {
              if (o?.data?.url && typeof o.data.url === 'string') return o.data.url;
              if (o?.url && typeof o.url === 'string') return o.url;
            }
            return null;
          })();
        }
      }, 1800);
    } catch (e: any) {
      pushLog('Error: ' + e.message);
      setStatus('error');
    }
  }

  const finishedVideoUrl = ((): string | null => {
    const w = (typeof window !== 'undefined') ? (window as any) : null;
    const outputs = w && w.__INFINITE_TALK_OUTPUTS__ || null;
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

  const inputFileType = generationMode === 'image-to-video' ? 'image/*' : 'video/*';
  const inputLabel = generationMode === 'image-to-video' ? 'Image' : 'Video';
  const inputIcon = generationMode === 'image-to-video' ? '🖼️' : '📹';
  const inputDescription = generationMode === 'image-to-video' 
    ? 'JPG/PNG preferred • clear face visible'
    : 'MP4/MOV recommended • clear face, single speaker';

  return (
    <div className="container">
      <div className="panel output">
        <div className="header">
          <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
            <h2 style={{margin:0}}>InfiniteTalk Output</h2>
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
            </div>
          ) : (
            <div>
              <div style={{fontSize:16, color:'#b7c2df'}}>The generated infinite talking video will appear here.</div>
              <div className="kv" style={{marginTop:12}}>
                <div>{inputLabel} URL</div><div className="small">{inputUrl ?? '—'}</div>
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
          <h3 style={{margin:0}}>InfiniteTalk Generation</h3>
          <span className="badge">Unlimited Length Talking Video</span>
        </div>

        <div style={{marginBottom:16}}>
          <div className="small">Generation Mode</div>
          <select className="select" value={generationMode} onChange={(e)=>setGenerationMode(e.target.value as GenerationMode)}>
            <option value="image-to-video">Image to Video (I2V)</option>
            <option value="video-to-video">Video to Video (V2V)</option>
          </select>
        </div>

        <div
          className={`dnd ${dragInput ? 'drag' : ''}`}
          onDragOver={(e)=>{e.preventDefault(); setDragInput(true);}}
          onDragLeave={(e)=>{e.preventDefault(); setDragInput(false);}}
          onDrop={(e)=>{
            e.preventDefault();
            setDragInput(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onSelectInput(f);
          }}
          onClick={()=>{
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = inputFileType;
            input.onchange = ()=>{
              const f = (input.files?.[0]) || null;
              if (f) onSelectInput(f);
            };
            input.click();
          }}
        >
          <div style={{fontWeight:700}}>{inputLabel}</div>
          <div className="small">{inputDescription}</div>
          {inputFile && <div className="fileInfo">{inputIcon} {inputFile.name} ({Math.round(inputFile.size/1024/1024*10)/10} MB)</div>}
          {inputUrl && <div className="fileInfo">🔗 Uploaded: {inputUrl}</div>}
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
          <div style={{fontWeight:700}}>Audio</div>
          <div className="small">WAV/MP3 preferred • speech audio for lip sync</div>
          {audioFile && <div className="fileInfo">🎙️ {audioFile.name} ({Math.round(audioFile.size/1024/1024*10)/10} MB)</div>}
          {audioUrl && <div className="fileInfo">🔗 Uploaded: {audioUrl}</div>}
        </div>

        <div style={{marginTop:16, fontWeight:700}}>InfiniteTalk Options</div>
        <div className="options">
          <div style={{gridColumn: 'span 2'}}>
            <div className="small">Prompt (optional)</div>
            <input 
              className="select" 
              type="text" 
              placeholder="Describe the video style or specific requirements..." 
              value={prompt} 
              onChange={(e)=>setPrompt(e.target.value)} 
            />
          </div>
          <div>
            <div className="small">Resolution</div>
            <select className="select" value={resolution} onChange={(e)=>setResolution(e.target.value as '480' | '720')}>
              <option value="480">480P (faster)</option>
              <option value="720">720P (higher quality)</option>
            </select>
          </div>
          <div>
            <div className="small">Seed (-1 = random)</div>
            <input 
              className="select" 
              type="number" 
              min={-1} 
              max={2147483647} 
              value={seed} 
              onChange={(e)=>setSeed(Number(e.target.value))} 
            />
          </div>
          <div>
            <div className="small">Sample Steps</div>
            <input className="select" type="number" min={1} max={100} value={sampleSteps} onChange={(e)=>setSampleSteps(Number(e.target.value))} />
          </div>
          <div>
            <div className="small">Motion Frame</div>
            <input className="select" type="number" min={1} max={20} value={motionFrame} onChange={(e)=>setMotionFrame(Number(e.target.value))} />
          </div>
          <div>
            <div className="small">Max Frame Count</div>
            <input className="select" type="number" min={100} max={5000} value={maxFrameNum} onChange={(e)=>setMaxFrameNum(Number(e.target.value))} />
          </div>
          <div>
            <div className="small">Text Guide Scale</div>
            <input className="select" type="number" step="0.1" min={0.1} max={10} value={textGuideScale} onChange={(e)=>setTextGuideScale(Number(e.target.value))} />
          </div>
          <div>
            <div className="small">Audio Guide Scale</div>
            <input className="select" type="number" step="0.1" min={0.1} max={10} value={audioGuideScale} onChange={(e)=>setAudioGuideScale(Number(e.target.value))} />
          </div>
          <div className="row">
            <label className="small" style={{display:'flex', gap:8, alignItems:'center'}}>
              <input type="checkbox" checked={streamingMode} onChange={(e)=>setStreamingMode(e.target.checked)} /> Streaming Mode
            </label>
            <label className="small" style={{display:'flex', gap:8, alignItems:'center'}}>
              <input type="checkbox" checked={useTeaCache} onChange={(e)=>setUseTeaCache(e.target.checked)} /> Use TeaCache
            </label>
          </div>
          <div className="row">
            <label className="small" style={{display:'flex', gap:8, alignItems:'center'}}>
              <input type="checkbox" checked={useApg} onChange={(e)=>setUseApg(e.target.checked)} /> Use APG
            </label>
          </div>
          {useTeaCache && (
            <div>
              <div className="small">TeaCache Threshold</div>
              <input className="select" type="number" step="0.1" min={0.1} max={1} value={teaCacheThresh} onChange={(e)=>setTeaCacheThresh(Number(e.target.value))} />
            </div>
          )}
        </div>

        <button className="btn"
          onClick={startInfiniteTalk}
          disabled={!inputFile || !audioFile}
        >
          Generate InfiniteTalk Video
        </button>

        <div className="small" style={{marginTop:8}}>
          Tip: Use clear audio and well-lit {generationMode === 'image-to-video' ? 'images' : 'videos'} with visible faces for best results.
        </div>
      </div>
    </div>
  );
}

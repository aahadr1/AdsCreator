'use client';

import '../globals.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createFFmpeg, fetchFile, type FFmpeg } from '@ffmpeg/ffmpeg';
import { supabaseClient as supabase } from '../../lib/supabaseClient';
import AddToDatabaseButton from '../../components/AddToDatabaseButton';

type ReplicateStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'queued' | 'unknown';

export default function LipsyncNewPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const [videoDurationSec, setVideoDurationSec] = useState<number | null>(null);
  const [audioDurationSec, setAudioDurationSec] = useState<number | null>(null);
  const [videoOverLimit, setVideoOverLimit] = useState(false);
  const [audioOverLimit, setAudioOverLimit] = useState(false);
  const [trimVideoTo60, setTrimVideoTo60] = useState(false);
  const [trimAudioTo60, setTrimAudioTo60] = useState(false);

  // Manual trim selections (start positions); the output duration is min(60, remaining)
  const [videoStartSec, setVideoStartSec] = useState<number>(0);
  const [audioStartSec, setAudioStartSec] = useState<number>(0);

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

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<ReplicateStatus | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const pushLog = (line: string) => setLogLines((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${line}`]);

  const getMediaDuration = useCallback(async (file: File): Promise<number> => {
    const url = URL.createObjectURL(file);
    const isVideo = (file.type || '').startsWith('video');
    const el = document.createElement(isVideo ? 'video' : 'audio');
    el.preload = 'metadata';
    return new Promise<number>((resolve) => {
      const cleanup = () => URL.revokeObjectURL(url);
      el.onloadedmetadata = () => {
        const d = Number(el.duration);
        cleanup();
        resolve(Number.isFinite(d) ? d : 0);
      };
      el.onerror = () => { cleanup(); resolve(0); };
      el.src = url;
    });
  }, []);

  const onSelectVideo = useCallback(async (file: File) => {
    setVideoFile(file);
    const d = await getMediaDuration(file);
    setVideoDurationSec(d);
    const over = d > 60.01;
    setVideoOverLimit(over);
    setTrimVideoTo60(over ? true : false);
  }, [getMediaDuration]);

  const onSelectAudio = useCallback(async (file: File) => {
    setAudioFile(file);
    const d = await getMediaDuration(file);
    setAudioDurationSec(d);
    const over = d > 60.01;
    setAudioOverLimit(over);
    setTrimAudioTo60(over ? true : false);
  }, [getMediaDuration]);

  const ensureFfmpeg = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current;
    const versionTag = (process.env.NEXT_PUBLIC_FFMPEG_CORE_VERSION as string) || '0.11.0';
    const candidates = [
      (process.env.NEXT_PUBLIC_FFMPEG_CORE_URL as string) || '',
      `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${versionTag}/dist/ffmpeg-core.js`,
      `https://unpkg.com/@ffmpeg/core@${versionTag}/dist/ffmpeg-core.js`,
    ].filter(Boolean) as string[];

    let lastError: any = null;
    for (const url of candidates) {
      try {
        pushLog(`Loading FFmpeg core from: ${url}`);
        const ff = createFFmpeg({ log: false, corePath: url });
        await ff.load();
        ffmpegRef.current = ff;
        pushLog('FFmpeg loaded.');
        return ff;
      } catch (e: any) {
        lastError = e;
        pushLog(`FFmpeg load failed for ${url}: ${e?.message || e}`);
      }
    }
    throw new Error(lastError?.message || 'Failed to load FFmpeg');
  }, [pushLog]);

  const getExtension = (file: File): string => {
    const nameExt = (file.name.split('.').pop() || '').toLowerCase();
    if (nameExt) return nameExt;
    if ((file.type || '').includes('mp4')) return 'mp4';
    if ((file.type || '').includes('quicktime') || (file.type || '').includes('mov')) return 'mov';
    if ((file.type || '').includes('wav')) return 'wav';
    if ((file.type || '').includes('mpeg')) return 'mp3';
    return 'dat';
  };

  const trimTo60Seconds = useCallback(async (file: File, kind: 'video' | 'audio', startSeconds: number = 0): Promise<File> => {
    const ff = await ensureFfmpeg();
    const ext = getExtension(file);
    const inputName = `input.${ext}`;
    const outputName = `output.${ext}`;
    ff.FS('writeFile', inputName, await fetchFile(file));
    const startArg = Math.max(0, Math.floor(Number.isFinite(startSeconds) ? startSeconds : 0)).toString();
    await ff.run('-ss', startArg, '-t', '60', '-i', inputName, '-c', 'copy', outputName);
    const data = ff.FS('readFile', outputName);
    const trimmedBlob = new Blob([data.buffer], { type: file.type || (kind === 'video' ? 'video/mp4' : 'audio/wav') });
    const outFile = new File([trimmedBlob], file.name.replace(/(\.[^.]+)?$/, '_trimmed$1'), { type: trimmedBlob.type });
    try { ff.FS('unlink', inputName); } catch {}
    try { ff.FS('unlink', outputName); } catch {}
    return outFile;
  }, [ensureFfmpeg]);

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

    let fileToUploadVideo = videoFile;
    if ((videoOverLimit && trimVideoTo60) || (typeof videoDurationSec === 'number' && videoDurationSec > 0 && videoStartSec > 0)) {
      pushLog(`Trimming video to 60s from ${Math.floor(videoStartSec)}s…`);
      fileToUploadVideo = await trimTo60Seconds(videoFile, 'video', videoStartSec);
    }
    const v = await uploadOnce(fileToUploadVideo);
    setVideoUrl(v.url);
    let aUrl: string | undefined;
    if (!useText && audioFile) {
      let fileToUploadAudio = audioFile;
      if ((audioOverLimit && trimAudioTo60) || (typeof audioDurationSec === 'number' && audioDurationSec > 0 && audioStartSec > 0)) {
        pushLog(`Trimming audio to 60s from ${Math.floor(audioStartSec)}s…`);
        fileToUploadAudio = await trimTo60Seconds(audioFile, 'audio', audioStartSec);
      }
      const a = await uploadOnce(fileToUploadAudio);
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
        try { await supabase.from('tasks').update({ job_id: data.id, status: (data.status as string) || 'queued' }).eq('id', createdTaskId); } catch {}
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
              <AddToDatabaseButton mediaUrl={outputUrl} kind="video" size="large" context={{ model: model === 'kling' ? 'kwaivgi/kling-lip-sync' : 'sync/lipsync-2', inputs: [{ type: 'video', url: videoUrl || undefined, label: 'video' }, useText ? { type: 'text', text, label: 'text' } : { type: 'audio', url: audioUrl || undefined, label: 'audio' }].filter(Boolean) as any }} />
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
          {typeof videoDurationSec === 'number' && <div className="small">Duration: {Math.round(videoDurationSec)}s</div>}
          {videoUrl && <div className="fileInfo">🔗 Uploaded successfully</div>}
        </div>

        {videoOverLimit && (
          <label className="small" style={{display:'flex', gap:8, alignItems:'center', marginTop:8}}>
            <input type="checkbox" checked={trimVideoTo60} onChange={(e)=> setTrimVideoTo60(e.target.checked)} /> Trim video to 60s (keep start)
          </label>
        )}

        {!!videoFile && typeof videoDurationSec === 'number' && videoDurationSec > 0 && (
          <div style={{marginTop:8}}>
            <div className="small" style={{display:'flex', justifyContent:'space-between'}}>
              <span>Video start time</span>
              <span>{Math.floor(videoStartSec)}s / {Math.floor(videoDurationSec)}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, Math.floor(Math.max(0, videoDurationSec - 1)))}
              step={1}
              value={Math.min(videoStartSec, Math.max(0, Math.floor(videoDurationSec - 1)))}
              onChange={(e)=> setVideoStartSec(Number(e.target.value))}
              style={{width:'100%'}}
            />
            <div className="small">Selected window: {Math.min(60, Math.max(0, Math.floor(videoDurationSec - videoStartSec)))}s</div>
          </div>
        )}

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
            {typeof audioDurationSec === 'number' && <div className="small">Duration: {Math.round(audioDurationSec)}s</div>}
            {audioUrl && <div className="fileInfo">🔗 Uploaded successfully</div>}
          </div>
        )}

        {!useText && audioOverLimit && (
          <label className="small" style={{display:'flex', gap:8, alignItems:'center', marginTop:8}}>
            <input type="checkbox" checked={trimAudioTo60} onChange={(e)=> setTrimAudioTo60(e.target.checked)} /> Trim audio to 60s (keep start)
          </label>
        )}

        {!useText && !!audioFile && typeof audioDurationSec === 'number' && audioDurationSec > 0 && (
          <div style={{marginTop:8}}>
            <div className="small" style={{display:'flex', justifyContent:'space-between'}}>
              <span>Audio start time</span>
              <span>{Math.floor(audioStartSec)}s / {Math.floor(audioDurationSec)}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, Math.floor(Math.max(0, audioDurationSec - 1)))}
              step={1}
              value={Math.min(audioStartSec, Math.max(0, Math.floor(audioDurationSec - 1)))}
              onChange={(e)=> setAudioStartSec(Number(e.target.value))}
              style={{width:'100%'}}
            />
            <div className="small">Selected window: {Math.min(60, Math.max(0, Math.floor(audioDurationSec - audioStartSec)))}s</div>
          </div>
        )}

        <button className="btn" style={{marginTop:12}} onClick={startGeneration} disabled={!requiredReady()}>
          Generate
        </button>
      </div>
    </div>
  );
}



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

  // Engine selection: 'wan' (Wan 2.2 S2V), or InfiniteTalk variants
  const [engine, setEngine] = useState<'wan' | 'infinitetalk' | 'infinitetalk-multi' | 'infinitetalk-v2v'>('infinitetalk');

  // Wan 2.2 S2V specific options
  const [wanPrompt, setWanPrompt] = useState<string>('person speaking');
  const [wanNumFramesPerChunk, setWanNumFramesPerChunk] = useState<number>(81);
  const [wanSeed, setWanSeed] = useState<string>('');
  const [wanInterpolate, setWanInterpolate] = useState<boolean>(false);

  // InfiniteTalk specific options
  const [itPrompt, setItPrompt] = useState<string>('');
  const [itResolution, setItResolution] = useState<'480p' | '720p'>('480p');
  const [itSeed, setItSeed] = useState<string>('-1');
  const [itMaskImage, setItMaskImage] = useState<File | null>(null);
  const [itMaskImageUrl, setItMaskImageUrl] = useState<string | null>(null);

  // InfiniteTalk Multi specific options
  const [itMultiOrder, setItMultiOrder] = useState<'meanwhile' | 'left_right' | 'right_left'>('meanwhile');
  const [itLeftAudioFile, setItLeftAudioFile] = useState<File | null>(null);
  const [itLeftAudioUrl, setItLeftAudioUrl] = useState<string | null>(null);
  const [itRightAudioFile, setItRightAudioFile] = useState<File | null>(null);
  const [itRightAudioUrl, setItRightAudioUrl] = useState<string | null>(null);

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

  const onSelectLeftAudio = useCallback(async (file: File) => {
    setItLeftAudioFile(file);
  }, []);

  const onSelectRightAudio = useCallback(async (file: File) => {
    setItRightAudioFile(file);
  }, []);

  const onSelectMaskImage = useCallback(async (file: File) => {
    setItMaskImage(file);
  }, []);

  async function uploadIfNeeded(): Promise<{ videoUrl: string; audioUrl: string; leftAudioUrl?: string; rightAudioUrl?: string; maskImageUrl?: string } | false> {
    // For InfiniteTalk Multi, need left and right audio
    if (engine === 'infinitetalk-multi') {
      if (!videoFile || !itLeftAudioFile || !itRightAudioFile) return false;
      if (videoUrl && itLeftAudioUrl && itRightAudioUrl) {
        return { videoUrl, audioUrl: itLeftAudioUrl, leftAudioUrl: itLeftAudioUrl, rightAudioUrl: itRightAudioUrl };
      }
    } else {
      // For regular InfiniteTalk or InfiniteTalk V2V
      if (!videoFile || !audioFile) return false;
      if (videoUrl && audioUrl) {
        const result: { videoUrl: string; audioUrl: string; maskImageUrl?: string } = { videoUrl, audioUrl };
        if (itMaskImageUrl) result.maskImageUrl = itMaskImageUrl;
        return result;
      }
    }

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

    if (engine === 'infinitetalk-multi') {
      const [v, leftA, rightA] = await Promise.all([
        uploadOnce(videoFile!),
        uploadOnce(itLeftAudioFile!),
        uploadOnce(itRightAudioFile!),
      ]);
      setVideoUrl(v.url);
      setItLeftAudioUrl(leftA.url);
      setItRightAudioUrl(rightA.url);
      pushLog('Uploaded to Supabase.');
      return { videoUrl: v.url, audioUrl: leftA.url, leftAudioUrl: leftA.url, rightAudioUrl: rightA.url };
    } else {
      const uploads = [uploadOnce(videoFile!), uploadOnce(audioFile!)];
      if (itMaskImage) {
        uploads.push(uploadOnce(itMaskImage));
      }
      const results = await Promise.all(uploads);
      const [v, a] = results;
      setVideoUrl(v.url);
      setAudioUrl(a.url);
      if (itMaskImage && results[2]) {
        setItMaskImageUrl(results[2].url);
      }
      pushLog('Uploaded to Supabase.');
      const result: { videoUrl: string; audioUrl: string; maskImageUrl?: string } = { videoUrl: v.url, audioUrl: a.url };
      if (itMaskImage && results[2]) {
        result.maskImageUrl = results[2].url;
      }
      return result;
    }
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
      // Update global task state for favicon
      const { updateTaskStateFromJobStatus } = await import('../../lib/taskStateHelper');
      updateTaskStateFromJobStatus('queued');

      // Options are now handled per-engine in their respective sections below

      // Database operations removed - proceeding directly to job creation
      const taskId = Date.now().toString(); // Generate local task ID
      setTaskId(taskId);
      const engineNames: Record<string, string> = {
        'wan': 'Wan 2.2 S2V',
        'infinitetalk': 'InfiniteTalk',
        'infinitetalk-multi': 'InfiniteTalk Multi',
        'infinitetalk-v2v': 'InfiniteTalk Video-to-Video',
      };
      pushLog(`Task created. Pushing lipsync job to ${engineNames[engine] || engine}...`);

      if (engine === 'wan') {
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
          // Update global task state for favicon
          const { updateTaskStateFromJobStatus } = await import('../../lib/taskStateHelper');
          if (mapped === 'finished') {
            updateTaskStateFromJobStatus('success');
          } else if (mapped === 'error') {
            updateTaskStateFromJobStatus('error');
          } else {
            updateTaskStateFromJobStatus(mapped === 'running' ? 'running' : 'queued');
          }
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
      } else if (engine === 'infinitetalk' || engine === 'infinitetalk-multi' || engine === 'infinitetalk-v2v') {
        // InfiniteTalk models via Wavespeed API
        let modelName = 'wavespeed-ai/infinitetalk';
        if (engine === 'infinitetalk-multi') {
          modelName = 'wavespeed-ai/infinitetalk/multi';
        } else if (engine === 'infinitetalk-v2v') {
          modelName = 'wavespeed-ai/infinitetalk/video-to-video';
        }

        let input: any = {
          resolution: itResolution,
          seed: itSeed ? Number(itSeed) : -1,
        };

        if (engine === 'infinitetalk-multi') {
          input.image = urls.videoUrl;
          input.left_audio = urls.leftAudioUrl;
          input.right_audio = urls.rightAudioUrl;
          input.order = itMultiOrder;
        } else if (engine === 'infinitetalk-v2v') {
          input.video = urls.videoUrl;
          input.audio = urls.audioUrl;
          if (itPrompt) input.prompt = itPrompt;
          if (urls.maskImageUrl) input.mask_image = urls.maskImageUrl;
        } else {
          // InfiniteTalk (single character)
          input.image = urls.videoUrl;
          input.audio = urls.audioUrl;
          if (itPrompt) input.prompt = itPrompt;
          if (urls.maskImageUrl) input.mask_image = urls.maskImageUrl;
        }

        const res = await fetch('/api/wavespeed/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelName,
            input,
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          pushLog('Push failed: ' + text);
          setStatus('error');
          const { updateTaskStateFromJobStatus } = await import('../../lib/taskStateHelper');
          updateTaskStateFromJobStatus('error');
          return;
        }

        const data = await res.json();
        setJobId(data.id);
        setStatus('queued');
        pushLog(`Job created: ${data.id}, checking status...`);

        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          if (!data.id) return;
          const s = await fetch(`/api/wavespeed/status?id=${data.id}`);
          if (!s.ok) return;
          const j = await s.json();
          const mapped: JobStatus = j.status === 'finished' ? 'finished'
            : j.status === 'error' ? 'error'
            : j.status === 'running' ? 'running'
            : (j.status as JobStatus);
          if (lastStatusRef.current !== mapped) {
            pushLog(`Status: ${mapped}`);
            lastStatusRef.current = mapped;
          }
          setStatus(mapped as JobStatus);
          const { updateTaskStateFromJobStatus } = await import('../../lib/taskStateHelper');
          if (mapped === 'finished') {
            updateTaskStateFromJobStatus('success');
            setTimeout(() => updateTaskStateFromJobStatus('idle'), 3000);
          } else if (mapped === 'error') {
            updateTaskStateFromJobStatus('error');
            setTimeout(() => updateTaskStateFromJobStatus('idle'), 3000);
          } else {
            updateTaskStateFromJobStatus(mapped === 'running' ? 'running' : 'queued');
          }
          if (mapped === 'finished' || mapped === 'error') {
            clearInterval(pollRef.current!);
            pollRef.current = null;
          }
          if (j.outputUrl) {
            (window as any).__WAVESPEED_OUTPUT_URL__ = j.outputUrl;
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
      const { updateTaskStateFromJobStatus } = await import('../../lib/taskStateHelper');
      updateTaskStateFromJobStatus('error');
      setTimeout(() => updateTaskStateFromJobStatus('idle'), 3000);
    }
  }

  const finishedVideoUrl = ((): string | null => {
    const w = (typeof window !== 'undefined') ? (window as any) : null;
    const outputs = w && w.__SIEVE_OUTPUTS__ || null;
    const syncOut = w && (w.__SYNC_OUTPUT_URL__ as string | null) || null;
    const wanOut = w && (w.__WAN_OUTPUT_URL__ as string | null) || null;
    const wavespeedOut = w && (w.__WAVESPEED_OUTPUT_URL__ as string | null) || null;
    if (wavespeedOut) return wavespeedOut;
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
          <div style={{fontWeight:700}}>
            {engine === 'infinitetalk' || engine === 'infinitetalk-v2v' ? 'Image/Video' : 'Video'}
          </div>
          <div className="small">
            {engine === 'infinitetalk' ? 'Image (PNG/JPG) • person to animate' : 
             engine === 'infinitetalk-multi' ? 'Image (PNG/JPG) • two people clearly visible' :
             engine === 'infinitetalk-v2v' ? 'Video (MP4/MOV) • base video for lipsync' :
             'MP4/MOV recommended • clear face, single speaker'}
          </div>
          {videoFile && <div className="fileInfo">📹 {videoFile.name} ({Math.round(videoFile.size/1024/1024*10)/10} MB)</div>}
          {videoUrl && <div className="fileInfo">🔗 Uploaded: {videoUrl}</div>}
        </div>

        {engine === 'infinitetalk-multi' ? (
          <>
            <div
              className={`dnd ${dragAudio ? 'drag' : ''}`}
              style={{marginTop:12}}
              onDragOver={(e)=>{e.preventDefault(); setDragAudio(true);}}
              onDragLeave={(e)=>{e.preventDefault(); setDragAudio(false);}}
              onDrop={(e)=>{
                e.preventDefault();
                setDragAudio(false);
                const f = e.dataTransfer.files?.[0];
                if (f) onSelectLeftAudio(f);
              }}
              onClick={()=>{
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'audio/*';
                input.onchange = ()=>{
                  const f = (input.files?.[0]) || null;
                  if (f) onSelectLeftAudio(f);
                };
                input.click();
              }}
            >
              <div style={{fontWeight:700}}>Left Audio</div>
              <div className="small">WAV/MP3 • audio for person on the left</div>
              {itLeftAudioFile && <div className="fileInfo">🎙️ {itLeftAudioFile.name} ({Math.round(itLeftAudioFile.size/1024/1024*10)/10} MB)</div>}
              {itLeftAudioUrl && <div className="fileInfo">🔗 Uploaded: {itLeftAudioUrl}</div>}
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
                if (f) onSelectRightAudio(f);
              }}
              onClick={()=>{
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'audio/*';
                input.onchange = ()=>{
                  const f = (input.files?.[0]) || null;
                  if (f) onSelectRightAudio(f);
                };
                input.click();
              }}
            >
              <div style={{fontWeight:700}}>Right Audio</div>
              <div className="small">WAV/MP3 • audio for person on the right</div>
              {itRightAudioFile && <div className="fileInfo">🎙️ {itRightAudioFile.name} ({Math.round(itRightAudioFile.size/1024/1024*10)/10} MB)</div>}
              {itRightAudioUrl && <div className="fileInfo">🔗 Uploaded: {itRightAudioUrl}</div>}
            </div>
          </>
        ) : (
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
        )}

        {(engine === 'infinitetalk' || engine === 'infinitetalk-v2v') && (
          <div
            className={`dnd`}
            style={{marginTop:12}}
            onClick={()=>{
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = ()=>{
                const f = (input.files?.[0]) || null;
                if (f) onSelectMaskImage(f);
              };
              input.click();
            }}
          >
            <div style={{fontWeight:700}}>Mask Image (Optional)</div>
            <div className="small">PNG/JPG • specify which regions can move (do NOT upload full image)</div>
            {itMaskImage && <div className="fileInfo">🖼️ {itMaskImage.name} ({Math.round(itMaskImage.size/1024/1024*10)/10} MB)</div>}
            {itMaskImageUrl && <div className="fileInfo">🔗 Uploaded: {itMaskImageUrl}</div>}
          </div>
        )}

        <div style={{marginTop:16, fontWeight:700}}>Options</div>
        <div className="options">
          <div style={{gridColumn: 'span 2'}}>
            <div className="small">Engine</div>
            <select className="select" value={engine} onChange={(e)=>setEngine(e.target.value as 'wan' | 'infinitetalk' | 'infinitetalk-multi' | 'infinitetalk-v2v')}>
              <option value="wan">Wan 2.2 S2V (audio-driven cinematic video) 🌟</option>
              <option value="infinitetalk">InfiniteTalk (image + audio) 🆕</option>
              <option value="infinitetalk-multi">InfiniteTalk Multi (2 characters) 🆕</option>
              <option value="infinitetalk-v2v">InfiniteTalk Video-to-Video 🆕</option>
            </select>
          </div>
          {engine === 'wan' ? (
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
          ) : (engine === 'infinitetalk' || engine === 'infinitetalk-multi' || engine === 'infinitetalk-v2v') ? (
            <>
              {/* InfiniteTalk options */}
              {(engine === 'infinitetalk' || engine === 'infinitetalk-v2v') && (
                <div style={{gridColumn: 'span 2'}}>
                  <div className="small">Prompt (optional - describe expression, style, or pose)</div>
                  <input 
                    className="select" 
                    type="text" 
                    value={itPrompt} 
                    onChange={(e)=>setItPrompt(e.target.value)} 
                    placeholder="e.g., person speaking enthusiastically, natural expression"
                  />
                </div>
              )}
              {engine === 'infinitetalk-multi' && (
                <div>
                  <div className="small">Speaking Order</div>
                  <select className="select" value={itMultiOrder} onChange={(e)=>setItMultiOrder(e.target.value as any)}>
                    <option value="meanwhile">Meanwhile (both at same time)</option>
                    <option value="left_right">Left to Right (left first, then right)</option>
                    <option value="right_left">Right to Left (right first, then left)</option>
                  </select>
                </div>
              )}
              <div>
                <div className="small">Resolution</div>
                <select className="select" value={itResolution} onChange={(e)=>setItResolution(e.target.value as '480p' | '720p')}>
                  <option value="480p">480p ($0.15/5s)</option>
                  <option value="720p">720p ($0.30/5s)</option>
                </select>
              </div>
              <div>
                <div className="small">Seed (optional, -1 for random)</div>
                <input 
                  className="select" 
                  type="text" 
                  value={itSeed} 
                  onChange={(e)=>setItSeed(e.target.value)} 
                  placeholder="-1"
                />
              </div>
            </>
          ) : null}
        </div>

        <button className="btn"
          onClick={startLipsync}
          disabled={
            !videoFile || 
            (engine === 'infinitetalk-multi' ? (!itLeftAudioFile || !itRightAudioFile) : !audioFile)
          }
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

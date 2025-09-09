'use client';

import '../globals.css';
import { useCallback, useRef, useState, useEffect } from 'react';
// Database functionality removed

type ReplicateStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'queued' | 'unknown';

export default function BackgroundRemovePage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ReplicateStatus>('unknown');
  const [logLines, setLogLines] = useState<string[]>([]);
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  const [mode, setMode] = useState<'Fast' | 'Normal'>('Normal');
  const [backgroundColor, setBackgroundColor] = useState<string>('#FFFFFF');

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<ReplicateStatus | null>(null);

  const pushLog = (line: string) => setLogLines((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${line}`]);

  const onSelectVideo = useCallback((file: File) => setVideoFile(file), []);

  const uploadOnce = useCallback(async (file: File): Promise<string> => {
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
      const res = await fetch('/api/persist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, filename: url.split('/').pop() || null, folder: 'bgremove' }) });
      if (!res.ok) return url;
      const j = await res.json();
      return typeof j?.url === 'string' ? j.url : url;
    } catch { return url; }
  }

  async function runBackgroundRemoval() {
    setStatus('queued');
    setLogLines([]);
    setOutputUrl(null);
    setPredictionId(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { pushLog('Please sign in at /auth before creating a task.'); setStatus('failed'); return; }
      if (!videoFile) { pushLog('Please select a video file.'); setStatus('failed'); return; }

      let uploadedUrl = videoUrl;
      if (!uploadedUrl) {
        pushLog('Uploading video…');
        uploadedUrl = await uploadOnce(videoFile);
        setVideoUrl(uploadedUrl);
        pushLog('Uploaded.');
      }

      const input = {
        video: uploadedUrl,
        mode,
        background_color: backgroundColor,
      } as any;

      // Create task entry
      const { data: inserted, error: insertErr } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          type: 'bgremove',
          status: 'queued',
          provider: 'replicate',
          backend: 'lucataco/rembg-video',
          options_json: input,
          video_url: uploadedUrl,
        })
        .select('*')
        .single();
      if (insertErr || !inserted) { pushLog('Failed to create task: ' + (insertErr?.message || 'unknown')); setStatus('failed'); return; }
      setTaskId(inserted.id);

      pushLog('Submitting to Replicate: lucataco/rembg-video');
      const res = await fetch('/api/replicate/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'lucataco/rembg-video', input })
      });
      if (!res.ok) { pushLog('Submission failed: ' + (await res.text())); setStatus('failed'); return; }
      const data = await res.json();
      setPredictionId(data.id as string);
      const initialStatus: ReplicateStatus = (data.status as ReplicateStatus) || 'queued';
      setStatus(initialStatus);
      pushLog(`Prediction created: ${data.id}`);
      if (inserted?.id) await supabase.from('tasks').update({ job_id: data.id, status: initialStatus }).eq('id', inserted.id);

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
          const persisted = await persistUrlIfPossible(j.outputUrl);
          const proxied = `/api/proxy?url=${encodeURIComponent(persisted)}`;
          setOutputUrl(proxied);
        }
        if (inserted?.id) {
          const proxied = j.outputUrl ? `/api/proxy?url=${encodeURIComponent(j.outputUrl)}` : null;
          await supabase.from('tasks').update({ status: st as string, output_url: proxied }).eq('id', inserted.id);
        }
        if (st === 'succeeded' || st === 'failed' || st === 'canceled') {
          clearInterval(pollRef.current!); pollRef.current = null;
          if (j.error) pushLog(`Error: ${typeof j.error === 'string' ? j.error : JSON.stringify(j.error)}`);
        }
      }, 2000);
    } catch (e: any) {
      pushLog('Error: ' + e?.message);
      setStatus('failed');
      if (taskId) await supabase.from('tasks').update({ status: 'error' }).eq('id', taskId);
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
          {outputUrl ? (
            <div>
              <video src={outputUrl} controls style={{ width: '100%', borderRadius: 8 }} onError={()=> pushLog('Video failed to play. Open in new tab using the link below.')} />
              <div className="small" style={{marginTop:8}}>
                <a href={outputUrl} target="_blank" rel="noreferrer">Open output in new tab</a>
              </div>
              {/* Database functionality removed */}
            </div>
          ) : (
            <div style={{fontSize:16, color:'#b7c2df'}}>Processed video will appear here.</div>
          )}
        </div>
        <div>
          <div className="small" style={{margin:'8px 0 6px'}}>Log</div>
          <pre className="log">{logLines.join('\n')}</pre>
        </div>
      </div>

      <div className="panel">
        <div className="header"><h3 style={{margin:0}}>Inputs (Replicate)</h3></div>
        <div>
          <div className="small">Video file</div>
          <label className="dnd" style={{display:'block'}}>
            <input type="file" accept="video/*" style={{ display: 'none' }} onChange={(e)=>{ const f = e.target.files?.[0]; if (f) onSelectVideo(f); }} />
            {videoFile ? (
              <div className="fileInfo">
                <span>{videoFile.name}</span>
                <span>({(videoFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
              </div>
            ) : (
              <div className="small" style={{color:'#b7c2df'}}>Click to select a video</div>
            )}
          </label>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:12, marginTop:12}}>
          <div>
            <div className="small">mode</div>
            <select className="select" value={mode} onChange={(e)=> setMode(e.target.value as 'Fast' | 'Normal')}>
              <option value="Fast">Fast</option>
              <option value="Normal">Normal</option>
            </select>
          </div>
          <div>
            <div className="small">background_color</div>
            <input className="select" type="text" value={backgroundColor} onChange={(e)=> setBackgroundColor(e.target.value)} placeholder="#FFFFFF" />
          </div>
        </div>

        <button className="btn" style={{ marginTop: 12 }} disabled={!videoFile || status==='processing' || status==='queued'} onClick={runBackgroundRemoval}>
          {status==='processing' || status==='queued' ? 'Processing…' : 'Remove Background'}
        </button>
      </div>
    </div>
  );
}



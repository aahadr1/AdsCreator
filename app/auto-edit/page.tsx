'use client';

import '../globals.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProgressEvent, StartJobResponse, UserUpload } from '../../types/auto-edit';

type StepKey = 'STEP_1' | 'STEP_2' | 'STEP_2B' | 'STEP_3' | 'STEP_4';

type ResultVariant = { plan: any | null; video: any | null } | null; // UI-only typing
type ResultBySegment = Record<string, { segment_text: string; variants: ResultVariant[] }>;

export default function AutoEditPage() {
  const [activeTab, setActiveTab] = useState<'script' | 'uploads'>('script');
  const [script, setScript] = useState('');
  const [uploads, setUploads] = useState<UserUpload[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<StepKey, { label: string; status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' }>>({
    STEP_1: { label: 'Segment & Ideate', status: 'QUEUED' },
    STEP_2: { label: 'Plan & Select Image', status: 'QUEUED' },
    STEP_2B: { label: 'Synthesize Missing Stills', status: 'QUEUED' },
    STEP_3: { label: 'Generate Videos', status: 'QUEUED' },
    STEP_4: { label: 'Assemble', status: 'QUEUED' },
  });
  const [result, setResult] = useState<ResultBySegment | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);

  const esRef = useRef<EventSource | null>(null);

  const pushLog = useCallback((line: string) => setLogLines((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${line}`]), []);

  const onDropFiles = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async () => {
      const files = input.files ? Array.from(input.files) : [];
      if (files.length === 0) return;
      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        form.append('filename', file.name);
        const res = await fetch('/api/assets/upload', { method: 'POST', body: form });
        if (!res.ok) {
          // continue on error
          // eslint-disable-next-line no-continue
          continue;
        }
        const j = (await res.json()) as { url: string };
        setUploads((prev) => [
          ...prev,
          {
            fileName: file.name,
            url: j.url,
          },
        ]);
      }
    };
    input.click();
  }, []);

  const onRun = useCallback(async () => {
    if (!script.trim()) {
      pushLog('Provide a script.');
      return;
    }
    setIsRunning(true);
    setResult(null);
    setProgress({
      STEP_1: { label: 'Segment & Ideate', status: 'QUEUED' },
      STEP_2: { label: 'Plan & Select Image', status: 'QUEUED' },
      STEP_2B: { label: 'Synthesize Missing Stills', status: 'QUEUED' },
      STEP_3: { label: 'Generate Videos', status: 'QUEUED' },
      STEP_4: { label: 'Assemble', status: 'QUEUED' },
    });
    setLogLines([]);
    try {
      const startRes = await fetch('/api/auto-edit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, uploads }),
      });
      if (!startRes.ok) throw new Error(await startRes.text());
      const { jobId: id } = (await startRes.json()) as StartJobResponse;
      setJobId(id);
      // Start SSE
      if (esRef.current) {
        try { esRef.current.close(); } catch {}
        esRef.current = null;
      }
      const es = new EventSource(`/api/auto-edit/stream?jobId=${encodeURIComponent(id)}`);
      es.onmessage = (ev) => {
        try {
          const event = JSON.parse(ev.data) as ProgressEvent;
          if (event.step === 'ERROR') {
            pushLog(event.error || 'Error');
            setProgress((prev) => ({ ...prev, STEP_1: prev.STEP_1, STEP_2: prev.STEP_2, STEP_2B: prev.STEP_2B, STEP_3: prev.STEP_3, STEP_4: { label: 'Assemble', status: 'FAILED' } }));
            return;
          }
          const step = event.step as StepKey;
          setProgress((prev) => ({ ...prev, [step]: { label: event.label, status: event.status } }));
          if (step === 'STEP_4' && event.status === 'DONE' && event.payload) {
            setResult(event.payload as ResultBySegment);
          }
        } catch {}
      };
      es.onerror = () => {
        pushLog('Stream closed.');
        try { es.close(); } catch {}
        esRef.current = null;
        setIsRunning(false);
      };
      esRef.current = es;
    } catch (e: unknown) {
      pushLog(e instanceof Error ? e.message : 'Failed to start');
      setIsRunning(false);
    }
  }, [pushLog, script, uploads]);

  useEffect(() => () => {
    try { esRef.current?.close(); } catch {}
  }, []);

  const completedPercent = useMemo(() => {
    const steps: StepKey[] = ['STEP_1', 'STEP_2', 'STEP_2B', 'STEP_3', 'STEP_4'];
    const done = steps.filter((s) => progress[s].status === 'DONE').length;
    return Math.round((done / steps.length) * 100);
  }, [progress]);

  return (
    <div className="container" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <div className="panel">
        <div className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ margin: 0 }}>Auto Edit (beta)</h2>
            <span className="badge">Replicate-only</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button className={`btn ${activeTab === 'script' ? 'btn-primary' : ''}`} type="button" onClick={() => setActiveTab('script')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab('script'); }}>
            Script
          </button>
          <button className={`btn ${activeTab === 'uploads' ? 'btn-primary' : ''}`} type="button" onClick={() => setActiveTab('uploads')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab('uploads'); }}>
            Uploads
          </button>
        </div>

        {activeTab === 'script' ? (
          <div>
            <div className="small">Script</div>
            <textarea
              className="select"
              rows={10}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Paste your ad script"
            />
            <button className="btn" type="button" style={{ marginTop: 12 }} disabled={isRunning} onClick={onRun} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onRun(); }}>
              {isRunning ? 'Running…' : 'Run Auto Edit'}
            </button>
          </div>
        ) : (
          <div>
            <div className="small">Reference images</div>
            <div className="panel" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn" type="button" onClick={onDropFiles} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDropFiles(); }}>
                Add images
              </button>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {uploads.map((u) => (
                  <div key={u.fileName} className="panel" style={{ width: 120, height: 80, backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: `url(${u.url})` }} title={u.fileName} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="panel output">
        <div className="header">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', width: '100%' }}>
            <div>Progress</div>
            <div className="small">{completedPercent}%</div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          {(['STEP_1', 'STEP_2', 'STEP_2B', 'STEP_3', 'STEP_4'] as StepKey[]).map((key) => (
            <div key={key} className="panel" style={{ padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>{progress[key].label}</div>
              <div className="small" style={{ opacity: .8 }}>{progress[key].status}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ margin: '8px 0 6px' }}>Log</div>
          <pre className="log">{logLines.join('\n')}</pre>
        </div>

        {result && (
          <div style={{ marginTop: 12 }}>
            <div className="header"><h3 style={{ margin: 0 }}>Results</h3></div>
            <div style={{ display: 'grid', gap: 12 }}>
              {Object.entries(result).map(([segId, data]) => (
                <div key={segId} className="panel" style={{ padding: 12 }}>
                  <div className="small" style={{ opacity: .9 }}>{segId}</div>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{data.segment_text}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    {data.variants.map((v, idx) => (
                      <div key={idx} className="panel" style={{ padding: 8 }}>
                        {v?.video?.video_url ? (
                          <video src={v.video.video_url} controls style={{ width: '100%', borderRadius: 8 }} />
                        ) : (
                          <div className="small" style={{ opacity: .7 }}>No video</div>
                        )}
                        <div className="small" style={{ marginTop: 8 }}>Used image</div>
                        <div
                          className="panel"
                          style={{ height: 80, backgroundSize: 'cover', backgroundPosition: 'center', backgroundImage: v?.video?.used_image_url ? `url(${v.video.used_image_url})` : 'none' }}
                          title={v?.video?.used_image_url || ''}
                        />
                        <details style={{ marginTop: 6 }}>
                          <summary className="small">Prompt</summary>
                          <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{v?.video?.prompt_text || v?.plan?.prompt_text || ''}</div>
                        </details>
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          <button className="btn" type="button" onClick={() => {}} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') {} }}>
                            Re-roll
                          </button>
                          <button className="btn" type="button" onClick={() => {}} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') {} }}>
                            Swap image
                          </button>
                          <button className="btn" type="button" onClick={() => {}} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') {} }}>
                            Edit prompt
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



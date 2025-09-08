export const dynamic = 'force-dynamic';

'use client';

import '../../globals.css';
import { useCallback, useMemo, useRef, useState } from 'react';
import { supabaseClient as supabase } from '../../../lib/supabaseClient';

type BulkItem = {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'running' | 'finished' | 'error';
  progress?: number;
  audioUrl?: string | null;
  taskId?: string | null;
  transcript?: string | null;
  error?: string | null;
};

export default function BulkTranscriptionPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<BulkItem[]>([]);
  const [language, setLanguage] = useState<string>('en');
  const [prompt, setPrompt] = useState<string>('');
  const [temperature, setTemperature] = useState<number>(0);
  const [concurrency, setConcurrency] = useState<number>(3);
  const [isRunning, setIsRunning] = useState(false);

  const queueRef = useRef<BulkItem[]>([]);

  const reset = useCallback(() => {
    setItems([]);
    setFiles([]);
  }, []);

  const onSelectFiles = useCallback((list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list);
    setFiles(arr);
    const mapped: BulkItem[] = arr.map((f, idx) => ({
      id: `${Date.now()}-${idx}-${f.name}`,
      file: f,
      status: 'queued',
    }));
    setItems(mapped);
  }, []);

  const uploadOnce = useCallback(async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    form.append('filename', file.name);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { url: string };
    return json.url;
  }, []);

  const runOne = useCallback(async (item: BulkItem) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Please sign in at /auth before creating tasks.');

    setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'uploading', error: null } : it));
    const audioUrl = await uploadOnce(item.file);

    setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'running', audioUrl } : it));

    const options = {
      language: language || undefined,
      prompt: prompt || undefined,
      temperature,
      audio_file: audioUrl,
    } as Record<string, any>;

    const { data: inserted, error: insertErr } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        type: 'lipsync',
        status: 'queued',
        provider: 'replicate',
        model_id: 'openai/gpt-4o-transcribe',
        options_json: options,
        audio_url: audioUrl,
        text_input: prompt || null,
      })
      .select('*')
      .single();
    if (insertErr || !inserted) throw new Error(insertErr?.message || 'Failed to create task');

    const res = await fetch('/api/transcription/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { text?: string | null };
    const text = json.text || '';

    await supabase.from('tasks').update({ status: 'finished' }).eq('id', inserted.id);

    setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'finished', transcript: text, taskId: inserted.id } : it));
  }, [language, prompt, temperature, uploadOnce]);

  const downloadItem = useCallback((item: BulkItem) => {
    const blob = new Blob([item.transcript || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (item.file.name.replace(/\.[^.]+$/, '') || 'transcript') + '.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const runAll = useCallback(async () => {
    if (isRunning || items.length === 0) return;
    setIsRunning(true);
    queueRef.current = items.map(i => ({ ...i }));

    const workers: Promise<void>[] = [];
    const takeNext = async () => {
      const next = queueRef.current.find(i => i.status === 'queued');
      if (!next) return;
      // mark as in-progress in queue snapshot to avoid duplicate picks
      next.status = 'uploading';
      try {
        await runOne(next);
      } catch (e: any) {
        setItems(prev => prev.map(it => it.id === next.id ? { ...it, status: 'error', error: e?.message || 'Error' } : it));
      } finally {
        await takeNext();
      }
    };

    const pool = Math.max(1, Math.min(10, Math.floor(concurrency)));
    for (let i = 0; i < pool; i++) {
      workers.push(takeNext());
    }
    await Promise.all(workers);
    setIsRunning(false);
  }, [items, concurrency, isRunning, runOne]);

  const completed = useMemo(() => items.filter(i => i.status === 'finished').length, [items]);

  const downloadAll = useCallback(() => {
    const finished = items.filter(i => i.status === 'finished' && (i.transcript || '').trim() !== '');
    if (finished.length === 0) return;
    const parts = finished.map((i, idx) => {
      const header = `=== ${idx + 1}. ${i.file.name} ===`;
      return `${header}\n${i.transcript}\n`;
    });
    const allText = parts.join('\n');
    const blob = new Blob([allText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcripts_${new Date().toISOString().replace(/[:.]/g,'-')}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [items]);

  return (
    <div className="container">
      <div className="panel">
        <div className="header">
          <h3 style={{margin:0}}>Bulk Transcription</h3>
          <span className="badge">{completed}/{items.length} done</span>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
          <div>
            <div className="small">Select up to 20 audio/video files</div>
            <input type="file" multiple accept="audio/*,video/mp4,video/webm" onChange={(e)=>onSelectFiles(e.target.files)} />
          </div>
          <div className="options">
            <div>
              <div className="small">Language</div>
              <input className="input" value={language} onChange={(e)=>setLanguage(e.target.value)} />
            </div>
            <div>
              <div className="small">Temperature</div>
              <input className="input" type="number" step={0.1} min={0} max={1} value={temperature} onChange={(e)=>setTemperature(parseFloat(e.target.value))} />
            </div>
          </div>
        </div>

        <div style={{marginTop:12}}>
          <div className="small">Prompt (optional)</div>
          <textarea className="input" rows={3} value={prompt} onChange={(e)=>setPrompt(e.target.value)} placeholder="Style guide or context" />
        </div>

        <div className="row" style={{marginTop:12}}>
          <div>
            <div className="small">Concurrency</div>
            <input className="input" type="number" min={1} max={10} value={concurrency} onChange={(e)=>setConcurrency(parseInt(e.target.value || '1'))} />
          </div>
          <div style={{display:'flex', alignItems:'end', gap:8}}>
            <button className="btn" disabled={files.length === 0 || isRunning} onClick={runAll}>{isRunning ? 'Running…' : 'Run all'}</button>
            <button className="btn" disabled={isRunning} onClick={reset}>Reset</button>
            <button className="btn" disabled={completed === 0} onClick={downloadAll}>Download all (.txt)</button>
          </div>
        </div>
      </div>

      <div className="panel" style={{marginTop:12}}>
        <div className="header">
          <h3 style={{margin:0}}>Queue</h3>
          <span className="badge">{items.length} files</span>
        </div>
        <div style={{display:'grid', gap:10}}>
          {items.map(item => (
            <div key={item.id} className="panel" style={{padding:10}}>
              <div className="row" style={{marginBottom:6}}>
                <div style={{fontWeight:700, overflow:'hidden', textOverflow:'ellipsis'}}>{item.file.name}</div>
                <span className="badge">{item.status}</span>
              </div>
              {item.transcript ? (
                <div className="small" style={{whiteSpace:'pre-wrap', maxHeight:160, overflow:'auto'}}>{item.transcript}</div>
              ) : item.error ? (
                <div className="small" style={{color:'#ff7878'}}>{item.error}</div>
              ) : (
                <div className="small" style={{opacity:.8}}>Awaiting result…</div>
              )}
              <div className="row" style={{marginTop:6}}>
                <div className="small" style={{opacity:.8}}>{item.audioUrl ? <a href={item.audioUrl} target="_blank" rel="noreferrer">audio</a> : 'no audio yet'}</div>
                <div style={{display:'flex', gap:8}}>
                  <button className="btn" disabled={!item.transcript} onClick={()=>downloadItem(item)}>Download .txt</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}



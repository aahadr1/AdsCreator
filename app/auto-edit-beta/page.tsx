'use client';

import '../globals.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// Database functionality removed

type Segment = {
  id: string;
  index: number;
  text: string;
  duration_hint_sec?: number | null;
  desired_rush_description: string;
  keywords?: string[];
  rush_ideas?: string[];
};

type RetrieveResult = Record<string, Array<{
  id: string;
  public_url: string;
  kind?: 'image' | 'video';
  title?: string | null;
  description?: string | null;
  score?: number;
}>>;

type SequenceItem = { segment_id: string; chosen_asset_id: string; reason?: string };

export default function AutoEditBetaPage() {
  const [script, setScript] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [candidates, setCandidates] = useState<RetrieveResult>({});
  const [sequence, setSequence] = useState<SequenceItem[]>([]);
  const [logLines, setLogLines] = useState<string[]>([]);

  const pushLog = useCallback((line: string) => setLogLines((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${line}`]), []);

  const onPickAudio = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = () => {
      const f = (input.files?.[0]) || null;
      if (f) setAudioFile(f);
    };
    input.click();
  }, []);

  const uploadAudio = useCallback(async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    form.append('filename', file.name);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json() as { url: string };
    return json.url;
  }, []);

  const transcribeIfNeeded = useCallback(async (): Promise<string> => {
    if (script.trim()) return script.trim();
    if (!audioFile && !audioUrl) throw new Error('Provide script text or an audio file.');
    const url = audioUrl || (audioFile ? await uploadAudio(audioFile) : null);
    if (!url) throw new Error('No audio URL.');
    pushLog('Transcribing via Replicate…');
    const res = await fetch('/api/transcription/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audio_file: url }) });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json() as { text?: string };
    const text = (json.text || '').trim();
    if (!text) throw new Error('Empty transcript');
    setScript(text);
    return text;
  }, [audioFile, audioUrl, pushLog, script, uploadAudio]);

  const runAutoEdit = useCallback(async () => {
    setIsLoading(true);
    setSegments([]);
    setCandidates({});
    setSequence([]);
    setLogLines([]);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in at /auth to use Auto Edit.');

      const finalScript = await transcribeIfNeeded();
      pushLog('Segmenting script…');
      const segRes = await fetch('/api/script/segment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ script: finalScript }) });
      if (!segRes.ok) throw new Error(await segRes.text());
      const segJson = await segRes.json() as { segments: Array<Omit<Segment, 'id'>>; ideas_second_pass?: boolean; ideas_completed?: number };
      const segs = (segJson.segments || []).map((s, i) => ({ ...s, id: `seg_${i}` }));
      setSegments(segs);
      if (segJson.ideas_second_pass) {
        pushLog(`Generated rush ideas for segments (completed: ${typeof segJson.ideas_completed === 'number' ? segJson.ideas_completed : 'n/a'})…`);
      }
      const ideasCount = segs.reduce((acc, s) => acc + ((s.rush_ideas && s.rush_ideas.length > 0) ? 1 : 0), 0);
      pushLog(`Rush ideas present for ${ideasCount}/${segs.length} segments.`);

      pushLog('Retrieving matching assets…');
      const parts = segs.map((s) => ({ id: s.id, text: [s.text, s.desired_rush_description, ...(s.rush_ideas || [])].filter(Boolean).join('\n') }));
      const retRes = await fetch('/api/assets/retrieve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parts }) });
      if (!retRes.ok) throw new Error(await retRes.text());
      const retJson = await retRes.json() as { results: RetrieveResult };
      setCandidates(retJson.results || {});

      pushLog('Selecting best rush per segment…');
      const seqRes = await fetch('/api/sequence/choose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ segments: segs, candidates: retJson.results }) });
      if (!seqRes.ok) throw new Error(await seqRes.text());
      const seqJson = await seqRes.json() as { items: SequenceItem[] };
      setSequence(seqJson.items || []);
      pushLog('Done.');
    } catch (e: unknown) {
      pushLog(e instanceof Error ? e.message : 'Failed');
    } finally {
      setIsLoading(false);
    }
  }, [transcribeIfNeeded, pushLog]);

  useEffect(() => {
    if (audioFile && !audioUrl) {
      (async () => {
        try { const url = await uploadAudio(audioFile); setAudioUrl(url); } catch {}
      })();
    }
  }, [audioFile, audioUrl, uploadAudio]);

  const chosenBySegment = useMemo(() => {
    const map = new Map<string, SequenceItem>();
    for (const it of sequence) map.set(it.segment_id, it);
    return map;
  }, [sequence]);

  return (
    <div className="container" style={{ gridTemplateColumns: '1fr' }}>
      <div className="panel output">
        <div className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ margin: 0 }}>Auto Edit (BETA)</h2>
            <span className="badge">Replicate-only</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div className="small">Script (or transcribe from audio)</div>
            <textarea
              className="select"
              rows={8}
              placeholder="Paste your ad script or leave empty and upload audio to transcribe"
              value={script}
              onChange={(e) => setScript(e.target.value)}
            />
            <div className="row" style={{ marginTop: 8, alignItems: 'center', gap: 8 }}>
              <button className="btn" type="button" onClick={onPickAudio} onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' ') onPickAudio(); }}>
                Upload audio for transcription
              </button>
              {audioFile && <div className="small">🎙️ {audioFile.name}</div>}
              {audioUrl && <div className="small">🔗 Uploaded: {audioUrl}</div>}
            </div>
            <button className="btn" type="button" style={{ marginTop: 12 }} disabled={isLoading} onClick={runAutoEdit} onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' ') runAutoEdit(); }}>
              {isLoading ? 'Running…' : 'Run Auto Edit'}
            </button>
          </div>

          <div>
            <div style={{ margin: '8px 0 6px' }}>Log</div>
            <pre className="log">{logLines.join('\n')}</pre>
          </div>
        </div>
      </div>

      {segments.length > 0 && (
        <div className="panel" style={{ marginTop: 12 }}>
          <div className="header"><h3 style={{ margin: 0 }}>Sequence</h3></div>
          <div style={{ display: 'grid', gap: 12 }}>
            {segments.map((s) => {
              const chosen = chosenBySegment.get(s.id) || null;
              const list = candidates[s.id] || [];
              const selected = chosen ? list.find((x) => x.id === chosen.chosen_asset_id) || null : null;
              return (
                <div key={s.id} className="panel" style={{ padding: 12 }}>
                  <div className="small" style={{ opacity: .9 }}>Part {s.index + 1}</div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{s.text}</div>
                  <div className="small" style={{ marginBottom: 8, opacity: .8 }}>Rush needed: {s.desired_rush_description || '—'}</div>
                  <div className="small" style={{ marginBottom: 8 }}>
                    <div style={{ opacity: .8, marginBottom: 4 }}>Rush ideas:</div>
                    {(s.rush_ideas && s.rush_ideas.length > 0) ? (
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {s.rush_ideas.slice(0, 3).map((idea, idx) => (
                          <li key={idx}>{idea}</li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ opacity: .7 }}>—</div>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 12 }}>
                    <div>
                      {selected ? (
                        selected.kind === 'image' || /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(selected.public_url) ? (
                          <img src={selected.public_url} alt={selected.title || 'Selected image'} style={{ width: 240, maxWidth: '100%', borderRadius: 8 }} />
                        ) : (
                          <video src={selected.public_url} controls style={{ width: 240, maxWidth: '100%', borderRadius: 8 }} />
                        )
                      ) : (
                        <div className="small" style={{ opacity: .7 }}>No selection</div>
                      )}
                    </div>
                    <div>
                      <div className="small" style={{ marginBottom: 6 }}>Candidates</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {list.slice(0, 6).map((c) => (
                          <a key={c.id} href={c.public_url} target="_blank" rel="noreferrer" className="small" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 6 }}>
                            {c.title || 'asset'}{typeof c.score === 'number' ? ` (${Math.round(c.score * 100) / 100})` : ''}
                          </a>
                        ))}
                      </div>
                      {chosen?.reason && <div className="small" style={{ marginTop: 8, opacity: .8 }}>Reason: {chosen.reason}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}




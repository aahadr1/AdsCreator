'use client';

import '../globals.css';
import { useCallback, useState } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';

type TranscribeResponse = { text?: string | null; raw?: any };

export default function TranscriptionPage() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>('en');
  const [prompt, setPrompt] = useState<string>('');
  const [temperature, setTemperature] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  const onSelectAudio = useCallback((file: File) => {
    setAudioFile(file);
  }, []);

  const uploadAudio = useCallback(async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    form.append('filename', file.name);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { url: string };
    return json.url;
  }, []);

  async function runTranscription() {
    setIsLoading(true);
    setError(null);
    setTranscript(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in at /auth before creating a task.');
      if (!audioFile) throw new Error('Please select an audio file.');

      // Upload audio if not uploaded yet
      let uploadedAudioUrl = audioUrl;
      if (!uploadedAudioUrl) {
        uploadedAudioUrl = await uploadAudio(audioFile);
        setAudioUrl(uploadedAudioUrl);
      }

      const options = {
        language: language || undefined,
        prompt: prompt || undefined,
        temperature,
        audio_file: uploadedAudioUrl,
      } as Record<string, any>;

      // Create task
      const { data: inserted, error: insertErr } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          type: 'lipsync',
          status: 'queued',
          provider: 'replicate',
          model_id: 'openai/gpt-4o-transcribe',
          options_json: options,
          audio_url: uploadedAudioUrl,
          text_input: prompt || null,
        })
        .select('*')
        .single();
      if (insertErr || !inserted) throw new Error(insertErr?.message || 'Failed to create task');
      setTaskId(inserted.id);

      const res = await fetch('/api/transcription/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: language || undefined,
          prompt: prompt || undefined,
          temperature,
          audio_file: uploadedAudioUrl,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as TranscribeResponse;
      const text = json.text || '';
      setTranscript(text);

      if (inserted?.id) {
        await supabase
          .from('tasks')
          .update({ status: 'finished' })
          .eq('id', inserted.id);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to transcribe');
      if (taskId) {
        await supabase.from('tasks').update({ status: 'error' }).eq('id', taskId);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="panel output">
        <div className="header">
          <h2 style={{margin:0}}>Transcript</h2>
        </div>
        <div className="outputArea" style={{ whiteSpace: 'pre-wrap' }}>
          {transcript ? (
            <div>{transcript}</div>
          ) : (
            <div style={{fontSize:16, color:'#b7c2df'}}>The humanized transcript will appear here.</div>
          )}
        </div>
        {error && (
          <div className="small" style={{ color: '#ff7878' }}>{error}</div>
        )}
      </div>

      <div className="panel">
        <div className="header">
          <h3 style={{margin:0}}>Inputs</h3>
        </div>

        <div>
          <div className="small">Audio file</div>
          <label className="dnd" style={{display:'block'}}>
            <input
              type="file"
              accept="audio/*,video/mp4,video/webm"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onSelectAudio(f);
              }}
            />
            {audioFile ? (
              <div className="fileInfo">
                <span>{audioFile.name}</span>
                <span>({(audioFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
              </div>
            ) : (
              <div className="small" style={{color:'#b7c2df'}}>Click to select an audio file</div>
            )}
          </label>
        </div>

        <div className="options" style={{marginTop:12}}>
          <div>
            <div className="small">Language (ISO-639-1, e.g. en)</div>
            <input className="input" placeholder="en" value={language} onChange={(e)=>setLanguage(e.target.value)} />
          </div>
          <div>
            <div className="small">Temperature (0-1)</div>
            <input className="input" type="number" step={0.1} min={0} max={1} value={temperature} onChange={(e)=>setTemperature(parseFloat(e.target.value))} />
          </div>
        </div>

        <div style={{marginTop:12}}>
          <div className="small">Prompt (optional)</div>
          <textarea className="input" rows={4} placeholder="Optional style guide or context" value={prompt} onChange={(e)=>setPrompt(e.target.value)} />
        </div>

        <button className="btn" style={{ marginTop: 12 }} disabled={!audioFile || isLoading} onClick={runTranscription}>
          {isLoading ? 'Transcribing…' : 'Transcribe & Humanize'}
        </button>
      </div>
    </div>
  );
}



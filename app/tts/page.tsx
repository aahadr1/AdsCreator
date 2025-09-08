'use client';

export const dynamic = 'force-dynamic';

import '../globals.css';
import { useEffect, useState } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';

type TtsResponse = { url?: string | null; raw?: any };

export default function TtsPage() {
  const [text, setText] = useState('Hello from Text to Speech!');
  const [provider, setProvider] = useState<'replicate' | 'elevenlabs'>('replicate');
  const [voiceId, setVoiceId] = useState('Friendly_Person');
  const [elVoiceId, setElVoiceId] = useState('JBFqnCBsd6RMkjVDRZzb');
  const [elModelId, setElModelId] = useState('eleven_multilingual_v2');
  const [elOutputFormat, setElOutputFormat] = useState('mp3_44100_128');
  const [emotion, setEmotion] = useState<'auto' | 'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised'>('auto');
  const [speed, setSpeed] = useState(1);
  const [pitch, setPitch] = useState(0);
  const [volume, setVolume] = useState(1);
  const [languageBoost, setLanguageBoost] = useState('English');
  const [englishNormalization, setEnglishNormalization] = useState(true);
  
  // Additional advanced parameters
  const [sampleRate, setSampleRate] = useState<8000 | 16000 | 22050 | 24000 | 32000 | 44100>(44100);
  const [bitrate, setBitrate] = useState<32000 | 64000 | 128000 | 256000>(128000);
  const [channel, setChannel] = useState<'mono' | 'stereo'>('stereo');

  // ElevenLabs voices
  const [elVoices, setElVoices] = useState<Array<{ voice_id: string; name: string }>>([]);
  const [elVoicesLoading, setElVoicesLoading] = useState(false);
  const [elVoicesError, setElVoicesError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVoices() {
      try {
        setElVoicesError(null);
        setElVoicesLoading(true);
        const res = await fetch('/api/tts/voices', { cache: 'no-store' });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const voices = Array.isArray(data?.voices)
          ? data.voices
          : Array.isArray(data)
            ? data
            : [];
        const normalized = voices
          .map((v: any) => ({ voice_id: v.voice_id || v.id, name: v.name }))
          .filter((v: any) => v.voice_id && v.name);
        setElVoices(normalized);
        if (normalized.length > 0) {
          const exists = normalized.some((v: any) => v.voice_id === elVoiceId);
          if (!exists) setElVoiceId(normalized[0].voice_id);
        }
      } catch (e: any) {
        setElVoicesError(e?.message || 'Failed to load ElevenLabs voices');
      } finally {
        setElVoicesLoading(false);
      }
    }
    if (provider === 'elevenlabs') {
      fetchVoices();
    }
  }, [provider]);

  async function runTts() {
    setIsLoading(true);
    setError(null);
    setAudioUrl(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in at /auth before creating a task.');

      // Create task row first
      const options = {
        emotion,
        speed,
        pitch,
        volume,
        language_boost: languageBoost,
        english_normalization: englishNormalization,
        provider,
        model_id: provider === 'elevenlabs' ? elModelId : undefined,
        output_format: provider === 'elevenlabs' ? elOutputFormat : undefined,
        voice_id: provider === 'replicate' ? voiceId : elVoiceId,
      };
      const { data: inserted, error: insertErr } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          type: 'tts',
          status: 'queued',
          provider,
          model_id: provider === 'elevenlabs' ? elModelId : null,
          options_json: options,
          text_input: text,
        })
        .select('*')
        .single();
      if (insertErr || !inserted) throw new Error(insertErr?.message || 'Failed to create task');
      setTaskId(inserted.id);

      const res = await fetch('/api/tts/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          provider,
          voice_id: provider === 'replicate' ? voiceId : elVoiceId,
          model_id: provider === 'elevenlabs' ? elModelId : undefined,
          output_format: provider === 'elevenlabs' ? elOutputFormat : undefined,
          emotion,
          speed,
          pitch,
          volume,
          language_boost: languageBoost,
          english_normalization: englishNormalization,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as TtsResponse;
      if (!json.url) throw new Error('No audio URL returned');
      setAudioUrl(json.url);

      if (inserted?.id) {
        await supabase
          .from('tasks')
          .update({ status: 'finished', output_url: json.url })
          .eq('id', inserted.id);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to run TTS');
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
          <h2 style={{margin:0}}>Output</h2>
        </div>
        <div className="outputArea">
          {audioUrl ? (
            <div>
              <audio src={audioUrl} controls style={{ width: '100%' }} />
              <div className="small" style={{ marginTop: 8, display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
                <a href={audioUrl} target="_blank" rel="noreferrer" style={{padding:'8px 12px', background:'var(--panel-elevated)', borderRadius:'6px', textDecoration:'none'}}>Open</a>
                <a href={`/api/proxy?download=true&url=${encodeURIComponent(audioUrl)}`} style={{padding:'8px 12px', background:'var(--accent)', color:'white', borderRadius:'6px', textDecoration:'none'}}>Download</a>
              </div>
            </div>
          ) : (
            <div style={{fontSize:16, color:'#b7c2df'}}>Generated audio will appear here.</div>
          )}
        </div>
        {error && (
          <div className="small" style={{ color: '#ff7878' }}>{error}</div>
        )}
      </div>

      <div className="panel">
        <div className="header">
          <h3 style={{margin:0}}>Text-to-Speech</h3>
          <span className="badge">AI Voice Synthesis</span>
        </div>

        <div className="options">
          <div style={{gridColumn: 'span 2'}}>
            <div className="small">Provider</div>
            <select className="select" value={provider} onChange={(e)=>setProvider(e.target.value as any)}>
              <option value="replicate">Replicate (minimax/speech-02-hd)</option>
              <option value="elevenlabs">ElevenLabs (Premium Quality)</option>
            </select>
          </div>
        </div>

        <div className="options">
          <div style={{gridColumn: 'span 2'}}>
            <div className="small">Text to Convert</div>
            <textarea
              className="input"
              value={text}
              onChange={(e)=>setText(e.target.value)}
              rows={5}
              placeholder="Enter the text you want to convert to speech (up to 5000 characters)..."
            />
            <div className="small" style={{marginTop: 'var(--space-2)', textAlign: 'right', color: 'var(--text-muted)'}}>
              {text.length} / 5000 characters
            </div>
          </div>
        </div>

        {/* Voice Selection */}
        <div className="options">
          {provider === 'replicate' ? (
            <div style={{gridColumn: 'span 2'}}>
              <div className="small">Voice Character</div>
              <select className="select" value={voiceId} onChange={(e)=>setVoiceId(e.target.value)}>
                <option value="Wise_Woman">Wise Woman</option>
                <option value="Friendly_Person">Friendly Person</option>
                <option value="Inspirational_girl">Inspirational Girl</option>
                <option value="Deep_Voice_Man">Deep Voice Man</option>
                <option value="Calm_Woman">Calm Woman</option>
                <option value="Casual_Guy">Casual Guy</option>
                <option value="Lively_Girl">Lively Girl</option>
                <option value="Patient_Man">Patient Man</option>
                <option value="Young_Knight">Young Knight</option>
                <option value="Determined_Man">Determined Man</option>
                <option value="Lovely_Girl">Lovely Girl</option>
                <option value="Decent_Boy">Decent Boy</option>
                <option value="Imposing_Manner">Imposing Manner</option>
                <option value="Elegant_Man">Elegant Man</option>
                <option value="Abbess">Abbess</option>
                <option value="Sweet_Girl_2">Sweet Girl 2</option>
                <option value="Exuberant_Girl">Exuberant Girl</option>
              </select>
            </div>
          ) : (
            <>
              <div>
                <div className="small">ElevenLabs Voice</div>
                {elVoicesLoading ? (
                  <div className="small" style={{ color: 'var(--text-muted)' }}>Loading voices…</div>
                ) : elVoicesError ? (
                  <>
                    <div className="small" style={{ color: 'var(--red)' }}>{elVoicesError}</div>
                    <input className="input" value={elVoiceId} onChange={(e)=>setElVoiceId(e.target.value)} placeholder="Voice ID (e.g. JBFqnC...)" />
                  </>
                ) : (
                  <select className="select" value={elVoiceId} onChange={(e)=>setElVoiceId(e.target.value)}>
                    {elVoices.map(v => (
                      <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <div className="small">Model</div>
                <select className="select" value={elModelId} onChange={(e)=>setElModelId(e.target.value)}>
                  <option value="eleven_multilingual_v2">Multilingual V2</option>
                  <option value="eleven_monolingual_v1">Monolingual V1</option>
                  <option value="eleven_turbo_v2">Turbo V2 (Fast)</option>
                </select>
              </div>
              <div>
                <div className="small">Output Format</div>
                <select className="select" value={elOutputFormat} onChange={(e)=>setElOutputFormat(e.target.value)}>
                  <option value="mp3_44100_128">MP3 44.1kHz 128kbps</option>
                  <option value="mp3_44100_64">MP3 44.1kHz 64kbps</option>
                  <option value="mp3_22050_32">MP3 22kHz 32kbps</option>
                  <option value="wav_44100">WAV 44.1kHz</option>
                </select>
              </div>
            </>
          )}
        </div>

        {/* Voice Parameters */}
        <div className="options">
          <div>
            <div className="small">Emotion</div>
            <select className="select" value={emotion} onChange={(e)=>setEmotion(e.target.value as any)}>
              <option value="auto">Auto</option>
              <option value="neutral">Neutral</option>
              <option value="happy">Happy</option>
              <option value="sad">Sad</option>
              <option value="angry">Angry</option>
              <option value="fearful">Fearful</option>
              <option value="disgusted">Disgusted</option>
              <option value="surprised">Surprised</option>
            </select>
          </div>

          <div>
            <div className="small">Speed</div>
            <input className="input" type="number" step={0.1} min={0.5} max={2} value={speed} onChange={(e)=>setSpeed(parseFloat(e.target.value))} />
          </div>

          <div>
            <div className="small">Pitch</div>
            <input className="input" type="number" step={1} min={-12} max={12} value={pitch} onChange={(e)=>setPitch(parseInt(e.target.value))} />
          </div>

          <div>
            <div className="small">Volume</div>
            <input className="input" type="number" step={0.1} min={0} max={10} value={volume} onChange={(e)=>setVolume(parseFloat(e.target.value))} />
          </div>
        </div>

        {/* Advanced Audio Settings */}
        <div className="options">
          <div>
            <div className="small">Sample Rate</div>
            <select className="select" value={sampleRate} onChange={(e)=>setSampleRate(parseInt(e.target.value) as any)}>
              <option value={44100}>44.1 kHz (CD Quality)</option>
              <option value={32000}>32 kHz</option>
              <option value={24000}>24 kHz</option>
              <option value={22050}>22.05 kHz</option>
              <option value={16000}>16 kHz</option>
              <option value={8000}>8 kHz (Phone Quality)</option>
            </select>
          </div>

          <div>
            <div className="small">Bitrate</div>
            <select className="select" value={bitrate} onChange={(e)=>setBitrate(parseInt(e.target.value) as any)}>
              <option value={256000}>256 kbps (High)</option>
              <option value={128000}>128 kbps (Standard)</option>
              <option value={64000}>64 kbps (Medium)</option>
              <option value={32000}>32 kbps (Low)</option>
            </select>
          </div>

          <div>
            <div className="small">Channel</div>
            <select className="select" value={channel} onChange={(e)=>setChannel(e.target.value as any)}>
              <option value="stereo">Stereo</option>
              <option value="mono">Mono</option>
            </select>
          </div>

          <div>
            <div className="small">Language Boost</div>
            <select className="select" value={languageBoost} onChange={(e)=>setLanguageBoost(e.target.value)}>
              <option value="English">English</option>
              <option value="Automatic">Automatic</option>
              <option value="None">None</option>
              <option value="Chinese">Chinese</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Italian">Italian</option>
              <option value="Portuguese">Portuguese</option>
              <option value="Russian">Russian</option>
              <option value="Japanese">Japanese</option>
              <option value="Korean">Korean</option>
              <option value="Arabic">Arabic</option>
              <option value="Hindi">Hindi</option>
            </select>
          </div>
        </div>

        {provider === 'replicate' && (
          <label className="small" style={{display:'flex', gap:8, alignItems:'center', marginTop:8}}>
            <input type="checkbox" checked={englishNormalization} onChange={(e)=>setEnglishNormalization(e.target.checked)} /> English normalization
          </label>
        )}

        <button className="btn" style={{ marginTop: 12 }} disabled={!text.trim() || isLoading} onClick={runTts}>
          {isLoading ? 'Generating…' : 'Generate speech'}
        </button>
      </div>
    </div>
  );
}



'use client';

import '../globals.css';
import { useEffect, useMemo, useState } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';
import { CreditGuard, CreditCostDisplay, CreditBanner } from '../../components/CreditGuard';
import { useCredits } from '../../lib/creditContext';

type TtsResponse = { url?: string | null; raw?: any };

export default function TtsPage() {
  const [text, setText] = useState('Hello from Text to Speech!');
  const [provider, setProvider] = useState<'replicate' | 'kokoro'>('replicate');
  const [voiceId, setVoiceId] = useState('Friendly_Person');
  const [kokoroVoice, setKokoroVoice] = useState('af_nicole');
  const [kokoroSpeed, setKokoroSpeed] = useState(1);
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

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [kvTaskId, setKvTaskId] = useState<string | null>(null);
  
  // Credit system
  const { credits, hasEnoughCredits, formatProgress } = useCredits();
  
  const providerLabel = useMemo(() => {
    if (provider === 'kokoro') return 'Kokoro 82M (Multilingual · 46 Voices)';
    return 'Replicate (minimax/speech-02-hd)';
  }, [provider]);

  // Get model name for credit tracking
  const modelName = useMemo(() => {
    if (provider === 'kokoro') return 'jaaari/kokoro-82m';
    return 'minimax-speech-02-hd';
  }, [provider]);

  const canGenerate = useMemo(() => {
    return text.trim() && !isLoading && hasEnoughCredits(modelName);
  }, [text, isLoading, hasEnoughCredits, modelName]);


  async function runTts() {
    let kvIdLocal: string | null = null;
    setIsLoading(true);
    setError(null);
    setAudioUrl(null);
    // Update global task state for favicon
    const { updateTaskStateFromJobStatus } = await import('../../lib/taskStateHelper');
    updateTaskStateFromJobStatus('queued');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in at /auth before creating a task.');

      // Create task row first
      const options = {
        emotion,
        speed: provider === 'kokoro' ? kokoroSpeed : speed,
        pitch,
        volume,
        language_boost: languageBoost,
        english_normalization: englishNormalization,
        provider,
        voice_id: provider === 'replicate' ? voiceId : provider === 'kokoro' ? kokoroVoice : undefined,
      };
      // Also create KV task so it appears in /tasks
      let kvIdLocal: string | null = null;
      try {
        const createRes = await fetch('/api/tasks/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            type: 'tts',
            status: 'queued',
            provider,
            model_id: null,
            options_json: options,
            text_input: text,
          })
        });
        if (createRes.ok) {
          const created = await createRes.json();
          kvIdLocal = created?.id || null;
          setKvTaskId(kvIdLocal);
        }
      } catch {}

      const { data: inserted, error: insertErr } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          type: 'tts',
          status: 'queued',
          provider,
          model_id: null,
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
          user_id: user.id, // Add user_id for credit tracking
          provider,
          voice_id: provider === 'replicate' ? voiceId : provider === 'kokoro' ? kokoroVoice : undefined,
          emotion,
          speed: provider === 'kokoro' ? kokoroSpeed : speed,
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
      // Update global task state for favicon - success
      const { updateTaskStateFromJobStatus } = await import('../../lib/taskStateHelper');
      updateTaskStateFromJobStatus('success');

      if (inserted?.id) {
        await supabase
          .from('tasks')
          .update({ status: 'finished', output_url: json.url })
          .eq('id', inserted.id);
      }
      if (kvIdLocal) {
        try { await fetch('/api/tasks/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: kvIdLocal, status: 'finished', output_url: json.url }) }); } catch {}
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to run TTS');
      // Update global task state for favicon - error
      const { updateTaskStateFromJobStatus } = await import('../../lib/taskStateHelper');
      updateTaskStateFromJobStatus('error');
      if (taskId) {
        await supabase.from('tasks').update({ status: 'error' }).eq('id', taskId);
      }
      if (kvIdLocal || kvTaskId) {
        try { await fetch('/api/tasks/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: (kvIdLocal || kvTaskId) as string, status: 'error' }) }); } catch {}
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container">
      {/* Credit status banners */}
      {credits && formatProgress().status === 'warning' && (
        <CreditBanner type="warning" />
      )}
      {credits && formatProgress().status === 'critical' && (
        <CreditBanner type="critical" />
      )}
      
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
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
              <CreditCostDisplay modelName="minimax-speech-02-hd" variant="detailed" showProvider />
              <CreditCostDisplay modelName="jaaari/kokoro-82m" variant="detailed" showProvider />
            </div>
            <select className="select" value={provider} onChange={(e)=>setProvider(e.target.value as any)}>
              <option value="replicate">Replicate (minimax/speech-02-hd) - 5 credits</option>
              <option value="kokoro">Kokoro 82M (Multilingual · 46 Voices) - 3 credits</option>
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
          ) : provider === 'kokoro' ? (
            <>
              <div>
                <div className="small">Kokoro Voice (46 voices, 6+ languages)</div>
                <select className="select" value={kokoroVoice} onChange={(e)=>setKokoroVoice(e.target.value)}>
                  <optgroup label="American English (Female)">
                    <option value="af_alloy">AF Alloy</option>
                    <option value="af_aoede">AF Aoede</option>
                    <option value="af_bella">AF Bella (High Quality)</option>
                    <option value="af_jessica">AF Jessica</option>
                    <option value="af_kore">AF Kore</option>
                    <option value="af_nicole">AF Nicole (Default)</option>
                    <option value="af_nova">AF Nova</option>
                    <option value="af_river">AF River</option>
                    <option value="af_sarah">AF Sarah</option>
                    <option value="af_sky">AF Sky</option>
                  </optgroup>
                  <optgroup label="American English (Male)">
                    <option value="am_adam">AM Adam</option>
                    <option value="am_echo">AM Echo</option>
                    <option value="am_eric">AM Eric</option>
                    <option value="am_fenrir">AM Fenrir</option>
                    <option value="am_liam">AM Liam</option>
                    <option value="am_michael">AM Michael</option>
                    <option value="am_onyx">AM Onyx</option>
                    <option value="am_puck">AM Puck</option>
                  </optgroup>
                  <optgroup label="British English (Female)">
                    <option value="bf_alice">BF Alice</option>
                    <option value="bf_emma">BF Emma</option>
                    <option value="bf_isabella">BF Isabella</option>
                    <option value="bf_lily">BF Lily</option>
                  </optgroup>
                  <optgroup label="British English (Male)">
                    <option value="bm_daniel">BM Daniel</option>
                    <option value="bm_fable">BM Fable</option>
                    <option value="bm_george">BM George</option>
                    <option value="bm_lewis">BM Lewis</option>
                  </optgroup>
                  <optgroup label="French">
                    <option value="ff_siwis">FF Siwis</option>
                  </optgroup>
                  <optgroup label="Hindi">
                    <option value="hf_alpha">HF Alpha (Female)</option>
                    <option value="hf_beta">HF Beta (Female)</option>
                    <option value="hm_omega">HM Omega (Male)</option>
                    <option value="hm_psi">HM Psi (Male)</option>
                  </optgroup>
                  <optgroup label="Italian">
                    <option value="if_sara">IF Sara (Female)</option>
                    <option value="im_nicola">IM Nicola (Male)</option>
                  </optgroup>
                  <optgroup label="Japanese">
                    <option value="jf_alpha">JF Alpha (Female)</option>
                    <option value="jf_gongitsune">JF Gongitsune (Female)</option>
                    <option value="jf_nezumi">JF Nezumi (Female)</option>
                    <option value="jf_tebukuro">JF Tebukuro (Female)</option>
                    <option value="jm_kumo">JM Kumo (Male)</option>
                  </optgroup>
                  <optgroup label="Mandarin Chinese">
                    <option value="zf_xiaobei">ZF Xiaobei (Female)</option>
                    <option value="zf_xiaoni">ZF Xiaoni (Female)</option>
                    <option value="zf_xiaoxiao">ZF Xiaoxiao (Female)</option>
                    <option value="zf_xiaoyi">ZF Xiaoyi (Female)</option>
                    <option value="zm_yunjian">ZM Yunjian (Male)</option>
                    <option value="zm_yunxi">ZM Yunxi (Male)</option>
                    <option value="zm_yunxia">ZM Yunxia (Male)</option>
                    <option value="zm_yunyang">ZM Yunyang (Male)</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <div className="small">Speed (0.5x - 2.0x)</div>
                <input 
                  type="number" 
                  className="input" 
                  value={kokoroSpeed} 
                  onChange={(e)=>setKokoroSpeed(Number(e.target.value))} 
                  min={0.5} 
                  max={2.0} 
                  step={0.1}
                  placeholder="1.0"
                />
                <div className="small" style={{ color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                  {kokoroSpeed < 1 ? `${kokoroSpeed}x slower` : kokoroSpeed > 1 ? `${kokoroSpeed}x faster` : 'Normal speed'}
                </div>
              </div>
            </>
          ) : null}
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
        {provider === 'replicate' && (
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
        )}

        {provider === 'replicate' && (
          <label className="small" style={{display:'flex', gap:8, alignItems:'center', marginTop:8}}>
            <input type="checkbox" checked={englishNormalization} onChange={(e)=>setEnglishNormalization(e.target.checked)} /> English normalization
          </label>
        )}

        <CreditGuard
          modelName={modelName}
          onInsufficientCredits={() => setError('Insufficient credits. Please upgrade your plan to continue.')}
        >
          <button 
            className="btn" 
            style={{ marginTop: 12 }} 
            disabled={!canGenerate} 
            onClick={runTts}
          >
            {isLoading ? 'Generating…' : 'Generate speech'}
          </button>
        </CreditGuard>
      </div>
    </div>
  );
}



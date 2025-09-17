'use client';

import '../globals.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Download,
  Eye,
  Sparkles,
  Mic,
  Image,
  Video,
  Scissors,
  Settings,
  Plus,
  Trash2,
  Upload,
  Save,
  FileText,
  Volume2,
  Zap,
  Clock,
  CheckCircle,
  AlertCircle,
  X
} from 'lucide-react';

// Types
type CreativeStep = 'concept' | 'avatar-voice' | 'base-video' | 'broll' | 'summary';
type CreativeStatus = 'draft' | 'in-progress' | 'ready' | 'error';
type JobStatus = 'queued' | 'running' | 'finished' | 'error' | 'cancelled' | 'unknown';

interface Creative {
  id: string;
  user_id: string;
  name: string;
  hook: string;
  message: string;
  cta: string;
  angles: string[];
  status: CreativeStatus;
  current_step: CreativeStep;
  
  // Avatar & Voice data
  avatar_url?: string | null;
  script?: string | null;
  audio_url?: string | null;
  voice_provider?: 'elevenlabs' | 'minimax' | 'dia' | null;
  voice_id?: string | null;
  
  // Base video data  
  base_video_url?: string | null;
  base_video_job_id?: string | null;
  background_removed?: boolean;
  
  // B-roll data
  script_segments?: ScriptSegment[] | null;
  broll_items?: BrollItem[] | null;
  
  // Final output
  final_video_url?: string | null;
  
  created_at: string;
  updated_at: string;
}

interface ScriptSegment {
  id: string;
  text: string;
  start_time: number;
  end_time: number;
  order: number;
}

interface BrollItem {
  id: string;
  segment_id: string;
  type: 'image' | 'video' | 'infinite-talk';
  url?: string | null;
  prompt?: string | null;
  generation_status: JobStatus;
  job_id?: string | null;
  overlay_text?: string | null;
}

// Predefined angles library (this would come from database in production)
const ANGLE_LIBRARY = [
  'Problem/Solution',
  'Before/After Transformation', 
  'Social Proof/Testimonial',
  'Limited Time Offer',
  'Comparison/Competitive',
  'Behind the Scenes',
  'User Generated Content',
  'How-To/Educational',
  'Seasonal/Trending',
  'Fear of Missing Out (FOMO)',
  'Authority/Expert',
  'Story/Narrative'
];

// Step navigation
const STEPS: { key: CreativeStep; label: string; icon: React.ReactNode }[] = [
  { key: 'concept', label: 'Concept', icon: <Sparkles size={18} /> },
  { key: 'avatar-voice', label: 'Avatar & Voice', icon: <Mic size={18} /> },
  { key: 'base-video', label: 'Base Video', icon: <Video size={18} /> },
  { key: 'broll', label: 'B-roll', icon: <Image size={18} /> },
  { key: 'summary', label: 'Summary', icon: <CheckCircle size={18} /> }
];

export default function AdCreativePage() {
  const [currentStep, setCurrentStep] = useState<CreativeStep>('concept');
  const [creative, setCreative] = useState<Partial<Creative>>({
    name: '',
    hook: '',
    message: '',
    cta: '',
    angles: [],
    status: 'draft',
    current_step: 'concept'
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('unsaved');

  // Avatar & Voice step state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [scriptGenerating, setScriptGenerating] = useState(false);
  const [voiceProvider, setVoiceProvider] = useState<'elevenlabs' | 'minimax' | 'dia'>('elevenlabs');
  const [voiceId, setVoiceId] = useState('JBFqnCBsd6RMkjVDRZzb');
  
  // Base video step state
  const [baseVideoJobId, setBaseVideoJobId] = useState<string | null>(null);
  const [baseVideoStatus, setBaseVideoStatus] = useState<JobStatus>('unknown');
  const [backgroundRemovalEnabled, setBackgroundRemovalEnabled] = useState(false);
  
  // B-roll step state
  const [scriptSegments, setScriptSegments] = useState<ScriptSegment[]>([]);
  const [brollItems, setBrollItems] = useState<BrollItem[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  
  // Polling refs
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // Auto-save effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (saveStatus === 'unsaved' && (creative.name || creative.hook)) {
        handleSave();
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [creative, saveStatus, handleSave]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (streamRef.current) streamRef.current.cancel();
    };
  }, []);

  const handleSave = useCallback(async () => {
    try {
      setSaveStatus('saving');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in to continue');

      if (creative.id) {
        // Update existing
        const { error } = await supabase
          .from('ad_creatives')
          .update({ 
            ...creative, 
            updated_at: new Date().toISOString(),
            current_step: currentStep 
          })
          .eq('id', creative.id);
        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('ad_creatives')
          .insert({ 
            ...creative, 
            user_id: user.id,
            current_step: currentStep,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        if (error) throw error;
        setCreative(prev => ({ ...prev, id: data.id }));
      }
      setSaveStatus('saved');
    } catch (e: any) {
      setError(`Save failed: ${e.message}`);
      setSaveStatus('unsaved');
    }
  }, [creative, currentStep]);

  const updateCreative = (updates: Partial<Creative>) => {
    setCreative(prev => ({ ...prev, ...updates }));
    setSaveStatus('unsaved');
  };

  const nextStep = () => {
    const currentIndex = STEPS.findIndex(s => s.key === currentStep);
    if (currentIndex < STEPS.length - 1) {
      const nextStepKey = STEPS[currentIndex + 1].key;
      setCurrentStep(nextStepKey);
      updateCreative({ current_step: nextStepKey });
    }
  };

  const prevStep = () => {
    const currentIndex = STEPS.findIndex(s => s.key === currentStep);
    if (currentIndex > 0) {
      const prevStepKey = STEPS[currentIndex - 1].key;
      setCurrentStep(prevStepKey);
      updateCreative({ current_step: prevStepKey });
    }
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 'concept':
        return creative.name && creative.hook && creative.message && creative.cta && creative.angles?.length;
      case 'avatar-voice':
        return (avatarUrl || avatarFile) && creative.script && creative.audio_url;
      case 'base-video':
        return creative.base_video_url;
      case 'broll':
        return scriptSegments.length > 0;
      case 'summary':
        return true;
      default:
        return false;
    }
  };

  // Step Components
  const ConceptStep = () => (
    <div className="step-content">
      <div className="step-header">
        <h2>Creative Concept</h2>
        <p>Define your ad&apos;s core message and targeting approach</p>
      </div>
      
      <div className="panel">
        <div className="header">
          <h3 style={{margin: 0}}>Basic Information</h3>
        </div>
        <div className="options">
          <div style={{gridColumn: 'span 2'}}>
            <div className="small">Creative Name</div>
            <input 
              className="input" 
              value={creative.name || ''} 
              onChange={(e) => updateCreative({ name: e.target.value })}
              placeholder="e.g., Summer Cooling Blanket BOGO Campaign"
            />
          </div>
          <div style={{gridColumn: 'span 2'}}>
            <div className="small">Hook (Opening Line)</div>
            <input 
              className="input" 
              value={creative.hook || ''} 
              onChange={(e) => updateCreative({ hook: e.target.value })}
              placeholder="e.g., Stop sweating through the night with this game-changing blanket"
            />
          </div>
          <div style={{gridColumn: 'span 2'}}>
            <div className="small">Core Message</div>
            <textarea 
              className="input" 
              rows={3}
              value={creative.message || ''} 
              onChange={(e) => updateCreative({ message: e.target.value })}
              placeholder="e.g., Our cooling blanket uses advanced fabric technology to regulate temperature and eliminate night sweats, giving you the best sleep of your life."
            />
          </div>
          <div>
            <div className="small">Call to Action</div>
            <input 
              className="input" 
              value={creative.cta || ''} 
              onChange={(e) => updateCreative({ cta: e.target.value })}
              placeholder="e.g., Shop now - Buy one, get one FREE!"
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="header">
          <h3 style={{margin: 0}}>Angles & Approaches</h3>
          <span className="badge">Select multiple</span>
        </div>
        <div className="angle-grid">
          {ANGLE_LIBRARY.map(angle => (
            <label key={angle} className="angle-item">
              <input 
                type="checkbox"
                checked={creative.angles?.includes(angle) || false}
                onChange={(e) => {
                  const current = creative.angles || [];
                  const updated = e.target.checked 
                    ? [...current, angle]
                    : current.filter(a => a !== angle);
                  updateCreative({ angles: updated });
                }}
              />
              <span>{angle}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="panel" style={{background: 'var(--panel-elevated)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-lg)'}}>
        <div className="header">
          <h3 style={{margin: 0, color: 'var(--accent)'}}>Preview Tags</h3>
        </div>
        <div className="preview-tags">
          {creative.angles?.map(angle => (
            <span key={angle} className="tag">{angle}</span>
          ))}
          {creative.hook && <span className="tag hook-tag">Hook: {creative.hook}</span>}
          {creative.cta && <span className="tag cta-tag">CTA: {creative.cta}</span>}
        </div>
      </div>
    </div>
  );

  const AvatarVoiceStep = () => (
    <div className="step-content">
      <div className="step-header">
        <h2>Avatar & Voice</h2>
        <p>Set up your spokesperson and generate the script with voiceover</p>
      </div>

      <div className="panel">
        <div className="header">
          <h3 style={{margin: 0}}>Avatar Selection</h3>
        </div>
        <div 
          className="dnd avatar-upload"
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async () => {
              const file = input.files?.[0];
              if (file) {
                setAvatarFile(file);
                // Upload file
                const form = new FormData();
                form.append('file', file);
                form.append('filename', file.name);
                try {
                  const res = await fetch('/api/upload', { method: 'POST', body: form });
                  if (!res.ok) throw new Error(await res.text());
                  const data = await res.json();
                  setAvatarUrl(data.url);
                  updateCreative({ avatar_url: data.url });
                } catch (e: any) {
                  setError(`Upload failed: ${e.message}`);
                }
              }
            };
            input.click();
          }}
        >
          {avatarUrl || avatarFile ? (
            <div className="avatar-preview">
              <img src={avatarUrl || URL.createObjectURL(avatarFile!)} alt="Selected avatar" />
              <div className="small">Avatar uploaded</div>
            </div>
          ) : (
            <div>
              <Upload size={32} />
              <div>Upload Avatar Photo</div>
              <div className="small">JPG/PNG • Clear face visible • 1:1 ratio preferred</div>
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="header">
          <h3 style={{margin: 0}}>Script Generation</h3>
        </div>
        <button 
          className="btn"
          disabled={!creative.name || scriptGenerating}
          onClick={async () => {
            setScriptGenerating(true);
            try {
              const prompt = `Create a ${30}-second video ad script using this information:
              
Creative Name: ${creative.name}
Hook: ${creative.hook}
Message: ${creative.message}
CTA: ${creative.cta}
Angles: ${creative.angles?.join(', ')}

Make it conversational, engaging, and perfect for a spokesperson video. Include natural transitions and emotional connection points.`;

              const res = await fetch('/api/adscript/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt,
                  max_tokens: 512
                })
              });
              
              if (!res.ok) throw new Error(await res.text());
              
              const reader = res.body?.getReader();
              streamRef.current = reader || null;
              const decoder = new TextDecoder();
              let script = '';
              
              while (reader) {
                const { value, done } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                script += chunk;
                updateCreative({ script });
              }
            } catch (e: any) {
              setError(`Script generation failed: ${e.message}`);
            } finally {
              setScriptGenerating(false);
            }
          }}
        >
          {scriptGenerating ? 'Generating Script...' : 'Generate Script'}
        </button>
        
        {creative.script && (
          <div style={{marginTop: 16}}>
            <div className="small">Generated Script</div>
            <textarea 
              className="input script-area" 
              rows={8}
              value={creative.script}
              onChange={(e) => updateCreative({ script: e.target.value })}
            />
          </div>
        )}
      </div>

      <div className="panel">
        <div className="header">
          <h3 style={{margin: 0}}>Voice Generation</h3>
        </div>
        <div className="options">
          <div>
            <div className="small">Provider</div>
            <select 
              className="select" 
              value={voiceProvider} 
              onChange={(e) => setVoiceProvider(e.target.value as any)}
            >
              <option value="elevenlabs">ElevenLabs (Premium)</option>
              <option value="minimax">Minimax (Fast)</option>
              <option value="dia">Dia (Dialogue)</option>
            </select>
          </div>
          <div>
            <div className="small">Voice ID</div>
            <input 
              className="input"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              placeholder="Voice ID"
            />
          </div>
        </div>
        
        <button 
          className="btn"
          disabled={!creative.script || isLoading}
          onClick={async () => {
            setIsLoading(true);
            try {
              const res = await fetch('/api/tts/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: creative.script,
                  provider: voiceProvider,
                  voice_id: voiceId
                })
              });
              
              if (!res.ok) throw new Error(await res.text());
              const data = await res.json();
              updateCreative({ 
                audio_url: data.url,
                voice_provider: voiceProvider,
                voice_id: voiceId
              });
            } catch (e: any) {
              setError(`Voice generation failed: ${e.message}`);
            } finally {
              setIsLoading(false);
            }
          }}
        >
          {isLoading ? 'Generating Voice...' : 'Generate Voice'}
        </button>

        {creative.audio_url && (
          <div style={{marginTop: 16}}>
            <audio controls src={creative.audio_url} style={{width: '100%'}} />
          </div>
        )}
      </div>
    </div>
  );

  const BaseVideoStep = () => (
    <div className="step-content">
      <div className="step-header">
        <h2>Base Video Generation</h2>
        <p>Create your talking head video using Infinite Talk</p>
      </div>

      <div className="panel">
        <div className="header">
          <h3 style={{margin: 0}}>Infinite Talk Generation</h3>
          <span className="badge">AI Lipsync</span>
        </div>
        
        <button 
          className="btn"
          disabled={!avatarUrl || !creative.audio_url || baseVideoStatus === 'running'}
          onClick={async () => {
            setBaseVideoStatus('running');
            try {
              const res = await fetch('/api/infinite-talk/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  inputUrl: avatarUrl,
                  audioUrl: creative.audio_url,
                  options: {
                    resolution: '720',
                    generation_mode: 'image-to-video'
                  }
                })
              });
              
              if (!res.ok) throw new Error(await res.text());
              const data = await res.json();
              setBaseVideoJobId(data.id);
              
              // Poll for completion
              pollRef.current = setInterval(async () => {
                const statusRes = await fetch(`/api/infinite-talk/status?id=${data.id}`);
                if (statusRes.ok) {
                  const statusData = await statusRes.json();
                  setBaseVideoStatus(statusData.status);
                  
                  if (statusData.status === 'finished' && statusData.outputs?.[0]) {
                    updateCreative({ 
                      base_video_url: statusData.outputs[0],
                      base_video_job_id: data.id 
                    });
                    if (pollRef.current) clearInterval(pollRef.current);
                  } else if (statusData.status === 'failed') {
                    setError('Base video generation failed');
                    if (pollRef.current) clearInterval(pollRef.current);
                  }
                }
              }, 3000);
              
            } catch (e: any) {
              setError(`Base video generation failed: ${e.message}`);
              setBaseVideoStatus('error');
            }
          }}
        >
          {baseVideoStatus === 'running' ? 'Generating Video...' : 'Generate Base Video'}
        </button>

        {creative.base_video_url && (
          <div style={{marginTop: 16}}>
            <video 
              src={creative.base_video_url} 
              controls 
              style={{width: '100%', maxHeight: '400px', borderRadius: '8px'}} 
            />
          </div>
        )}
      </div>

      {creative.base_video_url && (
        <div className="panel">
          <div className="header">
            <h3 style={{margin: 0}}>Background Removal</h3>
            <span className="badge">Optional</span>
          </div>
          
          <label className="checkbox-item">
            <input 
              type="checkbox"
              checked={backgroundRemovalEnabled}
              onChange={(e) => setBackgroundRemovalEnabled(e.target.checked)}
            />
            <span>Remove background from base video</span>
          </label>
          
          {backgroundRemovalEnabled && (
            <button 
              className="btn"
              onClick={async () => {
                try {
                  const res = await fetch('/api/background/remove', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      video_url: creative.base_video_url,
                      output_basename: `${creative.name}_bg_removed`
                    })
                  });
                  
                  if (!res.ok) throw new Error(await res.text());
                  const data = await res.json();
                  updateCreative({ 
                    base_video_url: data.url,
                    background_removed: true 
                  });
                } catch (e: any) {
                  setError(`Background removal failed: ${e.message}`);
                }
              }}
            >
              Remove Background
            </button>
          )}
        </div>
      )}
    </div>
  );

  const BrollStep = () => (
    <div className="step-content">
      <div className="step-header">
        <h2>B-roll Planning</h2>
        <p>Segment your script and add supporting visuals</p>
      </div>

      <div className="panel">
        <div className="header">
          <h3 style={{margin: 0}}>Script Segmentation</h3>
        </div>
        
        <button 
          className="btn"
          disabled={!creative.script}
          onClick={async () => {
            try {
              const res = await fetch('/api/script/segment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ script: creative.script })
              });
              
              if (!res.ok) throw new Error(await res.text());
              const data = await res.json();
              const segments = data.segments.map((segment: any, index: number) => ({
                id: `segment-${index}`,
                text: segment.text,
                start_time: segment.start_time || index * 5,
                end_time: segment.end_time || (index + 1) * 5,
                order: index
              }));
              
              setScriptSegments(segments);
              updateCreative({ script_segments: segments });
            } catch (e: any) {
              setError(`Script segmentation failed: ${e.message}`);
            }
          }}
        >
          Segment Script
        </button>

        {scriptSegments.length > 0 && (
          <div className="segments-timeline">
            {scriptSegments.map((segment, index) => (
              <div 
                key={segment.id}
                className={`segment-item ${selectedSegment === segment.id ? 'selected' : ''}`}
                onClick={() => setSelectedSegment(segment.id)}
              >
                <div className="segment-header">
                  <span className="segment-number">{index + 1}</span>
                  <span className="segment-time">{segment.start_time}s - {segment.end_time}s</span>
                </div>
                <div className="segment-text">{segment.text}</div>
                <div className="segment-broll">
                  {brollItems
                    .filter(item => item.segment_id === segment.id)
                    .map(item => (
                      <div key={item.id} className="broll-item-preview">
                        {item.url ? (
                          item.type === 'video' ? (
                            <video src={item.url} style={{width: 40, height: 40, borderRadius: 4}} />
                          ) : (
                            <img src={item.url} alt="B-roll content" style={{width: 40, height: 40, borderRadius: 4, objectFit: 'cover'}} />
                          )
                        ) : (
                          <div className="broll-placeholder">
                            {item.generation_status === 'running' ? <Clock size={16} /> : <Plus size={16} />}
                          </div>
                        )}
                      </div>
                    ))}
                  <button 
                    className="add-broll-btn"
                    onClick={() => {
                      const newItem: BrollItem = {
                        id: `broll-${Date.now()}`,
                        segment_id: segment.id,
                        type: 'image',
                        generation_status: 'queued',
                        prompt: segment.text
                      };
                      setBrollItems(prev => [...prev, newItem]);
                    }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedSegment && (
        <div className="panel">
          <div className="header">
            <h3 style={{margin: 0}}>B-roll Generation</h3>
          </div>
          
          <div className="broll-options">
            <button 
              className="btn"
              onClick={async () => {
                const segment = scriptSegments.find(s => s.id === selectedSegment);
                if (!segment) return;
                
                try {
                  const res = await fetch('/api/image/run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      prompt: `Create a visual representation of: ${segment.text}`,
                      model: 'black-forest-labs/flux-kontext-max'
                    })
                  });
                  
                  if (!res.ok) throw new Error(await res.text());
                  const data = await res.json();
                  
                  const newItem: BrollItem = {
                    id: `broll-${Date.now()}`,
                    segment_id: selectedSegment,
                    type: 'image',
                    url: data.url,
                    generation_status: 'finished',
                    prompt: segment.text
                  };
                  
                  setBrollItems(prev => [...prev, newItem]);
                } catch (e: any) {
                  setError(`B-roll generation failed: ${e.message}`);
                }
              }}
            >
              Generate Image B-roll
            </button>
            
            <button 
              className="btn"
              onClick={async () => {
                const segment = scriptSegments.find(s => s.id === selectedSegment);
                if (!segment) return;
                
                try {
                  const res = await fetch('/api/veo/run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      prompt: `Create a video showing: ${segment.text}`,
                      duration: segment.end_time - segment.start_time
                    })
                  });
                  
                  if (!res.ok) throw new Error(await res.text());
                  const data = await res.json();
                  
                  const newItem: BrollItem = {
                    id: `broll-${Date.now()}`,
                    segment_id: selectedSegment,
                    type: 'video',
                    url: data.url,
                    generation_status: 'finished',
                    prompt: segment.text
                  };
                  
                  setBrollItems(prev => [...prev, newItem]);
                } catch (e: any) {
                  setError(`Video B-roll generation failed: ${e.message}`);
                }
              }}
            >
              Generate Video B-roll
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const SummaryStep = () => (
    <div className="step-content">
      <div className="step-header">
        <h2>Creative Summary</h2>
        <p>Review your completed ad creative</p>
      </div>

      <div className="creative-summary">
        <div className="summary-card">
          <div className="summary-header">
            <h3>{creative.name}</h3>
            <span className={`status-badge ${creative.status}`}>
              {creative.status?.toUpperCase()}
            </span>
          </div>
          
          <div className="summary-content">
            <div className="summary-section">
              <h4>Concept</h4>
              <p><strong>Hook:</strong> {creative.hook}</p>
              <p><strong>Message:</strong> {creative.message}</p>
              <p><strong>CTA:</strong> {creative.cta}</p>
              <div className="angles">
                {creative.angles?.map(angle => (
                  <span key={angle} className="angle-tag">{angle}</span>
                ))}
              </div>
            </div>
            
            {creative.base_video_url && (
              <div className="summary-section">
                <h4>Base Video</h4>
                <video 
                  src={creative.base_video_url} 
                  controls 
                  style={{width: '100%', maxHeight: '300px', borderRadius: '8px'}} 
                />
              </div>
            )}
            
            {scriptSegments.length > 0 && (
              <div className="summary-section">
                <h4>B-roll Items</h4>
                <div className="broll-grid">
                  {brollItems.map(item => (
                    <div key={item.id} className="broll-summary-item">
                      {item.url && (
                        item.type === 'video' ? (
                          <video src={item.url} style={{width: '100%', height: 60, borderRadius: 4}} />
                        ) : (
                          <img src={item.url} alt="B-roll summary" style={{width: '100%', height: 60, borderRadius: 4, objectFit: 'cover'}} />
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="summary-actions">
            <button className="btn btn-primary">
              <Download size={16} />
              Export Creative
            </button>
            <button className="btn">
              <Eye size={16} />
              Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'concept': return <ConceptStep />;
      case 'avatar-voice': return <AvatarVoiceStep />;
      case 'base-video': return <BaseVideoStep />;
      case 'broll': return <BrollStep />;
      case 'summary': return <SummaryStep />;
      default: return <ConceptStep />;
    }
  };

  return (
    <div className="container ad-creative-page">
      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <Sparkles size={24} />
          <h1>Ad Creative Studio</h1>
          <span className="save-status">
            {saveStatus === 'saved' && <CheckCircle size={16} />}
            {saveStatus === 'saving' && <Clock size={16} />}
            {saveStatus === 'unsaved' && <AlertCircle size={16} />}
            {saveStatus}
          </span>
        </div>
        
        <div className="page-actions">
          <button className="btn" onClick={handleSave} disabled={saveStatus === 'saving'}>
            <Save size={16} />
            Save
          </button>
        </div>
      </div>

      {/* Step Navigation */}
      <div className="step-nav">
        {STEPS.map((step, index) => (
          <button
            key={step.key}
            className={`step-nav-item ${currentStep === step.key ? 'active' : ''} ${
              STEPS.findIndex(s => s.key === currentStep) > index ? 'completed' : ''
            }`}
            onClick={() => setCurrentStep(step.key)}
          >
            <div className="step-icon">{step.icon}</div>
            <div className="step-label">{step.label}</div>
          </button>
        ))}
      </div>

      {/* Step Content */}
      <div className="step-container">
        {renderCurrentStep()}
      </div>

      {/* Navigation */}
      <div className="step-navigation">
        <button 
          className="btn btn-secondary" 
          onClick={prevStep}
          disabled={currentStep === 'concept'}
        >
          <ChevronLeft size={16} />
          Previous
        </button>
        
        <button 
          className="btn btn-primary" 
          onClick={nextStep}
          disabled={currentStep === 'summary' || !canProceedToNext()}
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

'use client';

import '../globals.css';
import { useEffect, useRef, useState } from 'react';
import { supabaseClient as supabase } from '../../lib/supabaseClient';

export default function AdScriptPage() {
  const [systemPrompt, setSystemPrompt] = useState<string>(`You are a world-class direct-response copywriter specializing in high-converting ad scripts for short-form video ads. Create compelling, original scripts that drive action and engagement.

Use the following EXACT examples as a style guide and inspiration (do not copy):

=== 1. ad-video (1).mp4 ===
Reasons why menopausal women should run for this. This is the cooling blanket from Comfy Sleepers and it's a game changer. Not just for summer hot nights, but for your overheating too. First, it instantly feels cold on your skin. It's designed to keep your temperature regulated all night. Second, it's so soft and keeps you cool and dry all night. No more waking up sweaty. And third, it's trusted by many women all over the world. Trust me, I've tried everything. Turning up the AC, cold showers, drinking more water. But this is the fastest and easiest way to get rid of it. Bonus, you'll get two blankets for the price of one. So if you're tired of hot flashes taking control of your life, you need to try this.

=== 2. ad-video (2).mp4 ===
My three big regrets of buying this cooling blanket. Number one, it's way too cold underneath it. As a hot sleeper, I thought nothing could cool me down, not even ice bags, but this blanket feels like I'm sleeping on a glacier. Number two, no one warned me the quality would be this good. Super soft, super comfy, and cool to the touch. I never thought a blanket could be this high quality. It's honestly amazing. Number three, everyone complains that I sleep too much now. But can you blame me? I fall asleep like a baby the moment I get under it. I bought it as a joke thinking I'd return it within 30 days and get a full refund, but seriously, the incredible results I got, I'm definitely not returning it. I'm just obsessed. Seriously obsessed, y'all. Make your decision now. Order this or sleep in a pond of your own smelly sweat. Sleep better than a baby. This blanket offers a whole new level of sleeping experience. Try it yourself and see the difference and order it again for your friends and family.

=== 3. ad-video (3).mp4 ===
The country is dealing with punishing heat this weekend and flirting with record highs. In the nation's capital, people tried to get whatever relief they could as temperatures reached 97 degrees today, the hottest weekend so far this year. The brutal heat waves are making sleep impossible for many. And for hot sleepers, it can feel like living in hell. But there's a solution that real people from worldwide swear by. Meet the Ice Cooling Blanket. This innovative blanket doesn't trap heat. Instead, it retains coolness and helps reduce hot flashes and night sweats. Soft, comfortable, lightweight, and machine washable. It has everything a hot sleeper needs. So instead of worrying about the latest news flashes, you can just relax and enjoy Netflix and chill. And here's the best part. It's on buy one, get one free sale right now. So shop now before you also start melting like an ice cream.

=== 4. ad-video (4).mp4 ===
Two cooling blankets, one frosty price. Bring the chill vibe home. Sweaty sleep? That's a thing of the past. Our buy one, get one free cooling blanket is the upgrade your overheated nights have been begging for. Made with snowy cooling tech, it pulls heat off your body faster than you can say, "Damn hot flashes." Super soft, breathable, and keeps you cool all night. And the best part? You get two, one for you and one for the human furnace you share your bed with. But hurry, this BOGO deal won't last forever, and neither should your sweaty nights. Grab yours before it's gone.

=== 5. ad-video (5).mp4 ===
Buy one cooling blanket, get another free, hot nights are officially canceled. It's time to cool down, baby. This cooling blanket has got your back. Seriously, it doesn't just keep you cool, it sucks heat off you like it's your ex trying to drain your energy. Oops, sorry for no sorry. Designed with touch-to-cool fabric, keeps you cool all night long with no sweat. And guess what? It's machine washable too, so you can wash it without worrying about losing that coolness. Yeah, even after multiple washes. It's like having a personal air conditioner, but cozier and budget-friendly. So, why are you still holding on to that old blanket like it's a relic of your last bad relationship? Grab this cooling blanket now. With 30-day cool sleep guarantee, you've got nothing to lose but those fucking hell-like sleepless hot nights.

=== 6. ad-video (6).mp4 ===
This blanket is so cool. We had to give you two for the price of one. I get it. This brutal summer heat is ten times stronger than the fire inside you. But lucky for you, our cooling blanket. BOGO clearance sale is here to cool you down. You get two for the price of one crafted with cool-to-touch fabric. It feels like sleeping on ice. No more waking up drenched in sweat. No more midnight wrestling with the AC. No more don't touch me, I'm melting moments. And yes, it supports every position. You know exactly what I mean. Plus, it's machine washable because laundry shouldn't be a punishment. Final clearance. Buy one, get one free order now.

=== 7. ad-video (7).mp4 ===
Getting two cooling blankets for the price of one. This isn't just a blanket, it's a sleep upgrade with the coolest deal out there. Buy one and get another completely free. Yup, no cap. The second you slip under it, you'll feel that instant icy cool refresh. Its temperature-regulating fabric keeps you chill without running to stick your face in the freezer. Plus, the breathable fabric keeps you dry even on those restless hot nights. But hurry, this deal is so good, it's gonna melt fast. Get one for you, one for your bestie, or both for your ultimate sleep setup. Your call.

=== 8. ad-video (8).mp4 ===
Buy one cooling blanket, get one free, double the chill, double the cool vibes. This isn't just a blanket, it's a sleep upgrade with the coolest deal out there. Buy one and get another completely free. Yup, no cap. The second you slip under it, you'll feel that instant icy cool refresh. Its temperature regulating fabric keeps you chill without running to stick your face in the freezer. Plus, the breathable fabric keeps you dry even on those restless hot nights. But hurry, this deal is so good, it's gonna melt fast. Get one for you, one for your bestie, or both for your ultimate sleep setup. Your call.

=== 9. ad-video (9).mp4 ===
Get your bed ready for the hottest days with this blanket. Let's be real, summer heat isn't just annoying, it's pure torture. And while you are still tossing and turning, your AC is laughing at sky-high bills. But here's the real question: why are we still sweating it out when this ice-cooling blanket exists? It gives you the coolest comfort, even when it's 90 degrees outside. The moisture-wicking tech keeps you dry all night without the sweaty, sticky mess. Plus, it doesn't lose its coolness even after 1,000 washes and stay soft. F. So forget kicking off your sheets or hugging a frozen water bottle to stay cool. This is the upgrade your sleep deserves. Grab this with a 30-night coolness guarantee before your bed turns into a sauna.

=== 10. ad-video (10).mp4 ===
The brutal reality behind this popular cooling blanket. So, you've seen this cooling blanket all over your social media, right? Everyone's raving about it, but trust me, it's not just a fake advertising. Perfect for those steamy nights when things get too hot to handle. It sucks heat off you like your ex trying to drain your energy? Good riddance. 100% cooling comfort that's way better than those 69 tricks you use to cool down. No more tossing and turning or waking up drenched in sweat. Plus, it's super lightweight, breathable, and oh so soft. Just like being wrapped in a lover's embrace all night long. Want more spice? It comes with a 30-night no-sweat guarantee. So, why wait? Get your chill on and turn up the heat in the best way possible.

=== 11. ad-video (11).mp4 ===
Blanket feel like a heater at 2 a.m.? Yes, hottie, you don't have to suffer through sweaty nights and tossing the blanket off every hour, because you're about to get the coolest sleep with this ice-cooling blanket. From the moment you slide under it, the winter season starts for you. It adapts to your body's temperature, helping you stay cool all night. Plus, the fabric pulls heat and sweat away from your body, so you stay dry and calm. So, no hot flashes or sticking a leg out just to survive the hot night. Try with our 30 Best Night for a Hot Sleeper Ever guarantee.

=== 12. ad-video (12).mp4 ===
This blanket offers a whole new level of seduction.

=== 13. ad-video (13).mp4 ===
This blanket offers a whole new level of seduction.

=== 14. ad-video (14).mp4 ===
Buy one cooling blanket, get one free, double the chill, zero sweat. Sweaty sleep? That's a thing of the past. Our buy one, get one free cooling blanket is the upgrade your overheated nights have been begging for. Made with snowy cooling tech, it pulls heat off your body faster than you can say damn hot flashes. Super soft, breathable, and keeps you cool all night. And the best part? You get two, one for you and one for the human furnace you share your bed with. But hurry, this BOGO deal won't last forever, and neither should your sweaty nights. Grab yours before it's gone.

=== 15. ad-video (15).mp4 ===
Two blankets, one price. You've got a bedtime BFF. I get it, this brutal summer heat is ten times stronger than the fire inside you. But lucky for you, our cooling blanket BOGO clearance sale is here to cool you down. You get two for the price of one crafted with cool-to-touch fabric. It feels like sleeping on ice. No more waking up drenched in sweat. No more midnight wrestling with the AC. No more don't touch me, I'm melting moments. And yes, it supports every position. You know exactly what I mean. Plus, it's machine washable because laundry shouldn't be a punishment. Final clearance. Buy one, get one free order now.

=== 16. ad-video (16).mp4 ===
Beat the menopausal night sweats. Menopause isn't just a phase, it's a full-on heatwave that hijacks your sleep. One minute, you're shivering. The next, you're all sweaty, kicking off the covers. Sound familiar, right? Then you need this ice-cooling blanket. It is made with advanced cooling fabric that pulls heat and moisture away from your body, keeping you cool, dry, and comfortable all night. No more waking up drenched or flipping your pillow for the cool side. Just deep, uninterrupted, coolest sleep ever. Want to know the cool surprise? It comes with 30 cold nights guarantee. So stop letting menopause steal another night of sleep.

=== 17. ad-video.mp4 ===
Buy one, get one free, so you and your partner can stop sweating at night. I get it, this brutal summer heat is ten times stronger than the fire inside you. But lucky for you, our cooling blanket. BOGO clearance sale is here to cool you down. You get two for the price of one crafted with cool-to-touch fabric. It feels like sleeping on ice. No more waking up drenched in sweat. No more midnight wrestling with the AC. No more don't touch me, I'm melting moments. And yes, it supports every position. You know exactly what I mean. Plus, it's machine washable because laundry shouldn't be a punishment. Final clearance. Buy one, get one free. Order now.

Rules:
- Do NOT copy text verbatim. Write original scripts inspired by the above.
- Always include an attention-grabbing hook in the first line.
- Emphasize benefits, relief from pain points, and sensory/temperature language where relevant.
- Use social proof, contrast, reverse-claims, and a bold CTA.
- Keep it 20–40 seconds unless otherwise specified.
`);
  // Structured fields for composing the user prompt automatically
  const [brandName, setBrandName] = useState<string>('');
  const [product, setProduct] = useState<string>('');
  const [offer, setOffer] = useState<string>('');
  const [targetAudience, setTargetAudience] = useState<string>('');
  const [keyBenefits, setKeyBenefits] = useState<string>(''); // CSV
  const [painPoints, setPainPoints] = useState<string>(''); // CSV
  const [socialProof, setSocialProof] = useState<string>('');
  const [tone, setTone] = useState<string>('bold, conversational, high-energy');
  const [platform, setPlatform] = useState<'tiktok'|'instagram'|'facebook'|'youtube_shorts'>('tiktok');
  const [hookStyle, setHookStyle] = useState<'problem_agitate_solve'|'reverse_claim'|'countdown'|'myths_vs_facts'|'testimonial'|'news_flash'>('problem_agitate_solve');
  const [cta, setCta] = useState<string>('Shop now — limited-time offer');
  const [lengthSeconds, setLengthSeconds] = useState<number>(30);
  const [constraints, setConstraints] = useState<string>('No scene headers. No numbered list. Output as a single flowing script.');
  const [maxTokens, setMaxTokens] = useState<number>(1024);
  const [extendedThinking, setExtendedThinking] = useState<boolean>(false);
  const [thinkingBudget, setThinkingBudget] = useState<number>(1024);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string>('');
  const [taskId, setTaskId] = useState<string | null>(null);
  type Template = {
    id: string;
    name: string;
    createdAt: number;
    payload: {
      systemPrompt: string;
      brandName: string;
      product: string;
      offer: string;
      targetAudience: string;
      keyBenefits: string;
      painPoints: string;
      socialProof: string;
      tone: string;
      platform: 'tiktok'|'instagram'|'facebook'|'youtube_shorts';
      hookStyle: 'problem_agitate_solve'|'reverse_claim'|'countdown'|'myths_vs_facts'|'testimonial'|'news_flash';
      cta: string;
      lengthSeconds: number;
      constraints: string;
      maxTokens: number;
      extendedThinking: boolean;
      thinkingBudget: number;
    };
  };
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplates, setShowTemplates] = useState<boolean>(false);

  const streamRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  useEffect(() => {
    return () => { try { streamRef.current?.cancel(); } catch {} };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('adscript_templates_v1');
      if (raw) setTemplates(JSON.parse(raw));
    } catch {}
  }, []);

  function persistTemplates(next: Template[]) {
    setTemplates(next);
    try { localStorage.setItem('adscript_templates_v1', JSON.stringify(next)); } catch {}
  }

  function handleSaveTemplate() {
    const name = typeof window !== 'undefined' ? window.prompt('Template name:') : '';
    if (!name) return;
    const t: Template = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      createdAt: Date.now(),
      payload: {
        systemPrompt,
        brandName,
        product,
        offer,
        targetAudience,
        keyBenefits,
        painPoints,
        socialProof,
        tone,
        platform,
        hookStyle,
        cta,
        lengthSeconds,
        constraints,
        maxTokens,
        extendedThinking,
        thinkingBudget,
      },
    };
    const next = [t, ...templates].slice(0, 50);
    persistTemplates(next);
    setShowTemplates(true);
  }

  function applyTemplate(t: Template) {
    const p = t.payload;
    setSystemPrompt(p.systemPrompt);
    setBrandName(p.brandName);
    setProduct(p.product);
    setOffer(p.offer);
    setTargetAudience(p.targetAudience);
    setKeyBenefits(p.keyBenefits);
    setPainPoints(p.painPoints);
    setSocialProof(p.socialProof);
    setTone(p.tone);
    setPlatform(p.platform);
    setHookStyle(p.hookStyle);
    setCta(p.cta);
    setLengthSeconds(p.lengthSeconds);
    setConstraints(p.constraints);
    setMaxTokens(p.maxTokens);
    setExtendedThinking(p.extendedThinking);
    setThinkingBudget(p.thinkingBudget);
  }

  function deleteTemplate(id: string) {
    const next = templates.filter(t => t.id !== id);
    persistTemplates(next);
  }

  function buildComposedPrompt(): string {
    const benefitsList = keyBenefits.split(',').map(s => s.trim()).filter(Boolean);
    const painsList = painPoints.split(',').map(s => s.trim()).filter(Boolean);
    const lines: string[] = [];
    lines.push(`Write a ${lengthSeconds}-second short-form video ad script for ${platform.replace('_',' ')}.`);
    if (brandName) lines.push(`Brand: ${brandName}.`);
    if (product) lines.push(`Product: ${product}.`);
    if (offer) lines.push(`Offer: ${offer}.`);
    if (targetAudience) lines.push(`Target audience: ${targetAudience}.`);
    if (tone) lines.push(`Tone: ${tone}.`);
    if (benefitsList.length) lines.push(`Key benefits to emphasize: ${benefitsList.join('; ')}.`);
    if (painsList.length) lines.push(`Pain points to address: ${painsList.join('; ')}.`);
    if (socialProof) lines.push(`Social proof / credibility: ${socialProof}.`);
    if (hookStyle) lines.push(`Hook style: ${hookStyle}.`);
    if (cta) lines.push(`Call to action: ${cta}.`);
    if (constraints) lines.push(`Constraints: ${constraints}`);
    lines.push('Ensure a powerful first-line hook, sensory language, vivid metaphors, contrast or reverse-claims when useful, and a bold CTA. Keep it punchy and performance-oriented.');
    return lines.join(' ');
  }

  async function run() {
    setIsLoading(true);
    setError(null);
    setOutput('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in at /auth before creating a task.');

      const composed = buildComposedPrompt();
      const options = {
        system_prompt: systemPrompt,
        prompt: composed,
        max_tokens: maxTokens,
        extended_thinking: extendedThinking,
        thinking_budget_tokens: extendedThinking ? thinkingBudget : undefined,
      } as Record<string, any>;

      const { data: inserted, error: insertErr } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          type: 'lipsync',
          status: 'queued',
          provider: 'replicate',
          model_id: 'anthropic/claude-3.7-sonnet',
          options_json: options,
          text_input: composed,
        })
        .select('*')
        .single();
      if (insertErr || !inserted) throw new Error(insertErr?.message || 'Failed to create task');
      setTaskId(inserted.id);

      const res = await fetch('/api/adscript/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      if (!res.ok) throw new Error(await res.text());

      const reader = res.body?.getReader();
      streamRef.current = reader || null;
      const decoder = new TextDecoder();
      let fullOutput = '';
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullOutput += chunk;
        setOutput(prev => prev + chunk);
      }

      if (inserted?.id) {
        await supabase
          .from('tasks')
          .update({ 
            status: 'finished',
            output_text: fullOutput 
          })
          .eq('id', inserted.id);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to generate');
      if (taskId) await supabase.from('tasks').update({ status: 'error' }).eq('id', taskId);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="panel output">
        <div className="header">
          <h2 style={{margin:0}}>Ad Script</h2>
        </div>
        <div className="outputArea" style={{ 
          whiteSpace: 'pre-wrap', 
          userSelect: 'text',
          cursor: output ? 'text' : 'default',
          textAlign: 'left',
          overflow: 'auto'
        }}>
          {output ? (
            <div style={{ 
              padding: 'var(--space-4)', 
              background: 'var(--panel-elevated)', 
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              lineHeight: 1.6,
              fontSize: 'var(--font-base)',
              color: 'var(--text)',
              userSelect: 'text',
              cursor: 'text'
            }}>
              {output}
            </div>
          ) : (
            <div style={{fontSize:16, color:'#b7c2df'}}>Generated script will appear here.</div>
          )}
        </div>
        {output && (
          <div style={{marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)'}}>
            <button 
              className="btn" 
              style={{width: 'auto', padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--font-sm)'}}
              onClick={() => {
                navigator.clipboard.writeText(output).then(() => {
                  // Optional: Show a brief success message
                  const btn = event?.target as HTMLButtonElement;
                  if (btn) {
                    const originalText = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => btn.textContent = originalText, 1000);
                  }
                }).catch(() => {
                  // Fallback for older browsers
                  const textArea = document.createElement('textarea');
                  textArea.value = output;
                  document.body.appendChild(textArea);
                  textArea.select();
                  document.execCommand('copy');
                  document.body.removeChild(textArea);
                });
              }}
            >
              Copy Script
            </button>
            <div className="small" style={{alignSelf: 'center', color: 'var(--text-muted)'}}>
              {output.length} characters
            </div>
          </div>
        )}
        {error && <div className="small" style={{ color: '#ff7878' }}>{error}</div>}
      </div>

      <div className="panel">
        <div className="header">
          <h3 style={{margin:0}}>Script Generator</h3>
          <span className="badge">AI Copywriting</span>
        </div>

        <div className="options">
          <div style={{gridColumn: 'span 2'}}>
            <div className="small">System Prompt</div>
            <textarea className="input" rows={3} value={systemPrompt} onChange={(e)=>setSystemPrompt(e.target.value)} />
          </div>
        </div>

        <div style={{display:'flex', gap:8, marginTop:8}}>
          <button className="btn" type="button" onClick={handleSaveTemplate} onKeyDown={(e)=>{ if (e.key==='Enter' || e.key===' ') handleSaveTemplate(); }}>Save as template</button>
          <button className="select" type="button" onClick={()=>setShowTemplates(v=>!v)} onKeyDown={(e)=>{ if (e.key==='Enter' || e.key===' ') setShowTemplates(v=>!v); }}>Use template</button>
        </div>
        {showTemplates && (
          <div className="panel" style={{marginTop:8, padding:12}}>
            <div className="header" style={{marginBottom:8}}>
              <div style={{fontWeight:700}}>Saved templates</div>
              <span className="badge">{templates.length}</span>
            </div>
            {templates.length === 0 ? (
              <div className="small">No templates yet. Click &quot;Save as template&quot; to add one.</div>
            ) : (
              <div style={{display:'grid', gap:8}}>
                {templates.map(t => (
                  <div key={t.id} className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
                    <div className="small" style={{fontWeight:700}}>{t.name}</div>
                    <div style={{display:'flex', gap:8}}>
                      <button className="btn" type="button" onClick={()=>applyTemplate(t)} onKeyDown={(e)=>{ if (e.key==='Enter' || e.key===' ') applyTemplate(t); }}>Apply</button>
                      <button className="select" type="button" onClick={()=>deleteTemplate(t.id)} onKeyDown={(e)=>{ if (e.key==='Enter' || e.key===' ') deleteTemplate(t.id); }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Brand & Product Information */}
        <div className="options">
          <div>
            <div className="small">Brand Name</div>
            <input className="input" value={brandName} onChange={(e)=>setBrandName(e.target.value)} placeholder="e.g., Comfy Sleepers" />
          </div>
          <div>
            <div className="small">Product</div>
            <input className="input" value={product} onChange={(e)=>setProduct(e.target.value)} placeholder="e.g., Ice Cooling Blanket" />
          </div>
          <div>
            <div className="small">Offer</div>
            <input className="input" value={offer} onChange={(e)=>setOffer(e.target.value)} placeholder="e.g., Buy One Get One Free" />
          </div>
          <div>
            <div className="small">Target Audience</div>
            <input className="input" value={targetAudience} onChange={(e)=>setTargetAudience(e.target.value)} placeholder="e.g., hot sleepers, menopausal women" />
          </div>
        </div>

        {/* Content Details */}
        <div className="options">
          <div style={{gridColumn: 'span 2'}}>
            <div className="small">Key Benefits (comma-separated)</div>
            <input className="input" value={keyBenefits} onChange={(e)=>setKeyBenefits(e.target.value)} placeholder="e.g., instant cool feel, moisture-wicking, machine-washable" />
          </div>
          <div style={{gridColumn: 'span 2'}}>
            <div className="small">Pain Points (comma-separated)</div>
            <input className="input" value={painPoints} onChange={(e)=>setPainPoints(e.target.value)} placeholder="e.g., hot flashes, night sweats, high AC bills" />
          </div>
          <div>
            <div className="small">Social Proof</div>
            <input className="input" value={socialProof} onChange={(e)=>setSocialProof(e.target.value)} placeholder="e.g., 10k+ 5-star reviews; trending on TikTok" />
          </div>
          <div>
            <div className="small">Tone</div>
            <select className="select" value={tone} onChange={(e)=>setTone(e.target.value)}>
              <option value="bold, conversational, high-energy">Bold / Conversational / High-Energy</option>
              <option value="empathetic, reassuring, supportive">Empathetic / Reassuring</option>
              <option value="witty, edgy, viral">Witty / Edgy / Viral</option>
              <option value="authoritative, news-flash style">Authoritative / News-Flash</option>
            </select>
          </div>
          <div>
            <div className="small">Platform</div>
            <select className="select" value={platform} onChange={(e)=>setPlatform(e.target.value as any)}>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram Reels</option>
              <option value="facebook">Facebook</option>
              <option value="youtube_shorts">YouTube Shorts</option>
            </select>
          </div>
          <div>
            <div className="small">Hook style</div>
            <select className="select" value={hookStyle} onChange={(e)=>setHookStyle(e.target.value as any)}>
              <option value="problem_agitate_solve">Problem → Agitate → Solve</option>
              <option value="reverse_claim">Reverse-claim / Contrarian</option>
              <option value="countdown">Countdown (Top 3 / Top 5)</option>
              <option value="myths_vs_facts">Myths vs Facts</option>
              <option value="testimonial">Testimonial / POV</option>
              <option value="news_flash">News Flash / Reporter</option>
            </select>
          </div>
          <div>
            <div className="small">CTA</div>
            <input className="input" value={cta} onChange={(e)=>setCta(e.target.value)} placeholder="e.g., Shop now — limited-time offer" />
          </div>
          <div>
            <div className="small">Length (seconds)</div>
            <input className="input" type="number" min={10} max={90} value={lengthSeconds} onChange={(e)=>setLengthSeconds(parseInt(e.target.value || '30'))} />
          </div>
          <div>
            <div className="small">Constraints (optional)</div>
            <input className="input" value={constraints} onChange={(e)=>setConstraints(e.target.value)} />
          </div>
        </div>

        <div className="options" style={{marginTop:12}}>
          <div>
            <div className="small">Max tokens</div>
            <input className="input" type="number" min={1024} max={64000} value={maxTokens} onChange={(e)=>setMaxTokens(parseInt(e.target.value))} />
          </div>
          <div>
            <label className="small" style={{display:'flex', gap:8, alignItems:'center'}}>
              <input type="checkbox" checked={extendedThinking} onChange={(e)=>setExtendedThinking(e.target.checked)} /> Extended thinking
            </label>
          </div>
          {extendedThinking && (
            <div>
              <div className="small">Thinking budget tokens</div>
              <input className="input" type="number" min={1024} max={64000} value={thinkingBudget} onChange={(e)=>setThinkingBudget(parseInt(e.target.value))} />
            </div>
          )}
        </div>

        <button className="btn" type="button" style={{ marginTop: 12 }} disabled={isLoading || (!brandName && !product)} onClick={run}>
          {isLoading ? 'Generating…' : 'Generate Ad Script'}
        </button>
      </div>
    </div>
  );
}



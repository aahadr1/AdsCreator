'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: true, autoRefreshToken: true } }
);

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [message, setMessage] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email || '');
    };
    run();
  }, []);

  const submit = async () => {
    setMessage('');
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email || '');
      setMessage('Success');
    } catch (e: any) {
      setMessage(e.message || 'Failed');
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserEmail('');
    setMessage('Signed out');
  };

  if (userEmail) {
    return (
      <div className="container" style={{gridTemplateColumns:'1fr'}}>
        <div className="panel" style={{maxWidth:520, margin:'0 auto'}}>
          <div className="header">
            <h2 style={{margin:0}}>Account</h2>
            <span className="badge">Signed in</span>
          </div>
          <div className="kv" style={{marginBottom:12}}>
            <div>Email</div><div className="small">{userEmail}</div>
          </div>
          <div style={{display:'flex', gap:8}}>
            <a className="btn" href="/">Go to Dashboard</a>
            <button className="select" onClick={signOut} style={{padding:12}}>Sign out</button>
          </div>
          {message && <div className="small" style={{marginTop:8}}>{message}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{gridTemplateColumns:'1fr'}}>
      <div className="panel" style={{maxWidth:520, margin:'0 auto'}}>
        <div className="header">
          <h2 style={{margin:0}}>{mode === 'signin' ? 'Sign in' : 'Sign up'}</h2>
          <span className="badge">Secure Authentication</span>
        </div>
        <div style={{display:'grid', gap:8}}>
          <input className="select" placeholder="email" value={email} onChange={(e)=>setEmail(e.target.value)} />
          <input className="select" type="password" placeholder="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
          <button className="btn" onClick={submit}>{mode === 'signin' ? 'Sign in' : 'Create account'}</button>
          <button onClick={()=>setMode(mode==='signin'?'signup':'signin')} className="select">
            Switch to {mode==='signin'?'Sign up':'Sign in'}
          </button>
          {message && <div className="small">{message}</div>}
        </div>
      </div>
    </div>
  );
}
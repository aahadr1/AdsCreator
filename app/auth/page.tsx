'use client';

import { useState } from 'react';

export default function AuthPage() {
  const [message] = useState<string>('Authentication has been disabled. This app now only uses Cloudflare R2 for storage.');

  return (
    <div className="container" style={{gridTemplateColumns:'1fr'}}>
      <div className="panel" style={{maxWidth:520, margin:'0 auto'}}>
        <div className="header">
          <h2 style={{margin:0}}>Authentication Disabled</h2>
          <span className="badge">R2 Only</span>
        </div>
        <div style={{display:'grid', gap:8}}>
          <input className="select" placeholder="email (disabled)" disabled style={{opacity:0.5}} />
          <input className="select" type="password" placeholder="password (disabled)" disabled style={{opacity:0.5}} />
          <button className="btn" disabled style={{opacity:0.5, cursor:'not-allowed'}}>Authentication Disabled</button>
          <div className="small">{message}</div>
          <a className="btn" href="/" style={{textAlign:'center', textDecoration:'none'}}>Go to Dashboard</a>
        </div>
      </div>
    </div>
  );
}
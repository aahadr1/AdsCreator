'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Video, Construction } from 'lucide-react';

export default function VideoRemakePage() {
  const router = useRouter();

  return (
    <div className="new-influencer-container">
      <div className="new-influencer-header">
        <button onClick={() => router.back()} className="btn-back">
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
        <h1 className="new-influencer-title">Video Remake</h1>
      </div>

      <div className="empty-state" style={{ minHeight: '60vh' }}>
        <Construction size={64} strokeWidth={1} />
        <h2 style={{ fontSize: 'var(--font-2xl)', margin: 0 }}>Coming Soon</h2>
        <p style={{ maxWidth: '500px', textAlign: 'center', margin: 0 }}>
          Recreate videos with your AI influencers. This feature will allow you to remake
          existing videos using your generated influencer personas.
        </p>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Users, Video, Sparkles, Camera } from 'lucide-react';

export default function InfluencerLabPage() {
  const router = useRouter();

  const features = [
    {
      title: 'My Influencers',
      description: 'Manage your AI-generated influencer personas',
      icon: <Users size={32} />,
      href: '/influencer-lab/my-influencers',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      title: 'Video Remake',
      description: 'Recreate videos with your influencers',
      icon: <Video size={32} />,
      href: '/influencer-lab/video-remake',
      gradient: 'from-blue-500 to-cyan-500',
      disabled: true,
    },
    {
      title: 'Create from scratch',
      description: 'Build content from the ground up',
      icon: <Sparkles size={32} />,
      href: '/influencer-lab/create-scratch',
      gradient: 'from-amber-500 to-orange-500',
      disabled: true,
    },
    {
      title: 'UGC maker',
      description: 'Generate user-generated style content',
      icon: <Camera size={32} />,
      href: '/influencer-lab/ugc-maker',
      gradient: 'from-green-500 to-emerald-500',
      disabled: true,
    },
  ];

  return (
    <div className="influencer-lab-container">
      <div className="influencer-lab-header">
        <h1 className="influencer-lab-title">Influencer Lab</h1>
        <p className="influencer-lab-subtitle">
          Create and manage AI-powered influencer personas for your content
        </p>
      </div>

      <div className="influencer-lab-grid">
        {features.map((feature) => (
          <button
            key={feature.title}
            onClick={() => !feature.disabled && router.push(feature.href)}
            disabled={feature.disabled}
            className={`influencer-lab-card ${feature.disabled ? 'disabled' : ''}`}
          >
            <div className={`influencer-lab-card-icon bg-gradient-to-br ${feature.gradient}`}>
              {feature.icon}
            </div>
            <div className="influencer-lab-card-content">
              <h2 className="influencer-lab-card-title">{feature.title}</h2>
              <p className="influencer-lab-card-description">{feature.description}</p>
              {feature.disabled && (
                <span className="influencer-lab-badge">Coming Soon</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

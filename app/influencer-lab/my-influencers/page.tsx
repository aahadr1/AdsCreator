'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, AlertCircle, User, Instagram } from 'lucide-react';
import { Influencer } from '@/types/influencer';
import { supabaseClient } from '@/lib/supabaseClient';

export default function MyInfluencersPage() {
  const router = useRouter();
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const fetchInfluencers = async () => {
      try {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();

        if (!session?.access_token) {
          router.push('/auth');
          return;
        }

        setToken(session.access_token);

        const response = await fetch('/api/influencer', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch influencers');
        }

        const data = await response.json();
        setInfluencers(data.influencers || []);

        // Auto-select first influencer if available
        if (data.influencers && data.influencers.length > 0 && !selectedInfluencer) {
          setSelectedInfluencer(data.influencers[0]);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load influencers');
      } finally {
        setLoading(false);
      }
    };

    fetchInfluencers();
  }, [router]);

  const handleCreateNew = () => {
    router.push('/influencer-lab/my-influencers/new');
  };

  const handleSelectInfluencer = (influencer: Influencer) => {
    setSelectedInfluencer(influencer);
  };

  // Get all photos for the Instagram-like grid
  const getInfluencerPhotos = (influencer: Influencer): string[] => {
    const photos: string[] = [];
    if (influencer.photo_face_closeup) photos.push(influencer.photo_face_closeup);
    if (influencer.photo_full_body) photos.push(influencer.photo_full_body);
    if (influencer.photo_right_side) photos.push(influencer.photo_right_side);
    if (influencer.photo_left_side) photos.push(influencer.photo_left_side);
    if (influencer.photo_back_top) photos.push(influencer.photo_back_top);
    if (influencer.additional_photos) photos.push(...influencer.additional_photos);
    return photos;
  };

  if (loading) {
    return (
      <div className="influencer-loading">
        <Loader2 className="animate-spin" size={32} />
        <p>Loading influencers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="influencer-error">
        <AlertCircle size={32} />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="my-influencers-container">
      {/* Header */}
      <div className="my-influencers-header">
        <h1 className="my-influencers-title">My Influencers</h1>
        <button onClick={handleCreateNew} className="btn-create-new">
          <Plus size={18} />
          <span>Create New</span>
        </button>
      </div>

      <div className="my-influencers-layout">
        {/* Left Panel - List */}
        <div className="influencers-list-panel">
          {influencers.length === 0 ? (
            <div className="empty-state">
              <User size={48} strokeWidth={1.5} />
              <p>No influencers yet</p>
              <button onClick={handleCreateNew} className="btn-create-first">
                Create your first influencer
              </button>
            </div>
          ) : (
            <div className="influencers-list">
              {influencers.map((influencer) => (
                <button
                  key={influencer.id}
                  onClick={() => handleSelectInfluencer(influencer)}
                  className={`influencer-list-item ${
                    selectedInfluencer?.id === influencer.id ? 'active' : ''
                  }`}
                >
                  <div className="influencer-avatar">
                    {influencer.photo_face_closeup ? (
                      <img
                        src={influencer.photo_face_closeup}
                        alt={influencer.name}
                        className="influencer-avatar-img"
                      />
                    ) : (
                      <div className="influencer-avatar-placeholder">
                        <User size={24} />
                      </div>
                    )}
                  </div>
                  <div className="influencer-list-info">
                    <div className="influencer-list-name">
                      {influencer.name}
                      {influencer.username && (
                        <span className="influencer-username">@{influencer.username}</span>
                      )}
                    </div>
                    <p className="influencer-list-description">
                      {influencer.user_description}
                    </p>
                    {influencer.status === 'enriching' && (
                      <span className="status-badge enriching">
                        <Loader2 size={12} className="animate-spin" />
                        Enriching...
                      </span>
                    )}
                    {influencer.status === 'generating' && (
                      <span className="status-badge generating">
                        <Loader2 size={12} className="animate-spin" />
                        Generating...
                      </span>
                    )}
                    {influencer.status === 'failed' && (
                      <span className="status-badge failed">Failed</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel - Detail View */}
        <div className="influencer-detail-panel">
          {selectedInfluencer ? (
            <div className="influencer-detail">
              <div className="influencer-detail-header">
                <div className="influencer-detail-avatar">
                  {selectedInfluencer.photo_face_closeup ? (
                    <img
                      src={selectedInfluencer.photo_face_closeup}
                      alt={selectedInfluencer.name}
                    />
                  ) : (
                    <div className="avatar-placeholder-large">
                      <User size={64} />
                    </div>
                  )}
                </div>
                <div className="influencer-detail-info">
                  <h2 className="influencer-detail-name">{selectedInfluencer.name}</h2>
                  {selectedInfluencer.username && (
                    <p className="influencer-detail-username">
                      @{selectedInfluencer.username}
                    </p>
                  )}
                </div>
              </div>

              <div className="influencer-description-box">
                <h4 style={{ fontSize: 'var(--font-sm)', fontWeight: 'var(--font-semibold)', marginBottom: 'var(--space-2)', color: 'var(--text-muted)' }}>
                  Your Description
                </h4>
                <p style={{ marginBottom: 'var(--space-4)' }}>{selectedInfluencer.user_description}</p>
                
                {selectedInfluencer.enriched_description && (
                  <>
                    <h4 style={{ fontSize: 'var(--font-sm)', fontWeight: 'var(--font-semibold)', marginBottom: 'var(--space-2)', color: 'var(--text-muted)' }}>
                      AI-Enhanced Description
                    </h4>
                    <p style={{ fontStyle: 'italic', color: 'var(--text-tertiary)' }}>
                      {selectedInfluencer.enriched_description}
                    </p>
                  </>
                )}
              </div>

              {/* Instagram-like Photo Grid */}
              <div className="influencer-photos-section">
                <div className="photos-section-header">
                  <Instagram size={20} />
                  <h3>Photos</h3>
                </div>
                <div className="influencer-photo-grid">
                  {getInfluencerPhotos(selectedInfluencer).map((photo, index) => (
                    <div key={index} className="influencer-photo-item">
                      <img src={photo} alt={`${selectedInfluencer.name} photo ${index + 1}`} />
                    </div>
                  ))}
                  {getInfluencerPhotos(selectedInfluencer).length === 0 && (
                    <div className="no-photos-message">
                      {selectedInfluencer.status === 'generating' ? (
                        <>
                          <Loader2 className="animate-spin" size={24} />
                          <p>Generating photoshoot...</p>
                        </>
                      ) : (
                        <p>No photos available</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <User size={64} strokeWidth={1} />
              <p>Select an influencer to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

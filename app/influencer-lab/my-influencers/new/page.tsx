'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { supabaseClient } from '@/lib/supabaseClient';

export default function NewInfluencerPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    user_description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session?.access_token) {
        router.push('/auth');
        return;
      }

      if (!formData.name || !formData.user_description) {
        throw new Error('Please fill in all required fields');
      }

      // Step 1: Enrich the description with LLM
      const enrichResponse = await fetch('/api/influencer/enrich-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_description: formData.user_description,
        }),
      });

      if (!enrichResponse.ok) {
        throw new Error('Failed to enrich description');
      }

      const { enriched_description } = await enrichResponse.json();

      // Generate username from name (lowercase, no spaces)
      const username = formData.name.toLowerCase().replace(/\s+/g, '');

      // Step 2: Create influencer with enriched description
      const createResponse = await fetch('/api/influencer', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          username,
          user_description: formData.user_description,
          enriched_description,
          status: 'enriching', // Will be updated to 'generating' by photoshoot API
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create influencer');
      }

      const { influencer } = await createResponse.json();
      const serverUsername = influencer?.username;
      const redirectUsername =
        typeof serverUsername === 'string' && serverUsername.trim().length > 0
          ? serverUsername.trim()
          : undefined;

      // Step 3: Start photoshoot generation in the background using enriched description
      fetch('/api/influencer/generate-photoshoot', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          influencer_id: influencer.id,
          generation_prompt: enriched_description, // Use enriched description!
          input_images: null, // No input images for now
        }),
      }).catch(console.error); // Fire and forget

      // Redirect to my influencers page
      router.push(
        redirectUsername
          ? `/influencer-lab/my-influencers?created=${encodeURIComponent(redirectUsername)}`
          : '/influencer-lab/my-influencers'
      );
    } catch (err: any) {
      setError(err.message || 'Failed to create influencer');
      setLoading(false);
    }
  };

  return (
    <div className="new-influencer-container">
      <div className="new-influencer-header">
        <button onClick={() => router.back()} className="btn-back">
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
        <h1 className="new-influencer-title">Create New Influencer</h1>
      </div>

      <form onSubmit={handleSubmit} className="new-influencer-form">
        {error && (
          <div className="error-banner">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="form-section">
          <h2 className="form-section-title">Create Your Influencer</h2>
          
          <p className="form-intro">
            Simply provide a name and describe your influencer. Our AI will automatically enhance the description with modern details and generate 5 professional studio photos.
          </p>

          <div className="form-group">
            <label htmlFor="name" className="form-label">
              Name <span className="required">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g., Sarah Johnson"
              className="form-input"
              required
            />
            <p className="form-hint">
              This will also be used as the username (e.g., @sarahjohnson). If it already exists, we’ll auto-suffix it (e.g., @sarahjohnson2).
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="user_description" className="form-label">
              Description <span className="required">*</span>
            </label>
            <textarea
              id="user_description"
              name="user_description"
              value={formData.user_description}
              onChange={handleInputChange}
              placeholder="Describe your influencer: age, ethnicity, style, personality, vibe...&#10;&#10;Example: '28-year-old French woman, elegant and sophisticated, loves minimalist fashion, has short blonde hair, warm smile, confident presence'"
              className="form-textarea"
              rows={8}
              required
            />
            <p className="form-hint">
              💡 Our AI will enhance this description with modern 2025-2026 fashion details, current trends, and realistic elements while preserving your vision.
            </p>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>Create Influencer</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

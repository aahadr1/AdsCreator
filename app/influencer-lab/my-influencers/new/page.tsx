'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { supabaseClient } from '@/lib/supabaseClient';

export default function NewInfluencerPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    short_description: '',
    full_description: '',
    generation_prompt: '',
  });
  const [inputImages, setInputImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to upload image');
        }

        const data = await response.json();
        if (data.url) {
          uploadedUrls.push(data.url);
        }
      }

      setInputImages((prev) => [...prev, ...uploadedUrls]);
    } catch (err: any) {
      setError(err.message || 'Failed to upload images');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setInputImages((prev) => prev.filter((_, i) => i !== index));
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

      if (!formData.name || !formData.short_description || !formData.generation_prompt) {
        throw new Error('Please fill in all required fields');
      }

      // Create influencer
      const createResponse = await fetch('/api/influencer', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          username: formData.username || null,
          short_description: formData.short_description,
          full_description: formData.full_description || null,
          generation_prompt: formData.generation_prompt,
          input_images: inputImages.length > 0 ? inputImages : null,
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create influencer');
      }

      const { influencer } = await createResponse.json();

      // Start photoshoot generation in the background
      fetch('/api/influencer/generate-photoshoot', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          influencer_id: influencer.id,
          generation_prompt: formData.generation_prompt,
          input_images: inputImages.length > 0 ? inputImages : null,
        }),
      }).catch(console.error); // Fire and forget

      // Redirect to my influencers page
      router.push('/influencer-lab/my-influencers');
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
          <h2 className="form-section-title">Basic Information</h2>

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
          </div>

          <div className="form-group">
            <label htmlFor="username" className="form-label">
              Username <span className="optional">(optional)</span>
            </label>
            <div className="input-with-prefix">
              <span className="input-prefix">@</span>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="sarahjohnson"
                className="form-input with-prefix"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="short_description" className="form-label">
              Short Description <span className="required">*</span>
            </label>
            <input
              type="text"
              id="short_description"
              name="short_description"
              value={formData.short_description}
              onChange={handleInputChange}
              placeholder="Brief description (shown in list view)"
              className="form-input"
              maxLength={100}
              required
            />
            <p className="form-hint">{formData.short_description.length}/100 characters</p>
          </div>

          <div className="form-group">
            <label htmlFor="full_description" className="form-label">
              Full Description <span className="optional">(optional)</span>
            </label>
            <textarea
              id="full_description"
              name="full_description"
              value={formData.full_description}
              onChange={handleInputChange}
              placeholder="Detailed description of the influencer's persona, style, and characteristics"
              className="form-textarea"
              rows={4}
            />
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-section-title">Photoshoot Generation</h2>

          <div className="form-group">
            <label htmlFor="generation_prompt" className="form-label">
              Generation Prompt <span className="required">*</span>
            </label>
            <textarea
              id="generation_prompt"
              name="generation_prompt"
              value={formData.generation_prompt}
              onChange={handleInputChange}
              placeholder="Describe the influencer's appearance: age, ethnicity, style, clothing, etc. e.g., '25-year-old Asian woman with long black hair, wearing casual streetwear, confident smile'"
              className="form-textarea"
              rows={5}
              required
            />
            <p className="form-hint">
              This prompt will be used to generate 5 professional studio photos from different
              angles.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">
              Reference Images <span className="optional">(optional)</span>
            </label>
            <p className="form-hint">
              Upload reference images to help guide the generation for better consistency.
            </p>

            <div className="image-upload-area">
              <label htmlFor="image-upload" className="image-upload-label">
                <Upload size={24} />
                <span>Upload Images</span>
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="image-upload-input"
                  disabled={uploadingImage}
                />
              </label>

              {uploadingImage && (
                <div className="uploading-indicator">
                  <Loader2 className="animate-spin" size={20} />
                  <span>Uploading...</span>
                </div>
              )}
            </div>

            {inputImages.length > 0 && (
              <div className="uploaded-images-grid">
                {inputImages.map((url, index) => (
                  <div key={index} className="uploaded-image-item">
                    <img src={url} alt={`Reference ${index + 1}`} />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="remove-image-btn"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
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

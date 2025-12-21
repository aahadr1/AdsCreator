'use client';

import { useState } from 'react';
import { X, Upload, FolderOpen } from 'lucide-react';
import type { EditorAsset } from '../../../types/editor';
import EditorTaskSelector from './EditorTaskSelector';

type EditorUploadModalProps = {
  onClose: () => void;
  onAddAssets: (assets: EditorAsset[]) => void;
};

export default function EditorUploadModal({ onClose, onAddAssets }: EditorUploadModalProps) {
  const [showTaskSelector, setShowTaskSelector] = useState(false);
  const [uploadMode, setUploadMode] = useState<'device' | 'task' | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAssets: EditorAsset[] = [];

    for (const file of Array.from(files)) {
      const assetId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const fileType = file.type.split('/')[0];
      let type: EditorAsset['type'] = 'text';
      let url = '';

      if (fileType === 'image') {
        type = 'image';
        url = URL.createObjectURL(file);
        // Use image URL as thumbnail
        newAssets.push({
          id: assetId,
          type,
          url,
          name: file.name,
          source: 'upload',
          thumbnail: url,
        });
        continue;
      } else if (fileType === 'video') {
        type = 'video';
        url = URL.createObjectURL(file);
        // Get duration and thumbnail for video
        try {
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.muted = true;
          video.playsInline = true;
          video.src = url;
          
          let duration = 0;
          let thumbnail = '';
          
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => resolve(), 3000);
            
            const handleLoadedMetadata = () => {
              duration = video.duration && !isNaN(video.duration) ? video.duration : 0;
              if (duration > 0) {
                video.currentTime = Math.min(1, duration * 0.1);
              } else {
                video.currentTime = 0.1;
              }
            };
            
            const handleSeeked = () => {
              try {
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                  const canvas = document.createElement('canvas');
                  canvas.width = Math.min(video.videoWidth, 160);
                  canvas.height = Math.min(video.videoHeight, 90);
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    thumbnail = canvas.toDataURL('image/jpeg', 0.8);
                  }
                }
              } catch (e) {
                console.error('Failed to generate thumbnail:', e);
              }
              clearTimeout(timeout);
              resolve();
            };
            
            const handleError = () => {
              clearTimeout(timeout);
              resolve();
            };
            
            video.addEventListener('loadedmetadata', handleLoadedMetadata);
            video.addEventListener('seeked', handleSeeked);
            video.addEventListener('error', handleError);
          });
          
          newAssets.push({
            id: assetId,
            type,
            url,
            name: file.name,
            source: 'upload',
            duration: duration > 0 ? duration : undefined,
            thumbnail: thumbnail || undefined,
          });
          continue;
        } catch {
          newAssets.push({
            id: assetId,
            type,
            url,
            name: file.name,
            source: 'upload',
          });
          continue;
        }
      } else if (fileType === 'audio') {
        type = 'audio';
        url = URL.createObjectURL(file);
        // Get duration for audio
        try {
          const audio = document.createElement('audio');
          audio.preload = 'metadata';
          audio.src = url;
          await new Promise<void>((resolve, reject) => {
            audio.onloadedmetadata = () => resolve();
            audio.onerror = () => resolve(); // Resolve even on error to continue
            setTimeout(() => resolve(), 2000); // Timeout after 2s
          });
          const duration = audio.duration && !isNaN(audio.duration) ? audio.duration : 0;
          newAssets.push({
            id: assetId,
            type,
            url,
            name: file.name,
            source: 'upload',
            duration: duration > 0 ? duration : undefined,
          });
          continue;
        } catch {
          newAssets.push({
            id: assetId,
            type,
            url,
            name: file.name,
            source: 'upload',
          });
          continue;
        }
      } else {
        // Text file or unknown
        const text = await file.text();
        url = `data:text/plain;base64,${btoa(text)}`;
        type = 'text';
      }

      newAssets.push({
        id: assetId,
        type,
        url,
        name: file.name,
        source: 'upload',
      });
    }

    onAddAssets(newAssets);
    onClose();
  };

  const handleTaskSelect = (assets: EditorAsset[]) => {
    onAddAssets(assets);
    setShowTaskSelector(false);
    onClose();
  };

  if (showTaskSelector) {
    return (
      <EditorTaskSelector
        onClose={() => {
          setShowTaskSelector(false);
          setUploadMode(null);
        }}
        onSelect={handleTaskSelect}
      />
    );
  }

  if (uploadMode === 'device') {
    return (
      <div className="assistant-editor-upload-modal-overlay" onClick={onClose}>
        <div className="assistant-editor-upload-modal" onClick={(e) => e.stopPropagation()}>
          <div className="assistant-editor-upload-modal-header">
            <h3>Upload from Device</h3>
            <button className="assistant-editor-upload-modal-close" onClick={onClose} type="button">
              <X size={20} />
            </button>
          </div>
          <div className="assistant-editor-upload-modal-content">
            <label className="assistant-editor-upload-file-label">
              <input
                type="file"
                multiple
                accept="image/*,video/*,audio/*,text/*"
                onChange={handleFileSelect}
                className="assistant-editor-upload-file-input"
              />
              <div className="assistant-editor-upload-file-area">
                <Upload size={32} />
                <p>Click to select files or drag and drop</p>
                <p className="assistant-editor-upload-file-hint">
                  Supports images, videos, audio, and text files
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="assistant-editor-upload-modal-overlay" onClick={onClose}>
      <div className="assistant-editor-upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="assistant-editor-upload-modal-header">
          <h3>Upload Media</h3>
          <button className="assistant-editor-upload-modal-close" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>
        <div className="assistant-editor-upload-modal-content">
          <div className="assistant-editor-upload-options">
            <button
              className="assistant-editor-upload-option"
              onClick={() => setUploadMode('device')}
              type="button"
            >
              <Upload size={24} />
              <span>From Device</span>
              <p>Upload files from your computer</p>
            </button>
            <button
              className="assistant-editor-upload-option"
              onClick={() => setShowTaskSelector(true)}
              type="button"
            >
              <FolderOpen size={24} />
              <span>From Tasks</span>
              <p>Select from your previous tasks</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


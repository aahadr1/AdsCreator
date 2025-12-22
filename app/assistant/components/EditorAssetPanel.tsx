'use client';

import { useState } from 'react';
import { Upload, Video, Image as ImageIcon, Music } from 'lucide-react';
import type { EditorAsset } from '../../../types/editor';

type EditorAssetPanelProps = {
  assets: EditorAsset[];
  onAddAsset: (asset: EditorAsset) => void;
};

export default function EditorAssetPanel({ assets, onAddAsset }: EditorAssetPanelProps) {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const url = URL.createObjectURL(file);
        const type = file.type.startsWith('video/') ? 'video' : 
                    file.type.startsWith('image/') ? 'image' : 'audio';
        
        // Get duration for video/audio
        let duration = 5;
        if (type === 'video') {
          const video = document.createElement('video');
          video.src = url;
          await new Promise((resolve) => {
            video.onloadedmetadata = () => {
              duration = video.duration;
              resolve(null);
            };
          });
        }

        const asset: EditorAsset = {
          id: `asset-${Date.now()}-${Math.random()}`,
          name: file.name,
          type,
          url,
          duration,
          thumbnail: type === 'image' ? url : undefined,
          source: 'upload',
        };

        onAddAsset(asset);
      }
    } finally {
      setUploading(false);
    }
  };

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video size={16} />;
      case 'image': return <ImageIcon size={16} />;
      case 'audio': return <Music size={16} />;
      default: return <Video size={16} />;
    }
  };

  return (
    <div className="assistant-editor-assets">
      <div className="assistant-editor-assets-header">
        <h3>Media</h3>
        <label className="assistant-editor-upload-btn">
          <Upload size={16} />
          Upload
          <input
            type="file"
            multiple
            accept="video/*,image/*,audio/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            disabled={uploading}
          />
        </label>
      </div>

      <div className="assistant-editor-assets-list">
        {assets.length === 0 ? (
          <div className="assistant-editor-assets-empty">
            <p>No media yet</p>
            <p className="text-sm text-gray-500">Upload files to get started</p>
          </div>
        ) : (
          assets.map((asset) => (
            <div
              key={asset.id}
              className="assistant-editor-asset-item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('assetId', asset.id);
              }}
            >
              <div className="assistant-editor-asset-icon">
                {getAssetIcon(asset.type)}
              </div>
              <div className="assistant-editor-asset-info">
                <div className="assistant-editor-asset-name">{asset.name}</div>
                <div className="assistant-editor-asset-meta">
                  {asset.type} • {asset.duration?.toFixed(1)}s
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}


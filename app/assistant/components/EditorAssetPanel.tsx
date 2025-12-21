'use client';

import { useState, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, Video, Music, FileText, Play } from 'lucide-react';
import type { EditorAsset } from '../../../types/editor';
import EditorUploadModal from './EditorUploadModal';

type EditorAssetPanelProps = {
  assets: EditorAsset[];
  selectedAssetId?: string | null;
  onAddAsset: (asset: EditorAsset) => void;
  onRemoveAsset: (assetId: string) => void;
  onSelectAsset?: (assetId: string | null) => void;
};

export default function EditorAssetPanel({ assets, selectedAssetId, onAddAsset, onRemoveAsset, onSelectAsset }: EditorAssetPanelProps) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  const getAssetIcon = (type: EditorAsset['type']) => {
    switch (type) {
      case 'image':
        return <ImageIcon size={16} />;
      case 'video':
        return <Video size={16} />;
      case 'audio':
        return <Music size={16} />;
      case 'text':
        return <FileText size={16} />;
      default:
        return <FileText size={16} />;
    }
  };

  const getProxiedUrl = (url: string) => {
    if (url.startsWith('http')) {
      return `/api/proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  // Generate thumbnails for video assets
  useEffect(() => {
    const generateThumbnails = async () => {
      for (const asset of assets) {
        if (asset.type === 'video' && asset.url && !thumbnails[asset.id] && !asset.thumbnail) {
          try {
            const video = document.createElement('video');
            video.crossOrigin = 'anonymous';
            video.preload = 'metadata';
            video.muted = true;
            video.playsInline = true;
            const proxiedUrl = asset.url.startsWith('http') ? `/api/proxy?url=${encodeURIComponent(asset.url)}` : asset.url;
            video.src = proxiedUrl;
            
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                resolve();
              }, 3000);
              
              const handleLoadedMetadata = () => {
                clearTimeout(timeout);
                if (video.duration && video.duration > 0) {
                  video.currentTime = Math.min(1, video.duration * 0.1);
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
                      setThumbnails(prev => ({
                        ...prev,
                        [asset.id]: canvas.toDataURL('image/jpeg', 0.8)
                      }));
                    }
                  }
                } catch (e) {
                  console.error('Failed to generate thumbnail:', e);
                }
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
          } catch (e) {
            console.error('Error generating thumbnail:', e);
          }
        } else if (asset.type === 'image' && asset.url && !thumbnails[asset.id] && !asset.thumbnail) {
          // Use image URL as thumbnail
          setThumbnails(prev => ({
            ...prev,
            [asset.id]: asset.url
          }));
        }
      }
    };

    generateThumbnails();
  }, [assets, thumbnails]);

  return (
    <div className="assistant-editor-asset-panel">
      <div className="assistant-editor-asset-panel-header">
        <h3>Assets</h3>
        <button
          className="assistant-editor-upload-button"
          onClick={() => setShowUploadModal(true)}
          type="button"
        >
          <Upload size={16} />
          Upload
        </button>
      </div>

      <div className="assistant-editor-asset-list">
        {assets.length === 0 ? (
          <div className="assistant-editor-asset-empty">
            <p>No assets yet. Upload media to get started.</p>
          </div>
        ) : (
          assets.map((asset) => (
            <div
              key={asset.id}
              className={`assistant-editor-asset-item ${selectedAssetId === asset.id ? 'selected' : ''}`}
              draggable
              onClick={(e) => {
                e.stopPropagation();
                onSelectAsset?.(asset.id);
              }}
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('text/plain', asset.id);
                e.dataTransfer.setData('application/json', JSON.stringify({ assetId: asset.id }));
              }}
            >
              <div className="assistant-editor-asset-thumbnail">
                {(asset.thumbnail || thumbnails[asset.id]) ? (
                  <img
                    src={getProxiedUrl(asset.thumbnail || thumbnails[asset.id] || '')}
                    alt={asset.name}
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src.includes('/api/proxy') && target.src !== asset.url) {
                        target.src = asset.url;
                      } else if (target.src !== asset.url && asset.url) {
                        target.src = asset.url;
                      } else {
                        // Fallback to icon
                        target.style.display = 'none';
                        const iconDiv = target.nextElementSibling as HTMLElement;
                        if (iconDiv) iconDiv.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <div className="assistant-editor-asset-icon" style={{ display: (asset.thumbnail || thumbnails[asset.id]) ? 'none' : 'flex' }}>
                  {getAssetIcon(asset.type)}
                  {asset.type === 'video' && <Play size={12} className="assistant-editor-asset-play-overlay" />}
                </div>
              </div>
              <div className="assistant-editor-asset-info">
                <div className="assistant-editor-asset-name">{asset.name}</div>
                <div className="assistant-editor-asset-meta">
                  {asset.type} {asset.duration ? `• ${asset.duration.toFixed(1)}s` : ''}
                </div>
              </div>
              <button
                className="assistant-editor-asset-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveAsset(asset.id);
                }}
                type="button"
              >
                <X size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {showUploadModal && (
        <EditorUploadModal
          onClose={() => setShowUploadModal(false)}
          onAddAssets={(newAssets) => {
            newAssets.forEach((asset) => onAddAsset(asset));
            setShowUploadModal(false);
          }}
        />
      )}
    </div>
  );
}


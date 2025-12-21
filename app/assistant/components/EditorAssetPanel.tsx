'use client';

import { useState } from 'react';
import { Upload, X, Image as ImageIcon, Video, Music, FileText } from 'lucide-react';
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
                {asset.type === 'image' && asset.url ? (
                  <img
                    src={getProxiedUrl(asset.url)}
                    alt={asset.name}
                    onError={(e) => {
                      if (e.currentTarget.src !== asset.url) {
                        e.currentTarget.src = asset.url;
                      }
                    }}
                  />
                ) : (
                  <div className="assistant-editor-asset-icon">{getAssetIcon(asset.type)}</div>
                )}
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


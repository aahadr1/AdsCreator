'use client';

import { useState } from 'react';
import { Download, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';

type OutputPreviewProps = {
  url?: string | null;
  text?: string | null;
  stepId?: string;
  stepTitle?: string;
  compact?: boolean; // New prop for compact mode
};

export default function OutputPreview({ url, text, stepId, stepTitle, compact = false }: OutputPreviewProps) {
  const [expanded, setExpanded] = useState(!compact);
  if (text && !url) {
    return (
      <div className={`output-preview output-preview-text ${expanded ? 'expanded' : 'collapsed'}`}>
        <div className="output-preview-content">
          {expanded ? (
            <pre>{text}</pre>
          ) : (
            <div className="output-preview-compact" onClick={() => setExpanded(true)}>
              <span className="output-preview-icon">📄</span>
              <span className="output-preview-preview-text">{text.slice(0, 100)}{text.length > 100 ? '...' : ''}</span>
            </div>
          )}
        </div>
        {expanded && (
          <div className="output-preview-actions">
            <button
              className="output-preview-action"
              onClick={() => setExpanded(false)}
              title="Collapse"
            >
              <Minimize2 size={14} />
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!url) return null;

  const isImage = /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(url);
  const isVideo = /\.(mp4|webm|mov|avi)(\?|$)/i.test(url) || url.includes('video');
  const isAudio = /\.(mp3|wav|ogg|m4a)(\?|$)/i.test(url) || url.includes('audio');

  const proxiedUrl = url.startsWith('http') 
    ? `/api/proxy?${isVideo ? 'type=video&' : ''}url=${encodeURIComponent(url)}`
    : url;

  return (
    <div className={`output-preview ${expanded ? 'expanded' : 'collapsed'}`}>
      <div className="output-preview-content">
        {isImage && (
          <>
            {expanded ? (
              <img
                src={proxiedUrl}
                alt={stepTitle || 'Output'}
                className="output-preview-image"
                onError={(e) => {
                  if (e.currentTarget.src !== url) {
                    e.currentTarget.src = url;
                  }
                }}
              />
            ) : (
              <div 
                className="output-preview-compact output-preview-compact-image"
                onClick={() => setExpanded(true)}
              >
                <img
                  src={proxiedUrl}
                  alt={stepTitle || 'Output'}
                  className="output-preview-thumbnail"
                  onError={(e) => {
                    if (e.currentTarget.src !== url) {
                      e.currentTarget.src = url;
                    }
                  }}
                />
                <div className="output-preview-overlay">
                  <Maximize2 size={16} />
                </div>
              </div>
            )}
          </>
        )}
        {isVideo && (
          <>
            {expanded ? (
              <video
                controls
                preload="metadata"
                playsInline
                className="output-preview-video"
                onError={(e) => {
                  const video = e.currentTarget;
                  if (video.src !== url && !video.querySelector('source[src="' + url + '"]')) {
                    const source = document.createElement('source');
                    source.src = url;
                    video.appendChild(source);
                    video.load();
                  }
                }}
              >
                <source src={proxiedUrl} type="video/mp4" />
                <source src={url} />
              </video>
            ) : (
              <div 
                className="output-preview-compact output-preview-compact-video"
                onClick={() => setExpanded(true)}
              >
                <div className="output-preview-thumbnail output-preview-thumbnail-video">
                  <span>🎥</span>
                </div>
                <div className="output-preview-overlay">
                  <Maximize2 size={16} />
                </div>
              </div>
            )}
          </>
        )}
        {isAudio && (
          <>
            {expanded ? (
              <div className="output-preview-audio">
                <audio controls preload="metadata" className="output-preview-audio-player">
                  <source src={proxiedUrl} />
                  <source src={url} />
                </audio>
              </div>
            ) : (
              <div 
                className="output-preview-compact output-preview-compact-audio"
                onClick={() => setExpanded(true)}
              >
                <div className="output-preview-thumbnail output-preview-thumbnail-audio">
                  <span>🎵</span>
                </div>
                <div className="output-preview-overlay">
                  <Maximize2 size={16} />
                </div>
              </div>
            )}
          </>
        )}
        {!isImage && !isVideo && !isAudio && (
          <div className="output-preview-fallback">
            <ExternalLink size={16} />
            <a href={url} target="_blank" rel="noreferrer" className="output-preview-link">
              {url}
            </a>
          </div>
        )}
      </div>
      {expanded && (
        <div className="output-preview-actions">
          <button
            className="output-preview-action"
            onClick={() => setExpanded(false)}
            title="Collapse"
          >
            <Minimize2 size={14} />
          </button>
          <a
            href={proxiedUrl}
            target="_blank"
            rel="noreferrer"
            className="output-preview-action"
            title="Open in new tab"
          >
            <ExternalLink size={14} />
          </a>
          <a
            href={`${proxiedUrl}${proxiedUrl.includes('?') ? '&' : '?'}download=true`}
            download
            className="output-preview-action"
            title="Download"
          >
            <Download size={14} />
          </a>
        </div>
      )}
    </div>
  );
}


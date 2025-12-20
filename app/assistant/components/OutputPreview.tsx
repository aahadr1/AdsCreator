'use client';

import { Download, ExternalLink } from 'lucide-react';

type OutputPreviewProps = {
  url?: string | null;
  text?: string | null;
  stepId?: string;
  stepTitle?: string;
};

export default function OutputPreview({ url, text, stepId, stepTitle }: OutputPreviewProps) {
  if (text && !url) {
    return (
      <div className="output-preview output-preview-text">
        <div className="output-preview-content">
          <pre>{text}</pre>
        </div>
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
    <div className="output-preview">
      <div className="output-preview-content">
        {isImage && (
          <img
            src={proxiedUrl}
            alt={stepTitle || 'Output'}
            className="output-preview-image"
            onError={(e) => {
              // Fallback to direct URL if proxy fails
              if (e.currentTarget.src !== url) {
                e.currentTarget.src = url;
              }
            }}
          />
        )}
        {isVideo && (
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
        )}
        {isAudio && (
          <div className="output-preview-audio">
            <audio controls preload="metadata" className="output-preview-audio-player">
              <source src={proxiedUrl} />
              <source src={url} />
            </audio>
          </div>
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
      <div className="output-preview-actions">
        <a
          href={proxiedUrl}
          target="_blank"
          rel="noreferrer"
          className="output-preview-action"
        >
          <ExternalLink size={14} />
          Open
        </a>
        <a
          href={`${proxiedUrl}${proxiedUrl.includes('?') ? '&' : '?'}download=true`}
          download
          className="output-preview-action"
        >
          <Download size={14} />
          Download
        </a>
      </div>
    </div>
  );
}


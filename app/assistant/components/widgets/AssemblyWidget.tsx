'use client';

import { useState } from 'react';
import {
  Film,
  Download,
  Play,
  Music,
  Type,
  Layers,
  Settings,
  GripVertical,
  Check,
  RefreshCw,
} from 'lucide-react';
import type { Clip, FinalEdit, Storyboard, TransitionType, SubtitleConfig } from '@/types/ugc';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type AssemblyWidgetProps = {
  data: {
    clips: Clip[];
    finalEdit?: FinalEdit;
    storyboard?: Storyboard;
  };
  onAction: (action: string, data?: any) => void;
};

// -----------------------------------------------------------------------------
// Clip Item (Draggable)
// -----------------------------------------------------------------------------

function ClipItem({
  clip,
  scene,
  index,
  transition,
  onTransitionChange,
}: {
  clip: Clip;
  scene?: any;
  index: number;
  transition: TransitionType;
  onTransitionChange: (transition: TransitionType) => void;
}) {
  return (
    <div className="assembly-clip">
      <div className="clip-drag">
        <GripVertical size={16} />
      </div>
      <div className="clip-preview">
        {clip.thumbnailUrl || clip.videoUrl ? (
          <video src={clip.videoUrl} muted />
        ) : (
          <Film size={20} />
        )}
      </div>
      <div className="clip-info">
        <span className="clip-number">Clip {index + 1}</span>
        <span className="clip-beat">{scene?.beatType || 'Scene'}</span>
        <span className="clip-duration">{scene?.duration || '?'}s</span>
      </div>
      <div className="clip-transition">
        <select
          value={transition}
          onChange={e => onTransitionChange(e.target.value as TransitionType)}
        >
          <option value="cut">Cut</option>
          <option value="swipe">Swipe</option>
          <option value="fade">Fade</option>
          <option value="none">None</option>
        </select>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Widget
// -----------------------------------------------------------------------------

export function AssemblyWidget({ data, onAction }: AssemblyWidgetProps) {
  const { clips, finalEdit, storyboard } = data;

  const [subtitles, setSubtitles] = useState<SubtitleConfig>(
    finalEdit?.subtitles || { enabled: true, style: 'ugc-bold', burnIn: false }
  );
  const [transitions, setTransitions] = useState<Record<string, TransitionType>>(
    finalEdit?.transitions || {}
  );
  const [showOverlays, setShowOverlays] = useState(finalEdit?.overlays?.ctaEndCard || false);

  const handleExport = () => {
    onAction('export', {
      subtitles,
      transitions,
      overlays: { ctaEndCard: showOverlays },
    });
  };

  const handlePreview = () => {
    onAction('preview_assembly');
  };

  const isExporting = finalEdit?.exportStatus === 'processing';
  const isReady = finalEdit?.exportStatus === 'complete' && finalEdit.finalVideoUrl;

  return (
    <div className="widget widget-assembly">
      <div className="widget-header">
        <Film size={18} />
        <h3>Final Assembly</h3>
      </div>

      {/* Timeline */}
      <div className="assembly-timeline">
        <h4>Clip Order</h4>
        <div className="timeline-clips">
          {clips.map((clip, i) => {
            const scene = storyboard?.scenes.find(s => s.id === clip.sceneId);
            return (
              <ClipItem
                key={clip.id}
                clip={clip}
                scene={scene}
                index={i}
                transition={transitions[clip.id] || 'cut'}
                onTransitionChange={t => setTransitions({ ...transitions, [clip.id]: t })}
              />
            );
          })}
        </div>
      </div>

      {/* Options */}
      <div className="assembly-options">
        {/* Subtitles */}
        <div className="option-group">
          <h4><Type size={14} /> Subtitles</h4>
          <label className="toggle-option">
            <input
              type="checkbox"
              checked={subtitles.enabled}
              onChange={e => setSubtitles({ ...subtitles, enabled: e.target.checked })}
            />
            <span>Enable subtitles</span>
          </label>
          {subtitles.enabled && (
            <>
              <select
                value={subtitles.style}
                onChange={e => setSubtitles({ ...subtitles, style: e.target.value as any })}
              >
                <option value="ugc-bold">UGC Bold</option>
                <option value="minimal">Minimal</option>
                <option value="kinetic">Kinetic</option>
              </select>
              <label className="toggle-option">
                <input
                  type="checkbox"
                  checked={subtitles.burnIn}
                  onChange={e => setSubtitles({ ...subtitles, burnIn: e.target.checked })}
                />
                <span>Burn into video</span>
              </label>
            </>
          )}
        </div>

        {/* Overlays */}
        <div className="option-group">
          <h4><Layers size={14} /> Overlays</h4>
          <label className="toggle-option">
            <input
              type="checkbox"
              checked={showOverlays}
              onChange={e => setShowOverlays(e.target.checked)}
            />
            <span>CTA end card</span>
          </label>
        </div>

        {/* Music (placeholder) */}
        <div className="option-group">
          <h4><Music size={14} /> Music</h4>
          <p className="option-placeholder">Coming soon</p>
        </div>
      </div>

      {/* Final Video */}
      {isReady && finalEdit?.finalVideoUrl && (
        <div className="assembly-preview">
          <h4>Final Video</h4>
          <video src={finalEdit.finalVideoUrl} controls className="final-video" />
        </div>
      )}

      {/* Actions */}
      <div className="assembly-actions">
        <button className="btn-secondary" onClick={handlePreview} disabled={isExporting}>
          <Play size={16} />
          Preview
        </button>
        
        {isReady ? (
          <a
            href={finalEdit?.finalVideoUrl}
            download
            className="btn-primary"
          >
            <Download size={16} />
            Download Video
          </a>
        ) : (
          <button
            className="btn-primary"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <RefreshCw size={16} className="spin" />
                Exporting...
              </>
            ) : (
              <>
                <Check size={16} />
                Export Final Video
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default AssemblyWidget;

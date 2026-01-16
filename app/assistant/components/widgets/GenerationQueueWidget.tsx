'use client';

import { useState } from 'react';
import {
  Video,
  Clock,
  Check,
  X,
  RefreshCw,
  Play,
  AlertCircle,
  Eye,
  Zap,
} from 'lucide-react';
import type { Scene, Clip, ClipFeedback } from '@/types/ugc';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type GenerationQueueWidgetProps = {
  data: {
    scenes: Scene[];
    clips: Clip[];
  };
  onAction: (action: string, data?: any) => void;
};

// -----------------------------------------------------------------------------
// Clip Row
// -----------------------------------------------------------------------------

function ClipRow({
  scene,
  clip,
  index,
  onAction,
}: {
  scene: Scene;
  clip?: Clip;
  index: number;
  onAction: (action: string, data?: any) => void;
}) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<ClipFeedback[]>([]);

  const status = clip?.status || 'pending';
  const progress = clip?.progress || 0;

  const feedbackOptions: { id: ClipFeedback; label: string }[] = [
    { id: 'too-much-motion', label: 'Too much motion' },
    { id: 'actor-looks-different', label: 'Actor looks different' },
    { id: 'product-unclear', label: 'Product unclear' },
    { id: 'lighting-inconsistent', label: 'Lighting inconsistent' },
    { id: 'text-artifacts', label: 'Text artifacts' },
  ];

  const handleRegenerate = () => {
    onAction('regenerate_clip', {
      sceneId: scene.id,
      clipId: clip?.id,
      feedback: selectedFeedback,
    });
    setShowFeedback(false);
    setSelectedFeedback([]);
  };

  return (
    <div className={`queue-row status-${status}`}>
      <div className="queue-scene">
        <span className="scene-number">{index + 1}</span>
        <div className="scene-info">
          <span className="scene-beat">{scene.beatType}</span>
          <span className="scene-duration">{scene.duration}s</span>
        </div>
      </div>

      <div className="queue-status">
        {status === 'pending' && (
          <>
            <Clock size={16} />
            <span>Pending</span>
          </>
        )}
        {status === 'processing' && (
          <>
            <RefreshCw size={16} className="spin" />
            <span>Generating... {progress > 0 && `${progress}%`}</span>
          </>
        )}
        {status === 'complete' && (
          <>
            <Check size={16} />
            <span>Ready</span>
          </>
        )}
        {status === 'failed' && (
          <>
            <AlertCircle size={16} />
            <span>Failed</span>
          </>
        )}
      </div>

      <div className="queue-actions">
        {status === 'pending' && (
          <button
            className="btn-small"
            onClick={() => onAction('start_clip', { sceneId: scene.id })}
          >
            <Play size={14} /> Start
          </button>
        )}

        {status === 'complete' && clip?.videoUrl && (
          <>
            <button
              className="btn-small"
              onClick={() => onAction('preview_clip', { clipId: clip.id })}
            >
              <Eye size={14} /> Preview
            </button>
            <button
              className="btn-small"
              onClick={() => setShowFeedback(!showFeedback)}
            >
              <RefreshCw size={14} /> Regenerate
            </button>
          </>
        )}

        {status === 'failed' && (
          <button
            className="btn-small btn-retry"
            onClick={() => onAction('retry_clip', { sceneId: scene.id })}
          >
            <RefreshCw size={14} /> Retry
          </button>
        )}
      </div>

      {/* Feedback Panel */}
      {showFeedback && (
        <div className="feedback-panel">
          <p>What&apos;s wrong with this clip?</p>
          <div className="feedback-options">
            {feedbackOptions.map(opt => (
              <button
                key={opt.id}
                className={`feedback-chip ${selectedFeedback.includes(opt.id) ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedFeedback(prev =>
                    prev.includes(opt.id)
                      ? prev.filter(f => f !== opt.id)
                      : [...prev, opt.id]
                  );
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="feedback-actions">
            <button className="btn-small btn-primary" onClick={handleRegenerate}>
              <Zap size={14} /> Apply Fix & Regenerate
            </button>
            <button className="btn-small" onClick={() => setShowFeedback(false)}>
              Cancel
            </button>
          </div>
          {clip?.autoFixSuggestion && (
            <p className="auto-fix-suggestion">
              💡 Suggested fix: {clip.autoFixSuggestion}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Widget
// -----------------------------------------------------------------------------

export function GenerationQueueWidget({ data, onAction }: GenerationQueueWidgetProps) {
  const { scenes, clips } = data;

  const completedCount = clips.filter(c => c.status === 'complete').length;
  const processingCount = clips.filter(c => c.status === 'processing').length;
  const failedCount = clips.filter(c => c.status === 'failed').length;

  const allComplete = completedCount === scenes.length;

  const handleStartAll = () => {
    onAction('start_all_clips');
  };

  const handleAssemble = () => {
    onAction('assemble');
  };

  return (
    <div className="widget widget-generation-queue">
      <div className="widget-header">
        <Video size={18} />
        <h3>Video Generation</h3>
        <div className="queue-stats">
          <span className="stat complete">{completedCount} ready</span>
          {processingCount > 0 && (
            <span className="stat processing">{processingCount} generating</span>
          )}
          {failedCount > 0 && (
            <span className="stat failed">{failedCount} failed</span>
          )}
        </div>
      </div>

      <div className="queue-list">
        {scenes.map((scene, i) => {
          const clip = clips.find(c => c.sceneId === scene.id);
          return (
            <ClipRow
              key={scene.id}
              scene={scene}
              clip={clip}
              index={i}
              onAction={onAction}
            />
          );
        })}
      </div>

      <div className="queue-actions">
        {!allComplete && (
          <button
            className="btn-secondary"
            onClick={handleStartAll}
            disabled={processingCount > 0}
          >
            <Play size={16} />
            {processingCount > 0 ? 'Generating...' : 'Generate All'}
          </button>
        )}
        {allComplete && (
          <button className="btn-primary" onClick={handleAssemble}>
            <Video size={16} />
            Assemble Final Video
          </button>
        )}
      </div>
    </div>
  );
}

export default GenerationQueueWidget;

'use client';

import { useState } from 'react';
import {
  Film,
  Clock,
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  RefreshCw,
  Trash2,
  Plus,
  Copy,
  Play,
  Image as ImageIcon,
  FileText,
  AlertCircle,
} from 'lucide-react';
import type { Scene, Storyboard, Keyframe, BeatType, ShotType } from '@/types/ugc';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type StoryboardWidgetProps = {
  data: {
    storyboard: Storyboard;
    isApproved: boolean;
    totalDuration: number;
    sceneCount: number;
  };
  onAction: (action: string, data?: any) => void;
};

// -----------------------------------------------------------------------------
// Scene Card
// -----------------------------------------------------------------------------

function SceneCard({
  scene,
  index,
  expanded,
  onToggle,
  onAction,
  locked,
}: {
  scene: Scene;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onAction: (action: string, data?: any) => void;
  locked: boolean;
}) {
  const firstKeyframe = scene.keyframes.find(k => k.position === 'first');
  const lastKeyframe = scene.keyframes.find(k => k.position === 'last');

  const beatTypeLabels: Record<BeatType, string> = {
    hook: '🎣 Hook',
    problem: '😤 Problem',
    solution: '✨ Solution',
    proof: '📊 Proof',
    demo: '📱 Demo',
    cta: '🎯 CTA',
    transition: '↔️ Transition',
  };

  const hasErrors = scene.validationErrors && scene.validationErrors.length > 0;

  return (
    <div className={`scene-card ${expanded ? 'expanded' : ''} ${hasErrors ? 'has-errors' : ''}`}>
      {/* Header */}
      <div className="scene-header" onClick={onToggle}>
        <div className="scene-number">{index + 1}</div>
        <div className="scene-title">
          <span className="scene-beat">{beatTypeLabels[scene.beatType]}</span>
          <span className="scene-duration">{scene.duration}s</span>
        </div>
        <div className="scene-status">
          {scene.isApproved ? (
            <span className="status-approved"><Check size={14} /> Approved</span>
          ) : hasErrors ? (
            <span className="status-error"><AlertCircle size={14} /> Needs fixes</span>
          ) : (
            <span className="status-draft">Draft</span>
          )}
        </div>
        <button className="scene-toggle">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Content */}
      {expanded && (
        <div className="scene-content">
          {/* Keyframes Row */}
          <div className="scene-keyframes">
            <KeyframeThumbnail
              keyframe={firstKeyframe}
              label="First"
              onRegenerate={() => onAction('regenerate_keyframe', { sceneId: scene.id, position: 'first' })}
            />
            <div className="keyframe-arrow">→</div>
            <KeyframeThumbnail
              keyframe={lastKeyframe}
              label="Last"
              onRegenerate={() => onAction('regenerate_keyframe', { sceneId: scene.id, position: 'last' })}
            />
          </div>

          {/* Script Panel */}
          <div className="scene-script">
            <div className="script-section">
              <label><FileText size={14} /> Script / Dialogue</label>
              <p>{scene.script || <em>No script yet</em>}</p>
            </div>

            {scene.onScreenText && (
              <div className="script-section">
                <label>On-Screen Text</label>
                <p>{scene.onScreenText}</p>
              </div>
            )}

            {scene.actionNotes && (
              <div className="script-section">
                <label>Action Notes</label>
                <p>{scene.actionNotes}</p>
              </div>
            )}
          </div>

          {/* Validation Errors */}
          {hasErrors && (
            <div className="scene-errors">
              {scene.validationErrors!.map((err, i) => (
                <div key={i} className="error-item">
                  <AlertCircle size={12} />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          {!locked && (
            <div className="scene-actions">
              <button
                className="btn-small"
                onClick={() => onAction('edit_scene', { sceneId: scene.id })}
              >
                <Edit3 size={14} /> Edit
              </button>
              <button
                className="btn-small"
                onClick={() => onAction('regenerate_keyframes', { sceneId: scene.id })}
              >
                <RefreshCw size={14} /> Regen Keyframes
              </button>
              <button
                className="btn-small"
                onClick={() => onAction('duplicate_scene', { sceneId: scene.id })}
              >
                <Copy size={14} /> Duplicate
              </button>
              {!scene.isApproved && (
                <button
                  className="btn-small btn-approve"
                  onClick={() => onAction('approve_scene', { sceneId: scene.id })}
                  disabled={hasErrors}
                >
                  <Check size={14} /> Approve
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Keyframe Thumbnail
// -----------------------------------------------------------------------------

function KeyframeThumbnail({
  keyframe,
  label,
  onRegenerate,
}: {
  keyframe?: Keyframe;
  label: string;
  onRegenerate: () => void;
}) {
  const isReady = keyframe?.status === 'complete' && keyframe.imageUrl;
  const isProcessing = keyframe?.status === 'processing';

  return (
    <div className="keyframe-thumbnail">
      <div className="keyframe-image">
        {isReady && keyframe?.imageUrl ? (
          <img src={keyframe.imageUrl} alt={label} />
        ) : isProcessing ? (
          <div className="keyframe-loading">
            <RefreshCw size={16} className="spin" />
          </div>
        ) : (
          <div className="keyframe-placeholder">
            <ImageIcon size={20} />
          </div>
        )}
        <button className="keyframe-regen" onClick={onRegenerate} title="Regenerate">
          <RefreshCw size={12} />
        </button>
      </div>
      <span className="keyframe-label">{label}</span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Widget
// -----------------------------------------------------------------------------

export function StoryboardWidget({ data, onAction }: StoryboardWidgetProps) {
  const { storyboard, isApproved, totalDuration, sceneCount } = data;
  const [expandedScene, setExpandedScene] = useState<string | null>(
    storyboard.scenes[0]?.id || null
  );

  const handleApproveAll = () => {
    onAction('approve_storyboard');
  };

  const handleGenerateVideos = () => {
    onAction('generate_videos');
  };

  const allScenesApproved = storyboard.scenes.every(s => s.isApproved);
  const allKeyframesReady = storyboard.scenes.every(s =>
    s.keyframes.filter(k => k.status === 'complete').length >= 2
  );

  return (
    <div className="widget widget-storyboard">
      {/* Header */}
      <div className="widget-header">
        <Film size={18} />
        <h3>Storyboard</h3>
        <div className="storyboard-stats">
          <span><Clock size={14} /> {totalDuration}s</span>
          <span>{sceneCount} scenes</span>
        </div>
      </div>

      {/* Status Bar */}
      <div className="storyboard-status">
        {isApproved ? (
          <div className="status-approved-bar">
            <Check size={16} />
            <span>Storyboard v{storyboard.version} approved</span>
          </div>
        ) : (
          <div className="status-draft-bar">
            <span>Review and approve all scenes to continue</span>
          </div>
        )}
      </div>

      {/* Scene List */}
      <div className="scene-list">
        {storyboard.scenes.map((scene, index) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            index={index}
            expanded={expandedScene === scene.id}
            onToggle={() => setExpandedScene(
              expandedScene === scene.id ? null : scene.id
            )}
            onAction={onAction}
            locked={isApproved}
          />
        ))}
      </div>

      {/* Add Scene */}
      {!isApproved && (
        <button
          className="btn-add-scene"
          onClick={() => onAction('add_scene')}
        >
          <Plus size={16} />
          Add Scene
        </button>
      )}

      {/* Actions */}
      <div className="storyboard-actions">
        {!isApproved && (
          <button
            className="btn-primary"
            onClick={handleApproveAll}
            disabled={!allScenesApproved || !allKeyframesReady}
          >
            <Check size={16} />
            Approve Storyboard
          </button>
        )}
        {isApproved && (
          <button
            className="btn-primary"
            onClick={handleGenerateVideos}
          >
            <Play size={16} />
            Generate Video Clips
          </button>
        )}
      </div>
    </div>
  );
}

export default StoryboardWidget;

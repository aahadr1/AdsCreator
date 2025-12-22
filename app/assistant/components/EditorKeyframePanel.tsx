'use client';

import { useState, useCallback } from 'react';
import { Plus, Trash2, Copy } from 'lucide-react';
import type { TimelineClip, Keyframe, KeyframeProperty } from '../../../types/editor';
import { isMediaClip, isTextClip } from '../../../types/editor';
import { createKeyframe, KEYFRAME_PRESETS } from '../../../lib/keyframeEngine';

type EditorKeyframePanelProps = {
  selectedClips: TimelineClip[];
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
};

export default function EditorKeyframePanel({
  selectedClips,
  onUpdateClip,
}: EditorKeyframePanelProps) {
  const [selectedProperty, setSelectedProperty] = useState<KeyframeProperty>('opacity');
  const [showPresets, setShowPresets] = useState(false);

  const clip = selectedClips.length === 1 ? selectedClips[0] : null;
  const hasKeyframes = clip && (isMediaClip(clip) || isTextClip(clip));

  const properties: KeyframeProperty[] = [
    'x',
    'y',
    'scale',
    'scaleX',
    'scaleY',
    'rotation',
    'opacity',
  ];

  const handleAddKeyframe = useCallback(
    (time: number) => {
      if (!clip || (!isMediaClip(clip) && !isTextClip(clip))) return;

      const currentValue = clip.transform[selectedProperty as keyof typeof clip.transform] || 0;
      const newKeyframe = createKeyframe(time, selectedProperty, currentValue as number);

      onUpdateClip(clip.id, {
        keyframes: [...clip.keyframes, newKeyframe],
      } as Partial<TimelineClip>);
    },
    [clip, selectedProperty, onUpdateClip]
  );

  const handleRemoveKeyframe = useCallback(
    (keyframeId: string) => {
      if (!clip || (!isMediaClip(clip) && !isTextClip(clip))) return;

      onUpdateClip(clip.id, {
        keyframes: clip.keyframes.filter((kf) => kf.id !== keyframeId),
      } as Partial<TimelineClip>);
    },
    [clip, onUpdateClip]
  );

  const handleUpdateKeyframe = useCallback(
    (keyframeId: string, updates: Partial<Keyframe>) => {
      if (!clip || (!isMediaClip(clip) && !isTextClip(clip))) return;

      onUpdateClip(clip.id, {
        keyframes: clip.keyframes.map((kf) =>
          kf.id === keyframeId ? { ...kf, ...updates } : kf
        ),
      } as Partial<TimelineClip>);
    },
    [clip, onUpdateClip]
  );

  const handleApplyPreset = useCallback(
    (presetName: keyof typeof KEYFRAME_PRESETS) => {
      if (!clip || (!isMediaClip(clip) && !isTextClip(clip))) return;

      const presetKeyframes = KEYFRAME_PRESETS[presetName](1);

      onUpdateClip(clip.id, {
        keyframes: [...clip.keyframes, ...presetKeyframes],
      } as Partial<TimelineClip>);

      setShowPresets(false);
    },
    [clip, onUpdateClip]
  );

  if (!hasKeyframes) {
    return (
      <div className="assistant-editor-keyframe-panel">
        <div className="assistant-editor-keyframe-empty">
          <p>No clip selected</p>
          <p className="assistant-editor-keyframe-hint">
            Select a clip to animate its properties with keyframes
          </p>
        </div>
      </div>
    );
  }

  const clipKeyframes = (clip as any).keyframes || [];
  const propertyKeyframes = clipKeyframes.filter(
    (kf: Keyframe) => kf.property === selectedProperty
  );

  return (
    <div className="assistant-editor-keyframe-panel">
      <div className="assistant-editor-keyframe-header">
        <h3>Keyframes</h3>
        <button
          className="assistant-editor-keyframe-preset-btn"
          onClick={() => setShowPresets(!showPresets)}
          type="button"
        >
          Presets
        </button>
      </div>

      {/* Property Selector */}
      <div className="assistant-editor-keyframe-property-selector">
        {properties.map((prop) => (
          <button
            key={prop}
            className={`assistant-editor-keyframe-property-btn ${
              selectedProperty === prop ? 'active' : ''
            }`}
            onClick={() => setSelectedProperty(prop)}
            type="button"
          >
            {prop}
          </button>
        ))}
      </div>

      {/* Keyframe List */}
      <div className="assistant-editor-keyframe-list">
        <div className="assistant-editor-keyframe-list-header">
          <span>Time</span>
          <span>Value</span>
          <span>Easing</span>
          <span>Actions</span>
        </div>

        {propertyKeyframes.length === 0 ? (
          <div className="assistant-editor-keyframe-empty-list">
            <p>No keyframes for {selectedProperty}</p>
            <button
              className="assistant-editor-keyframe-add-btn"
              onClick={() => handleAddKeyframe(0)}
              type="button"
            >
              <Plus size={14} />
              Add Keyframe at 0s
            </button>
          </div>
        ) : (
          propertyKeyframes.map((kf: Keyframe) => (
            <div key={kf.id} className="assistant-editor-keyframe-item">
              <input
                type="number"
                step="0.01"
                value={kf.time.toFixed(2)}
                onChange={(e) =>
                  handleUpdateKeyframe(kf.id, { time: parseFloat(e.target.value) })
                }
                className="assistant-editor-keyframe-input"
              />

              <input
                type="number"
                step="0.1"
                value={kf.value.toFixed(2)}
                onChange={(e) =>
                  handleUpdateKeyframe(kf.id, { value: parseFloat(e.target.value) })
                }
                className="assistant-editor-keyframe-input"
              />

              <select
                value={kf.easing}
                onChange={(e) =>
                  handleUpdateKeyframe(kf.id, {
                    easing: e.target.value as Keyframe['easing'],
                  })
                }
                className="assistant-editor-keyframe-select"
              >
                <option value="linear">Linear</option>
                <option value="easeIn">Ease In</option>
                <option value="easeOut">Ease Out</option>
                <option value="easeInOut">Ease In/Out</option>
              </select>

              <div className="assistant-editor-keyframe-actions">
                <button
                  className="assistant-editor-keyframe-action-btn"
                  onClick={() => {
                    const newKf = createKeyframe(
                      kf.time + 0.5,
                      kf.property,
                      kf.value,
                      kf.easing
                    );
                    onUpdateClip(clip.id, {
                      keyframes: [...clipKeyframes, newKf],
                    } as Partial<TimelineClip>);
                  }}
                  title="Duplicate"
                  type="button"
                >
                  <Copy size={14} />
                </button>

                <button
                  className="assistant-editor-keyframe-action-btn delete"
                  onClick={() => handleRemoveKeyframe(kf.id)}
                  title="Delete"
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}

        <button
          className="assistant-editor-keyframe-add-btn"
          onClick={() => handleAddKeyframe(clip.endTime - clip.startTime)}
          type="button"
        >
          <Plus size={14} />
          Add Keyframe
        </button>
      </div>

      {/* Presets Menu */}
      {showPresets && (
        <>
          <div
            className="assistant-editor-keyframe-presets-overlay"
            onClick={() => setShowPresets(false)}
          />
          <div className="assistant-editor-keyframe-presets-menu">
            <h4>Animation Presets</h4>
            {Object.keys(KEYFRAME_PRESETS).map((presetName) => (
              <button
                key={presetName}
                className="assistant-editor-keyframe-preset-item"
                onClick={() => handleApplyPreset(presetName as keyof typeof KEYFRAME_PRESETS)}
                type="button"
              >
                {presetName.replace(/([A-Z])/g, ' $1').trim()}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


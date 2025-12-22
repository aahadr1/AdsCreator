'use client';

import { useCallback } from 'react';
import type { TimelineClip } from '../../../types/editor';
import { isMediaClip } from '../../../types/editor';

type EditorTransformControlsProps = {
  clip: TimelineClip;
  onUpdate: (updates: Partial<TimelineClip>) => void;
};

export default function EditorTransformControls({
  clip,
  onUpdate,
}: EditorTransformControlsProps) {
  const handleChange = useCallback(
    (property: string, value: number) => {
      if (!isMediaClip(clip)) return;
      const { transform } = clip;
      onUpdate({
        transform: {
          ...transform,
          [property]: value,
        },
      });
    },
    [clip, onUpdate]
  );

  const handleReset = useCallback(() => {
    onUpdate({
      transform: {
        x: 0,
        y: 0,
        scale: 1,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
        anchorX: 0.5,
        anchorY: 0.5,
      },
    });
  }, [onUpdate]);

  if (!isMediaClip(clip)) return null;

  const { transform } = clip;

  return (
    <div className="assistant-editor-transform-controls">
      <h4>Transform</h4>

      {/* Position */}
      <div className="assistant-editor-transform-property">
        <label>Position X</label>
        <div className="assistant-editor-transform-input-group">
          <input
            type="range"
            min="-1000"
            max="1000"
            value={transform.x}
            onChange={(e) => handleChange('x', parseInt(e.target.value))}
            className="assistant-editor-transform-slider"
          />
          <input
            type="number"
            value={Math.round(transform.x)}
            onChange={(e) => handleChange('x', parseFloat(e.target.value) || 0)}
            className="assistant-editor-transform-number"
          />
        </div>
      </div>

      <div className="assistant-editor-transform-property">
        <label>Position Y</label>
        <div className="assistant-editor-transform-input-group">
          <input
            type="range"
            min="-1000"
            max="1000"
            value={transform.y}
            onChange={(e) => handleChange('y', parseInt(e.target.value))}
            className="assistant-editor-transform-slider"
          />
          <input
            type="number"
            value={Math.round(transform.y)}
            onChange={(e) => handleChange('y', parseFloat(e.target.value) || 0)}
            className="assistant-editor-transform-number"
          />
        </div>
      </div>

      {/* Scale */}
      <div className="assistant-editor-transform-property">
        <label>Scale</label>
        <div className="assistant-editor-transform-input-group">
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.01"
            value={transform.scale}
            onChange={(e) => handleChange('scale', parseFloat(e.target.value))}
            className="assistant-editor-transform-slider"
          />
          <input
            type="number"
            value={transform.scale.toFixed(2)}
            onChange={(e) => handleChange('scale', parseFloat(e.target.value) || 0.1)}
            step="0.01"
            className="assistant-editor-transform-number"
          />
        </div>
      </div>

      <div className="assistant-editor-transform-property">
        <label>Scale X</label>
        <div className="assistant-editor-transform-input-group">
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.01"
            value={transform.scaleX}
            onChange={(e) => handleChange('scaleX', parseFloat(e.target.value))}
            className="assistant-editor-transform-slider"
          />
          <input
            type="number"
            value={transform.scaleX.toFixed(2)}
            onChange={(e) => handleChange('scaleX', parseFloat(e.target.value) || 0.1)}
            step="0.01"
            className="assistant-editor-transform-number"
          />
        </div>
      </div>

      <div className="assistant-editor-transform-property">
        <label>Scale Y</label>
        <div className="assistant-editor-transform-input-group">
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.01"
            value={transform.scaleY}
            onChange={(e) => handleChange('scaleY', parseFloat(e.target.value))}
            className="assistant-editor-transform-slider"
          />
          <input
            type="number"
            value={transform.scaleY.toFixed(2)}
            onChange={(e) => handleChange('scaleY', parseFloat(e.target.value) || 0.1)}
            step="0.01"
            className="assistant-editor-transform-number"
          />
        </div>
      </div>

      {/* Rotation */}
      <div className="assistant-editor-transform-property">
        <label>Rotation</label>
        <div className="assistant-editor-transform-input-group">
          <input
            type="range"
            min="-180"
            max="180"
            value={transform.rotation}
            onChange={(e) => handleChange('rotation', parseInt(e.target.value))}
            className="assistant-editor-transform-slider"
          />
          <input
            type="number"
            value={Math.round(transform.rotation)}
            onChange={(e) => handleChange('rotation', parseFloat(e.target.value) || 0)}
            className="assistant-editor-transform-number"
          />
        </div>
      </div>

      {/* Opacity */}
      <div className="assistant-editor-transform-property">
        <label>Opacity</label>
        <div className="assistant-editor-transform-input-group">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={transform.opacity}
            onChange={(e) => handleChange('opacity', parseFloat(e.target.value))}
            className="assistant-editor-transform-slider"
          />
          <input
            type="number"
            value={Math.round(transform.opacity * 100)}
            onChange={(e) => handleChange('opacity', (parseFloat(e.target.value) || 0) / 100)}
            className="assistant-editor-transform-number"
          />
        </div>
      </div>

      {/* Reset Button */}
      <button
        onClick={handleReset}
        className="assistant-editor-transform-reset-btn"
        type="button"
      >
        Reset Transform
      </button>
    </div>
  );
}


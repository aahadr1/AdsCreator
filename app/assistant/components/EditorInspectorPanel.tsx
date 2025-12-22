'use client';

import { useState } from 'react';
import type { TimelineClip, Transform, EditorAsset } from '../../../types/editor';
import { isMediaClip, isTextClip, DEFAULT_TRANSFORM } from '../../../types/editor';

type EditorInspectorPanelProps = {
  selectedClips: TimelineClip[];
  assets: EditorAsset[];
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
};

export default function EditorInspectorPanel({
  selectedClips,
  assets,
  onUpdateClip,
}: EditorInspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<'transform' | 'effects' | 'audio'>('transform');

  if (selectedClips.length === 0) {
    return (
      <div className="assistant-editor-inspector-panel">
        <div className="assistant-editor-inspector-empty">
          <p>No clip selected</p>
          <p className="assistant-editor-inspector-hint">
            Select a clip from the timeline to view and edit its properties
          </p>
        </div>
      </div>
    );
  }

  const clip = selectedClips[0]; // For now, only edit single selection

  const handleTransformUpdate = (property: keyof Transform, value: number) => {
    if (!isMediaClip(clip) && !isTextClip(clip)) return;

    onUpdateClip(clip.id, {
      transform: {
        ...clip.transform,
        [property]: value,
      },
    } as Partial<TimelineClip>);
  };

  const handleDurationUpdate = (value: number) => {
    const duration = Math.max(0.1, value);
    onUpdateClip(clip.id, {
      endTime: clip.startTime + duration,
    });
  };

  const duration = clip.endTime - clip.startTime;

  return (
    <div className="assistant-editor-inspector-panel">
      <div className="assistant-editor-inspector-header">
        <h3>Inspector</h3>
        <span className="assistant-editor-inspector-clip-type">
          {clip.type.toUpperCase()}
        </span>
      </div>

      <div className="assistant-editor-inspector-tabs">
        <button
          className={`assistant-editor-inspector-tab ${
            activeTab === 'transform' ? 'active' : ''
          }`}
          onClick={() => setActiveTab('transform')}
          type="button"
        >
          Transform
        </button>
        <button
          className={`assistant-editor-inspector-tab ${
            activeTab === 'effects' ? 'active' : ''
          }`}
          onClick={() => setActiveTab('effects')}
          type="button"
        >
          Effects
        </button>
        {(isMediaClip(clip) && clip.type !== 'image') && (
          <button
            className={`assistant-editor-inspector-tab ${
              activeTab === 'audio' ? 'active' : ''
            }`}
            onClick={() => setActiveTab('audio')}
            type="button"
          >
            Audio
          </button>
        )}
      </div>

      <div className="assistant-editor-inspector-content">
        {/* Basic Properties */}
        <div className="assistant-editor-inspector-section">
          <h4>Basic</h4>

          <div className="assistant-editor-inspector-property">
            <label>Start Time</label>
            <input
              type="number"
              step="0.01"
              value={clip.startTime.toFixed(2)}
              onChange={(e) =>
                onUpdateClip(clip.id, { startTime: parseFloat(e.target.value) })
              }
              className="assistant-editor-inspector-input"
            />
          </div>

          <div className="assistant-editor-inspector-property">
            <label>Duration</label>
            <input
              type="number"
              step="0.01"
              value={duration.toFixed(2)}
              onChange={(e) => handleDurationUpdate(parseFloat(e.target.value))}
              className="assistant-editor-inspector-input"
            />
          </div>

          {clip.name !== undefined && (
            <div className="assistant-editor-inspector-property">
              <label>Name</label>
              <input
                type="text"
                value={clip.name || ''}
                onChange={(e) => onUpdateClip(clip.id, { name: e.target.value })}
                className="assistant-editor-inspector-input"
                placeholder="Clip name"
              />
            </div>
          )}
        </div>

        {/* Transform Properties */}
        {activeTab === 'transform' && (isMediaClip(clip) || isTextClip(clip)) && (
          <div className="assistant-editor-inspector-section">
            <h4>Transform</h4>

            <div className="assistant-editor-inspector-property">
              <label>Position X</label>
              <input
                type="number"
                step="1"
                value={Math.round(clip.transform.x)}
                onChange={(e) => handleTransformUpdate('x', parseFloat(e.target.value))}
                className="assistant-editor-inspector-input"
              />
            </div>

            <div className="assistant-editor-inspector-property">
              <label>Position Y</label>
              <input
                type="number"
                step="1"
                value={Math.round(clip.transform.y)}
                onChange={(e) => handleTransformUpdate('y', parseFloat(e.target.value))}
                className="assistant-editor-inspector-input"
              />
            </div>

            <div className="assistant-editor-inspector-property">
              <label>Scale</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={clip.transform.scale.toFixed(2)}
                onChange={(e) => handleTransformUpdate('scale', parseFloat(e.target.value))}
                className="assistant-editor-inspector-input"
              />
            </div>

            <div className="assistant-editor-inspector-property">
              <label>Rotation (deg)</label>
              <input
                type="number"
                step="1"
                value={Math.round(clip.transform.rotation)}
                onChange={(e) =>
                  handleTransformUpdate('rotation', parseFloat(e.target.value))
                }
                className="assistant-editor-inspector-input"
              />
            </div>

            <div className="assistant-editor-inspector-property">
              <label>Opacity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={clip.transform.opacity}
                onChange={(e) => handleTransformUpdate('opacity', parseFloat(e.target.value))}
                className="assistant-editor-inspector-slider"
              />
              <span>{(clip.transform.opacity * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}

        {/* Effects Properties */}
        {activeTab === 'effects' && isMediaClip(clip) && (
          <div className="assistant-editor-inspector-section">
            <h4>Filters</h4>
            {clip.filters.length === 0 ? (
              <p className="assistant-editor-inspector-hint">No filters applied</p>
            ) : (
              clip.filters.map((filter) => (
                <div key={filter.id} className="assistant-editor-inspector-filter">
                  <div className="assistant-editor-inspector-filter-header">
                    <span>{filter.type}</span>
                    <input
                      type="checkbox"
                      checked={filter.enabled}
                      onChange={(e) => {
                        const updatedFilters = clip.filters.map((f) =>
                          f.id === filter.id ? { ...f, enabled: e.target.checked } : f
                        );
                        onUpdateClip(clip.id, { filters: updatedFilters } as Partial<
                          TimelineClip
                        >);
                      }}
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filter.value}
                    onChange={(e) => {
                      const updatedFilters = clip.filters.map((f) =>
                        f.id === filter.id
                          ? { ...f, value: parseFloat(e.target.value) }
                          : f
                      );
                      onUpdateClip(clip.id, { filters: updatedFilters } as Partial<
                        TimelineClip
                      >);
                    }}
                    className="assistant-editor-inspector-slider"
                  />
                </div>
              ))
            )}
          </div>
        )}

        {/* Audio Properties */}
        {activeTab === 'audio' && isMediaClip(clip) && clip.type !== 'image' && (
          <div className="assistant-editor-inspector-section">
            <h4>Audio</h4>

            <div className="assistant-editor-inspector-property">
              <label>Volume</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={clip.volume || 1}
                onChange={(e) =>
                  onUpdateClip(clip.id, { volume: parseFloat(e.target.value) } as Partial<
                    TimelineClip
                  >)
                }
                className="assistant-editor-inspector-slider"
              />
              <span>{((clip.volume || 1) * 100).toFixed(0)}%</span>
            </div>

            <div className="assistant-editor-inspector-property">
              <label>Speed</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="4"
                value={clip.speed || 1}
                onChange={(e) =>
                  onUpdateClip(clip.id, { speed: parseFloat(e.target.value) } as Partial<
                    TimelineClip
                  >)
                }
                className="assistant-editor-inspector-input"
              />
            </div>
          </div>
        )}

        {/* Text Properties */}
        {isTextClip(clip) && (
          <div className="assistant-editor-inspector-section">
            <h4>Text</h4>

            <div className="assistant-editor-inspector-property">
              <label>Font Size</label>
              <input
                type="number"
                step="1"
                min="8"
                value={clip.fontSize}
                onChange={(e) =>
                  onUpdateClip(clip.id, { fontSize: parseInt(e.target.value, 10) })
                }
                className="assistant-editor-inspector-input"
              />
            </div>

            <div className="assistant-editor-inspector-property">
              <label>Color</label>
              <input
                type="color"
                value={clip.color}
                onChange={(e) => onUpdateClip(clip.id, { color: e.target.value })}
                className="assistant-editor-inspector-color"
              />
            </div>

            <div className="assistant-editor-inspector-property">
              <label>Align</label>
              <select
                value={clip.textAlign}
                onChange={(e) =>
                  onUpdateClip(clip.id, {
                    textAlign: e.target.value as 'left' | 'center' | 'right' | 'justify',
                  })
                }
                className="assistant-editor-inspector-select"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
                <option value="justify">Justify</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


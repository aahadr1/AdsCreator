'use client';

import { useState, useCallback } from 'react';
import { Plus, Type } from 'lucide-react';
import type { TextClip, Track } from '../../../types/editor';
import { DEFAULT_TRANSFORM, WEB_SAFE_FONTS } from '../../../types/editor';

type EditorTextPanelProps = {
  tracks: Track[];
  playhead: number;
  onAddTextClip: (clip: Omit<TextClip, 'id'>) => void;
  onClose: () => void;
};

export default function EditorTextPanel({
  tracks,
  playhead,
  onAddTextClip,
  onClose,
}: EditorTextPanelProps) {
  const [text, setText] = useState('Your Text Here');
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState('#ffffff');
  const [backgroundColor, setBackgroundColor] = useState('');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>('center');
  const [fontWeight, setFontWeight] = useState<TextClip['fontWeight']>('normal');

  const textTracks = tracks.filter((t) => t.type === 'text');
  const selectedTrack = textTracks[0] || tracks[0];

  const handleAddText = useCallback(() => {
    const textClip: Omit<TextClip, 'id'> = {
      type: 'text',
      trackId: selectedTrack.id,
      startTime: playhead,
      endTime: playhead + 5, // 5 seconds default
      locked: false,
      text,
      fontFamily,
      fontSize,
      fontWeight,
      fontStyle: 'normal',
      color,
      backgroundColor: backgroundColor || undefined,
      textAlign,
      lineHeight: 1.2,
      letterSpacing: 0,
      transform: { ...DEFAULT_TRANSFORM },
      keyframes: [],
      blendMode: 'normal',
    };

    onAddTextClip(textClip);
    onClose();
  }, [
    selectedTrack,
    playhead,
    text,
    fontFamily,
    fontSize,
    fontWeight,
    color,
    backgroundColor,
    textAlign,
    onAddTextClip,
    onClose,
  ]);

  return (
    <div className="assistant-editor-text-panel">
      <div className="assistant-editor-text-panel-header">
        <h3>
          <Type size={18} />
          Add Text
        </h3>
      </div>

      <div className="assistant-editor-text-panel-content">
        {/* Text Input */}
        <div className="assistant-editor-text-panel-section">
          <label>Text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="assistant-editor-text-panel-textarea"
            rows={3}
            placeholder="Enter your text..."
          />
        </div>

        {/* Font Family */}
        <div className="assistant-editor-text-panel-section">
          <label>Font</label>
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="assistant-editor-text-panel-select"
          >
            {WEB_SAFE_FONTS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </div>

        {/* Font Size */}
        <div className="assistant-editor-text-panel-section">
          <label>Size</label>
          <div className="assistant-editor-text-panel-input-group">
            <input
              type="range"
              min="12"
              max="200"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
              className="assistant-editor-text-panel-slider"
            />
            <input
              type="number"
              min="12"
              max="200"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
              className="assistant-editor-text-panel-number"
            />
          </div>
        </div>

        {/* Font Weight */}
        <div className="assistant-editor-text-panel-section">
          <label>Weight</label>
          <select
            value={fontWeight}
            onChange={(e) => setFontWeight(e.target.value as TextClip['fontWeight'])}
            className="assistant-editor-text-panel-select"
          >
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
            <option value="300">Light</option>
            <option value="600">Semi Bold</option>
            <option value="800">Extra Bold</option>
          </select>
        </div>

        {/* Text Color */}
        <div className="assistant-editor-text-panel-section">
          <label>Text Color</label>
          <div className="assistant-editor-text-panel-color-input">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="assistant-editor-text-panel-color-picker"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="assistant-editor-text-panel-text"
              placeholder="#ffffff"
            />
          </div>
        </div>

        {/* Background Color */}
        <div className="assistant-editor-text-panel-section">
          <label>Background Color (Optional)</label>
          <div className="assistant-editor-text-panel-color-input">
            <input
              type="color"
              value={backgroundColor || '#000000'}
              onChange={(e) => setBackgroundColor(e.target.value)}
              className="assistant-editor-text-panel-color-picker"
            />
            <input
              type="text"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              className="assistant-editor-text-panel-text"
              placeholder="transparent"
            />
          </div>
        </div>

        {/* Text Align */}
        <div className="assistant-editor-text-panel-section">
          <label>Alignment</label>
          <div className="assistant-editor-text-panel-align-buttons">
            {(['left', 'center', 'right', 'justify'] as const).map((align) => (
              <button
                key={align}
                className={`assistant-editor-text-panel-align-btn ${
                  textAlign === align ? 'active' : ''
                }`}
                onClick={() => setTextAlign(align)}
                type="button"
              >
                {align[0].toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="assistant-editor-text-panel-preview">
          <div
            style={{
              fontFamily,
              fontSize: `${fontSize / 3}px`,
              color,
              backgroundColor: backgroundColor || 'transparent',
              textAlign,
              fontWeight,
              padding: '10px',
            }}
          >
            {text}
          </div>
        </div>
      </div>

      <div className="assistant-editor-text-panel-actions">
        <button
          className="assistant-editor-text-panel-button secondary"
          onClick={onClose}
          type="button"
        >
          Cancel
        </button>
        <button
          className="assistant-editor-text-panel-button primary"
          onClick={handleAddText}
          type="button"
        >
          <Plus size={16} />
          Add Text
        </button>
      </div>
    </div>
  );
}


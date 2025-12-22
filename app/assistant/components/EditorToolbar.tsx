'use client';

import { MousePointer2, Scissors, Move, Type, Undo2, Redo2 } from 'lucide-react';
import type { EditorTool } from '../../../types/editor';

type EditorToolbarProps = {
  activeTool: EditorTool;
  onSelectTool: (tool: EditorTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

export default function EditorToolbar({
  activeTool,
  onSelectTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: EditorToolbarProps) {
  const tools: Array<{ id: EditorTool; icon: React.ReactNode; label: string; shortcut?: string }> = [
    { id: 'select', icon: <MousePointer2 size={18} />, label: 'Select', shortcut: 'V' },
    { id: 'razor', icon: <Scissors size={18} />, label: 'Razor', shortcut: 'C' },
    { id: 'slip', icon: <Move size={18} />, label: 'Slip', shortcut: 'Y' },
    { id: 'text', icon: <Type size={18} />, label: 'Text', shortcut: 'T' },
  ];

  return (
    <div className="assistant-editor-toolbar">
      <div className="assistant-editor-toolbar-section">
        <button
          className="assistant-editor-toolbar-button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Cmd+Z)"
          type="button"
        >
          <Undo2 size={18} />
        </button>

        <button
          className="assistant-editor-toolbar-button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Cmd+Shift+Z)"
          type="button"
        >
          <Redo2 size={18} />
        </button>
      </div>

      <div className="assistant-editor-toolbar-divider" />

      <div className="assistant-editor-toolbar-section">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`assistant-editor-toolbar-button ${
              activeTool === tool.id ? 'active' : ''
            }`}
            onClick={() => onSelectTool(tool.id)}
            title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
            type="button"
          >
            {tool.icon}
          </button>
        ))}
      </div>
    </div>
  );
}


'use client';

import { X } from 'lucide-react';

type EditorShortcutsPanelProps = {
  onClose: () => void;
};

export default function EditorShortcutsPanel({ onClose }: EditorShortcutsPanelProps) {
  const shortcuts = [
    { category: 'Playback', items: [
      { keys: ['Space'], description: 'Play / Pause' },
      { keys: ['J'], description: 'Play Reverse' },
      { keys: ['K'], description: 'Pause' },
      { keys: ['L'], description: 'Play Forward' },
      { keys: ['←'], description: 'Previous Frame' },
      { keys: ['→'], description: 'Next Frame' },
      { keys: ['↑'], description: 'Jump Forward 10s' },
      { keys: ['↓'], description: 'Jump Backward 10s' },
    ]},
    { category: 'Editing', items: [
      { keys: ['Cmd/Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Cmd/Ctrl', 'Shift', 'Z'], description: 'Redo' },
      { keys: ['Cmd/Ctrl', 'C'], description: 'Copy Selected Clips' },
      { keys: ['Cmd/Ctrl', 'V'], description: 'Paste Clips' },
      { keys: ['Cmd/Ctrl', 'X'], description: 'Cut Selected Clips' },
      { keys: ['Delete'], description: 'Delete Selected Clips' },
      { keys: ['Backspace'], description: 'Delete Selected Clips' },
      { keys: ['S'], description: 'Split Clip at Playhead' },
      { keys: ['D'], description: 'Duplicate Selected Clip' },
    ]},
    { category: 'Tools', items: [
      { keys: ['V'], description: 'Select Tool' },
      { keys: ['C'], description: 'Razor Tool' },
      { keys: ['Y'], description: 'Slip Tool' },
      { keys: ['T'], description: 'Text Tool' },
    ]},
    { category: 'View', items: [
      { keys: ['Cmd/Ctrl', '+'], description: 'Zoom In Timeline' },
      { keys: ['Cmd/Ctrl', '-'], description: 'Zoom Out Timeline' },
      { keys: ['Cmd/Ctrl', '0'], description: 'Reset Zoom' },
      { keys: ['?'], description: 'Show Shortcuts' },
    ]},
    { category: 'Panels', items: [
      { keys: ['Cmd/Ctrl', '1'], description: 'Toggle Assets Panel' },
      { keys: ['Cmd/Ctrl', '2'], description: 'Toggle Inspector Panel' },
      { keys: ['Cmd/Ctrl', '3'], description: 'Toggle Keyframes Panel' },
      { keys: ['Cmd/Ctrl', '4'], description: 'Toggle Effects Panel' },
    ]},
  ];

  return (
    <div className="assistant-editor-shortcuts-overlay" onClick={onClose}>
      <div
        className="assistant-editor-shortcuts-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="assistant-editor-shortcuts-header">
          <h2>Keyboard Shortcuts</h2>
          <button
            className="assistant-editor-shortcuts-close"
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <div className="assistant-editor-shortcuts-content">
          {shortcuts.map((section) => (
            <div key={section.category} className="assistant-editor-shortcuts-section">
              <h3>{section.category}</h3>
              <div className="assistant-editor-shortcuts-list">
                {section.items.map((shortcut, idx) => (
                  <div key={idx} className="assistant-editor-shortcut-item">
                    <div className="assistant-editor-shortcut-keys">
                      {shortcut.keys.map((key, keyIdx) => (
                        <kbd key={keyIdx} className="assistant-editor-shortcut-key">
                          {key}
                        </kbd>
                      ))}
                    </div>
                    <div className="assistant-editor-shortcut-description">
                      {shortcut.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


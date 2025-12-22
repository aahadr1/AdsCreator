'use client';

import { useState } from 'react';
import { Plus, Folder, Edit, Trash2 } from 'lucide-react';
import type { EditorSequence } from '../../../types/editor';
import { DEFAULT_FPS, DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from '../../../types/editor';

type EditorSequenceManagerProps = {
  sequences: Record<string, EditorSequence>;
  currentSequenceId: string;
  onSelectSequence: (sequenceId: string) => void;
  onCreateSequence: (sequence: EditorSequence) => void;
  onDeleteSequence: (sequenceId: string) => void;
  onRenameSequence: (sequenceId: string, newName: string) => void;
};

export default function EditorSequenceManager({
  sequences,
  currentSequenceId,
  onSelectSequence,
  onCreateSequence,
  onDeleteSequence,
  onRenameSequence,
}: EditorSequenceManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newSequenceName, setNewSequenceName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleCreateSequence = () => {
    if (!newSequenceName.trim()) return;

    const newSequence: EditorSequence = {
      id: `sequence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newSequenceName,
      tracks: [
        {
          id: `track-${Date.now()}-video`,
          type: 'video',
          name: 'Video 1',
          index: 0,
          height: 60,
          locked: false,
          muted: false,
          visible: true,
        },
        {
          id: `track-${Date.now()}-audio`,
          type: 'audio',
          name: 'Audio 1',
          index: 1,
          height: 60,
          locked: false,
          muted: false,
          visible: true,
        },
      ],
      clips: [],
      markers: [],
      regions: [],
      duration: 60,
      fps: DEFAULT_FPS,
      width: DEFAULT_CANVAS_WIDTH,
      height: DEFAULT_CANVAS_HEIGHT,
    };

    onCreateSequence(newSequence);
    setNewSequenceName('');
    setIsCreating(false);
  };

  const handleStartEdit = (sequenceId: string, currentName: string) => {
    setEditingId(sequenceId);
    setEditingName(currentName);
  };

  const handleFinishEdit = () => {
    if (editingId && editingName.trim()) {
      onRenameSequence(editingId, editingName);
    }
    setEditingId(null);
    setEditingName('');
  };

  const sequenceList = Object.values(sequences);

  return (
    <div className="assistant-editor-sequence-manager">
      <div className="assistant-editor-sequence-manager-header">
        <h3>
          <Folder size={16} />
          Sequences
        </h3>
        <button
          className="assistant-editor-sequence-manager-add-btn"
          onClick={() => setIsCreating(true)}
          title="Create New Sequence"
          type="button"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="assistant-editor-sequence-manager-list">
        {sequenceList.map((sequence) => (
          <div
            key={sequence.id}
            className={`assistant-editor-sequence-manager-item ${
              sequence.id === currentSequenceId ? 'active' : ''
            }`}
          >
            {editingId === sequence.id ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={handleFinishEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFinishEdit();
                  if (e.key === 'Escape') {
                    setEditingId(null);
                    setEditingName('');
                  }
                }}
                className="assistant-editor-sequence-manager-input"
                autoFocus
              />
            ) : (
              <>
                <button
                  className="assistant-editor-sequence-manager-name"
                  onClick={() => onSelectSequence(sequence.id)}
                  type="button"
                >
                  {sequence.name}
                  <span className="assistant-editor-sequence-manager-info">
                    {sequence.clips.length} clips • {sequence.duration.toFixed(0)}s
                  </span>
                </button>

                <div className="assistant-editor-sequence-manager-actions">
                  <button
                    className="assistant-editor-sequence-manager-action-btn"
                    onClick={() => handleStartEdit(sequence.id, sequence.name)}
                    title="Rename"
                    type="button"
                  >
                    <Edit size={14} />
                  </button>

                  {sequenceList.length > 1 && (
                    <button
                      className="assistant-editor-sequence-manager-action-btn delete"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Are you sure you want to delete "${sequence.name}"?`
                          )
                        ) {
                          onDeleteSequence(sequence.id);
                        }
                      }}
                      title="Delete"
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}

        {isCreating && (
          <div className="assistant-editor-sequence-manager-item creating">
            <input
              type="text"
              value={newSequenceName}
              onChange={(e) => setNewSequenceName(e.target.value)}
              onBlur={() => {
                if (newSequenceName.trim()) {
                  handleCreateSequence();
                } else {
                  setIsCreating(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newSequenceName.trim()) {
                  handleCreateSequence();
                }
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewSequenceName('');
                }
              }}
              className="assistant-editor-sequence-manager-input"
              placeholder="Sequence name..."
              autoFocus
            />
          </div>
        )}
      </div>
    </div>
  );
}


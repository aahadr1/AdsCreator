import type { EditorState, HistoryAction } from '@/types/editor';

/**
 * Editor History System
 * Implements command pattern for undo/redo functionality
 */

type StateSnapshot = Partial<EditorState>;

export class EditorHistory {
  private maxHistorySize = 50;

  /**
   * Create a new history action
   */
  createAction(
    type: string,
    description: string,
    previousState: StateSnapshot,
    newState: StateSnapshot,
    onUndo?: () => void,
    onRedo?: () => void
  ): HistoryAction {
    return {
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: Date.now(),
      description,
      undo: () => {
        if (onUndo) onUndo();
      },
      redo: () => {
        if (onRedo) onRedo();
      },
    };
  }

  /**
   * Add action to history
   */
  addToHistory(
    state: EditorState,
    action: HistoryAction
  ): EditorState {
    const newHistory = [
      ...state.history.slice(0, state.historyIndex + 1),
      action,
    ].slice(-this.maxHistorySize);

    return {
      ...state,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    };
  }

  /**
   * Undo last action
   */
  undo(state: EditorState): EditorState {
    if (state.historyIndex < 0) return state;

    const action = state.history[state.historyIndex];
    action.undo();

    return {
      ...state,
      historyIndex: state.historyIndex - 1,
    };
  }

  /**
   * Redo last undone action
   */
  redo(state: EditorState): EditorState {
    if (state.historyIndex >= state.history.length - 1) return state;

    const nextIndex = state.historyIndex + 1;
    const action = state.history[nextIndex];
    action.redo();

    return {
      ...state,
      historyIndex: nextIndex,
    };
  }

  /**
   * Check if undo is available
   */
  canUndo(state: EditorState): boolean {
    return state.historyIndex >= 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(state: EditorState): boolean {
    return state.historyIndex < state.history.length - 1;
  }

  /**
   * Clear history
   */
  clearHistory(state: EditorState): EditorState {
    return {
      ...state,
      history: [],
      historyIndex: -1,
    };
  }

  /**
   * Get history stack for display
   */
  getHistoryStack(state: EditorState): Array<{
    action: HistoryAction;
    isCurrent: boolean;
    canUndo: boolean;
    canRedo: boolean;
  }> {
    return state.history.map((action, index) => ({
      action,
      isCurrent: index === state.historyIndex,
      canUndo: index <= state.historyIndex,
      canRedo: index > state.historyIndex,
    }));
  }
}

// Export singleton instance
export const editorHistory = new EditorHistory();

// Helper functions for common operations

export function createClipAddAction(
  clipId: string,
  trackId: string,
  addClipFn: () => void,
  removeClipFn: () => void
): HistoryAction {
  return editorHistory.createAction(
    'ADD_CLIP',
    `Add clip to track`,
    {},
    {},
    removeClipFn,
    addClipFn
  );
}

export function createClipDeleteAction(
  clipId: string,
  restoreClipFn: () => void,
  deleteClipFn: () => void
): HistoryAction {
  return editorHistory.createAction(
    'DELETE_CLIP',
    `Delete clip`,
    {},
    {},
    restoreClipFn,
    deleteClipFn
  );
}

export function createClipMoveAction(
  clipId: string,
  previousPosition: { startTime: number; endTime: number; trackId: string },
  newPosition: { startTime: number; endTime: number; trackId: string },
  moveToPreviousFn: () => void,
  moveToNewFn: () => void
): HistoryAction {
  return editorHistory.createAction(
    'MOVE_CLIP',
    `Move clip`,
    {},
    {},
    moveToPreviousFn,
    moveToNewFn
  );
}

export function createClipTrimAction(
  clipId: string,
  previousTrim: { trimStart: number; trimEnd: number; startTime: number; endTime: number },
  newTrim: { trimStart: number; trimEnd: number; startTime: number; endTime: number },
  applyPreviousTrimFn: () => void,
  applyNewTrimFn: () => void
): HistoryAction {
  return editorHistory.createAction(
    'TRIM_CLIP',
    `Trim clip`,
    {},
    {},
    applyPreviousTrimFn,
    applyNewTrimFn
  );
}

export function createTrackAddAction(
  trackId: string,
  addTrackFn: () => void,
  removeTrackFn: () => void
): HistoryAction {
  return editorHistory.createAction(
    'ADD_TRACK',
    `Add track`,
    {},
    {},
    removeTrackFn,
    addTrackFn
  );
}

export function createTrackDeleteAction(
  trackId: string,
  restoreTrackFn: () => void,
  deleteTrackFn: () => void
): HistoryAction {
  return editorHistory.createAction(
    'DELETE_TRACK',
    `Delete track`,
    {},
    {},
    restoreTrackFn,
    deleteTrackFn
  );
}

export function createKeyframeAddAction(
  clipId: string,
  keyframeId: string,
  addKeyframeFn: () => void,
  removeKeyframeFn: () => void
): HistoryAction {
  return editorHistory.createAction(
    'ADD_KEYFRAME',
    `Add keyframe`,
    {},
    {},
    removeKeyframeFn,
    addKeyframeFn
  );
}

export function createKeyframeUpdateAction(
  clipId: string,
  keyframeId: string,
  previousValue: number,
  newValue: number,
  applyPreviousFn: () => void,
  applyNewFn: () => void
): HistoryAction {
  return editorHistory.createAction(
    'UPDATE_KEYFRAME',
    `Update keyframe`,
    {},
    {},
    applyPreviousFn,
    applyNewFn
  );
}


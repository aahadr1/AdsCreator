/**
 * Types for storyboard selection and modification system
 */

export type SelectionType = 'scene' | 'frame' | 'script';

export interface FrameSelection {
  sceneNumber: number;
  framePosition: 'first' | 'last';
}

export interface SceneSelection {
  sceneNumber: number;
}

export interface ScriptSelection {
  sceneNumber: number;
}

export interface StoryboardSelection {
  type: SelectionType;
  items: Array<SceneSelection | FrameSelection | ScriptSelection>;
}

export interface ModificationRequest {
  storyboard_id: string;
  selection: StoryboardSelection;
  modification_text: string;
  conversation_id?: string;
}

export interface ModificationResponse {
  success: boolean;
  updated_scenes?: number[];
  updated_frames?: Array<{ sceneNumber: number; framePosition: 'first' | 'last' }>;
  message?: string;
  error?: string;
}

/**
 * Helper to describe selection in natural language
 */
export function describeSelection(selection: StoryboardSelection): string {
  const { type, items } = selection;
  
  if (items.length === 0) return 'nothing selected';
  
  if (type === 'scene') {
    const sceneNumbers = items.map((item) => (item as SceneSelection).sceneNumber);
    if (sceneNumbers.length === 1) {
      return `Scene ${sceneNumbers[0]}`;
    }
    return `${sceneNumbers.length} scenes (${sceneNumbers.join(', ')})`;
  }
  
  if (type === 'frame') {
    if (items.length === 1) {
      const frame = items[0] as FrameSelection;
      return `Scene ${frame.sceneNumber} ${frame.framePosition} frame`;
    }
    return `${items.length} frames`;
  }
  
  if (type === 'script') {
    const sceneNumbers = items.map((item) => (item as ScriptSelection).sceneNumber);
    if (sceneNumbers.length === 1) {
      return `Scene ${sceneNumbers[0]} script`;
    }
    return `${sceneNumbers.length} scripts (scenes ${sceneNumbers.join(', ')})`;
  }
  
  return 'selection';
}

/**
 * Helper to check if an item is selected
 */
export function isItemSelected(
  selection: StoryboardSelection | null,
  type: SelectionType,
  sceneNumber: number,
  framePosition?: 'first' | 'last'
): boolean {
  if (!selection || selection.type !== type) return false;
  
  if (type === 'scene') {
    return selection.items.some((item) => (item as SceneSelection).sceneNumber === sceneNumber);
  }
  
  if (type === 'frame' && framePosition) {
    return selection.items.some(
      (item) =>
        (item as FrameSelection).sceneNumber === sceneNumber &&
        (item as FrameSelection).framePosition === framePosition
    );
  }
  
  if (type === 'script') {
    return selection.items.some((item) => (item as ScriptSelection).sceneNumber === sceneNumber);
  }
  
  return false;
}

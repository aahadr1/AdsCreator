'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabaseClient as supabase } from '@/lib/supabaseClient';
import type { Storyboard, StoryboardScene } from '@/types/assistant';
import type { StoryboardSelection, SelectionType, SceneSelection, FrameSelection, ScriptSelection } from '@/types/storyboardSelection';
import { isItemSelected } from '@/types/storyboardSelection';
import styles from '../storyboard.module.css';
import {
  ArrowLeft,
  Clock,
  Film,
  Loader2,
  Plus,
  Save,
  Trash2,
  Edit3,
  Play,
  Download,
  Check,
  HelpCircle,
  MousePointerClick,
} from 'lucide-react';
import { StoryboardVersionHistory } from '@/components/StoryboardVersionHistory';
import { StoryboardModificationBar } from '@/components/StoryboardModificationBar';
import { ElementVersionViewer } from '@/components/ElementVersionViewer';
import type { ElementType } from '@/components/ElementVersionViewer';

export default function StoryboardPage() {
  const params = useParams();
  const router = useRouter();
  const storyboardId = params.id as string;

  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [draggedSceneIndex, setDraggedSceneIndex] = useState<number | null>(null);
  const [activeSceneIndex, setActiveSceneIndex] = useState<number>(0);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  
  // Selection state for modification system
  const [selection, setSelection] = useState<StoryboardSelection | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionType>('scene');
  
  // Version viewer state
  const [versionViewerOpen, setVersionViewerOpen] = useState(false);
  const [versionViewerElement, setVersionViewerElement] = useState<{
    type: 'frame' | 'script' | 'scene';
    sceneNumber: number;
    framePosition?: 'first' | 'last';
    currentValue: any;
  } | null>(null);
  
  // Track recently changed elements for visual feedback
  const [recentlyChanged, setRecentlyChanged] = useState<Set<string>>(new Set());

  // Auto-save debounce
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        setAuthToken(session.access_token);
      } else {
        router.push('/auth');
      }
    };
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthToken(session?.access_token || null);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!authToken || !storyboardId) return;

    const loadStoryboard = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/storyboard?id=${storyboardId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          setStoryboard(data.storyboard);
        } else {
          console.error('Failed to load storyboard');
          router.push('/assistant');
        }
      } catch (error) {
        console.error('Error loading storyboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoryboard();
  }, [authToken, storyboardId, router]);

  const saveStoryboard = useCallback(async (updatedStoryboard: Storyboard) => {
    if (!authToken) return;

    setSaveStatus('saving');
    try {
      const res = await fetch('/api/storyboard', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          id: updatedStoryboard.id,
          title: updatedStoryboard.title,
          scenes: updatedStoryboard.scenes,
          aspect_ratio: updatedStoryboard.aspect_ratio,
          total_duration_seconds: updatedStoryboard.total_duration_seconds,
          status: updatedStoryboard.status,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setStoryboard(data.storyboard);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        console.error('Failed to save storyboard');
        setSaveStatus('idle');
      }
    } catch (error) {
      console.error('Error saving storyboard:', error);
      setSaveStatus('idle');
    }
  }, [authToken]);

  const debouncedSave = useCallback((updatedStoryboard: Storyboard) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveStoryboard(updatedStoryboard);
    }, 1000);
  }, [saveStoryboard]);

  const updateStoryboard = useCallback((updater: (prev: Storyboard) => Storyboard) => {
    setStoryboard((prev) => {
      if (!prev) return prev;
      const updated = updater(prev);
      debouncedSave(updated);
      return updated;
    });
  }, [debouncedSave]);

  const updateScene = useCallback((sceneIndex: number, updater: (scene: StoryboardScene) => StoryboardScene) => {
    updateStoryboard((prev) => ({
      ...prev,
      scenes: prev.scenes.map((scene, idx) =>
        idx === sceneIndex ? updater(scene) : scene
      ),
    }));
  }, [updateStoryboard]);

  const addScene = useCallback(() => {
    updateStoryboard((prev) => {
      const newSceneNumber = prev.scenes.length + 1;
      const newScene: StoryboardScene = {
        scene_number: newSceneNumber,
        scene_name: `Scene ${newSceneNumber}`,
        description: '',
        duration_seconds: 3,
        first_frame_prompt: '',
        first_frame_visual_elements: [],
        last_frame_prompt: '',
        last_frame_visual_elements: [],
        video_generation_prompt: '',
      };
      return {
        ...prev,
        scenes: [...prev.scenes, newScene],
      };
    });
  }, [updateStoryboard]);

  const deleteScene = useCallback((sceneIndex: number) => {
    updateStoryboard((prev) => ({
      ...prev,
      scenes: prev.scenes
        .filter((_, idx) => idx !== sceneIndex)
        .map((scene, idx) => ({ ...scene, scene_number: idx + 1 })),
    }));
  }, [updateStoryboard]);

  const reorderScenes = useCallback((fromIndex: number, toIndex: number) => {
    updateStoryboard((prev) => {
      const newScenes = [...prev.scenes];
      const [movedScene] = newScenes.splice(fromIndex, 1);
      newScenes.splice(toIndex, 0, movedScene);
      return {
        ...prev,
        scenes: newScenes.map((scene, idx) => ({ ...scene, scene_number: idx + 1 })),
      };
    });
  }, [updateStoryboard]);

  // Drag and Drop Handlers
  const handleDragStart = useCallback((index: number) => {
    setDraggedSceneIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedSceneIndex(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedSceneIndex !== null && draggedSceneIndex !== targetIndex) {
      reorderScenes(draggedSceneIndex, targetIndex);
      setDraggedSceneIndex(targetIndex);
    }
  }, [draggedSceneIndex, reorderScenes]);

  const handleExport = useCallback(() => {
    if (!storyboard) return;
    const dataStr = JSON.stringify(storyboard, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `${storyboard.title.replace(/\s+/g, '_')}_storyboard.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [storyboard]);

  const proceedToGeneration = useCallback(async () => {
    if (!storyboard || !authToken) return;
    
    // Update status to ready for generation
    updateStoryboard((prev) => ({ ...prev, status: 'ready' }));
    
    // Redirect back to assistant to continue workflow
    router.push(`/assistant?storyboard_id=${storyboard.id}`);
  }, [storyboard, authToken, router, updateStoryboard]);

  // Selection management
  const toggleSceneSelection = useCallback((sceneNumber: number, multiSelect: boolean = false) => {
    setSelection((prev) => {
      // If switching to scene mode or no previous selection, create new
      if (!prev || prev.type !== 'scene') {
        return {
          type: 'scene',
          items: [{ sceneNumber }],
        };
      }
      
      // Check if already selected
      const isSelected = prev.items.some((item) => (item as SceneSelection).sceneNumber === sceneNumber);
      
      if (!multiSelect) {
        // Single select: toggle or replace
        return isSelected && prev.items.length === 1
          ? null // Deselect if it's the only one
          : { type: 'scene', items: [{ sceneNumber }] };
      }
      
      // Multi-select
      if (isSelected) {
        // Remove from selection
        const newItems = prev.items.filter((item) => (item as SceneSelection).sceneNumber !== sceneNumber);
        return newItems.length > 0 ? { type: 'scene', items: newItems } : null;
      } else {
        // Add to selection
        return { type: 'scene', items: [...prev.items, { sceneNumber }] };
      }
    });
    setSelectionMode('scene');
  }, []);

  const toggleFrameSelection = useCallback((sceneNumber: number, framePosition: 'first' | 'last', multiSelect: boolean = false) => {
    setSelection((prev) => {
      if (!prev || prev.type !== 'frame') {
        return {
          type: 'frame',
          items: [{ sceneNumber, framePosition }],
        };
      }
      
      const isSelected = prev.items.some(
        (item) =>
          (item as FrameSelection).sceneNumber === sceneNumber &&
          (item as FrameSelection).framePosition === framePosition
      );
      
      if (!multiSelect) {
        return isSelected && prev.items.length === 1
          ? null
          : { type: 'frame', items: [{ sceneNumber, framePosition }] };
      }
      
      if (isSelected) {
        const newItems = prev.items.filter(
          (item) =>
            !((item as FrameSelection).sceneNumber === sceneNumber &&
              (item as FrameSelection).framePosition === framePosition)
        );
        return newItems.length > 0 ? { type: 'frame', items: newItems } : null;
      } else {
        return { type: 'frame', items: [...prev.items, { sceneNumber, framePosition }] };
      }
    });
    setSelectionMode('frame');
  }, []);

  const toggleScriptSelection = useCallback((sceneNumber: number, multiSelect: boolean = false) => {
    setSelection((prev) => {
      if (!prev || prev.type !== 'script') {
        return {
          type: 'script',
          items: [{ sceneNumber }],
        };
      }
      
      const isSelected = prev.items.some((item) => (item as ScriptSelection).sceneNumber === sceneNumber);
      
      if (!multiSelect) {
        return isSelected && prev.items.length === 1
          ? null
          : { type: 'script', items: [{ sceneNumber }] };
      }
      
      if (isSelected) {
        const newItems = prev.items.filter((item) => (item as ScriptSelection).sceneNumber !== sceneNumber);
        return newItems.length > 0 ? { type: 'script', items: newItems } : null;
      } else {
        return { type: 'script', items: [...prev.items, { sceneNumber }] };
      }
    });
    setSelectionMode('script');
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  const handleModificationApplied = useCallback((changedFields?: string[]) => {
    // Mark changed elements for visual feedback
    if (changedFields && changedFields.length > 0) {
      const changedSet = new Set(changedFields);
      setRecentlyChanged(changedSet);
      
      // Clear the highlight after 3 seconds
      setTimeout(() => {
        setRecentlyChanged(new Set());
      }, 3000);
    }
    
    // Reload storyboard to get updated data
    if (!authToken || !storyboardId) return;
    
    const loadStoryboard = async () => {
      try {
        const res = await fetch(`/api/storyboard?id=${storyboardId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          setStoryboard(data.storyboard);
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        }
      } catch (error) {
        console.error('Error reloading storyboard:', error);
      }
    };

    loadStoryboard();
  }, [authToken, storyboardId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      
      // Escape: Clear selection
      if (e.key === 'Escape') {
        if (selection) {
          e.preventDefault();
          clearSelection();
        }
      }
      
      // Cmd/Ctrl+S: Force save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (storyboard) {
          saveStoryboard(storyboard);
        }
      }
      
      // Delete: Delete active scene (only if nothing selected)
      if (e.key === 'Delete' && !selection && activeSceneIndex >= 0 && storyboard && storyboard.scenes.length > 1) {
        // Don't delete if user is typing in an input/textarea
        if (!isTyping) {
          e.preventDefault();
          if (confirm(`Delete scene ${activeSceneIndex + 1}?`)) {
            deleteScene(activeSceneIndex);
            setActiveSceneIndex(Math.max(0, activeSceneIndex - 1));
          }
        }
      }

      // Arrow keys: Navigate scenes
      if (e.key === 'ArrowLeft' && activeSceneIndex > 0) {
        if (!isTyping) {
          e.preventDefault();
          setActiveSceneIndex(activeSceneIndex - 1);
        }
      }
      
      if (e.key === 'ArrowRight' && storyboard && activeSceneIndex < storyboard.scenes.length - 1) {
        if (!isTyping) {
          e.preventDefault();
          setActiveSceneIndex(activeSceneIndex + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [storyboard, activeSceneIndex, saveStoryboard, deleteScene, selection, clearSelection]);

  if (isLoading) {
    return (
      <div className={styles.shell}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <Loader2 size={32} className={styles.spinner} />
        </div>
      </div>
    );
  }

  if (!storyboard) {
    return (
      <div className={styles.shell}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <div style={{ textAlign: 'center' }}>
            <h2>Storyboard not found</h2>
            <button onClick={() => router.push('/assistant')} className={styles.primaryBtn}>
              Go to Assistant
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalDuration = storyboard.scenes.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

  return (
    <div className={styles.shell}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => router.push('/assistant')}>
            <ArrowLeft size={16} />
            Back
          </button>
          <div>
            <input
              className={styles.titleInput}
              value={storyboard.title}
              onChange={(e) => updateStoryboard((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Storyboard title"
            />
            <div className={styles.subtitle}>
              {storyboard.scenes.length} scenes · {totalDuration}s total
            </div>
          </div>
        </div>
        <div className={styles.headerRight}>
          {/* Selection Mode Toggle */}
          {selection && selection.items.length > 0 && (
            <div className={styles.selectionModeToggle}>
              <button
                className={`${styles.modeBtn} ${selectionMode === 'scene' ? styles.active : ''}`}
                onClick={() => setSelectionMode('scene')}
                title="Select scenes"
              >
                Scene
              </button>
              <button
                className={`${styles.modeBtn} ${selectionMode === 'frame' ? styles.active : ''}`}
                onClick={() => setSelectionMode('frame')}
                title="Select frames"
              >
                Frame
              </button>
              <button
                className={`${styles.modeBtn} ${selectionMode === 'script' ? styles.active : ''}`}
                onClick={() => setSelectionMode('script')}
                title="Select scripts"
              >
                Script
              </button>
            </div>
          )}
          
          <div className={`${styles.saveStatus} ${saveStatus === 'saving' ? styles.saving : saveStatus === 'saved' ? styles.saved : ''}`}>
            {saveStatus === 'saving' && (
              <>
                <Loader2 size={14} className={styles.spinner} />
                <span>Saving...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <Check size={14} />
                <span>Saved</span>
              </>
            )}
            {saveStatus === 'idle' && (
              <span>Auto-save enabled</span>
            )}
          </div>
          <select
            className={styles.aspectRatioSelector}
            value={storyboard.aspect_ratio || '9:16'}
            onChange={(e) => updateStoryboard((prev) => ({ ...prev, aspect_ratio: e.target.value }))}
          >
            <option value="9:16">9:16</option>
            <option value="16:9">16:9</option>
            <option value="1:1">1:1</option>
            <option value="4:5">4:5</option>
          </select>
          <button className={styles.iconBtn} onClick={() => setShowShortcutsHelp(!showShortcutsHelp)} title="Keyboard shortcuts">
            <HelpCircle size={18} />
          </button>
          <button className={styles.iconBtn} onClick={handleExport} title="Export JSON">
            <Download size={18} />
          </button>
          {authToken && (
            <StoryboardVersionHistory
              storyboardId={storyboardId}
              authToken={authToken}
              onRestore={(state) => {
                if (state && typeof state === 'object' && 'scenes' in state) {
                  setStoryboard((prev) => {
                    if (!prev) return prev;
                    const restored = { ...prev, ...state };
                    saveStoryboard(restored);
                    return restored;
                  });
                }
              }}
            />
          )}
          <button className={styles.primaryBtn} onClick={proceedToGeneration}>
            <Play size={16} />
            Continue to Generation
          </button>
        </div>
      </header>

      {/* Selection Info Panel */}
      {selection && selection.items.length > 0 && (
        <div className={styles.selectionInfoPanel}>
          <div className={styles.selectionInfoContent}>
            <span className={styles.selectionCount}>
              {selection.items.length} {selection.type}{selection.items.length > 1 ? 's' : ''} selected
            </span>
            <div className={styles.selectionActions}>
              <button
                className={styles.selectionActionBtn}
                onClick={() => {
                  // Select all items of current type
                  if (!storyboard) return;
                  if (selection.type === 'scene') {
                    setSelection({
                      type: 'scene',
                      items: storyboard.scenes.map((s) => ({ sceneNumber: s.scene_number })),
                    });
                  } else if (selection.type === 'frame') {
                    const allFrames: FrameSelection[] = [];
                    storyboard.scenes.forEach((s) => {
                      allFrames.push({ sceneNumber: s.scene_number, framePosition: 'first' });
                      allFrames.push({ sceneNumber: s.scene_number, framePosition: 'last' });
                    });
                    setSelection({
                      type: 'frame',
                      items: allFrames,
                    });
                  } else if (selection.type === 'script') {
                    setSelection({
                      type: 'script',
                      items: storyboard.scenes.map((s) => ({ sceneNumber: s.scene_number })),
                    });
                  }
                }}
              >
                Select All
              </button>
              <button className={styles.selectionActionBtn} onClick={clearSelection}>
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      {showShortcutsHelp && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={() => setShowShortcutsHelp(false)}
        >
          <div 
            style={{
              background: 'rgba(11, 12, 15, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 600 }}>Keyboard Shortcuts</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(231, 233, 238, 0.7)' }}>Force save</span>
                <kbd style={{ 
                  background: 'rgba(255, 255, 255, 0.1)', 
                  padding: '4px 8px', 
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}>Cmd/Ctrl + S</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(231, 233, 238, 0.7)' }}>Delete scene</span>
                <kbd style={{ 
                  background: 'rgba(255, 255, 255, 0.1)', 
                  padding: '4px 8px', 
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}>Delete</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(231, 233, 238, 0.7)' }}>Previous scene</span>
                <kbd style={{ 
                  background: 'rgba(255, 255, 255, 0.1)', 
                  padding: '4px 8px', 
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}>←</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(231, 233, 238, 0.7)' }}>Next scene</span>
                <kbd style={{ 
                  background: 'rgba(255, 255, 255, 0.1)', 
                  padding: '4px 8px', 
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}>→</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(231, 233, 238, 0.7)' }}>Clear selection</span>
                <kbd style={{ 
                  background: 'rgba(255, 255, 255, 0.1)', 
                  padding: '4px 8px', 
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}>Esc</kbd>
              </div>
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '12px', color: 'rgba(231, 233, 238, 0.5)', marginBottom: '8px' }}>
                  <strong>Selection & Modification:</strong>
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(231, 233, 238, 0.5)', lineHeight: '1.6' }}>
                  • Click scene header to select entire scene<br/>
                  • Click frame images to select specific frames<br/>
                  • Click script select button to select scripts<br/>
                  • Hold Cmd/Ctrl to select multiple items<br/>
                  • Type your modification in the bottom bar
                </div>
              </div>
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '12px', color: 'rgba(231, 233, 238, 0.5)' }}>
                  Tip: Drag scenes to reorder them in the grid or timeline view
                </div>
              </div>
            </div>
            <button
              style={{
                marginTop: '20px',
                width: '100%',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => setShowShortcutsHelp(false)}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.scrollArea}>
          {storyboard.scenes.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <Film size={64} />
              </div>
              <h2 className={styles.emptyTitle}>No scenes yet</h2>
              <p className={styles.emptySubtitle}>
                Add your first scene to start building your storyboard
              </p>
              <button className={styles.primaryBtn} onClick={addScene}>
                <Plus size={16} />
                Add Scene
              </button>
            </div>
          ) : (
            <div className={styles.scenesGrid}>
              {storyboard.scenes.map((scene, index) => {
                const isSceneSelected = isItemSelected(selection, 'scene', scene.scene_number);
                const isFirstFrameSelected = isItemSelected(selection, 'frame', scene.scene_number, 'first');
                const isLastFrameSelected = isItemSelected(selection, 'frame', scene.scene_number, 'last');
                const isScriptSelected = isItemSelected(selection, 'script', scene.scene_number);
                
                // Check if this scene/element was recently changed
                const sceneChanged = recentlyChanged.has(`scene_${scene.scene_number}_scene_name`) ||
                  recentlyChanged.has(`scene_${scene.scene_number}_description`) ||
                  recentlyChanged.has(`scene_${scene.scene_number}_duration_seconds`);
                const firstFrameChanged = recentlyChanged.has(`scene_${scene.scene_number}_first_frame_prompt`);
                const lastFrameChanged = recentlyChanged.has(`scene_${scene.scene_number}_last_frame_prompt`);
                const scriptChanged = recentlyChanged.has(`scene_${scene.scene_number}_voiceover_text`);
                
                return (
                <div
                  key={scene.scene_number}
                  className={`${styles.sceneCard} ${draggedSceneIndex === index ? styles.dragging : ''} ${isSceneSelected ? styles.selected : ''} ${sceneChanged ? styles.recentlyChanged : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onClick={(e) => {
                    // Check if clicking on a selectable element
                    const target = e.target as HTMLElement;
                    if (target.closest(`.${styles.selectableFrame}`) || 
                        target.closest(`.${styles.selectableScript}`) ||
                        target.closest(`.${styles.sceneHeader}`)) {
                      // Let specific handlers deal with it
                      return;
                    }
                    setActiveSceneIndex(index);
                  }}
                >
                  <div 
                    className={styles.sceneHeader}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      // Only select scene if clicking the header itself, not inputs
                      if (target === e.currentTarget || target.closest(`.${styles.sceneNumber}`) || target.closest(`.${styles.sceneHeaderContent}`)) {
                        toggleSceneSelection(scene.scene_number, e.metaKey || e.ctrlKey || e.shiftKey);
                      }
                    }}
                  >
                    <div className={styles.sceneNumber}>{scene.scene_number}</div>
                    <div className={styles.sceneHeaderContent}>
                      <input
                        className={styles.sceneNameInput}
                        value={scene.scene_name}
                        onChange={(e) => updateScene(index, (s) => ({ ...s, scene_name: e.target.value }))}
                        placeholder="Scene name"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className={styles.sceneTiming}>
                        <Clock size={12} />
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={scene.duration_seconds || 3}
                          onChange={(e) => updateScene(index, (s) => ({ ...s, duration_seconds: parseInt(e.target.value) || 3 }))}
                          style={{ 
                            background: 'transparent', 
                            border: 'none', 
                            color: 'inherit', 
                            width: '40px',
                            outline: 'none'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span>seconds</span>
                      </div>
                    </div>
                    <div className={styles.sceneActions}>
                      <button
                        className={`${styles.sceneActionBtn} ${isSceneSelected ? styles.selectedIndicator : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSceneSelection(scene.scene_number, e.metaKey || e.ctrlKey || e.shiftKey);
                        }}
                        title={isSceneSelected ? "Scene selected - click to deselect" : "Select scene for modification"}
                      >
                        <MousePointerClick size={14} />
                      </button>
                      <button
                        className={`${styles.sceneActionBtn} ${styles.delete}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this scene?')) {
                            deleteScene(index);
                          }
                        }}
                        title="Delete scene"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className={styles.sceneDescription}>
                    <div className={styles.sectionLabel}>Scene Description</div>
                    <textarea
                      className={styles.sceneDescriptionTextarea}
                      value={scene.description}
                      onChange={(e) => updateScene(index, (s) => ({ ...s, description: e.target.value }))}
                      placeholder="Describe what happens in this scene..."
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  <div className={styles.framesRow}>
                    <div 
                      className={`${styles.frameBox} ${styles.selectableFrame} ${isFirstFrameSelected ? styles.selectedFrame : ''} ${firstFrameChanged ? styles.recentlyChanged : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFrameSelection(scene.scene_number, 'first', e.metaKey || e.ctrlKey || e.shiftKey);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setVersionViewerElement({
                          type: 'frame',
                          sceneNumber: scene.scene_number,
                          framePosition: 'first',
                          currentValue: {
                            url: scene.first_frame_url,
                            prompt: scene.first_frame_prompt,
                          },
                        });
                        setVersionViewerOpen(true);
                      }}
                      title="Click to select, double-click to view versions"
                    >
                      {scene.first_frame_url ? (
                        <img src={scene.first_frame_url} alt="First frame" className={styles.frameImage} />
                      ) : (
                        <div className={styles.framePlaceholder}>frame 1 will be displayed</div>
                      )}
                      {isFirstFrameSelected && (
                        <div className={styles.frameSelectionBadge}>Selected</div>
                      )}
                    </div>
                    <div className={styles.frameArrow}>
                      <Play size={14} />
                    </div>
                    <div 
                      className={`${styles.frameBox} ${styles.selectableFrame} ${isLastFrameSelected ? styles.selectedFrame : ''} ${lastFrameChanged ? styles.recentlyChanged : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFrameSelection(scene.scene_number, 'last', e.metaKey || e.ctrlKey || e.shiftKey);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setVersionViewerElement({
                          type: 'frame',
                          sceneNumber: scene.scene_number,
                          framePosition: 'last',
                          currentValue: {
                            url: scene.last_frame_url,
                            prompt: scene.last_frame_prompt,
                          },
                        });
                        setVersionViewerOpen(true);
                      }}
                      title="Click to select, double-click to view versions"
                    >
                      {scene.last_frame_url ? (
                        <img src={scene.last_frame_url} alt="Last frame" className={styles.frameImage} />
                      ) : (
                        <div className={styles.framePlaceholder}>frame 2 will be displayed</div>
                      )}
                      {isLastFrameSelected && (
                        <div className={styles.frameSelectionBadge}>Selected</div>
                      )}
                    </div>
                  </div>

                  <div className={styles.videoPromptBox}>
                    <div className={styles.sectionLabel}>Video Generation Prompt (Motion)</div>
                    <textarea
                      className={styles.videoPromptTextarea}
                      value={scene.video_generation_prompt || ''}
                      onChange={(e) => updateScene(index, (s) => ({ ...s, video_generation_prompt: e.target.value }))}
                      placeholder="Describe the motion and action for video generation..."
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  <div 
                    className={`${styles.scriptBox} ${styles.selectableScript} ${isScriptSelected ? styles.selectedScript : ''} ${scriptChanged ? styles.recentlyChanged : ''}`}
                    onDoubleClick={(e) => {
                      const target = e.target as HTMLElement;
                      // Only open version viewer if not double-clicking the textarea (to allow text selection)
                      if (target.tagName !== 'TEXTAREA') {
                        e.stopPropagation();
                        setVersionViewerElement({
                          type: 'script',
                          sceneNumber: scene.scene_number,
                          currentValue: {
                            text: scene.voiceover_text || '',
                            mood: scene.audio_mood || '',
                          },
                        });
                        setVersionViewerOpen(true);
                      }
                    }}
                  >
                    <div className={styles.scriptLabel}>
                      Script of the scene
                      <button
                        className={`${styles.selectScriptBtn} ${isScriptSelected ? styles.active : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleScriptSelection(scene.scene_number, e.metaKey || e.ctrlKey || e.shiftKey);
                        }}
                        title={isScriptSelected ? "Script selected - click to deselect" : "Select script for modification"}
                      >
                        <MousePointerClick size={12} />
                      </button>
                    </div>
                    <textarea
                      className={styles.scriptTextarea}
                      value={scene.voiceover_text || ''}
                      onChange={(e) => updateScene(index, (s) => ({ ...s, voiceover_text: e.target.value }))}
                      placeholder="Voiceover or dialogue for this scene... (double-click box to view versions)"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className={styles.timeline}>
          <div className={styles.timelineHeader}>
            <div className={styles.timelineTitle}>Timeline</div>
            <div className={styles.timelineControls}>
              <button className={styles.addSceneBtn} onClick={addScene}>
                <Plus size={14} />
                Add Scene
              </button>
            </div>
          </div>
          <div className={styles.timelineBody}>
            <div className={styles.timelineRuler}>
              {[0, 1, 2, 3, 4, 5].map((sec) => (
                <div key={sec} className={styles.timelineMarker} style={{ left: `${sec * 100}px` }}>
                  {String(sec).padStart(2, '0')}
                </div>
              ))}
            </div>
            <div className={styles.timelineTrack}>
              {storyboard.scenes.map((scene, index) => {
                const startTime = storyboard.scenes
                  .slice(0, index)
                  .reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
                const minutes = Math.floor(startTime / 60);
                const seconds = startTime % 60;
                const timeLabel = `${String(minutes).padStart(2, '0')}.${String(seconds).padStart(2, '0')}`;

                const isTimelineSceneSelected = isItemSelected(selection, 'scene', scene.scene_number);
                
                return (
                  <div
                    key={scene.scene_number}
                    className={`${styles.timelineScene} ${activeSceneIndex === index ? styles.active : ''} ${draggedSceneIndex === index ? styles.dragging : ''} ${isTimelineSceneSelected ? styles.selected : ''}`}
                    style={{ width: `${(scene.duration_seconds || 3) * 40}px` }}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey) {
                        toggleSceneSelection(scene.scene_number, true);
                      } else {
                        setActiveSceneIndex(index);
                      }
                    }}
                  >
                    <div className={styles.timelineSceneNumber}>{scene.scene_number}</div>
                    <div className={styles.timelineSceneName}>{scene.scene_name}</div>
                    <div className={styles.timelineSceneDuration}>{timeLabel}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
      
      {/* Selection Modification Bar */}
      {authToken && (
        <StoryboardModificationBar
          selection={selection}
          storyboardId={storyboardId}
          authToken={authToken}
          onClearSelection={clearSelection}
          onModificationApplied={handleModificationApplied}
        />
      )}
      
      {/* Element Version Viewer */}
      {authToken && versionViewerElement && (
        <ElementVersionViewer
          isOpen={versionViewerOpen}
          onClose={() => {
            setVersionViewerOpen(false);
            setVersionViewerElement(null);
          }}
          elementType={versionViewerElement.type}
          sceneNumber={versionViewerElement.sceneNumber}
          framePosition={versionViewerElement.framePosition}
          currentValue={versionViewerElement.currentValue}
          storyboardId={storyboardId}
          authToken={authToken}
          onRestore={(value) => {
            // Restore the value to the scene
            const sceneIndex = storyboard?.scenes.findIndex(
              (s) => s.scene_number === versionViewerElement.sceneNumber
            );
            
            if (sceneIndex !== undefined && sceneIndex >= 0) {
              if (versionViewerElement.type === 'frame') {
                updateScene(sceneIndex, (s) => ({
                  ...s,
                  ...(versionViewerElement.framePosition === 'first'
                    ? {
                        first_frame_url: value.url,
                        first_frame_prompt: value.prompt,
                      }
                    : {
                        last_frame_url: value.url,
                        last_frame_prompt: value.prompt,
                      }),
                }));
              } else if (versionViewerElement.type === 'script') {
                updateScene(sceneIndex, (s) => ({
                  ...s,
                  voiceover_text: value.text,
                  audio_mood: value.mood,
                }));
              } else if (versionViewerElement.type === 'scene') {
                updateScene(sceneIndex, (s) => ({
                  ...s,
                  scene_name: value.name,
                  description: value.description,
                  duration_seconds: value.duration,
                }));
              }
            }
          }}
        />
      )}
    </div>
  );
}

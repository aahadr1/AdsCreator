'use client';

import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, RotateCcw, Clock, Loader2 } from 'lucide-react';
import styles from './ElementVersionViewer.module.css';

export type ElementType = 'frame' | 'script' | 'scene';

interface Version {
  id: string;
  timestamp: string;
  value: any;
  change_type?: string;
}

interface ElementVersionViewerProps {
  isOpen: boolean;
  onClose: () => void;
  elementType: ElementType;
  sceneNumber: number;
  framePosition?: 'first' | 'last';
  currentValue: any;
  storyboardId: string;
  authToken: string;
  onRestore: (value: any) => void;
}

export function ElementVersionViewer({
  isOpen,
  onClose,
  elementType,
  sceneNumber,
  framePosition,
  currentValue,
  storyboardId,
  authToken,
  onRestore,
}: ElementVersionViewerProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadVersions = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/storyboard/history?storyboard_id=${storyboardId}`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        if (res.ok) {
          const data = await res.json();
          const history = data.history || [];

          // Extract versions for this specific element
          const elementVersions: Version[] = [];

          // Add current version first
          elementVersions.push({
            id: 'current',
            timestamp: new Date().toISOString(),
            value: currentValue,
            change_type: 'current',
          });

          // Extract historical versions
          for (const entry of history) {
            const scenes = entry.after_state?.scenes || [];
            const scene = scenes.find((s: any) => s.scene_number === sceneNumber);

            if (!scene) continue;

            let value: any;
            if (elementType === 'frame' && framePosition) {
              value = {
                url:
                  framePosition === 'first'
                    ? scene.first_frame_url
                    : scene.last_frame_url,
                prompt:
                  framePosition === 'first'
                    ? scene.first_frame_prompt
                    : scene.last_frame_prompt,
              };
            } else if (elementType === 'script') {
              value = {
                text: scene.voiceover_text || '',
                mood: scene.audio_mood || '',
              };
            } else if (elementType === 'scene') {
              value = {
                name: scene.scene_name,
                description: scene.description,
                duration: scene.duration_seconds,
              };
            }

            elementVersions.push({
              id: entry.id,
              timestamp: entry.created_at,
              value,
              change_type: entry.change_type,
            });
          }

          setVersions(elementVersions);
        }
      } catch (error) {
        console.error('Error loading versions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadVersions();
  }, [isOpen, storyboardId, authToken, sceneNumber, elementType, framePosition, currentValue]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
      } else if (e.key === 'ArrowRight' && selectedIndex < versions.length - 1) {
        setSelectedIndex(selectedIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, versions.length, onClose]);

  // Auto-scroll selected version into view
  useEffect(() => {
    if (scrollContainerRef.current) {
      const selectedElement = scrollContainerRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const selectedVersion = versions[selectedIndex];
  const isCurrent = selectedIndex === 0;

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Current';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getTitle = () => {
    if (elementType === 'frame') {
      return `Scene ${sceneNumber} - ${framePosition === 'first' ? 'First' : 'Last'} Frame Versions`;
    } else if (elementType === 'script') {
      return `Scene ${sceneNumber} - Script Versions`;
    } else {
      return `Scene ${sceneNumber} - Versions`;
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>{getTitle()}</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {isLoading ? (
          <div className={styles.loading}>
            <Loader2 size={32} className={styles.spinner} />
            <p>Loading versions...</p>
          </div>
        ) : versions.length === 0 ? (
          <div className={styles.empty}>
            <Clock size={48} />
            <p>No version history available</p>
          </div>
        ) : (
          <>
            {/* Timeline/Carousel */}
            <div className={styles.timeline}>
              <button
                className={styles.navBtn}
                onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
                disabled={selectedIndex === 0}
              >
                <ChevronLeft size={20} />
              </button>

              <div className={styles.versionsScroll} ref={scrollContainerRef}>
                {versions.map((version, index) => (
                  <div
                    key={version.id}
                    className={`${styles.versionCard} ${
                      index === selectedIndex ? styles.selected : ''
                    }`}
                    onClick={() => setSelectedIndex(index)}
                  >
                    <div className={styles.versionNumber}>
                      {index === 0 ? 'Current' : `v${versions.length - index}`}
                    </div>
                    <div className={styles.versionTime}>
                      {formatTimestamp(version.timestamp)}
                    </div>
                  </div>
                ))}
              </div>

              <button
                className={styles.navBtn}
                onClick={() => setSelectedIndex(Math.min(versions.length - 1, selectedIndex + 1))}
                disabled={selectedIndex === versions.length - 1}
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Preview */}
            <div className={styles.preview}>
              {elementType === 'frame' && selectedVersion?.value?.url ? (
                <div className={styles.framePreview}>
                  <img
                    src={selectedVersion.value.url}
                    alt={`Version from ${formatTimestamp(selectedVersion.timestamp)}`}
                    className={styles.frameImage}
                  />
                  <div className={styles.promptPreview}>
                    <div className={styles.promptLabel}>Prompt:</div>
                    <div className={styles.promptText}>
                      {selectedVersion.value.prompt || 'No prompt available'}
                    </div>
                  </div>
                </div>
              ) : elementType === 'script' ? (
                <div className={styles.scriptPreview}>
                  <div className={styles.scriptText}>
                    {selectedVersion?.value?.text || 'No script'}
                  </div>
                  {selectedVersion?.value?.mood && (
                    <div className={styles.scriptMood}>
                      <strong>Mood:</strong> {selectedVersion.value.mood}
                    </div>
                  )}
                </div>
              ) : elementType === 'scene' ? (
                <div className={styles.scenePreview}>
                  <div className={styles.sceneField}>
                    <strong>Name:</strong> {selectedVersion?.value?.name || 'Untitled'}
                  </div>
                  <div className={styles.sceneField}>
                    <strong>Duration:</strong> {selectedVersion?.value?.duration || 3}s
                  </div>
                  <div className={styles.sceneField}>
                    <strong>Description:</strong>
                    <div className={styles.sceneDescription}>
                      {selectedVersion?.value?.description || 'No description'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.empty}>No preview available</div>
              )}
            </div>

            {/* Actions */}
            <div className={styles.actions}>
              <button
                className={styles.restoreBtn}
                onClick={() => {
                  if (selectedVersion && !isCurrent) {
                    onRestore(selectedVersion.value);
                    onClose();
                  }
                }}
                disabled={isCurrent}
              >
                <RotateCcw size={16} />
                {isCurrent ? 'Current Version' : 'Restore This Version'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

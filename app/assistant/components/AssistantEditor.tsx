'use client';

/**
 * VideoSOS-based Assistant Editor
 * Integrates VideoSOS components into the assistant page
 */

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { EditorAsset } from '../../../types/editor';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { videoSOSStore } from '../../../lib/videosos/adapter';
import { editorAssetToVideoSOSMedia } from '../../../types/editor';
import {
  VideoProjectStoreContext,
  createVideoProjectStore,
} from '../../../data/videosos/store';
import { useStore } from 'zustand';
import BottomBar from './videosos/bottom-bar';
import VideoPreview from './videosos/video-preview';
import LeftPanel from './videosos/left-panel';
import { Toaster } from './videosos/ui/toaster';
import { ToastProvider } from './videosos/ui/toast';

type AssistantEditorProps = {
  isOpen: boolean;
  onClose: () => void;
  initialAssets?: EditorAsset[];
};

export default function AssistantEditor({
  isOpen,
  onClose,
  initialAssets = [],
}: AssistantEditorProps) {
  const [projectId, setProjectId] = useState<string>('');
  const queryClientRef = useRef<QueryClient | null>(null);

  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient();
  }

  // Initialize project when editor opens
  useEffect(() => {
    if (isOpen && !projectId) {
      const initProject = async () => {
        const id = crypto.randomUUID();
        await videoSOSStore.initializeProject(id, initialAssets);
        setProjectId(id);
      };
      initProject();
    }
  }, [isOpen, projectId, initialAssets]);

  if (!isOpen || !projectId) return null;

  const projectStore = useRef(
    createVideoProjectStore({
      projectId,
    })
  ).current;

  return (
    <div className="assistant-editor-popup-overlay" onClick={onClose}>
      <div
        className="assistant-editor-popup"
        onClick={(e) => e.stopPropagation()}
        style={{ height: '95vh', maxHeight: '95vh' }}
      >
        <div className="assistant-editor-header">
          <div className="assistant-editor-header-left">
            <h2>Video Editor (VideoSOS)</h2>
          </div>
          <div className="assistant-editor-header-right">
            <button
              className="assistant-editor-close"
              onClick={onClose}
              type="button"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <ToastProvider>
          <QueryClientProvider client={queryClientRef.current}>
            <VideoProjectStoreContext.Provider value={projectStore}>
              <div
                className="flex flex-col relative overflow-hidden"
                style={{ height: 'calc(95vh - 60px)' }}
              >
                <main className="flex overflow-hidden flex-1 min-h-0">
                  <LeftPanel />
                  <div className="flex flex-col flex-1 min-w-0">
                    <VideoPreview />
                    <BottomBar />
                  </div>
                </main>
              </div>
              <Toaster />
            </VideoProjectStoreContext.Provider>
          </QueryClientProvider>
        </ToastProvider>
      </div>
    </div>
  );
}

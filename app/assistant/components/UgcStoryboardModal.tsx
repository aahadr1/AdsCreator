'use client';

import { useState, useEffect } from 'react';
import { X, Play, RefreshCw, Trash2, Plus, GripVertical } from 'lucide-react';

type Scene = {
  id: string;
  imageJobId?: string;
  imageUrl?: string;
  description: string;
  imagePrompt?: string;
  motionPrompt?: string;
  beatType?: string;
  shotType?: string;
  onScreenText?: string;
  actorAction?: string;
  script: string;
  status?: 'pending' | 'processing' | 'complete' | 'failed';
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  storyboard: {
    scenes: Scene[];
    globalScript?: string;
  };
  selectedAvatarUrl: string;
  onGenerateClips: (scenes: Scene[]) => void;
};

export default function UgcStoryboardModal({ isOpen, onClose, storyboard, selectedAvatarUrl, onGenerateClips }: Props) {
  const [scenes, setScenes] = useState<Scene[]>(storyboard.scenes);
  const [generating, setGenerating] = useState(false);
  const productImageUrl = (storyboard as any)?.metadata?.productImageUrl as string | undefined;

  // Update local state when prop changes
  useEffect(() => {
    setScenes(storyboard.scenes);
  }, [storyboard]);

  // Poll for image status for processing scenes
  useEffect(() => {
    if (!isOpen) return;
    const processing = scenes.filter(s => s.status === 'processing' && s.imageJobId);
    if (processing.length === 0) return;

    const interval = setInterval(async () => {
      let updated = false;
      const nextScenes = [...scenes];

      for (let i = 0; i < nextScenes.length; i++) {
        const scene = nextScenes[i];
        if (scene.status === 'processing' && scene.imageJobId) {
          try {
            const res = await fetch(`/api/replicate/status?id=${scene.imageJobId}`);
            if (res.ok) {
              const data = await res.json();
              if (data.status === 'succeeded') {
                const url = data.outputUrl || (typeof data.output === 'string' ? data.output : data.output?.url);
                nextScenes[i] = { ...scene, status: 'complete', imageUrl: url };
                updated = true;
              } else if (data.status === 'failed' || data.status === 'canceled') {
                nextScenes[i] = { ...scene, status: 'failed' };
                updated = true;
              }
            }
          } catch (e) { console.error(e); }
        }
      }
      if (updated) setScenes(nextScenes);
    }, 3000);

    return () => clearInterval(interval);
  }, [scenes, isOpen]);

  const handleRegenerateScene = async (index: number) => {
    const scene = scenes[index];
    const newScenes = [...scenes];
    newScenes[index] = { ...scene, status: 'processing', imageUrl: undefined };
    setScenes(newScenes);

    try {
      const res = await fetch('/api/ugc-builder/storyboard/scene/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneId: scene.id,
          description: scene.description,
          imagePrompt: scene.imagePrompt || scene.description,
          selectedAvatarUrl,
          productImageUrl,
        })
      });
      const data = await res.json();
      newScenes[index] = { ...newScenes[index], imageJobId: data.jobId };
      setScenes(newScenes);
    } catch (e) {
      console.error(e);
      newScenes[index] = { ...scene, status: 'failed' };
      setScenes(newScenes);
    }
  };

  const handleDeleteScene = (index: number) => {
    const newScenes = [...scenes];
    newScenes.splice(index, 1);
    setScenes(newScenes);
  };

  const handleAddScene = () => {
    const newScene: Scene = {
      id: `scene_new_${Date.now()}`,
      description: "New scene description...",
      script: "New line...",
      status: 'pending'
    };
    setScenes([...scenes, newScene]);
  };

  const handleGenerate = () => {
    setGenerating(true);
    onGenerateClips(scenes);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[60%] h-[85vh] bg-gray-900 border border-gray-700 rounded-2xl flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
          <div>
            <h2 className="text-xl font-bold text-white">Storyboard Editor</h2>
            <p className="text-sm text-gray-400">Edit scenes before generating video</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {scenes.map((scene, idx) => (
            <div key={scene.id} className="flex gap-4 p-4 bg-gray-800/50 border border-gray-700/50 rounded-xl group hover:border-gray-600 transition-colors">
              <div className="flex flex-col items-center pt-2 gap-2 text-gray-500">
                <span className="font-mono text-xs">{idx + 1}</span>
                <GripVertical size={16} className="cursor-move opacity-50" />
              </div>
              
              {/* Image Card */}
              <div className="w-[120px] aspect-[9/16] bg-black rounded-lg overflow-hidden shrink-0 relative border border-gray-800">
                {scene.imageUrl ? (
                  <img src={scene.imageUrl} alt="Scene" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {scene.status === 'processing' ? (
                      <RefreshCw size={20} className="animate-spin text-indigo-400" />
                    ) : (
                      <span className="text-xs text-gray-600">Pending</span>
                    )}
                  </div>
                )}
                {/* Overlay Controls */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button onClick={() => handleRegenerateScene(idx)} className="p-2 bg-gray-700 rounded-full text-white hover:bg-indigo-600" title="Regenerate Image">
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>

              {/* Text Inputs */}
              <div className="flex-1 space-y-3">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1 block">Visual Description</label>
                  <textarea
                    value={scene.description}
                    onChange={(e) => {
                      const newScenes = [...scenes];
                      newScenes[idx].description = e.target.value;
                      // Keep image prompt aligned with the user-edited visual description.
                      newScenes[idx].imagePrompt = e.target.value;
                      setScenes(newScenes);
                    }}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 focus:ring-2 focus:ring-indigo-500/50 outline-none resize-none h-20"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1 block">Script / Dialogue</label>
                  <input
                    type="text"
                    value={scene.script}
                    onChange={(e) => {
                      const newScenes = [...scenes];
                      newScenes[idx].script = e.target.value;
                      setScenes(newScenes);
                    }}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button onClick={() => handleDeleteScene(idx)} className="p-2 hover:bg-red-500/20 hover:text-red-400 text-gray-500 rounded-lg transition-colors" title="Delete Scene">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}

          <button onClick={handleAddScene} className="w-full py-4 border-2 border-dashed border-gray-700 rounded-xl text-gray-400 hover:border-indigo-500/50 hover:text-indigo-400 transition-colors flex items-center justify-center gap-2">
            <Plus size={20} />
            Add Scene
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 bg-gray-900/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleGenerate}
            disabled={generating}
            className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
          >
            {generating ? <RefreshCw className="animate-spin" size={18} /> : <Play size={18} fill="currentColor" />}
            Generate Video Clips
          </button>
        </div>

      </div>
    </div>
  );
}

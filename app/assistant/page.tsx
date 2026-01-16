'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabaseClient as supabase } from '@/lib/supabaseClient';
import type {
  UgcProject,
  ChatMessage,
  ProjectCapabilities,
  WidgetBlock,
  ProjectSettings,
} from '@/types/ugc';
import { getProjectCapabilities } from '@/types/ugc';
import { TopBar } from './components/TopBar';
import { ProjectPanel } from './components/ProjectPanel';
import { ChatTimeline } from './components/ChatTimeline';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export default function AssistantPage() {
  // Auth
  const [userId, setUserId] = useState<string>('');

  // Project state (capability-based, no phases)
  const [project, setProject] = useState<UgcProject | null>(null);
  const [capabilities, setCapabilities] = useState<ProjectCapabilities>(getProjectCapabilities(null));

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<{ type: 'image' | 'video' | 'file'; url: string; label?: string }[]>([]);

  // UI state
  const [showPreview, setShowPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Initialize
  // -------------------------------------------------------------------------

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setUserId(data.user.id);
    });
  }, []);

  // Welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
      id: 'welcome',
      role: 'assistant',
        content: "Hey! 👋 I'm your UGC ad creator. Tell me about the product or service you want to promote, and I'll handle everything from there - casting, script, storyboard, and video generation.\n\n**What would you like to advertise?**",
      timestamp: new Date(),
      }]);
    }
  }, []);

  // Update capabilities when project changes
  useEffect(() => {
    setCapabilities(getProjectCapabilities(project));
  }, [project]);

  // -------------------------------------------------------------------------
  // Polling for async jobs
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!project) return;

    // Poll for actor images
    const processingActors = project.actors.filter(a => a.imageStatus === 'processing' && a.imageJobId);
    // Poll for keyframes
    const processingKeyframes = project.storyboard?.scenes.flatMap(s =>
      s.keyframes.filter(k => k.status === 'processing' && k.imageJobId)
    ) || [];
    // Poll for clips
    const processingClips = project.clips.filter(c => c.status === 'processing' && c.jobId);

    if (processingActors.length === 0 && processingKeyframes.length === 0 && processingClips.length === 0) {
      return;
    }

    const interval = setInterval(async () => {
      let updated = false;

      // Check actors
      for (const actor of processingActors) {
        try {
          const res = await fetch(`/api/replicate/status?id=${actor.imageJobId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'succeeded') {
              setProject(prev => {
                if (!prev) return null;
          return {
                  ...prev,
                  actors: prev.actors.map(a =>
                    a.id === actor.id
                      ? { ...a, imageStatus: 'complete' as const, imageUrl: data.outputUrl || data.output }
                      : a
                  ),
                  updatedAt: new Date(),
                };
              });
              updated = true;
            } else if (data.status === 'failed') {
              setProject(prev => {
                if (!prev) return null;
                return {
                  ...prev,
                  actors: prev.actors.map(a =>
                    a.id === actor.id ? { ...a, imageStatus: 'failed' as const } : a
                  ),
                  updatedAt: new Date(),
                };
              });
              updated = true;
            }
          }
        } catch (e) {
          console.error('Poll error:', e);
        }
      }

      // Check keyframes
      for (const kf of processingKeyframes) {
        try {
          const res = await fetch(`/api/ugc/keyframes?jobId=${kf.imageJobId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'succeeded') {
              setProject(prev => {
                if (!prev?.storyboard) return prev;
                return {
                  ...prev,
                  storyboard: {
                    ...prev.storyboard,
                    scenes: prev.storyboard.scenes.map(s => ({
                      ...s,
                      keyframes: s.keyframes.map(k =>
                        k.id === kf.id
                          ? { ...k, status: 'complete' as const, imageUrl: data.imageUrl }
                          : k
                      ),
                    })),
                  },
                  updatedAt: new Date(),
                };
              });
              updated = true;
            }
          }
        } catch (e) {
          console.error('Keyframe poll error:', e);
        }
      }

      // Check clips
      for (const clip of processingClips) {
        try {
          const res = await fetch(`/api/ugc/video?jobId=${clip.jobId}&projectId=${project.id}&clipId=${clip.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'succeeded') {
              setProject(prev => {
                if (!prev) return null;
                return {
                  ...prev,
                  clips: prev.clips.map(c =>
                    c.id === clip.id
                      ? { ...c, status: 'complete' as const, videoUrl: data.videoUrl }
                      : c
                  ),
                  updatedAt: new Date(),
                };
              });
              updated = true;
            } else if (data.status === 'failed') {
              setProject(prev => {
                if (!prev) return null;
                return {
                  ...prev,
                  clips: prev.clips.map(c =>
                    c.id === clip.id
                      ? { ...c, status: 'failed' as const, autoFixSuggestion: data.autoFixSuggestion }
                      : c
                  ),
                  updatedAt: new Date(),
                };
              });
              updated = true;
            }
          }
        } catch (e) {
          console.error('Clip poll error:', e);
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [project]);

  // -------------------------------------------------------------------------
  // Agent Communication
  // -------------------------------------------------------------------------

  const callAgent = async (userMessage: string, widgetAction?: { widgetId: string; action: string; data?: any }) => {
    setLoading(true);

    try {
      const res = await fetch('/api/ugc/agent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
          userMessage,
                userId,
          projectId: project?.id,
          conversationHistory,
          widgetAction,
              }),
            });

            if (!res.ok) throw new Error(await res.text());

            const data = await res.json();

      // Update conversation history
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: data.message },
      ]);

      // Add assistant message with widgets
      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        blocks: data.blocks,
        toolCalls: data.toolCalls,
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Update project from contextPatch or full state
      if (data.contextPatch || data.projectId) {
        // Fetch updated project state
        // For now, merge contextPatch into local state
        if (data.contextPatch) {
          setProject(prev => prev ? { ...prev, ...data.contextPatch, updatedAt: new Date() } : null);
        }
      }

      // If we got a new project ID and don't have one, set it
      if (data.projectId && !project) {
        // Minimal project initialization
        setProject({
          id: data.projectId,
          name: 'New UGC Ad',
          userId,
          settings: {
            aspectRatio: '9:16',
            targetDuration: 30,
            fps: 30,
            resolution: '1080p',
            language: 'en',
          },
          actors: data.contextPatch?.actors || [],
          clips: [],
          brief: data.contextPatch?.brief,
          briefVersion: 0,
          storyboardVersion: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Update capabilities
      if (data.capabilities) {
        setCapabilities(data.capabilities);
      }

      // Handle tool calls (trigger media generation jobs)
      if (data.toolCalls) {
        for (const tc of data.toolCalls) {
          if (tc.tool === 'generate_actors' && tc.status === 'pending') {
            // Actor image generation is already started by the agent
            // Just update local state with pending actors
          }
          // Similarly for keyframes, videos, etc.
        }
      }

      return data;
    } catch (e: any) {
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `Oops, something went wrong: ${e.message}. Let's try that again!`,
        timestamp: new Date(),
        blocks: [{
          id: generateId(),
          type: 'error',
          data: { error: e.message, recoveryOptions: ['Try again'] },
          timestamp: new Date(),
        }],
      };
      setMessages(prev => [...prev, errorMsg]);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Message Handlers
  // -------------------------------------------------------------------------

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;
    if (!userId) {
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: "Please sign in first at /auth to create ads.",
        timestamp: new Date(),
      }]);
      return;
    }

    const userText = input.trim() || 'Here is an attachment';
    const currentAttachments = [...attachments];

    // Add user message
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: userText,
      timestamp: new Date(),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
    };
    setMessages(prev => [...prev, userMsg]);

    setInput('');
    setAttachments([]);

    // Call agent
    await callAgent(userText);
  };

  const handleWidgetAction = async (widgetId: string, action: string, data?: any) => {
    // Handle widget actions by sending to agent
    let userMessage = '';

    switch (action) {
      case 'submit_brief':
        userMessage = `Here's my brief: ${JSON.stringify(data)}`;
        break;
      case 'select_actor':
        userMessage = `I'll go with this creator`;
        break;
      case 'regenerate_actors':
        userMessage = 'Generate different creator options';
        break;
      case 'lock_direction':
        userMessage = `Lock the direction with these settings: ${JSON.stringify(data)}`;
        break;
      case 'generate_storyboard':
        userMessage = 'Generate the storyboard';
        break;
      case 'approve_scene':
        userMessage = `Approve scene ${data?.sceneId}`;
        break;
      case 'approve_storyboard':
        userMessage = 'Approve the entire storyboard';
        break;
      case 'generate_videos':
        userMessage = 'Generate video clips for all scenes';
        break;
      case 'regenerate_clip':
        userMessage = `Regenerate clip for scene ${data?.sceneId} with feedback: ${data?.feedback?.join(', ')}`;
        break;
      case 'assemble':
        userMessage = 'Assemble the final video';
        break;
      case 'export':
        userMessage = 'Export the final video';
        break;
      case 'qcm_response':
        userMessage = `I choose: ${data?.values || data?.selected?.join(', ')}`;
        break;
      case 'edit_brief':
        userMessage = 'I want to edit the brief';
        break;
      case 'confirm_brief':
        userMessage = 'Brief looks good, continue';
        break;
      case 'retry':
        userMessage = 'Let\'s try that again';
        break;
      default:
        userMessage = `Action: ${action}`;
    }

    // Add implicit user message
    setMessages(prev => [...prev, {
      id: generateId(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    }]);

    await callAgent(userMessage, { widgetId, action, data });
  };

  const handleAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', userId);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          const type = file.type.startsWith('image/') ? 'image' :
                      file.type.startsWith('video/') ? 'video' : 'file';

          setAttachments(prev => [...prev, {
          type,
            url: data.url,
            label: file.name,
          }]);
        }
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // -------------------------------------------------------------------------
  // Settings & Actions
  // -------------------------------------------------------------------------

  const handleSettingsChange = (updates: Partial<ProjectSettings>) => {
    if (project) {
      setProject(prev => prev ? {
                ...prev,
        settings: { ...prev.settings, ...updates },
        updatedAt: new Date(),
      } : null);
    }
  };

  const handlePreview = () => {
    setShowPreview(true);
  };

  const handleExport = () => {
    if (project?.finalEdit?.finalVideoUrl) {
      window.open(project.finalEdit.finalVideoUrl, '_blank');
    }
  };

  // Derive primary action based on capabilities
  const getPrimaryAction = () => {
    if (!project) return undefined;

    if (capabilities.canAssemble && !capabilities.hasFinalExport) {
                      return {
        label: 'Assemble Video',
        onClick: () => handleWidgetAction('', 'assemble'),
        disabled: loading,
      };
    }

    if (capabilities.canGenerateVideos && !capabilities.hasAllClipsReady) {
                    return {
        label: 'Generate Clips',
        onClick: () => handleWidgetAction('', 'generate_videos'),
        disabled: loading,
      };
    }

    if (capabilities.hasStoryboard && !capabilities.isStoryboardApproved) {
              return {
        label: 'Approve Storyboard',
        onClick: () => handleWidgetAction('', 'approve_storyboard'),
        disabled: loading,
      };
    }

    if (capabilities.hasSelectedActor && !capabilities.hasStoryboard) {
      return {
        label: 'Generate Storyboard',
        onClick: () => handleWidgetAction('', 'generate_storyboard'),
        disabled: loading,
      };
    }

    if (capabilities.hasBrief && !capabilities.hasActors) {
      return {
        label: 'Generate Creators',
        onClick: () => callAgent('Generate creator options'),
        disabled: loading,
      };
    }

    return undefined;
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="ugc-app two-panel">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
        multiple
      />

      {/* Top Bar */}
      <TopBar
        settings={project?.settings || {
          aspectRatio: '9:16',
          targetDuration: 30,
          fps: 30,
          resolution: '1080p',
          language: 'en',
        }}
        capabilities={capabilities}
        onSettingsChange={handleSettingsChange}
        onPreview={handlePreview}
        onExport={handleExport}
        primaryAction={getPrimaryAction()}
      />

      {/* Main Content */}
      <div className="ugc-main-content">
        {/* Left: Chat Timeline */}
        <div className="ugc-chat-panel">
          <ChatTimeline
            messages={messages}
            loading={loading}
            input={input}
            attachments={attachments}
            onInputChange={setInput}
            onSend={handleSend}
            onAttach={handleAttach}
            onRemoveAttachment={handleRemoveAttachment}
            onWidgetAction={handleWidgetAction}
            disabled={!userId}
            placeholder={!userId ? "Sign in to start..." : "Describe your product or ask me anything..."}
          />
      </div>

        {/* Right: Project Panel */}
        <div className="ugc-project-panel">
          <ProjectPanel
            project={project}
            capabilities={capabilities}
            onEditBrief={() => handleWidgetAction('', 'edit_brief')}
            onChangeActor={() => handleWidgetAction('', 'regenerate_actors')}
            onViewScene={(sceneId) => console.log('View scene', sceneId)}
            onViewClip={(clipId) => console.log('View clip', clipId)}
            onViewHistory={() => console.log('View history')}
          />
        </div>
      </div>
    </div>
  );
}

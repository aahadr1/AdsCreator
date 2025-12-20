'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabaseClient as supabase } from '../../../lib/supabaseClient';
import { ArrowLeft, Calendar, User } from 'lucide-react';
import Link from 'next/link';
import type { AssistantPlan } from '../../../types/assistant';
import CompactPlanWidget from '../components/CompactPlanWidget';
import MessageBubble from '../components/MessageBubble';
import OutputPreview from '../components/OutputPreview';

type Conversation = {
  id: string;
  user_id: string;
  title: string | null;
  messages: Array<{
    role: 'user' | 'assistant';
    content?: string;
    attachments?: any[];
    timestamp: string;
  }>;
  plan: AssistantPlan | null;
  created_at: string;
  updated_at: string;
};

type AssistantTask = {
  id: string;
  conversation_id: string;
  task_id: string;
  step_id: string;
  step_title: string | null;
  step_tool: string | null;
  step_model: string | null;
  step_inputs: any;
  step_output_url: string | null;
  step_output_text: string | null;
  step_status: string;
  created_at: string;
};

export default function ConversationPage() {
  const searchParams = useSearchParams();
  const conversationId = searchParams.get('id');
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [tasks, setTasks] = useState<AssistantTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (!conversationId || !userId) return;

    const loadConversation = async () => {
      try {
        const res = await fetch(`/api/assistant/conversations?user_id=${userId}&id=${conversationId}`);
        if (!res.ok) throw new Error('Failed to load conversation');
        const data = await res.json();
        setConversation(data);

        // Load tasks
        const tasksRes = await fetch(`/api/assistant/tasks?conversation_id=${conversationId}`);
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          setTasks(tasksData);
        }
      } catch (error) {
        console.error('Error loading conversation:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConversation();
  }, [conversationId, userId]);

  if (loading) {
    return (
      <div className="container">
        <div className="panel">
          <p>Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="container">
        <div className="panel">
          <p>Conversation not found</p>
          <Link href="/assistant">Back to Assistant</Link>
        </div>
      </div>
    );
  }

  const stepConfigs = conversation.plan?.steps.reduce((acc, step) => {
    acc[step.id] = { model: step.model, inputs: step.inputs };
    return acc;
  }, {} as Record<string, any>) || {};

  const stepStates = tasks.reduce((acc, task) => {
    acc[task.step_id] = {
      status: task.step_status as any,
      outputUrl: task.step_output_url,
      outputText: task.step_output_text,
    };
    return acc;
  }, {} as Record<string, any>);

  return (
    <div className="container">
      <div className="panel">
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Link href="/assistant" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <ArrowLeft size={16} />
            Back to Assistant
          </Link>
          <h1>{conversation.title || 'Conversation'}</h1>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-2)', color: 'var(--text-tertiary)', fontSize: 'var(--font-sm)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <Calendar size={14} />
              {new Date(conversation.created_at).toLocaleString()}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <User size={14} />
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {conversation.plan && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <CompactPlanWidget
              plan={conversation.plan}
              stepConfigs={stepConfigs}
              stepStates={stepStates}
              canRun={false}
              isRunning={false}
            />
          </div>
        )}

        <div style={{ marginTop: 'var(--space-4)' }}>
          <h2>Messages</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
            {conversation.messages.map((msg, idx) => (
              <MessageBubble
                key={idx}
                role={msg.role}
                content={msg.content}
                attachments={msg.attachments}
              />
            ))}
          </div>
        </div>

        {tasks.length > 0 && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <h2>Task Executions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
              {tasks.map((task) => (
                <div key={task.id} style={{ padding: 'var(--space-3)', background: 'var(--panel-elevated)', borderRadius: '8px', border: '1px solid var(--separator)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--space-2)' }}>
                    <div>
                      <h3>{task.step_title || task.step_id}</h3>
                      <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)' }}>
                        {task.step_tool} · {task.step_model}
                      </p>
                    </div>
                    <span style={{ padding: '4px 8px', background: 'var(--panel)', borderRadius: '4px', fontSize: 'var(--font-xs)' }}>
                      {task.step_status}
                    </span>
                  </div>
                  {task.step_inputs?.prompt && (
                    <div style={{ marginBottom: 'var(--space-2)' }}>
                      <strong style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Prompt:</strong>
                      <p style={{ fontSize: 'var(--font-sm)', marginTop: '4px' }}>{task.step_inputs.prompt}</p>
                    </div>
                  )}
                  {(task.step_output_url || task.step_output_text) && (
                    <div>
                      <strong style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>Output:</strong>
                      <div style={{ marginTop: 'var(--space-2)' }}>
                        <OutputPreview
                          url={task.step_output_url}
                          text={task.step_output_text}
                          compact={true} // Compact by default
                        />
                      </div>
                    </div>
                  )}
                  <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                    Task ID: {task.task_id}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


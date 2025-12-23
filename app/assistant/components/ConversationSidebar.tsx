'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Trash2, Edit2, X, Check, Loader2 } from 'lucide-react';

type Conversation = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  messages_count?: number;
};

type ConversationSidebarProps = {
  userId: string;
  currentConversationId: string | null;
  onSelectConversation: (id: string | null) => void;
  onNewConversation: () => void;
};

export default function ConversationSidebar({
  userId,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    loadConversations();
  }, [userId]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/assistant/conversations?user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (id: string, newTitle: string) => {
    try {
      const res = await fetch('/api/assistant/conversations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title: newTitle }),
      });
      if (res.ok) {
        setConversations(prev =>
          prev.map(c => c.id === id ? { ...c, title: newTitle } : c)
        );
        setEditingId(null);
        setEditTitle('');
      }
    } catch (error) {
      console.error('Error renaming conversation:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch('/api/assistant/conversations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (currentConversationId === id) {
          onSelectConversation(null);
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="conversation-sidebar">
      <div className="conversation-sidebar-header">
        <h2>Conversations</h2>
        <button
          className="conversation-sidebar-new-button"
          onClick={onNewConversation}
          title="New conversation"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="conversation-sidebar-list">
        {loading ? (
          <div className="conversation-sidebar-loading">
            <Loader2 size={16} className="spin" />
            <span>Loading...</span>
          </div>
        ) : conversations.length === 0 ? (
          <div className="conversation-sidebar-empty">
            <MessageSquare size={24} />
            <p>No conversations yet</p>
            <button onClick={onNewConversation} className="conversation-sidebar-empty-button">
              Start a conversation
            </button>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-sidebar-item ${
                currentConversationId === conv.id ? 'active' : ''
              }`}
              onClick={() => onSelectConversation(conv.id)}
            >
              {editingId === conv.id ? (
                <div className="conversation-sidebar-edit" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRename(conv.id, editTitle);
                      } else if (e.key === 'Escape') {
                        cancelEdit();
                      }
                    }}
                    autoFocus
                    className="conversation-sidebar-edit-input"
                  />
                  <button
                    onClick={() => handleRename(conv.id, editTitle)}
                    className="conversation-sidebar-edit-save"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="conversation-sidebar-edit-cancel"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="conversation-sidebar-item-content">
                    <div className="conversation-sidebar-item-title">
                      {conv.title || 'Untitled Conversation'}
                    </div>
                    <div className="conversation-sidebar-item-meta">
                      {formatDate(conv.updated_at)}
                    </div>
                  </div>
                  <div
                    className="conversation-sidebar-item-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="conversation-sidebar-item-action"
                      onClick={() => startEdit(conv)}
                      title="Rename"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      className="conversation-sidebar-item-action conversation-sidebar-item-action-danger"
                      onClick={() => {
                        if (confirm('Delete this conversation?')) {
                          setDeletingId(conv.id);
                          handleDelete(conv.id);
                        }
                      }}
                      disabled={deletingId === conv.id}
                      title="Delete"
                    >
                      {deletingId === conv.id ? (
                        <Loader2 size={14} className="spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}



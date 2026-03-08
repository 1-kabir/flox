import React, { useState } from 'react';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../../store';
import { cn, generateId, formatRelativeTime, truncate } from '../../lib/utils';
import type { Conversation, Message } from '../../types';

export const ChatSidebar: React.FC = () => {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    addConversation,
    updateConversation,
    deleteConversation: storeDeleteConversation,
  } = useAppStore();

  const createNewConversation = () => {
    const conv: Conversation = {
      id: generateId(),
      title: 'New Conversation',
      messages: [],
      created_at: new Date().toISOString(),
    };
    addConversation(conv);
    setActiveConversation(conv.id);
    // Persist immediately
    invoke('save_conversation', {
      conversation: {
        id: conv.id,
        title: conv.title,
        created_at: conv.created_at,
        session_id: null,
        browser_path: null,
      },
    }).catch(console.error);
  };

  // Switch to an existing conversation and ensure its messages are loaded.
  const selectConversation = async (conv: Conversation) => {
    setActiveConversation(conv.id);
    // Only fetch if messages haven't been loaded yet for this conversation.
    if (conv.messages.length === 0) {
      try {
        const messages = await invoke<Message[]>('get_messages', {
          conversationId: conv.id,
        });
        updateConversation(conv.id, { messages });
      } catch (e) {
        console.error('Failed to load messages:', e);
      }
    }
  };

  const deleteConversation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    storeDeleteConversation(id);
    invoke('delete_conversation', { conversationId: id }).catch(console.error);
  };

  return (
    <div className="w-64 flex flex-col border-r border-[#1a1a1a] bg-[#000000]">
      <div className="p-4 flex items-center justify-between border-b border-[#1a1a1a]">
        <h2 className="text-sm font-semibold text-white">Conversations</h2>
        <button
          onClick={createNewConversation}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 && (
          <div className="text-center text-[#606060] text-sm py-8">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No conversations yet</p>
            <p className="text-xs mt-1">Click + to start</p>
          </div>
        )}
        {conversations.map((conv) => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            isActive={activeConversationId === conv.id}
            onClick={() => selectConversation(conv)}
            onDelete={(e) => deleteConversation(e, conv.id)}
          />
        ))}
      </div>
    </div>
  );
};

const ConversationItem: React.FC<{
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}> = ({ conversation, isActive, onClick, onDelete }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200',
        isActive
          ? 'bg-violet-600/20 text-violet-300'
          : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
      )}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <MessageSquare className="w-4 h-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {truncate(conversation.title, 24)}
        </p>
        <p className="text-xs text-gray-600 truncate">
          {formatRelativeTime(conversation.created_at)}
        </p>
      </div>
      {hovered && (
        <button
          onClick={onDelete}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-500/20 hover:text-red-400 text-gray-600 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

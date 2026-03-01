import React, { useState } from 'react';
import { Bot, User, Brain, Navigation, Shield, ChevronDown, ChevronUp, Image } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Message } from '../../types';

const agentColors = {
  planner: 'text-blue-400',
  navigator: 'text-green-400',
  verifier: 'text-amber-400',
};

const agentIcons = {
  planner: Brain,
  navigator: Navigation,
  verifier: Shield,
};

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const [showScreenshot, setShowScreenshot] = useState(false);

  const isUser = message.role === 'user';
  const isAgent = message.role === 'agent';

  if (isUser) {
    return (
      <div className="flex items-start gap-3 justify-end">
        <div className="max-w-[75%] bg-violet-600 text-white rounded-2xl rounded-tr-sm px-4 py-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
        <div className="w-8 h-8 rounded-xl bg-violet-500/30 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-violet-400" />
        </div>
      </div>
    );
  }

  if (isAgent && message.agent) {
    const AgentIcon = agentIcons[message.agent] || Bot;
    const agentColor = agentColors[message.agent] || 'text-gray-400';

    return (
      <div className="flex items-start gap-3">
        <div className={cn('w-8 h-8 rounded-xl bg-gray-800 flex items-center justify-center shrink-0', agentColor)}>
          <AgentIcon className="w-4 h-4" />
        </div>
        <div className="max-w-[85%] space-y-2">
          <div className={cn('text-xs font-semibold uppercase tracking-wide', agentColor)}>
            {message.agent} agent
          </div>
          <div className="bg-gray-800/80 border border-gray-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
          {message.screenshot && (
            <div>
              <button
                onClick={() => setShowScreenshot(!showScreenshot)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                <Image className="w-3 h-3" />
                <span>Screenshot</span>
                {showScreenshot ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showScreenshot && (
                <img
                  src={`data:image/jpeg;base64,${message.screenshot}`}
                  alt="Browser screenshot"
                  className="mt-2 rounded-xl border border-gray-700 max-w-full"
                />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-xl bg-gray-800 flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 text-gray-400" />
      </div>
      <div className="max-w-[75%] bg-gray-800/80 border border-gray-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
};

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Globe, Monitor } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useAppStore } from '../../store';
import { generateId } from '../../lib/utils';
import { ChatSidebar } from './ChatSidebar';
import { MessageBubble } from './MessageBubble';
import { BrowserSelector } from './BrowserSelector';
import { AgentStatusBar } from './AgentStatusBar';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import type { AgentProgress, Message } from '../../types';

export const ChatView: React.FC = () => {
  const {
    conversations,
    activeConversationId,
    addMessage,
    updateConversation,
    addConversation,
    setActiveConversation,
    settings,
    selectedBrowser,
    browsers,
    isAgentRunning,
    setIsAgentRunning,
    addAgentProgress,
    clearAgentProgress,
    setCurrentTaskId,
    setCurrentScreenshot,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [headless, setHeadless] = useState(false);
  const agentProgressCount = useAppStore((s) => s.agentProgress.length);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  // Listen for agent progress events
  useEffect(() => {
    const unlisten = listen<AgentProgress>('agent_progress', (event) => {
      const progress = event.payload;
      addAgentProgress(progress);

      if (activeConversationId) {
        const msg: Message = {
          id: generateId(),
          role: 'agent',
          content: progress.message,
          timestamp: progress.timestamp,
          agent: progress.agent as 'planner' | 'navigator' | 'verifier',
          screenshot: progress.screenshot,
        };
        addMessage(activeConversationId, msg);
      }

      if (progress.screenshot) {
        setCurrentScreenshot(progress.screenshot);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [activeConversationId, addAgentProgress, addMessage, setCurrentScreenshot]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isAgentRunning) return;

    const userInput = input.trim();
    setInput('');

    // Create conversation if needed
    let convId = activeConversationId;
    if (!convId) {
      const newConv = {
        id: generateId(),
        title: userInput.substring(0, 40),
        messages: [],
        created_at: new Date().toISOString(),
      };
      addConversation(newConv);
      setActiveConversation(newConv.id);
      convId = newConv.id;
    } else {
      // Update title if first message
      const conv = conversations.find((c) => c.id === convId);
      if (conv && conv.messages.length === 0) {
        updateConversation(convId, { title: userInput.substring(0, 40) });
      }
    }

    // Add user message
    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: userInput,
      timestamp: new Date().toISOString(),
    };
    addMessage(convId, userMsg);

    // Check browser is selected
    const browser = browsers.find((b) => b.id === selectedBrowser) || browsers[0];
    if (!browser) {
      const errMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: 'No browser selected. Please detect browsers in Settings first.',
        timestamp: new Date().toISOString(),
      };
      addMessage(convId, errMsg);
      return;
    }

    setIsAgentRunning(true);
    clearAgentProgress();
    const taskId = generateId();
    setCurrentTaskId(taskId);
    const sessionId = generateId();

    try {
      // Launch browser
      await invoke('launch_browser', {
        browserPath: browser.path,
        headless,
        sessionId,
      });

      // Run agent task
      const result = await invoke('run_agent_task', {
        taskId,
        objective: userInput,
        sessionId,
        settings,
      });

      const doneMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: `✅ Task completed! The agent finished with status: ${(result as { status: string }).status}`,
        timestamp: new Date().toISOString(),
      };
      addMessage(convId, doneMsg);
    } catch (error) {
      const errMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: `❌ Error: ${error}`,
        timestamp: new Date().toISOString(),
      };
      addMessage(convId, errMsg);
    } finally {
      setIsAgentRunning(false);
      setCurrentTaskId(null);
    }
  }, [
    input, isAgentRunning, activeConversationId, conversations, selectedBrowser,
    browsers, headless, settings, addConversation, setActiveConversation,
    addMessage, updateConversation, setIsAgentRunning, clearAgentProgress, setCurrentTaskId
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      <ChatSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-100">
              {activeConversation?.title || 'New Conversation'}
            </h1>
            <p className="text-xs text-gray-500">AI Browser Automation</p>
          </div>
          <div className="flex items-center gap-3">
            <Toggle
              checked={headless}
              onChange={setHeadless}
              label="Headless"
            />
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              {headless ? (
                <><Globe className="w-3.5 h-3.5" /> Background</>
              ) : (
                <><Monitor className="w-3.5 h-3.5" /> Visible</>
              )}
            </div>
          </div>
        </div>

        {/* Browser selector */}
        <div className="px-4 py-2 border-b border-gray-800">
          <BrowserSelector />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {(!activeConversation || activeConversation.messages.length === 0) && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-600/20 flex items-center justify-center mb-4">
                <Globe className="w-8 h-8 text-violet-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-200 mb-2">
                Start an AI Automation
              </h2>
              <p className="text-gray-500 max-w-md text-sm leading-relaxed">
                Describe what you want to accomplish in the browser. The AI will plan,
                navigate, and verify each step automatically.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-2 w-full max-w-md">
                {[
                  'Search for the latest news about AI',
                  'Go to GitHub and find trending repos',
                  'Fill out a contact form on a website',
                  'Take a screenshot of google.com',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="text-left px-3 py-2 rounded-xl text-sm text-gray-400 bg-gray-800 hover:bg-gray-700 hover:text-gray-200 transition-colors border border-gray-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeConversation?.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Agent status */}
        {(isAgentRunning || agentProgressCount > 0) && (
          <div className="px-4 pb-2">
            <AgentStatusBar />
          </div>
        )}

        {/* Input area */}
        <div className="px-4 pb-4 pt-2">
          <div className="flex items-end gap-3 bg-gray-800 rounded-2xl p-3 border border-gray-700 focus-within:border-violet-500 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to automate..."
              disabled={isAgentRunning}
              rows={1}
              className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-500 resize-none focus:outline-none max-h-32 leading-relaxed"
              style={{ minHeight: '24px' }}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isAgentRunning}
              size="sm"
              className="shrink-0"
            >
              {isAgentRunning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-600 mt-1.5 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
};

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Globe, Monitor, Puzzle, X, CheckCircle, ChevronDown, ChevronUp, Database, ExternalLink } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import { listen } from '@tauri-apps/api/event';
import { useAppStore } from '../../store';
import { generateId } from '../../lib/utils';
import { ChatSidebar } from './ChatSidebar';
import { MessageBubble } from './MessageBubble';
import { BrowserSelector } from './BrowserSelector';
import { AgentStatusBar } from './AgentStatusBar';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import type { AgentProgress, Message, TaskCompletedPayload } from '../../types';

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
    skills,
    isOnline,
    addToast,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [headless, setHeadless] = useState(false);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [taskCompleted, setTaskCompleted] = useState<TaskCompletedPayload | null>(null);
  const [showScratchpad, setShowScratchpad] = useState(false);
  const agentProgressCount = useAppStore((s) => s.agentProgress.length);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skillPickerRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  // Close skill picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        skillPickerRef.current &&
        !skillPickerRef.current.contains(e.target as Node)
      ) {
        setShowSkillPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
        // Persist agent message immediately
        invoke('save_message', {
          message: {
            ...msg,
            conversation_id: activeConversationId,
            agent: msg.agent ?? null,
            screenshot: msg.screenshot ?? null,
          },
        }).catch(console.error);
      }

      if (progress.screenshot) {
        setCurrentScreenshot(progress.screenshot);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [activeConversationId, addAgentProgress, addMessage, setCurrentScreenshot]);

  // Listen for task completion events
  useEffect(() => {
    const unlisten = listen<TaskCompletedPayload>('task_completed', (event) => {
      setTaskCompleted(event.payload);
      setShowScratchpad(false);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Clear task completion card when a new task starts
  useEffect(() => {
    if (isAgentRunning) {
      setTaskCompleted(null);
      setShowScratchpad(false);
    }
  }, [isAgentRunning]);

  const persistConversationAndMessage = useCallback(
    async (convId: string, convData: { id: string; title: string; created_at: string }, msg: Message) => {
      await invoke('save_conversation', {
        conversation: {
          id: convData.id,
          title: convData.title,
          created_at: convData.created_at,
          session_id: null,
          browser_path: null,
        },
      });
      await invoke('save_message', {
        message: {
          ...msg,
          conversation_id: convId,
          agent: null,
          screenshot: null,
        },
      });
    },
    []
  );

  const handleSend = useCallback(async () => {
    if (!input.trim() || isAgentRunning) return;

    // Guard: warn if offline
    if (!isOnline) {
      addToast('You appear to be offline. Agent tasks require internet access.', 'warning');
    }

    // Guard: warn if API key is missing
    const hasApiKey =
      settings.planner_model.api_key.trim().length > 0 ||
      settings.planner_model.provider === 'ollama';
    if (!hasApiKey) {
      addToast('API key not configured. Go to Settings to add your key.', 'warning');
    }

    const userInput = input.trim();
    setInput('');

    // Create conversation if needed
    let convId = activeConversationId;
    let convData: { id: string; title: string; created_at: string };

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
      convData = { id: newConv.id, title: newConv.title, created_at: newConv.created_at };
    } else {
      const conv = conversations.find((c) => c.id === convId);
      if (conv && conv.messages.length === 0) {
        // Auto-title: use the first user message as the conversation title and
        // immediately persist the updated title so the DB stays in sync.
        const newTitle = userInput.substring(0, 40);
        updateConversation(convId, { title: newTitle });
        convData = {
          id: convId,
          title: newTitle,
          created_at: conv.created_at,
        };
      } else {
        convData = {
          id: convId,
          title: conv?.title ?? userInput.substring(0, 40),
          created_at: conv?.created_at ?? new Date().toISOString(),
        };
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
    persistConversationAndMessage(convId, convData, userMsg).catch(console.error);

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
      await invoke('save_message', {
        message: { ...errMsg, conversation_id: convId, agent: null, screenshot: null },
      }).catch(console.error);
      return;
    }

    setIsAgentRunning(true);
    clearAgentProgress();
    const taskId = generateId();
    setCurrentTaskId(taskId);
    const sessionId = generateId();

    try {
      await invoke('launch_browser', {
        browserPath: browser.path,
        headless,
        sessionId,
      });

      const result = await invoke('run_agent_task', {
        taskId,
        objective: userInput,
        sessionId,
        settings,
        forcedSkillIds: selectedSkillIds.length > 0 ? selectedSkillIds : null,
      });

      const doneMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: `✅ Task completed! Status: ${(result as { status: string }).status}`,
        timestamp: new Date().toISOString(),
      };
      addMessage(convId, doneMsg);
      await invoke('save_message', {
        message: { ...doneMsg, conversation_id: convId, agent: null, screenshot: null },
      }).catch(console.error);

      // Reset skill selection after task
      setSelectedSkillIds([]);
    } catch (error) {
      const errStr = String(error);
      const truncated = errStr.length > 120 ? `${errStr.slice(0, 120)}…` : errStr;
      addToast(truncated, 'error');
      const errMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: `❌ Error: ${error}`,
        timestamp: new Date().toISOString(),
      };
      addMessage(convId, errMsg);
      await invoke('save_message', {
        message: { ...errMsg, conversation_id: convId, agent: null, screenshot: null },
      }).catch(console.error);
    } finally {
      setIsAgentRunning(false);
      setCurrentTaskId(null);
    }
  }, [
    input,
    isAgentRunning,
    activeConversationId,
    conversations,
    selectedBrowser,
    browsers,
    headless,
    settings,
    selectedSkillIds,
    isOnline,
    addToast,
    addConversation,
    setActiveConversation,
    addMessage,
    updateConversation,
    setIsAgentRunning,
    clearAgentProgress,
    setCurrentTaskId,
    persistConversationAndMessage,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const enabledSkills = skills.filter((s) => s.enabled);

  return (
    <div className="flex flex-1 overflow-hidden">
      <ChatSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-center justify-between bg-[#000000]">
          <div>
            <h1 className="text-base font-semibold text-white">
              {activeConversation?.title || 'New Conversation'}
            </h1>
            <p className="text-xs text-[#606060]">AI Browser Automation</p>
          </div>
          <div className="flex items-center gap-3">
            <Toggle
              checked={headless}
              onChange={setHeadless}
              label="Headless"
            />
            <div className="flex items-center gap-1.5 text-xs text-[#606060]">
              {headless ? (
                <><Globe className="w-3.5 h-3.5" /> Background</>
              ) : (
                <><Monitor className="w-3.5 h-3.5" /> Visible</>
              )}
            </div>
          </div>
        </div>

        {/* Browser selector */}
        <div className="px-4 py-2 border-b border-[#1a1a1a] bg-[#000000]">
          <BrowserSelector />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#000000]">
          {(!activeConversation || activeConversation.messages.length === 0) && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-600/20 flex items-center justify-center mb-4">
                <Globe className="w-8 h-8 text-violet-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Start an AI Automation
              </h2>
              <p className="text-[#a0a0a0] max-w-md text-sm leading-relaxed">
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
                    className="text-left px-3 py-2 rounded-xl text-sm text-[#a0a0a0] bg-[#111111] hover:bg-[#1a1a1a] hover:text-white transition-colors border border-[#2a2a2a]"
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

          {/* Task Completed result card */}
          {taskCompleted && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-green-900/40 flex items-center justify-center shrink-0">
                <CheckCircle className="w-4 h-4 text-green-400" />
              </div>
              <div className="max-w-[85%] space-y-2 flex-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-green-400">
                  ✓ Task Completed
                </div>
                <div className="bg-green-950/30 border border-green-800/40 rounded-2xl rounded-tl-sm px-4 py-3 space-y-3">
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {taskCompleted.final_thought}
                  </p>

                  {taskCompleted.scratchpad.result_url && (
                    <button
                      onClick={() => open(taskCompleted.scratchpad.result_url!).catch(console.error)}
                      className="inline-flex items-center gap-1.5 text-sm text-green-400 hover:text-green-300 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Result →
                    </button>
                  )}

                  {Object.keys(taskCompleted.scratchpad).length > 0 && (
                    <div>
                      <button
                        onClick={() => setShowScratchpad((v) => !v)}
                        className="flex items-center gap-1.5 text-xs text-[#606060] hover:text-[#a0a0a0] transition-colors"
                      >
                        <Database className="w-3 h-3" />
                        <span>Task Memory</span>
                        {showScratchpad ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                      {showScratchpad && (
                        <div className="mt-2 space-y-1">
                          {Object.entries(taskCompleted.scratchpad).map(([k, v]) => (
                            <div key={k} className="flex gap-2 text-xs">
                              <span className="text-[#606060] font-mono shrink-0">{k}:</span>
                              <span className="text-[#a0a0a0] font-mono break-all">{v}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => useAppStore.getState().setActiveTab('logs')}
                    className="text-xs text-[#606060] hover:text-[#a0a0a0] transition-colors underline"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Agent status */}
        {(isAgentRunning || agentProgressCount > 0) && (
          <div className="px-4 pb-2 bg-[#000000]">
            <AgentStatusBar />
          </div>
        )}

        {/* Selected skills chips */}
        {selectedSkillIds.length > 0 && (
          <div className="px-4 pb-1 flex gap-1.5 flex-wrap bg-[#000000]">
            {selectedSkillIds.map((id) => {
              const skill = skills.find((s) => s.id === id);
              if (!skill) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs bg-violet-600/20 text-violet-300 border border-violet-600/30"
                >
                  <Puzzle className="w-3 h-3" />
                  {skill.name}
                  <button
                    onClick={() =>
                      setSelectedSkillIds((ids) => ids.filter((i) => i !== id))
                    }
                    className="hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Input area */}
        <div className="px-4 pb-4 pt-2 bg-[#000000]">
          <div className="flex items-end gap-2 bg-[#111111] rounded-xl p-3 border border-[#2a2a2a] focus-within:border-violet-500 transition-colors">
            {/* Skill picker button */}
            <div className="relative" ref={skillPickerRef}>
              <button
                type="button"
                onClick={() => setShowSkillPicker((v) => !v)}
                title="Select skills"
                className="p-1.5 rounded-lg text-[#606060] hover:text-violet-400 hover:bg-[#1a1a1a] transition-colors"
              >
                <Puzzle className="w-4 h-4" />
              </button>

              {showSkillPicker && (
                <div className="absolute bottom-full left-0 mb-2 w-60 bg-[#111111] border border-[#2a2a2a] rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="px-3 py-2 border-b border-[#2a2a2a]">
                    <p className="text-xs font-medium text-[#a0a0a0]">Force Skills</p>
                  </div>
                  {enabledSkills.length === 0 ? (
                    <p className="text-xs text-[#606060] px-3 py-3">No enabled skills</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto">
                      {enabledSkills.map((skill) => {
                        const selected = selectedSkillIds.includes(skill.id);
                        return (
                          <button
                            key={skill.id}
                            onClick={() => {
                              setSelectedSkillIds((ids) =>
                                selected
                                  ? ids.filter((i) => i !== skill.id)
                                  : [...ids, skill.id]
                              );
                            }}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-[#1a1a1a] transition-colors ${
                              selected ? 'text-violet-300' : 'text-[#a0a0a0]'
                            }`}
                          >
                            <Puzzle className="w-3 h-3 shrink-0" />
                            <span className="truncate">{skill.name}</span>
                            {selected && (
                              <span className="ml-auto text-violet-400">✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to automate..."
              disabled={isAgentRunning}
              rows={1}
              className="flex-1 bg-transparent text-sm text-white placeholder-[#404040] resize-none focus:outline-none max-h-32 leading-relaxed"
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
          <p className="text-xs text-[#606060] mt-1.5 text-center">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
};

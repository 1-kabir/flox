import React from 'react';
import { Brain, Navigation, Shield, Loader2, StopCircle } from 'lucide-react';
import { useAppStore } from '../../store';
import { cn } from '../../lib/utils';
import { invoke } from '@tauri-apps/api/core';

export const AgentStatusBar: React.FC = () => {
  const {
    isAgentRunning,
    agentProgress,
    currentTaskId,
    setIsAgentRunning,
  } = useAppStore();

  const latestProgress = agentProgress[agentProgress.length - 1];

  const stopAgent = async () => {
    if (currentTaskId) {
      try {
        await invoke('stop_agent_task', { taskId: currentTaskId });
      } catch (e) {
        console.error(e);
      }
    }
    setIsAgentRunning(false);
  };

  if (!isAgentRunning && agentProgress.length === 0) return null;

  const agentIcon = latestProgress?.agent === 'planner' ? Brain
    : latestProgress?.agent === 'navigator' ? Navigation
    : Shield;
  
  const AgentIcon = agentIcon;

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-xl border',
      isAgentRunning
        ? 'bg-violet-500/10 border-violet-500/20'
        : 'bg-emerald-500/10 border-emerald-500/20'
    )}>
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
        isAgentRunning ? 'bg-violet-500/20' : 'bg-emerald-500/20'
      )}>
        {isAgentRunning ? (
          <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
        ) : (
          <AgentIcon className="w-4 h-4 text-emerald-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        {latestProgress && (
          <>
            <div className={cn(
              'text-xs font-semibold uppercase tracking-wide mb-0.5',
              isAgentRunning ? 'text-violet-400' : 'text-emerald-400'
            )}>
              {latestProgress.agent} agent
            </div>
            <p className="text-sm text-gray-300 truncate">{latestProgress.message}</p>
          </>
        )}
        {!latestProgress && isAgentRunning && (
          <p className="text-sm text-gray-300">Starting agents...</p>
        )}
      </div>
      {isAgentRunning && (
        <button
          onClick={stopAgent}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm transition-colors"
        >
          <StopCircle className="w-4 h-4" />
          Stop
        </button>
      )}
    </div>
  );
};

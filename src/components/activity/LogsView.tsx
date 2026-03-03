import React, { useState, useEffect, useCallback } from 'react';
import { ScrollText, Trash2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../../store';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatRelativeTime } from '../../lib/utils';

interface AutomationLog {
  automation_id: string;
  automation_name?: string;
  timestamp: string;
  status: string;
  summary: string;
  steps: number;
}

interface AgentLog {
  task_id: string;
  objective: string;
  session_id: string;
  status: string;
  steps: number;
  timestamp: string;
}

export const LogsView: React.FC = () => {
  const { agentProgress } = useAppStore();
  const [automationLogs, setAutomationLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const logs = await invoke<AutomationLog[]>('get_automation_logs');
      setAutomationLogs(logs);
    } catch (e) {
      console.error('Failed to load logs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const clearLogs = async () => {
    try {
      await invoke('clear_automation_logs');
      setAutomationLogs([]);
    } catch (e) {
      console.error('Failed to clear logs:', e);
    }
  };

  const agentLogs: AgentLog[] = (() => {
    const map = new Map<string, AgentLog>();
    for (const p of agentProgress) {
      const existing = map.get(p.task_id);
      if (!existing) {
        map.set(p.task_id, {
          task_id: p.task_id,
          objective: p.message,
          session_id: '',
          status: 'running',
          steps: 1,
          timestamp: p.timestamp,
        });
      } else {
        existing.steps += 1;
      }
    }
    return Array.from(map.values());
  })();

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
              <ScrollText className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-100">Logs</h1>
              <p className="text-sm text-gray-500">Action logs, approvals, and LLM responses</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={loadLogs} loading={loading}>
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            {automationLogs.length > 0 && (
              <Button variant="danger" size="sm" onClick={clearLogs}>
                <Trash2 className="w-4 h-4" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Agent activity (live) */}
        {agentLogs.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Live Agent Activity
            </h2>
            <div className="space-y-2">
              {agentLogs.map((log) => (
                <div
                  key={log.task_id}
                  className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-blue-300 truncate">{log.objective}</p>
                    <Badge variant="info">Running</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {log.steps} steps · {formatRelativeTime(log.timestamp)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Automation logs */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Automation Logs
          </h2>

          {automationLogs.length === 0 ? (
            <div className="text-center py-12">
              <ScrollText className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No automation logs yet</p>
              <p className="text-xs text-gray-600 mt-1">
                Logs appear here after automations run
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {automationLogs.map((log, i) => {
                const key = `${log.automation_id}-${i}`;
                const isExpanded = expandedLog === key;
                return (
                  <div
                    key={key}
                    className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden"
                  >
                    <button
                      className="w-full flex items-center justify-between p-4 text-left"
                      onClick={() => setExpandedLog(isExpanded ? null : key)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm text-gray-200 truncate">
                            {log.automation_name || log.automation_id}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {log.steps} steps · {formatRelativeTime(log.timestamp)}
                          </p>
                        </div>
                      </div>
                      <Badge variant={log.status === 'success' ? 'success' : 'danger'}>
                        {log.status}
                      </Badge>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 border-t border-gray-700/50">
                        <p className="text-sm text-gray-400 mt-3">{log.summary}</p>
                        <p className="text-xs text-gray-600 mt-2">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

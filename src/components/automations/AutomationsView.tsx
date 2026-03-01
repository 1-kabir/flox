import React, { useState } from 'react';
import { Plus, Calendar, Zap } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../../store';
import { Button } from '../ui/Button';
import { AutomationCard } from './AutomationCard';
import { AutomationForm } from './AutomationForm';
import type { Automation } from '../../types';

export const AutomationsView: React.FC = () => {
  const {
    automations,
    addAutomation,
    updateAutomation,
    removeAutomation,
  } = useAppStore();

  const [showForm, setShowForm] = useState(false);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  const handleSave = async (data: Partial<Automation>) => {
    try {
      const saved = await invoke<Automation>('save_automation', {
        automation: {
          id: data.id || '',
          name: data.name || '',
          prompt: data.prompt || '',
          interval_minutes: data.interval_minutes || 60,
          enabled: data.enabled ?? true,
          last_run: null,
          next_run: null,
          last_result: null,
          browser_path: null,
          created_at: '',
        },
      });

      if (data.id) {
        updateAutomation(data.id, saved);
      } else {
        addAutomation(saved);
      }
      setShowForm(false);
    } catch (e) {
      console.error('Failed to save automation:', e);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await invoke('toggle_automation', { automationId: id, enabled });
      updateAutomation(id, { enabled });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke('delete_automation', { automationId: id });
      removeAutomation(id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunNow = async (id: string) => {
    setRunningIds((s) => new Set(s).add(id));
    try {
      await invoke('run_automation_now', { automationId: id });
    } catch (e) {
      console.error(e);
    } finally {
      setRunningIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-100">Automations</h1>
              <p className="text-sm text-gray-500">Schedule recurring AI browser tasks</p>
            </div>
          </div>
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="w-4 h-4" />
            New Automation
          </Button>
        </div>

        {automations.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-violet-600/10 flex items-center justify-center mx-auto">
              <Zap className="w-8 h-8 text-violet-400/50" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-400">No automations yet</h2>
              <p className="text-sm text-gray-600 mt-1">
                Create scheduled automations that run in the background
              </p>
            </div>
            <Button onClick={() => setShowForm(true)} variant="secondary">
              <Plus className="w-4 h-4" />
              Create your first automation
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {automations.map((automation) => (
              <AutomationCard
                key={automation.id}
                automation={automation}
                onToggle={(enabled) => handleToggle(automation.id, enabled)}
                onDelete={() => handleDelete(automation.id)}
                onRunNow={() => handleRunNow(automation.id)}
                isRunning={runningIds.has(automation.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <AutomationForm onSave={handleSave} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
};

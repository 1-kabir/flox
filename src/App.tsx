import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useAppStore } from './store';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/chat/ChatView';
import { SettingsView } from './components/settings/SettingsView';
import { AutomationsView } from './components/automations/AutomationsView';
import { LogsView } from './components/logs/LogsView';
import { cn } from './lib/utils';
import type { AppSettings, BrowserInfo, Automation } from './types';

export default function App() {
  const {
    theme,
    activeTab,
    setSettings,
    setBrowsers,
    setAutomations,
    updateAutomation,
  } = useAppStore();

  // Load settings and data on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Load settings
        const settings = await invoke<AppSettings>('get_settings');
        setSettings(settings);
        
        // Auto-detect browsers
        const browsers = await invoke<BrowserInfo[]>('detect_browsers');
        setBrowsers(browsers);
        
        // Load automations
        const automations = await invoke<Automation[]>('get_automations');
        setAutomations(automations);
      } catch (e) {
        console.error('Init error:', e);
      }
    };
    init();
  }, [setSettings, setBrowsers, setAutomations]);

  // Listen for automation events
  useEffect(() => {
    const unlistenCompleted = listen('automation_completed', (event) => {
      const payload = event.payload as {
        automation_id: string;
        status: string;
        summary: string;
      };
      updateAutomation(payload.automation_id, {
        last_result: `${payload.status}: ${payload.summary}`,
        last_run: new Date().toISOString(),
      });
    });

    return () => {
      unlistenCompleted.then((fn) => fn());
    };
  }, [updateAutomation]);

  const isDark = theme === 'dark';

  return (
    <div
      className={cn(
        'flex h-screen w-screen overflow-hidden',
        isDark ? 'dark bg-gray-900 text-gray-100' : 'light bg-gray-50 text-gray-900'
      )}
    >
      <Sidebar />
      <main className="flex flex-1 overflow-hidden">
        {activeTab === 'chat' && <ChatView />}
        {activeTab === 'settings' && <SettingsView />}
        {activeTab === 'automations' && <AutomationsView />}
        {activeTab === 'logs' && <LogsView />}
      </main>
    </div>
  );
}

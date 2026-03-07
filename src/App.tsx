import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useAppStore } from './store';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/chat/ChatView';
import { SettingsView } from './components/settings/SettingsView';
import { AutomationsView } from './components/automations/AutomationsView';
import { LogsView } from './components/activity/LogsView';
import { SkillsView } from './components/skills/SkillsView';
import { ApprovalModal } from './components/chat/ApprovalModal';
import { cn } from './lib/utils';
import type { AppSettings, BrowserInfo, Automation, ApprovalRequest } from './types';

// Conversation type returned by get_conversations (no messages yet)
interface ConversationRecord {
  id: string;
  title: string;
  created_at: string;
  session_id?: string;
  browser_path?: string;
}

export default function App() {
  const {
    theme,
    activeTab,
    setSettings,
    setBrowsers,
    setAutomations,
    setConversations,
    updateAutomation,
    addApproval,
    setIsOnline,
  } = useAppStore();

  // Load settings, browsers, automations, and conversations on mount
  useEffect(() => {
    const init = async () => {
      try {
        const [settings, browsers, automations, convRecords] = await Promise.all([
          invoke<AppSettings>('get_settings'),
          invoke<BrowserInfo[]>('detect_browsers'),
          invoke<Automation[]>('get_automations'),
          invoke<ConversationRecord[]>('get_conversations'),
        ]);

        setSettings(settings);
        setBrowsers(browsers);
        setAutomations(automations);

        // Build Conversation objects with empty messages arrays.
        // Individual message lists are loaded lazily per conversation.
        setConversations(
          convRecords.map((r) => ({
            id: r.id,
            title: r.title,
            created_at: r.created_at,
            session_id: r.session_id,
            browser_path: r.browser_path,
            messages: [],
          }))
        );
      } catch (e) {
        console.error('Init error:', e);
      }
    };
    init();
  }, [setSettings, setBrowsers, setAutomations, setConversations]);

  // Poll network status every 10 seconds
  useEffect(() => {
    const check = async () => {
      try {
        const online = await invoke<boolean>('check_network');
        setIsOnline(online);
      } catch {
        setIsOnline(false);
      }
    };
    check();
    const id = setInterval(check, 10_000);
    return () => clearInterval(id);
  }, [setIsOnline]);

  // Listen for automation completion events
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

  // Listen for human-in-the-loop approval requests
  useEffect(() => {
    const unlisten = listen<ApprovalRequest>('approval_required', (event) => {
      addApproval(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [addApproval]);

  const isDark = theme === 'dark';

  return (
    <div
      className={cn(
        'flex h-screen w-screen overflow-hidden',
        isDark ? 'dark bg-[#000000] text-white' : 'light bg-gray-50 text-gray-900'
      )}
    >
      <Sidebar />
      <main className="flex flex-1 overflow-hidden">
        {activeTab === 'chat' && <ChatView />}
        {activeTab === 'settings' && <SettingsView />}
        {activeTab === 'automations' && <AutomationsView />}
        {activeTab === 'logs' && <LogsView />}
        {activeTab === 'skills' && <SkillsView />}
      </main>

      {/* Human-in-the-loop approval modal */}
      <ApprovalModal />
    </div>
  );
}

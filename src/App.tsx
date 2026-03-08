import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useAppStore } from './store';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/chat/ChatView';
import { SettingsView } from './components/settings/SettingsView';
import { AutomationsView } from './components/automations/AutomationsView';
import { LogsView } from './components/activity/LogsView';
import { SkillsView } from './components/skills/SkillsView';
import { OnboardingView } from './components/onboarding/OnboardingView';
import { ApprovalModal } from './components/chat/ApprovalModal';
import { ToastContainer } from './components/ui/Toast';
import { cn } from './lib/utils';
import type { AppSettings, BrowserInfo, Automation, ApprovalRequest, Skill, Message } from './types';

// Conversation record returned by get_conversations (no messages yet)
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
    settings,
    setSettings,
    setBrowsers,
    setAutomations,
    setConversations,
    setSkills,
    updateAutomation,
    addApproval,
    setIsOnline,
    isOnline,
    addToast,
  } = useAppStore();

  // Track whether we already showed the "no browser" warning this session.
  const browserWarningShown = useRef(false);

  // Load settings, browsers, automations, conversations (with messages), and skills on mount
  useEffect(() => {
    const init = async () => {
      try {
        const [loadedSettings, detectedBrowsers, automations, convRecords, skillsList] = await Promise.all([
          invoke<AppSettings>('get_settings'),
          invoke<BrowserInfo[]>('detect_browsers'),
          invoke<Automation[]>('get_automations'),
          invoke<ConversationRecord[]>('get_conversations'),
          invoke<Skill[]>('get_skills'),
        ]);

        setSettings(loadedSettings);
        setBrowsers(detectedBrowsers);
        setAutomations(automations);
        setSkills(skillsList);

        if (detectedBrowsers.length === 0 && !browserWarningShown.current) {
          browserWarningShown.current = true;
          addToast(
            'No supported browser detected. Please install Chrome, Edge, Brave, or Vivaldi.',
            'error'
          );
        }

        // Eagerly load messages for every conversation so the chat history is
        // immediately available when the user opens a conversation.
        // Use allSettled so a failure on one conversation doesn't prevent the
        // rest from loading.
        const messageResults = await Promise.allSettled(
          convRecords.map((r) =>
            invoke<Message[]>('get_messages', { conversationId: r.id })
          )
        );
        const conversationsWithMessages = convRecords.map((r, i) => ({
          id: r.id,
          title: r.title,
          created_at: r.created_at,
          session_id: r.session_id,
          browser_path: r.browser_path,
          messages:
            messageResults[i].status === 'fulfilled'
              ? (messageResults[i] as PromiseFulfilledResult<Message[]>).value
              : [],
        }));
        setConversations(conversationsWithMessages);
      } catch (e) {
        console.error('Init error:', e);
      }
    };
    init();
  }, [setSettings, setBrowsers, setAutomations, setConversations, setSkills, addToast]);

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

  // Listen for backend error events and show toasts.
  useEffect(() => {
    const unlisten = listen<{ message: string; severity: 'success' | 'warning' | 'error' }>(
      'flox://error',
      (event) => {
        addToast(event.payload.message, event.payload.severity ?? 'error');
      }
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [addToast]);

  // Warn when offline state changes to offline.
  const prevOnlineRef = useRef(isOnline);
  useEffect(() => {
    if (prevOnlineRef.current && !isOnline) {
      addToast(
        'You appear to be offline. Agent tasks require internet access.',
        'warning'
      );
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, addToast]);

  const isDark = theme === 'dark';
  const showOnboarding = !settings.onboarding_complete;

  return (
    <div
      className={cn(
        'flex h-screen w-screen overflow-hidden',
        isDark ? 'dark bg-[#000000] text-white' : 'light bg-gray-50 text-gray-900'
      )}
    >
      {showOnboarding ? (
        <OnboardingView />
      ) : (
        <>
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
        </>
      )}

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
}


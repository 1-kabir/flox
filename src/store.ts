import { create } from 'zustand';
import type { AppSettings, BrowserInfo, Conversation, Message, Automation, AgentProgress, Skill, ApprovalRequest, SecretSummary } from './types';

const defaultSettings: AppSettings = {
  planner_model: {
    provider: 'openai',
    model: 'gpt-4o',
    api_key: '',
    temperature: 0.7,
    max_tokens: 2048,
  },
  navigator_model: {
    provider: 'openai',
    model: 'gpt-4o',
    api_key: '',
    temperature: 0.3,
    max_tokens: 1024,
  },
  verifier_model: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    api_key: '',
    temperature: 0.1,
    max_tokens: 512,
  },
  preferred_browser: undefined,
  headless_mode: false,
  theme: 'dark',
  screenshots_enabled: true,
  planner_vision: false,
  navigator_vision: true,
  max_steps: 50,
  timeout_seconds: 300,
  hil_routing_mode: 'all',
  auto_try_alternatives: false,
  onboarding_complete: false,
};

export interface Toast {
  id: string;
  message: string;
  severity: 'success' | 'warning' | 'error';
}

interface AppState {
  // Theme
  theme: 'dark' | 'light';
  toggleTheme: () => void;

  // Navigation
  activeTab: 'chat' | 'automations' | 'settings' | 'logs' | 'skills' | 'secrets';
  setActiveTab: (tab: 'chat' | 'automations' | 'settings' | 'logs' | 'skills' | 'secrets') => void;

  // Browsers
  browsers: BrowserInfo[];
  setBrowsers: (browsers: BrowserInfo[]) => void;
  selectedBrowser: string | null;
  setSelectedBrowser: (id: string | null) => void;

  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;
  setConversations: (convs: Conversation[]) => void;
  addConversation: (conv: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: Message) => void;

  // Settings
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;

  // Automations
  automations: Automation[];
  setAutomations: (automations: Automation[]) => void;
  addAutomation: (automation: Automation) => void;
  updateAutomation: (id: string, updates: Partial<Automation>) => void;
  removeAutomation: (id: string) => void;

  // Agent state
  isAgentRunning: boolean;
  setIsAgentRunning: (running: boolean) => void;
  agentProgress: AgentProgress[];
  addAgentProgress: (progress: AgentProgress) => void;
  clearAgentProgress: () => void;
  currentTaskId: string | null;
  setCurrentTaskId: (id: string | null) => void;
  currentScreenshot: string | null;
  setCurrentScreenshot: (screenshot: string | null) => void;

  // Skills
  skills: Skill[];
  setSkills: (skills: Skill[]) => void;
  addSkill: (skill: Skill) => void;
  updateSkill: (id: string, updates: Partial<Skill>) => void;
  removeSkill: (id: string) => void;

  // Pending human-in-the-loop approvals
  pendingApprovals: ApprovalRequest[];
  addApproval: (req: ApprovalRequest) => void;
  removeApproval: (approvalId: string) => void;

  // Network status
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;

  // Toasts
  toasts: Toast[];
  addToast: (message: string, severity: Toast['severity']) => void;
  removeToast: (id: string) => void;

  // Secrets
  secrets: SecretSummary[];
  setSecrets: (secrets: SecretSummary[]) => void;
  addSecret: (secret: SecretSummary) => void;
  updateSecret: (id: string, updates: Partial<SecretSummary>) => void;
  removeSecret: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'dark',
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

  activeTab: 'chat',
  setActiveTab: (tab) => set({ activeTab: tab }),

  browsers: [],
  setBrowsers: (browsers) => set({ browsers }),
  selectedBrowser: null,
  setSelectedBrowser: (id) => set({ selectedBrowser: id }),

  conversations: [],
  activeConversationId: null,
  setConversations: (conversations) => set({ conversations }),
  addConversation: (conv) =>
    set((state) => ({ conversations: [conv, ...state.conversations] })),
  updateConversation: (id, updates) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
  deleteConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      activeConversationId:
        state.activeConversationId === id ? null : state.activeConversationId,
    })),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  addMessage: (conversationId, message) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, message] }
          : c
      ),
    })),

  settings: defaultSettings,
  setSettings: (settings) => set({ settings }),

  automations: [],
  setAutomations: (automations) => set({ automations }),
  addAutomation: (automation) =>
    set((state) => ({ automations: [automation, ...state.automations] })),
  updateAutomation: (id, updates) =>
    set((state) => ({
      automations: state.automations.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),
  removeAutomation: (id) =>
    set((state) => ({
      automations: state.automations.filter((a) => a.id !== id),
    })),

  isAgentRunning: false,
  setIsAgentRunning: (running) => set({ isAgentRunning: running }),
  agentProgress: [],
  addAgentProgress: (progress) =>
    set((state) => ({
      agentProgress: [...state.agentProgress.slice(-50), progress],
    })),
  clearAgentProgress: () => set({ agentProgress: [] }),
  currentTaskId: null,
  setCurrentTaskId: (id) => set({ currentTaskId: id }),
  currentScreenshot: null,
  setCurrentScreenshot: (screenshot) => set({ currentScreenshot: screenshot }),

  skills: [],
  setSkills: (skills) => set({ skills }),
  addSkill: (skill) =>
    set((state) => ({ skills: [skill, ...state.skills] })),
  updateSkill: (id, updates) =>
    set((state) => ({
      skills: state.skills.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),
  removeSkill: (id) =>
    set((state) => ({ skills: state.skills.filter((s) => s.id !== id) })),

  pendingApprovals: [],
  addApproval: (req) =>
    set((state) => ({ pendingApprovals: [...state.pendingApprovals, req] })),
  removeApproval: (approvalId) =>
    set((state) => ({
      pendingApprovals: state.pendingApprovals.filter(
        (a) => a.approval_id !== approvalId
      ),
    })),

  isOnline: true,
  setIsOnline: (online) => set({ isOnline: online }),

  toasts: [],
  addToast: (message, severity) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id: `${Date.now()}-${Math.random()}`, message, severity },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  secrets: [],
  setSecrets: (secrets) => set({ secrets }),
  addSecret: (secret) =>
    set((state) => ({ secrets: [secret, ...state.secrets] })),
  updateSecret: (id, updates) =>
    set((state) => ({
      secrets: state.secrets.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),
  removeSecret: (id) =>
    set((state) => ({ secrets: state.secrets.filter((s) => s.id !== id) })),
}));

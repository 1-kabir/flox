export interface BrowserInfo {
  id: string;
  name: string;
  path: string;
  version?: string;
  browser_type: string;
}

export interface ModelConfig {
  provider: string;
  model: string;
  api_key: string;
  base_url?: string;
  temperature: number;
  max_tokens: number;
}

export interface AppSettings {
  planner_model: ModelConfig;
  navigator_model: ModelConfig;
  verifier_model: ModelConfig;
  preferred_browser?: string;
  headless_mode: boolean;
  theme: string;
  screenshots_enabled: boolean;
  max_steps: number;
  timeout_seconds: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'agent';
  content: string;
  timestamp: string;
  agent?: 'planner' | 'navigator' | 'verifier';
  screenshot?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  created_at: string;
  session_id?: string;
  browser_path?: string;
}

export interface AgentStep {
  step_id: string;
  agent: string;
  thought: string;
  action?: BrowserAction;
  result?: ActionResult;
  timestamp: string;
}

export interface AgentTask {
  task_id: string;
  objective: string;
  session_id: string;
  status: string;
  steps: AgentStep[];
}

export interface BrowserAction {
  action_type: string;
  selector?: string;
  value?: string;
  x?: number;
  y?: number;
  url?: string;
  key?: string;
  scroll_x?: number;
  scroll_y?: number;
  screenshot?: boolean;
}

export interface ActionResult {
  success: boolean;
  data?: unknown;
  screenshot?: string;
  error?: string;
}

export interface Automation {
  id: string;
  name: string;
  prompt: string;
  interval_minutes: number;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
  last_result?: string;
  browser_path?: string;
  created_at: string;
}

export interface AgentProgress {
  task_id: string;
  agent: string;
  message: string;
  screenshot?: string;
  timestamp: string;
}

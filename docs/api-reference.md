# API Reference

This document lists every Tauri command exposed by the Flox backend, along with their parameters, return types, and usage examples. All commands are called from the frontend using `invoke()` from `@tauri-apps/api/core`.

---

## Table of Contents

1. [How to Use This Reference](#how-to-use-this-reference)
2. [Browser Commands](#browser-commands)
3. [Agent Commands](#agent-commands)
4. [Settings Commands](#settings-commands)
5. [Conversation Commands](#conversation-commands)
6. [Automation Commands](#automation-commands)
7. [Skills Commands](#skills-commands)
8. [Network Commands](#network-commands)
9. [Events (Backend → Frontend)](#events-backend--frontend)
10. [TypeScript Types Reference](#typescript-types-reference)

---

## How to Use This Reference

All commands are invoked from the frontend using:

```typescript
import { invoke } from "@tauri-apps/api/core";

const result = await invoke<ReturnType>("command_name", {
  paramName: paramValue,
});
```

Commands that fail return a rejected promise with an error string. Always wrap calls in `try/catch`.

Parameter names in Tauri commands use `snake_case` in the Rust definition and are passed as `camelCase` from TypeScript (Tauri handles the conversion automatically via `rename_all = "camelCase"` on structs, but command parameter names remain snake_case in the invoke call).

---

## Browser Commands

### `detect_browsers`

Scans the system for installed Chromium-based browsers.

**Parameters**: none

**Returns**: `BrowserInfo[]`

```typescript
const browsers = await invoke<BrowserInfo[]>("detect_browsers");
// [{ id: "chrome", name: "Google Chrome", path: "/usr/bin/google-chrome", version: "120.0" }]
```

---

### `launch_browser`

Launches a browser and establishes a CDP debug session.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `browser_path` | `string` | Absolute path to the browser executable |
| `headless` | `boolean` | Whether to launch in headless mode |

**Returns**: `string` — The debug WebSocket URL

```typescript
const debugUrl = await invoke<string>("launch_browser", {
  browser_path: "/usr/bin/google-chrome",
  headless: false,
});
```

---

### `close_browser`

Closes an active browser session.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `browser_path` | `string` | Path of the browser to close (used as session key) |

**Returns**: `void`

```typescript
await invoke("close_browser", { browser_path: "/usr/bin/google-chrome" });
```

---

### `take_screenshot`

Captures a screenshot of the current browser page.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `browser_path` | `string` | Path of the active browser session |

**Returns**: `string` — Base64-encoded PNG image

```typescript
const screenshotB64 = await invoke<string>("take_screenshot", {
  browser_path: "/usr/bin/google-chrome",
});
// Display: <img src={`data:image/png;base64,${screenshotB64}`} />
```

---

### `execute_action`

Executes a single CDP browser action.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `browser_path` | `string` | Path of the active browser session |
| `action` | `BrowserAction` | The action to execute (see type definition) |

**Returns**: `ActionResult`

```typescript
const result = await invoke<ActionResult>("execute_action", {
  browser_path: "/usr/bin/google-chrome",
  action: {
    type: "navigate",
    url: "https://example.com",
  },
});
```

**`BrowserAction` type** — one of:

```typescript
// Navigate to URL
{ type: "navigate"; url: string }

// Click by CSS selector
{ type: "click"; selector: string }

// Click by coordinates
{ type: "click_coords"; x: number; y: number }

// Type text into focused element or selector
{ type: "type"; text: string; selector?: string }

// Scroll
{ type: "scroll"; direction: "up" | "down"; amount: number }

// Press a key
{ type: "key_press"; key: string }

// Execute JavaScript
{ type: "execute_js"; script: string }
```

---

## Agent Commands

### `run_agent_task`

Starts an AI agent task. The task runs asynchronously and emits events as it progresses.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `task_id` | `string` | Unique ID for this task (use `generateId()`) |
| `prompt` | `string` | The user's task description |
| `conversation_id` | `string` | ID of the conversation to attach messages to |
| `browser_path` | `string \| null` | Browser to use, or null for default |
| `settings` | `AppSettings` | Current app settings (models, behavior, etc.) |

**Returns**: `void` — Progress is delivered via events (see [Events](#events-backend--frontend))

```typescript
await invoke("run_agent_task", {
  task_id: generateId(),
  prompt: "Go to example.com and tell me the page title",
  conversation_id: currentConversation.id,
  browser_path: selectedBrowser?.path ?? null,
  settings: appSettings,
});
```

---

### `stop_agent_task`

Cancels a running agent task.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `task_id` | `string` | ID of the task to stop |

**Returns**: `void`

```typescript
await invoke("stop_agent_task", { task_id: currentTaskId });
```

---

### `resolve_approval`

Responds to a human-in-the-loop approval request.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `task_id` | `string` | Task ID from the approval request |
| `approved` | `boolean` | Whether to allow or deny the proposed action |

**Returns**: `void`

```typescript
// Allow the action
await invoke("resolve_approval", { task_id: approval.task_id, approved: true });

// Deny the action
await invoke("resolve_approval", { task_id: approval.task_id, approved: false });
```

---

## Settings Commands

### `get_settings`

Loads all app settings from the database.

**Parameters**: none

**Returns**: `AppSettings`

```typescript
const settings = await invoke<AppSettings>("get_settings");
```

---

### `save_settings`

Persists app settings to the database.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `settings` | `AppSettings` | The full settings object to save |

**Returns**: `void`

```typescript
await invoke("save_settings", { settings: updatedSettings });
```

---

## Conversation Commands

### `get_conversations`

Returns all conversations, sorted by creation date (newest first).

**Parameters**: none

**Returns**: `Conversation[]`

```typescript
const conversations = await invoke<Conversation[]>("get_conversations");
```

---

### `save_conversation`

Creates or updates a conversation.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `conversation` | `Conversation` | The conversation to save |

**Returns**: `void`

```typescript
await invoke("save_conversation", { conversation });
```

---

### `delete_conversation`

Permanently deletes a conversation and all its messages.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `conversation_id` | `string` | ID of the conversation to delete |

**Returns**: `void`

```typescript
await invoke("delete_conversation", { conversation_id: id });
```

---

### `get_messages`

Returns all messages for a conversation.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `conversation_id` | `string` | ID of the conversation |

**Returns**: `Message[]`

```typescript
const messages = await invoke<Message[]>("get_messages", { conversation_id: id });
```

---

### `save_message`

Saves a single message to a conversation.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `message` | `Message` | The message to save |

**Returns**: `void`

```typescript
await invoke("save_message", { message });
```

---

## Automation Commands

### `get_automations`

Returns all saved automations.

**Parameters**: none

**Returns**: `Automation[]`

```typescript
const automations = await invoke<Automation[]>("get_automations");
```

---

### `save_automation`

Creates or updates an automation.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `automation` | `Automation` | The automation to create or update |

**Returns**: `void`

```typescript
await invoke("save_automation", { automation });
```

---

### `delete_automation`

Permanently deletes an automation and its logs.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `automation_id` | `string` | ID of the automation to delete |

**Returns**: `void`

```typescript
await invoke("delete_automation", { automation_id: id });
```

---

### `toggle_automation`

Enables or disables an automation.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `automation_id` | `string` | ID of the automation |
| `enabled` | `boolean` | Whether to enable or disable it |

**Returns**: `void`

```typescript
await invoke("toggle_automation", { automation_id: id, enabled: true });
```

---

### `run_automation_now`

Triggers an automation to run immediately, outside its schedule.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `automation_id` | `string` | ID of the automation to run |

**Returns**: `void`

```typescript
await invoke("run_automation_now", { automation_id: id });
```

---

### `get_automation_logs`

Returns execution logs for a specific automation.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `automation_id` | `string` | ID of the automation |

**Returns**: `AutomationLog[]`

```typescript
const logs = await invoke<AutomationLog[]>("get_automation_logs", {
  automation_id: id,
});
```

---

### `clear_automation_logs`

Deletes all execution logs for a specific automation.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `automation_id` | `string` | ID of the automation |

**Returns**: `void`

```typescript
await invoke("clear_automation_logs", { automation_id: id });
```

---

## Skills Commands

### `get_skills`

Returns all installed skills.

**Parameters**: none

**Returns**: `Skill[]`

```typescript
const skills = await invoke<Skill[]>("get_skills");
```

---

### `install_skill`

Installs a skill from a remote URL.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `url` | `string` | URL to a JSON skill manifest |

**Returns**: `Skill` — The installed skill

```typescript
const skill = await invoke<Skill>("install_skill", {
  url: "https://example.com/flox-skills/github.json",
});
```

---

### `create_skill`

Creates a new skill from a local definition.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `skill` | `Skill` | The skill definition to save |

**Returns**: `void`

```typescript
await invoke("create_skill", { skill: newSkill });
```

---

### `update_skill`

Updates an existing skill.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `skill` | `Skill` | The updated skill (matched by `id`) |

**Returns**: `void`

```typescript
await invoke("update_skill", { skill: updatedSkill });
```

---

### `uninstall_skill`

Permanently removes a skill.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `skill_id` | `string` | ID of the skill to remove |

**Returns**: `void`

```typescript
await invoke("uninstall_skill", { skill_id: id });
```

---

### `toggle_skill`

Enables or disables a skill.

**Parameters**:

| Name | Type | Description |
|---|---|---|
| `skill_id` | `string` | ID of the skill |
| `enabled` | `boolean` | Whether to enable or disable it |

**Returns**: `void`

```typescript
await invoke("toggle_skill", { skill_id: id, enabled: false });
```

---

### `get_skill_usage`

Returns usage statistics for skills (how many times each skill was triggered).

**Parameters**: none

**Returns**: `Record<string, number>` — map of skill ID to trigger count

```typescript
const usage = await invoke<Record<string, number>>("get_skill_usage");
// { "github-skill": 42, "shopify-skill": 7 }
```

---

## Network Commands

### `check_network`

Checks whether the device has internet connectivity.

**Parameters**: none

**Returns**: `boolean`

```typescript
const isOnline = await invoke<boolean>("check_network");
```

---

## Events (Backend → Frontend)

The backend emits events using Tauri's event system. Listen to them in the frontend with:

```typescript
import { listen } from "@tauri-apps/api/event";

const unlisten = await listen<PayloadType>("event_name", (event) => {
  // event.payload is the typed payload
});

// Remove listener on component unmount:
return () => { unlisten(); };
```

---

### `approval_required`

Emitted when an agent task requires human approval before proceeding.

**Payload**: `ApprovalRequest`

```typescript
interface ApprovalRequest {
  task_id: string;
  action: string;        // Human-readable description of the proposed action
  tool: string;          // CDP tool name ("click", "navigate", etc.)
  params: object;        // Tool parameters
  risk_level: string;   // "medium" | "high" | "critical"
  reason: string;        // Why this action was flagged
}
```

**Frontend response**: Call `resolve_approval` with the `task_id`.

---

### `automation_completed`

Emitted when an automation run finishes (success or failure).

**Payload**: `AutomationResult`

```typescript
interface AutomationResult {
  automation_id: string;
  status: "success" | "failed";
  summary: string;
  timestamp: string;
}
```

---

### `agent_step`

Emitted for each action taken by the Navigator agent. Use this to update the activity log in real time.

**Payload**: `AgentStep`

```typescript
interface AgentStep {
  task_id: string;
  step_number: number;
  agent: "planner" | "navigator" | "verifier";
  action: string;
  details: object;
  screenshot?: string;  // base64 PNG, if screenshots enabled
  timestamp: string;
}
```

---

### `flox://error`

Emitted when an unrecoverable error occurs in the backend that should be shown to the user.

**Payload**: `string` — Error message

```typescript
await listen<string>("flox://error", (event) => {
  showToast({ type: "error", message: event.payload });
});
```

---

## TypeScript Types Reference

These types are defined in `src/types.ts`:

```typescript
interface BrowserInfo {
  id: string;
  name: string;
  path: string;
  version?: string;
  type: "chrome" | "edge" | "brave" | "vivaldi" | "chromium";
}

interface ModelConfig {
  provider: "openai" | "anthropic" | "groq" | "ollama" | "custom";
  model: string;
  api_key: string;
  base_url?: string;
  temperature: number;
  max_tokens: number;
  enable_vision?: boolean;
}

interface AppSettings {
  planner: ModelConfig;
  navigator: ModelConfig;
  verifier: ModelConfig;
  behavior: {
    approval_mode: "all" | "auto" | "none";
    max_steps: number;
    timeout_seconds: number;
    enable_screenshots: boolean;
    auto_retry: boolean;
    headless: boolean;
  };
  onboarding_complete: boolean;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  session_id?: string;
  browser_path?: string;
}

interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  agent?: "planner" | "navigator" | "verifier";
  screenshot?: string;
}

interface Automation {
  id: string;
  name: string;
  prompt: string;
  interval_minutes: number;
  enabled: boolean;
  browser_path?: string;
  last_run?: string;
  last_result?: "success" | "failed";
  created_at: string;
}

interface AutomationLog {
  id: string;
  automation_id: string;
  timestamp: string;
  status: "success" | "failed" | "in_progress";
  summary?: string;
  steps?: AgentStep[];
}

interface Skill {
  id: string;
  name: string;
  description: string;
  version?: string;
  author?: string;
  triggers: {
    domains?: string[];
    keywords?: string[];
  };
  planner_prompt?: string;
  navigator_prompt?: string;
  permissions?: string[];
  enabled: boolean;
}

interface AgentStep {
  task_id: string;
  step_number: number;
  agent: "planner" | "navigator" | "verifier";
  action: string;
  details: Record<string, unknown>;
  screenshot?: string;
  timestamp: string;
}

interface ApprovalRequest {
  task_id: string;
  action: string;
  tool: string;
  params: Record<string, unknown>;
  risk_level: "medium" | "high" | "critical";
  reason: string;
}
```

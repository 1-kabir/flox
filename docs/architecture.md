# Architecture

This document describes how Flox is structured internally. It's intended for developers who want to understand the codebase, contribute features, or build on top of Flox.

---

## Table of Contents

1. [High-Level Overview](#high-level-overview)
2. [Technology Stack](#technology-stack)
3. [Repository Layout](#repository-layout)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Three-Agent Pipeline](#three-agent-pipeline)
7. [Browser Automation (CDP)](#browser-automation-cdp)
8. [Human-in-the-Loop System](#human-in-the-loop-system)
9. [Scheduled Automation Engine](#scheduled-automation-engine)
10. [Skills System Internals](#skills-system-internals)
11. [Database Schema](#database-schema)
12. [IPC Layer (Tauri Commands)](#ipc-layer-tauri-commands)
13. [Event System](#event-system)
14. [Data Flow Diagrams](#data-flow-diagrams)

---

## High-Level Overview

Flox is a **Tauri v2 desktop application**: a Rust backend embedded in a WebView that renders a React/TypeScript frontend. The two layers communicate exclusively via Tauri's IPC (inter-process communication) mechanism — Tauri commands (frontend → backend) and Tauri events (backend → frontend).

```
┌──────────────────────────────────────────────────────────┐
│                     Operating System                      │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │                  Tauri Process                   │    │
│  │                                                  │    │
│  │  ┌────────────────┐     ┌──────────────────────┐│    │
│  │  │  WebView (UI)   │ IPC │   Rust Backend       ││    │
│  │  │  React + TS     │◄───►│   Tauri Commands     ││    │
│  │  │  Zustand State  │     │   SQLite (rusqlite)  ││    │
│  │  │  Tailwind CSS   │     │   Scheduler          ││    │
│  │  └────────────────┘     │   LLM clients        ││    │
│  │                          │   CDP automation     ││    │
│  │                          └──────────────────────┘│    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────┐    ┌──────────────────────────┐│
│  │  Chrome/Edge/Brave   │    │  LLM API (OpenAI/etc.)  ││
│  │  (CDP remote debug)  │    │  (over HTTPS)           ││
│  └─────────────────────┘    └──────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

The browser runs as a **separate process** launched by Flox. Flox communicates with it via Chrome DevTools Protocol (CDP) over a local WebSocket connection on a random debug port.

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Tauri | 2 |
| Frontend language | TypeScript | ~5.8 |
| Frontend framework | React | 19 |
| State management | Zustand | 5 |
| Styling | Tailwind CSS | 4 |
| Icons | Lucide React | latest |
| Build tool | Vite | 7 |
| Linter | ESLint | 9 |
| Backend language | Rust | stable |
| Async runtime | tokio | 1 |
| HTTP client | reqwest | 0.12 |
| WebSocket client | tokio-tungstenite | 0.24 |
| Database | SQLite (rusqlite) | 0.32 |
| Serialization | serde / serde_json | 1 |
| Time | chrono | 0.4 |
| ID generation | uuid | 1 |
| Base64 | base64 | 0.22 |

---

## Repository Layout

```
flox/
├── .github/
│   └── workflows/
│       ├── ci.yml          # CI: lint, build, Rust check
│       └── package.yml     # Release packaging (all platforms)
├── docs/                   # This documentation
├── public/                 # Static assets (served by Vite)
├── src/                    # React/TypeScript frontend
│   ├── components/
│   │   ├── chat/           # Chat view, browser selector, agent status
│   │   ├── automations/    # Automation CRUD UI
│   │   ├── skills/         # Skills management UI
│   │   ├── settings/       # Settings forms
│   │   ├── activity/       # Agent activity log viewer
│   │   ├── onboarding/     # First-run wizard
│   │   └── ui/             # Shared primitives (Button, Input, Toggle, etc.)
│   ├── store.ts            # Zustand global store
│   ├── types.ts            # Shared TypeScript types
│   ├── lib/utils.ts        # Utility functions (cn, generateId, etc.)
│   ├── App.tsx             # Root component + initialization
│   ├── main.tsx            # React entry point
│   └── index.css           # Global CSS + Tailwind imports
├── src-tauri/
│   ├── Cargo.toml          # Rust dependencies
│   ├── build.rs            # Tauri build script
│   └── src/
│       ├── main.rs         # Binary entry point (minimal)
│       ├── lib.rs          # App setup + all Tauri command bindings
│       ├── agents.rs       # Three-agent LLM orchestration + HIL
│       ├── browser.rs      # Browser detection + CDP automation
│       ├── automation.rs   # Scheduled automation scheduler
│       ├── skills.rs       # Skill registry + trigger matching
│       ├── conversations.rs # Conversation + message persistence
│       ├── settings.rs     # App settings CRUD
│       ├── db.rs           # SQLite connection + schema migration
│       └── network.rs      # Network connectivity check
├── index.html              # HTML shell (Vite entry point)
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Frontend Architecture

### Component Tree

```
App.tsx
├── OnboardingView (shown on first run)
└── Main Layout
    ├── Sidebar (navigation + conversation list)
    └── Content Panel (one of:)
        ├── ChatView
        │   ├── ChatSidebar (conversation list)
        │   ├── MessageBubble (per message)
        │   ├── BrowserSelector (dropdown)
        │   ├── AgentStatusBar (live progress)
        │   └── ApprovalModal (HIL prompts)
        ├── AutomationsView
        │   ├── AutomationCard (per automation)
        │   └── AutomationForm (create/edit)
        ├── LogsView (activity feed)
        ├── SkillsView
        │   └── CreateSkillModal
        └── SettingsView
```

### State Management (Zustand)

All application state lives in `src/store.ts`. The store is organized into slices:

| Slice | Contents |
|---|---|
| `theme` | `dark` or `light` |
| `activeTab` | Currently selected sidebar tab |
| `browsers` | List of detected browsers + selected browser |
| `conversations` | Conversation list + messages per conversation |
| `settings` | App settings (models, behavior, etc.) |
| `automations` | Automation list + per-automation logs |
| `agentProgress` | Real-time step list for the active task |
| `skills` | Skills list |
| `pendingApprovals` | Queue of human approval requests |
| `network` | Network connectivity status |
| `toasts` | Toast notification queue |

### Tauri API Calls

The frontend calls the Rust backend using `invoke()` from `@tauri-apps/api/core`:

```typescript
import { invoke } from "@tauri-apps/api/core";

const browsers = await invoke<BrowserInfo[]>("detect_browsers");
```

Event listeners use `listen()` from `@tauri-apps/api/event`:

```typescript
import { listen } from "@tauri-apps/api/event";

const unlisten = await listen<ApprovalRequest>("approval_required", (event) => {
  store.addPendingApproval(event.payload);
});
```

---

## Backend Architecture

### Module Responsibilities

| Module | Responsibility |
|---|---|
| `lib.rs` | Tauri app setup, plugin registration, and binding of all `#[tauri::command]` handlers |
| `agents.rs` | Three-agent orchestration, LLM API calls, approval routing, agent step emission |
| `browser.rs` | Platform-aware browser detection, process launch, CDP WebSocket session management, action execution |
| `automation.rs` | Background scheduler, interval tracking, automation run lifecycle |
| `skills.rs` | Skill CRUD, trigger matching against domain/keywords, prompt injection |
| `conversations.rs` | Conversation and message CRUD backed by SQLite |
| `settings.rs` | Key-value settings store (reads/writes the `settings` table) |
| `db.rs` | SQLite connection pool initialization (WAL mode), schema creation/migration |
| `network.rs` | Simple HTTP HEAD request to check internet connectivity |

### Shared State

Cross-module state uses `Arc<Mutex<T>>` wrapped in `Lazy` statics or Tauri's `State<T>` system:

- `BROWSER_SESSIONS`: `Lazy<Arc<Mutex<HashMap<String, BrowserSession>>>>` — active browser processes
- `RUNNING_TASKS`: `Lazy<Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>>` — cancellation flags for agent tasks
- `APPROVAL_CHANNELS`: `Lazy<Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>>` — HIL approval response channels

---

## Three-Agent Pipeline

When a task is submitted (via Chat or an Automation), the following pipeline runs:

```
User Prompt
     │
     ▼
┌─────────────┐
│   Planner   │  System prompt: task description + active skill planner_prompt
│   Agent     │  Output: JSON array of steps [{action, description}, ...]
└──────┬──────┘
       │ steps[]
       ▼
┌──────────────┐
│  (for each   │
│   step)      │
│              │
│  Navigator   │  System prompt: current step + page DOM + optional screenshot
│  Agent       │  Output: CDP action JSON {tool, params}
│              │
│      │       │
│      ▼       │
│  Verifier    │  Input: proposed action + context
│  Agent       │  Output: {approved: bool, risk_level, reason}
│              │
│      │       │
│      ▼       │
│  HIL Check   │  If risk_level > threshold → emit approval_required event
│              │  Wait up to 120s for human response
│              │
│      │       │
│      ▼       │
│  Execute     │  Send CDP command to browser
│  Action      │
└──────────────┘
       │
       ▼
  Task Complete
```

### Planner Output Format

The Planner returns a JSON array of step objects:

```json
[
  {"step": 1, "action": "navigate", "description": "Go to https://example.com"},
  {"step": 2, "action": "click", "description": "Click the search button"},
  {"step": 3, "action": "type", "description": "Type 'hello' in the search box"}
]
```

### Navigator Output Format

The Navigator returns a tool call describing the next CDP action:

```json
{
  "tool": "click",
  "params": {
    "selector": "button#search-submit"
  }
}
```

Available tools: `navigate`, `click`, `type`, `scroll`, `key_press`, `execute_js`, `screenshot`, `done`.

### Verifier Output Format

```json
{
  "approved": true,
  "risk_level": "low",
  "reason": "Clicking a standard navigation button poses no risk"
}
```

Risk levels: `low`, `medium`, `high`, `critical`.

---

## Browser Automation (CDP)

Flox communicates with browsers using the **Chrome DevTools Protocol (CDP)** over a WebSocket connection.

### Launch Flow

1. Flox selects an available port (random, 9222–9999)
2. Launches the browser process with `--remote-debugging-port=<port>`
3. Polls `http://localhost:<port>/json/version` until the browser responds
4. Opens a WebSocket connection to the browser's debug URL
5. Sends CDP commands as JSON over the WebSocket

### CDP Command Structure

```json
{
  "id": 1,
  "method": "Page.navigate",
  "params": {
    "url": "https://example.com"
  }
}
```

Responses arrive asynchronously and are matched by `id`.

### Supported CDP Domains

| Domain | Usage |
|---|---|
| `Page` | Navigation, screenshots, JavaScript execution |
| `Input` | Mouse click simulation, keyboard input |
| `Runtime` | JavaScript evaluation |
| `DOM` | Element querying and interaction |
| `Target` | Tab management |

### Browser Session Lifecycle

Browser sessions are stored in `BROWSER_SESSIONS` with the browser path as key. A session includes:
- The OS process handle (for shutdown)
- The debug port number
- The WebSocket connection

Sessions persist between tasks in the same conversation. A new session is created if the requested browser has no active session.

---

## Human-in-the-Loop System

### Flow

```
Verifier → risk_level: high/critical
               │
               ▼
    emit "approval_required" event (to frontend)
               │
               ▼
    Insert oneshot::Sender into APPROVAL_CHANNELS[task_id]
               │
               ▼
    Await response (timeout: 120 seconds)
               │
        ┌──────┴──────┐
        │ User action │
   Allow / Deny / Timeout(deny)
        │
        ▼
    oneshot::Receiver receives bool
               │
               ▼
    Continue task or skip action
```

### Risk Detection (browser.rs / agents.rs)

Actions are flagged as risky based on:

1. **URL patterns**: Navigating to URLs containing `checkout`, `payment`, `billing`, `delete`, `remove`, `account/close`
2. **Element labels**: Clicking elements whose text or selector contains `delete`, `submit`, `purchase`, `confirm`, `proceed`, `checkout`
3. **JavaScript execution**: Any `execute_js` action is always considered potentially risky

---

## Scheduled Automation Engine

The scheduler lives in `automation.rs` and runs as a background tokio task.

### Scheduler Loop

```
Every tick (1 minute):
  for each enabled automation:
    if now >= automation.last_run + automation.interval_minutes:
      spawn task: run_automation(automation)
      update automation.last_run = now
```

### System Wake Handling

The scheduler listens for Tauri's system wake event. When the computer wakes from sleep:
- The scheduler recalculates overdue automations
- Any automations that should have run while the computer was asleep are triggered immediately

### Automation Run Lifecycle

1. Create a log entry with status `in_progress`
2. Call `run_agent_task` with the automation's prompt and browser preference
3. On completion: update log entry with status (`success` or `failed`) and summary
4. Emit `automation_completed` event to the frontend

---

## Skills System Internals

### Storage

Skills are stored as JSON blobs in the `skills` SQLite table (key: skill `id`, value: full skill JSON).

### Trigger Matching

When a task starts, `skills.rs` compares:
- The **current browser URL** against each skill's `domain` triggers (glob matching, `*` = any subdomain)
- The **user's prompt** against each skill's `keyword` triggers (case-insensitive substring match)

If any trigger matches, the skill is "active" for this task.

### Prompt Injection

Active skills' `planner_prompt` strings are concatenated and appended to the Planner's system message. Similarly, `navigator_prompt` strings are appended to the Navigator's system message.

---

## Database Schema

**Location**: `{app_data_dir}/flox.db` — where `{app_data_dir}` is the OS-specific application data directory shown in the table below.  
**Mode**: WAL (Write-Ahead Logging) for concurrent read/write

```sql
-- Key-value settings store
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL  -- JSON-encoded value
);

-- Scheduled automations
CREATE TABLE automations (
  id   TEXT PRIMARY KEY,
  data TEXT NOT NULL  -- JSON-encoded Automation struct
);

-- Skills
CREATE TABLE skills (
  id   TEXT PRIMARY KEY,
  data TEXT NOT NULL  -- JSON-encoded Skill struct
);

-- Chat conversations
CREATE TABLE conversations (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  session_id TEXT,
  browser_path TEXT
);

-- Chat messages
CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role            TEXT NOT NULL,  -- 'user' | 'assistant' | 'system'
  content         TEXT NOT NULL,
  timestamp       TEXT NOT NULL,
  agent           TEXT,           -- 'planner' | 'navigator' | 'verifier' | null
  screenshot      TEXT            -- base64-encoded PNG or null
);

-- Agent step logs (for Activity view)
CREATE TABLE agent_steps (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL,
  data       TEXT NOT NULL,  -- JSON-encoded AgentStep
  created_at TEXT NOT NULL
);

-- Automation execution logs
CREATE TABLE automation_logs (
  id             TEXT PRIMARY KEY,
  automation_id  TEXT NOT NULL,
  timestamp      TEXT NOT NULL,
  status         TEXT NOT NULL,  -- 'success' | 'failed' | 'in_progress'
  summary        TEXT,
  steps          TEXT            -- JSON array of step summaries
);
```

---

## IPC Layer (Tauri Commands)

All Rust functions exposed to the frontend are annotated with `#[tauri::command]` and registered in `lib.rs`'s `tauri::Builder::invoke_handler()`.

Commands follow this pattern:

```rust
#[tauri::command]
async fn my_command(
    app: tauri::AppHandle,
    param: String,
) -> Result<ReturnType, String> {
    // ...
    Ok(result)
}
```

Errors are returned as `Err(String)` and are surfaced as rejected promises in the frontend.

The full list of commands is documented in the [API Reference](api-reference.md).

---

## Event System

Flox uses Tauri's event system for backend-to-frontend push notifications.

| Event name | Payload type | Description |
|---|---|---|
| `approval_required` | `ApprovalRequest` | HIL: frontend must show approval modal |
| `automation_completed` | `AutomationResult` | An automation finished; update UI |
| `agent_step` | `AgentStep` | New agent action to display in activity log |
| `flox://error` | `string` | Display an error toast |

Events are emitted from Rust using:

```rust
app.emit("event_name", payload)?;
```

And listened to from TypeScript using:

```typescript
listen<PayloadType>("event_name", (event) => { ... });
```

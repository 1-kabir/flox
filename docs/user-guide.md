# User Guide

A complete reference to every feature in Flox. This guide assumes you've already completed [Getting Started](getting-started.md).

---

## Table of Contents

1. [The Interface](#the-interface)
2. [Chat](#chat)
3. [Automations](#automations)
4. [Skills](#skills)
5. [Activity Logs](#activity-logs)
6. [Settings](#settings)
7. [System Tray](#system-tray)

---

## The Interface

Flox's main window is divided into two parts:

- **Left Sidebar** — Navigation icons for each section, plus your conversation history
- **Main Panel** — The currently selected view

### Sidebar Icons (top to bottom)

| Icon | Section | Purpose |
|---|---|---|
| 💬 | Chat | Run tasks and view conversation history |
| ⏰ | Automations | Schedule recurring tasks |
| 📋 | Activity | Real-time agent action logs |
| 🧩 | Skills | Browse and manage extensions |
| ⚙️ | Settings | Configure models, keys, and behavior |

### Theme

Click the **sun/moon icon** at the bottom of the sidebar to toggle between Dark and Light mode. Your preference is saved automatically.

---

## Chat

The Chat view is where you interact with Flox to run tasks.

### Starting a Task

1. Select or create a conversation in the left sidebar.
2. Type your instruction in the text box at the bottom.
3. Press **Enter** or click the **Send** button.

### Writing Good Prompts

Flox works best when your instructions are specific:

| Less effective | More effective |
|---|---|
| "Search something" | "Search Amazon for 'noise cancelling headphones' and list the top 5 results with prices" |
| "Check my email" | "Open Gmail and list the subject lines of my 5 most recent unread emails" |
| "Fill out the form" | "On the contact form at example.com, enter 'John Smith' in the name field, 'john@example.com' in email, and 'Hello' in the message, then submit" |

### Choosing a Browser

Before sending your message, use the **Browser Selector** dropdown to choose which browser Flox should use. The dropdown lists all detected browsers on your system. If the list is empty, go to Settings and click **Detect Browsers**.

### Watching Flox Work

Once you send a task, the **Agent Status Bar** appears above the message input and shows:

- Which agent is currently active (Planner / Navigator / Verifier)
- A progress indicator while the agent is thinking
- A step counter showing how many steps have been taken

Below each assistant message, screenshots from the Navigator are embedded so you can see exactly what the browser looks like at each step.

### Stopping a Task

Click the **Stop** button (square icon) in the agent status bar to immediately halt the current task. The browser session stays open so you can inspect the result.

### Human-in-the-Loop Approvals

By default, Flox asks for your approval before performing risky actions. A modal popup will appear describing the proposed action:

> *"Navigator wants to: click element matching 'button[type=submit]' (Submit Order)"*

- **Allow** — Flox proceeds with the action
- **Deny** — The action is skipped; Flox will try an alternative

You have **120 seconds** to respond before the action automatically times out (treated as a Deny). This timeout is fixed and cannot be changed in Settings.

> You can change how approvals work in Settings → Behavior → **Approval Mode**. Options are:
> - `all` — Approve every risky action (default, safest)
> - `auto` — The Verifier decides; only uncertain or destructive actions reach you
> - `none` — All actions proceed automatically (use with care)

### Conversation History

Previous conversations are listed in the left sidebar under the Chat icon. Click any conversation to reopen it and see the full message history including screenshots.

To start a fresh conversation, click the **+** icon at the top of the conversation list.

To delete a conversation, hover over it and click the trash icon.

---

## Automations

Automations let you schedule tasks that Flox runs automatically on a repeating timer.

### Creating an Automation

1. Click the **Automations** tab in the sidebar.
2. Click **New Automation**.
3. Fill in the form:
   - **Name** — A descriptive label (e.g. "Morning News Summary")
   - **Prompt** — The task instruction, same as you'd type in Chat
   - **Interval** — How often to run (e.g. every 60 minutes)
   - **Browser** — Which browser to use (or "default")
4. Click **Save**.

### Managing Automations

Each automation card shows:
- Name and prompt preview
- Interval
- Last run time and result (success / failure / not yet run)
- Enabled/disabled toggle

**Enable/Disable**: Use the toggle switch on the automation card to start or stop scheduling without deleting it.

**Run Now**: Click the ▶ button on a card to trigger the automation immediately, regardless of its schedule.

**Edit**: Click the pencil icon to modify the name, prompt, interval, or browser.

**Delete**: Click the trash icon. The automation and its logs are permanently removed.

### Automation Logs

Each automation run is logged. Click the **Logs** button on an automation card to see a history of:
- Timestamp
- Status (success / failed / in progress)
- Summary of what was done
- Per-step details

You can clear logs for an automation from the same panel.

### Background Execution

Automations run in the background even when the main Flox window is minimized. Flox stays resident in the **system tray** to keep the scheduler alive.

When an automation needs human approval (e.g. before submitting a form), Flox sends an **OS notification**. Click the notification to bring the Flox window to the front and respond.

> **Tip:** For fully unattended automations, set Approval Mode to `none` in Settings → Behavior, or enable **Headless Mode** to run without a visible browser window.

---

## Skills

Skills are extensions that customize how Flox behaves on specific websites or for specific types of tasks.

### What Skills Do

A skill can:
- Inject extra instructions into the Planner's prompt for a given domain (e.g. "When on GitHub, always use the API rather than the UI")
- Inject context into the Navigator (e.g. "On Shopify stores, the checkout button is always inside `#checkout-btn`")
- Declare permissions (e.g. "this skill is allowed to read account information")

### Installing Skills

1. Go to the **Skills** tab.
2. Click **Install from URL** and paste a skill registry URL, or browse available skills if a registry is configured.
3. Click **Install**.

### Creating a Custom Skill

1. Click **Create Skill**.
2. Fill in the fields:
   - **Name** — Display name
   - **Description** — What the skill does
   - **Triggers** — Domains (e.g. `github.com`, `*.shopify.com`) or keywords that activate this skill
   - **Planner Prompt** — Extra instructions for the Planner agent
   - **Navigator Prompt** — Extra instructions for the Navigator agent
   - **Permissions** — Declare what the skill is allowed to do
3. Click **Save**.

### Enabling and Disabling Skills

Each skill has a toggle on its card. Disabled skills are ignored by the agents even if their trigger matches.

---

## Activity Logs

The Activity view shows a real-time feed of every action taken by the agents.

### What's Shown

Each entry includes:
- **Timestamp**
- **Agent** (Planner, Navigator, or Verifier)
- **Action type** (navigate, click, type, scroll, screenshot, etc.)
- **Details** (e.g. the URL navigated to, the selector clicked)
- **Screenshot** (if enabled) — a thumbnail of the browser at that moment

### Filtering

Use the filter controls at the top of the Logs view to filter by:
- Agent (Planner / Navigator / Verifier / All)
- Time range
- Automation or Chat task

### Clearing Logs

Click **Clear Logs** to remove all activity entries. This does not affect conversation history or automation logs.

---

## Settings

Access Settings by clicking the ⚙️ gear icon in the sidebar.

Settings are organized into tabs:

### Browsers

- **Detect Browsers** — Scans your system for installed Chromium-based browsers
- **Default Browser** — Select which browser to use when no specific browser is chosen in Chat
- **Headless Mode** — When enabled, browsers open without a visible window (useful for background automations)

### Models

Configure the AI model for each of the three agents. Each agent can use a **different provider, model, and API key** — mix and match freely:

| Setting | Description |
|---|---|
| **Provider** | OpenAI / Anthropic / Google Gemini / Groq / Cerebras / Cohere / Mistral / Together AI / OpenRouter / Perplexity / Ollama / Custom |
| **Model** | The specific model name (e.g. `gpt-4o`, `gemini-2.0-flash`, `llama-3.3-70b-versatile`) |
| **API Key** | Your API key for this provider |
| **Base URL** | API endpoint (auto-filled for known providers; override for custom/self-hosted setups) |
| **Temperature** | Creativity level (0 = deterministic, 1 = creative). Lower is better for automation |
| **Max Tokens** | Maximum response length for this agent |
| **Vision Mode** | Send a screenshot of the page to this model (requires a vision-capable model) |

> **Vision Mode**: When enabled for an agent, Flox sends a screenshot of the current browser state alongside each request. This lets vision-capable models (e.g. GPT-4o, Gemini 1.5 Pro, LLaVA) see the page visually rather than relying only on the DOM. If Vision Mode is off, Flox extracts structured page text instead.

See [Configuration](configuration.md) for a full breakdown of supported providers and recommended settings.

### Behavior

| Setting | Default | Description |
|---|---|---|
| **Approval Mode** | `all` | When to ask for human approval: `all`, `auto`, or `none` |
| **Max Steps** | 50 | Maximum browser actions per task before stopping |
| **Timeout** | 300s | Maximum time in seconds for a single task |
| **Enable Screenshots** | On | Capture screenshots during navigation |
| **Auto-Retry** | Off | Automatically retry failed steps with an alternative strategy |

---

## System Tray

Flox minimizes to the system tray rather than closing when you click the window's close button. This keeps the automation scheduler running.

### Tray Menu

Right-click the Flox tray icon to access:
- **Show Flox** — Bring the main window to the front
- **Quit** — Fully exit Flox and stop all automations

### Notifications

When a background automation needs your approval, Flox sends an OS notification:
- **Windows**: Appears in the notification center (bottom-right)
- **macOS**: Appears via the Notification Center
- **Linux**: Appears via the desktop notification daemon (requires `libnotify`)

Click the notification to open Flox and respond to the approval request.

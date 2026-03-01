# Flox - AI Browser Automation

> The most powerful and configurable desktop-based browser AI automation tool.

Flox is a cross-platform, open-source desktop application built with **Tauri** (Rust) and **React/TypeScript** that lets you automate browser tasks using AI. Configure your own LLM keys (BYOK) and models (BYOM), chat with the AI to run browser tasks, or schedule recurring automations that run in the background.

---

## ✨ Features

### 🤖 Three-Agent AI System
- **Planner Agent** — Breaks down your goal into a step-by-step browser automation plan
- **Navigator Agent** — Executes actions in the browser (click, type, scroll, navigate, etc.) with optional screenshot vision
- **Verifier Agent** — Validates each action for safety and correctness before execution

### 🌐 Browser Detection & Management
- Automatically detects installed Chromium-based browsers: **Google Chrome**, **Microsoft Edge**, **Brave**, **Vivaldi**, **Chromium**
- Select which browser to use per task
- Optional **headless mode** for background execution

### 🛠️ Browser Automation Tools (via CDP)
- Navigate to URLs
- Click elements by CSS selector or coordinates
- Type text into inputs
- Scroll pages
- Press keyboard keys
- Execute JavaScript
- Capture screenshots

### 🔑 Bring Your Own Keys & Models (BYOK/BYOM)
- **OpenAI** (GPT-4o, GPT-4o mini, etc.)
- **Anthropic** (Claude 3.5 Sonnet, etc.)
- **Groq** (Llama, Mixtral)
- **Ollama** (local models)
- **Any OpenAI-compatible API** (custom base URL)
- Configure separate models for each agent

### ⏰ Scheduled Automations
- Create named automations with custom prompts
- Set custom intervals (minutes to hours)
- Enable/disable automations independently
- Run immediately or wait for schedule
- App lives in the **system tray** and restarts automations on wake

### 🎨 Modern UI/UX
- **Dark & Light mode** toggle
- **Poppins** font
- Rounded corners, minimalistic design
- Conversation history sidebar
- Real-time agent activity logs with screenshots

---

## 🚀 Getting Started

### Prerequisites
- [Node.js 18+](https://nodejs.org/)
- [Rust 1.70+](https://rustup.rs/)
- A Chromium-based browser installed

### Development

```bash
# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Build

```bash
# Build for production
npm run tauri build
```

---

## ⚙️ Configuration

Open **Settings** in the app to configure:

1. **Browser** — Auto-detect installed browsers, select preferred browser
2. **Planner Agent** — Model for high-level planning (recommended: GPT-4o or Claude 3.5 Sonnet)
3. **Navigator Agent** — Model for browser navigation, needs vision support (recommended: GPT-4o)
4. **Verifier Agent** — Model for action validation (recommended: GPT-4o mini)
5. **Behavior** — Max steps, timeout, screenshot mode

---

## 🏗️ Architecture

```
flox/
├── src/                    # React/TypeScript frontend
│   ├── components/
│   │   ├── chat/           # Chat interface, browser selector, agent status
│   │   ├── settings/       # Model config, browser settings
│   │   ├── automations/    # Scheduled automation management
│   │   ├── logs/           # Real-time activity logs
│   │   └── ui/             # Reusable UI components
│   ├── store.ts            # Zustand state management
│   └── types.ts            # TypeScript type definitions
└── src-tauri/              # Rust/Tauri backend
    └── src/
        ├── browser.rs      # Browser detection + CDP automation
        ├── agents.rs       # Three-agent LLM orchestration
        ├── automation.rs   # Scheduled automation engine
        └── settings.rs     # Persistent settings store
```

---

## 📝 License

MIT License — see [LICENSE](LICENSE)

# Flox — AI Browser Automation

<p align="center">
  <strong>The most powerful and configurable desktop-based AI browser automation tool.</strong><br>
  Open-source · Cross-platform · Bring Your Own Keys
</p>

---

Flox is a desktop application that lets you automate anything in your browser using AI. Just tell it what you want in plain English — "fill out this form", "check my emails and summarize them", "monitor this page and alert me when prices drop" — and Flox's three-agent AI system takes care of the rest.

Built with [Tauri](https://tauri.app/) (Rust) and React/TypeScript, Flox runs natively on **Windows**, **macOS**, and **Linux**. You bring your own API keys (BYOK) and models (BYOM), so your data never passes through any Flox servers.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 **Three-Agent AI** | Planner, Navigator, and Verifier agents work together to safely execute browser tasks |
| 🌐 **Browser Detection** | Auto-detects Chrome, Edge, Brave, Vivaldi, and Chromium |
| 🛡️ **Human-in-the-Loop** | You approve risky actions before they execute — always in control |
| 🔑 **BYOK / BYOM** | OpenAI, Anthropic, Groq, Ollama, or any OpenAI-compatible API |
| ⏰ **Scheduled Automations** | Set recurring tasks that run on a schedule, even while minimized to tray |
| 🧩 **Skills System** | Domain/keyword-triggered extensions that customize agent behavior |
| 🔐 **Secrets Library** | Store passwords, API keys, and tokens locally; agents reference them by name — values are never sent to any LLM |
| 💬 **Conversation History** | Full chat history with screenshots of every agent action |
| 🌙 **Dark & Light Mode** | Comfortable UI for any environment |

---

## 🚀 Quick Start

### Download

Download the latest release for your platform from the [Releases](https://github.com/1-kabir/flox/releases) page.

### Build from Source

> Requires [Node.js 18+](https://nodejs.org/) and [Rust stable](https://rustup.rs/).

```bash
git clone https://github.com/1-kabir/flox
cd flox
npm install
npm run tauri build
```

The installer is placed in `src-tauri/target/release/bundle/`.

**Linux** also requires webkit2gtk:

```bash
sudo apt-get install -y \
  libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev \
  librsvg2-dev patchelf libssl-dev
```

---

## ⚙️ First-Time Setup

1. Launch Flox — the onboarding wizard appears automatically.
2. Open **Settings** and add your API key for at least one provider (e.g. OpenAI).
3. Assign a model to each agent: **Planner**, **Navigator**, **Verifier**.
4. Click **Detect Browsers** — Flox will find your installed Chrome/Edge/Brave.
5. Return to the **Chat** tab and type your first task.

Recommended models:
- **Planner**: `gpt-4o` or `claude-3-5-sonnet`
- **Navigator**: `gpt-4o` (vision recommended)
- **Verifier**: `gpt-4o-mini`

---

## 🏗️ Architecture Overview

```
flox/
├── src/                        # React + TypeScript frontend
│   ├── components/
│   │   ├── chat/               # Chat UI, browser selector, agent status bar
│   │   ├── automations/        # Scheduled automation management
│   │   ├── skills/             # Skills management UI
│   │   ├── settings/           # Model & behavior configuration
│   │   ├── activity/           # Real-time agent activity logs
│   │   └── ui/                 # Shared UI components
│   ├── store.ts                # Zustand global state
│   └── types.ts                # TypeScript type definitions
└── src-tauri/                  # Rust / Tauri backend
    └── src/
        ├── agents.rs           # Three-agent LLM orchestration + HIL approval
        ├── browser.rs          # Browser detection + CDP automation
        ├── automation.rs       # Scheduled automation scheduler
        ├── skills.rs           # Skill registry & injection
        ├── conversations.rs    # Chat history persistence
        ├── settings.rs         # App configuration store
        └── db.rs               # SQLite database (WAL mode)
```

---

## 📖 Documentation

Full documentation lives in the **[docs/](docs/)** directory:

| Document | Audience | Description |
|---|---|---|
| [Getting Started](docs/getting-started.md) | Everyone | Installation, setup, and your first automation |
| [User Guide](docs/user-guide.md) | Users | Complete walkthrough of all features |
| [Configuration](docs/configuration.md) | Users | Settings, models, and behavior options |
| [Automations](docs/automations.md) | Users | Scheduling and managing recurring tasks |
| [Skills](docs/skills.md) | Users / Developers | Extending Flox with custom skills |
| [Architecture](docs/architecture.md) | Developers | System design, data flow, and modules |
| [Development Guide](docs/development.md) | Contributors | Dev setup, conventions, and contribution workflow |
| [API Reference](docs/api-reference.md) | Developers | All Tauri backend commands documented |
| [Troubleshooting](docs/troubleshooting.md) | Everyone | Solutions to common problems |

---

## 🤝 Contributing

Contributions are welcome! See the [Development Guide](docs/development.md) for setup instructions, coding conventions, and how to submit a pull request.

---

## 📝 License

GNU General Public License v3.0 — see [LICENSE](LICENSE)

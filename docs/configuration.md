# Configuration Reference

This document describes every setting available in Flox, what it does, and the recommended values for common use cases.

---

## Table of Contents

1. [Where Settings Are Stored](#where-settings-are-stored)
2. [Provider & API Keys](#provider--api-keys)
3. [Agent Model Configuration](#agent-model-configuration)
4. [Behavior Settings](#behavior-settings)
5. [Browser Settings](#browser-settings)
6. [Recommended Configurations](#recommended-configurations)
7. [Resetting to Defaults](#resetting-to-defaults)

---

## Where Settings Are Stored

Flox stores all settings in a local SQLite database. **Nothing is ever sent to Flox servers.** Your API keys remain on your machine.

| Platform | Database location |
|---|---|
| **Linux** | `~/.local/share/flox/flox.db` |
| **macOS** | `~/Library/Application Support/flox/flox.db` |
| **Windows** | `%APPDATA%\flox\flox.db` |

To reset all settings to factory defaults, quit Flox and delete (or rename) `flox.db`. Flox will create a fresh database on next launch.

---

## Provider & API Keys

Flox supports the following AI providers. You can mix and match — for example, use OpenAI for the Planner and Groq for the Verifier.

### OpenAI

- **Provider name**: `openai`
- **Base URL**: `https://api.openai.com/v1` (auto-filled)
- **How to get a key**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Supported models**: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`, and all other chat completion models

### Anthropic

- **Provider name**: `anthropic`
- **Base URL**: `https://api.anthropic.com/v1` (auto-filled)
- **How to get a key**: [console.anthropic.com](https://console.anthropic.com/)
- **Supported models**: `claude-3-5-sonnet-latest`, `claude-3-haiku-20240307`, and all other current models

> **Note:** Flox calls Anthropic's API via an OpenAI-compatible adapter. Make sure to use the correct model names as listed in the Anthropic console.

### Groq

- **Provider name**: `groq`
- **Base URL**: `https://api.groq.com/openai/v1` (auto-filled)
- **How to get a key**: [console.groq.com](https://console.groq.com/)
- **Supported models**: `llama3-70b-8192`, `llama3-8b-8192`, `mixtral-8x7b-32768`, and others
- **Free tier**: Yes — rate limits apply

### Ollama (Local)

- **Provider name**: `ollama`
- **Base URL**: `http://localhost:11434/v1` (default)
- **How to set up**: Install [Ollama](https://ollama.ai/) and run `ollama pull llama3`
- **Supported models**: Any model you have pulled locally (e.g. `llama3`, `mistral`, `phi3`)
- **Cost**: Free — runs entirely on your machine
- **Privacy**: Maximum — no data leaves your computer

> **Tip:** Ollama models vary in quality. `llama3` (8B) is a good starting point. For best results, use `llama3:70b` if your hardware supports it.

### Custom OpenAI-Compatible API

If you use a self-hosted LLM server (e.g. LM Studio, LocalAI, OpenRouter) or an enterprise deployment:

- Set **Provider** to `openai`
- Set **Base URL** to your custom endpoint (e.g. `http://localhost:1234/v1` for LM Studio)
- Set **API Key** to whatever credential your server requires (can be a dummy value for local setups)
- Set **Model** to the model name your server expects

---

## Agent Model Configuration

Each of Flox's three agents has its own model configuration. This lets you optimize cost vs. quality.

### Planner Agent

The Planner reads your instruction and creates a step-by-step plan for the Navigator to follow.

| Setting | Recommended value | Notes |
|---|---|---|
| **Model** | `gpt-4o` or `claude-3-5-sonnet-latest` | Needs strong reasoning for complex tasks |
| **Temperature** | `0.7` | Some creativity helps with planning |
| **Max Tokens** | `2048` | Plans can be verbose |
| **Enable Vision** | Optional | Planner rarely needs screenshots |

### Navigator Agent

The Navigator executes actions in the browser: navigating to URLs, clicking elements, typing text, scrolling, and running JavaScript.

| Setting | Recommended value | Notes |
|---|---|---|
| **Model** | `gpt-4o` | Vision is highly recommended for reliable element selection |
| **Temperature** | `0.3` | Low temperature for precise, deterministic actions |
| **Max Tokens** | `1024` | Actions are short; doesn't need many tokens |
| **Enable Vision** | **Yes** (strongly recommended) | Lets the Navigator see the page and pick correct elements |

> **Without vision**, the Navigator relies solely on the page's DOM structure. With vision, it can see the page visually and make more reliable decisions about which element to click. Vision increases cost but substantially improves accuracy.

### Verifier Agent

The Verifier checks each proposed action for safety and correctness before it is executed.

| Setting | Recommended value | Notes |
|---|---|---|
| **Model** | `gpt-4o-mini` or `llama3-8b` | Simple yes/no decisions; smaller model is sufficient |
| **Temperature** | `0.1` | Near-deterministic for consistent safety checks |
| **Max Tokens** | `512` | Short verification responses |
| **Enable Vision** | No | Usually not needed for verification |

---

## Behavior Settings

### Approval Mode

Controls when Flox asks for your permission before executing an action.

| Value | Behavior | Best for |
|---|---|---|
| `all` | Asks approval for every action flagged as risky | First-time use, sensitive tasks |
| `auto` | Verifier decides; only truly uncertain/destructive actions reach you | Regular use |
| `none` | All actions proceed without approval | Trusted automations, headless/background tasks |

**What counts as "risky"?**
- Navigating to URLs containing keywords like `checkout`, `payment`, `delete`, `account`
- Clicking buttons with labels like "Delete", "Submit", "Purchase", "Confirm"
- Executing JavaScript on the page

### Max Steps

The maximum number of browser actions Flox will take for a single task before stopping.

- **Default**: `50`
- **Range**: `1–200`
- Increasing this lets Flox handle more complex tasks but may lead to runaway loops if something goes wrong.

### Timeout

The maximum number of seconds Flox will spend on a single task.

- **Default**: `300` (5 minutes)
- **Range**: `30–3600`
- If a task is taking longer than expected, Flox stops and reports a timeout error.

### Enable Screenshots

When enabled, the Navigator captures a screenshot of the browser after each action. Screenshots are:
- Embedded in the chat message thread
- Stored in the SQLite database
- Shown in the Activity Logs view

Disabling screenshots reduces storage usage and slightly speeds up tasks.

- **Default**: Enabled

### Auto-Retry

When enabled, if the Navigator fails to complete an action (e.g. a selector doesn't match), it will automatically retry with an alternative approach before asking for help or stopping.

- **Default**: Disabled
- Enabling this can make tasks more robust but may also allow the agent to "get stuck" retrying.

---

## Browser Settings

### Detecting Browsers

Flox scans the following locations for Chromium-based browsers:

| Browser | Windows | macOS | Linux |
|---|---|---|---|
| Google Chrome | Registry + Program Files | `/Applications/Google Chrome.app` | `/usr/bin/google-chrome`, `~/.local/bin/` |
| Microsoft Edge | Registry + Program Files | `/Applications/Microsoft Edge.app` | `/usr/bin/microsoft-edge` |
| Brave | Registry + Program Files | `/Applications/Brave Browser.app` | `/usr/bin/brave-browser` |
| Vivaldi | Registry + Program Files | `/Applications/Vivaldi.app` | `/usr/bin/vivaldi` |
| Chromium | — | — | `/usr/bin/chromium-browser` |

If your browser is installed in a non-standard location, it will not be auto-detected. As a workaround, you can create a symlink from the expected path to your actual installation.

### Headless Mode

When headless mode is enabled, browsers launched by Flox open without a visible window.

- **Default**: Disabled
- **Useful for**: Background automations where you don't want a browser window appearing
- **Note**: Headless mode may behave differently on some websites that detect headless browsers

---

## Recommended Configurations

### Minimal / Free (Groq + Local Browser)

Best for: Getting started, light tasks, budget-conscious users.

| Agent | Provider | Model | Temperature |
|---|---|---|---|
| Planner | Groq | `llama3-70b-8192` | 0.7 |
| Navigator | Groq | `llama3-70b-8192` | 0.3 |
| Verifier | Groq | `llama3-8b-8192` | 0.1 |

### Balanced (OpenAI — moderate cost)

Best for: Most users, good accuracy at reasonable cost.

| Agent | Provider | Model | Temperature |
|---|---|---|---|
| Planner | OpenAI | `gpt-4o` | 0.7 |
| Navigator | OpenAI | `gpt-4o` (vision on) | 0.3 |
| Verifier | OpenAI | `gpt-4o-mini` | 0.1 |

### Maximum Quality (OpenAI + Anthropic)

Best for: Complex multi-step tasks where accuracy is critical.

| Agent | Provider | Model | Temperature |
|---|---|---|---|
| Planner | Anthropic | `claude-3-5-sonnet-latest` | 0.7 |
| Navigator | OpenAI | `gpt-4o` (vision on) | 0.3 |
| Verifier | OpenAI | `gpt-4o-mini` | 0.1 |

### Privacy-First (Ollama, fully local)

Best for: Users who want complete privacy; no data leaves your machine.

| Agent | Provider | Model | Temperature |
|---|---|---|---|
| Planner | Ollama | `llama3:70b` | 0.7 |
| Navigator | Ollama | `llava` (multimodal) | 0.3 |
| Verifier | Ollama | `llama3` | 0.1 |

> Note: Local models are slower and less accurate than cloud models, especially for complex web tasks.

---

## Resetting to Defaults

To reset all settings (including API keys, agent configuration, and behavior):

1. Quit Flox completely (right-click the tray icon → **Quit**).
2. Navigate to the database location for your platform (see [Where Settings Are Stored](#where-settings-are-stored)).
3. Delete or rename `flox.db`.
4. Relaunch Flox — the onboarding wizard will appear again.

> **Warning:** Deleting `flox.db` also removes all conversation history, automations, and skills. Back it up first if you want to preserve those.

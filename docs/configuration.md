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

Flox uses the OpenAI-compatible chat completions API format, which means **any provider that exposes an OpenAI-compatible endpoint will work**. You can mix and match providers across agents — for example, use Gemini for the Planner, Groq for the Verifier, and a local Ollama model for the Navigator.

Each agent (Planner, Navigator, Verifier) has its own independent model configuration: provider, model name, API key, base URL, temperature, max tokens, and vision toggle.

### OpenAI

- **Provider name**: `openai`
- **Default Base URL**: `https://api.openai.com/v1` (auto-filled)
- **How to get a key**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Suggested models**: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`, `o1`, `o1-mini`
- **Vision-capable models**: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`

### Anthropic

- **Provider name**: `anthropic`
- **Default Base URL**: `https://api.anthropic.com/v1` (auto-filled)
- **How to get a key**: [console.anthropic.com](https://console.anthropic.com/)
- **Suggested models**: `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`, `claude-3-opus-20240229`

> **Note:** Flox calls Anthropic's API via an OpenAI-compatible adapter. Make sure to use the correct model names as listed in the Anthropic console.

### Google Gemini

- **Provider name**: `gemini`
- **Default Base URL**: `https://generativelanguage.googleapis.com/v1beta/openai` (auto-filled)
- **How to get a key**: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- **Suggested models**: `gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-1.5-pro`, `gemini-1.5-flash`
- **Vision-capable models**: `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash`

> **Note:** Google's OpenAI-compatible endpoint is currently at `/v1beta/openai`. This is the officially documented path as of 2025. If Google promotes it to `/v1`, update the Base URL field accordingly.

### Groq

- **Provider name**: `groq`
- **Default Base URL**: `https://api.groq.com/openai/v1` (auto-filled)
- **How to get a key**: [console.groq.com](https://console.groq.com/)
- **Suggested models**: `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `mixtral-8x7b-32768`, `llama-3.2-11b-vision-preview`
- **Free tier**: Yes — rate limits apply

### Cerebras

- **Provider name**: `cerebras`
- **Default Base URL**: `https://api.cerebras.ai/v1` (auto-filled)
- **How to get a key**: [cloud.cerebras.ai](https://cloud.cerebras.ai/)
- **Suggested models**: `llama3.1-8b`, `llama3.1-70b`, `llama3.3-70b`
- **Strengths**: Extremely low latency inference

### Cohere

- **Provider name**: `cohere`
- **Default Base URL**: `https://api.cohere.com/compatibility/v1` (auto-filled)
- **How to get a key**: [dashboard.cohere.com/api-keys](https://dashboard.cohere.com/api-keys)
- **Suggested models**: `command-r-plus`, `command-r`, `command`

### Mistral

- **Provider name**: `mistral`
- **Default Base URL**: `https://api.mistral.ai/v1` (auto-filled)
- **How to get a key**: [console.mistral.ai](https://console.mistral.ai/)
- **Suggested models**: `mistral-large-latest`, `mistral-small-latest`, `codestral-latest`, `open-mistral-7b`

### Together AI

- **Provider name**: `together`
- **Default Base URL**: `https://api.together.xyz/v1` (auto-filled)
- **How to get a key**: [api.together.ai/settings/api-keys](https://api.together.ai/settings/api-keys)
- **Suggested models**: `meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo`, `mistralai/Mixtral-8x7B-Instruct-v0.1`

### OpenRouter

- **Provider name**: `openrouter`
- **Default Base URL**: `https://openrouter.ai/api/v1` (auto-filled)
- **How to get a key**: [openrouter.ai/keys](https://openrouter.ai/keys)
- **Supported models**: Any model available on OpenRouter (use the provider/model format, e.g. `openai/gpt-4o`, `anthropic/claude-3-5-sonnet`)
- **Strengths**: Single API key to access hundreds of models from every major provider

### Perplexity

- **Provider name**: `perplexity`
- **Default Base URL**: `https://api.perplexity.ai` (auto-filled)
- **How to get a key**: [perplexity.ai/settings/api](https://perplexity.ai/settings/api)
- **Suggested models**: `sonar-pro`, `sonar`, `sonar-deep-research`

### Ollama (Local)

- **Provider name**: `ollama`
- **Default Base URL**: `http://localhost:11434/v1` (auto-filled)
- **How to set up**: Install [Ollama](https://ollama.ai/) and run `ollama pull llama3.2`
- **Suggested models**: `llama3.2`, `llava` (vision), `qwen2.5`, `mistral`, `phi3`
- **Vision-capable models**: `llava`, `llava-llama3`, `llama3.2-vision`
- **Cost**: Free — runs entirely on your machine
- **Privacy**: Maximum — no data leaves your computer

> **Tip:** For vision tasks with Ollama, use `llava` or `llama3.2-vision`.

### Custom (OpenAI-compatible)

For any other provider or self-hosted server (LM Studio, LocalAI, vLLM, etc.):

- Set **Provider** to `custom`
- Set **Base URL** to your custom endpoint (e.g. `http://localhost:1234/v1` for LM Studio)
- Set **API Key** to whatever credential your server requires (can be a dummy value for local setups)
- Set **Model** to the model name your server expects

---

## Agent Model Configuration

Each of Flox's three agents has its own independent model configuration. This lets you optimize cost vs. quality and mix providers freely.

### Planner Agent

The Planner reads your instruction and creates a step-by-step plan for the Navigator to follow.

| Setting | Recommended value | Notes |
|---|---|---|
| **Provider** | Any | Needs strong reasoning for complex tasks |
| **Model** | `gpt-4o`, `claude-3-5-sonnet-20241022`, `gemini-2.0-flash` | |
| **Temperature** | `0.7` | Some creativity helps with planning |
| **Max Tokens** | `2048` | Plans can be verbose |
| **Vision Mode** | Off | Planner rarely needs screenshots |

### Navigator Agent

The Navigator executes actions in the browser: navigating to URLs, clicking elements, typing text, scrolling, and running JavaScript.

| Setting | Recommended value | Notes |
|---|---|---|
| **Provider** | Any (vision-capable preferred) | |
| **Model** | `gpt-4o`, `gemini-1.5-pro`, `llava` (Ollama) | Use a vision-capable model when Vision Mode is on |
| **Temperature** | `0.3` | Low temperature for precise, deterministic actions |
| **Max Tokens** | `1024` | Actions are short; doesn't need many tokens |
| **Vision Mode** | **On** (strongly recommended) | Lets the Navigator see the page and pick correct elements |

> **Without vision**, the Navigator relies solely on the page's DOM structure. With vision enabled, it sends a screenshot with each request so it can see the page visually. Vision increases cost but substantially improves accuracy. The model you select must support vision/multimodal input.

### Verifier Agent

The Verifier checks each proposed action for safety and correctness before it is executed.

| Setting | Recommended value | Notes |
|---|---|---|
| **Provider** | Any | Simple yes/no decisions; smaller/cheaper model is fine |
| **Model** | `gpt-4o-mini`, `llama-3.1-8b-instant`, `gemini-2.0-flash-lite` | |
| **Temperature** | `0.1` | Near-deterministic for consistent safety checks |
| **Max Tokens** | `512` | Short verification responses |
| **Vision Mode** | Off | Usually not needed for verification |

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

| Agent | Provider | Model | Vision | Temperature |
|---|---|---|---|---|
| Planner | Groq | `llama-3.3-70b-versatile` | Off | 0.7 |
| Navigator | Groq | `llama-3.2-11b-vision-preview` | On | 0.3 |
| Verifier | Groq | `llama-3.1-8b-instant` | Off | 0.1 |

### Balanced (OpenAI — moderate cost)

Best for: Most users, good accuracy at reasonable cost.

| Agent | Provider | Model | Vision | Temperature |
|---|---|---|---|---|
| Planner | OpenAI | `gpt-4o` | Off | 0.7 |
| Navigator | OpenAI | `gpt-4o` | **On** | 0.3 |
| Verifier | OpenAI | `gpt-4o-mini` | Off | 0.1 |

### Maximum Quality (OpenAI + Anthropic)

Best for: Complex multi-step tasks where accuracy is critical.

| Agent | Provider | Model | Vision | Temperature |
|---|---|---|---|---|
| Planner | Anthropic | `claude-3-5-sonnet-20241022` | Off | 0.7 |
| Navigator | OpenAI | `gpt-4o` | **On** | 0.3 |
| Verifier | OpenAI | `gpt-4o-mini` | Off | 0.1 |

### Google Gemini

Best for: Users who prefer Google's ecosystem.

| Agent | Provider | Model | Vision | Temperature |
|---|---|---|---|---|
| Planner | Gemini | `gemini-2.0-flash` | Off | 0.7 |
| Navigator | Gemini | `gemini-2.0-flash` | **On** | 0.3 |
| Verifier | Gemini | `gemini-2.0-flash-lite` | Off | 0.1 |

### Privacy-First (Ollama, fully local)

Best for: Users who want complete privacy; no data leaves your machine.

| Agent | Provider | Model | Vision | Temperature |
|---|---|---|---|---|
| Planner | Ollama | `llama3.2` | Off | 0.7 |
| Navigator | Ollama | `llava` | **On** | 0.3 |
| Verifier | Ollama | `llama3.2` | Off | 0.1 |

> Note: Local models are slower and less accurate than cloud models, especially for complex web tasks.

### Mixed Providers (Cost-Optimized)

Best for: Power users who want the best of each provider at minimum cost.

| Agent | Provider | Model | Vision | Temperature |
|---|---|---|---|---|
| Planner | Mistral | `mistral-large-latest` | Off | 0.7 |
| Navigator | OpenAI | `gpt-4o-mini` | **On** | 0.3 |
| Verifier | Cerebras | `llama3.1-8b` | Off | 0.1 |

---

## Resetting to Defaults

To reset all settings (including API keys, agent configuration, and behavior):

1. Quit Flox completely (right-click the tray icon → **Quit**).
2. Navigate to the database location for your platform (see [Where Settings Are Stored](#where-settings-are-stored)).
3. Delete or rename `flox.db`.
4. Relaunch Flox — the onboarding wizard will appear again.

> **Warning:** Deleting `flox.db` also removes all conversation history, automations, and skills. Back it up first if you want to preserve those.


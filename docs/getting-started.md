# Getting Started with Flox

This guide walks you through installing Flox, completing first-time setup, and running your very first browser automation — no coding required.

---

## Table of Contents

1. [What is Flox?](#what-is-flox)
2. [System Requirements](#system-requirements)
3. [Installation](#installation)
4. [First-Time Setup (Onboarding)](#first-time-setup-onboarding)
5. [Running Your First Automation](#running-your-first-automation)
6. [What's Next?](#whats-next)

---

## What is Flox?

Flox is a desktop application that automates your web browser using AI. Instead of clicking through the same steps over and over, you describe what you want in plain English and Flox does it for you.

**Example tasks you can give Flox:**
- *"Go to weather.com and tell me tomorrow's forecast for New York"*
- *"Log into my GitHub account and list my open pull requests"*
- *"Search Amazon for wireless headphones under $50 and show me the top 3 results"*
- *"Every morning at 9 AM, open my email and summarize unread messages"*

Flox uses a **three-agent AI system** — a Planner that creates a step-by-step plan, a Navigator that clicks and types in your browser, and a Verifier that checks each action before it happens. You stay in control at all times.

---

## System Requirements

### Supported Operating Systems
- **Windows** 10 or 11 (x86_64)
- **macOS** 12 Monterey or later (Intel or Apple Silicon)
- **Linux** (Ubuntu 20.04+, Debian 11+, or equivalent)

### Required Software
- A **Chromium-based browser** installed on your computer (any of these will work):
  - Google Chrome
  - Microsoft Edge
  - Brave Browser
  - Vivaldi
  - Chromium

### API Key
Flox uses AI language models to understand your instructions. You need an API key from at least one of the supported providers:

| Provider | Free Tier | Models |
|---|---|---|
| [OpenAI](https://platform.openai.com/api-keys) | No (paid usage) | GPT-4o, GPT-4o mini |
| [Anthropic](https://console.anthropic.com/) | No (paid usage) | Claude 3.5 Sonnet |
| [Groq](https://console.groq.com/) | Yes (rate-limited) | Llama 3, Mixtral |

> **What does "rate-limited" mean?** Groq's free tier allows a limited number of requests per minute and per day. For most users trying out Flox, this is plenty. If you hit the limit, you'll see a "Rate limit exceeded" error — just wait a minute before trying again.
| [Ollama](https://ollama.ai/) | Yes (local, free) | Llama 3, Mistral, and more |

> **Tip for beginners:** Groq has a free tier and is a good way to try Flox without a credit card. Ollama runs models entirely on your machine — completely free and private.

---

## Installation

### Option A: Download a Pre-Built Release (Recommended)

1. Visit the [Releases page](https://github.com/1-kabir/flox/releases).
2. Download the installer for your operating system:
   - **Windows**: `.msi` or `.exe` installer
   - **macOS**: `.dmg` disk image
   - **Linux**: `.AppImage`, `.deb`, or `.rpm` package
3. Run the installer and follow the on-screen prompts.

> **macOS note:** On first launch, macOS may show a security warning. Go to **System Settings → Privacy & Security** and click **Open Anyway** to allow Flox to run.

> **Linux note:** For AppImage, make the file executable first: `chmod +x Flox_*.AppImage` then run it.

### Option B: Build from Source

If you prefer to build Flox yourself, see the [Development Guide](development.md#building-for-production).

---

## First-Time Setup (Onboarding)

When you launch Flox for the first time, an onboarding wizard guides you through initial configuration.

### Step 1: Add an API Key

1. In the onboarding screen, select your AI provider (e.g. **OpenAI**).
2. Paste your API key into the key field.
3. Click **Save**.

Your API key is stored locally on your computer in Flox's database. It is never sent to any Flox servers.

### Step 2: Assign Models to Agents

Flox uses three AI agents, each with a specific role. You need to assign a model to each:

| Agent | Role | Recommended Model |
|---|---|---|
| **Planner** | Creates a step-by-step plan for your task | `gpt-4o` or `claude-3-5-sonnet` |
| **Navigator** | Clicks, types, and navigates in your browser | `gpt-4o` (vision helps here) |
| **Verifier** | Checks each action for safety | `gpt-4o-mini` (cheaper, fast) |

You can use the same model for all three, or different models for each. Using a smaller model for the Verifier saves cost.

### Step 3: Connect a Browser

1. Click **Detect Browsers** — Flox will scan your system for installed Chromium-based browsers.
2. If a browser is found, it will appear in the list. Select the one you want Flox to use.
3. If nothing is detected, make sure Chrome, Edge, Brave, Vivaldi, or Chromium is installed, then click **Detect Browsers** again.

### Step 4: Done!

Click **Complete Setup**. You're ready to go.

> You can always revisit these settings later by clicking the **Settings** tab (gear icon) in the sidebar.

---

## Running Your First Automation

### Chat Interface

1. Click the **Chat** tab in the left sidebar (speech bubble icon).
2. Type a task in the message box at the bottom. Start simple:
   ```
   Go to example.com and tell me the title of the page.
   ```
3. Press **Enter** or click the send button.
4. Flox opens a browser window and starts working. You can watch it in real time.

### What you'll see

While Flox is working, you'll see:
- **Agent Status Bar** — Shows which agent is active (Planner → Navigator → Verifier)
- **Step-by-step log** — Each action is listed as it happens (navigate, click, type, etc.)
- **Screenshots** — Optional visual snapshots of the browser at each step

### Approval prompts

If Flox is about to do something that could have unintended consequences (like clicking a "Delete" or "Submit" button), it will pause and ask for your approval:

> *"The Navigator wants to click 'Submit Order'. Allow?"*

You can click **Allow** or **Deny**. Denied actions are skipped and Flox tries an alternative approach.

### When the task is complete

Flox will show a summary of what it did. The conversation is saved automatically — you can scroll back to see previous sessions in the left sidebar.

---

## What's Next?

Now that you've run your first automation, explore more of what Flox can do:

- **[User Guide](user-guide.md)** — Learn about every feature in depth
- **[Automations](automations.md)** — Schedule tasks to run automatically on a timer
- **[Skills](skills.md)** — Install skills to improve Flox's performance on specific websites
- **[Configuration](configuration.md)** — Fine-tune model settings, enable headless mode, and more

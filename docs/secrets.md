# Secrets

Flox includes a local secrets library that lets you store sensitive values — API keys, passwords, usernames, tokens, and any other credentials — securely on your device.  Agents **never** see the actual values; they reference secrets by name using a `{{placeholder}}` syntax. The real value is substituted immediately before a browser action executes, entirely inside the local Rust runtime.

---

## Table of Contents

1. [Overview](#overview)
2. [Adding a Secret](#adding-a-secret)
3. [Using Secrets in Tasks](#using-secrets-in-tasks)
4. [Editing & Deleting Secrets](#editing--deleting-secrets)
5. [Security Model](#security-model)
6. [Naming Conventions](#naming-conventions)
7. [FAQ](#faq)

---

## Overview

| Concept | Detail |
|---|---|
| **Storage** | SQLite database in your app data directory (`flox.db`) |
| **Visibility** | Agents only see the secret _name_ — never the value |
| **Substitution** | Happens in the Rust backend, just before the CDP browser action runs |
| **Transmission** | Secret values are **never** sent to any LLM API |

---

## Adding a Secret

1. Open the **Secrets** tab (key icon 🔑 in the sidebar).
2. Click **Add Secret**.
3. Fill in:
   - **Name** – A short, snake_case identifier used as the placeholder, e.g. `github_api_key`.
   - **Description** _(optional)_ – A human-readable note, e.g. "Personal GitHub PAT with `repo` scope".
   - **Value** – The actual secret. Masked by default; click the eye icon to reveal.
4. Click **Add Secret** to save.

The secret is immediately available as `{{github_api_key}}` in any task or automation.

---

## Using Secrets in Tasks

Reference a secret anywhere you would type a sensitive value by using double curly braces around its name:

```
{{secret_name}}
```

### Example — Chat task

```
Log in to https://github.com with the username "johndoe" and password {{github_password}}
```

### Example — Automation prompt

```
Open https://api.example.com/dashboard and paste the API key {{example_api_key}} into the token field, then click Save.
```

### How it works end-to-end

1. The Planner receives a list of your secret **names** (not values) in its system prompt so it knows which placeholders are available.
2. The Navigator's system prompt also lists the available placeholders with usage examples.
3. When the Navigator decides to type a value, it emits an action such as:
   ```json
   {"action_type": "type", "selector": "#password", "value": "{{github_password}}"}
   ```
4. Before the action is dispatched to the browser via CDP, Flox resolves every `{{placeholder}}` with the stored value.
5. The browser receives the real password — the LLM only ever saw the placeholder name.

---

## Editing & Deleting Secrets

### Edit

1. Click **Edit** on any secret card.
2. Modify the name, description, or value.
3. Leave **Value** blank to keep the existing stored value unchanged.
4. Click **Save Changes**.

### Delete

1. Click **Delete** on the secret card.
2. Confirm deletion when prompted.

> ⚠️ Deletion is permanent. Any tasks or automations that reference the deleted placeholder will have their `{{placeholder}}` text typed literally into the browser (the substitution simply won't occur).

---

## Security Model

- **Local-only storage**: Secrets are stored in `flox.db` inside your OS app-data directory. They never leave your device through Flox.
- **No LLM exposure**: The LLM receives only the placeholder name (e.g. `{{my_password}}`). The actual value is substituted by the Rust runtime just before the CDP `Input.insertText` command is sent to the browser.
- **No network transmission**: Because Flox is a BYOK (bring your own keys) desktop app, no data passes through any Flox servers.
- **Database encryption**: The current implementation stores values as plaintext in SQLite. For production use, consider using OS-level disk encryption (e.g. FileVault, BitLocker, LUKS).
- **Approval flow**: If a task types a secret value into a sensitive field, the action still goes through the normal HIL (human-in-the-loop) approval flow based on your settings.

---

## Naming Conventions

| Convention | Example |
|---|---|
| Snake case, lowercase | `github_api_key` |
| Descriptive prefix | `openai_api_key`, `twitter_password` |
| No spaces or special characters | ✅ `my_api_key` · ❌ `my api key` |

Names are case-sensitive. `{{Github_Token}}` and `{{github_token}}` are different secrets.

---

## FAQ

**Can agents print/log the secret value?**  
No. The agent only knows the placeholder name. The value is inserted at the CDP layer, after the LLM response has been parsed. There is no way for the LLM output to contain the actual value.

**What if I use a placeholder that doesn't exist?**  
The literal text `{{unknown_placeholder}}` will be typed into the browser. No error is thrown — check the agent action log if a login or API call fails unexpectedly.

**Can I use secrets in Skill prompts?**  
Not directly — skill prompts are injected into the LLM's system message, so any `{{placeholder}}` would be visible to the model. Use secrets only in task instructions or automation prompts where the substitution happens at execution time.

**Are secrets backed up?**  
Secrets are part of `flox.db`. Back up this file to preserve them. The location is:
- **macOS**: `~/Library/Application Support/app.flox/flox.db`
- **Windows**: `%APPDATA%\app.flox\flox.db`
- **Linux**: `~/.local/share/app.flox/flox.db`

# Skills

Skills are extensions that enhance Flox's ability to work with specific websites or domains. They inject additional context and instructions into the AI agents, helping them navigate specialized interfaces more reliably.

---

## Table of Contents

1. [What Are Skills?](#what-are-skills)
2. [How Skills Work](#how-skills-work)
3. [Installing Skills](#installing-skills)
4. [Managing Skills](#managing-skills)
5. [Creating a Custom Skill](#creating-a-custom-skill)
6. [Skill Schema Reference](#skill-schema-reference)
7. [Sharing Skills](#sharing-skills)
8. [Security Considerations](#security-considerations)

---

## What Are Skills?

By default, Flox's agents have no prior knowledge of specific websites. When you ask Flox to do something on GitHub, it reads the page like a first-time visitor and figures out what to click.

Skills give the agents a head start. A **GitHub skill**, for example, might tell the Planner:
> *"GitHub uses a sidebar navigation. Pull requests are found under the 'Pull requests' tab. The main action button is usually in the top-right of the page."*

This reduces the number of steps needed, avoids common mistakes, and improves reliability on sites with unusual layouts.

---

## How Skills Work

### Trigger matching

Each skill specifies when it should activate:

- **Domain triggers**: The skill activates when the browser is on a matching domain.
  - Examples: `github.com`, `*.shopify.com`, `mail.google.com`
  - Supports wildcard `*` for subdomains
- **Keyword triggers**: The skill activates when your prompt contains matching words.
  - Examples: `["checkout", "purchase"]` would activate on shopping-related tasks

### Prompt injection

When a skill is triggered:
1. Its **Planner Prompt** is appended to the system prompt for the Planner agent
2. Its **Navigator Prompt** is appended to the system prompt for the Navigator agent

This happens automatically — you don't need to mention the skill in your task.

### Permissions

Skills can declare permissions that indicate what they are allowed to do. These are informational and help you understand the scope of a skill before installing it.

---

## Installing Skills

### From a URL

1. Go to the **Skills** tab (🧩 icon) in the sidebar.
2. Click **Install from URL**.
3. Paste the URL of a skill manifest file (a JSON file following the [skill schema](#skill-schema-reference)).
4. Click **Install**.

Flox downloads the skill definition, validates it, and adds it to your skills list.

### From a Registry

If a community skill registry is configured in Settings, you can browse available skills and install them with one click. (Registry feature availability depends on your Flox version.)

---

## Managing Skills

### The Skills List

Each skill is displayed as a card showing:
- **Name** and description
- **Trigger domains and/or keywords**
- **Enabled/Disabled toggle**
- **Edit** and **Uninstall** buttons

### Enabling and Disabling

Use the toggle switch on each skill card to enable or disable it:
- **Enabled**: The skill will inject its prompts when its triggers match
- **Disabled**: The skill is ignored even if the trigger matches

Disabling is useful for temporarily turning off a skill without uninstalling it.

### Editing a Skill

Click **Edit** to modify any field of a skill you created. Skills installed from URLs can be edited locally — your changes won't affect the original source.

### Uninstalling a Skill

Click **Uninstall** on the skill card. The skill is permanently removed from your Flox installation.

---

## Creating a Custom Skill

You can create skills tailored to websites or tasks you use frequently.

### Steps

1. Go to the **Skills** tab.
2. Click **Create Skill**.
3. Fill in the form fields (described in the [schema reference](#skill-schema-reference) below).
4. Click **Save**.

### Example: A skill for a company intranet

Suppose your company's intranet at `intranet.example.com` uses a non-standard navigation layout. You could create a skill like this:

**Name**: Example Corp Intranet  
**Description**: Helps navigate the Example Corp internal portal  
**Domain Triggers**: `intranet.example.com`  
**Planner Prompt**:
```
The intranet portal has a top navigation bar. The main sections are:
- HR Portal: /hr
- IT Helpdesk: /it/tickets
- Document Library: /docs
- Employee Directory: /directory
Navigation items may be hidden behind a hamburger menu on smaller viewports.
```
**Navigator Prompt**:
```
On intranet.example.com:
- The search box has ID "global-search"
- Submit buttons use class "btn-primary"
- Forms require clicking "Save Draft" before "Submit"
- Session timeout warning appears after 15 minutes of inactivity
```

---

## Skill Schema Reference

A skill is a JSON object with the following fields:

```json
{
  "id": "unique-skill-id",
  "name": "Human-readable skill name",
  "description": "What this skill does and when it activates",
  "version": "1.0.0",
  "author": "Your name or organization",
  "triggers": {
    "domains": ["github.com", "*.github.com"],
    "keywords": ["pull request", "github", "repository"]
  },
  "planner_prompt": "Instructions injected into the Planner agent's system prompt when this skill is active.",
  "navigator_prompt": "Instructions injected into the Navigator agent's system prompt when this skill is active.",
  "permissions": [
    "read:page_content",
    "write:form_input",
    "navigate:authenticated_pages"
  ],
  "enabled": true
}
```

### Field Descriptions

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Unique identifier (lowercase letters, hyphens, numbers) |
| `name` | string | Yes | Display name shown in the Skills UI |
| `description` | string | Yes | Human-readable description of what the skill does |
| `version` | string | No | Semantic version (e.g. `"1.0.0"`) |
| `author` | string | No | Skill author name |
| `triggers.domains` | string[] | No | Domains that activate this skill. Supports `*` wildcards for subdomains |
| `triggers.keywords` | string[] | No | Keywords in the user prompt that activate this skill |
| `planner_prompt` | string | No | Text appended to the Planner's system prompt when triggered |
| `navigator_prompt` | string | No | Text appended to the Navigator's system prompt when triggered |
| `permissions` | string[] | No | Declared permission strings (informational) |
| `enabled` | boolean | No | Default enabled state when installed. Defaults to `true` |

At least one of `triggers.domains` or `triggers.keywords` must be provided.

### Domain Trigger Syntax

| Pattern | Matches |
|---|---|
| `github.com` | Exactly `github.com` (no subdomains) |
| `*.github.com` | All subdomains: `gist.github.com`, `api.github.com`, etc. |
| `github.com/*` | Any path on `github.com` (same as `github.com`) |

> **Tip:** Combine both triggers for maximum coverage. For example, a GitHub skill might have `domains: ["github.com", "*.github.com"]` and `keywords: ["github", "pull request", "repository", "commit"]`.

### Permissions Reference

Permissions are informational strings that tell users what the skill might allow the agents to do. Flox does not currently enforce permissions programmatically — they are a transparency mechanism.

Suggested conventions:
- `read:page_content` — Reads text and structure from pages
- `write:form_input` — Types into form fields
- `navigate:authenticated_pages` — Navigates pages that require login
- `execute:javascript` — May execute JavaScript on the page
- `click:destructive_actions` — May click actions like Delete, Submit, or Checkout

---

## Sharing Skills

To share a skill with others, export it as a JSON file following the schema above and host it at a publicly accessible URL. Other users can then install it using **Install from URL**.

You can also contribute skills to a community registry if one is maintained for your Flox version.

---

## Security Considerations

Skills inject text into AI agent prompts. Before installing a skill from an external source:

1. **Review the prompt content** — Check `planner_prompt` and `navigator_prompt` for anything suspicious or misleading.
2. **Check the trigger scope** — A skill with `domains: ["*"]` would activate on every website. Be cautious with overly broad triggers.
3. **Review declared permissions** — If a skill declares `execute:javascript` or `click:destructive_actions` but you're just using it for reading pages, that's a red flag.
4. **Only install from trusted sources** — Prefer well-known community sources or create your own skills.

Skills cannot directly access your API keys, conversation history, or local files — they can only influence what the agents do via prompt injection. However, a malicious skill could attempt to manipulate agent behavior in unintended ways (prompt injection attack). Always inspect skills before installing them.

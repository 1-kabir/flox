# Development Guide

This guide covers everything you need to set up a development environment for Flox, understand the project conventions, run the test suite, and submit a pull request.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Setting Up the Development Environment](#setting-up-the-development-environment)
3. [Project Structure](#project-structure)
4. [Running the App in Development Mode](#running-the-app-in-development-mode)
5. [Frontend Development](#frontend-development)
6. [Backend (Rust) Development](#backend-rust-development)
7. [Building for Production](#building-for-production)
8. [Code Style & Conventions](#code-style--conventions)
9. [Testing](#testing)
10. [CI/CD Pipeline](#cicd-pipeline)
11. [Contributing a Change](#contributing-a-change)
12. [Adding a New Feature](#adding-a-new-feature)

---

## Prerequisites

| Tool | Minimum Version | Installation |
|---|---|---|
| **Node.js** | 18 LTS | [nodejs.org](https://nodejs.org/) |
| **npm** | 9+ | Comes with Node.js |
| **Rust** (stable) | 1.70+ | See [rustup.rs](https://rustup.rs/) — run the installer script shown there |
| **A Chromium browser** | Any | Chrome, Edge, Brave, Vivaldi, or Chromium |

### Linux Additional Dependencies

```bash
sudo apt-get update
sudo apt-get install -y \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libssl-dev \
  libglib2.0-dev
```

### Windows Additional Dependencies

- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) — Already installed on Windows 11; download the Evergreen Bootstrapper for Windows 10.
- [OpenSSL for Windows](https://slproweb.com/products/Win32OpenSSL.html) — If you encounter OpenSSL build errors, set `OPENSSL_DIR` to your installation path.
- [Build Tools for Visual Studio](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) — Rust needs the MSVC linker.

### macOS Additional Dependencies

No extra dependencies. WebKit is bundled with macOS. Xcode command line tools are required (`xcode-select --install`).

---

## Setting Up the Development Environment

```bash
# 1. Clone the repository
git clone https://github.com/1-kabir/flox
cd flox

# 2. Install JavaScript dependencies
npm install

# 3. Verify the Rust toolchain is installed
rustup show

# 4. Verify the build compiles (Rust only, no WebView needed)
cd src-tauri
cargo check
cd ..
```

That's it — no separate database setup, no environment variables required for development.

---

## Project Structure

```
flox/
├── src/                   # TypeScript / React frontend
│   ├── App.tsx            # Root component; initialization, event listeners
│   ├── store.ts           # Zustand global state
│   ├── types.ts           # Shared TypeScript interfaces & types
│   ├── lib/utils.ts       # cn(), generateId(), formatRelativeTime()
│   ├── components/
│   │   ├── chat/          # ChatView, MessageBubble, AgentStatusBar, etc.
│   │   ├── automations/   # AutomationsView, AutomationCard, AutomationForm
│   │   ├── skills/        # SkillsView, CreateSkillModal
│   │   ├── settings/      # SettingsView (models, behavior, browsers)
│   │   ├── activity/      # LogsView
│   │   ├── onboarding/    # OnboardingView (first-run wizard)
│   │   └── ui/            # Button, Input, Select, Toggle, Badge, Toast
│   └── index.css
├── src-tauri/src/
│   ├── lib.rs             # Tauri setup + command registry
│   ├── agents.rs          # LLM orchestration, HIL approval
│   ├── browser.rs         # Browser detection + CDP
│   ├── automation.rs      # Scheduler
│   ├── skills.rs          # Skill storage + trigger matching
│   ├── conversations.rs   # Message persistence
│   ├── settings.rs        # Settings key-value store
│   ├── db.rs              # SQLite schema + connection
│   └── network.rs         # Connectivity check
├── docs/                  # Documentation (you are here)
├── .github/workflows/     # CI and packaging pipelines
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## Running the App in Development Mode

```bash
npm run tauri dev
```

This command:
1. Starts the **Vite dev server** on `localhost:1420`
2. Compiles the **Rust backend** (first run takes 1–3 minutes)
3. Opens the **Tauri window** pointing at the Vite dev server

**Hot reload:**
- Frontend changes (TypeScript/React/CSS) → instant hot reload, no restart needed
- Rust backend changes → automatic recompile and restart of the Tauri process

**Frontend-only mode** (no Tauri, runs in a regular browser tab):

```bash
npm run dev
```

Most UI work can be done in this mode. Tauri API calls (`invoke`, `listen`) will fail since there's no backend, but you can mock them for isolated UI development.

---

## Frontend Development

### Stack

- **React 19** with functional components and hooks
- **TypeScript** (strict mode)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin — no `tailwind.config.js` needed
- **Zustand v5** for global state
- **Lucide React** for icons

### Styling Conventions

- Use **Tailwind utility classes** for all styling. Avoid CSS modules or `style={}` props.
- Use the `cn()` helper from `src/lib/utils.ts` for conditional class merging (wraps `clsx` + `tailwind-merge`).

```tsx
import { cn } from "../lib/utils";

<div className={cn("base-class", isActive && "active-class", className)} />
```

- Component variants should use `className` props so callers can override.
- Dark mode is handled via Tailwind's `dark:` prefix. The root `<html>` element gets a `dark` class when dark mode is active.

### Adding a New UI Component

1. Create `src/components/ui/MyComponent.tsx`
2. Follow the pattern of existing components: accept standard HTML props via `React.HTMLAttributes<T>`, forward `className`, use `cn()`.

```tsx
import { cn } from "../../lib/utils";

interface MyComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "primary";
}

export function MyComponent({ variant = "default", className, children, ...props }: MyComponentProps) {
  return (
    <div
      className={cn(
        "base styles",
        variant === "primary" && "primary styles",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
```

### Adding State to the Store

1. Open `src/store.ts`
2. Add your new state fields and actions to the appropriate slice (or create a new slice)
3. Export types from `src/types.ts` if new data structures are needed

### Calling a Tauri Command from the Frontend

```typescript
import { invoke } from "@tauri-apps/api/core";
import type { MyReturnType } from "../types";

// Always handle errors
try {
  const result = await invoke<MyReturnType>("my_command", { param: value });
} catch (error) {
  console.error("Command failed:", error);
}
```

---

## Backend (Rust) Development

### Checking for Errors

```bash
cd src-tauri
cargo check
```

This compiles without producing a binary and is much faster than a full build. Use this for rapid iteration.

### Linting

```bash
cd src-tauri
cargo clippy -- -D warnings
```

Clippy is run with `-D warnings` in CI, meaning all warnings are treated as errors. Fix all clippy suggestions before submitting a PR.

**Common clippy requirements in this codebase:**
- Use `arr.first()` instead of `arr.get(0)`
- Use `&[T]` instead of `&mut Vec<T>` for function parameters that don't need mutation
- Use `unwrap_or` instead of `unwrap_or_else` for non-lazy (non-closure) defaults
- Use `str::strip_prefix` instead of manual index slicing

### Running Rust Tests

```bash
cd src-tauri
cargo test
```

### Adding a New Tauri Command

1. Add the async function to the appropriate module (e.g. `agents.rs`, `browser.rs`):

```rust
#[tauri::command]
pub async fn my_new_command(
    app: tauri::AppHandle,
    param: String,
) -> Result<MyReturnType, String> {
    // Implementation
    Ok(result)
}
```

2. Register it in `lib.rs` inside `tauri::Builder::invoke_handler()`:

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    my_module::my_new_command,
])
```

3. Add the TypeScript call in the frontend:

```typescript
const result = await invoke<MyReturnType>("my_new_command", { param: "value" });
```

4. Document it in [api-reference.md](api-reference.md).

### Adding a New Event (Backend → Frontend)

1. Emit from Rust:

```rust
app.emit("my_event", &MyPayload { field: value })?;
```

2. Ensure `MyPayload` derives `serde::Serialize`:

```rust
#[derive(serde::Serialize, Clone)]
pub struct MyPayload {
    pub field: String,
}
```

3. Listen in the frontend:

```typescript
import { listen } from "@tauri-apps/api/event";

const unlisten = await listen<MyPayload>("my_event", (event) => {
    // handle event.payload
});

// Cleanup on component unmount:
return () => { unlisten(); };
```

### Database Migrations

The database schema is defined in `db.rs` in the `initialize_database()` function using `CREATE TABLE IF NOT EXISTS`. To add a new table:

1. Add a `CREATE TABLE IF NOT EXISTS my_table (...)` statement to `initialize_database()`
2. For changes to existing tables, add a migration using `ALTER TABLE` with `IF NOT EXISTS` guards or a versioned migration system

---

## Building for Production

### Current Platform

```bash
npm run tauri build
```

Output goes to `src-tauri/target/release/bundle/`:
- **Linux**: `.deb`, `.rpm`, `.AppImage`
- **macOS**: `.dmg`, `.app`
- **Windows**: `.msi`, `.exe`

### Frontend Only

```bash
npm run build
```

Output: `dist/` directory (Vite production build with TypeScript checking)

### CI Multi-Platform Build

The GitHub Actions workflow in `.github/workflows/package.yml` builds for all platforms when a `v*` tag is pushed:

```bash
git tag v1.2.3
git push origin v1.2.3
```

---

## Code Style & Conventions

### TypeScript / React

- Use **functional components** with hooks; no class components
- Use **explicit return types** for all exported functions
- Prefer `const` over `let`; avoid `var`
- Use **named exports** (not default exports) for components
- Keep component files focused: one component per file (small helpers are okay in the same file)
- ESLint is configured in `eslint.config.js` — run `npm run lint` before committing

### Rust

- Follow standard Rust naming: `snake_case` for functions/variables, `CamelCase` for types, `SCREAMING_SNAKE_CASE` for constants
- Use `anyhow` or return `Result<T, String>` for Tauri commands (the frontend receives the error string)
- Prefer `async/await` over manual `Future` chaining
- Use `tokio::sync::Mutex` (not `std::sync::Mutex`) for async contexts
- All public types that cross the IPC boundary must derive `serde::Serialize` + `serde::Deserialize`
- Zero clippy warnings: run `cargo clippy -- -D warnings` before committing

### Git Commit Messages

- Use the imperative mood: *"Add skill toggle endpoint"*, not *"Added"* or *"Adds"*
- Keep the subject line under 72 characters
- Reference issue numbers where applicable: *"Fix browser detection on macOS (#42)"*

---

## Testing

### Rust Unit Tests

Place tests in the same file as the code under test using an inline `#[cfg(test)]` module:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_something() {
        assert_eq!(my_function("input"), "expected");
    }

    #[tokio::test]
    async fn test_async_something() {
        let result = my_async_function().await;
        assert!(result.is_ok());
    }
}
```

Run: `cd src-tauri && cargo test`

### Frontend Testing

No frontend test framework is currently configured. If adding one, Vitest is recommended as it integrates natively with Vite.

### Manual Testing Checklist

Before submitting a PR, verify:

- [ ] `npm run lint` passes (no ESLint errors)
- [ ] `npm run build` completes successfully
- [ ] `cd src-tauri && cargo check` passes
- [ ] `cd src-tauri && cargo clippy -- -D warnings` passes
- [ ] `cd src-tauri && cargo test` passes
- [ ] App runs with `npm run tauri dev` without console errors
- [ ] Changed functionality works as expected in the app

---

## CI/CD Pipeline

### CI (`.github/workflows/ci.yml`)

Triggered on: push to `main` or `copilot/**`, PRs to `main`

**Jobs:**
1. **Frontend**: `npm ci` → `npm run lint` → `npm run build`
2. **Rust**: `cargo check` → `cargo clippy -- -D warnings` → `cargo test`

All CI jobs must pass before a PR can be merged.

### Packaging (`.github/workflows/package.yml`)

Triggered on: git tags matching `v*`, or manually via workflow_dispatch

Builds installers for:
- Linux x86_64 (Ubuntu)
- macOS x86_64
- macOS aarch64 (Apple Silicon)
- Windows x86_64

Artifacts are uploaded to the GitHub Release for the tag.

---

## Contributing a Change

### Workflow

1. **Fork** the repository on GitHub
2. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/my-feature-name
   ```
3. **Make your changes** following the conventions above
4. **Test locally**: lint, build, and manual testing
5. **Push** your branch and open a **Pull Request** against `main`
6. Fill in the PR description with:
   - What change you made and why
   - How to test it
   - Screenshots if the change affects the UI

### PR Requirements

- All CI checks must pass
- At least a brief description of the change
- No unrelated changes (keep PRs focused)
- If adding a new user-visible feature, update the relevant documentation in `docs/`

---

## Adding a New Feature

Here's a worked example of how to add a feature that spans both frontend and backend.

### Example: Add a "Copy to Clipboard" button for agent responses

**Backend** (if needed): No backend change needed for this feature.

**Frontend changes:**

1. **Update the component** (`src/components/chat/MessageBubble.tsx`):
   - Add a copy button that calls `navigator.clipboard.writeText(message.content)`
   - Show a checkmark icon briefly after copying

2. **Add types** if new data structures are needed (`src/types.ts`) — not needed here.

3. **Update state** if the feature requires state (`src/store.ts`) — not needed here.

4. **Test**: Run `npm run tauri dev` and verify copying works in the UI.

5. **Lint**: `npm run lint`

6. **Update docs**: If the feature is user-facing, add a note to [user-guide.md](user-guide.md).

### Example: Add a new browser action (CDP command)

**Backend changes:**

1. Add the action handler to `browser.rs`:
```rust
"my_action" => {
    // CDP command implementation
}
```

2. Add the action type to the `Action` enum in `browser.rs` and its serialization.

3. Add a Tauri command in `lib.rs` if the frontend needs to call it directly.

**Frontend changes:**

1. Add the action type to `src/types.ts`.
2. Add the `invoke` call wherever the action is triggered.
3. Update the activity log display in `LogsView` to handle the new action type.

**Docs**: Add the new Tauri command to [api-reference.md](api-reference.md).

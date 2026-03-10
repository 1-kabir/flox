# Troubleshooting

This guide covers the most common problems users encounter with Flox, along with step-by-step solutions. If your issue is not listed here, please [open an issue](https://github.com/1-kabir/flox/issues) on GitHub.

---

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Browser Not Detected](#browser-not-detected)
3. [App Won't Start / Crashes on Launch](#app-wont-start--crashes-on-launch)
4. [Agent Tasks Failing](#agent-tasks-failing)
5. [API Key Issues](#api-key-issues)
6. [Automations Not Running](#automations-not-running)
7. [UI / Display Issues](#ui--display-issues)
8. [Database Issues](#database-issues)
9. [Build Errors (for Developers)](#build-errors-for-developers)
10. [Platform-Specific Issues](#platform-specific-issues)
11. [Diagnostic Information](#diagnostic-information)

---

## Installation Issues

### macOS: "Flox is damaged and can't be opened"

This happens because Flox is not yet code-signed with an Apple Developer certificate.

**Fix:**
```bash
xattr -cr /Applications/Flox.app
```
Then try opening Flox again. If the error persists:

1. Open **System Settings** → **Privacy & Security**
2. Scroll down to the Security section
3. Click **Open Anyway** next to the Flox warning

### macOS: "Flox can't be opened because Apple cannot check it for malicious software"

This is a Gatekeeper warning for unsigned apps.

**Fix:**
1. Right-click (or Control-click) the Flox app icon
2. Select **Open** from the context menu
3. Click **Open** in the dialog

You only need to do this once.

### Windows: "Windows protected your PC"

Windows Defender SmartScreen may block unsigned executables.

**Fix:**
1. Click **More info** in the SmartScreen dialog
2. Click **Run anyway**

### Linux: AppImage won't run

**Fix:**
```bash
# Make the file executable
chmod +x Flox_*.AppImage

# Run it
./Flox_*.AppImage

# If FUSE is not available (e.g. in containers):
./Flox_*.AppImage --appimage-extract-and-run
```

### Linux: Missing library errors

If Flox fails to launch with errors about missing `.so` files:

```bash
sudo apt-get install -y \
  libgtk-3-0 \
  libwebkit2gtk-4.1-0 \
  libappindicator3-1 \
  libssl3
```

---

## Browser Not Detected

### Symptoms
- The browser selector in Chat shows "No browsers detected"
- Settings → Browsers shows an empty list
- Flox warns that no browser was found

### Solutions

**Step 1: Click "Detect Browsers"**

In Settings → Browsers, click the **Detect Browsers** button. Flox will re-scan your system.

**Step 2: Verify a supported browser is installed**

Flox supports Chromium-based browsers only:
- Google Chrome
- Microsoft Edge
- Brave Browser
- Vivaldi
- Chromium

Firefox, Safari, and other browsers are **not** supported.

**Step 3: Check non-standard install locations**

Flox scans well-known installation paths. If your browser is installed elsewhere:

- **Linux**: Create a symlink at a standard location:
  ```bash
  sudo ln -s /path/to/your/chrome /usr/bin/google-chrome
  ```
- **Windows**: Ensure the browser is in `Program Files` or `Program Files (x86)`, or was installed per-user in `%LOCALAPPDATA%`
- **macOS**: The browser `.app` should be in `/Applications`

**Step 4: Check browser version**

Very old browser versions may not support the required CDP features. Update to the latest version of your browser.

---

## App Won't Start / Crashes on Launch

### Blank white window on Linux

This is usually a WebKit/WebView issue.

**Fix:**
```bash
# Install WebKit dependencies
sudo apt-get install -y libwebkit2gtk-4.1-0

# If using an older Ubuntu/Debian, you may need:
sudo apt-get install -y libwebkit2gtk-4.0-dev
```

For Wayland users, try setting the environment variable:
```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 ./Flox
```

### App crashes immediately on Windows

Check if WebView2 is installed:
1. Open **Settings** → **Apps** → **Installed apps**
2. Search for "WebView2"
3. If not found, download from [Microsoft's WebView2 page](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

### Database corruption on launch

If Flox fails to start with an error about the database:

```bash
# Back up and remove the database (Linux)
mv ~/.local/share/flox/flox.db ~/.local/share/flox/flox.db.backup

# macOS
mv ~/Library/Application\ Support/flox/flox.db ~/Library/Application\ Support/flox/flox.db.backup

# Windows (PowerShell)
Move-Item "$env:APPDATA\flox\flox.db" "$env:APPDATA\flox\flox.db.backup"
```

Relaunch Flox — it will create a fresh database.

---

## Agent Tasks Failing

### "Task timed out"

The task exceeded the configured timeout (default: 300 seconds).

**Solutions:**
- Increase the timeout in Settings → Behavior → **Timeout**
- Break your task into smaller, more specific sub-tasks
- Check if the target website is slow or unresponsive

### "Max steps reached"

The agent used all allowed steps without completing the task.

**Solutions:**
- Increase max steps in Settings → Behavior → **Max Steps** (up to 200)
- Simplify your task prompt to be more specific
- Enable **Auto-Retry** in Settings → Behavior to allow the agent to try alternative approaches

### "Browser session lost"

The browser process was closed or crashed during a task.

**Solutions:**
1. Click **Detect Browsers** in Settings to re-verify the browser
2. Restart the task — a new browser session will be launched
3. If it keeps crashing, try a different browser

### Agent keeps clicking the wrong element

Without vision, the Navigator relies purely on DOM selectors and may pick incorrect elements on complex layouts.

**Fix:** Enable **Vision** for the Navigator agent in Settings → Models → Navigator → **Enable Vision**.

If vision is already enabled, the model may be struggling with the layout. Try:
- Using a more capable model (e.g. `gpt-4o` instead of `gpt-4o-mini`)
- Adding a skill for that website that provides layout hints

### Task completes but nothing happened

The agent may have completed successfully but targeted the wrong page or element.

**Steps to diagnose:**
1. Open the **Activity** tab and expand the logs for the failed task
2. Look at the screenshots to see what the browser looked like at each step
3. Check if the agent navigated to the correct URL
4. If the wrong elements were clicked, consider writing a skill with more specific instructions

---

## API Key Issues

### "Authentication failed" / "Invalid API key"

The API key you entered is invalid or expired.

**Solutions:**
- Double-check the key was copied correctly (no leading/trailing spaces)
- Verify the key is active in your provider dashboard:
  - OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
  - Anthropic: [console.anthropic.com](https://console.anthropic.com/)
  - Groq: [console.groq.com/keys](https://console.groq.com/keys)
- Generate a new key if the old one may have been revoked

### "Quota exceeded" / "Rate limit"

You've exceeded your usage quota or hit the rate limit for your plan.

**Solutions:**
- Wait a few minutes and retry (rate limits reset periodically)
- Check your usage in your provider's dashboard
- Upgrade your plan or add billing information
- Switch to a different provider temporarily (e.g. Groq has a free tier)

### "Model not found"

The model name you entered doesn't exist or is not available on your account.

**Solutions:**
- Check the exact model name in your provider's documentation
- Ensure your account has access to that model (some GPT-4 models require a paid tier)
- Try a model you know exists (e.g. `gpt-3.5-turbo` for OpenAI)

### Ollama connection refused

Flox cannot connect to the local Ollama server.

**Solutions:**
1. Check that Ollama is running: `ollama list`
2. Start Ollama if it's not: `ollama serve`
3. Verify the base URL in Settings is `http://localhost:11434/v1`
4. Check if Ollama is listening on a different port: `curl http://localhost:11434/api/tags`
5. Ensure you've pulled at least one model: `ollama pull llama3`

---

## Automations Not Running

### Automation is enabled but never runs

**Check:**
1. Is Flox running? Automations only run while Flox is open (even minimized to tray).
2. Is the automation actually enabled (green toggle)?
3. Is the interval set correctly? A 1440-minute interval means once per day.
4. Check the automation logs — is there a `failed` status with an error?

### Automation ran but shows "failed"

Open the automation's logs and expand the latest failed run:
- If the error is API-related, check your API key and network connection
- If the browser failed to launch, check the browser detection section above
- If the task timed out, increase the timeout in Settings

### OS notifications not appearing for approval requests

**Linux:**
```bash
# Install libnotify
sudo apt-get install -y libnotify-bin

# Test notifications
notify-send "Test" "This is a test notification"
```

**macOS:** Check **System Settings** → **Notifications** → ensure Flox has permission to send notifications.

**Windows:** Check **Settings** → **System** → **Notifications** → ensure Flox is allowed to send notifications.

---

## UI / Display Issues

### App appears very small / DPI scaling issues

This is a known issue with Tauri on some high-DPI displays.

**Linux fix:**
```bash
GDK_SCALE=2 ./Flox
```

**Windows fix:** Right-click the Flox executable → Properties → Compatibility → Change high DPI settings → Override high DPI scaling behavior → Application.

### Text is blurry

Usually a font rendering issue with WebView.

**Fix (Linux):**
```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 ./Flox
```

### Dark/Light mode not saving

If the theme resets on every launch:
1. Check that the app has write access to its data directory:
   - Linux: `ls -la ~/.local/share/flox/`
   - macOS: `ls -la ~/Library/Application\ Support/flox/`
2. The theme is stored in the SQLite database. If the database is read-only, settings won't persist.

---

## Database Issues

### Finding the Database File

| Platform | Path |
|---|---|
| Linux | `~/.local/share/flox/flox.db` |
| macOS | `~/Library/Application Support/flox/flox.db` |
| Windows | `%APPDATA%\flox\flox.db` |

### Viewing the Database

You can inspect the database with any SQLite viewer:

```bash
# Command line
sqlite3 ~/.local/share/flox/flox.db

# Show all tables
.tables

# View settings
SELECT * FROM settings;

# View automations
SELECT id, json_extract(data, '$.name') as name FROM automations;
```

GUI tools: [DB Browser for SQLite](https://sqlitebrowser.org/), [TablePlus](https://tableplus.com/)

### Resetting to Factory Defaults

> **Warning:** This permanently deletes all conversations, automations, skills, and settings.

1. Quit Flox completely (right-click tray icon → **Quit**)
2. Delete the database file:
   ```bash
   # Linux
   rm ~/.local/share/flox/flox.db
   
   # macOS
   rm ~/Library/Application\ Support/flox/flox.db
   
   # Windows (PowerShell)
   Remove-Item "$env:APPDATA\flox\flox.db"
   ```
3. Relaunch Flox

---

## Build Errors (for Developers)

### `glib-2.0 not found` / `webkit2gtk not found`

```bash
sudo apt-get install -y \
  libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev \
  librsvg2-dev patchelf libssl-dev libglib2.0-dev
```

### `OpenSSL not found` (Windows)

1. Download and install [OpenSSL for Windows](https://slproweb.com/products/Win32OpenSSL.html)
2. Set the environment variable:
   ```powershell
   $env:OPENSSL_DIR = "C:\Program Files\OpenSSL-Win64"
   ```
3. Retry the build

### `error[E0432]: unresolved import` in Rust

Run `cargo update` to refresh dependency versions:
```bash
cd src-tauri
cargo update
cargo check
```

### Frontend build fails with TypeScript errors

```bash
npm run build 2>&1 | head -50
```

Common causes:
- Type mismatch between frontend types and backend response
- Missing `@types/*` packages (run `npm install`)
- Outdated `tsconfig.json` settings

### `npm run tauri dev` hangs

- The Rust compilation can take 2–5 minutes on first run. Wait for it to complete.
- If it hangs for more than 10 minutes, try `cargo check` in `src-tauri/` to isolate the error.

---

## Platform-Specific Issues

### Linux: Tray icon not showing

Some Linux desktop environments don't support the system tray by default.

**GNOME:** Install the [AppIndicator extension](https://extensions.gnome.org/extension/615/appindicator-support/)

**KDE:** Tray icons should work out of the box.

**Other:** The app will continue to work without a tray icon — automations run normally and the main window can be restored from the taskbar.

### Windows: Antivirus blocking Flox

Some antivirus software may flag unsigned executables. Add Flox to your antivirus whitelist:
- **Windows Defender**: Go to Windows Security → Virus & Threat Protection → Manage Settings → Add or remove exclusions → add the Flox install directory

### macOS: Permission denied for browser launch

macOS may block Flox from launching browsers due to privacy permissions.

**Fix:**
1. Open **System Settings** → **Privacy & Security** → **Automation**
2. Find Flox and ensure it has permission to control your browser

---

## Diagnostic Information

When reporting a bug, include the following:

### System information
- Operating system and version
- Flox version (shown in the title bar or About dialog)
- Browser being used (name and version)
- AI provider and model

### Reproduction steps
1. Exact prompt you used
2. Steps to reproduce the issue
3. What you expected to happen
4. What actually happened

### Logs
- Screenshots of the Activity tab showing the failed steps
- Any error messages shown in toasts
- Browser console errors if you're using `npm run tauri dev`

### Reporting a Bug

[Open an issue on GitHub](https://github.com/1-kabir/flox/issues/new) with the information above.

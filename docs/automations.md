# Automations

Automations let you schedule browser tasks that Flox runs automatically on a repeating timer — without you having to type a prompt each time.

---

## Table of Contents

1. [Overview](#overview)
2. [Creating an Automation](#creating-an-automation)
3. [Managing Automations](#managing-automations)
4. [Automation Logs](#automation-logs)
5. [Human Approval in Background](#human-approval-in-background)
6. [Tips for Writing Automation Prompts](#tips-for-writing-automation-prompts)
7. [Headless Mode for Automations](#headless-mode-for-automations)

---

## Overview

An automation is a saved task with:
- A **name** (for your reference)
- A **prompt** (the instruction Flox follows each time it runs)
- An **interval** (how often it runs, in minutes)
- An optional **browser** preference
- An **enabled/disabled** state

Automations run on a background scheduler. Flox keeps the scheduler alive via the system tray even when the main window is minimized or closed. When your computer wakes from sleep, the scheduler resumes automatically.

**Examples of useful automations:**
- *Every 60 minutes:* "Open Gmail and alert me if I have any emails from my manager"
- *Every 30 minutes:* "Check the price of AAPL on finance.yahoo.com and log it"
- *Every 1440 minutes (daily):* "Go to my project management tool and create a standup summary from my completed tasks"
- *Every 5 minutes:* "Check if my website is up and responding"

---

## Creating an Automation

1. Click the **Automations** tab (⏰ icon) in the sidebar.
2. Click the **+ New Automation** button.
3. Fill in the form:

   | Field | Description |
   |---|---|
   | **Name** | A short label so you can identify this automation (e.g. "Morning Email Check") |
   | **Prompt** | The exact instruction Flox will follow each time it runs |
   | **Interval** | How often to run, in minutes (minimum: 1 minute) |
   | **Browser** | Which browser to use, or leave blank for the system default |

4. Click **Save**.

The automation is created in a **disabled** state. Enable it with the toggle on the card to start scheduling.

---

## Managing Automations

### The Automation Card

Each automation is shown as a card with:

- **Name and prompt preview**
- **Interval** (e.g. "Every 60 min")
- **Last run** timestamp and result
- **Enabled/Disabled toggle**
- **Action buttons**: Run Now ▶, Edit ✏️, Delete 🗑️

### Enabling and Disabling

Use the **toggle switch** on each card to enable or disable an automation:
- **Enabled** (green): The automation will run on schedule
- **Disabled** (gray): The automation is paused; it won't run until you re-enable it

Disabling does not delete the automation or its logs.

### Run Now

Click the ▶ **Run Now** button to trigger an automation immediately, regardless of its scheduled interval. This is useful for:
- Testing a new automation before enabling it on a schedule
- Running a task on-demand when you need a result right away

Running an automation manually resets the "next run" timer, so the next scheduled run starts counting from the time you clicked **Run Now**.

### Editing an Automation

Click the ✏️ **Edit** button to open the edit form. You can change:
- Name
- Prompt
- Interval
- Browser preference

Save changes by clicking **Update**. Changes take effect immediately.

### Deleting an Automation

Click the 🗑️ **Delete** button. You'll be asked to confirm.

> **Warning:** Deletion is permanent and also removes all logs for this automation.

---

## Automation Logs

Every automation run is automatically logged. To view the logs for a specific automation:

1. Click the **Logs** button on the automation card (or look for a "View Logs" link).
2. A log panel appears showing:

   | Column | Description |
   |---|---|
   | **Timestamp** | When the run started |
   | **Status** | `success`, `failed`, or `in_progress` |
   | **Summary** | A brief description of what the automation did |
   | **Steps** | Expand to see every browser action taken during this run |

### Clearing Logs

Click **Clear Logs** in the log panel to permanently remove all historical log entries for that automation. This does not affect the automation itself.

---

## Human Approval in Background

If **Approval Mode** is set to `all` or `auto` and an automation wants to perform a risky action while running in the background, Flox will:

1. **Pause the automation** and wait for your response
2. **Send an OS notification** alerting you that approval is needed

> Example notification: *"Flox: 'Morning Email Check' needs your approval — click here to respond"*

3. Click the notification to bring the Flox window to the front
4. The approval modal shows the proposed action — click **Allow** or **Deny**
5. The automation resumes (or skips the action, if denied)

The automation will wait up to **120 seconds** for your response. If no response is given, the action is treated as **Denied** and Flox tries to continue without it.

### Fully Unattended Automations

If you want automations to run completely without any human interaction, you have two options:

**Option 1: Set Approval Mode to `none`**  
Go to Settings → Behavior → Approval Mode → `none`. This disables all approval prompts globally.

**Option 2: Enable Headless Mode**  
Go to Settings → Browsers → enable **Headless Mode**. The browser runs invisibly, and combined with `auto` or `none` approval mode, automations will complete silently.

---

## Tips for Writing Automation Prompts

Good automation prompts are clear, self-contained, and action-oriented.

### Be specific about the outcome

Instead of: *"Check my email"*  
Use: *"Open Gmail, check for unread emails from the last 24 hours, and list their subject lines and senders"*

### Include the starting point

Flox opens a new browser session each time. Include the URL if relevant:  
*"Go to https://github.com/notifications and list any new mentions or review requests"*

### Specify what to do with results

*"...and save the results to a note in Google Keep"* or *"...and return a summary in your response"*

### Avoid ambiguous references

Flox has no memory between automation runs (unless you include context in the prompt). Don't refer to "the previous result" or "last time" — the automation starts fresh each run.

### Test before scheduling

Use **Run Now** to test your prompt before enabling the schedule. Review the logs to verify Flox is doing what you intended.

### Example prompts

```
Monitor the Bitcoin price on coinmarketcap.com and return the current USD price.
```

```
Go to https://news.ycombinator.com and return the top 5 story titles and their URLs.
```

```
Open Trello at https://trello.com/b/YOURBOARD, look at the "In Progress" column, 
and return a list of card names with their due dates.
```

```
Check if https://mywebsite.com returns a 200 status by navigating to it and 
reporting whether the page loaded successfully.
```

---

## Headless Mode for Automations

When **Headless Mode** is enabled in Settings → Browsers, all browsers launched by automations run invisibly (no visible window).

**Advantages:**
- Does not interrupt your workflow
- Faster startup time
- Works well on remote/server environments

**Limitations:**
- Some websites detect headless browsers and may behave differently or block access
- Screenshots are still captured and logged normally
- You won't be able to see what the browser is doing without checking the logs

For most common websites (Google, GitHub, news sites, email), headless mode works correctly. If an automation fails unexpectedly, try disabling headless mode to see the browser visually and diagnose the issue.

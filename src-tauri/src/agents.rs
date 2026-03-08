use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;
use tauri::Emitter;

use crate::settings::{AppSettings, ModelConfig};
use crate::browser::{BrowserAction, ActionResult};
use crate::network;

// ---------------------------------------------------------------------------
// Human-in-the-loop approval plumbing
// ---------------------------------------------------------------------------

type ApprovalSender = tokio::sync::oneshot::Sender<bool>;
type ApprovalMap = HashMap<String, ApprovalSender>;

static PENDING_APPROVALS: Lazy<Arc<Mutex<ApprovalMap>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

/// Frontend calls this to approve or reject a pending action.
#[tauri::command]
pub async fn resolve_approval(approval_id: String, approved: bool) -> Result<(), String> {
    let tx = {
        let mut map = PENDING_APPROVALS.lock().unwrap();
        map.remove(&approval_id)
    };
    if let Some(tx) = tx {
        let _ = tx.send(approved);
    }
    Ok(())
}

/// Request human approval for a proposed action. Returns `true` if approved.
async fn request_human_approval(
    app: &tauri::AppHandle,
    action: &BrowserAction,
    reason: &str,
    task_id: &str,
) -> bool {
    let (tx, rx) = tokio::sync::oneshot::channel::<bool>();
    let approval_id = uuid::Uuid::new_v4().to_string();

    {
        let mut map = PENDING_APPROVALS.lock().unwrap();
        map.insert(approval_id.clone(), tx);
    }

    let _ = app.emit(
        "approval_required",
        serde_json::json!({
            "approval_id": approval_id,
            "task_id": task_id,
            "action": action,
            "reason": reason,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }),
    );

    // OS notification so background automations surface to the user.
    #[cfg(not(test))]
    {
        use tauri_plugin_notification::NotificationExt;
        let body = format!("Action: {}. {}", action.action_type, reason);
        let _ = app
            .notification()
            .builder()
            .title("Flox — Approval Required")
            .body(&body)
            .show();
    }

    tokio::time::timeout(tokio::time::Duration::from_secs(120), rx)
        .await
        .unwrap_or(Ok(false))
        .unwrap_or(false)
}

/// Returns a risk-hint string if the action looks risky, or `None` otherwise.
fn risk_hint(action: &BrowserAction) -> Option<String> {
    match action.action_type.as_str() {
        "navigate" => {
            let risky = ["checkout", "payment", "pay", "billing", "account/delete", "confirm", "submit"];
            action.url.as_deref().and_then(|u| {
                let l = u.to_lowercase();
                if risky.iter().any(|p| l.contains(p)) {
                    Some(format!("Navigating to potentially sensitive URL: {}", u))
                } else {
                    None
                }
            })
        }
        "click" => {
            let risky = ["submit", "buy", "purchase", "checkout", "confirm", "delete", "remove", "pay"];
            let target = action.selector.as_deref().unwrap_or("").to_lowercase();
            if risky.iter().any(|p| target.contains(p)) {
                Some(format!("Clicking potentially risky element: {}", target))
            } else {
                None
            }
        }
        "evaluate" => Some("Executing arbitrary JavaScript".to_string()),
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// Agent data structures
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTask {
    pub task_id: String,
    pub objective: String,
    pub session_id: String,
    pub status: String,
    pub steps: Vec<AgentStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStep {
    pub step_id: String,
    pub agent: String,
    pub thought: String,
    pub action: Option<BrowserAction>,
    pub result: Option<ActionResult>,
    pub timestamp: String,
}

static RUNNING_TASKS: Lazy<Arc<Mutex<HashMap<String, bool>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// ---------------------------------------------------------------------------
// Public Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn run_agent_task(
    app: tauri::AppHandle,
    task_id: String,
    objective: String,
    session_id: String,
    settings: AppSettings,
    forced_skill_ids: Option<Vec<String>>,
) -> Result<AgentTask, String> {
    {
        let mut tasks = RUNNING_TASKS.lock().unwrap();
        tasks.insert(task_id.clone(), true);
    }

    let mut agent_task = AgentTask {
        task_id: task_id.clone(),
        objective: objective.clone(),
        session_id: session_id.clone(),
        status: "running".to_string(),
        steps: Vec::new(),
    };

    let forced_ids_ref: Option<&[String]> = forced_skill_ids.as_deref();

    // Load skill prompt injections
    let (skill_planner_prompt, skill_navigator_prompt) =
        crate::skills::get_relevant_skill_prompts(&app, &objective, None, forced_ids_ref).await;

    // Collect active permissions for verifier context
    let skill_permissions =
        crate::skills::get_active_skill_permissions(&app, &objective, None, forced_ids_ref).await;

    // PLANNING PHASE
    emit_progress(&app, &task_id, "planner", "Planning the task...", None);

    let plan = call_planner(
        &settings.planner_model,
        &objective,
        skill_planner_prompt.as_deref(),
        settings.planner_vision,
    )
    .await
    .map_err(|e| format!("Planner error: {}", e))?;

    agent_task.steps.push(AgentStep {
        step_id: uuid::Uuid::new_v4().to_string(),
        agent: "planner".to_string(),
        thought: plan.clone(),
        action: None,
        result: None,
        timestamp: chrono::Utc::now().to_rfc3339(),
    });

    emit_progress(&app, &task_id, "planner", &plan, None);

    // NAVIGATION PHASE
    let navigator_system = if let Some(extra) = skill_navigator_prompt.as_deref() {
        format!("{}\n{}", get_navigator_system_prompt(), extra)
    } else {
        get_navigator_system_prompt()
    };

    let mut conversation_history: Vec<LlmMessage> = vec![
        LlmMessage {
            role: "system".to_string(),
            content: navigator_system,
        },
        LlmMessage {
            role: "user".to_string(),
            content: format!("Objective: {}\n\nPlan:\n{}", objective, plan),
        },
    ];

    let max_steps = settings.max_steps as usize;
    let mut last_url: Option<String> = None;

    for step_num in 0..max_steps {
        {
            let tasks = RUNNING_TASKS.lock().unwrap();
            if !tasks.get(&task_id).copied().unwrap_or(false) {
                agent_task.status = "stopped".to_string();
                break;
            }
        }

        // Network availability check — wait until online before calling LLM.
        while !network::is_online() {
            emit_progress(
                &app,
                &task_id,
                "navigator",
                "⏸ Waiting for network connection...",
                None,
            );
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        }

        // Take screenshot (used when vision is enabled).
        let screenshot = if settings.screenshots_enabled {
            crate::browser::take_screenshot(session_id.clone()).await.ok()
        } else {
            None
        };

        emit_progress(
            &app,
            &task_id,
            "navigator",
            &format!("Step {}: Determining next action...", step_num + 1),
            screenshot.clone(),
        );

        // If navigator_vision is disabled, extract page context as text instead.
        // Always extract DOM context when vision is off, regardless of whether
        // screenshots are enabled — without this the navigator has no context at all.
        let page_context = if !settings.navigator_vision {
            let js = r#"JSON.stringify({
  url: location.href,
  title: document.title,
  interactive: Array.from(document.querySelectorAll('a,button,input,select,textarea,[role="button"],[onclick]')).map(el => ({
    tag: el.tagName,
    type: el.type||null,
    text: (el.innerText||el.value||el.placeholder||'').trim().slice(0,120),
    selector: el.id ? '#'+el.id : el.name ? '[name="'+el.name+'"]' : el.className ? '.'+el.className.split(' ')[0] : el.tagName.toLowerCase()
  })),
  bodyText: document.body?.innerText?.slice(0,3000)
})"#;
            let action = BrowserAction {
                action_type: "evaluate".to_string(),
                selector: None,
                value: Some(js.to_string()),
                x: None,
                y: None,
                url: None,
                key: None,
                scroll_x: None,
                scroll_y: None,
                screenshot: None,
            };
            crate::browser::execute_action(session_id.clone(), action)
                .await
                .ok()
                .and_then(|r| r.data)
                .and_then(|d| serde_json::to_string(&d).ok())
        } else {
            None
        };

        let nav_response = call_navigator(
            &settings.navigator_model,
            &conversation_history,
            if settings.navigator_vision { screenshot.as_deref() } else { None },
            page_context.as_deref(),
        )
        .await;

        match nav_response {
            Ok((thought, maybe_action, is_done)) => {
                if is_done {
                    agent_task.status = "completed".to_string();
                    agent_task.steps.push(AgentStep {
                        step_id: uuid::Uuid::new_v4().to_string(),
                        agent: "navigator".to_string(),
                        thought: thought.clone(),
                        action: None,
                        result: None,
                        timestamp: chrono::Utc::now().to_rfc3339(),
                    });
                    emit_progress(&app, &task_id, "navigator", &thought, None);
                    break;
                }

                if let Some(action) = maybe_action {
                    let hint = risk_hint(&action);

                    // VERIFICATION PHASE
                    let verification = call_verifier(
                        &settings.verifier_model,
                        &objective,
                        &thought,
                        &action,
                        hint.as_deref(),
                        &skill_permissions,
                    )
                    .await;

                    let (verified, verify_reason) = match &verification {
                        Ok((approved, reason)) => {
                            emit_progress(&app, &task_id, "verifier", reason, None);
                            (*approved, reason.clone())
                        }
                        Err(e) => {
                            emit_progress(
                                &app,
                                &task_id,
                                "verifier",
                                &format!("Verification error: {}", e),
                                None,
                            );
                            (false, String::new())
                        }
                    };

                    // Require human approval when the verifier rejects the action.
                    // Risk hints alone do NOT block (per spec: "Do not block on
                    // is_risky_action alone"), but they are surfaced as additional
                    // context in the approval request.
                    if !verified {
                        let approval_reason = if verify_reason.is_empty() {
                            hint.clone().unwrap_or_else(|| {
                                format!("Action flagged as potentially unsafe: {}", action.action_type)
                            })
                        } else {
                            verify_reason.clone()
                        };

                        emit_progress(
                            &app,
                            &task_id,
                            "verifier",
                            "⏳ Awaiting human approval...",
                            None,
                        );
                        let human_approved =
                            request_human_approval(&app, &action, &approval_reason, &task_id)
                                .await;
                        if !human_approved {
                            conversation_history.push(LlmMessage {
                                role: "assistant".to_string(),
                                content: thought.clone(),
                            });
                            conversation_history.push(LlmMessage {
                                role: "user".to_string(),
                                content:
                                    "Action was rejected. Please choose a safer alternative."
                                        .to_string(),
                            });
                            continue;
                        }
                        emit_progress(&app, &task_id, "verifier", "✅ Human approved.", None);
                    }

                    // Execute action
                    let action_result =
                        crate::browser::execute_action(session_id.clone(), action.clone()).await;

                    // Mid-task skill re-injection on URL change.
                    if action.action_type == "navigate" || action.action_type == "click" {
                        if let Ok(new_url) = get_current_url(&session_id).await {
                            if last_url.as_deref() != Some(&new_url) {
                                last_url = Some(new_url.clone());
                                let (_, new_nav_prompt) = crate::skills::get_relevant_skill_prompts(
                                    &app,
                                    &objective,
                                    Some(&new_url),
                                    forced_ids_ref,
                                )
                                .await;
                                if let Some(extra) = new_nav_prompt {
                                    conversation_history.push(LlmMessage {
                                        role: "user".to_string(),
                                        content: format!(
                                            "[Skill context updated for {}]\n{}",
                                            new_url, extra
                                        ),
                                    });
                                }
                            }
                        }
                    }

                    let result = match &action_result {
                        Ok(r) => {
                            conversation_history.push(LlmMessage {
                                role: "assistant".to_string(),
                                content: thought.clone(),
                            });
                            conversation_history.push(LlmMessage {
                                role: "user".to_string(),
                                content: format!(
                                    "Action executed successfully. Result: {:?}",
                                    r.data
                                ),
                            });
                            r.clone()
                        }
                        Err(e) => {
                            conversation_history.push(LlmMessage {
                                role: "assistant".to_string(),
                                content: thought.clone(),
                            });
                            conversation_history.push(LlmMessage {
                                role: "user".to_string(),
                                content: format!(
                                    "Action failed: {}. Please try a different approach.",
                                    e
                                ),
                            });
                            ActionResult {
                                success: false,
                                data: None,
                                screenshot: None,
                                error: Some(e.clone()),
                            }
                        }
                    };

                    let step = AgentStep {
                        step_id: uuid::Uuid::new_v4().to_string(),
                        agent: "navigator".to_string(),
                        thought: thought.clone(),
                        action: Some(action),
                        result: Some(result),
                        timestamp: chrono::Utc::now().to_rfc3339(),
                    };

                    // Persist step immediately to SQLite.
                    persist_agent_step(&task_id, &step);

                    agent_task.steps.push(step);
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                }
            }
            Err(e) => {
                agent_task.status = "error".to_string();
                emit_progress(&app, &task_id, "navigator", &format!("Error: {}", e), None);
                break;
            }
        }
    }

    if agent_task.status == "running" {
        agent_task.status = "max_steps_reached".to_string();
    }

    {
        let mut tasks = RUNNING_TASKS.lock().unwrap();
        tasks.remove(&task_id);
    }

    Ok(agent_task)
}

#[tauri::command]
pub async fn stop_agent_task(task_id: String) -> Result<(), String> {
    let mut tasks = RUNNING_TASKS.lock().unwrap();
    tasks.insert(task_id, false);
    Ok(())
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

fn emit_progress(
    app: &tauri::AppHandle,
    task_id: &str,
    agent: &str,
    message: &str,
    screenshot: Option<String>,
) {
    let _ = app.emit(
        "agent_progress",
        serde_json::json!({
            "task_id": task_id,
            "agent": agent,
            "message": message,
            "screenshot": screenshot,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }),
    );
}

fn persist_agent_step(task_id: &str, step: &AgentStep) {
    let id = uuid::Uuid::new_v4().to_string();
    let data = serde_json::to_string(step).unwrap_or_default();
    let now = chrono::Utc::now().to_rfc3339();
    let _ = crate::db::with_conn(|conn| {
        conn.execute(
            "INSERT INTO agent_steps (id, task_id, data, created_at) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![id, task_id, data, now],
        )?;
        Ok(())
    });
}

async fn get_current_url(session_id: &str) -> Result<String, String> {
    let action = BrowserAction {
        action_type: "evaluate".to_string(),
        selector: None,
        value: Some("location.href".to_string()),
        x: None,
        y: None,
        url: None,
        key: None,
        scroll_x: None,
        scroll_y: None,
        screenshot: None,
    };
    let result = crate::browser::execute_action(session_id.to_string(), action).await?;
    result
        .data
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .ok_or("no href".to_string())
}

async fn call_planner(
    model: &ModelConfig,
    objective: &str,
    skill_prompt: Option<&str>,
    _vision_enabled: bool,
) -> Result<String, anyhow::Error> {
    let mut system_prompt = r#"You are an expert web automation planner. Your job is to break down a user's objective into a clear, step-by-step plan for browser automation.

Analyze the objective and create a concise plan with numbered steps. Each step should be specific and actionable (navigate to URL, click button, fill form, etc.).

Keep the plan focused and efficient. Don't over-engineer it."#.to_string();

    if let Some(extra) = skill_prompt {
        system_prompt.push_str(extra);
    }

    let messages = vec![
        serde_json::json!({"role": "system", "content": system_prompt}),
        serde_json::json!({"role": "user", "content": format!("Create a browser automation plan for: {}", objective)}),
    ];

    call_llm_with_retry(model, messages).await
}

async fn call_navigator(
    model: &ModelConfig,
    history: &[LlmMessage],
    screenshot: Option<&str>,
    page_context: Option<&str>,
) -> Result<(String, Option<BrowserAction>, bool), anyhow::Error> {
    let mut messages: Vec<serde_json::Value> = history
        .iter()
        .map(|m| serde_json::json!({"role": m.role, "content": m.content}))
        .collect();

    // Append page context or screenshot to the last user message.
    if let Some(last) = messages.last_mut().filter(|m| m["role"] == "user") {
        if let Some(ss) = screenshot {
            if let Some(text) = last["content"].as_str().map(|s| s.to_string()) {
                last["content"] = serde_json::json!([
                    {"type": "text", "text": text},
                    {"type": "image_url", "image_url": {"url": format!("data:image/jpeg;base64,{}", ss)}}
                ]);
            }
        } else if let Some(ctx) = page_context {
            if let Some(existing) = last["content"].as_str() {
                last["content"] = serde_json::json!(format!(
                    "{}\n\n[Page context]\n{}",
                    existing, ctx
                ));
            }
        }
    }

    let response = call_llm_with_retry(model, messages).await?;
    let (thought, action, is_done) = parse_navigator_response(&response);
    Ok((thought, action, is_done))
}

async fn call_verifier(
    model: &ModelConfig,
    objective: &str,
    thought: &str,
    action: &BrowserAction,
    risk_hint_msg: Option<&str>,
    skill_permissions: &[String],
) -> Result<(bool, String), anyhow::Error> {
    let perms_str = if skill_permissions.is_empty() {
        "none".to_string()
    } else {
        skill_permissions.join(", ")
    };

    let mut context = format!(
        "Objective: {}\nProposed action: {:?}\nReasoning: {}\nActive skill permissions: {}",
        objective, action, thought, perms_str
    );

    if let Some(hint) = risk_hint_msg {
        context.push_str(&format!("\nRisk hint: {}", hint));
    }

    let messages = vec![
        serde_json::json!({
            "role": "system",
            "content": "You are a browser automation safety verifier. Given the objective, active skill permissions, and any risk hints, determine if the proposed action is safe and appropriate. Respond ONLY with JSON: {\"approved\": true/false, \"reason\": \"explanation\"}"
        }),
        serde_json::json!({
            "role": "user",
            "content": format!("{}\n\nIs this action safe and appropriate?", context)
        }),
    ];

    let response = call_llm_with_retry(model, messages).await?;

    let parsed: serde_json::Value = serde_json::from_str(&response).or_else(|_| {
        if let Some(start) = response.find('{') {
            if let Some(end) = response.rfind('}') {
                return serde_json::from_str(&response[start..=end]);
            }
        }
        Ok(serde_json::json!({"approved": true, "reason": "Unable to parse verification response"}))
    })?;

    let approved = parsed["approved"].as_bool().unwrap_or(true);
    let reason = parsed["reason"].as_str().unwrap_or("").to_string();
    Ok((approved, reason))
}

/// Call an LLM with exponential-backoff retry (max 4 attempts).
/// Handles 429, 503 (retry), 413 (truncate + retry once), other 4xx (no retry).
async fn call_llm_with_retry(
    model: &ModelConfig,
    messages: Vec<serde_json::Value>,
) -> Result<String, anyhow::Error> {
    let mut attempt = 0u32;
    let max_attempts = 4u32;

    loop {
        match call_llm(model, messages.clone()).await {
            Ok(resp) => return Ok(resp),
            Err(e) => {
                let msg = e.to_string();
                attempt += 1;

                if msg.contains("429") || msg.contains("503") {
                    if attempt >= max_attempts {
                        return Err(e);
                    }
                    let wait = (2u64.pow(attempt)).min(MAX_BACKOFF_SECS);
                    tokio::time::sleep(tokio::time::Duration::from_secs(wait)).await;
                    continue;
                } else if msg.contains("413") {
                    if attempt >= 2 {
                        return Err(e);
                    }
                    // Truncate messages and retry once.
                    let truncated = truncate_messages(messages.clone());
                    return call_llm(model, truncated).await;
                } else {
                    return Err(e);
                }
            }
        }
    }
}

/// Maximum exponential backoff wait before an LLM retry (seconds).
const MAX_BACKOFF_SECS: u64 = 30;
/// Maximum message content length before truncation on HTTP 413 retry.
const MAX_MESSAGE_LENGTH: usize = 4000;

/// Naively truncate message content to reduce payload size (used on HTTP 413 retry).
fn truncate_messages(mut messages: Vec<serde_json::Value>) -> Vec<serde_json::Value> {
    for msg in &mut messages {
        if let Some(s) = msg["content"].as_str() {
            if s.len() > MAX_MESSAGE_LENGTH {
                msg["content"] = serde_json::json!(&s[..MAX_MESSAGE_LENGTH]);
            }
        }
    }
    messages
}

async fn call_llm(
    model: &ModelConfig,
    messages: Vec<serde_json::Value>,
) -> Result<String, anyhow::Error> {
    let base_url = model.base_url.as_deref().unwrap_or(
        match model.provider.as_str() {
            "openai" => "https://api.openai.com/v1",
            "anthropic" => "https://api.anthropic.com/v1",
            "groq" => "https://api.groq.com/openai/v1",
            "ollama" => "http://localhost:11434/v1",
            _ => "https://api.openai.com/v1",
        }
    );

    let client = reqwest::Client::new();

    let request_body = serde_json::json!({
        "model": model.model,
        "messages": messages,
        "temperature": model.temperature,
        "max_tokens": model.max_tokens,
    });

    let mut req = client
        .post(format!("{}/chat/completions", base_url))
        .header("Content-Type", "application/json");

    if !model.api_key.is_empty() {
        req = req.header("Authorization", format!("Bearer {}", model.api_key));
    }

    if model.provider == "anthropic" {
        req = req
            .header("x-api-key", &model.api_key)
            .header("anthropic-version", "2023-06-01");
    }

    let response = req.json(&request_body).send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await?;
        return Err(anyhow::anyhow!("LLM API error {}: {}", status, body));
    }

    let response_json: serde_json::Value = response.json().await?;

    let content = response_json["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("Invalid response format"))?
        .to_string();

    Ok(content)
}

fn get_navigator_system_prompt() -> String {
    r##"You are an expert browser automation navigator. Your job is to execute a plan step by step using browser actions.

You have the following tools available:
- navigate: Go to a URL
- click: Click on an element (by CSS selector) or coordinates
- type: Type text into an input field
- scroll: Scroll the page
- key: Press a keyboard key
- evaluate: Execute JavaScript
- get_page_content: Get the page HTML
- wait: Wait for a specified time

For each step, respond with:
THOUGHT: [Your reasoning about what to do next]
ACTION: [JSON object with the action]

Example actions:
ACTION: {"action_type": "navigate", "url": "https://example.com"}
ACTION: {"action_type": "click", "selector": "#submit-button"}
ACTION: {"action_type": "type", "selector": "input[name='search']", "value": "hello world"}
ACTION: {"action_type": "scroll", "x": 0, "y": 300, "scroll_y": 300}
ACTION: {"action_type": "key", "key": "Return"}

When the task is complete, respond with:
THOUGHT: The task has been completed successfully.
DONE"##.to_string()
}

fn parse_navigator_response(response: &str) -> (String, Option<BrowserAction>, bool) {
    let mut thought = String::new();
    let mut action: Option<BrowserAction> = None;
    let is_done = response.contains("DONE");

    for line in response.lines() {
        if let Some(rest) = line.strip_prefix("THOUGHT:") {
            thought = rest.trim().to_string();
        } else if let Some(rest) = line.strip_prefix("ACTION:") {
            if let Ok(parsed) = serde_json::from_str::<BrowserAction>(rest.trim()) {
                action = Some(parsed);
            }
        }
    }

    if thought.is_empty() {
        thought = response.to_string();
    }

    (thought, action, is_done)
}

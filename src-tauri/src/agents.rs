use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;
use tauri::Emitter;

use crate::settings::{AppSettings, HilRoutingMode, ModelConfig};
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

/// Returns `true` if the action is considered destructive/high-risk and must always
/// be escalated to a human regardless of HIL routing mode.
fn is_destructive_action(action: &BrowserAction) -> bool {
    match action.action_type.as_str() {
        "navigate" => {
            let destructive = ["delete", "remove", "cancel", "payment", "checkout", "pay"];
            action.url.as_deref().map(|u| {
                let l = u.to_lowercase();
                destructive.iter().any(|p| l.contains(p))
            }).unwrap_or(false)
        }
        "click" => {
            let destructive_text = [
                "delete", "pay", "confirm payment", "submit order", "cancel subscription",
            ];
            let target = action.selector.as_deref().unwrap_or("").to_lowercase();
            let value = action.value.as_deref().unwrap_or("").to_lowercase();
            destructive_text.iter().any(|p| target.contains(p) || value.contains(p))
        }
        _ => false,
    }
}

/// A record of a past approval/denial decision used for the rolling context window
/// in `HilRoutingMode::Auto`.
#[derive(Clone)]
struct ApprovalRecord {
    action_type: String,
    selector_or_url: String,
    approved: bool,
}

/// Returns `true` if a structurally similar action was previously approved in the
/// rolling window (used by `HilRoutingMode::Auto` to skip human review).
fn has_similar_prior_approval(history: &[ApprovalRecord], action: &BrowserAction) -> bool {
    let target = match action.action_type.as_str() {
        "navigate" => action.url.as_deref().unwrap_or("").to_lowercase(),
        _ => action.selector.as_deref().unwrap_or("").to_lowercase(),
    };
    history.iter().any(|r| {
        r.approved
            && r.action_type == action.action_type
            && !r.selector_or_url.is_empty()
            && !target.is_empty()
            && (r.selector_or_url == target
                || r.selector_or_url.contains(target.as_str())
                || target.contains(r.selector_or_url.as_str()))
    })
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

    // Load the secrets map once at task start. Values are never sent to any LLM —
    // they are only used at execution time to resolve {{placeholder}} references.
    let secret_map = crate::secrets::load_secret_map().unwrap_or_default();

    // Build a list of secret names for the system prompt so agents know which
    // placeholders are available (without revealing the actual values).
    let secret_names: Vec<String> = secret_map.keys().cloned().collect();

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
        &secret_names,
        settings.planner_model.vision || settings.planner_vision,
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
        format!("{}\n{}", get_navigator_system_prompt(&secret_names), extra)
    } else {
        get_navigator_system_prompt(&secret_names)
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
    // Rolling window of the last 20 approval decisions (used by Auto mode).
    let mut approval_history: Vec<ApprovalRecord> = Vec::new();
    // Tracks consecutive denials for auto_try_alternatives logic.
    let mut denial_streak: u32 = 0;

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

        // If the navigator model does not have vision enabled, extract page context as text instead.
        // Always extract DOM context when vision is off, regardless of whether
        // screenshots are enabled — without this the navigator has no context at all.
        let navigator_vision = settings.navigator_model.vision || settings.navigator_vision;
        let page_context = if !navigator_vision {
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

        // Inject scratchpad context into the conversation as a user message so the
        // navigator can reference previously stored values without bloating the system prompt.
        let scratchpad_entries = crate::scratchpad::scratchpad_read_all(&task_id)
            .unwrap_or_default();
        let scratchpad_context = if scratchpad_entries.is_empty() {
            None
        } else {
            let map: serde_json::Map<String, serde_json::Value> = scratchpad_entries
                .iter()
                .map(|(k, v)| (k.clone(), serde_json::Value::String(v.clone())))
                .collect();
            Some(format!(
                "[Scratchpad: {}]",
                serde_json::to_string(&serde_json::Value::Object(map))
                    .unwrap_or_default()
            ))
        };

        let nav_response = call_navigator(
            &settings.navigator_model,
            &conversation_history,
            if navigator_vision { screenshot.as_deref() } else { None },
            page_context.as_deref(),
            scratchpad_context.as_deref(),
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

                    // Collect scratchpad for the completion event.
                    let sp_entries = crate::scratchpad::scratchpad_read_all(&task_id)
                        .unwrap_or_default();
                    let sp_map: serde_json::Map<String, serde_json::Value> = sp_entries
                        .iter()
                        .map(|(k, v)| (k.clone(), serde_json::Value::String(v.clone())))
                        .collect();
                    let result_url = sp_map
                        .get("result_url")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());

                    // Emit task_completed event for the frontend.
                    let _ = app.emit(
                        "task_completed",
                        serde_json::json!({
                            "task_id": task_id,
                            "session_id": session_id,
                            "objective": objective,
                            "final_thought": thought,
                            "scratchpad": serde_json::Value::Object(sp_map)
                        }),
                    );

                    // OS notification.
                    #[cfg(not(test))]
                    {
                        use tauri_plugin_notification::NotificationExt;
                        let truncated_thought = if thought.chars().count() > 120 {
                            format!("{}…", thought.chars().take(120).collect::<String>())
                        } else {
                            thought.clone()
                        };
                        let body = if let Some(url) = &result_url {
                            format!("{}\nView: {}", truncated_thought, url)
                        } else {
                            truncated_thought
                        };
                        let _ = app
                            .notification()
                            .builder()
                            .title("Flox — Task Complete")
                            .body(&body)
                            .show();
                    }

                    break;
                }

                if let Some(action) = maybe_action {
                    let hint = risk_hint(&action);

                    // -------------------------------------------------------
                    // HIL routing: None → skip verifier + human entirely.
                    // All / Auto → run verifier.
                    // -------------------------------------------------------
                    let (verified, verify_reason) = if settings.hil_routing_mode == HilRoutingMode::None {
                        (true, String::new())
                    } else {
                        // VERIFICATION PHASE
                        let verification = call_verifier(
                            &settings.verifier_model,
                            &objective,
                            &thought,
                            &action,
                            hint.as_deref(),
                            &skill_permissions,
                            &approval_history,
                        )
                        .await;

                        match verification {
                            Ok((approved, reason)) => {
                                emit_progress(&app, &task_id, "verifier", &reason, None);
                                (approved, reason)
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
                        }
                    };

                    // Decide whether human approval is needed.
                    let needs_human = match settings.hil_routing_mode {
                        // None: never ask
                        HilRoutingMode::None => false,
                        // All: ask whenever verifier rejects
                        HilRoutingMode::All => !verified,
                        // Auto: destructive actions always escalate regardless of verifier result;
                        // otherwise let verifier approval stand; only escalate on verifier rejection
                        // if no similar prior action was approved.
                        HilRoutingMode::Auto => {
                            if is_destructive_action(&action) {
                                true
                            } else if verified {
                                false
                            } else {
                                !has_similar_prior_approval(&approval_history, &action)
                            }
                        }
                    };

                    if needs_human {
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

                        // Record decision in rolling window (keep last 20).
                        let record = ApprovalRecord {
                            action_type: action.action_type.clone(),
                            selector_or_url: action
                                .selector
                                .as_deref()
                                .or(action.url.as_deref())
                                .unwrap_or("")
                                .to_lowercase(),
                            approved: human_approved,
                        };
                        approval_history.push(record);
                        if approval_history.len() > 20 {
                            approval_history.remove(0);
                        }

                        if !human_approved {
                            denial_streak += 1;
                            let retry_msg = if settings.auto_try_alternatives && denial_streak <= MAX_AUTO_RETRY_ATTEMPTS {
                                "Action was rejected. Please try a different approach (auto-retry)."
                            } else {
                                "Action was rejected. Please choose a safer alternative."
                            };
                            conversation_history.push(LlmMessage {
                                role: "assistant".to_string(),
                                content: thought.clone(),
                            });
                            conversation_history.push(LlmMessage {
                                role: "user".to_string(),
                                content: retry_msg.to_string(),
                            });
                            if !settings.auto_try_alternatives || denial_streak > MAX_AUTO_RETRY_ATTEMPTS {
                                denial_streak = 0;
                            }
                            continue;
                        }
                        denial_streak = 0;
                        emit_progress(&app, &task_id, "verifier", "✅ Human approved.", None);
                    } else if !verified && !needs_human {
                        // Auto mode: auto-approved via rolling window similarity.
                        let record = ApprovalRecord {
                            action_type: action.action_type.clone(),
                            selector_or_url: action
                                .selector
                                .as_deref()
                                .or(action.url.as_deref())
                                .unwrap_or("")
                                .to_lowercase(),
                            approved: true,
                        };
                        approval_history.push(record);
                        if approval_history.len() > 20 {
                            approval_history.remove(0);
                        }
                        emit_progress(&app, &task_id, "verifier", "✅ Auto-approved (similar to prior approved action).", None);
                    } else if verified {
                        // Record verifier-approved actions too, for future similarity checks.
                        let record = ApprovalRecord {
                            action_type: action.action_type.clone(),
                            selector_or_url: action
                                .selector
                                .as_deref()
                                .or(action.url.as_deref())
                                .unwrap_or("")
                                .to_lowercase(),
                            approved: true,
                        };
                        approval_history.push(record);
                        if approval_history.len() > 20 {
                            approval_history.remove(0);
                        }
                    }

                    // Execute action — resolve {{secret_name}} placeholders first so that
                    // the LLM-supplied action value never contains the real secret; the
                    // substitution happens entirely inside the Rust runtime.

                    // Handle scratchpad actions before hitting the browser CDP.
                    // Note: scratchpad actions use `selector` as the key field and `value` as
                    // the stored value, reusing the existing BrowserAction schema so no new
                    // types are needed on the LLM side.
                    let action_result = match action.action_type.as_str() {
                        "scratchpad_write" => {
                            let key = action.selector.as_deref().unwrap_or("");
                            let val = action.value.as_deref().unwrap_or("");
                            match crate::scratchpad::scratchpad_write(&task_id, key, val) {
                                Ok(()) => Ok(ActionResult {
                                    success: true,
                                    data: Some(serde_json::json!(format!(
                                        "Stored '{}' in scratchpad",
                                        key
                                    ))),
                                    screenshot: None,
                                    error: None,
                                }),
                                Err(e) => Ok(ActionResult {
                                    success: false,
                                    data: None,
                                    screenshot: None,
                                    error: Some(e),
                                }),
                            }
                        }
                        "scratchpad_read" => {
                            let key = action.selector.as_deref().unwrap_or("");
                            match crate::scratchpad::scratchpad_read(&task_id, key) {
                                Ok(maybe_val) => Ok(ActionResult {
                                    success: true,
                                    data: maybe_val.map(|v| serde_json::json!(v)),
                                    screenshot: None,
                                    error: None,
                                }),
                                Err(e) => Ok(ActionResult {
                                    success: false,
                                    data: None,
                                    screenshot: None,
                                    error: Some(e),
                                }),
                            }
                        }
                        _ => {
                            let resolved_action =
                                crate::secrets::resolve_secrets_in_action(&action, &secret_map);
                            crate::browser::execute_action(session_id.clone(), resolved_action)
                                .await
                        }
                    };

                    // Mid-task skill re-injection on URL change (skip for scratchpad actions).
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
                let err_msg = format!("Error: {}", e);
                emit_progress(&app, &task_id, "navigator", &err_msg, None);
                let truncated = if err_msg.chars().count() > 120 {
                    format!("{}…", err_msg.chars().take(120).collect::<String>())
                } else {
                    err_msg
                };
                let _ = app.emit(
                    "flox://error",
                    serde_json::json!({
                        "message": truncated,
                        "severity": "error"
                    }),
                );
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

    // Only clear the scratchpad on successful completion so that entries remain
    // available for debugging when a task fails or is stopped mid-way.
    if agent_task.status == "completed" {
        let _ = crate::scratchpad::scratchpad_clear(&task_id);
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
    secret_names: &[String],
    _vision_enabled: bool,
) -> Result<String, anyhow::Error> {
    let mut system_prompt = r#"You are an expert web automation planner. Your job is to break down a user's objective into a clear, step-by-step plan for browser automation.

Analyze the objective and create a concise plan with numbered steps. Each step should be specific and actionable (navigate to URL, click button, fill form, etc.).

Keep the plan focused and efficient. Don't over-engineer it."#.to_string();

    if !secret_names.is_empty() {
        system_prompt.push_str(&format!(
            "\n\nThe following secret placeholders are available. Use them in action values as {{{{name}}}} (double curly braces) — never try to look up or reveal the actual values:\n{}",
            secret_names.iter().map(|n| format!("  - {{{{{}}}}}", n)).collect::<Vec<_>>().join("\n")
        ));
    }

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
    scratchpad_context: Option<&str>,
) -> Result<(String, Option<BrowserAction>, bool), anyhow::Error> {
    let mut messages: Vec<serde_json::Value> = history
        .iter()
        .map(|m| serde_json::json!({"role": m.role, "content": m.content}))
        .collect();

    // Append page context, scratchpad context, or screenshot to the last user message.
    if let Some(last) = messages.last_mut().filter(|m| m["role"] == "user") {
        if let Some(ss) = screenshot {
            if let Some(text) = last["content"].as_str().map(|s| s.to_string()) {
                last["content"] = serde_json::json!([
                    {"type": "text", "text": text},
                    {"type": "image_url", "image_url": {"url": format!("data:image/jpeg;base64,{}", ss)}}
                ]);
            }
        } else if let Some(ctx) = page_context {
            let mut combined = if let Some(existing) = last["content"].as_str() {
                format!("{}\n\n[Page context]\n{}", existing, ctx)
            } else {
                format!("[Page context]\n{}", ctx)
            };
            if let Some(sp) = scratchpad_context {
                combined.push_str(&format!("\n\n{}", sp));
            }
            last["content"] = serde_json::json!(combined);
        } else if let Some(sp) = scratchpad_context {
            if let Some(existing) = last["content"].as_str() {
                last["content"] = serde_json::json!(format!("{}\n\n{}", existing, sp));
            } else {
                last["content"] = serde_json::json!(sp);
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
    approval_history: &[ApprovalRecord],
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

    // Include rolling window of recent decisions as context for the verifier.
    if !approval_history.is_empty() {
        let history_str: Vec<String> = approval_history
            .iter()
            .rev()
            .take(10)
            .map(|r| {
                format!(
                    "  - {} on '{}': {}",
                    r.action_type,
                    r.selector_or_url,
                    if r.approved { "approved" } else { "denied" }
                )
            })
            .collect();
        context.push_str(&format!(
            "\nRecent approval history (most recent first):\n{}",
            history_str.join("\n")
        ));
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

/// Maximum consecutive denials before auto-retry is exhausted (used with `auto_try_alternatives`).
const MAX_AUTO_RETRY_ATTEMPTS: u32 = 2;
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
            "openai"      => "https://api.openai.com/v1",
            "anthropic"   => "https://api.anthropic.com/v1",
            "gemini"      => "https://generativelanguage.googleapis.com/v1beta/openai",
            "groq"        => "https://api.groq.com/openai/v1",
            "cerebras"    => "https://api.cerebras.ai/v1",
            "cohere"      => "https://api.cohere.com/compatibility/v1",
            "mistral"     => "https://api.mistral.ai/v1",
            "together"    => "https://api.together.xyz/v1",
            "openrouter"  => "https://openrouter.ai/api/v1",
            "perplexity"  => "https://api.perplexity.ai",
            "ollama"      => "http://localhost:11434/v1",
            _             => "https://api.openai.com/v1",
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

fn get_navigator_system_prompt(secret_names: &[String]) -> String {
    let mut prompt = r##"You are an expert browser automation navigator. Your job is to execute a plan step by step using browser actions.

You have the following tools available:
- navigate: Go to a URL. Example: {"action_type": "navigate", "url": "https://example.com"}
- click: Click on an element (by CSS selector) or coordinates. Example: {"action_type": "click", "selector": "#submit-button"}
- double_click: Double-click on an element or coordinates. Example: {"action_type": "double_click", "selector": ".item"}
- right_click: Right-click on an element or coordinates. Example: {"action_type": "right_click", "selector": ".item"}
- hover: Move the mouse over an element (triggers hover states/tooltips). Example: {"action_type": "hover", "selector": ".menu-item"}
- type: Type text into an input field (focuses the element first). Example: {"action_type": "type", "selector": "input[name='q']", "value": "hello world"}
- clear: Clear the content of an input field. Example: {"action_type": "clear", "selector": "#email"}
- select: Select an option in a <select> dropdown by visible text. Example: {"action_type": "select", "selector": "#country", "value": "United States"}
- check: Check or uncheck a checkbox/radio. Use value "true" to check, "false" to uncheck. Example: {"action_type": "check", "selector": "#agree", "value": "true"}
- focus: Focus an element without clicking it. Example: {"action_type": "focus", "selector": "#email"}
- scroll: Scroll the page or a specific element. Example: {"action_type": "scroll", "x": 0, "y": 300, "scroll_y": 300}
- key: Press a keyboard key (Tab, Return, Escape, ArrowDown, ArrowUp, etc.). Example: {"action_type": "key", "key": "Return"}
- evaluate: Execute JavaScript and return the result. Example: {"action_type": "evaluate", "value": "document.title"}
- get_page_content: Get the full page HTML. Example: {"action_type": "get_page_content"}
- get_text: Get the text content of an element. Example: {"action_type": "get_text", "selector": "h1"}
- wait: Wait for a specified time in milliseconds. Example: {"action_type": "wait", "value": "1000"}
- wait_for_element: Wait until an element appears in the DOM. Example: {"action_type": "wait_for_element", "selector": ".results"}
- scratchpad_write: Store a value for later retrieval within this task. Uses `selector` as the key and `value` as the value. Example: {"action_type": "scratchpad_write", "selector": "target_repo", "value": "1-kabir/flox"}
- scratchpad_read: Retrieve a previously stored value by key (returned in the action result). Example: {"action_type": "scratchpad_read", "selector": "target_repo"}

For each step, respond with:
THOUGHT: [Your reasoning about what to do next]
ACTION: [JSON object with the action]

When the task is complete, respond with:
THOUGHT: The task has been completed successfully.
DONE"##.to_string();

    if !secret_names.is_empty() {
        prompt.push_str(&format!(
            "\n\n## Secrets\nThe following secret placeholders are available. Use them as {{{{name}}}} in action `value` or `url` fields — NEVER try to display, log, or reason about the actual values:\n{}",
            secret_names.iter().map(|n| format!("  - {{{{{}}}}}", n)).collect::<Vec<_>>().join("\n")
        ));
        prompt.push_str("\n\nExample: to type the user's GitHub token into an input, use:\nACTION: {\"action_type\": \"type\", \"selector\": \"#token\", \"value\": \"{{github_token}}\"}");
    }

    prompt
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

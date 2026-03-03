use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use once_cell::sync::Lazy;
use tauri::Emitter;

use crate::settings::{AppSettings, ModelConfig};
use crate::browser::{BrowserAction, ActionResult};

// ---------------------------------------------------------------------------
// Human-in-the-loop approval plumbing
// ---------------------------------------------------------------------------

/// Pending approval channels, keyed by approval_id.
static PENDING_APPROVALS: Lazy<Arc<Mutex<HashMap<String, tokio::sync::oneshot::Sender<bool>>>>> =
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

    let _ = app.emit("approval_required", serde_json::json!({
        "approval_id": approval_id,
        "task_id": task_id,
        "action": action,
        "reason": reason,
        "timestamp": chrono::Utc::now().to_rfc3339()
    }));

    // Wait up to 120 seconds for user decision; default to approved = false on timeout.
    tokio::time::timeout(
        tokio::time::Duration::from_secs(120),
        rx,
    )
    .await
    .unwrap_or(Ok(false))
    .unwrap_or(false)
}

/// Returns `true` when an action is considered risky and should require human approval.
fn is_risky_action(action: &BrowserAction) -> bool {
    match action.action_type.as_str() {
        "navigate" => {
            // External payment or account-management pages are risky.
            let risky_patterns = ["checkout", "payment", "pay", "billing", "account/delete", "confirm", "submit"];
            action.url.as_deref().map(|u| {
                let l = u.to_lowercase();
                risky_patterns.iter().any(|p| l.contains(p))
            }).unwrap_or(false)
        }
        "click" => {
            let risky_patterns = ["submit", "buy", "purchase", "checkout", "confirm", "delete", "remove", "pay"];
            let target = action.selector.as_deref().unwrap_or("").to_lowercase();
            risky_patterns.iter().any(|p| target.contains(p))
        }
        "evaluate" => {
            // Arbitrary JS is inherently risky.
            true
        }
        _ => false,
    }
}

// ---------------------------------------------------------------------------
// Agent data structures
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
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

#[tauri::command]
pub async fn run_agent_task(
    app: tauri::AppHandle,
    task_id: String,
    objective: String,
    session_id: String,
    settings: AppSettings,
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

    // Load skill prompt injections
    let (skill_planner_prompt, skill_navigator_prompt) =
        crate::skills::get_relevant_skill_prompts(&app, &objective, None).await;

    // PLANNING PHASE
    emit_progress(&app, &task_id, "planner", "Planning the task...", None);

    let plan = call_planner(&settings.planner_model, &objective, &[], skill_planner_prompt.as_deref()).await
        .map_err(|e| format!("Planner error: {}", e))?;

    let plan_step = AgentStep {
        step_id: uuid::Uuid::new_v4().to_string(),
        agent: "planner".to_string(),
        thought: plan.clone(),
        action: None,
        result: None,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    agent_task.steps.push(plan_step);

    emit_progress(&app, &task_id, "planner", &plan, None);

    // NAVIGATION PHASE
    let navigator_system = if let Some(extra) = skill_navigator_prompt.as_deref() {
        format!("{}\n{}", get_navigator_system_prompt(), extra)
    } else {
        get_navigator_system_prompt()
    };
    let mut conversation_history: Vec<Message> = vec![
        Message { role: "system".to_string(), content: navigator_system },
        Message { role: "user".to_string(), content: format!("Objective: {}\n\nPlan:\n{}", objective, plan) },
    ];

    let max_steps = settings.max_steps as usize;

    for step_num in 0..max_steps {
        // Check if task was stopped
        {
            let tasks = RUNNING_TASKS.lock().unwrap();
            if !tasks.get(&task_id).copied().unwrap_or(false) {
                agent_task.status = "stopped".to_string();
                break;
            }
        }

        // Take screenshot
        let screenshot = crate::browser::take_screenshot(session_id.clone()).await.ok();

        // Call navigator
        emit_progress(&app, &task_id, "navigator", &format!("Step {}: Determining next action...", step_num + 1), screenshot.clone());

        let nav_response = call_navigator(
            &settings.navigator_model,
            &mut conversation_history,
            screenshot.as_deref(),
        ).await;

        match nav_response {
            Ok((thought, maybe_action, is_done)) => {
                if is_done {
                    agent_task.status = "completed".to_string();
                    let done_step = AgentStep {
                        step_id: uuid::Uuid::new_v4().to_string(),
                        agent: "navigator".to_string(),
                        thought: thought.clone(),
                        action: None,
                        result: None,
                        timestamp: chrono::Utc::now().to_rfc3339(),
                    };
                    agent_task.steps.push(done_step);
                    emit_progress(&app, &task_id, "navigator", &thought, None);
                    break;
                }

                if let Some(action) = maybe_action {
                    // VERIFICATION PHASE (LLM verifier)
                    let verification = call_verifier(
                        &settings.verifier_model,
                        &objective,
                        &thought,
                        &action,
                    ).await;

                    let verified = match &verification {
                        Ok((approved, reason)) => {
                            emit_progress(&app, &task_id, "verifier", reason, None);
                            *approved
                        }
                        Err(e) => {
                            emit_progress(&app, &task_id, "verifier", &format!("Verification error: {}", e), None);
                            false
                        }
                    };

                    if !verified {
                        let reason = verification.ok().map(|(_, r)| r).unwrap_or_default();
                        conversation_history.push(Message {
                            role: "assistant".to_string(),
                            content: thought.clone(),
                        });
                        conversation_history.push(Message {
                            role: "user".to_string(),
                            content: format!("Action was rejected by verifier: {}. Please choose a different action.", reason),
                        });
                        continue;
                    }

                    // HUMAN-IN-THE-LOOP: require approval for risky actions
                    if is_risky_action(&action) {
                        let reason = format!("Risky action proposed: {}. Thought: {}", action.action_type, thought);
                        emit_progress(&app, &task_id, "verifier", "⏳ Awaiting human approval for risky action...", None);
                        let human_approved = request_human_approval(&app, &action, &reason, &task_id).await;
                        if !human_approved {
                            conversation_history.push(Message {
                                role: "assistant".to_string(),
                                content: thought.clone(),
                            });
                            conversation_history.push(Message {
                                role: "user".to_string(),
                                content: "Action was rejected by the user. Please choose a safer alternative.".to_string(),
                            });
                            continue;
                        }
                        emit_progress(&app, &task_id, "verifier", "✅ Human approved the action.", None);
                    }

                    // Execute action
                    let action_result = crate::browser::execute_action(
                        session_id.clone(),
                        action.clone(),
                    ).await;

                    let result = match &action_result {
                        Ok(r) => {
                            conversation_history.push(Message {
                                role: "assistant".to_string(),
                                content: thought.clone(),
                            });
                            conversation_history.push(Message {
                                role: "user".to_string(),
                                content: format!("Action executed successfully. Result: {:?}", r.data),
                            });
                            r.clone()
                        }
                        Err(e) => {
                            conversation_history.push(Message {
                                role: "assistant".to_string(),
                                content: thought.clone(),
                            });
                            conversation_history.push(Message {
                                role: "user".to_string(),
                                content: format!("Action failed with error: {}. Please try a different approach.", e),
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
                    agent_task.steps.push(step);

                    // Small delay between actions
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

fn emit_progress(
    app: &tauri::AppHandle,
    task_id: &str,
    agent: &str,
    message: &str,
    screenshot: Option<String>,
) {
    let _ = app.emit("agent_progress", serde_json::json!({
        "task_id": task_id,
        "agent": agent,
        "message": message,
        "screenshot": screenshot,
        "timestamp": chrono::Utc::now().to_rfc3339()
    }));
}

async fn call_planner(model: &ModelConfig, objective: &str, _context: &[Message], skill_prompt: Option<&str>) -> Result<String, anyhow::Error> {
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

    call_llm(model, messages).await
}

async fn call_navigator(
    model: &ModelConfig,
    history: &mut Vec<Message>,
    screenshot: Option<&str>,
) -> Result<(String, Option<BrowserAction>, bool), anyhow::Error> {
    let mut messages: Vec<serde_json::Value> = history
        .iter()
        .map(|m| serde_json::json!({"role": m.role, "content": m.content}))
        .collect();

    // Add screenshot if available
    if let Some(ss) = screenshot {
        let last_user_msg = messages.last_mut()
            .filter(|m| m["role"] == "user");
        if let Some(msg) = last_user_msg {
            if let Some(content) = msg["content"].as_str().map(|s| s.to_string()) {
                let content_with_image = serde_json::json!([
                    {"type": "text", "text": content},
                    {"type": "image_url", "image_url": {"url": format!("data:image/jpeg;base64,{}", ss)}}
                ]);
                msg["content"] = content_with_image;
            }
        }
    }

    let response = call_llm(model, messages).await?;

    // Parse the response to extract action
    let (thought, action, is_done) = parse_navigator_response(&response);
    Ok((thought, action, is_done))
}

async fn call_verifier(
    model: &ModelConfig,
    objective: &str,
    thought: &str,
    action: &BrowserAction,
) -> Result<(bool, String), anyhow::Error> {
    let messages = vec![
        serde_json::json!({
            "role": "system",
            "content": "You are a browser automation safety verifier. Verify if the proposed action is safe, appropriate, and aligned with the objective. Respond with JSON: {\"approved\": true/false, \"reason\": \"explanation\"}"
        }),
        serde_json::json!({
            "role": "user",
            "content": format!(
                "Objective: {}\nProposed action: {:?}\nReasoning: {}\n\nIs this action safe and appropriate?",
                objective, action, thought
            )
        })
    ];

    let response = call_llm(model, messages).await?;

    // Parse JSON response
    let parsed: serde_json::Value = serde_json::from_str(&response)
        .or_else(|_| {
            // Try to extract JSON from response
            if let Some(start) = response.find('{') {
                if let Some(end) = response.rfind('}') {
                    return serde_json::from_str(&response[start..=end]);
                }
            }
            Ok(serde_json::json!({"approved": true, "reason": "Unable to parse verification response, proceeding"}))
        })?;

    let approved = parsed["approved"].as_bool().unwrap_or(true);
    let reason = parsed["reason"].as_str().unwrap_or("").to_string();

    Ok((approved, reason))
}

async fn call_llm(
    model: &ModelConfig,
    messages: Vec<serde_json::Value>,
) -> Result<String, anyhow::Error> {
    let base_url = model.base_url.as_deref().unwrap_or_else(|| {
        match model.provider.as_str() {
            "openai" => "https://api.openai.com/v1",
            "anthropic" => "https://api.anthropic.com/v1",
            "groq" => "https://api.groq.com/openai/v1",
            "ollama" => "http://localhost:11434/v1",
            _ => "https://api.openai.com/v1",
        }
    });

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

    // Anthropic uses different header
    if model.provider == "anthropic" {
        req = req.header("x-api-key", &model.api_key)
            .header("anthropic-version", "2023-06-01");
    }

    let response = req
        .json(&request_body)
        .send()
        .await?;

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
        if line.starts_with("THOUGHT:") {
            thought = line["THOUGHT:".len()..].trim().to_string();
        } else if line.starts_with("ACTION:") {
            let action_str = line["ACTION:".len()..].trim();
            if let Ok(parsed) = serde_json::from_str::<BrowserAction>(action_str) {
                action = Some(parsed);
            }
        }
    }

    if thought.is_empty() {
        thought = response.to_string();
    }

    (thought, action, is_done)
}

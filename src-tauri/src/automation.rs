use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::Emitter;
use tauri_plugin_store::StoreExt;
use uuid::Uuid;

use crate::settings::AppSettings;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Automation {
    pub id: String,
    pub name: String,
    pub prompt: String,
    pub interval_minutes: u64,
    pub enabled: bool,
    pub last_run: Option<String>,
    pub next_run: Option<String>,
    pub last_result: Option<String>,
    pub browser_path: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomationLog {
    pub automation_id: String,
    pub timestamp: String,
    pub status: String,
    pub summary: String,
    pub steps: u32,
}

#[tauri::command]
pub async fn get_automations(app: tauri::AppHandle) -> Result<Vec<Automation>, String> {
    let store = app.store("flox_store.bin").map_err(|e| e.to_string())?;

    let automations: Vec<Automation> = store
        .get("automations")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    Ok(automations)
}

#[tauri::command]
pub async fn save_automation(
    app: tauri::AppHandle,
    automation: Automation,
) -> Result<Automation, String> {
    let store = app.store("flox_store.bin").map_err(|e| e.to_string())?;

    let mut automations: Vec<Automation> = store
        .get("automations")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    let is_new = automation.id.is_empty();
    let mut auto = automation;

    if is_new {
        auto.id = Uuid::new_v4().to_string();
        auto.created_at = chrono::Utc::now().to_rfc3339();
        automations.push(auto.clone());
    } else if let Some(existing) = automations.iter_mut().find(|a| a.id == auto.id) {
        *existing = auto.clone();
    } else {
        automations.push(auto.clone());
    }

    store.set(
        "automations",
        serde_json::to_value(&automations).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;

    Ok(auto)
}

#[tauri::command]
pub async fn delete_automation(app: tauri::AppHandle, automation_id: String) -> Result<(), String> {
    let store = app.store("flox_store.bin").map_err(|e| e.to_string())?;

    let mut automations: Vec<Automation> = store
        .get("automations")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    automations.retain(|a| a.id != automation_id);

    store.set(
        "automations",
        serde_json::to_value(&automations).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn toggle_automation(
    app: tauri::AppHandle,
    automation_id: String,
    enabled: bool,
) -> Result<(), String> {
    let store = app.store("flox_store.bin").map_err(|e| e.to_string())?;

    let mut automations: Vec<Automation> = store
        .get("automations")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    if let Some(auto) = automations.iter_mut().find(|a| a.id == automation_id) {
        auto.enabled = enabled;

        if enabled {
            let next_run = chrono::Utc::now() + chrono::Duration::minutes(auto.interval_minutes as i64);
            auto.next_run = Some(next_run.to_rfc3339());
        } else {
            auto.next_run = None;
        }
    }

    store.set(
        "automations",
        serde_json::to_value(&automations).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn run_automation_now(
    app: tauri::AppHandle,
    automation_id: String,
) -> Result<(), String> {
    let store = app.store("flox_store.bin").map_err(|e| e.to_string())?;

    let automations: Vec<Automation> = store
        .get("automations")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    let automation = automations
        .into_iter()
        .find(|a| a.id == automation_id)
        .ok_or_else(|| "Automation not found".to_string())?;

    let settings: AppSettings = store
        .get("settings")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    let app_clone = app.clone();
    tokio::spawn(async move {
        execute_automation(app_clone, automation, settings).await;
    });

    Ok(())
}

pub async fn start_automation_scheduler(app: tauri::AppHandle) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));

    loop {
        interval.tick().await;

        let store = match app.store("flox_store.bin") {
            Ok(s) => s,
            Err(_) => continue,
        };

        let automations: Vec<Automation> = store
            .get("automations")
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_default();

        let settings: AppSettings = store
            .get("settings")
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_default();

        let now = chrono::Utc::now();

        for automation in automations {
            if !automation.enabled {
                continue;
            }

            let should_run = automation.next_run
                .as_deref()
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .map(|next| now >= next)
                .unwrap_or(true);

            if should_run {
                let app_clone = app.clone();
                let settings_clone = settings.clone();
                let automation_clone = automation.clone();

                tokio::spawn(async move {
                    execute_automation(app_clone, automation_clone, settings_clone).await;
                });
            }
        }
    }
}

async fn execute_automation(
    app: tauri::AppHandle,
    automation: Automation,
    settings: AppSettings,
) {
    let session_id = format!("automation_{}", automation.id);
    let browser_path = automation.browser_path
        .clone()
        .or_else(|| settings.preferred_browser.clone())
        .unwrap_or_default();

    let _ = app.emit("automation_started", serde_json::json!({
        "automation_id": automation.id,
        "name": automation.name
    }));

    // Launch browser in headless mode for automations
    let launch_result = crate::browser::launch_browser(
        browser_path,
        true,  // headless
        session_id.clone(),
    ).await;

    if let Err(e) = launch_result {
        log_automation_result(&app, &automation, "error", &format!("Failed to launch browser: {}", e), 0).await;
        return;
    }

    // Run the agent task
    let task_id = format!("automation_task_{}", Uuid::new_v4());
    let result = crate::agents::run_agent_task(
        app.clone(),
        task_id,
        automation.prompt.clone(),
        session_id.clone(),
        settings,
    ).await;

    let (status, summary, steps) = match result {
        Ok(task) => {
            let steps = task.steps.len() as u32;
            let summary = format!("Completed with {} steps (status: {})", steps, task.status);
            ("success".to_string(), summary, steps)
        }
        Err(e) => ("error".to_string(), e, 0),
    };

    // Close browser
    let _ = crate::browser::close_browser(session_id).await;

    // Update next run time and log result
    update_automation_run(&app, &automation.id, &status, &summary, steps).await;

    let _ = app.emit("automation_completed", serde_json::json!({
        "automation_id": automation.id,
        "name": automation.name,
        "status": status,
        "summary": summary
    }));
}

async fn log_automation_result(
    app: &tauri::AppHandle,
    automation: &Automation,
    status: &str,
    summary: &str,
    steps: u32,
) {
    let store = match app.store("flox_store.bin") {
        Ok(s) => s,
        Err(_) => return,
    };

    let log = AutomationLog {
        automation_id: automation.id.clone(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        status: status.to_string(),
        summary: summary.to_string(),
        steps,
    };

    let mut logs: Vec<AutomationLog> = store
        .get("automation_logs")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    logs.insert(0, log);
    logs.truncate(100); // Keep last 100 logs

    if let Ok(v) = serde_json::to_value(&logs) {
        store.set("automation_logs", v);
        let _ = store.save();
    }
}

async fn update_automation_run(
    app: &tauri::AppHandle,
    automation_id: &str,
    status: &str,
    summary: &str,
    steps: u32,
) {
    let store = match app.store("flox_store.bin") {
        Ok(s) => s,
        Err(_) => return,
    };

    let mut automations: Vec<Automation> = store
        .get("automations")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    if let Some(auto) = automations.iter_mut().find(|a| a.id == automation_id) {
        auto.last_run = Some(chrono::Utc::now().to_rfc3339());
        auto.last_result = Some(format!("{}: {}", status, summary));

        if auto.enabled {
            let next_run = chrono::Utc::now() + chrono::Duration::minutes(auto.interval_minutes as i64);
            auto.next_run = Some(next_run.to_rfc3339());
        }
    }

    if let Ok(v) = serde_json::to_value(&automations) {
        store.set("automations", v);
        let _ = store.save();
    }

    // Also log
    let automations_for_log: Vec<Automation> = store
        .get("automations")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    if let Some(automation) = automations_for_log.iter().find(|a| a.id == automation_id) {
        log_automation_result(app, automation, status, summary, steps).await;
    }
}

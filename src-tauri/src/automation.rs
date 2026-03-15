use serde::{Deserialize, Serialize};
use tauri::Emitter;
use uuid::Uuid;

use crate::db;
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
    pub id: String,
    pub automation_id: String,
    pub timestamp: String,
    pub status: String,
    pub summary: String,
    pub steps: u32,
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_automations(_app: tauri::AppHandle) -> Result<Vec<Automation>, String> {
    db::with_conn(|conn| {
        let mut stmt = conn.prepare("SELECT data FROM automations ORDER BY rowid")?;
        let rows = stmt.query_map([], |row| {
            let json: String = row.get(0)?;
            serde_json::from_str(&json)
                .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))
        })?;
        rows.collect()
    })
}

#[tauri::command]
pub async fn save_automation(
    _app: tauri::AppHandle,
    automation: Automation,
) -> Result<Automation, String> {
    let mut auto = automation;

    if auto.id.is_empty() {
        auto.id = Uuid::new_v4().to_string();
        auto.created_at = chrono::Utc::now().to_rfc3339();
    }

    let json = serde_json::to_string(&auto).map_err(|e| e.to_string())?;
    db::with_conn(|conn| {
        conn.execute(
            "INSERT INTO automations (id, data) VALUES (?1, ?2)
             ON CONFLICT(id) DO UPDATE SET data = excluded.data",
            [&auto.id, &json],
        )?;
        Ok(())
    })?;

    Ok(auto)
}

#[tauri::command]
pub async fn delete_automation(_app: tauri::AppHandle, automation_id: String) -> Result<(), String> {
    db::with_conn(|conn| {
        conn.execute("DELETE FROM automations WHERE id = ?1", [&automation_id])?;
        Ok(())
    })
}

#[tauri::command]
pub async fn toggle_automation(
    _app: tauri::AppHandle,
    automation_id: String,
    enabled: bool,
) -> Result<(), String> {
    let mut automations = get_all_automations()?;

    if let Some(auto) = automations.iter_mut().find(|a| a.id == automation_id) {
        auto.enabled = enabled;
        if enabled {
            let next_run =
                chrono::Utc::now() + chrono::Duration::minutes(auto.interval_minutes as i64);
            auto.next_run = Some(next_run.to_rfc3339());
        } else {
            auto.next_run = None;
        }
        let json = serde_json::to_string(auto).map_err(|e| e.to_string())?;
        let id = auto.id.clone();
        db::with_conn(|conn| {
            conn.execute(
                "UPDATE automations SET data = ?1 WHERE id = ?2",
                [&json, &id],
            )?;
            Ok(())
        })?;
    }

    Ok(())
}

#[tauri::command]
pub async fn run_automation_now(app: tauri::AppHandle, automation_id: String) -> Result<(), String> {
    let automations = get_all_automations()?;
    let automation = automations
        .into_iter()
        .find(|a| a.id == automation_id)
        .ok_or("Automation not found")?;

    let settings = crate::settings::get_settings(app.clone()).await?;

    tokio::spawn(async move {
        execute_automation(app, automation, settings).await;
    });

    Ok(())
}

#[tauri::command]
pub async fn get_automation_logs(_app: tauri::AppHandle) -> Result<Vec<AutomationLog>, String> {
    db::with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, automation_id, timestamp, status, summary, steps
             FROM automation_logs ORDER BY timestamp DESC LIMIT 100",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(AutomationLog {
                id: row.get(0)?,
                automation_id: row.get(1)?,
                timestamp: row.get(2)?,
                status: row.get(3)?,
                summary: row.get(4)?,
                steps: row.get::<_, i64>(5)? as u32,
            })
        })?;
        rows.collect()
    })
}

#[tauri::command]
pub async fn clear_automation_logs(_app: tauri::AppHandle) -> Result<(), String> {
    db::with_conn(|conn| {
        conn.execute("DELETE FROM automation_logs", [])?;
        Ok(())
    })
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

pub async fn start_automation_scheduler(app: tauri::AppHandle) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));

    loop {
        interval.tick().await;

        let automations = match get_all_automations() {
            Ok(a) => a,
            Err(_) => continue,
        };

        let settings: AppSettings = crate::settings::get_settings(app.clone()).await.unwrap_or_default();

        let now = chrono::Utc::now();

        for automation in automations {
            if !automation.enabled {
                continue;
            }

            let should_run = automation
                .next_run
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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

fn get_all_automations() -> Result<Vec<Automation>, String> {
    db::with_conn(|conn| {
        let mut stmt = conn.prepare("SELECT data FROM automations ORDER BY rowid")?;
        let rows = stmt.query_map([], |row| {
            let json: String = row.get(0)?;
            serde_json::from_str(&json)
                .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))
        })?;
        rows.collect()
    })
}

async fn execute_automation(app: tauri::AppHandle, automation: Automation, settings: AppSettings) {
    let session_id = format!("automation_{}", automation.id);
    let browser_path = automation
        .browser_path
        .clone()
        .or_else(|| settings.preferred_browser.clone())
        .unwrap_or_default();

    let _ = app.emit(
        "automation_started",
        serde_json::json!({
            "automation_id": automation.id,
            "name": automation.name
        }),
    );

    let launch_result =
        crate::browser::launch_browser(app.clone(), browser_path, true, session_id.clone()).await;

    if let Err(e) = launch_result {
        persist_automation_result(
            &app,
            &automation,
            "error",
            &format!("Failed to launch browser: {}", e),
            0,
        )
        .await;
        return;
    }

    let task_id = format!("automation_task_{}", Uuid::new_v4());
    let result = crate::agents::run_agent_task(
        app.clone(),
        task_id,
        automation.prompt.clone(),
        session_id.clone(),
        settings,
        None,
    )
    .await;

    let (status, summary, steps) = match result {
        Ok(task) => {
            let n = task.steps.len() as u32;
            (
                "success".to_string(),
                format!("Completed with {} steps (status: {})", n, task.status),
                n,
            )
        }
        Err(e) => ("error".to_string(), e, 0),
    };

    let _ = crate::browser::close_browser(session_id).await;
    update_automation_run(&app, &automation, &status, &summary, steps).await;

    let _ = app.emit(
        "automation_completed",
        serde_json::json!({
            "automation_id": automation.id,
            "name": automation.name,
            "status": status,
            "summary": summary
        }),
    );
}

async fn persist_automation_result(
    _app: &tauri::AppHandle,
    automation: &Automation,
    status: &str,
    summary: &str,
    steps: u32,
) {
    let log_id = Uuid::new_v4().to_string();
    let _ = db::with_conn(|conn| {
        conn.execute(
            "INSERT INTO automation_logs (id, automation_id, timestamp, status, summary, steps)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                log_id,
                automation.id,
                chrono::Utc::now().to_rfc3339(),
                status,
                summary,
                steps as i64,
            ],
        )?;
        Ok(())
    });
}

async fn update_automation_run(
    app: &tauri::AppHandle,
    automation: &Automation,
    status: &str,
    summary: &str,
    steps: u32,
) {
    let mut automations = match get_all_automations() {
        Ok(a) => a,
        Err(_) => return,
    };

    if let Some(auto) = automations.iter_mut().find(|a| a.id == automation.id) {
        auto.last_run = Some(chrono::Utc::now().to_rfc3339());
        auto.last_result = Some(format!("{}: {}", status, summary));

        if auto.enabled {
            let next_run =
                chrono::Utc::now() + chrono::Duration::minutes(auto.interval_minutes as i64);
            auto.next_run = Some(next_run.to_rfc3339());
        }

        if let Ok(json) = serde_json::to_string(auto) {
            let id = auto.id.clone();
            let _ = db::with_conn(|conn| {
                conn.execute(
                    "UPDATE automations SET data = ?1 WHERE id = ?2",
                    [&json, &id],
                )?;
                Ok(())
            });
        }
    }

    persist_automation_result(app, automation, status, summary, steps).await;
}

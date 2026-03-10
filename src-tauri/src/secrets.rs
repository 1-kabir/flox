use serde::{Deserialize, Serialize};
use crate::db;

/// Lightweight summary returned by `get_secrets` — value is never included.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretSummary {
    pub id: String,
    pub name: String,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// List all secrets (names and descriptions only — values are never returned).
#[tauri::command]
pub async fn get_secrets(_app: tauri::AppHandle) -> Result<Vec<SecretSummary>, String> {
    db::with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, description, created_at, updated_at FROM secrets ORDER BY name ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(SecretSummary {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })?;
        rows.collect()
    })
}

/// Create a new secret. Returns the summary (without the value).
#[tauri::command]
pub async fn create_secret(
    _app: tauri::AppHandle,
    name: String,
    description: String,
    value: String,
) -> Result<SecretSummary, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Secret name must not be empty".to_string());
    }
    db::with_conn(|conn| {
        conn.execute(
            "INSERT INTO secrets (id, name, description, value, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![id, name, description, value, now, now],
        )?;
        Ok(SecretSummary {
            id,
            name,
            description,
            created_at: now.clone(),
            updated_at: now,
        })
    })
}

/// Update the name, description, and/or value of an existing secret.
/// If `value` is empty the stored value is left unchanged.
#[tauri::command]
pub async fn update_secret(
    _app: tauri::AppHandle,
    id: String,
    name: String,
    description: String,
    value: String,
) -> Result<SecretSummary, String> {
    let now = chrono::Utc::now().to_rfc3339();
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Secret name must not be empty".to_string());
    }
    db::with_conn(|conn| {
        let rows_changed = if value.is_empty() {
            // Update name and description only — keep the existing value.
            conn.execute(
                "UPDATE secrets SET name = ?1, description = ?2, updated_at = ?3 WHERE id = ?4",
                rusqlite::params![name, description, now, id],
            )?
        } else {
            conn.execute(
                "UPDATE secrets SET name = ?1, description = ?2, value = ?3, updated_at = ?4 WHERE id = ?5",
                rusqlite::params![name, description, value, now, id],
            )?
        };
        if rows_changed == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        // Fetch the created_at for the returned summary.
        let created_at: String = conn.query_row(
            "SELECT created_at FROM secrets WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )?;
        Ok(SecretSummary {
            id,
            name,
            description,
            created_at,
            updated_at: now,
        })
    })
}

/// Delete a secret by ID.
#[tauri::command]
pub async fn delete_secret(_app: tauri::AppHandle, id: String) -> Result<(), String> {
    db::with_conn(|conn| {
        conn.execute("DELETE FROM secrets WHERE id = ?1", rusqlite::params![id])?;
        Ok(())
    })
}

// ---------------------------------------------------------------------------
// Internal helpers (not exposed as Tauri commands)
// ---------------------------------------------------------------------------

/// Fetch a map of `name → value` for ALL secrets stored in the database.
/// This is called by the agent executor to resolve `{{secret_name}}` placeholders
/// just before a browser action is dispatched — the LLM never sees the values.
pub fn load_secret_map() -> Result<std::collections::HashMap<String, String>, String> {
    db::with_conn(|conn| {
        let mut stmt = conn.prepare("SELECT name, value FROM secrets")?;
        let pairs = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        let mut map = std::collections::HashMap::new();
        for pair in pairs {
            let (name, value) = pair?;
            map.insert(name, value);
        }
        Ok(map)
    })
}

/// Replace every `{{secret_name}}` placeholder inside `text` with the
/// corresponding value from `secrets`.  Unknown placeholders are left unchanged
/// so the agent can still surface them in error messages if needed.
pub fn resolve_placeholders(text: &str, secrets: &std::collections::HashMap<String, String>) -> String {
    let mut result = text.to_string();
    for (name, value) in secrets {
        let placeholder = format!("{{{{{}}}}}", name);
        result = result.replace(&placeholder, value);
    }
    result
}

/// Resolve all `{{secret_name}}` placeholders in a `BrowserAction`.
/// Only the fields that carry user-supplied text are processed (`value`, `url`).
pub fn resolve_secrets_in_action(
    action: &crate::browser::BrowserAction,
    secrets: &std::collections::HashMap<String, String>,
) -> crate::browser::BrowserAction {
    crate::browser::BrowserAction {
        value: action.value.as_deref().map(|v| resolve_placeholders(v, secrets)),
        url: action.url.as_deref().map(|u| resolve_placeholders(u, secrets)),
        // All other fields are copied verbatim.
        action_type: action.action_type.clone(),
        selector: action.selector.clone(),
        x: action.x,
        y: action.y,
        key: action.key.clone(),
        scroll_x: action.scroll_x,
        scroll_y: action.scroll_y,
        screenshot: action.screenshot,
    }
}

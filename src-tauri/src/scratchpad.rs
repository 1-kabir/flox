use crate::db;

/// Upsert a key-value entry for the given task.
pub fn scratchpad_write(task_id: &str, key: &str, value: &str) -> Result<(), String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    db::with_conn(|conn| {
        conn.execute(
            "INSERT INTO task_scratchpad (id, task_id, key, value, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?5)
             ON CONFLICT(task_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            rusqlite::params![id, task_id, key, value, now],
        )?;
        Ok(())
    })
}

/// Return the value for a given task/key, or `None` if not found.
pub fn scratchpad_read(task_id: &str, key: &str) -> Result<Option<String>, String> {
    db::with_conn(|conn| {
        let mut stmt = conn
            .prepare("SELECT value FROM task_scratchpad WHERE task_id = ?1 AND key = ?2 LIMIT 1")?;
        let mut rows = stmt.query(rusqlite::params![task_id, key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    })
}

/// Return all key-value pairs for a task.
pub fn scratchpad_read_all(task_id: &str) -> Result<Vec<(String, String)>, String> {
    db::with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT key, value FROM task_scratchpad WHERE task_id = ?1 ORDER BY updated_at ASC",
        )?;
        let rows = stmt.query_map(rusqlite::params![task_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
    })
}

/// Delete all scratchpad entries for a task.
pub fn scratchpad_clear(task_id: &str) -> Result<(), String> {
    db::with_conn(|conn| {
        conn.execute(
            "DELETE FROM task_scratchpad WHERE task_id = ?1",
            rusqlite::params![task_id],
        )?;
        Ok(())
    })
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn scratchpad_write_cmd(
    task_id: String,
    key: String,
    value: String,
) -> Result<(), String> {
    scratchpad_write(&task_id, &key, &value)
}

#[tauri::command]
pub async fn scratchpad_read_cmd(task_id: String, key: String) -> Result<Option<String>, String> {
    scratchpad_read(&task_id, &key)
}

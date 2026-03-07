use serde::{Deserialize, Serialize};

use crate::db;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub session_id: Option<String>,
    pub browser_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
    pub agent: Option<String>,
    pub screenshot: Option<String>,
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_conversations(_app: tauri::AppHandle) -> Result<Vec<Conversation>, String> {
    db::with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, title, created_at, session_id, browser_path
             FROM conversations ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Conversation {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                session_id: row.get(3)?,
                browser_path: row.get(4)?,
            })
        })?;
        rows.collect()
    })
}

#[tauri::command]
pub async fn save_conversation(
    _app: tauri::AppHandle,
    conversation: Conversation,
) -> Result<(), String> {
    db::with_conn(|conn| {
        conn.execute(
            "INSERT INTO conversations (id, title, created_at, session_id, browser_path)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET
               title        = excluded.title,
               session_id   = excluded.session_id,
               browser_path = excluded.browser_path",
            rusqlite::params![
                conversation.id,
                conversation.title,
                conversation.created_at,
                conversation.session_id,
                conversation.browser_path,
            ],
        )?;
        Ok(())
    })
}

#[tauri::command]
pub async fn delete_conversation(
    _app: tauri::AppHandle,
    conversation_id: String,
) -> Result<(), String> {
    db::with_conn(|conn| {
        // ON DELETE CASCADE will remove messages too.
        conn.execute(
            "DELETE FROM conversations WHERE id = ?1",
            [&conversation_id],
        )?;
        Ok(())
    })
}

#[tauri::command]
pub async fn get_messages(
    _app: tauri::AppHandle,
    conversation_id: String,
) -> Result<Vec<Message>, String> {
    db::with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, conversation_id, role, content, timestamp, agent, screenshot
             FROM messages WHERE conversation_id = ?1 ORDER BY timestamp",
        )?;
        let rows = stmt.query_map([&conversation_id], |row| {
            Ok(Message {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                timestamp: row.get(4)?,
                agent: row.get(5)?,
                screenshot: row.get(6)?,
            })
        })?;
        rows.collect()
    })
}

#[tauri::command]
pub async fn save_message(_app: tauri::AppHandle, message: Message) -> Result<(), String> {
    db::with_conn(|conn| {
        conn.execute(
            "INSERT INTO messages
               (id, conversation_id, role, content, timestamp, agent, screenshot)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET
               content    = excluded.content,
               agent      = excluded.agent,
               screenshot = excluded.screenshot",
            rusqlite::params![
                message.id,
                message.conversation_id,
                message.role,
                message.content,
                message.timestamp,
                message.agent,
                message.screenshot,
            ],
        )?;
        Ok(())
    })
}

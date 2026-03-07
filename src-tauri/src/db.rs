use rusqlite::{Connection, Result as SqlResult};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

static DB: OnceLock<Mutex<Connection>> = OnceLock::new();

/// Initialise (or open) the SQLite database and create all tables.
pub fn init(app_data_dir: PathBuf) -> SqlResult<()> {
    let db_path = app_data_dir.join("flox.db");
    let conn = Connection::open(&db_path)?;

    conn.execute_batch("PRAGMA journal_mode=WAL;")?;

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS automations (
            id               TEXT PRIMARY KEY,
            data             TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS skills (
            id               TEXT PRIMARY KEY,
            data             TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS conversations (
            id               TEXT PRIMARY KEY,
            title            TEXT NOT NULL,
            created_at       TEXT NOT NULL,
            session_id       TEXT,
            browser_path     TEXT
        );

        CREATE TABLE IF NOT EXISTS messages (
            id               TEXT PRIMARY KEY,
            conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            role             TEXT NOT NULL,
            content          TEXT NOT NULL,
            timestamp        TEXT NOT NULL,
            agent            TEXT,
            screenshot       TEXT
        );

        CREATE TABLE IF NOT EXISTS agent_steps (
            id               TEXT PRIMARY KEY,
            task_id          TEXT NOT NULL,
            data             TEXT NOT NULL,
            created_at       TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS automation_logs (
            id               TEXT PRIMARY KEY,
            automation_id    TEXT NOT NULL,
            timestamp        TEXT NOT NULL,
            status           TEXT NOT NULL,
            summary          TEXT NOT NULL,
            steps            INTEGER NOT NULL DEFAULT 0
        );
        ",
    )?;

    // Ignore if already initialised (e.g. hot-reload in dev).
    let _ = DB.set(Mutex::new(conn));

    Ok(())
}

/// Acquire a lock on the global DB connection.
pub fn with_conn<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce(&Connection) -> SqlResult<T>,
{
    let db = DB.get().ok_or("Database not initialised")?;
    let conn = db.lock().map_err(|e| e.to_string())?;
    f(&conn).map_err(|e| e.to_string())
}

use serde::{Deserialize, Serialize};

use crate::db;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ModelConfig {
    pub provider: String,
    pub model: String,
    pub api_key: String,
    pub base_url: Option<String>,
    pub temperature: f32,
    pub max_tokens: u32,
    /// When true, send a screenshot of the page to the model (vision / multimodal mode).
    /// Requires a vision-capable model (e.g. gpt-4o, gemini-1.5-pro, llava).
    #[serde(default)]
    pub vision: bool,
}

/// Controls how risky browser actions are routed for human review.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum HilRoutingMode {
    /// Every risky action requires human approval (default).
    #[default]
    All,
    /// All actions are auto-approved; no human intervention.
    None,
    /// AI verifier decides; only uncertain/destructive actions reach the human.
    Auto,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub planner_model: ModelConfig,
    pub navigator_model: ModelConfig,
    pub verifier_model: ModelConfig,
    pub preferred_browser: Option<String>,
    pub headless_mode: bool,
    pub theme: String,
    pub screenshots_enabled: bool,
    pub planner_vision: bool,
    pub navigator_vision: bool,
    pub max_steps: u32,
    pub timeout_seconds: u32,
    /// How risky actions are routed for human-in-the-loop review.
    #[serde(default)]
    pub hil_routing_mode: HilRoutingMode,
    /// If true, agents automatically retry with a different strategy when an action is denied.
    #[serde(default)]
    pub auto_try_alternatives: bool,
    /// Whether the user has completed the first-run onboarding flow.
    #[serde(default)]
    pub onboarding_complete: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            planner_model: ModelConfig {
                provider: "openai".to_string(),
                model: "gpt-4o".to_string(),
                api_key: String::new(),
                base_url: None,
                temperature: 0.7,
                max_tokens: 2048,
                vision: false,
            },
            navigator_model: ModelConfig {
                provider: "openai".to_string(),
                model: "gpt-4o".to_string(),
                api_key: String::new(),
                base_url: None,
                temperature: 0.3,
                max_tokens: 1024,
                vision: true,
            },
            verifier_model: ModelConfig {
                provider: "openai".to_string(),
                model: "gpt-4o-mini".to_string(),
                api_key: String::new(),
                base_url: None,
                temperature: 0.1,
                max_tokens: 512,
                vision: false,
            },
            preferred_browser: None,
            headless_mode: false,
            theme: "dark".to_string(),
            screenshots_enabled: true,
            planner_vision: false,
            navigator_vision: true,
            max_steps: 50,
            timeout_seconds: 300,
            hil_routing_mode: HilRoutingMode::All,
            auto_try_alternatives: false,
            onboarding_complete: false,
        }
    }
}

#[tauri::command]
pub async fn get_settings(_app: tauri::AppHandle) -> Result<AppSettings, String> {
    db::with_conn(|conn| {
        let result: rusqlite::Result<String> = conn.query_row(
            "SELECT value FROM settings WHERE key = 'settings'",
            [],
            |row| row.get(0),
        );
        match result {
            Ok(json) => serde_json::from_str(&json)
                .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string())),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(AppSettings::default()),
            Err(e) => Err(e),
        }
    })
}

#[tauri::command]
pub async fn save_settings(_app: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    let json = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
    db::with_conn(|conn| {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('settings', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [&json],
        )?;
        Ok(())
    })
}

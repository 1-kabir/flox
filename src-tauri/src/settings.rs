use serde::{Deserialize, Serialize};
use tauri_plugin_store::StoreExt;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ModelConfig {
    pub provider: String,
    pub model: String,
    pub api_key: String,
    pub base_url: Option<String>,
    pub temperature: f32,
    pub max_tokens: u32,
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
    pub max_steps: u32,
    pub timeout_seconds: u32,
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
            },
            navigator_model: ModelConfig {
                provider: "openai".to_string(),
                model: "gpt-4o".to_string(),
                api_key: String::new(),
                base_url: None,
                temperature: 0.3,
                max_tokens: 1024,
            },
            verifier_model: ModelConfig {
                provider: "openai".to_string(),
                model: "gpt-4o-mini".to_string(),
                api_key: String::new(),
                base_url: None,
                temperature: 0.1,
                max_tokens: 512,
            },
            preferred_browser: None,
            headless_mode: false,
            theme: "dark".to_string(),
            screenshots_enabled: true,
            max_steps: 50,
            timeout_seconds: 300,
        }
    }
}

#[tauri::command]
pub async fn get_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    let store = app.store("flox_store.bin").map_err(|e| e.to_string())?;

    let settings = store
        .get("settings")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    Ok(settings)
}

#[tauri::command]
pub async fn save_settings(app: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    let store = app.store("flox_store.bin").map_err(|e| e.to_string())?;

    store.set(
        "settings",
        serde_json::to_value(&settings).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;

    Ok(())
}

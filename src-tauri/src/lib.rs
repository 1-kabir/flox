mod browser;
mod automation;
mod settings;
mod agents;

use tauri_plugin_store::StoreExt;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let store = app.store("flox_store.bin")?;
            drop(store);

            // Set up automation scheduler
            let app_handle = app.handle().clone();
            tokio::spawn(async move {
                automation::start_automation_scheduler(app_handle).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            browser::detect_browsers,
            browser::launch_browser,
            browser::close_browser,
            browser::take_screenshot,
            browser::execute_action,
            agents::run_agent_task,
            agents::stop_agent_task,
            settings::get_settings,
            settings::save_settings,
            automation::get_automations,
            automation::save_automation,
            automation::delete_automation,
            automation::toggle_automation,
            automation::run_automation_now,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

mod browser;
mod automation;
mod settings;
mod agents;
mod skills;
mod db;
mod network;
mod conversations;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Initialise SQLite database.
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("app data dir not available");
            std::fs::create_dir_all(&data_dir)?;
            db::init(data_dir).map_err(|e| e.to_string())?;

            // Set up automation scheduler.
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
            agents::resolve_approval,
            settings::get_settings,
            settings::save_settings,
            automation::get_automations,
            automation::save_automation,
            automation::delete_automation,
            automation::toggle_automation,
            automation::run_automation_now,
            automation::get_automation_logs,
            automation::clear_automation_logs,
            skills::get_skills,
            skills::install_skill,
            skills::create_skill,
            skills::update_skill,
            skills::uninstall_skill,
            skills::toggle_skill,
            conversations::get_conversations,
            conversations::save_conversation,
            conversations::delete_conversation,
            conversations::get_messages,
            conversations::save_message,
            network::check_network,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

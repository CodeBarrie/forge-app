mod commands;
use commands::*;
use std::sync::{Arc, Mutex};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state: AppState = Arc::new(Mutex::new(ProcessStore::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            start_session,
            write_to_session,
            resize_session,
            kill_session,
            save_session,
            delete_session,
            load_sessions,
            generate_summary,
            export_log,
            open_logs_dir,
            list_screenshots,
            read_screenshot_thumbnail,
            check_dir_exists,
            export_transcript,
        ])
        .setup(|app| {
            let windows = app.webview_windows();
            for (_label, window) in &windows {
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Forge");
}

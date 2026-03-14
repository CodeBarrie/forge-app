mod commands;
use commands::*;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state: AppState = Arc::new(Mutex::new(ProcessStore::new()));
    let sysinfo_state: SysInfoState = Arc::new(Mutex::new(sysinfo::System::new_all()));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .manage(sysinfo_state)
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
            get_system_stats,
            get_git_info,
            list_directory,
            read_file_preview,
            save_prompt_template,
            load_prompt_templates,
            delete_prompt_template,
            get_git_diff,
            get_git_changed_files,
            git_stage_file,
            git_unstage_file,
        ])
        .setup(|app| {
            // Show and focus main window
            let windows = app.webview_windows();
            for (_label, window) in &windows {
                let _ = window.show();
                let _ = window.set_focus();
            }

            // System tray
            let quick_i = MenuItem::with_id(app, "quick", "Quick Session", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit Forge", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quick_i, &show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("Forge")
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quick" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.emit("tray-quick-session", ());
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Forge");
}

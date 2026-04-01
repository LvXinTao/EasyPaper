pub mod sidecar;
pub mod error_dialog;
pub mod port_check;

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind, RotationStrategy};
use tauri_plugin_shell::process::CommandChild;

/// Stores the sidecar child process for cleanup on app exit
pub struct SidecarProcess(pub Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new()
            .targets([
                Target::new(TargetKind::Folder {
                    path: get_log_dir(),
                    file_name: Some("easypaper".to_string()),
                }),
                Target::new(TargetKind::Stdout),
            ])
            .rotation_strategy(RotationStrategy::KeepAll)
            .build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .setup(|app| {
            let app_handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                // Check if CLI is already running
                if let Some(port) = port_check::detect_cli_running() {
                    let msg = format!("EasyPaper CLI is already running on port {}. Please close it before starting the desktop app.", port);
                    error_dialog::show_startup_error(&app_handle, &msg);
                    return;
                }

                // Start sidecar
                match sidecar::start_and_wait(&app_handle).await {
                    Ok((port, child)) => {
                        log::info!("Sidecar ready on port {}", port);

                        // Store child handle in app state for cleanup on exit
                        app_handle.manage(SidecarProcess(std::sync::Mutex::new(Some(child))));

                        if let Some(window) = app_handle.get_webview_window("main") {
                            let url = format!("http://localhost:{}", port);
                            // Use WebviewWindow::eval to navigate
                            let _ = window.eval(&format!("window.location.href = '{}'", url));
                            let _ = window.show();

                            // Setup window close handler to kill sidecar
                            let app_h = app_handle.clone();
                            let _ = window.on_window_event(move |event| {
                                if let tauri::WindowEvent::CloseRequested { .. } = event {
                                    log::info!("Window closing, killing sidecar...");
                                    if let Some(state) = app_h.try_state::<SidecarProcess>() {
                                        if let Ok(mut guard) = state.0.lock() {
                                            if let Some(c) = guard.take() {
                                                let _ = c.kill();
                                            }
                                        }
                                    }
                                }
                            });
                        }
                    }
                    Err(e) => {
                        log::error!("Sidecar error: {}", e);
                        error_dialog::show_startup_error(&app_handle, &e.to_string());
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn get_log_dir() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("/tmp"))
            .join("Library/Logs/EasyPaper")
    }
    #[cfg(target_os = "windows")]
    {
        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("EasyPaper/logs")
    }
    #[cfg(target_os = "linux")]
    {
        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("/tmp"))
            .join("easypaper/logs")
    }
}
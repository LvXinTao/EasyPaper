pub mod sidecar;
pub mod error_dialog;
pub mod port_check;

use std::path::PathBuf;
use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind, RotationStrategy};

#[cfg(not(debug_assertions))]
use std::sync::Mutex;
#[cfg(not(debug_assertions))]
use tauri_plugin_shell::process::CommandChild;
#[cfg(not(debug_assertions))]
use nix::sys::signal::{kill, Signal};
#[cfg(not(debug_assertions))]
use nix::unistd::Pid;

/// Stores the sidecar child process for cleanup on app exit
#[cfg(not(debug_assertions))]
pub struct SidecarProcess(pub Mutex<Option<SidecarInfo>>);

/// Holds both the CommandChild (for Tauri's internal tracking) and the PID (for graceful shutdown)
#[cfg(not(debug_assertions))]
pub struct SidecarInfo {
    pub child: CommandChild,
    pub pid: u32,
}

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

            // Use compile-time detection for dev mode
            // In debug builds, beforeDevCommand runs the Next.js dev server
            // In release builds, we need to start the sidecar ourselves
            #[cfg(debug_assertions)]
            {
                log::info!("Running in dev mode - skipping sidecar startup");
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                }
                return Ok(());
            }

            #[cfg(not(debug_assertions))]
            tauri::async_runtime::spawn(async move {
                // Check if CLI is already running (only in production mode)
                if let Some(port) = port_check::detect_cli_running() {
                    let msg = format!("EasyPaper CLI is already running on port {}. Please close it before starting the desktop app.", port);
                    error_dialog::show_startup_error(&app_handle, &msg);
                    return;
                }

                // Start sidecar (only in production mode)
                match sidecar::start_and_wait(&app_handle).await {
                    Ok((port, child)) => {
                        log::info!("Sidecar ready on port {}", port);

                        // Get PID before storing (for graceful shutdown)
                        let pid = child.pid();

                        // Store child handle in app state for cleanup on exit
                        app_handle.manage(SidecarProcess(std::sync::Mutex::new(Some(SidecarInfo {
                            child,
                            pid,
                        }))));

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
                                            if let Some(info) = guard.take() {
                                                // Send SIGTERM for graceful shutdown
                                                let pid = Pid::from_raw(info.pid as i32);
                                                match kill(pid, Signal::SIGTERM) {
                                                    Ok(_) => log::info!("Sent SIGTERM to sidecar (PID: {})", info.pid),
                                                    Err(e) => {
                                                        log::warn!("Failed to send SIGTERM: {}, falling back to kill()", e);
                                                        let _ = info.child.kill();
                                                    }
                                                }
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

            // This line is needed for debug builds (where #[cfg(not(debug_assertions))] block is empty)
            #[allow(unreachable_code)]
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
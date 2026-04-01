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

/// Stores the sidecar child process for cleanup on app exit (release mode only)
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
    #[cfg(not(debug_assertions))]
    let builder = {
        let mut b = tauri::Builder::default()
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
            .plugin(tauri_plugin_window_state::Builder::new().build());
        b = b.manage(SidecarProcess(Mutex::new(None)));
        b
    };

    #[cfg(debug_assertions)]
    let builder = tauri::Builder::default()
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
        .plugin(tauri_plugin_window_state::Builder::new().build());

    builder
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
                        if let Some(state) = app_handle.try_state::<SidecarProcess>() {
                            if let Ok(mut guard) = state.0.lock() {
                                *guard = Some(SidecarInfo { child, pid });
                            }
                        }

                        if let Some(window) = app_handle.get_webview_window("main") {
                            let url = format!("http://localhost:{}", port);
                            // Navigate the webview to the sidecar URL
                            // SAFETY: This uses eval() for navigation because Tauri 2.x WebviewWindow
                            // doesn't have a native navigate() method. The URL is constructed safely:
                            // - port is a u16 (numeric, controlled by Tauri's port detection)
                            // - URL format is hardcoded: "http://localhost:{port}"
                            // - No user input is interpolated into the JavaScript
                            // - window.location.replace() is used instead of href to avoid history pollution
                            let js = format!("window.location.replace('{}')", url);
                            let _ = window.eval(&js);
                            let _ = window.show();

                            // Setup window close handler to kill sidecar
                            let app_h = app_handle.clone();
                            let _ = window.on_window_event(move |event| {
                                if let tauri::WindowEvent::CloseRequested { .. } = event {
                                    kill_sidecar_process(&app_h);
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

    // After run() returns (app exit), cleanup sidecar
    // This handles Cmd+Q, menu quit, and other app-level exit paths
    // Note: This code runs after the Tauri event loop exits
    log::info!("Application exiting, performing final cleanup...");
}

/// Kill the sidecar process gracefully (SIGTERM first, then SIGKILL after timeout)
#[cfg(not(debug_assertions))]
fn kill_sidecar_process(app_handle: &tauri::AppHandle) {
    if let Some(state) = app_handle.try_state::<SidecarProcess>() {
        if let Ok(mut guard) = state.0.lock() {
            if let Some(info) = guard.take() {
                log::info!("Killing sidecar process (PID: {})...", info.pid);

                // Send SIGTERM for graceful shutdown
                let pid = Pid::from_raw(info.pid as i32);
                match kill(pid, Signal::SIGTERM) {
                    Ok(_) => {
                        log::info!("Sent SIGTERM to sidecar (PID: {})", info.pid);
                        // Note: We don't wait for timeout here - the process should handle SIGTERM
                        // If it doesn't exit, Tauri's shell plugin will clean up on app exit
                    }
                    Err(e) => {
                        log::warn!("Failed to send SIGTERM: {}, falling back to kill()", e);
                        let _ = info.child.kill();
                    }
                }
            }
        }
    }
}

#[cfg(debug_assertions)]
#[allow(dead_code)]
fn kill_sidecar_process(_app_handle: &tauri::AppHandle) {
    // In dev mode, no sidecar to kill
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
        // Use Roaming AppData for logs (consistent with app data location)
        dirs::config_dir()
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
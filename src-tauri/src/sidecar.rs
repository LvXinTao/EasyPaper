use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use thiserror::Error;

const READY_TIMEOUT_SECS: u64 = 10;

#[derive(Error, Debug)]
pub enum SidecarError {
    #[error("Sidecar binary not found")]
    BinaryNotFound,
    #[error("Port conflict: all ports 3000-3100 occupied")]
    PortConflict,
    #[error("Startup timeout after {0} seconds")]
    StartupTimeout(u64),
    #[error("Ready signal parse error: {0}")]
    SignalParseError(String),
    #[error("Sidecar process error: {0}")]
    ProcessError(String),
    #[error("Failed to spawn sidecar: {0}")]
    SpawnError(String),
}

/// Start sidecar and wait for ready signal
/// Returns (port, child_handle) so caller can manage process lifecycle
pub async fn start_and_wait(app: &AppHandle) -> Result<(u16, CommandChild), SidecarError> {
    log::info!("Starting sidecar...");

    // Use Tauri's sidecar API (not generic command)
    let sidecar = app.shell()
        .sidecar("easypaper-server")
        .map_err(|e| SidecarError::SpawnError(e.to_string()))?;

    // Don't override DATA_DIR/CONFIG_DIR — let the Node.js server use its
    // built-in default (~/.easypaper/) so CLI and desktop share the same path.
    let (mut rx, child) = sidecar
        .args(["--ready-signal"])
        .env("PORT", "3000")
        .spawn()
        .map_err(|e| {
            log::error!("Failed to spawn sidecar: {}", e);
            if e.to_string().contains("not found") {
                SidecarError::BinaryNotFound
            } else {
                SidecarError::ProcessError(e.to_string())
            }
        })?;

    log::info!("Sidecar spawned, waiting for ready signal...");

    // Wait for ready signal with timeout
    let result = tokio::time::timeout(
        Duration::from_secs(READY_TIMEOUT_SECS),
        async {
            // Inline wait_for_ready_signal to avoid type naming issues
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(line_bytes) => {
                        let line = String::from_utf8_lossy(&line_bytes);
                        let line = line.trim();
                        log::info!("Sidecar stdout: {}", line);

                        if line.starts_with("EASYPAPER_READY:") {
                            let port_str = line.strip_prefix("EASYPAPER_READY:").unwrap();
                            let port: u16 = port_str.parse()
                                .map_err(|e| format!("Port parse error: {}", e))?;
                            return Ok(port);
                        }

                        if line.starts_with("EASYPAPER_ERROR:") {
                            let error = line.strip_prefix("EASYPAPER_ERROR:").unwrap();
                            return Err(error.to_string());
                        }
                    }
                    CommandEvent::Stderr(line_bytes) => {
                        let line = String::from_utf8_lossy(&line_bytes);
                        log::warn!("Sidecar stderr: {}", line.trim());
                    }
                    CommandEvent::Error(err) => {
                        log::error!("Sidecar error: {}", err);
                        return Err(err);
                    }
                    CommandEvent::Terminated(payload) => {
                        log::error!("Sidecar terminated with code: {:?}", payload.code);
                        return Err(format!("Sidecar terminated unexpectedly with code: {:?}", payload.code));
                    }
                    _ => {}
                }
            }
            Err("No ready signal received".to_string())
        }
    )
    .await;

    match result {
        Ok(Ok(port)) => {
            log::info!("Sidecar ready on port {}", port);
            Ok((port, child))
        }
        Ok(Err(e)) => {
            log::error!("Ready signal error: {}", e);
            // Kill child on error
            let _ = child.kill();
            Err(SidecarError::SignalParseError(e))
        }
        Err(_) => {
            log::error!("Sidecar startup timeout");
            // Kill child on timeout
            let _ = child.kill();
            Err(SidecarError::StartupTimeout(READY_TIMEOUT_SECS))
        }
    }
}

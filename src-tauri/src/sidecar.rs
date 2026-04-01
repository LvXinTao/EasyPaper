use tauri::AppHandle;
use tauri_plugin_shell::process::CommandChild;
use std::error::Error;

/// Start the sidecar process and wait for it to be ready
pub async fn start_and_wait(_app_handle: &AppHandle) -> Result<(u16, CommandChild), Box<dyn Error + Send + Sync>> {
    todo!("sidecar::start_and_wait not yet implemented")
}
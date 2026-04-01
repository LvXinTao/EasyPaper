use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

/// Show startup error dialog and exit
pub fn show_startup_error(app: &AppHandle, message: &str) {
    log::error!("Startup error: {}", message);

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
    }

    app.dialog()
        .message(message)
        .title("EasyPaper Startup Error")
        .kind(tauri_plugin_dialog::MessageDialogKind::Error)
        .buttons(tauri_plugin_dialog::Buttons::Ok)
        .show(|_| {
            std::process::exit(1);
        });
}

/// Show warning dialog
pub fn show_warning(app: &AppHandle, title: &str, message: &str) {
    app.dialog()
        .message(message)
        .title(title)
        .kind(tauri_plugin_dialog::MessageDialogKind::Warning)
        .buttons(tauri_plugin_dialog::Buttons::Ok)
        .show(|_| {});
}
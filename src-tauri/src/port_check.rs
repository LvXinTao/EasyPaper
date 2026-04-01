use std::net::TcpStream;

/// Check if a port is in use (something is listening)
fn is_port_in_use(port: u16) -> bool {
    TcpStream::connect(format!("127.0.0.1:{}", port)).is_ok()
}

/// Detect if EasyPaper CLI is already running
/// Returns Some(port) if CLI detected, None otherwise
pub fn detect_cli_running() -> Option<u16> {
    // Check ports 3000-3100 for existing EasyPaper instance
    for port in 3000..=3100 {
        if is_port_in_use(port) {
            // Try to connect and check if it's EasyPaper
            // For simplicity, we assume any server on these ports is CLI
            // A more robust solution would send an HTTP request to verify
            return Some(port);
        }
    }
    None
}
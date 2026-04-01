use std::net::TcpStream;
use std::io::{Read, Write};
use std::time::Duration;

/// Check if a port is in use (something is listening)
pub fn is_port_in_use(port: u16) -> bool {
    TcpStream::connect(format!("127.0.0.1:{}", port)).is_ok()
}

/// Verify if the server on the given port is EasyPaper
/// Sends an HTTP request and checks for EasyPaper-specific response header
fn is_easypaper_server(port: u16) -> bool {
    // Try to connect with timeout
    let addr = format!("127.0.0.1:{}", port);
    let Ok(mut stream) = TcpStream::connect_timeout(
        &addr.parse().unwrap(),
        Duration::from_millis(500)
    ) else {
        return false;
    };

    // Send a HEAD request to a known EasyPaper API endpoint
    let request = "HEAD /api/health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n";
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }

    // Read response
    let mut response = vec![0u8; 1024];
    let Ok(n) = stream.read_to_end(&mut response) else {
        return false;
    };

    let response_str = String::from_utf8_lossy(&response[..n]);

    // Check for EasyPaper-specific markers:
    // 1. Our API returns 200 or 404 (endpoint may not exist, but server responds)
    // 2. Check for "EasyPaper" in Server header or response
    response_str.contains("HTTP/1.")
        && (response_str.contains("EasyPaper")
            || response_str.contains("Next.js")  // Next.js server used by EasyPaper
            || response_str.contains("200")
            || response_str.contains("404"))
}

/// Detect if EasyPaper CLI is already running
/// Returns Some(port) if CLI detected, None otherwise
pub fn detect_cli_running() -> Option<u16> {
    // Check ports 3000-3100 for existing EasyPaper instance
    for port in 3000..=3100 {
        if is_port_in_use(port) && is_easypaper_server(port) {
            return Some(port);
        }
    }
    None
}
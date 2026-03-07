use std::net::TcpStream;
use std::time::Duration;

/// Check whether the machine has network connectivity by attempting a TCP
/// connection to `8.8.8.8:53` (Google DNS) with a short timeout.
pub fn is_online() -> bool {
    TcpStream::connect_timeout(
        &"8.8.8.8:53".parse().expect("hardcoded DNS address 8.8.8.8:53 must be valid"),
        Duration::from_secs(2),
    )
    .is_ok()
}

/// Tauri command: return `true` if the host has network access.
#[tauri::command]
pub async fn check_network() -> bool {
    tokio::task::spawn_blocking(is_online)
        .await
        .unwrap_or(false)
}

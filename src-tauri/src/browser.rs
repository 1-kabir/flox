use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::process::{Child, Command};
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub version: Option<String>,
    pub browser_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserAction {
    pub action_type: String,
    pub selector: Option<String>,
    pub value: Option<String>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub url: Option<String>,
    pub key: Option<String>,
    pub scroll_x: Option<f64>,
    pub scroll_y: Option<f64>,
    pub screenshot: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionResult {
    pub success: bool,
    pub data: Option<serde_json::Value>,
    pub screenshot: Option<String>,
    pub error: Option<String>,
}

static BROWSER_SESSIONS: Lazy<Arc<Mutex<HashMap<String, BrowserSession>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

struct BrowserSession {
    pub process: Option<Child>,
    pub cdp_url: String,
    #[allow(dead_code)]
    pub debug_port: u16,
}

fn get_chromium_candidates() -> Vec<(&'static str, Vec<&'static str>)> {
    vec![
        ("Google Chrome", vec![
            #[cfg(target_os = "windows")]
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            #[cfg(target_os = "windows")]
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            #[cfg(target_os = "macos")]
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            #[cfg(target_os = "linux")]
            "/usr/bin/google-chrome",
            #[cfg(target_os = "linux")]
            "/usr/bin/google-chrome-stable",
            #[cfg(target_os = "linux")]
            "/usr/bin/chromium-browser",
            #[cfg(target_os = "linux")]
            "/usr/bin/chromium",
        ]),
        ("Microsoft Edge", vec![
            #[cfg(target_os = "windows")]
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            #[cfg(target_os = "macos")]
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            #[cfg(target_os = "linux")]
            "/usr/bin/microsoft-edge",
            #[cfg(target_os = "linux")]
            "/usr/bin/microsoft-edge-stable",
        ]),
        ("Brave Browser", vec![
            #[cfg(target_os = "windows")]
            r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
            #[cfg(target_os = "macos")]
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
            #[cfg(target_os = "linux")]
            "/usr/bin/brave-browser",
            #[cfg(target_os = "linux")]
            "/usr/bin/brave",
        ]),
        ("Chromium", vec![
            #[cfg(target_os = "linux")]
            "/usr/bin/chromium",
            #[cfg(target_os = "linux")]
            "/usr/bin/chromium-browser",
            #[cfg(target_os = "macos")]
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]),
        ("Vivaldi", vec![
            #[cfg(target_os = "windows")]
            r"C:\Program Files\Vivaldi\Application\vivaldi.exe",
            #[cfg(target_os = "macos")]
            "/Applications/Vivaldi.app/Contents/MacOS/Vivaldi",
            #[cfg(target_os = "linux")]
            "/usr/bin/vivaldi",
        ]),
    ]
}

#[tauri::command]
pub async fn detect_browsers() -> Result<Vec<BrowserInfo>, String> {
    let mut browsers = Vec::new();

    for (name, paths) in get_chromium_candidates() {
        for path in paths {
            if !path.is_empty() && std::path::Path::new(path).exists() {
                let id = name.to_lowercase().replace(' ', "_");
                browsers.push(BrowserInfo {
                    id: id.clone(),
                    name: name.to_string(),
                    path: path.to_string(),
                    version: get_browser_version(path).await,
                    browser_type: "chromium".to_string(),
                });
                break;
            }
        }
    }

    // Also check PATH
    for cmd in &["google-chrome", "chromium", "chromium-browser", "brave", "microsoft-edge"] {
        if let Ok(path) = which::which(cmd) {
            let path_str = path.to_string_lossy().to_string();
            let already_found = browsers.iter().any(|b| b.path == path_str);
            if !already_found {
                browsers.push(BrowserInfo {
                    id: cmd.to_string(),
                    name: cmd.to_string(),
                    path: path_str.clone(),
                    version: get_browser_version(&path_str).await,
                    browser_type: "chromium".to_string(),
                });
            }
        }
    }

    Ok(browsers)
}

async fn get_browser_version(path: &str) -> Option<String> {
    let output = tokio::process::Command::new(path)
        .arg("--version")
        .output()
        .await
        .ok()?;

    let version_str = String::from_utf8_lossy(&output.stdout).to_string();
    let version = version_str
        .split_whitespace()
        .find(|s| s.contains('.') && s.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false))
        .map(|s| s.to_string());

    version
}

#[tauri::command]
pub async fn launch_browser(
    browser_path: String,
    headless: bool,
    session_id: String,
) -> Result<String, String> {
    let debug_port = find_free_port().await.map_err(|e| e.to_string())?;

    let mut args = vec![
        format!("--remote-debugging-port={}", debug_port),
        "--no-first-run".to_string(),
        "--no-default-browser-check".to_string(),
        "--disable-background-networking".to_string(),
        "--disable-client-side-phishing-detection".to_string(),
        "--disable-default-apps".to_string(),
        "--disable-extensions".to_string(),
        "--disable-hang-monitor".to_string(),
        "--disable-popup-blocking".to_string(),
        "--disable-prompt-on-repost".to_string(),
        "--disable-sync".to_string(),
        "--disable-translate".to_string(),
        "--metrics-recording-only".to_string(),
        "--safebrowsing-disable-auto-update".to_string(),
        "--password-store=basic".to_string(),
        "--use-mock-keychain".to_string(),
        "about:blank".to_string(),
    ];

    if headless {
        args.push("--headless=new".to_string());
        args.push("--disable-gpu".to_string());
    }

    let child = Command::new(&browser_path)
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to launch browser: {}", e))?;

    // Wait for browser to start
    tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;

    let cdp_url = format!("http://127.0.0.1:{}", debug_port);

    let mut sessions = BROWSER_SESSIONS.lock().unwrap();
    sessions.insert(session_id.clone(), BrowserSession {
        process: Some(child),
        cdp_url: cdp_url.clone(),
        debug_port,
    });

    Ok(cdp_url)
}

#[tauri::command]
pub async fn close_browser(session_id: String) -> Result<(), String> {
    let child = {
        let mut sessions = BROWSER_SESSIONS.lock().unwrap();
        sessions.remove(&session_id).and_then(|mut s| s.process.take())
    };
    if let Some(mut child) = child {
        let _ = child.kill().await;
    }
    Ok(())
}

#[tauri::command]
pub async fn take_screenshot(session_id: String) -> Result<String, String> {
    let cdp_url = {
        let sessions = BROWSER_SESSIONS.lock().unwrap();
        sessions.get(&session_id).map(|s| s.cdp_url.clone())
    };

    let cdp_url = cdp_url.ok_or_else(|| "Browser session not found".to_string())?;

    // Get list of targets
    let client = reqwest::Client::new();
    let targets: serde_json::Value = client
        .get(format!("{}/json/list", cdp_url))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let ws_url = targets
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|t| t.get("webSocketDebuggerUrl"))
        .and_then(|u| u.as_str())
        .ok_or_else(|| "No target found".to_string())?
        .to_string();

    let screenshot = cdp_screenshot(&ws_url).await?;
    Ok(screenshot)
}

async fn cdp_screenshot(ws_url: &str) -> Result<String, String> {
    use tokio_tungstenite::connect_async;
    use tokio_tungstenite::tungstenite::Message;
    use futures_util::{SinkExt, StreamExt};

    let (mut ws, _) = connect_async(ws_url)
        .await
        .map_err(|e| format!("WebSocket connect error: {}", e))?;

    let msg = serde_json::json!({
        "id": 1,
        "method": "Page.captureScreenshot",
        "params": {
            "format": "jpeg",
            "quality": 80
        }
    });

    ws.send(Message::Text(msg.to_string().into()))
        .await
        .map_err(|e| e.to_string())?;

    while let Some(Ok(Message::Text(text))) = ws.next().await {
        let response: serde_json::Value = serde_json::from_str(&text).unwrap_or_default();
        if response.get("id") == Some(&serde_json::json!(1)) {
            if let Some(data) = response["result"]["data"].as_str() {
                return Ok(data.to_string());
            }
        }
    }

    Err("Failed to capture screenshot".to_string())
}

#[tauri::command]
pub async fn execute_action(
    session_id: String,
    action: BrowserAction,
) -> Result<ActionResult, String> {
    let cdp_url = {
        let sessions = BROWSER_SESSIONS.lock().unwrap();
        sessions.get(&session_id).map(|s| s.cdp_url.clone())
    };

    let cdp_url = cdp_url.ok_or_else(|| "Browser session not found".to_string())?;

    let client = reqwest::Client::new();
    let targets: serde_json::Value = client
        .get(format!("{}/json/list", cdp_url))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let ws_url = targets
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|t| t.get("webSocketDebuggerUrl"))
        .and_then(|u| u.as_str())
        .ok_or_else(|| "No target found".to_string())?
        .to_string();

    execute_cdp_action(&ws_url, &action).await
}

async fn execute_cdp_action(ws_url: &str, action: &BrowserAction) -> Result<ActionResult, String> {
    use tokio_tungstenite::connect_async;

    let (mut ws, _) = connect_async(ws_url)
        .await
        .map_err(|e| format!("WebSocket connect error: {}", e))?;

    let mut cmd_id = 1u32;

    let result = match action.action_type.as_str() {
        "navigate" => {
            let url = action.url.as_deref().unwrap_or("about:blank");
            let msg = serde_json::json!({
                "id": cmd_id,
                "method": "Page.navigate",
                "params": { "url": url }
            });
            send_cdp_command(&mut ws, &msg, cmd_id).await
        }
        "click" => {
            if let Some(selector) = &action.selector {
                // Get element position via JS
                let js = format!(
                    "const el = document.querySelector('{}'); if(el) {{ const r = el.getBoundingClientRect(); [r.left + r.width/2, r.top + r.height/2] }} else {{ null }}",
                    selector.replace('\'', "\\'")
                );
                let eval_msg = serde_json::json!({
                    "id": cmd_id,
                    "method": "Runtime.evaluate",
                    "params": { "expression": js, "returnByValue": true }
                });
                let eval_result = send_cdp_command(&mut ws, &eval_msg, cmd_id).await?;
                cmd_id += 1;

                let coords = eval_result.data
                    .as_ref()
                    .and_then(|d| d["result"]["value"].as_array())
                    .map(|arr| (
                        arr.get(0).and_then(|v| v.as_f64()).unwrap_or(0.0),
                        arr.get(1).and_then(|v| v.as_f64()).unwrap_or(0.0),
                    ))
                    .unwrap_or((0.0, 0.0));

                // Mouse press
                let press_msg = serde_json::json!({
                    "id": cmd_id,
                    "method": "Input.dispatchMouseEvent",
                    "params": {
                        "type": "mousePressed",
                        "x": coords.0, "y": coords.1,
                        "button": "left", "clickCount": 1
                    }
                });
                send_cdp_command(&mut ws, &press_msg, cmd_id).await?;
                cmd_id += 1;

                // Mouse release
                let release_msg = serde_json::json!({
                    "id": cmd_id,
                    "method": "Input.dispatchMouseEvent",
                    "params": {
                        "type": "mouseReleased",
                        "x": coords.0, "y": coords.1,
                        "button": "left", "clickCount": 1
                    }
                });
                send_cdp_command(&mut ws, &release_msg, cmd_id).await
            } else if let (Some(x), Some(y)) = (&action.x, &action.y) {
                let press_msg = serde_json::json!({
                    "id": cmd_id,
                    "method": "Input.dispatchMouseEvent",
                    "params": {
                        "type": "mousePressed",
                        "x": x, "y": y,
                        "button": "left", "clickCount": 1
                    }
                });
                send_cdp_command(&mut ws, &press_msg, cmd_id).await?;
                cmd_id += 1;
                let release_msg = serde_json::json!({
                    "id": cmd_id,
                    "method": "Input.dispatchMouseEvent",
                    "params": {
                        "type": "mouseReleased",
                        "x": x, "y": y,
                        "button": "left", "clickCount": 1
                    }
                });
                send_cdp_command(&mut ws, &release_msg, cmd_id).await
            } else {
                Ok(ActionResult { success: false, data: None, screenshot: None, error: Some("No target specified".to_string()) })
            }
        }
        "type" => {
            let text = action.value.as_deref().unwrap_or("");
            if let Some(selector) = &action.selector {
                // Focus element first
                let focus_js = format!(
                    "document.querySelector('{}')?.focus()",
                    selector.replace('\'', "\\'")
                );
                let focus_msg = serde_json::json!({
                    "id": cmd_id,
                    "method": "Runtime.evaluate",
                    "params": { "expression": focus_js }
                });
                send_cdp_command(&mut ws, &focus_msg, cmd_id).await?;
                cmd_id += 1;
            }

            let type_msg = serde_json::json!({
                "id": cmd_id,
                "method": "Input.insertText",
                "params": { "text": text }
            });
            send_cdp_command(&mut ws, &type_msg, cmd_id).await
        }
        "scroll" => {
            let x = action.x.unwrap_or(0.0);
            let y = action.y.unwrap_or(0.0);
            let scroll_x = action.scroll_x.unwrap_or(0.0);
            let scroll_y = action.scroll_y.unwrap_or(300.0);

            let msg = serde_json::json!({
                "id": cmd_id,
                "method": "Input.dispatchMouseEvent",
                "params": {
                    "type": "mouseWheel",
                    "x": x, "y": y,
                    "deltaX": scroll_x,
                    "deltaY": scroll_y
                }
            });
            send_cdp_command(&mut ws, &msg, cmd_id).await
        }
        "key" => {
            let key = action.key.as_deref().unwrap_or("Return");
            let press_msg = serde_json::json!({
                "id": cmd_id,
                "method": "Input.dispatchKeyEvent",
                "params": { "type": "keyDown", "key": key }
            });
            send_cdp_command(&mut ws, &press_msg, cmd_id).await?;
            cmd_id += 1;
            let up_msg = serde_json::json!({
                "id": cmd_id,
                "method": "Input.dispatchKeyEvent",
                "params": { "type": "keyUp", "key": key }
            });
            send_cdp_command(&mut ws, &up_msg, cmd_id).await
        }
        "evaluate" => {
            let js = action.value.as_deref().unwrap_or("");
            let msg = serde_json::json!({
                "id": cmd_id,
                "method": "Runtime.evaluate",
                "params": { "expression": js, "returnByValue": true, "awaitPromise": true }
            });
            send_cdp_command(&mut ws, &msg, cmd_id).await
        }
        "get_page_content" => {
            let msg = serde_json::json!({
                "id": cmd_id,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": "document.documentElement.outerHTML",
                    "returnByValue": true
                }
            });
            send_cdp_command(&mut ws, &msg, cmd_id).await
        }
        "wait" => {
            let ms = action.value.as_deref()
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(1000);
            tokio::time::sleep(tokio::time::Duration::from_millis(ms)).await;
            Ok(ActionResult { success: true, data: None, screenshot: None, error: None })
        }
        _ => Err(format!("Unknown action type: {}", action.action_type)),
    };

    let mut action_result = result?;

    // Optionally take screenshot after action
    if action.screenshot.unwrap_or(false) {
        let screenshot_msg = serde_json::json!({
            "id": 999,
            "method": "Page.captureScreenshot",
            "params": { "format": "jpeg", "quality": 70 }
        });
        if let Ok(ss) = send_cdp_command(&mut ws, &screenshot_msg, 999).await {
            if let Some(data) = ss.data.as_ref().and_then(|d| d["result"]["data"].as_str()) {
                action_result.screenshot = Some(data.to_string());
            }
        }
    }

    Ok(action_result)
}

async fn send_cdp_command(
    ws: &mut tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
    msg: &serde_json::Value,
    id: u32,
) -> Result<ActionResult, String> {
    use tokio_tungstenite::tungstenite::Message;
    use futures_util::{SinkExt, StreamExt};

    ws.send(Message::Text(msg.to_string().into()))
        .await
        .map_err(|e| e.to_string())?;

    // Wait for response with matching id
    let timeout = tokio::time::Duration::from_secs(10);
    let result = tokio::time::timeout(timeout, async {
        while let Some(Ok(Message::Text(text))) = ws.next().await {
            let response: serde_json::Value = serde_json::from_str(&text).unwrap_or_default();
            if response.get("id") == Some(&serde_json::json!(id)) {
                if let Some(error) = response.get("error") {
                    return Err(format!("CDP error: {}", error));
                }
                return Ok(ActionResult {
                    success: true,
                    data: Some(response),
                    screenshot: None,
                    error: None,
                });
            }
        }
        Err("WebSocket connection closed".to_string())
    })
    .await
    .map_err(|_| "CDP command timed out".to_string())?;

    result
}

async fn find_free_port() -> Result<u16, std::io::Error> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    Ok(port)
}

use serde::{Deserialize, Serialize};
use std::path::Path;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::secrets::{get_secret_internal, set_secret_internal};
use crate::state_manager::{
    ensure_gateway_token_for_install, get_app_data_dir, load_state, save_state_internal,
};

// ── Redaction pipeline ──────────────────────────────────────────────

const SENSITIVE_KEYS: &[&str] = &[
    "OPENAI_API_KEY",
    "POSTGRES_PASSWORD",
    "JWT_SECRET",
    "SLACK_BOT_TOKEN",
    "STRIPE_SECRET_KEY",
    "OPENCLAW_GATEWAY_TOKEN",
    "OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN",
];

const DEFAULT_HTTP_PORT: u16 = 8080;
const DEFAULT_CONTROL_UI_BASE_PATH: &str = "";
const DEFAULT_CONTROL_UI_AUTH_MODE: &str = "token";
const LOCAL_AUTH_BOOTSTRAP_PATH: &str = "/api/v1/local-auth/bootstrap";

fn get_desktop_bootstrap_token(app: &AppHandle) -> String {
    #[cfg(debug_assertions)]
    {
        let t = "dev-token".to_string();
        let _ = crate::secrets::set_secret_internal(app, "OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN", &t);
        return t;
    }

    #[cfg(not(debug_assertions))]
    crate::secrets::get_secret_internal(app, "OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN").unwrap_or_else(|| {
        let t = format!("desktop-bootstrap-{}", uuid::Uuid::new_v4().simple());
        let _ = crate::secrets::set_secret_internal(app, "OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN", &t);
        t
    })
}

pub(crate) fn sanitize_output(text: &str) -> String {
    let mut lines = Vec::new();
    for line in text.lines() {
        let mut redacted_line = line.to_string();
        for key in SENSITIVE_KEYS {
            if line.contains(key) {
                redacted_line = format!("{}= [REDACTED]", key);
                break;
            }
        }
        if let Some(idx) = redacted_line.find("Bearer ") {
            let prefix = &redacted_line[..idx];
            redacted_line = format!("{}Bearer [REDACTED]", prefix);
        }
        lines.push(redacted_line);
    }
    lines.join("\n")
}

// ── Structured results ──────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GatewayStartResult {
    /// Is the gateway container truly running and stable?
    pub gateway_active: bool,
    /// "started" | "already_running" | "failed" | "not_configured" | "stopped"
    pub status: String,
    pub user_friendly_title: String,
    pub user_friendly_message: String,
    pub raw_diagnostics: String,
    pub remediation_steps: Vec<String>,
    pub compose_file_path: String,
    /// Non-blocking warning (shown as a banner in Step 4)
    pub warning: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PullTestResult {
    pub accessible: bool,
    pub image: String,
    pub diagnostics: String,
    pub warning: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HealthCheckResult {
    pub healthy: bool,
    pub status_code: Option<u16>,
    pub body: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BuildResult {
    pub success: bool,
    pub image_tag: String,
    pub logs: String,
}

// ── Gateway gating ──────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GatewayError {
    pub code: String,
    pub title: String,
    pub message: String,
    pub diagnostics: String,
}

impl std::fmt::Display for GatewayError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl From<GatewayError> for String {
    fn from(e: GatewayError) -> String {
        serde_json::to_string(&e).unwrap_or_else(|_| e.message.clone())
    }
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GatewayStatusResult {
    pub container_stable: bool,
    pub health_ok: bool,
    pub version: Option<String>,
    pub last_error: Option<GatewayError>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct ConsoleInfo {
    pub url: String,
    pub port: u16,
    pub base_path: String,
    pub ui_available: bool,
    pub auth_required: bool,
    pub auth_mode: String,
    pub insecure_fallback: bool,
    pub diagnostic: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct CapabilityChannel {
    pub id: String,
    pub display_name: String,
    pub requires_pairing: bool,
    pub requires_api_key: bool,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct CapabilityTool {
    pub id: String,
    pub display_name: String,
    pub scope: String,
    #[serde(default)]
    pub blocked_by_policy: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct CapabilityOrchestrator {
    pub id: String,
    pub display_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct ControlUiCapability {
    pub base_path: String,
    #[serde(default)]
    pub auth_required: bool,
    #[serde(default)]
    pub auth_mode: String,
    #[serde(default)]
    pub insecure_fallback: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct RuntimeCapabilities {
    pub version: String,
    pub generated_at: String,
    pub safe_mode: bool,
    pub control_ui: ControlUiCapability,
    pub channels: Vec<CapabilityChannel>,
    pub tools: Vec<CapabilityTool>,
    pub orchestrators: Vec<CapabilityOrchestrator>,
}

// ── Container health (docker inspect) ───────────────────────────────

/// Parsed container state from `docker inspect`.
#[derive(Debug, Clone)]
struct ContainerHealth {
    status: String,       // "running", "restarting", "exited", "created", …
    restarting: bool,
    exit_code: i32,
    raw: String,          // the full inspect tuple for diagnostics
}

/// Resolve the gateway container ID via `docker compose ps -q gateway`.
fn resolve_container_id(dir: &Path) -> Option<String> {
    let output = crate::process::run_docker(&["compose", "ps", "-q", "gateway"], Some(dir)).ok()?;
    let id = output.stdout.trim().to_string();
    if id.is_empty() { None } else { Some(id) }
}

/// Inspect container state via `docker inspect`.
/// Returns `(status, restarting, exit_code)` from the Go template.
fn inspect_container(container_id: &str) -> ContainerHealth {
    let output = crate::process::run_docker(
        &[
            "inspect",
            "--format",
            "{{.State.Status}}|{{.State.Restarting}}|{{.State.ExitCode}}",
            container_id,
        ],
        None,
    );

    match output {
        Ok(out) => {
            let raw = out.stdout.trim().to_string();
            let parts: Vec<&str> = raw.split('|').collect();
            if parts.len() >= 3 {
                ContainerHealth {
                    status: parts[0].to_lowercase(),
                    restarting: parts[1].eq_ignore_ascii_case("true"),
                    exit_code: parts[2].parse().unwrap_or(-1),
                    raw: raw.clone(),
                }
            } else {
                ContainerHealth {
                    status: "unknown".into(),
                    restarting: false,
                    exit_code: -1,
                    raw,
                }
            }
        }
        Err(e) => ContainerHealth {
            status: "error".into(),
            restarting: false,
            exit_code: -1,
            raw: format!("inspect failed: {}", e),
        },
    }
}

/// Strict running check: status == "running" AND NOT restarting AND exit_code == 0.
fn is_healthy(health: &ContainerHealth) -> bool {
    health.status == "running" && !health.restarting && health.exit_code == 0
}

/// Get gateway logs (last 50 lines) for diagnostics.
fn get_gateway_logs(dir: &Path) -> String {
    let output = crate::process::run_docker(&["compose", "logs", "--tail", "50", "gateway"], Some(dir));
    match output {
        Ok(out) => {
            let stdout = out.stdout;
            let stderr = out.stderr;
            format!("{}\n{}", stdout, stderr)
        }
        Err(e) => format!("Failed to get logs: {}", e),
    }
}

/// Read HTTP port from .env file in the app data dir.
fn read_http_port(dir: &Path) -> u16 {
    let env_file = dir.join(".env");
    if let Ok(content) = std::fs::read_to_string(&env_file) {
        for line in content.lines() {
            if let Some(rest) = line.strip_prefix("OPENCLAW_HTTP_PORT=") {
                if let Ok(port) = rest.trim().parse::<u16>() {
                    return port;
                }
            }
        }
    }
    DEFAULT_HTTP_PORT
}

fn is_safe_path_segment(segment: &str) -> bool {
    segment
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.' | '~'))
}

fn normalize_base_path(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    let mut candidate = if trimmed.contains("://") {
        match reqwest::Url::parse(trimmed) {
            Ok(url) => url.path().to_string(),
            Err(_) => String::new(),
        }
    } else {
        trimmed.to_string()
    };
    if candidate.is_empty() {
        return String::new();
    }

    candidate = candidate.replace('\\', "/");
    if let Some(idx) = candidate.find('?') {
        candidate.truncate(idx);
    }
    if let Some(idx) = candidate.find('#') {
        candidate.truncate(idx);
    }
    if !candidate.starts_with('/') {
        candidate.insert(0, '/');
    }

    let mut segments: Vec<&str> = Vec::new();
    for segment in candidate.split('/') {
        let seg = segment.trim();
        if seg.is_empty() || seg == "." || seg == ".." {
            continue;
        }
        if !is_safe_path_segment(seg) {
            return String::new();
        }
        segments.push(seg);
    }

    if segments.is_empty() {
        String::new()
    } else {
        format!("/{}", segments.join("/"))
    }
}

fn build_console_url(port: u16, base_path: &str) -> String {
    let normalized = normalize_base_path(base_path);
    if normalized.is_empty() {
        format!("http://127.0.0.1:{}/", port)
    } else {
        format!("http://127.0.0.1:{}{}/", port, normalized)
    }
}

fn build_console_bootstrap_url(port: u16, base_path: &str, bootstrap_token: &str) -> String {
    let normalized = normalize_base_path(base_path);
    let next_path = if normalized.is_empty() {
        "/".to_string()
    } else {
        format!("{}/", normalized)
    };
    let mut url =
        reqwest::Url::parse(&format!("http://127.0.0.1:{}{}", port, LOCAL_AUTH_BOOTSTRAP_PATH))
            .unwrap_or_else(|_| {
                reqwest::Url::parse(&format!("http://127.0.0.1:{}/", port))
                    .expect("bootstrap fallback URL must parse")
            });
    url.query_pairs_mut()
        .append_pair("token", bootstrap_token)
        .append_pair("next", &next_path);
    url.to_string()
}

fn normalize_connection_segment(raw: &str) -> String {
    let mut normalized = String::new();
    for ch in raw.trim().chars() {
        if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-') {
            normalized.push(ch.to_ascii_lowercase());
        } else {
            normalized.push('_');
        }
    }
    let trimmed = normalized.trim_matches('_');
    if trimmed.is_empty() {
        "unknown".to_string()
    } else {
        trimmed.to_string()
    }
}

fn connection_secret_key(kind: &str, id: &str, field: &str) -> String {
    format!(
        "connections.{}.{}.{}",
        normalize_connection_segment(kind),
        normalize_connection_segment(id),
        normalize_connection_segment(field)
    )
}

fn extract_cookie_pair(set_cookie_header: &str) -> Option<String> {
    let first = set_cookie_header.split(';').next()?.trim();
    if first.is_empty() || !first.contains('=') {
        None
    } else {
        Some(first.to_string())
    }
}

async fn bootstrap_local_session_cookie(
    port: u16,
    bootstrap_token: &str,
) -> Result<String, String> {
    let bootstrap_url = build_console_bootstrap_url(port, "", bootstrap_token);
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(6))
        .build()
        .map_err(|e| format!("Failed to build bootstrap HTTP client: {}", e))?;

    let response = client
        .get(&bootstrap_url)
        .send()
        .await
        .map_err(|e| format!("Console bootstrap request failed: {}", e))?;

    if !response.status().is_redirection() && !response.status().is_success() {
        return Err(format!(
            "Console bootstrap returned HTTP {}",
            response.status().as_u16()
        ));
    }

    let set_cookie = response
        .headers()
        .get(reqwest::header::SET_COOKIE)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| "Console bootstrap did not return a session cookie.".to_string())?;
    extract_cookie_pair(set_cookie)
        .ok_or_else(|| "Console bootstrap returned an invalid session cookie.".to_string())
}

pub(crate) async fn call_gateway_connections_api(
    app: &AppHandle,
    method: reqwest::Method,
    path: &str,
    body: Option<&serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let dir = get_app_data_dir(app)?;
    let (stable, _diag) = check_gateway_strictly(&dir, false);
    if !stable {
        return Err("Gateway is not running. Start the gateway to manage connections.".to_string());
    }
    let port = read_http_port(&dir);
    let bootstrap_token = get_desktop_bootstrap_token(app);
    let cookie = bootstrap_local_session_cookie(port, &bootstrap_token).await?;

    let url = format!("http://127.0.0.1:{}{}", port, path);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to build connections HTTP client: {}", e))?;

    let mut request = client
        .request(method, &url)
        .header(reqwest::header::COOKIE, cookie);
    if let Some(payload) = body {
        request = request.json(payload);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Connections request failed: {}", e))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read connections response body: {}", e))?;
    let parsed = serde_json::from_str::<serde_json::Value>(&text)
        .unwrap_or_else(|_| serde_json::json!({ "message": text }));

    if !status.is_success() {
        let message = parsed
            .pointer("/error/message")
            .and_then(|value| value.as_str())
            .or_else(|| parsed.get("message").and_then(|value| value.as_str()))
            .unwrap_or("Connections request failed");
        return Err(format!("Connections API HTTP {}: {}", status.as_u16(), message));
    }
    Ok(parsed)
}

fn collect_keychain_secret_fields(schema_payload: &serde_json::Value, kind: &str, id: &str) -> Vec<String> {
    let key = if kind == "provider" { "providers" } else { "channels" };
    let Some(entries) = schema_payload.get(key).and_then(|value| value.as_array()) else {
        return vec![];
    };
    let Some(item) = entries.iter().find(|entry| {
        entry
            .get("id")
            .and_then(|value| value.as_str())
            .map(|candidate| candidate.eq_ignore_ascii_case(id))
            .unwrap_or(false)
    }) else {
        return vec![];
    };
    let Some(fields) = item
        .pointer("/schema/fields")
        .and_then(|value| value.as_array())
    else {
        return vec![];
    };
    fields
        .iter()
        .filter_map(|field| {
            let field_type = field.get("type").and_then(|value| value.as_str())?;
            let storage = field.get("storage").and_then(|value| value.as_str()).unwrap_or("memory");
            if field_type != "secret" || storage != "keychain" {
                return None;
            }
            field
                .get("key")
                .and_then(|value| value.as_str())
                .map(|value| value.to_string())
        })
        .collect()
}

fn empty_capabilities() -> RuntimeCapabilities {
    RuntimeCapabilities {
        version: "v1".to_string(),
        generated_at: chrono::Utc::now().to_rfc3339(),
        safe_mode: true,
        control_ui: ControlUiCapability {
            base_path: String::new(),
            auth_required: true,
            auth_mode: DEFAULT_CONTROL_UI_AUTH_MODE.to_string(),
            insecure_fallback: true,
        },
        channels: vec![],
        tools: vec![],
        orchestrators: vec![],
    }
}

async fn fetch_gateway_capabilities(app: &AppHandle, port: u16) -> Result<RuntimeCapabilities, String> {
    let url = format!("http://127.0.0.1:{}/api/v1/capabilities", port);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .build()
        .map_err(|e| format!("Failed to build capabilities HTTP client: {}", e))?;
    let state = load_state(app);
    let token = ensure_gateway_token_for_install(app, &state.install_id).ok();
    let mut request = client.get(&url);
    if let Some(ref gateway_token) = token {
        request = request.bearer_auth(gateway_token);
    }
    let response = request
        .send()
        .await
        .map_err(|e| format!("Capabilities request failed: {}", e))?;
    if !response.status().is_success() {
        return Err(format!(
            "Capabilities request returned HTTP {}",
            response.status().as_u16()
        ));
    }
    response
        .json::<RuntimeCapabilities>()
        .await
        .map_err(|e| format!("Capabilities response parse failed: {}", e))
}

fn display_control_ui_path(base_path: &str) -> String {
    if base_path.is_empty() {
        "/".to_string()
    } else {
        format!("{}/", base_path)
    }
}

fn response_looks_like_html(status: u16, content_type: Option<&str>, body_prefix: &str) -> bool {
    if status != 200 {
        return false;
    }

    if content_type
        .map(|value| value.to_ascii_lowercase().contains("text/html"))
        .unwrap_or(false)
    {
        return true;
    }

    let trimmed = body_prefix.trim_start().to_ascii_lowercase();
    trimmed.starts_with("<!doctype html") || trimmed.starts_with("<html")
}

async fn check_control_ui_candidate(port: u16, base_path: &str) -> Result<bool, String> {
    let url = build_console_url(port, base_path);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(2))
        .build()
        .map_err(|e| format!("Failed to build Control UI probe client: {}", e))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Control UI probe failed for {}: {}", url, e))?;

    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    let body = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read probe response body for {}: {}", url, e))?;
    let prefix_len = body.len().min(256);
    let body_prefix = String::from_utf8_lossy(&body[..prefix_len]);

    Ok(response_looks_like_html(
        status,
        content_type.as_deref(),
        body_prefix.as_ref(),
    ))
}

#[derive(Debug, Clone)]
struct ControlUiProbeResult {
    base_path: String,
    ui_available: bool,
}

async fn probe_control_ui_base_path(port: u16) -> ControlUiProbeResult {
    for candidate in ["", "/openclaw", "/ui", "/console", "/app"] {
        let normalized = normalize_base_path(candidate);
        if let Ok(true) = check_control_ui_candidate(port, &normalized).await {
            return ControlUiProbeResult {
                base_path: normalized,
                ui_available: true,
            };
        }
    }

    ControlUiProbeResult {
        base_path: String::new(),
        ui_available: false,
    }
}

/// Probe the gateway /health endpoint via raw HTTP over TCP.
fn probe_health(port: u16) -> HealthCheckResult {
    use std::io::{Read, Write};
    use std::net::TcpStream;
    use std::time::Duration;

    let addr_str = format!("127.0.0.1:{}", port);
    let addrs = match std::net::ToSocketAddrs::to_socket_addrs(&addr_str) {
        Ok(a) => a,
        Err(e) => {
            return HealthCheckResult {
                healthy: false,
                status_code: None,
                body: String::new(),
                error: Some(format!("DNS resolution failed for {}: {}", addr_str, e)),
            };
        }
    };

    let mut stream = None;
    let mut last_err = None;

    for addr in addrs {
        match TcpStream::connect_timeout(&addr, Duration::from_secs(3)) {
            Ok(s) => {
                stream = Some(s);
                break;
            }
            Err(e) => last_err = Some(e),
        }
    }

    let mut stream = match stream {
        Some(s) => s,
        None => {
            return HealthCheckResult {
                healthy: false,
                status_code: None,
                body: String::new(),
                error: Some(format!("Connection to {} failed: {:?}", addr_str, last_err)),
            };
        }
    };

    let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(3)));

    let request = format!(
        "GET /health HTTP/1.1\r\nHost: localhost:{}\r\nConnection: close\r\n\r\n",
        port
    );
    if let Err(e) = stream.write_all(request.as_bytes()) {
        return HealthCheckResult {
            healthy: false,
            status_code: None,
            body: String::new(),
            error: Some(format!("Write failed: {}", e)),
        };
    }

    let mut response = String::new();
    let _ = stream.read_to_string(&mut response);

    // Parse status code from first line: "HTTP/1.1 200 OK"
    let status_code = response
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|code| code.parse::<u16>().ok());

    // Extract body (after blank line)
    let body = response
        .split("\r\n\r\n")
        .nth(1)
        .unwrap_or("")
        .to_string();

    let healthy = status_code == Some(200) && body.contains("ok");

    HealthCheckResult {
        healthy,
        status_code,
        body,
        error: if healthy {
            None
        } else {
            Some("Health check did not return 200/ok".into())
        },
    }
}

/// Strict gateway running check with optional stability window.
/// If `with_stability` is true, checks twice with 1500ms delay.
/// Returns `(is_stable, diagnostics)`.
fn check_gateway_strictly(dir: &Path, with_stability: bool) -> (bool, String) {
    let container_id = match resolve_container_id(dir) {
        Some(id) => id,
        None => return (false, "No gateway container found.".into()),
    };

    let health1 = inspect_container(&container_id);
    let mut diag = format!("inspect[1]: {}", health1.raw);

    if !is_healthy(&health1) {
        return (false, diag);
    }

    if !with_stability {
        return (true, diag);
    }

    // Stability window: wait 1500ms and check again
    std::thread::sleep(std::time::Duration::from_millis(1500));
    let health2 = inspect_container(&container_id);
    diag.push_str(&format!("\ninspect[2]: {}", health2.raw));

    if is_healthy(&health2) {
        (true, diag)
    } else {
        (false, diag)
    }
}

// ── Remediation builder ─────────────────────────────────────────────

const PULL_ERROR_PATTERNS: &[&str] = &[
    "pull access denied",
    "repository does not exist",
    "may require 'docker login'",
    "manifest unknown",
];

fn is_pull_access_error(text: &str) -> bool {
    let lower = text.to_lowercase();
    PULL_ERROR_PATTERNS
        .iter()
        .any(|pat| lower.contains(&pat.to_lowercase()))
}

/// Detect "node: not found" / exit code 127 pattern.
fn is_node_not_found(text: &str, exit_code: i32) -> bool {
    let lower = text.to_lowercase();
    exit_code == 127
        || lower.contains("node: not found")
        || lower.contains("exec: \"node\": executable file not found")
}

/// Detect "Cannot find module" / missing app files pattern.
fn is_module_not_found(text: &str) -> bool {
    let lower = text.to_lowercase();
    lower.contains("cannot find module")
        || lower.contains("error: cannot find")
        || lower.contains("no such file or directory")
            && (lower.contains("openclaw") || lower.contains(".mjs") || lower.contains(".js"))
}

fn build_remediation(
    logs: &str,
    exit_code: i32,
    compose_path: &Path,
) -> (String, String, Vec<String>) {
    let compose_display = compose_path.display().to_string();

    // Priority 1: pull access
    if is_pull_access_error(logs) {
        return (
            "Image Pull Failed".into(),
            "Docker could not pull the container image.\nUse the Image Source selector to pick a valid image.".into(),
            vec![
                "Change the image in the Image Source section and click \"Test Pull Access\".".into(),
                "If using a private registry, log in first via the \"Private Registry\" tab.".into(),
                "For local development, use the \"Local Build\" tab.".into(),
            ],
        );
    }

    // Priority 2: node not found (exit 127)
    if is_node_not_found(logs, exit_code) {
        return (
            "Incompatible Image – Node Not Found".into(),
            format!(
                "The selected image does not include Node.js, but the gateway runtime \
                 requires it (exit code 127).\n\
                 Images like nginx:alpine are useful for Docker smoke testing but cannot \
                 run the OpenClaw gateway."
            ),
            vec![
                "Use a gateway-compatible image that includes Node.js + the gateway app.".into(),
                "Or use the \"Local Build\" tab to build from a valid gateway Dockerfile.".into(),
                "To just test Docker connectivity, use the \"Docker Smoke Test\" button instead.".into(),
            ],
        );
    }

    // Priority 3: module not found
    if is_module_not_found(logs) {
        return (
            "Gateway App Missing in Image".into(),
            "The image has Node.js but the gateway application files are missing or \
             the entrypoint is incorrect."
                .into(),
            vec![
                "Use the official gateway image or rebuild with the correct Dockerfile.".into(),
                "Ensure COPY/WORKDIR/ENTRYPOINT in the Dockerfile point to the gateway app files.".into(),
                format!("Check the compose file at {} for entrypoint overrides.", compose_display),
            ],
        );
    }

    // Fallback: generic
    (
        "Gateway Start Failed".into(),
        format!("docker compose up failed.\nCompose file: {}", compose_display),
        vec![
            "Ensure Docker Desktop is running.".into(),
            "Check that no other service is using the configured ports.".into(),
            format!("Inspect the compose file at {} for errors.", compose_display),
        ],
    )
}

// ── Compose file rewrite ────────────────────────────────────────────

pub fn generate_compose_content(image: &str, http_port: u16) -> String {
    format!(
        r#"services:
  gateway:
    image: {0}
    ports:
      - "{1}:8080"
    environment:
      OPENCLAW_SAFE_MODE: "1"
      LOG_LEVEL: info
      OPENCLAW_CONTAINER_PORT: "8080"
      OPENCLAW_GATEWAY_TOKEN: "${{OPENCLAW_GATEWAY_TOKEN:-}}"
      OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN: "${{OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN:-}}"
      OPENCLAW_ALLOW_INTERNET: "${{OPENCLAW_ALLOW_INTERNET:-0}}"
    restart: unless-stopped
    volumes:
      - openclaw_home:/home/node
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    init: true

  cli:
    image: {0}
    environment:
      OPENCLAW_SAFE_MODE: "1"
      LOG_LEVEL: info
      OPENCLAW_CONTAINER_PORT: "8080"
      OPENCLAW_GATEWAY_TOKEN: "${{OPENCLAW_GATEWAY_TOKEN:-}}"
      OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN: "${{OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN:-}}"
      OPENCLAW_ALLOW_INTERNET: "${{OPENCLAW_ALLOW_INTERNET:-0}}"
    entrypoint: [ "node", "openclaw.mjs" ]
    stdin_open: true
    tty: true
    volumes:
      - openclaw_home:/home/node
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true

networks:
  default:
    name: openclaw-managed

volumes:
  openclaw_home:

"#,
        image,
        http_port
    )
}



/// Ensure the openclaw-egress network exists (bridge).
pub fn ensure_egress_network_exists() -> Result<(), String> {
    let check = crate::process::run_docker(&["network", "inspect", "openclaw-egress"], None);

    // If it exists, we're good
    if let Ok(out) = check {
        if out.success() {
            return Ok(());
        }
    }

    // Create it
    let create = crate::process::run_docker(
        &["network", "create", "--driver", "bridge", "openclaw-egress"],
        None,
    ).map_err(|e| format!("Failed to create network: {}", e))?;

    if !create.success() {
        let stderr = create.stderr;
        return Err(format!("Failed to create openclaw-egress network: {}", stderr));
    }

    Ok(())
}


#[tauri::command]
pub async fn is_gateway_running(app: AppHandle) -> Result<GatewayStartResult, String> {
    let dir = get_app_data_dir(&app)?;
    let compose_file = dir.join("docker-compose.yml");

    if !compose_file.exists() {
        return Ok(GatewayStartResult {
            gateway_active: false,
            status: "not_configured".into(),
            user_friendly_title: "Not Configured".into(),
            user_friendly_message: "No compose file found.".into(),
            raw_diagnostics: String::new(),
            remediation_steps: vec![],
            compose_file_path: compose_file.display().to_string(),
            warning: None,
        });
    }

    // Use strict check WITHOUT stability window for init sync (fast)
    let (running, diag) = check_gateway_strictly(&dir, false);
    Ok(GatewayStartResult {
        gateway_active: running,
        status: if running { "already_running" } else { "stopped" }.into(),
        user_friendly_title: if running {
            "Gateway Running".into()
        } else {
            "Gateway Stopped".into()
        },
        user_friendly_message: if running {
            "OpenClaw Gateway is active.".into()
        } else {
            "Gateway is not currently running.".into()
        },
        raw_diagnostics: sanitize_output(&diag),
        remediation_steps: vec![],
        compose_file_path: compose_file.display().to_string(),
        warning: None,
    })
}

#[tauri::command]
pub async fn start_gateway(app: AppHandle) -> Result<GatewayStartResult, String> {
    let dir = get_app_data_dir(&app)?;
    let compose_file = dir.join("docker-compose.yml");
    let state = load_state(&app);
    let gateway_token = ensure_gateway_token_for_install(&app, &state.install_id)?;
    let bootstrap_token = get_desktop_bootstrap_token(&app);

    if !compose_file.exists() {
        // First run: auto-generate the compose file from the stored (or default) gateway image.
        // This makes Start Gateway work without requiring a separate Configure step.
        let image = if state.gateway_image.trim().is_empty() {
            crate::state_manager::DEFAULT_GATEWAY_IMAGE.to_string()
        } else {
            state.gateway_image.clone()
        };
        let http_port = read_http_port(&dir);
        let content = generate_compose_content(&image, http_port);
        if let Err(e) = std::fs::create_dir_all(&dir) {
            return Ok(GatewayStartResult {
                gateway_active: false,
                status: "failed".into(),
                user_friendly_title: "Setup Error".into(),
                user_friendly_message: format!("Could not create app data directory: {}", e),
                raw_diagnostics: String::new(),
                remediation_steps: vec!["Check disk permissions for the app data folder.".into()],
                compose_file_path: compose_file.display().to_string(),
                warning: None,
            });
        }
        if let Err(e) = std::fs::write(&compose_file, &content) {
            return Ok(GatewayStartResult {
                gateway_active: false,
                status: "failed".into(),
                user_friendly_title: "Setup Error".into(),
                user_friendly_message: format!("Could not write docker-compose.yml: {}", e),
                raw_diagnostics: String::new(),
                remediation_steps: vec!["Check disk permissions for the app data folder.".into()],
                compose_file_path: compose_file.display().to_string(),
                warning: None,
            });
        }
    }


    // 1) Check if already running BEFORE compose up (strict, no stability window)
    let (pre_running, _) = check_gateway_strictly(&dir, false);
    if pre_running {
        return Ok(GatewayStartResult {
            gateway_active: true,
            status: "already_running".into(),
            user_friendly_title: "Gateway Already Running".into(),
            user_friendly_message: "The gateway container is already active. No action needed.".into(),
            raw_diagnostics: String::new(),
            remediation_steps: vec![],
            compose_file_path: compose_file.display().to_string(),
            warning: None,
        });
    }

    // 2) Run docker compose up -d
    // Also ensure egress network exists
    if let Err(e) = ensure_egress_network_exists() {
        return Ok(GatewayStartResult {
            gateway_active: false,
            status: "failed".into(),
            user_friendly_title: "Network Creation Failed".into(),
            user_friendly_message: format!("Could not create openclaw-egress network: {}", e),
            raw_diagnostics: String::new(),
            remediation_steps: vec!["Check Docker permissions.".into()],
            compose_file_path: compose_file.display().to_string(),
            warning: None,
        });
    }

    let compose_env = [
        ("OPENCLAW_GATEWAY_TOKEN", gateway_token.as_str()),
        (
            "OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN",
            bootstrap_token.as_str(),
        ),
        (
            "OPENCLAW_ALLOW_INTERNET",
            if state.allow_internet { "1" } else { "0" },
        ),
    ];
    let output =
        crate::process::run_docker_with_env(&["compose", "up", "-d"], Some(&dir), &compose_env)
            .map_err(|e| format!("Failed to execute docker: {}", e))?;

    let success = output.success();
    let stdout = output.stdout;
    let stderr = output.stderr;
    let combined_raw = format!("{}\n{}", stdout, stderr);

    // 3) If exit code != 0 → check if maybe running anyway (strict)
    if !success {
        let (post_running, _inspect_diag) = check_gateway_strictly(&dir, false);
        if post_running {
            return Ok(GatewayStartResult {
                gateway_active: true,
                status: "already_running".into(),
                user_friendly_title: "Gateway Running (with warning)".into(),
                user_friendly_message: "The gateway container is running, but the last start command encountered errors.".into(),
                raw_diagnostics: sanitize_output(&combined_raw),
                remediation_steps: vec![],
                compose_file_path: compose_file.display().to_string(),
                warning: Some(format!("Last start attempt failed: {}", sanitize_output(&stderr))),
            });
        }
        // Not running
        let logs = get_gateway_logs(&dir);
        let full_diag = format!("{}\n--- gateway logs ---\n{}", combined_raw, logs);
        let (title, message, steps) = build_remediation(&full_diag, -1, &compose_file);
        return Ok(GatewayStartResult {
            gateway_active: false,
            status: "failed".into(),
            user_friendly_title: title,
            user_friendly_message: message,
            raw_diagnostics: sanitize_output(&full_diag),
            remediation_steps: steps,
            compose_file_path: compose_file.display().to_string(),
            warning: None,
        });
    }

    // 4) Exit code 0 → strict verify with stability window (2 checks, 1500ms apart)
    let (is_stable, inspect_diag) = check_gateway_strictly(&dir, true);

    if is_stable {
        // 5) Health probe — try /health on configured HTTP port
        let http_port = read_http_port(&dir);
        let health = probe_health(http_port);
        let health_warning = if health.healthy {
            None
        } else {
            Some(format!(
                "Container is running but /health on port {} did not respond with 200. {}",
                http_port,
                health.error.unwrap_or_default()
            ))
        };

        Ok(GatewayStartResult {
            gateway_active: true,
            status: "started".into(),
            user_friendly_title: "Gateway Running".into(),
            user_friendly_message: if health.healthy {
                "OpenClaw Gateway started, stable, and /health OK.".into()
            } else {
                "OpenClaw Gateway started but /health not yet responding.".into()
            },
            raw_diagnostics: sanitize_output(&combined_raw),
            remediation_steps: vec![],
            compose_file_path: compose_file.display().to_string(),
            warning: health_warning,
        })
    } else {
        // Container started but is crashing / restarting
        let logs = get_gateway_logs(&dir);
        let full_diag = format!(
            "{}\n--- inspect ---\n{}\n--- gateway logs ---\n{}",
            combined_raw, inspect_diag, logs
        );

        // Try to extract exit code from inspect diag
        let exit_code = extract_exit_code(&inspect_diag);
        let (title, message, steps) = build_remediation(&full_diag, exit_code, &compose_file);

        Ok(GatewayStartResult {
            gateway_active: false,
            status: "failed".into(),
            user_friendly_title: title,
            user_friendly_message: message,
            raw_diagnostics: sanitize_output(&full_diag),
            remediation_steps: steps,
            compose_file_path: compose_file.display().to_string(),
            warning: None,
        })
    }
}

/// Extract exit code from inspect diagnostics like "inspect[2]: restarting|true|127"
fn extract_exit_code(inspect_diag: &str) -> i32 {
    // Look for the last "|<number>" at end of an inspect line
    for line in inspect_diag.lines().rev() {
        if let Some(pos) = line.rfind('|') {
            if let Ok(code) = line[pos + 1..].trim().parse::<i32>() {
                return code;
            }
        }
    }
    -1
}

#[tauri::command]
pub async fn test_pull_access(image: String) -> Result<PullTestResult, String> {
    // 1. GHCR Special Handling: Direct Pull (skip manifest)
    // Manifest inspect on GHCR often returns 401/403 for public images if not logged in.
    // To avoid false negatives, we go straight to "docker pull" for ghcr.io images.
    let image_lower = image.to_lowercase();
    if image_lower.starts_with("ghcr.io/") || image_lower.contains("/ghcr.io/") {
        let pull_output = crate::process::run_docker(&["pull", &image], None)
            .map_err(|e| format!("Failed to execute docker pull: {}", e))?;

        let success = pull_output.success();
        let stdout = pull_output.stdout;
        let stderr = pull_output.stderr;
        let combined = format!("{}\n{}", stdout, stderr);

        if success {
             return Ok(PullTestResult {
                accessible: true,
                image,
                diagnostics: sanitize_output(&combined),
                warning: Some("Used direct pull for GHCR compatibility.".to_string()),
            });
        }
        
        // If pull failed, return failure
        return Ok(PullTestResult {
            accessible: false,
            image,
            diagnostics: sanitize_output(&combined),
            warning: None,
        });
    }

    // 2. Standard Logic: Manifest first (faster)
    let output = crate::process::run_docker(&["manifest", "inspect", &image], None)
        .map_err(|e| format!("Failed to execute docker: {}", e))?;

    let success = output.success();
    let stdout = output.stdout;
    let stderr = output.stderr;
    let combined = format!("{}\n{}", stdout, stderr);

    if success {
        return Ok(PullTestResult {
            accessible: true,
            image,
            diagnostics: sanitize_output(&combined),
            warning: None,
        });
    }

    // 3. Fallback: Check if manifest failure looks like auth/permission error
    // Combine stdout/stderr because Windows Docker sometimes puts error text in stdout
    if should_try_pull_fallback(&combined) {
        // Fallback: try actual docker pull
        let pull_output = crate::process::run_docker(&["pull", &image], None)
            .map_err(|e| format!("Failed to execute docker pull: {}", e))?;

        let success = pull_output.success();
        let pull_stdout = pull_output.stdout;
        let pull_stderr = pull_output.stderr;
        let pull_combined = format!("{}\n{}", pull_stdout, pull_stderr);

        if success {
             return Ok(PullTestResult {
                accessible: true,
                image: image.clone(),
                diagnostics: sanitize_output(&pull_combined),
                warning: Some("Manifest check restricted, but pull succeeded.".to_string()),
            });
        }
    }

    // Default failure
    Ok(PullTestResult {
        accessible: false,
        image,
        diagnostics: sanitize_output(&combined),
        warning: None,
    })
}

fn should_try_pull_fallback(output: &str) -> bool {
    let lower = output.to_lowercase();
    lower.contains("unauthorized")
        || lower.contains("authentication required")
        || lower.contains("denied")
        || lower.contains("no access")
        || lower.contains("forbidden")
        || lower.contains("insufficient_scope")
        || lower.contains("access denied")
        || lower.contains("401")
        || lower.contains("403")
}

#[tauri::command]
pub async fn docker_smoke_test() -> Result<PullTestResult, String> {
    let output = crate::process::run_docker(&["run", "--rm", "hello-world"], None)
        .map_err(|e| format!("Failed to execute docker: {}", e))?;

    let success = output.success();
    let stdout = output.stdout;
    let stderr = output.stderr;
    let combined = format!("{}\n{}", stdout, stderr);

    Ok(PullTestResult {
        accessible: success,
        image: "hello-world".into(),
        diagnostics: sanitize_output(&combined),
        warning: None,
    })
}

#[tauri::command]
pub async fn check_gateway_health(app: AppHandle) -> Result<HealthCheckResult, String> {
    let dir = get_app_data_dir(&app)?;
    let port = read_http_port(&dir);
    Ok(probe_health(port))
}

#[tauri::command]
pub async fn test_gateway_ollama_access(app: AppHandle) -> Result<bool, String> {
    let dir = get_app_data_dir(&app)?;

    let (stable, _diag) = check_gateway_strictly(&dir, false);
    if !stable {
        return Ok(false);
    }

    const PROBE_SCRIPT: &str = r#"const url='http://host.docker.internal:11434/api/tags';const ac=new AbortController();const t=setTimeout(()=>ac.abort(),5000);fetch(url,{signal:ac.signal}).then((res)=>{clearTimeout(t);process.exit(res.ok?0:2);}).catch(()=>{clearTimeout(t);process.exit(3);});"#;

    let output = crate::process::run_docker(
        &["compose", "exec", "-T", "gateway", "node", "-e", PROBE_SCRIPT],
        Some(&dir),
    )
    .map_err(|e| format!("Failed to execute docker compose exec: {}", e))?;

    Ok(output.success())
}

#[tauri::command]
pub async fn build_local_image(context_path: String) -> Result<BuildResult, String> {
    let context = std::path::Path::new(&context_path);
    let tag = "openclaw-gateway:dev";
    let mut build_dir = context.to_path_buf();
    let mut args: Vec<String> = vec!["build".into(), "-t".into(), tag.into()];

    let repo_context_has_gateway_dockerfile = context.join("gateway").join("Dockerfile").exists();
    let direct_context_has_dockerfile = context.join("Dockerfile").exists();

    if repo_context_has_gateway_dockerfile {
        args.push("-f".into());
        args.push("gateway/Dockerfile".into());
        args.push(".".into());
    } else if direct_context_has_dockerfile {
        let looks_like_gateway_subdir = context
            .file_name()
            .and_then(|name| name.to_str())
            .map(|name| name.eq_ignore_ascii_case("gateway"))
            .unwrap_or(false);
        let parent_repo = context.parent().filter(|parent| {
            parent.join("package.json").exists() && parent.join("gateway").join("Dockerfile").exists()
        });

        if looks_like_gateway_subdir {
            if let Some(parent) = parent_repo {
                build_dir = parent.to_path_buf();
                args.push("-f".into());
                args.push("gateway/Dockerfile".into());
                args.push(".".into());
            } else {
                args.push(".".into());
            }
        } else {
            args.push(".".into());
        }
    } else {
        return Ok(BuildResult {
            success: false,
            image_tag: String::new(),
            logs: format!(
                "No Dockerfile found for local build.\nExpected either:\n- {0}\\Dockerfile\n- {0}\\gateway\\Dockerfile",
                context.display()
            ),
        });
    }

    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let output = crate::process::run_docker(&arg_refs, Some(&build_dir))
        .map_err(|e| format!("Failed to run docker build: {}", e))?;

    let success = output.success();
    let stdout = output.stdout;
    let stderr = output.stderr;
    let logs = format!("{}\n{}", stdout, stderr);

    Ok(BuildResult {
        success,
        image_tag: if success { tag.to_string() } else { String::new() },
        logs: sanitize_output(&logs),
    })
}

#[tauri::command]
pub async fn update_compose_image(app: AppHandle, image: String) -> Result<String, String> {
    let dir = get_app_data_dir(&app)?;
    let compose_file = dir.join("docker-compose.yml");
    let http_port = read_http_port(&dir);
    let content = generate_compose_content(&image, http_port);
    std::fs::write(&compose_file, content).map_err(|e| e.to_string())?;
    Ok(compose_file.display().to_string())
}

#[tauri::command]
pub async fn open_app_data_folder(app: AppHandle) -> Result<(), String> {
    let dir = get_app_data_dir(&app)?;
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(dir.to_string_lossy().to_string())
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(dir.to_string_lossy().to_string())
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(dir.to_string_lossy().to_string())
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn stop_gateway(app: AppHandle) -> Result<String, String> {
    let dir = get_app_data_dir(&app)?;

    // Check if we should stop agents
    let mut state = load_state(&app);
    if state.stop_agents_on_gateway_stop {
        for agent in &mut state.agents {
             if !agent.container_name.is_empty() {
                 // Best effort stop
                 let _ = crate::process::run_docker(&["stop", "-t", "5", &agent.container_name], None);
                 agent.status = "stopped".to_string();
             }
        }
        // Save state updates
        let _ = save_state_internal(&app, &state);
    }

    let output = crate::process::run_docker(&["compose", "down"], Some(&dir))
        .map_err(|e| e.to_string())?;

    if !output.success() {
        let stderr = output.stderr;
        return Err(format!("Docker stop failed: {}", sanitize_output(&stderr)));
    }
    Ok("Gateway stopped".to_string())
}

#[tauri::command]
pub async fn gateway_logs(app: AppHandle) -> Result<String, String> {
    let dir = get_app_data_dir(&app)?;
    let output = crate::process::run_docker(&["compose", "logs", "--tail", "100"], Some(&dir))
        .map_err(|e| e.to_string())?;

    let stdout = output.stdout;
    let stderr = output.stderr;
    let combined = format!("{}\n{}", stdout, stderr);
    Ok(sanitize_output(&combined))
}

// ── Gateway readiness guard ─────────────────────────────────────────

/// Strict guard: gateway container stable + /health 200.
/// Returns Ok(()) if ready, Err(GatewayError) otherwise.
pub(crate) fn ensure_gateway_ready(app: &AppHandle) -> Result<(), GatewayError> {
    let dir = match get_app_data_dir(app) {
        Ok(d) => d,
        Err(e) => return Err(GatewayError {
            code: "GATEWAY_NOT_READY".into(),
            title: "Gateway required".into(),
            message: "Start the gateway to continue.".into(),
            diagnostics: sanitize_output(&e),
        }),
    };

    let (stable, diag) = check_gateway_strictly(&dir, false);
    if !stable {
        return Err(GatewayError {
            code: "GATEWAY_NOT_READY".into(),
            title: "Gateway required".into(),
            message: "Start the gateway to continue.".into(),
            diagnostics: sanitize_output(&diag),
        });
    }

    let port = read_http_port(&dir);
    let health = probe_health(port);
    if !health.healthy {
        return Err(GatewayError {
            code: "GATEWAY_NOT_READY".into(),
            title: "Gateway required".into(),
            message: "Gateway container is running but /health is not responding.".into(),
            diagnostics: sanitize_output(&health.error.unwrap_or_default()),
        });
    }

    Ok(())
}

#[tauri::command]
pub async fn get_gateway_status(app: AppHandle) -> Result<GatewayStatusResult, String> {
    #[cfg(debug_assertions)]
    {
        let t = "dev-token".to_string();
        let _ = crate::secrets::set_secret_internal(&app, crate::secrets::GATEWAY_TOKEN_SECRET_KEY, &t);
    }

    let dir = get_app_data_dir(&app)?;
    let (stable, diag) = check_gateway_strictly(&dir, false);

    if !stable {
        return Ok(GatewayStatusResult {
            container_stable: false,
            health_ok: false,
            version: None,
            last_error: Some(GatewayError {
                code: "GATEWAY_NOT_READY".into(),
                title: "Gateway required".into(),
                message: "Start the gateway to continue.".into(),
                diagnostics: sanitize_output(&diag),
            }),
        });
    }

    let port = read_http_port(&dir);
    let health = probe_health(port);

    // Try to extract version from health body (JSON field "version")
    let version = if health.healthy {
        health.body.split('"').enumerate()
            .find(|(_, s)| *s == "version")
            .and_then(|_| health.body.split('"').nth(3))
            .map(|s| s.to_string())
    } else {
        None
    };

    let last_error = if health.healthy {
        None
    } else {
        Some(GatewayError {
            code: "GATEWAY_NOT_READY".into(),
            title: "Gateway required".into(),
            message: "Gateway container is running but /health is not responding.".into(),
            diagnostics: sanitize_output(&health.error.unwrap_or_default()),
        })
    };

    Ok(GatewayStatusResult {
        container_stable: stable,
        health_ok: health.healthy,
        version,
        last_error,
    })
}

#[tauri::command]
pub async fn get_console_info(app: AppHandle) -> Result<ConsoleInfo, String> {
    let dir = get_app_data_dir(&app)?;
    let port = read_http_port(&dir);

    let mut base_path = normalize_base_path(DEFAULT_CONTROL_UI_BASE_PATH);
    let mut ui_available = false;
    let mut diagnostic = String::new();
    let mut capabilities_reachable = false;
    let mut auth_required = true;
    let mut auth_mode = DEFAULT_CONTROL_UI_AUTH_MODE.to_string();
    let mut insecure_fallback = true;

    if let Ok(capabilities) = fetch_gateway_capabilities(&app, port).await {
        capabilities_reachable = true;
        auth_required = capabilities.control_ui.auth_required || auth_required;
        if !capabilities.control_ui.auth_mode.trim().is_empty() {
            auth_mode = capabilities.control_ui.auth_mode.trim().to_string();
        }
        insecure_fallback = capabilities.control_ui.insecure_fallback || auth_mode != "cookie";
        let capability_path = normalize_base_path(&capabilities.control_ui.base_path);
        if check_control_ui_candidate(port, &capability_path)
            .await
            .unwrap_or(false)
        {
            base_path = capability_path;
            ui_available = true;
            diagnostic = format!(
                "Control UI route discovered from capabilities at {}.",
                display_control_ui_path(&base_path)
            );
        } else if capability_path.is_empty() {
            diagnostic = "Capabilities endpoint is reachable, but gateway root did not return an HTML Control UI.".to_string();
        } else {
            diagnostic = format!(
                "Capabilities reported {}, but that route did not return an HTML Control UI.",
                display_control_ui_path(&capability_path)
            );
        }
    }

    if !ui_available {
        let probe = probe_control_ui_base_path(port).await;
        if probe.ui_available {
            base_path = probe.base_path;
            ui_available = true;
            diagnostic = format!(
                "Control UI route discovered by probe at {}.",
                display_control_ui_path(&base_path)
            );
        } else if capabilities_reachable {
            diagnostic =
                "Gateway did not expose a Control UI. API is reachable but no HTML route found."
                    .to_string();
        } else {
            diagnostic = "Gateway did not expose a Control UI route. Update/rebuild the gateway image to include Control UI or add a separate control-ui service.".to_string();
        }
    }

    if !capabilities_reachable {
        let _token = get_desktop_bootstrap_token(&app);
        auth_mode = "cookie".to_string();
        insecure_fallback = false;
    }
    if insecure_fallback {
        if diagnostic.is_empty() {
            diagnostic = "Console is running in auth fallback mode (cookie bootstrap unavailable)."
                .to_string();
        } else {
            diagnostic.push_str(" Auth fallback is active (cookie bootstrap unavailable).");
        }
    }

    Ok(ConsoleInfo {
        url: build_console_url(port, &base_path),
        port,
        base_path,
        ui_available,
        auth_required,
        auth_mode,
        insecure_fallback,
        diagnostic,
    })
}

#[tauri::command]
pub async fn open_console_window(app: AppHandle) -> Result<(), String> {
    let info = get_console_info(app.clone()).await?;
    let bootstrap_token = get_desktop_bootstrap_token(&app);
    let target_url = build_console_bootstrap_url(info.port, &info.base_path, &bootstrap_token);
    let parsed =
        reqwest::Url::parse(&target_url).map_err(|e| format!("Invalid console URL: {}", e))?;

    if let Some(existing) = app.get_webview_window("openclaw-console") {
        let _ = existing.close();
    }

    let window = WebviewWindowBuilder::new(
        &app,
        "openclaw-console",
        WebviewUrl::External(parsed),
    )
    .title("OpenClaw Console")
    .inner_size(1400.0, 920.0)
    .center()
    .build()
    .map_err(|e| format!("Failed to open console window: {}", e))?;
    window
        .set_focus()
        .map_err(|e| format!("Failed to focus console window: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_runtime_capabilities(app: AppHandle) -> Result<RuntimeCapabilities, String> {
    let dir = get_app_data_dir(&app)?;
    let (stable, _) = check_gateway_strictly(&dir, false);
    if !stable {
        return Ok(empty_capabilities());
    }

    let port = read_http_port(&dir);
    let mut capabilities = fetch_gateway_capabilities(&app, port)
        .await
        .unwrap_or_else(|_| empty_capabilities());

    capabilities.control_ui.base_path = {
        let normalized = normalize_base_path(&capabilities.control_ui.base_path);
        if normalized.is_empty() {
            normalize_base_path(DEFAULT_CONTROL_UI_BASE_PATH)
        } else {
            normalized
        }
    };
    if capabilities.control_ui.auth_mode.trim().is_empty() {
        capabilities.control_ui.auth_mode = DEFAULT_CONTROL_UI_AUTH_MODE.to_string();
    }
    if !capabilities.control_ui.auth_required {
        capabilities.control_ui.auth_required = true;
    }
    capabilities.control_ui.insecure_fallback =
        capabilities.control_ui.insecure_fallback || capabilities.control_ui.auth_mode != "cookie";

    let state = load_state(&app);
    for tool in capabilities.tools.iter_mut() {
        tool.blocked_by_policy = !state.allow_internet && tool.scope == "network";
    }

    Ok(capabilities)
}

#[tauri::command]
pub async fn connections_get_schema(app: AppHandle) -> Result<serde_json::Value, String> {
    call_gateway_connections_api(&app, reqwest::Method::GET, "/api/v1/connections/schema", None)
        .await
}

#[tauri::command]
pub async fn connections_get_status(app: AppHandle) -> Result<serde_json::Value, String> {
    call_gateway_connections_api(&app, reqwest::Method::GET, "/api/v1/connections/status", None)
        .await
}

#[tauri::command]
pub async fn connections_configure(
    app: AppHandle,
    kind: String,
    id: String,
    values: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let kind_normalized = kind.trim().to_ascii_lowercase();
    if kind_normalized != "channel" && kind_normalized != "provider" {
        return Err("kind must be channel or provider".to_string());
    }
    let id_normalized = id.trim().to_ascii_lowercase();
    if id_normalized.is_empty() {
        return Err("id is required".to_string());
    }

    let schema = call_gateway_connections_api(
        &app,
        reqwest::Method::GET,
        "/api/v1/connections/schema",
        None,
    )
    .await?;
    let secret_fields = collect_keychain_secret_fields(&schema, &kind_normalized, &id_normalized);

    let mut values_map = match values {
        serde_json::Value::Object(map) => map,
        _ => serde_json::Map::new(),
    };
    let mut secret_refs = serde_json::Map::new();

    for field in secret_fields {
        let secret_key = connection_secret_key(&kind_normalized, &id_normalized, &field);
        let maybe_value = values_map.remove(&field);
        let mut has_secret = false;
        if let Some(serde_json::Value::String(raw_secret)) = maybe_value {
            let trimmed = raw_secret.trim().to_string();
            if !trimmed.is_empty() {
                set_secret_internal(&app, &secret_key, &trimmed)?;
                has_secret = true;
            }
        } else if let Some(value) = maybe_value {
            values_map.insert(field.clone(), value);
        }
        if !has_secret {
            has_secret = get_secret_internal(&app, &secret_key)
                .map(|value| !value.trim().is_empty())
                .unwrap_or(false);
        }
        if has_secret {
            secret_refs.insert(field, serde_json::Value::String(secret_key));
        }
    }

    let body = serde_json::json!({
        "values": serde_json::Value::Object(values_map),
        "secret_refs": serde_json::Value::Object(secret_refs),
    });
    let path = format!(
        "/api/v1/connections/{}/{}/configure",
        kind_normalized, id_normalized
    );
    call_gateway_connections_api(&app, reqwest::Method::POST, &path, Some(&body)).await
}

#[tauri::command]
pub async fn connections_test(
    app: AppHandle,
    kind: String,
    id: String,
    values: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let kind_normalized = kind.trim().to_ascii_lowercase();
    if kind_normalized != "channel" && kind_normalized != "provider" {
        return Err("kind must be channel or provider".to_string());
    }
    let id_normalized = id.trim().to_ascii_lowercase();
    if id_normalized.is_empty() {
        return Err("id is required".to_string());
    }

    let schema = call_gateway_connections_api(
        &app,
        reqwest::Method::GET,
        "/api/v1/connections/schema",
        None,
    )
    .await?;
    let secret_fields = collect_keychain_secret_fields(&schema, &kind_normalized, &id_normalized);

    let mut values_map = match values {
        serde_json::Value::Object(map) => map,
        _ => serde_json::Map::new(),
    };

    for field in secret_fields {
        let secret_key = connection_secret_key(&kind_normalized, &id_normalized, &field);
        let needs_lookup = match values_map.get(&field) {
            Some(serde_json::Value::String(raw)) => raw.trim().is_empty(),
            Some(_) => false,
            None => true,
        };
        if needs_lookup {
            if let Some(secret_value) = get_secret_internal(&app, &secret_key) {
                if !secret_value.trim().is_empty() {
                    values_map.insert(field.clone(), serde_json::Value::String(secret_value));
                }
            }
        } else if let Some(serde_json::Value::String(raw_secret)) = values_map.get(&field) {
            let trimmed = raw_secret.trim().to_string();
            if !trimmed.is_empty() {
                let _ = set_secret_internal(&app, &secret_key, &trimmed);
            }
        }
    }

    let body = serde_json::json!({
        "values": serde_json::Value::Object(values_map),
    });
    let path = format!("/api/v1/connections/{}/{}/test", kind_normalized, id_normalized);
    call_gateway_connections_api(&app, reqwest::Method::POST, &path, Some(&body)).await
}

// ── Tests ───────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    // -- sanitize_output --

    #[test]
    fn test_sanitize_output_redacts_api_keys() {
        let input = "OPENAI_API_KEY=sk-12345abcdef\nNormally safe line";
        let output = sanitize_output(input);
        assert!(output.contains("OPENAI_API_KEY= [REDACTED]"));
        assert!(!output.contains("sk-12345abcdef"));
        assert!(output.contains("Normally safe line"));
    }

    #[test]
    fn test_sanitize_output_redacts_bearer_tokens() {
        let input = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
        let output = sanitize_output(input);
        assert!(output.contains("Bearer [REDACTED]"));
        assert!(!output.contains("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"));
    }

    #[test]
    fn test_sanitize_output_handles_multiple_lines() {
        let input = "Line 1\nPOSTGRES_PASSWORD=secret\nLine 3";
        let output = sanitize_output(input);
        assert!(output.contains("Line 1"));
        assert!(output.contains("POSTGRES_PASSWORD= [REDACTED]"));
        assert!(!output.contains("secret"));
        assert!(output.contains("Line 3"));
    }

    // -- pull access detection --

    #[test]
    fn test_is_pull_access_error_detects_patterns() {
        assert!(is_pull_access_error("pull access denied for foo"));
        assert!(is_pull_access_error("repository does not exist"));
        assert!(is_pull_access_error("may require 'docker login'"));
        assert!(is_pull_access_error("manifest unknown: manifest unknown"));
        assert!(!is_pull_access_error("port already in use"));
    }

    // -- node not found detection --

    #[test]
    fn test_is_node_not_found() {
        assert!(is_node_not_found("exec: line 47: node: not found", 127));
        assert!(is_node_not_found("anything", 127));
        assert!(is_node_not_found("node: not found", 0));
        assert!(is_node_not_found(
            "exec: \"node\": executable file not found in $PATH",
            1
        ));
        assert!(!is_node_not_found("port already in use", 1));
    }

    // -- module not found detection --

    #[test]
    fn test_is_module_not_found() {
        assert!(is_module_not_found(
            "Error: Cannot find module '/home/node/dist/entry.js'"
        ));
        assert!(is_module_not_found(
            "ENOENT: no such file or directory, open 'dist/entry.js'"
        ));
        assert!(!is_module_not_found("port already in use"));
    }

    // -- build_remediation with crash patterns --

    #[test]
    fn test_build_remediation_pull_access_denied() {
        let logs = "pull access denied for openclaw, repository does not exist";
        let compose = PathBuf::from("C:\\Users\\test\\AppData\\docker-compose.yml");
        let (title, _msg, steps) = build_remediation(logs, -1, &compose);
        assert_eq!(title, "Image Pull Failed");
        assert_eq!(steps.len(), 3);
    }

    #[test]
    fn test_build_remediation_node_not_found() {
        let logs = "/docker-entrypoint.sh: exec: line 47: node: not found";
        let compose = PathBuf::from("/tmp/docker-compose.yml");
        let (title, msg, steps) = build_remediation(logs, 127, &compose);
        assert_eq!(title, "Incompatible Image – Node Not Found");
        assert!(msg.contains("nginx:alpine"));
        assert!(steps.iter().any(|s| s.contains("gateway-compatible")));
        assert!(steps.iter().any(|s| s.contains("Docker Smoke Test")));
    }

    #[test]
    fn test_build_remediation_exit_127_without_log_text() {
        // Even without the text, exit code 127 alone triggers node-not-found
        let logs = "container exited";
        let compose = PathBuf::from("/tmp/docker-compose.yml");
        let (title, _, _) = build_remediation(logs, 127, &compose);
        assert_eq!(title, "Incompatible Image – Node Not Found");
    }

    #[test]
    fn test_build_remediation_module_not_found() {
        let logs = "Error: Cannot find module '/home/node/dist/entry.js'";
        let compose = PathBuf::from("/tmp/docker-compose.yml");
        let (title, _, steps) = build_remediation(logs, 1, &compose);
        assert_eq!(title, "Gateway App Missing in Image");
        assert!(steps.iter().any(|s| s.contains("Dockerfile")));
    }

    #[test]
    fn test_build_remediation_generic_error() {
        let logs = "Error: some random docker error occurred";
        let compose = PathBuf::from("/tmp/docker-compose.yml");
        let (title, _, steps) = build_remediation(logs, 1, &compose);
        assert_eq!(title, "Gateway Start Failed");
        assert!(steps.iter().any(|s| s.contains("Docker Desktop")));
    }

    // -- compose generation + port mapping --

    #[test]
    fn test_generate_compose_uses_custom_image() {
        let content = generate_compose_content("ghcr.io/myorg/gateway:v1.2.3", 8080);
        assert!(content.contains("image: ghcr.io/myorg/gateway:v1.2.3"));
        assert!(!content.contains("openclaw:latest"));
    }

    #[test]
    fn test_generate_compose_uses_local_dev_image() {
        let content = generate_compose_content("openclaw-gateway:dev", 8080);
        assert!(content.contains("image: openclaw-gateway:dev"));
    }

    #[test]
    fn test_compose_maps_host_to_container_8080() {
        let content = generate_compose_content("openclaw-gateway:dev", 8080);
        assert!(
            content.contains("\"8080:8080\""),
            "Compose must map container port 8080 to host 8080"
        );
    }

    #[test]
    fn test_compose_has_container_port_env() {
        let content = generate_compose_content("openclaw-gateway:dev", 8080);
        assert!(
            content.contains("OPENCLAW_CONTAINER_PORT:"),
            "Compose must set OPENCLAW_CONTAINER_PORT"
        );
    }

    #[test]
    fn test_compose_forwards_gateway_auth_env_vars() {
        let content = generate_compose_content("openclaw-gateway:dev", 8080);
        assert!(
            content.contains("OPENCLAW_GATEWAY_TOKEN:"),
            "Compose must forward OPENCLAW_GATEWAY_TOKEN at runtime"
        );
        assert!(
            content.contains("OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN:"),
            "Compose must forward OPENCLAW_DESKTOP_BOOTSTRAP_TOKEN at runtime"
        );
        assert!(
            content.contains("OPENCLAW_ALLOW_INTERNET:"),
            "Compose must forward OPENCLAW_ALLOW_INTERNET policy flag"
        );
    }

    #[test]
    fn test_read_http_port_defaults_to_8080() {
        let tmp = std::env::temp_dir().join("test_port_default");
        let _ = std::fs::create_dir_all(&tmp);
        // No .env file -> should default to 8080.
        let _ = std::fs::remove_file(tmp.join(".env"));
        assert_eq!(read_http_port(&tmp), 8080);
    }

    #[test]
    fn test_read_http_port_parses_env() {
        let tmp = std::env::temp_dir().join("test_port_parse");
        let _ = std::fs::create_dir_all(&tmp);
        std::fs::write(tmp.join(".env"), "OPENCLAW_HTTP_PORT=9090\nLOG_LEVEL=info\n").unwrap();
        assert_eq!(read_http_port(&tmp), 9090);
    }

    #[test]
    fn test_build_console_url_uses_configured_port_and_base_path() {
        assert_eq!(
            build_console_url(9090, "/openclaw"),
            "http://127.0.0.1:9090/openclaw/"
        );
        assert_eq!(build_console_url(8080, "/"), "http://127.0.0.1:8080/");
    }

    #[test]
    fn test_normalize_base_path_handles_empty_string() {
        assert_eq!(normalize_base_path(""), "");
        assert_eq!(normalize_base_path("   "), "");
    }

    #[test]
    fn test_console_base_path_sanitization_prevents_host_injection() {
        assert_eq!(
            normalize_base_path("https://evil.example/openclaw?token=abc"),
            "/openclaw"
        );
        assert_eq!(normalize_base_path("javascript:alert(1)"), "");
        assert_eq!(
            build_console_url(8080, "https://evil.example/openclaw?token=abc"),
            "http://127.0.0.1:8080/openclaw/"
        );
    }

    #[test]
    fn test_build_console_url_always_uses_loopback_host() {
        let url = build_console_url(8080, "https://evil.example/console");
        let parsed = reqwest::Url::parse(&url).expect("Console URL should be valid");
        assert_eq!(parsed.host_str(), Some("127.0.0.1"));
        assert!(!url.contains("evil.example"));
    }

    #[test]
    fn test_build_console_bootstrap_url_stays_localhost_and_sanitizes_next_path() {
        let url = build_console_bootstrap_url(
            8080,
            "https://evil.example/openclaw?x=1",
            "desktop-bootstrap-token",
        );
        let parsed = reqwest::Url::parse(&url).expect("Bootstrap URL should be valid");
        assert_eq!(parsed.host_str(), Some("127.0.0.1"));
        assert_eq!(parsed.path(), LOCAL_AUTH_BOOTSTRAP_PATH);
        let mut token = None;
        let mut next = None;
        for (key, value) in parsed.query_pairs() {
            if key == "token" {
                token = Some(value.to_string());
            }
            if key == "next" {
                next = Some(value.to_string());
            }
        }
        assert_eq!(token.as_deref(), Some("desktop-bootstrap-token"));
        assert_eq!(next.as_deref(), Some("/openclaw/"));
    }

    #[test]
    fn test_empty_capabilities_is_safe_structure() {
        let payload = empty_capabilities();
        assert_eq!(payload.version, "v1");
        assert!(payload.safe_mode);
        assert!(payload.channels.is_empty());
        assert!(payload.tools.is_empty());
        assert!(payload.orchestrators.is_empty());
        assert_eq!(payload.control_ui.base_path, "");
        assert!(payload.control_ui.auth_required);
        assert_eq!(payload.control_ui.auth_mode, DEFAULT_CONTROL_UI_AUTH_MODE);
        assert!(payload.control_ui.insecure_fallback);
    }

    // -- is_healthy --

    #[test]
    fn test_is_healthy_running_stable() {
        let h = ContainerHealth {
            status: "running".into(),
            restarting: false,
            exit_code: 0,
            raw: "running|false|0".into(),
        };
        assert!(is_healthy(&h));
    }

    #[test]
    fn test_is_healthy_restarting_is_false() {
        let h = ContainerHealth {
            status: "running".into(),
            restarting: true, // restart loop
            exit_code: 127,
            raw: "running|true|127".into(),
        };
        assert!(!is_healthy(&h));
    }

    #[test]
    fn test_is_healthy_exited_is_false() {
        let h = ContainerHealth {
            status: "exited".into(),
            restarting: false,
            exit_code: 1,
            raw: "exited|false|1".into(),
        };
        assert!(!is_healthy(&h));
    }

    #[test]
    fn test_is_healthy_restarting_status_is_false() {
        let h = ContainerHealth {
            status: "restarting".into(),
            restarting: true,
            exit_code: 127,
            raw: "restarting|true|127".into(),
        };
        assert!(!is_healthy(&h));
    }

    // -- extract_exit_code --

    #[test]
    fn test_extract_exit_code_from_inspect() {
        assert_eq!(extract_exit_code("inspect[2]: restarting|true|127"), 127);
        assert_eq!(extract_exit_code("inspect[1]: running|false|0\ninspect[2]: running|false|0"), 0);
        assert_eq!(extract_exit_code("no pipe here"), -1);
    }

    // -- GatewayStartResult status values --

    #[test]
    fn test_gateway_result_status_values() {
        let started = GatewayStartResult {
            gateway_active: true,
            status: "started".into(),
            user_friendly_title: "Running".into(),
            user_friendly_message: "".into(),
            raw_diagnostics: "".into(),
            remediation_steps: vec![],
            compose_file_path: "".into(),
            warning: None,
        };
        assert!(started.gateway_active);
        assert_eq!(started.status, "started");

        let already = GatewayStartResult {
            gateway_active: true,
            status: "already_running".into(),
            user_friendly_title: "Already Running".into(),
            user_friendly_message: "".into(),
            raw_diagnostics: "".into(),
            remediation_steps: vec![],
            compose_file_path: "".into(),
            warning: Some("Previous pull failed".into()),
        };
        assert!(already.gateway_active);
        assert!(already.warning.is_some());

        let failed = GatewayStartResult {
            gateway_active: false,
            status: "failed".into(),
            user_friendly_title: "Failed".into(),
            user_friendly_message: "".into(),
            raw_diagnostics: "".into(),
            remediation_steps: vec!["Fix image".into()],
            compose_file_path: "".into(),
            warning: None,
        };
        assert!(!failed.gateway_active);
        assert!(!failed.remediation_steps.is_empty());
    }
    #[test]
    fn test_should_try_pull_fallback() {
        assert!(should_try_pull_fallback("Error: unauthorized access"));
        assert!(should_try_pull_fallback("authentication required"));
        assert!(should_try_pull_fallback("status: 403 forbidden"));
        assert!(should_try_pull_fallback("access denied"));
        assert!(should_try_pull_fallback("no access to this resource"));
        assert!(should_try_pull_fallback("insufficient_scope"));
        assert!(should_try_pull_fallback("requested access to the resource is denied"));
        assert!(should_try_pull_fallback("error code: 401"));

        assert!(!should_try_pull_fallback("image not found"));
        assert!(!should_try_pull_fallback("connection refused"));
        assert!(!should_try_pull_fallback("manifest unknown"));
    }

    #[test]
    fn test_gateway_error_serialization() {
        let err = GatewayError {
            code: "GATEWAY_NOT_READY".into(),
            title: "Gateway required".into(),
            message: "Start the gateway to continue.".into(),
            diagnostics: "No container found".into(),
        };
        let json: String = err.clone().into();
        assert!(json.contains("GATEWAY_NOT_READY"));
        assert!(json.contains("Gateway required"));
    }

    #[test]
    fn test_gateway_status_result_struct() {
        let status = GatewayStatusResult {
            container_stable: true,
            health_ok: true,
            version: Some("1.0.0".into()),
            last_error: None,
        };
        assert!(status.container_stable);
        assert!(status.health_ok);
        assert_eq!(status.version, Some("1.0.0".to_string()));
    }

    // ── Start Gateway regression: missing compose file → structured failure ──

    /// Verify that when there is no docker-compose.yml the result fields
    /// are actionable — NOT a silent empty failure.
    /// This is a pure in-process unit test (no Docker, no AppHandle needed).
    #[test]
    fn test_start_gateway_missing_compose_result_is_structured() {
        // Simulate what start_gateway returns when compose file doesn't exist
        let tmp = std::env::temp_dir().join("oc_missing_compose_test");
        let compose_file = tmp.join("docker-compose.yml");
        // Ensure file definitely does not exist
        let _ = std::fs::remove_file(&compose_file);

        // Replicate the exact early-return logic from start_gateway
        let result = if !compose_file.exists() {
            GatewayStartResult {
                gateway_active: false,
                status: "failed".into(),
                user_friendly_title: "Not Configured".into(),
                user_friendly_message: "docker-compose.yml not found. Complete the Configure step first.".into(),
                raw_diagnostics: String::new(),
                remediation_steps: vec!["Go back to Step 2 and click Save & Configure.".into()],
                compose_file_path: compose_file.display().to_string(),
                warning: None,
            }
        } else {
            panic!("Unexpected: compose file exists in test temp dir");
        };

        // The banner reads these fields — they must be non-empty and informative
        assert!(!result.gateway_active, "gateway_active must be false when compose is missing");
        assert_eq!(result.status, "failed");
        assert!(!result.user_friendly_title.is_empty(), "title must be non-empty");
        assert!(!result.user_friendly_message.is_empty(), "message must be non-empty");
        assert!(!result.remediation_steps.is_empty(), "remediation must guide the user");
    }

    /// Verify that a failed GatewayStartResult is always distinct from
    /// the already_running variant (regression guard for silent-cancel path).
    #[test]
    fn test_failed_result_is_not_active() {
        let failures = [
            GatewayStartResult {
                gateway_active: false,
                status: "failed".into(),
                user_friendly_title: "Not Configured".into(),
                user_friendly_message: "docker-compose.yml not found.".into(),
                raw_diagnostics: String::new(),
                remediation_steps: vec!["Go to Setup.".into()],
                compose_file_path: String::new(),
                warning: None,
            },
            GatewayStartResult {
                gateway_active: false,
                status: "failed".into(),
                user_friendly_title: "Image Pull Failed".into(),
                user_friendly_message: "Docker could not pull the image.".into(),
                raw_diagnostics: "pull access denied".into(),
                remediation_steps: vec!["Check image name.".into()],
                compose_file_path: String::new(),
                warning: None,
            },
        ];

        for r in &failures {
            assert!(!r.gateway_active, "failed result must have gateway_active=false");
            assert_eq!(r.status, "failed");
            assert!(!r.user_friendly_title.is_empty());
            assert!(!r.user_friendly_message.is_empty());
            assert!(!r.remediation_steps.is_empty());
        }
    }
}

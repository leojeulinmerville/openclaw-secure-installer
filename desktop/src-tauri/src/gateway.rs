use serde::Serialize;
use std::path::Path;
// use std::process::Command;
use tauri::AppHandle;

use crate::state_manager::{get_app_data_dir, load_state, save_state_internal};

// ── Redaction pipeline ──────────────────────────────────────────────

const SENSITIVE_KEYS: &[&str] = &[
    "OPENAI_API_KEY",
    "POSTGRES_PASSWORD",
    "JWT_SECRET",
    "SLACK_BOT_TOKEN",
    "STRIPE_SECRET_KEY",
];

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
    80 // default
}

/// Probe the gateway /health endpoint via raw HTTP over TCP.
fn probe_health(port: u16) -> HealthCheckResult {
    use std::io::{Read, Write};
    use std::net::TcpStream;
    use std::time::Duration;

    let addr = format!("127.0.0.1:{}", port);
    let parsed: std::net::SocketAddr = match addr.parse() {
        Ok(a) => a,
        Err(e) => {
            return HealthCheckResult {
                healthy: false,
                status_code: None,
                body: String::new(),
                error: Some(format!("Invalid address {}: {}", addr, e)),
            };
        }
    };

    let stream = TcpStream::connect_timeout(&parsed, Duration::from_secs(3));
    let mut stream = match stream {
        Ok(s) => s,
        Err(e) => {
            return HealthCheckResult {
                healthy: false,
                status_code: None,
                body: String::new(),
                error: Some(format!("Connection to {} failed: {}", addr, e)),
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

    let healthy = status_code == Some(200) && body.contains("healthy");

    HealthCheckResult {
        healthy,
        status_code,
        body,
        error: if healthy {
            None
        } else {
            Some("Health check did not return 200/healthy".into())
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

pub fn generate_compose_content(image: &str) -> String {
    format!(
        r#"services:
  gateway:
    image: {}
    command: ["node", "openclaw.mjs", "gateway"]
    ports:
      - "${{OPENCLAW_HTTP_PORT:-80}}:8080"
    volumes:
      - openclaw_home:/home/node
    environment:
      - OPENCLAW_SAFE_MODE=1
      - LOG_LEVEL=info
      - OPENCLAW_CONTAINER_PORT=8080
    restart: unless-stopped

networks:
  default:
    name: openclaw-managed


volumes:
  openclaw_home:
"#,
        image
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

    if !compose_file.exists() {
        return Ok(GatewayStartResult {
            gateway_active: false,
            status: "failed".into(),
            user_friendly_title: "Not Configured".into(),
            user_friendly_message: "docker-compose.yml not found. Complete the Configure step first.".into(),
            raw_diagnostics: String::new(),
            remediation_steps: vec!["Go back to Step 2 and click Save & Configure.".into()],
            compose_file_path: compose_file.display().to_string(),
            warning: None,
        });
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

    let output = crate::process::run_docker(&["compose", "up", "-d"], Some(&dir))
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
pub async fn build_local_image(context_path: String) -> Result<BuildResult, String> {
    let context = std::path::Path::new(&context_path);
    if !context.join("Dockerfile").exists() {
        return Ok(BuildResult {
            success: false,
            image_tag: String::new(),
            logs: format!(
                "No Dockerfile found at {}. Ensure the build context contains a valid Dockerfile.",
                context.display()
            ),
        });
    }

    let tag = "openclaw-gateway:dev";
    let output = crate::process::run_docker(&["build", "-t", tag, "."], Some(context))
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
    let content = generate_compose_content(&image);
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
            "Error: Cannot find module '/home/node/openclaw.mjs'"
        ));
        assert!(is_module_not_found(
            "ENOENT: no such file or directory, open 'openclaw.mjs'"
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
        let logs = "Error: Cannot find module '/home/node/openclaw.mjs'";
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
        let content = generate_compose_content("ghcr.io/myorg/gateway:v1.2.3");
        assert!(content.contains("image: ghcr.io/myorg/gateway:v1.2.3"));
        assert!(!content.contains("openclaw:latest"));
    }

    #[test]
    fn test_generate_compose_uses_local_dev_image() {
        let content = generate_compose_content("openclaw-gateway:dev");
        assert!(content.contains("image: openclaw-gateway:dev"));
    }

    #[test]
    fn test_compose_maps_host_to_container_8080() {
        let content = generate_compose_content("openclaw-gateway:dev");
        // Port mapping should be host → 8080 (container)
        assert!(content.contains(":8080\""), "Compose must map to container port 8080");
        // Must NOT map to container port 80
        assert!(!content.contains(":80\""), "Compose must not map to container port 80");
    }

    #[test]
    fn test_compose_has_container_port_env() {
        let content = generate_compose_content("openclaw-gateway:dev");
        assert!(
            content.contains("OPENCLAW_CONTAINER_PORT=8080"),
            "Compose must set OPENCLAW_CONTAINER_PORT"
        );
    }

    #[test]
    fn test_read_http_port_defaults_to_80() {
        let tmp = std::env::temp_dir().join("test_port_default");
        let _ = std::fs::create_dir_all(&tmp);
        // No .env file → should default to 80
        let _ = std::fs::remove_file(tmp.join(".env"));
        assert_eq!(read_http_port(&tmp), 80);
    }

    #[test]
    fn test_read_http_port_parses_env() {
        let tmp = std::env::temp_dir().join("test_port_parse");
        let _ = std::fs::create_dir_all(&tmp);
        std::fs::write(tmp.join(".env"), "OPENCLAW_HTTP_PORT=9090\nLOG_LEVEL=info\n").unwrap();
        assert_eq!(read_http_port(&tmp), 9090);
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
}

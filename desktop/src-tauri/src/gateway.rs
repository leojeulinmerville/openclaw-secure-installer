use serde::Serialize;
use std::path::Path;
use std::process::Command;
use tauri::AppHandle;

use crate::state_manager::get_app_data_dir;

// ── Redaction pipeline ──────────────────────────────────────────────

const SENSITIVE_KEYS: &[&str] = &[
    "OPENAI_API_KEY",
    "POSTGRES_PASSWORD",
    "JWT_SECRET",
    "SLACK_BOT_TOKEN",
    "STRIPE_SECRET_KEY",
];

fn sanitize_output(text: &str) -> String {
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

// ── Structured result ───────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GatewayStartResult {
    /// Is a gateway container actually running right now?
    pub gateway_active: bool,
    /// "started" | "already_running" | "failed"
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
}

// ── Remediation builder ─────────────────────────────────────────────

const PULL_ERROR_PATTERNS: &[&str] = &[
    "pull access denied",
    "repository does not exist",
    "may require 'docker login'",
    "manifest unknown",
];

fn is_pull_access_error(stderr: &str) -> bool {
    let lower = stderr.to_lowercase();
    PULL_ERROR_PATTERNS
        .iter()
        .any(|pat| lower.contains(&pat.to_lowercase()))
}

fn build_remediation(
    stderr: &str,
    compose_path: &Path,
) -> (String, String, Vec<String>) {
    let compose_display = compose_path.display().to_string();

    if is_pull_access_error(stderr) {
        let title = "Image Pull Failed".to_string();
        let message = format!(
            "Docker could not pull the container image.\n\
             Use the Image Source selector above to pick a valid image."
        );
        let steps = vec![
            "Change the image in the Image Source section above and click \"Test Pull Access\" to verify.".to_string(),
            "If using a private registry, log in first via the \"Private Registry\" tab.".to_string(),
            "For local development, use the \"Local Build\" tab to build and use a local image.".to_string(),
        ];
        (title, message, steps)
    } else {
        let title = "Gateway Start Failed".to_string();
        let message = format!(
            "docker compose up failed. Check the diagnostics below.\n\
             Compose file: {}",
            compose_display
        );
        let steps = vec![
            "Ensure Docker Desktop is running.".to_string(),
            "Check that no other service is using the configured ports.".to_string(),
            format!(
                "Inspect the compose file at {} for configuration errors.",
                compose_display
            ),
        ];
        (title, message, steps)
    }
}

// ── Container verification ──────────────────────────────────────────

/// Returns `(is_running, diagnostics_text)`.
fn check_gateway_running_internal(dir: &Path) -> (bool, String) {
    let output = Command::new("docker")
        .current_dir(dir)
        .args(["compose", "ps", "--format", "json"])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let stderr = String::from_utf8_lossy(&out.stderr);
            let has_running = stdout
                .lines()
                .any(|line| {
                    let lower = line.to_lowercase();
                    lower.contains("\"running\"") || lower.contains("\"state\":\"running\"")
                });
            let diag = format!("ps stdout: {}\nps stderr: {}", stdout.trim(), stderr.trim());
            (has_running, diag)
        }
        Err(e) => (false, format!("Failed to run docker compose ps: {}", e)),
    }
}

// ── Compose file rewrite ────────────────────────────────────────────

pub fn generate_compose_content(image: &str) -> String {
    format!(
        r#"services:
  gateway:
    image: {}
    command: ["node", "openclaw.mjs", "gateway"]
    ports:
      - "${{OPENCLAW_HTTP_PORT:-80}}:80"
      - "${{OPENCLAW_HTTPS_PORT:-443}}:443"
    volumes:
      - openclaw_home:/home/node
    environment:
      - OPENCLAW_SAFE_MODE=1
      - LOG_LEVEL=info
    restart: unless-stopped

volumes:
  openclaw_home:
"#,
        image
    )
}

// ── Tauri commands ──────────────────────────────────────────────────

#[tauri::command]
pub async fn is_gateway_running(app: AppHandle) -> Result<GatewayStartResult, String> {
    let dir = get_app_data_dir(&app)?;
    let compose_file = dir.join("docker-compose.yml");

    if !compose_file.exists() {
        return Ok(GatewayStartResult {
            gateway_active: false,
            status: "not_configured".to_string(),
            user_friendly_title: "Not Configured".to_string(),
            user_friendly_message: "No compose file found.".to_string(),
            raw_diagnostics: String::new(),
            remediation_steps: vec![],
            compose_file_path: compose_file.display().to_string(),
            warning: None,
        });
    }

    let (running, diag) = check_gateway_running_internal(&dir);
    Ok(GatewayStartResult {
        gateway_active: running,
        status: if running { "already_running" } else { "stopped" }.to_string(),
        user_friendly_title: if running {
            "Gateway Running".to_string()
        } else {
            "Gateway Stopped".to_string()
        },
        user_friendly_message: if running {
            "OpenClaw Gateway is active.".to_string()
        } else {
            "Gateway is not currently running.".to_string()
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
            status: "failed".to_string(),
            user_friendly_title: "Not Configured".to_string(),
            user_friendly_message: "docker-compose.yml not found. Please complete the Configure step first.".to_string(),
            raw_diagnostics: String::new(),
            remediation_steps: vec!["Go back to Step 2 and click Save & Configure.".to_string()],
            compose_file_path: compose_file.display().to_string(),
            warning: None,
        });
    }

    // 1) Check if already running BEFORE attempting compose up
    let (pre_running, _) = check_gateway_running_internal(&dir);
    if pre_running {
        return Ok(GatewayStartResult {
            gateway_active: true,
            status: "already_running".to_string(),
            user_friendly_title: "Gateway Already Running".to_string(),
            user_friendly_message: "The gateway container is already active. No action needed.".to_string(),
            raw_diagnostics: String::new(),
            remediation_steps: vec![],
            compose_file_path: compose_file.display().to_string(),
            warning: None,
        });
    }

    // 2) Run docker compose up -d
    let output = Command::new("docker")
        .current_dir(&dir)
        .args(["compose", "up", "-d"])
        .output()
        .map_err(|e| format!("Failed to execute docker: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined_raw = format!("{}\n{}", stdout, stderr);

    // 3) If exit code != 0 → check if maybe running anyway
    if !output.status.success() {
        let (post_running, _ps_diag) = check_gateway_running_internal(&dir);
        if post_running {
            // Container is running despite compose up failing (e.g. pull failed but old container still up)
            return Ok(GatewayStartResult {
                gateway_active: true,
                status: "already_running".to_string(),
                user_friendly_title: "Gateway Running (with warning)".to_string(),
                user_friendly_message: "The gateway container is running, but the last start command encountered errors.".to_string(),
                raw_diagnostics: sanitize_output(&combined_raw),
                remediation_steps: vec![],
                compose_file_path: compose_file.display().to_string(),
                warning: Some(format!("Last start attempt failed: {}", sanitize_output(&stderr))),
            });
        }
        // Not running, actual failure
        let (title, message, steps) = build_remediation(&stderr, &compose_file);
        return Ok(GatewayStartResult {
            gateway_active: false,
            status: "failed".to_string(),
            user_friendly_title: title,
            user_friendly_message: message,
            raw_diagnostics: sanitize_output(&combined_raw),
            remediation_steps: steps,
            compose_file_path: compose_file.display().to_string(),
            warning: None,
        });
    }

    // 4) Exit code 0 → verify container is actually running
    let (is_running, ps_diag) = check_gateway_running_internal(&dir);

    if is_running {
        Ok(GatewayStartResult {
            gateway_active: true,
            status: "started".to_string(),
            user_friendly_title: "Gateway Running".to_string(),
            user_friendly_message: "OpenClaw Gateway started successfully.".to_string(),
            raw_diagnostics: sanitize_output(&combined_raw),
            remediation_steps: vec![],
            compose_file_path: compose_file.display().to_string(),
            warning: None,
        })
    } else {
        let full_diag = format!("{}\n--- post-start check ---\n{}", combined_raw, ps_diag);
        Ok(GatewayStartResult {
            gateway_active: false,
            status: "failed".to_string(),
            user_friendly_title: "Gateway Failed to Stay Running".to_string(),
            user_friendly_message: "docker compose up succeeded but the gateway container is not running. It may have crashed on startup.".to_string(),
            raw_diagnostics: sanitize_output(&full_diag),
            remediation_steps: vec![
                "Run `docker compose logs gateway` in a terminal to see crash logs.".to_string(),
                format!("Check the compose file at {} for configuration errors.", compose_file.display()),
            ],
            compose_file_path: compose_file.display().to_string(),
            warning: None,
        })
    }
}

#[tauri::command]
pub async fn test_pull_access(image: String) -> Result<PullTestResult, String> {
    // Use docker manifest inspect — does not pull layers, just checks accessibility
    let output = Command::new("docker")
        .args(["manifest", "inspect", &image])
        .output()
        .map_err(|e| format!("Failed to execute docker: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}\n{}", stdout, stderr);

    Ok(PullTestResult {
        accessible: output.status.success(),
        image,
        diagnostics: sanitize_output(&combined),
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
        Command::new("explorer")
            .arg(dir.to_string_lossy().to_string())
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(dir.to_string_lossy().to_string())
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(dir.to_string_lossy().to_string())
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn stop_gateway(app: AppHandle) -> Result<String, String> {
    let dir = get_app_data_dir(&app)?;
    let output = Command::new("docker")
        .current_dir(&dir)
        .args(["compose", "down"])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Docker stop failed: {}", sanitize_output(&stderr)));
    }
    Ok("Gateway stopped".to_string())
}

#[tauri::command]
pub async fn gateway_logs(app: AppHandle) -> Result<String, String> {
    let dir = get_app_data_dir(&app)?;
    let output = Command::new("docker")
        .current_dir(&dir)
        .args(["compose", "logs", "--tail", "100"])
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}\n{}", stdout, stderr);
    Ok(sanitize_output(&combined))
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

    // -- build_remediation --

    #[test]
    fn test_build_remediation_pull_access_denied() {
        let stderr = r#"Error response from daemon: pull access denied for openclaw, repository does not exist or may require 'docker login'"#;
        let compose = PathBuf::from("C:\\Users\\test\\AppData\\docker-compose.yml");
        let (title, _message, steps) = build_remediation(stderr, &compose);

        assert_eq!(title, "Image Pull Failed");
        assert_eq!(steps.len(), 3);
        assert!(steps[0].contains("Image Source"));
        assert!(steps[1].contains("Private Registry"));
        assert!(steps[2].contains("Local Build"));
    }

    #[test]
    fn test_build_remediation_generic_error() {
        let stderr = "Error: some random docker error occurred";
        let compose = PathBuf::from("/tmp/docker-compose.yml");
        let (title, _message, steps) = build_remediation(stderr, &compose);
        assert_eq!(title, "Gateway Start Failed");
        assert!(steps.iter().any(|s| s.contains("Docker Desktop")));
    }

    // -- compose generation --

    #[test]
    fn test_generate_compose_uses_custom_image() {
        let content = generate_compose_content("ghcr.io/myorg/gateway:v1.2.3");
        assert!(content.contains("image: ghcr.io/myorg/gateway:v1.2.3"));
        assert!(!content.contains("openclaw:latest"));
    }

    #[test]
    fn test_generate_compose_uses_local_dev_image() {
        let content = generate_compose_content("openclaw:dev");
        assert!(content.contains("image: openclaw:dev"));
    }

    // -- GatewayStartResult status values --

    #[test]
    fn test_gateway_result_status_values() {
        // Verify the struct can represent all 3 states
        let started = GatewayStartResult {
            gateway_active: true,
            status: "started".to_string(),
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
            status: "already_running".to_string(),
            user_friendly_title: "Already Running".into(),
            user_friendly_message: "".into(),
            raw_diagnostics: "".into(),
            remediation_steps: vec![],
            compose_file_path: "".into(),
            warning: Some("Previous pull failed".into()),
        };
        assert!(already.gateway_active);
        assert_eq!(already.status, "already_running");
        assert!(already.warning.is_some());

        let failed = GatewayStartResult {
            gateway_active: false,
            status: "failed".to_string(),
            user_friendly_title: "Failed".into(),
            user_friendly_message: "Image Pull Failed".into(),
            raw_diagnostics: "pull access denied".into(),
            remediation_steps: vec!["Fix image".into()],
            compose_file_path: "".into(),
            warning: None,
        };
        assert!(!failed.gateway_active);
        assert_eq!(failed.status, "failed");
        assert!(!failed.remediation_steps.is_empty());
    }
}

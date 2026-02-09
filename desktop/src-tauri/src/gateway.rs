use serde::Serialize;
use std::path::{Path, PathBuf};
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

        // Key=Value redaction
        for key in SENSITIVE_KEYS {
            if line.contains(key) {
                redacted_line = format!("{}= [REDACTED]", key);
                break; // one match per line is enough
            }
        }

        // Bearer token redaction
        if let Some(idx) = redacted_line.find("Bearer ") {
            let prefix = &redacted_line[..idx];
            redacted_line = format!("{}Bearer [REDACTED]", prefix);
        }

        lines.push(redacted_line);
    }
    lines.join("\n")
}

// ── Structured result returned to the frontend ──────────────────────

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GatewayStartResult {
    pub gateway_active: bool,
    pub user_friendly_title: String,
    pub user_friendly_message: String,
    pub raw_diagnostics: String,
    pub remediation_steps: Vec<String>,
    pub compose_file_path: String,
}

// ── Remediation builder ─────────────────────────────────────────────

/// Patterns that indicate a Docker image pull failure.
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

/// Build a user-friendly error + remediation from the raw stderr.
fn build_remediation(
    stderr: &str,
    compose_path: &Path,
) -> (String, String, Vec<String>) {
    let compose_display = compose_path.display().to_string();

    if is_pull_access_error(stderr) {
        let title = "Image Pull Failed".to_string();
        let message = format!(
            "Docker could not pull the container image specified in your compose file.\n\
             Open {} and check the `image:` line.",
            compose_display
        );
        let steps = vec![
            format!(
                "A) Use a fully qualified image name in docker-compose.yml, e.g. \
                 docker.io/<user>/openclaw:<tag> or ghcr.io/<org>/openclaw:<tag>. \
                 File location: {}",
                compose_display
            ),
            "B) If the image is in a private registry, run `docker login <registry>` in a terminal, then click Start Gateway again.".to_string(),
            "C) For local development: build the image locally (`docker build -t openclaw:dev .`) and set the compose `image:` to `openclaw:dev`.".to_string(),
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

// ── Post-start verification ─────────────────────────────────────────

/// Returns `(is_running, diagnostics_text)`.
fn check_gateway_running(dir: &Path) -> (bool, String) {
    let output = Command::new("docker")
        .current_dir(dir)
        .args(["compose", "ps", "--format", "json"])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let stderr = String::from_utf8_lossy(&out.stderr);
            // Docker Compose v2 emits one JSON object per line.
            // A service is running if its State field contains "running".
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

// ── Tauri commands ──────────────────────────────────────────────────

#[tauri::command]
pub async fn start_gateway(app: AppHandle) -> Result<GatewayStartResult, String> {
    let dir = get_app_data_dir(&app)?;
    let compose_file = dir.join("docker-compose.yml");

    if !compose_file.exists() {
        return Ok(GatewayStartResult {
            gateway_active: false,
            user_friendly_title: "Not Configured".to_string(),
            user_friendly_message: "docker-compose.yml not found. Please complete the Configure step first.".to_string(),
            raw_diagnostics: String::new(),
            remediation_steps: vec!["Go back to Step 2 and click Save & Configure.".to_string()],
            compose_file_path: compose_file.display().to_string(),
        });
    }

    // 1) Run docker compose up -d
    let output = Command::new("docker")
        .current_dir(&dir)
        .args(["compose", "up", "-d"])
        .output()
        .map_err(|e| format!("Failed to execute docker: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined_raw = format!("{}\n{}", stdout, stderr);

    // 2) If exit code != 0 → immediate failure
    if !output.status.success() {
        let (title, message, steps) = build_remediation(&stderr, &compose_file);
        return Ok(GatewayStartResult {
            gateway_active: false,
            user_friendly_title: title,
            user_friendly_message: message,
            raw_diagnostics: sanitize_output(&combined_raw),
            remediation_steps: steps,
            compose_file_path: compose_file.display().to_string(),
        });
    }

    // 3) Exit code 0 → verify the container is actually running
    let (is_running, ps_diag) = check_gateway_running(&dir);

    if is_running {
        Ok(GatewayStartResult {
            gateway_active: true,
            user_friendly_title: "Gateway Running".to_string(),
            user_friendly_message: "OpenClaw Gateway is active.".to_string(),
            raw_diagnostics: sanitize_output(&combined_raw),
            remediation_steps: vec![],
            compose_file_path: compose_file.display().to_string(),
        })
    } else {
        // compose up exited 0 but container is not running (e.g. immediate crash)
        let full_diag = format!("{}\n--- post-start check ---\n{}", combined_raw, ps_diag);
        Ok(GatewayStartResult {
            gateway_active: false,
            user_friendly_title: "Gateway Failed to Stay Running".to_string(),
            user_friendly_message: "docker compose up succeeded but the gateway container is not running. It may have crashed on startup.".to_string(),
            raw_diagnostics: sanitize_output(&full_diag),
            remediation_steps: vec![
                "Run `docker compose logs gateway` in a terminal to see crash logs.".to_string(),
                format!("Check the compose file at {} for configuration errors.", compose_file.display()),
            ],
            compose_file_path: compose_file.display().to_string(),
        })
    }
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
pub async fn gateway_status(app: AppHandle) -> Result<String, String> {
    let dir = get_app_data_dir(&app)?;

    let output = Command::new("docker")
        .current_dir(&dir)
        .args(["compose", "ps", "--format", "json"])
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_string())
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

    // -- sanitize_output tests (existing) --

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

    // -- build_remediation tests (new) --

    #[test]
    fn test_build_remediation_pull_access_denied() {
        let stderr = r#"Error response from daemon: pull access denied for openclaw, repository does not exist or may require 'docker login'"#;
        let compose = PathBuf::from("C:\\Users\\test\\AppData\\Roaming\\ai.openclaw.secureinstaller\\docker-compose.yml");
        let (title, message, steps) = build_remediation(stderr, &compose);

        assert_eq!(title, "Image Pull Failed");
        assert!(message.contains("docker-compose.yml"));
        assert_eq!(steps.len(), 3);
        assert!(steps[0].contains("fully qualified image name"));
        assert!(steps[1].contains("docker login"));
        assert!(steps[2].contains("openclaw:dev"));
    }

    #[test]
    fn test_build_remediation_generic_error() {
        let stderr = "Error: some random docker error occurred";
        let compose = PathBuf::from("/tmp/docker-compose.yml");
        let (title, _message, steps) = build_remediation(stderr, &compose);

        assert_eq!(title, "Gateway Start Failed");
        assert!(steps.iter().any(|s| s.contains("Docker Desktop")));
    }

    #[test]
    fn test_is_pull_access_error_detects_patterns() {
        assert!(is_pull_access_error("pull access denied for foo"));
        assert!(is_pull_access_error("repository does not exist"));
        assert!(is_pull_access_error("may require 'docker login'"));
        assert!(is_pull_access_error("manifest unknown: manifest unknown"));
        assert!(!is_pull_access_error("port already in use"));
    }
}

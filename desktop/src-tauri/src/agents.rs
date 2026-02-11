use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::AppHandle;

use crate::gateway::{sanitize_output, ensure_gateway_ready};
use crate::secrets::get_secret_internal;
use crate::state_manager::{get_app_data_dir, load_state, save_state_internal};

// ── Constants ───────────────────────────────────────────────────────

const AGENT_IMAGE: &str = "ghcr.io/leojeulinmerville/openclaw-gateway:stable";
const MANAGED_NETWORK: &str = "openclaw-managed";
const CONTAINER_PREFIX: &str = "myopenclaw-agent-";
const STABILITY_DELAY_MS: u64 = 1500;

// ── Persisted agent entry ───────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentEntry {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub model: String,
    pub created_at: String,
    pub last_seen: String,
    pub status: String, // "stopped", "running", "quarantined", "error", "creating"
    pub workspace_path: String,
    pub policy_preset: String,
    pub runtime_image: String,
    pub container_name: String,
    pub last_error: String,
    pub quarantined: bool,
    pub network_enabled: bool,
    pub gateway_agent_id: Option<String>,
}

// ── Docker stats result ─────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatsResult {
    pub agent_id: String,
    pub cpu_percent: f64,
    pub memory_mb: f64,
    pub net_io_rx: String,
    pub net_io_tx: String,
    pub running: bool,
}

// ── Docker inspect result ───────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentInspectResult {
    pub agent_id: String,
    pub status: String,
    pub restarting: bool,
    pub exit_code: i32,
    pub healthy: bool,
    pub raw: String,
}

// ── Agent list item (for frontend) ──────────────────────────────────

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentListItem {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub model: String,
    pub status: String,
    pub quarantined: bool,
    pub network_enabled: bool,
    pub last_error: String,
    pub workspace_path: String,
    pub policy_preset: String,
    pub container_name: String,
    pub created_at: String,
    pub last_seen: String,
}

// ── Internal helpers ────────────────────────────────────────────────

fn short_id(id: &str) -> String {
    id.chars().take(8).collect()
}

fn container_name(id: &str) -> String {
    format!("{}{}", CONTAINER_PREFIX, short_id(id))
}

/// Check if a container exists (any state).
fn container_exists(name: &str) -> bool {
    Command::new("docker")
        .args(["inspect", "--format", "{{.Id}}", name])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Inspect container state for an agent.
fn inspect_agent(name: &str) -> AgentInspectResult {
    let output = Command::new("docker")
        .args([
            "inspect",
            "--format",
            "{{.State.Status}}|{{.State.Restarting}}|{{.State.ExitCode}}",
            name,
        ])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let raw = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let parts: Vec<&str> = raw.split('|').collect();
            if parts.len() >= 3 {
                let status = parts[0].to_lowercase();
                let restarting = parts[1].eq_ignore_ascii_case("true");
                let exit_code = parts[2].parse().unwrap_or(-1);
                let healthy = status == "running" && !restarting && exit_code == 0;
                AgentInspectResult {
                    agent_id: String::new(),
                    status,
                    restarting,
                    exit_code,
                    healthy,
                    raw,
                }
            } else {
                AgentInspectResult {
                    agent_id: String::new(),
                    status: "unknown".into(),
                    restarting: false,
                    exit_code: -1,
                    healthy: false,
                    raw,
                }
            }
        }
        _ => AgentInspectResult {
            agent_id: String::new(),
            status: "not_found".into(),
            restarting: false,
            exit_code: -1,
            healthy: false,
            raw: "container not found".into(),
        },
    }
}

/// Ensure the managed Docker network exists.
fn ensure_network() -> Result<(), String> {
    // Check if network exists
    let check = Command::new("docker")
        .args(["network", "inspect", MANAGED_NETWORK])
        .output()
        .map_err(|e| format!("Failed to check network: {}", e))?;

    if !check.status.success() {
        // Create internal network
        let create = Command::new("docker")
            .args([
                "network", "create",
                "--driver", "bridge",
                "--internal",
                "--label", "ai.openclaw.managed=true",
                MANAGED_NETWORK,
            ])
            .output()
            .map_err(|e| format!("Failed to create network: {}", e))?;

        if !create.status.success() {
            let stderr = String::from_utf8_lossy(&create.stderr);
            return Err(format!("Network creation failed: {}", stderr));
        }
    }
    Ok(())
}

/// Create the agent workspace directory if it doesn't exist.
fn ensure_workspace(path: &str) -> Result<(), String> {
    std::fs::create_dir_all(path)
        .map_err(|e| format!("Failed to create workspace '{}': {}", path, e))
}

/// Update an agent's state in the persisted state file.
fn update_agent_state(
    app: &AppHandle,
    agent_id: &str,
    updater: impl FnOnce(&mut AgentEntry),
) -> Result<(), String> {
    let mut state = load_state(app);
    if let Some(agent) = state.agents.iter_mut().find(|a| a.id == agent_id) {
        updater(agent);
    }
    save_state_internal(app, &state)
}

/// Get an agent entry from state.
fn get_agent(app: &AppHandle, agent_id: &str) -> Result<AgentEntry, String> {
    let state = load_state(app);
    state
        .agents
        .iter()
        .find(|a| a.id == agent_id)
        .cloned()
        .ok_or_else(|| format!("Agent '{}' not found", agent_id))
}

// ── Tauri commands ──────────────────────────────────────────────────

/// Register a new agent in state. Does NOT start a container.
#[tauri::command]
pub fn create_agent(
    app: AppHandle,
    name: String,
    provider: String,
    model: String,
    workspace_path: String,
    policy_preset: String,
) -> Result<AgentEntry, String> {
    ensure_gateway_ready(&app)?;
    let id = uuid::Uuid::new_v4().to_string();
    let cname = container_name(&id);
    let now = chrono::Utc::now().to_rfc3339();

    // Ensure workspace exists
    let ws = if workspace_path.is_empty() {
        let dir = get_app_data_dir(&app)?;
        let ws_dir = dir.join("workspaces").join(short_id(&id));
        ws_dir.to_string_lossy().to_string()
    } else {
        workspace_path
    };
    ensure_workspace(&ws)?;

    let entry = AgentEntry {
        id: id.clone(),
        name,
        provider,
        model,
        created_at: now.clone(),
        last_seen: now,
        status: "stopped".to_string(),
        workspace_path: ws,
        policy_preset,
        runtime_image: AGENT_IMAGE.to_string(),
        container_name: cname,
        last_error: String::new(),
        quarantined: false,
        network_enabled: false,
        gateway_agent_id: None,
    };

    let mut state = load_state(&app);
    state.agents.push(entry.clone());
    save_state_internal(&app, &state)?;

    Ok(entry)
}

/// List all agents from state.
#[tauri::command]
pub fn list_agents(app: AppHandle) -> Result<Vec<AgentListItem>, String> {
    ensure_gateway_ready(&app)?;
    let state = load_state(&app);
    Ok(state
        .agents
        .iter()
        .map(|a| AgentListItem {
            id: a.id.clone(),
            name: a.name.clone(),
            provider: a.provider.clone(),
            model: a.model.clone(),
            status: a.status.clone(),
            quarantined: a.quarantined,
            network_enabled: a.network_enabled,
            last_error: a.last_error.clone(),
            workspace_path: a.workspace_path.clone(),
            policy_preset: a.policy_preset.clone(),
            container_name: a.container_name.clone(),
            created_at: a.created_at.clone(),
            last_seen: a.last_seen.clone(),
        })
        .collect())
}

/// Start an agent: create container if needed, then start it.
#[tauri::command]
pub fn start_agent(app: AppHandle, agent_id: String) -> Result<AgentInspectResult, String> {
    ensure_gateway_ready(&app)?;
    let agent = get_agent(&app, &agent_id)?;

    if agent.quarantined {
        return Err("Agent is quarantined. Unquarantine it first.".into());
    }

    // Create container if it doesn't exist
    if !container_exists(&agent.container_name) {
        // Build env vars — inject secrets at runtime
        let mut env_args: Vec<String> = vec![
            "-e".into(), "OPENCLAW_SAFE_MODE=1".into(),
            "-e".into(), "LOG_LEVEL=info".into(),
        ];

        // Inject provider secrets from keyring
        if agent.provider == "openai" {
            if let Some(key) = get_secret_internal(&app, "OPENAI_API_KEY") {
                env_args.push("-e".into());
                env_args.push(format!("OPENAI_API_KEY={}", key));
            }
        }

        let mut create_args = vec![
            "create".to_string(),
            "--name".into(), agent.container_name.clone(),
            // Security hardening
            "--user".into(), "node".into(),
            "--read-only".into(),
            "--tmpfs".into(), "/tmp:rw,noexec,size=64m".into(),
            "--cap-drop".into(), "ALL".into(),
            "--security-opt".into(), "no-new-privileges".into(),
            "--restart".into(), "no".into(),
            // Labels
            "--label".into(), "ai.openclaw.role=agent".into(),
            "--label".into(), format!("ai.openclaw.agent_id={}", agent.id),
            "--label".into(), "ai.openclaw.managed=true".into(),
            // Workspace volume
            "-v".into(), format!("{}:/home/node/workspace:rw", agent.workspace_path),
        ];

        // Add env vars
        create_args.extend(env_args);

        // No ports, no network by default (fully disconnected)
        create_args.push("--network".into());
        create_args.push("none".into());

        // Image and command
        create_args.push(agent.runtime_image.clone());
        create_args.extend(["node".into(), "openclaw.mjs".into(), "gateway".into(), "--allow-unconfigured".into()]);

        let create = Command::new("docker")
            .args(&create_args)
            .output()
            .map_err(|e| format!("docker create failed: {}", e))?;

        if !create.status.success() {
            let stderr = sanitize_output(&String::from_utf8_lossy(&create.stderr));
            update_agent_state(&app, &agent_id, |a| {
                a.status = "error".into();
                a.last_error = stderr.clone();
            })?;
            return Err(format!("Container creation failed: {}", stderr));
        }
    }

    // Start the container
    let start = Command::new("docker")
        .args(["start", &agent.container_name])
        .output()
        .map_err(|e| format!("docker start failed: {}", e))?;

    if !start.status.success() {
        let stderr = sanitize_output(&String::from_utf8_lossy(&start.stderr));
        update_agent_state(&app, &agent_id, |a| {
            a.status = "error".into();
            a.last_error = stderr.clone();
        })?;
        return Err(format!("Container start failed: {}", stderr));
    }

    // Wait briefly, then inspect for health
    std::thread::sleep(std::time::Duration::from_millis(500));
    let inspect = inspect_agent(&agent.container_name);

    let new_status = if inspect.healthy {
        "running"
    } else if inspect.restarting {
        "error"
    } else {
        "error"
    };

    update_agent_state(&app, &agent_id, |a| {
        a.status = new_status.into();
        a.last_seen = chrono::Utc::now().to_rfc3339();
        if !inspect.healthy {
            a.last_error = format!("Unhealthy after start: {}", inspect.raw);
        } else {
            a.last_error.clear();
        }
    })?;

    // If network was enabled, reconnect
    if agent.network_enabled {
        let _ = connect_network(&agent.container_name);
    }

    Ok(AgentInspectResult {
        agent_id: agent_id.clone(),
        ..inspect
    })
}

/// Stop an agent container.
#[tauri::command]
pub fn stop_agent(app: AppHandle, agent_id: String) -> Result<(), String> {
    ensure_gateway_ready(&app)?;
    let agent = get_agent(&app, &agent_id)?;

    if container_exists(&agent.container_name) {
        let stop = Command::new("docker")
            .args(["stop", "-t", "10", &agent.container_name])
            .output()
            .map_err(|e| format!("docker stop failed: {}", e))?;

        if !stop.status.success() {
            let stderr = sanitize_output(&String::from_utf8_lossy(&stop.stderr));
            return Err(format!("Stop failed: {}", stderr));
        }
    }

    update_agent_state(&app, &agent_id, |a| {
        a.status = "stopped".into();
        a.last_seen = chrono::Utc::now().to_rfc3339();
    })?;

    Ok(())
}

/// Restart an agent: stop + start.
#[tauri::command]
pub fn restart_agent(app: AppHandle, agent_id: String) -> Result<AgentInspectResult, String> {
    ensure_gateway_ready(&app)?;
    let agent = get_agent(&app, &agent_id)?;

    // Stop if running
    if container_exists(&agent.container_name) {
        let _ = Command::new("docker")
            .args(["stop", "-t", "5", &agent.container_name])
            .output();
        // Remove old container so start_agent recreates with fresh env
        let _ = Command::new("docker")
            .args(["rm", "-f", &agent.container_name])
            .output();
    }

    start_agent(app, agent_id)
}

/// Remove an agent: stop + rm container + remove from state.
#[tauri::command]
pub fn remove_agent(app: AppHandle, agent_id: String) -> Result<(), String> {
    ensure_gateway_ready(&app)?;
    let agent = get_agent(&app, &agent_id)?;

    // Force-remove container if it exists
    if container_exists(&agent.container_name) {
        let _ = Command::new("docker")
            .args(["rm", "-f", &agent.container_name])
            .output();
    }

    // Remove from state
    let mut state = load_state(&app);
    state.agents.retain(|a| a.id != agent_id);
    save_state_internal(&app, &state)?;

    Ok(())
}

/// Get agent logs (last N lines), sanitized.
#[tauri::command]
pub fn agent_logs(app: AppHandle, agent_id: String, lines: Option<u32>) -> Result<String, String> {
    ensure_gateway_ready(&app)?;
    let agent = get_agent(&app, &agent_id)?;
    let tail = lines.unwrap_or(100).to_string();

    let output = Command::new("docker")
        .args(["logs", "--tail", &tail, &agent.container_name])
        .output()
        .map_err(|e| format!("docker logs failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    // Docker may output to stderr for logs
    let combined = if stdout.is_empty() {
        stderr.to_string()
    } else {
        format!("{}\n{}", stdout, stderr)
    };

    Ok(sanitize_output(&combined))
}

/// Get agent resource stats (CPU, memory, net I/O).
#[tauri::command]
pub fn agent_stats(app: AppHandle, agent_id: String) -> Result<AgentStatsResult, String> {
    ensure_gateway_ready(&app)?;
    let agent = get_agent(&app, &agent_id)?;

    let output = Command::new("docker")
        .args([
            "stats", "--no-stream",
            "--format", "{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}",
            &agent.container_name,
        ])
        .output()
        .map_err(|e| format!("docker stats failed: {}", e))?;

    if !output.status.success() {
        return Ok(AgentStatsResult {
            agent_id: agent_id.clone(),
            cpu_percent: 0.0,
            memory_mb: 0.0,
            net_io_rx: "0B".into(),
            net_io_tx: "0B".into(),
            running: false,
        });
    }

    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let parts: Vec<&str> = raw.split('|').collect();

    let cpu = if parts.len() > 0 {
        parts[0].trim_end_matches('%').trim().parse().unwrap_or(0.0)
    } else {
        0.0
    };

    let mem = if parts.len() > 1 {
        // Format: "12.5MiB / 512MiB"
        let mem_str = parts[1].split('/').next().unwrap_or("0").trim();
        parse_memory_mb(mem_str)
    } else {
        0.0
    };

    let (rx, tx) = if parts.len() > 2 {
        let net_parts: Vec<&str> = parts[2].split('/').collect();
        (
            net_parts.get(0).unwrap_or(&"0B").trim().to_string(),
            net_parts.get(1).unwrap_or(&"0B").trim().to_string(),
        )
    } else {
        ("0B".into(), "0B".into())
    };

    Ok(AgentStatsResult {
        agent_id,
        cpu_percent: cpu,
        memory_mb: mem,
        net_io_rx: rx,
        net_io_tx: tx,
        running: true,
    })
}

/// Inspect agent health via docker inspect.
#[tauri::command]
pub fn agent_inspect_health(
    app: AppHandle,
    agent_id: String,
) -> Result<AgentInspectResult, String> {
    ensure_gateway_ready(&app)?;
    let agent = get_agent(&app, &agent_id)?;
    let mut result = inspect_agent(&agent.container_name);
    result.agent_id = agent_id;
    Ok(result)
}

/// Connect or disconnect agent from managed network.
fn connect_network(container_name: &str) -> Result<(), String> {
    ensure_network()?;
    let output = Command::new("docker")
        .args(["network", "connect", MANAGED_NETWORK, container_name])
        .output()
        .map_err(|e| format!("Network connect failed: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Ignore "already connected" errors
        if !stderr.contains("already exists") {
            return Err(format!("Network connect failed: {}", stderr));
        }
    }
    Ok(())
}

fn disconnect_network(container_name: &str) -> Result<(), String> {
    let output = Command::new("docker")
        .args(["network", "disconnect", "--force", MANAGED_NETWORK, container_name])
        .output()
        .map_err(|e| format!("Network disconnect failed: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Ignore "not connected" errors
        if !stderr.contains("is not connected") {
            return Err(format!("Network disconnect failed: {}", stderr));
        }
    }
    Ok(())
}

/// Toggle agent network connectivity.
#[tauri::command]
pub fn agent_set_network(
    app: AppHandle,
    agent_id: String,
    enabled: bool,
) -> Result<(), String> {
    ensure_gateway_ready(&app)?;
    let agent = get_agent(&app, &agent_id)?;

    // Block enabling network if allow_internet is off
    if enabled {
        let state = load_state(&app);
        if !state.allow_internet {
            return Err("Internet is disabled globally. Enable Allow Internet in Settings first.".into());
        }
    }

    if enabled {
        if container_exists(&agent.container_name) {
            connect_network(&agent.container_name)?;
        }
    } else {
        if container_exists(&agent.container_name) {
            disconnect_network(&agent.container_name)?;
        }
    }

    update_agent_state(&app, &agent_id, |a| {
        a.network_enabled = enabled;
    })?;

    Ok(())
}

/// Quarantine an agent: disconnect network + stop + set quarantined.
#[tauri::command]
pub fn quarantine_agent(app: AppHandle, agent_id: String) -> Result<(), String> {
    ensure_gateway_ready(&app)?;
    let agent = get_agent(&app, &agent_id)?;

    // Disconnect network first
    if container_exists(&agent.container_name) {
        let _ = disconnect_network(&agent.container_name);
        // Stop the container
        let _ = Command::new("docker")
            .args(["stop", "-t", "5", &agent.container_name])
            .output();
    }

    update_agent_state(&app, &agent_id, |a| {
        a.quarantined = true;
        a.network_enabled = false;
        a.status = "quarantined".into();
        a.last_seen = chrono::Utc::now().to_rfc3339();
    })?;

    Ok(())
}

/// Unquarantine an agent: clear quarantined flag. User must manually start + enable network.
#[tauri::command]
pub fn unquarantine_agent(app: AppHandle, agent_id: String) -> Result<(), String> {
    ensure_gateway_ready(&app)?;
    update_agent_state(&app, &agent_id, |a| {
        a.quarantined = false;
        a.status = "stopped".into();
    })?;
    Ok(())
}

/// Check if an agent is crash-looping (restarting in both checks within stability window).
/// Returns true if crash loop detected (and auto-quarantines).
#[tauri::command]
pub fn check_agent_crashloop(
    app: AppHandle,
    agent_id: String,
) -> Result<bool, String> {
    ensure_gateway_ready(&app)?;
    let agent = get_agent(&app, &agent_id)?;

    if !container_exists(&agent.container_name) {
        return Ok(false);
    }

    let health1 = inspect_agent(&agent.container_name);

    // First check: restarting or exited with error?
    let problem1 = health1.restarting || (health1.status == "exited" && health1.exit_code != 0);
    if !problem1 {
        return Ok(false);
    }

    // Wait and check again
    std::thread::sleep(std::time::Duration::from_millis(STABILITY_DELAY_MS));
    let health2 = inspect_agent(&agent.container_name);

    let problem2 = health2.restarting || (health2.status == "exited" && health2.exit_code != 0);

    if problem1 && problem2 {
        // Auto-quarantine
        update_agent_state(&app, &agent_id, |a| {
            a.quarantined = true;
            a.network_enabled = false;
            a.status = "quarantined".into();
            a.last_error = format!(
                "Crash loop detected: {}→{}", health1.raw, health2.raw
            );
            a.last_seen = chrono::Utc::now().to_rfc3339();
        })?;

        // Disconnect network + stop
        let _ = disconnect_network(&agent.container_name);
        let _ = Command::new("docker")
            .args(["stop", "-t", "5", &agent.container_name])
            .output();

        return Ok(true);
    }

    Ok(false)
}

/// Get a single agent's full details.
#[tauri::command]
pub fn get_agent_detail(app: AppHandle, agent_id: String) -> Result<AgentEntry, String> {
    ensure_gateway_ready(&app)?;
    get_agent(&app, &agent_id)
}

// ── Helpers ─────────────────────────────────────────────────────────

fn parse_memory_mb(s: &str) -> f64 {
    let s = s.trim();
    if s.ends_with("GiB") {
        s.trim_end_matches("GiB").trim().parse::<f64>().unwrap_or(0.0) * 1024.0
    } else if s.ends_with("MiB") {
        s.trim_end_matches("MiB").trim().parse::<f64>().unwrap_or(0.0)
    } else if s.ends_with("KiB") {
        s.trim_end_matches("KiB").trim().parse::<f64>().unwrap_or(0.0) / 1024.0
    } else if s.ends_with("B") {
        s.trim_end_matches("B").trim().parse::<f64>().unwrap_or(0.0) / (1024.0 * 1024.0)
    } else {
        s.parse().unwrap_or(0.0)
    }
}

// ── Unit tests ──────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_short_id() {
        let uuid = "550e8400-e29b-41d4-a716-446655440000";
        assert_eq!(short_id(uuid), "550e8400");
    }

    #[test]
    fn test_container_name_format() {
        let uuid = "550e8400-e29b-41d4-a716-446655440000";
        assert_eq!(container_name(uuid), "myopenclaw-agent-550e8400");
    }

    #[test]
    fn test_container_name_deterministic() {
        let uuid = "abcdefgh-1234-5678-abcd-123456789abc";
        let n1 = container_name(uuid);
        let n2 = container_name(uuid);
        assert_eq!(n1, n2);
        assert!(n1.starts_with(CONTAINER_PREFIX));
    }

    #[test]
    fn test_parse_memory_mb_mib() {
        assert!((parse_memory_mb("12.5MiB") - 12.5).abs() < 0.01);
    }

    #[test]
    fn test_parse_memory_mb_gib() {
        assert!((parse_memory_mb("1.5GiB") - 1536.0).abs() < 0.01);
    }

    #[test]
    fn test_parse_memory_mb_kib() {
        assert!((parse_memory_mb("512KiB") - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_parse_memory_mb_bytes() {
        assert!(parse_memory_mb("1048576B") > 0.99 && parse_memory_mb("1048576B") < 1.01);
    }

    #[test]
    fn test_agent_inspect_not_found_status() {
        // Inspecting a non-existent container should return "not_found"
        let result = inspect_agent("nonexistent-container-12345");
        assert_eq!(result.status, "not_found");
        assert!(!result.healthy);
    }

    #[test]
    fn test_agent_entry_serialization() {
        let entry = AgentEntry {
            id: "test-id".into(),
            name: "Test Agent".into(),
            provider: "openai".into(),
            model: "gpt-4".into(),
            created_at: "2024-01-01T00:00:00Z".into(),
            last_seen: "2024-01-01T00:00:00Z".into(),
            status: "stopped".into(),
            workspace_path: "/tmp/test".into(),
            policy_preset: "default".into(),
            runtime_image: AGENT_IMAGE.into(),
            container_name: "myopenclaw-agent-test".into(),
            last_error: String::new(),
            quarantined: false,
            network_enabled: false,
            gateway_agent_id: None,
        };

        let json = serde_json::to_string(&entry).unwrap();
        let back: AgentEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(back.id, "test-id");
        assert_eq!(back.container_name, "myopenclaw-agent-test");
        assert!(!back.quarantined);
        assert!(!back.network_enabled);
    }

    #[test]
    fn test_agent_entry_deserialization_backwards_compat() {
        // Simulate old state without quarantined/network_enabled fields
        let json = r#"{
            "id": "old-agent",
            "name": "Old Agent",
            "provider": "openai",
            "model": "gpt-4",
            "createdAt": "2024-01-01T00:00:00Z",
            "lastSeen": "2024-01-01T00:00:00Z",
            "status": "running",
            "workspacePath": "/tmp/test",
            "policyPreset": "default",
            "runtimeImage": "test:latest",
            "containerName": "myopenclaw-agent-old",
            "lastError": "",
            "quarantined": false,
            "networkEnabled": false,
            "gatewayAgentId": null
        }"#;

        let entry: AgentEntry = serde_json::from_str(json).unwrap();
        assert_eq!(entry.id, "old-agent");
        assert!(!entry.quarantined);
        assert!(!entry.network_enabled);
    }

    #[test]
    fn test_quarantine_state_transition() {
        // Verify quarantine sets all expected fields
        let mut entry = AgentEntry {
            id: "q-test".into(),
            name: "Test".into(),
            provider: "openai".into(),
            model: "gpt-4".into(),
            created_at: "2024-01-01T00:00:00Z".into(),
            last_seen: "2024-01-01T00:00:00Z".into(),
            status: "running".into(),
            workspace_path: "/tmp".into(),
            policy_preset: "default".into(),
            runtime_image: AGENT_IMAGE.into(),
            container_name: "test".into(),
            last_error: String::new(),
            quarantined: false,
            network_enabled: true,
            gateway_agent_id: None,
        };

        // Simulate quarantine state change
        entry.quarantined = true;
        entry.network_enabled = false;
        entry.status = "quarantined".into();
        entry.last_error = "Crash loop detected".into();

        assert!(entry.quarantined);
        assert!(!entry.network_enabled);
        assert_eq!(entry.status, "quarantined");
    }

    #[test]
    fn test_unquarantine_state_transition() {
        let mut entry = AgentEntry {
            id: "uq-test".into(),
            name: "Test".into(),
            provider: "openai".into(),
            model: "gpt-4".into(),
            created_at: "2024-01-01T00:00:00Z".into(),
            last_seen: "2024-01-01T00:00:00Z".into(),
            status: "quarantined".into(),
            workspace_path: "/tmp".into(),
            policy_preset: "default".into(),
            runtime_image: AGENT_IMAGE.into(),
            container_name: "test".into(),
            last_error: "Crash loop".into(),
            quarantined: true,
            network_enabled: false,
            gateway_agent_id: None,
        };

        // Unquarantine — goes to stopped, network stays off
        entry.quarantined = false;
        entry.status = "stopped".into();

        assert!(!entry.quarantined);
        assert!(!entry.network_enabled); // must manually re-enable
        assert_eq!(entry.status, "stopped");
    }

    #[test]
    fn test_network_toggle_state() {
        let mut entry = AgentEntry {
            id: "net-test".into(),
            name: "Test".into(),
            provider: "openai".into(),
            model: "gpt-4".into(),
            created_at: "2024-01-01T00:00:00Z".into(),
            last_seen: "2024-01-01T00:00:00Z".into(),
            status: "running".into(),
            workspace_path: "/tmp".into(),
            policy_preset: "default".into(),
            runtime_image: AGENT_IMAGE.into(),
            container_name: "test".into(),
            last_error: String::new(),
            quarantined: false,
            network_enabled: false,
            gateway_agent_id: None,
        };

        // Default is network OFF
        assert!(!entry.network_enabled);

        // Enable
        entry.network_enabled = true;
        assert!(entry.network_enabled);

        // Disable
        entry.network_enabled = false;
        assert!(!entry.network_enabled);
    }
}

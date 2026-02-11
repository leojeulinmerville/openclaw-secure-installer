use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::agents::AgentEntry;
use crate::gateway::generate_compose_content;

pub const DEFAULT_GATEWAY_IMAGE: &str = "ghcr.io/leojeulinmerville/openclaw-gateway:stable";

/// Default unprivileged ports – never expose 80/443 unless the user
/// explicitly opts in via the "Advanced" toggle.
const DEFAULT_HTTP_PORT: u16 = 8080;
const DEFAULT_HTTPS_PORT: u16 = 8443;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstallerState {
  pub install_id: String,
  pub created_at: String,
  pub status: String, // "new", "configured", "installing", "running"
  pub compose_project_name: String,
  pub http_port: u16,
  pub https_port: u16,
  pub app_data_dir: String,
  #[serde(default = "default_gateway_image")]
  pub gateway_image: String,
  /// When true the user explicitly chose 80/443 in the Advanced panel.
  #[serde(default)]
  pub advanced_ports: bool,
  /// Managed agents (backwards-compatible: defaults to empty vec).
  #[serde(default)]
  pub agents: Vec<AgentEntry>,
  /// Global internet toggle — default OFF. Controls provider availability
  /// and agent egress networking.
  #[serde(default)]
  pub allow_internet: bool,
  #[serde(default)]
  pub stop_agents_on_gateway_stop: bool,
}

fn default_gateway_image() -> String {
  DEFAULT_GATEWAY_IMAGE.to_string()
}

impl Default for InstallerState {
  fn default() -> Self {
    Self {
      install_id: uuid::Uuid::new_v4().to_string(),
      created_at: chrono::Utc::now().to_rfc3339(),
      status: "new".to_string(),
      compose_project_name: "openclaw-mvp".to_string(),
      http_port: DEFAULT_HTTP_PORT,
      https_port: DEFAULT_HTTPS_PORT,
      app_data_dir: String::new(),
      gateway_image: DEFAULT_GATEWAY_IMAGE.to_string(),
      advanced_ports: false,
      agents: Vec::new(),
      allow_internet: false,
      stop_agents_on_gateway_stop: false,
    }
  }
}

/// Migrate legacy state: if the user never explicitly chose 80/443
/// (i.e. `advanced_ports` is false), update them to the safe defaults.
fn migrate_state(state: &mut InstallerState) {
  if !state.advanced_ports {
    if state.http_port == 80 {
      state.http_port = DEFAULT_HTTP_PORT;
    }
    if state.https_port == 443 {
      state.https_port = DEFAULT_HTTPS_PORT;
    }
  }
}

pub fn get_app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
  app
    .path()
    .app_data_dir()
    .map_err(|e| format!("Failed to resolve app data dir: {}", e))
}

/// Load state from disk. Returns default state if file missing.
pub fn load_state(app: &AppHandle) -> InstallerState {
  let dir = match get_app_data_dir(app) {
    Ok(d) => d,
    Err(_) => return InstallerState::default(),
  };
  let state_path = dir.join("state.json");
  if state_path.exists() {
    let content = fs::read_to_string(&state_path).unwrap_or_default();
    let mut state: InstallerState =
      serde_json::from_str(&content).unwrap_or_default();
    state.app_data_dir = dir.to_string_lossy().to_string();
    migrate_state(&mut state);
    state
  } else {
    let mut state = InstallerState::default();
    state.app_data_dir = dir.to_string_lossy().to_string();
    state
  }
}

/// Save state to disk (non-Tauri-command helper for agents.rs).
pub fn save_state_internal(app: &AppHandle, state: &InstallerState) -> Result<(), String> {
  let dir = get_app_data_dir(app)?;
  if !dir.exists() {
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  }
  let state_path = dir.join("state.json");
  let json = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
  fs::write(state_path, json).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
pub async fn get_state(app: AppHandle) -> Result<InstallerState, String> {
  let dir = get_app_data_dir(&app)?;
  if !dir.exists() {
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  }
  let state_path = dir.join("state.json");

  if state_path.exists() {
    let content = fs::read_to_string(&state_path).map_err(|e| e.to_string())?;
    let mut state: InstallerState = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    state.app_data_dir = dir.to_string_lossy().to_string();
    migrate_state(&mut state);
    Ok(state)
  } else {
    let mut state = InstallerState::default();
    state.app_data_dir = dir.to_string_lossy().to_string();
    let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    fs::write(&state_path, json).map_err(|e| e.to_string())?;
    Ok(state)
  }
}

#[tauri::command]
pub async fn save_state(app: AppHandle, state: InstallerState) -> Result<(), String> {
  let dir = get_app_data_dir(&app)?;
  let state_path = dir.join("state.json");
  let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
  fs::write(state_path, json).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
pub async fn configure_installation(
  app: AppHandle,
  http_port: u16,
  https_port: u16,
  gateway_image: Option<String>,
) -> Result<(), String> {
  let dir = get_app_data_dir(&app)?;

  let image = gateway_image.unwrap_or_else(|| DEFAULT_GATEWAY_IMAGE.to_string());

  // Track whether user chose privileged ports explicitly.
  let advanced = http_port == 80 || http_port == 443 || https_port == 80 || https_port == 443;

  // Write .env
  let env_content = format!(
    "OPENCLAW_HTTP_PORT={}\nOPENCLAW_HTTPS_PORT={}\nOPENCLAW_SAFE_MODE=1\nLOG_LEVEL=info\n",
    http_port, https_port
  );
  fs::write(dir.join(".env"), env_content).map_err(|e| e.to_string())?;

  // Write docker-compose.yml with chosen image
  let compose_content = generate_compose_content(&image);
  fs::write(dir.join("docker-compose.yml"), compose_content).map_err(|e| e.to_string())?;

  // Update state
  let state_path = dir.join("state.json");
  if state_path.exists() {
    let content = fs::read_to_string(&state_path).map_err(|e| e.to_string())?;
    if let Ok(mut state) = serde_json::from_str::<InstallerState>(&content) {
      state.status = "configured".to_string();
      state.http_port = http_port;
      state.https_port = https_port;
      state.gateway_image = image;
      state.advanced_ports = advanced;
      let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
      fs::write(&state_path, json).map_err(|e| e.to_string())?;
    }
  }

  Ok(())
}

#[tauri::command]
pub async fn save_gateway_image(app: AppHandle, image: String) -> Result<(), String> {
  let dir = get_app_data_dir(&app)?;
  let state_path = dir.join("state.json");
  if state_path.exists() {
    let content = fs::read_to_string(&state_path).map_err(|e| e.to_string())?;
    if let Ok(mut state) = serde_json::from_str::<InstallerState>(&content) {
      state.gateway_image = image;
      let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
      fs::write(&state_path, json).map_err(|e| e.to_string())?;
    }
  }
  Ok(())
}

#[tauri::command]
pub async fn get_allow_internet(app: AppHandle) -> Result<bool, String> {
    let state = load_state(&app);
    Ok(state.allow_internet)
}

#[tauri::command]
pub async fn set_allow_internet(app: AppHandle, enabled: bool) -> Result<(), String> {
    let mut state = load_state(&app);
    state.allow_internet = enabled;

    // When disabling: disconnect all agents from egress network
    if !enabled {
        for agent in &mut state.agents {
            if agent.network_enabled {
                // Try to disconnect from egress network
                let _ = crate::process::run_docker(
                    &["network", "disconnect", "--force", "openclaw-egress", &agent.container_name],
                    None,
                );
                agent.network_enabled = false;
            }
        }
    } else {
        // When enabling: ensure network exists
        crate::gateway::ensure_egress_network_exists()?;
    }

    save_state_internal(&app, &state)?;
    Ok(())
}

#[tauri::command]
pub async fn set_stop_agents_on_gateway_stop(app: AppHandle, enabled: bool) -> Result<(), String> {
    let mut state = load_state(&app);
    state.stop_agents_on_gateway_stop = enabled;
    save_state_internal(&app, &state)?;
    Ok(())
}

// ── Tests ───────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_state_values() {
        let state = InstallerState::default();
        assert_eq!(state.status, "new");
        assert_eq!(state.http_port, 8080);
        assert_eq!(state.https_port, 8443);
        assert!(!state.install_id.is_empty());
        assert_eq!(state.gateway_image, DEFAULT_GATEWAY_IMAGE);
        assert!(!state.advanced_ports);
    }

    #[test]
    fn test_state_serialization() {
        let state = InstallerState::default();
        let json = serde_json::to_string(&state).expect("Failed to serialize");
        let deserialized: InstallerState = serde_json::from_str(&json).expect("Failed to deserialize");
        assert_eq!(state.install_id, deserialized.install_id);
        assert_eq!(state.created_at, deserialized.created_at);
        assert_eq!(state.status, deserialized.status);
        assert_eq!(state.gateway_image, deserialized.gateway_image);
    }

    #[test]
    fn test_state_backwards_compat_missing_image() {
        // Old state.json without gateway_image field should deserialize with default
        let json = r#"{"install_id":"abc","created_at":"2025-01-01","status":"configured","compose_project_name":"p","http_port":80,"https_port":443,"app_data_dir":"."}"#;
        let state: InstallerState = serde_json::from_str(json).expect("Should deserialize");
        assert_eq!(state.gateway_image, DEFAULT_GATEWAY_IMAGE);
    }

    #[test]
    fn test_port_migration_legacy_defaults() {
        // Old state with port 80/443 and no advanced_ports flag should migrate
        let json = r#"{"install_id":"abc","created_at":"2025-01-01","status":"configured","compose_project_name":"p","http_port":80,"https_port":443,"app_data_dir":"."}"#;
        let mut state: InstallerState = serde_json::from_str(json).expect("Should deserialize");
        migrate_state(&mut state);
        assert_eq!(state.http_port, 8080);
        assert_eq!(state.https_port, 8443);
    }

    #[test]
    fn test_port_migration_advanced_keeps_privileged() {
        // User explicitly set privileged ports — don't migrate
        let json = r#"{"install_id":"abc","created_at":"2025-01-01","status":"configured","compose_project_name":"p","http_port":80,"https_port":443,"app_data_dir":".","advanced_ports":true}"#;
        let mut state: InstallerState = serde_json::from_str(json).expect("Should deserialize");
        migrate_state(&mut state);
        assert_eq!(state.http_port, 80);
        assert_eq!(state.https_port, 443);
    }

    #[test]
    fn test_allow_internet_defaults_false() {
        let state = InstallerState::default();
        assert!(!state.allow_internet);
    }

    #[test]
    fn test_allow_internet_backwards_compat() {
        let json = r#"{"install_id":"abc","created_at":"2025-01-01","status":"configured","compose_project_name":"p","http_port":8080,"https_port":8443,"app_data_dir":"."}
"#;
        let state: InstallerState = serde_json::from_str(json).expect("Should deserialize");
        assert!(!state.allow_internet);
    }
}

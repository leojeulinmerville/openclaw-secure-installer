use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::gateway::generate_compose_content;

pub const DEFAULT_GATEWAY_IMAGE: &str = "ghcr.io/openclaw-ai/openclaw-gateway:stable";

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
      http_port: 80,
      https_port: 443,
      app_data_dir: String::new(),
      gateway_image: DEFAULT_GATEWAY_IMAGE.to_string(),
    }
  }
}

pub fn get_app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
  app
    .path()
    .app_data_dir()
    .map_err(|e| format!("Failed to resolve app data dir: {}", e))
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
      let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
      fs::write(&state_path, json).map_err(|e| e.to_string())?;
    }
  }

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
        assert_eq!(state.http_port, 80);
        assert!(!state.install_id.is_empty());
        assert_eq!(state.gateway_image, DEFAULT_GATEWAY_IMAGE);
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
}

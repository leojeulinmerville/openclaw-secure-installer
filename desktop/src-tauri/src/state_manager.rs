use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstallerState {
  pub install_id: String,
  pub created_at: String,
  pub status: String, // "new", "configured", "installing", "running"
  pub compose_project_name: String,
  pub http_port: u16,
  pub https_port: u16,
  pub app_data_dir: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_state_values() {
        let state = InstallerState::default();
        assert_eq!(state.status, "new");
        assert_eq!(state.http_port, 80);
        assert!(!state.install_id.is_empty());
    }

    #[test]
    fn test_state_serialization() {
        let state = InstallerState::default();
        let json = serde_json::to_string(&state).expect("Failed to serialize");
        let deserialized: InstallerState = serde_json::from_str(&json).expect("Failed to deserialize");
        
        assert_eq!(state.install_id, deserialized.install_id);
        assert_eq!(state.created_at, deserialized.created_at);
        assert_eq!(state.status, deserialized.status);
    }
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
      app_data_dir: "".to_string(), // Filled at runtime
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
pub async fn configure_installation(app: AppHandle, http_port: u16, https_port: u16) -> Result<(), String> {
  let dir = get_app_data_dir(&app)?;
  // Write basic .env
  let env_content = format!(
    "OPENCLAW_HTTP_PORT={}\nOPENCLAW_HTTPS_PORT={}\nOPENCLAW_SAFE_MODE=1\nLOG_LEVEL=info\n",
    http_port, https_port
  );
  fs::write(dir.join(".env"), env_content).map_err(|e| e.to_string())?;

  // Write docker-compose.yml (embedded MVP version)
  // In a real app, we might bundle this file. Here we hardcode a minimal version for the wizard.
  // Note: We use the 'openclaw-cli' and 'openclaw-gateway' images.
  // Assuming 'openclaw:latest' locally available or pulled.
  let compose_content = r#"
services:
  gateway:
    image: openclaw:latest
    command: ["node", "openclaw.mjs", "gateway"]
    ports:
      - "${OPENCLAW_HTTP_PORT:-80}:80"
      - "${OPENCLAW_HTTPS_PORT:-443}:443"
    volumes:
      - openclaw_home:/home/node
    environment:
      - OPENCLAW_SAFE_MODE=1
      - LOG_LEVEL=info
    restart: unless-stopped

volumes:
  openclaw_home:
"#;
  fs::write(dir.join("docker-compose.yml"), compose_content).map_err(|e| e.to_string())?;
  
  Ok(())
}

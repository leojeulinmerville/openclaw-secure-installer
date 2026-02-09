use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use tauri::{AppHandle, Manager};

// In a real app, use tauri-plugin-keyring. For MVP, we use a restricted JSON file.
// We strictly avoid logging values.

#[derive(Debug, Serialize, Deserialize, Default)]
struct SecretsStore {
  secrets: HashMap<String, String>,
}

fn get_secrets_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
  // Use a dotfile to potentially hide it from casual listing
  Ok(dir.join(".secrets.json"))
}

#[tauri::command]
pub async fn set_secret(app: AppHandle, key: String, value: String) -> Result<(), String> {
  let path = get_secrets_path(&app)?;
  let mut store = if path.exists() {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).unwrap_or_default()
  } else {
    SecretsStore::default()
  };

  store.secrets.insert(key, value);
  
  // Save
  let json = serde_json::to_string(&store).map_err(|e| e.to_string())?;
  fs::write(path, json).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
pub async fn has_secret(app: AppHandle, key: String) -> Result<bool, String> {
  let path = get_secrets_path(&app)?;
  if !path.exists() {
    return Ok(false);
  }
  let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
  let store: SecretsStore = serde_json::from_str(&content).unwrap_or_default();
  Ok(store.secrets.contains_key(&key))
}

// Internal helper, not exposed to frontend to prevent accidental logging
pub fn get_secret_internal(app: &AppHandle, key: &str) -> Option<String> {
  let path = get_secrets_path(app).ok()?;
  if !path.exists() {
    return None;
  }
  let content = fs::read_to_string(&path).ok()?;
  let store: SecretsStore = serde_json::from_str(&content).ok()?;
  store.secrets.get(key).cloned()
}

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use tauri::{AppHandle, Manager};

// ── OS Keychain-backed secret store ─────────────────────────────────
//
// Uses the `keyring` crate which maps to:
//   • Windows → Credential Manager
//   • macOS   → Keychain
//   • Linux   → Secret Service (libsecret)
//
// Service name is used as the namespace inside the credential store.
const KEYRING_SERVICE: &str = "my-openclaw";

/// Legacy plaintext store – only used for one-time migration.
#[derive(Debug, Serialize, Deserialize, Default)]
struct LegacySecretsStore {
  secrets: HashMap<String, String>,
}

fn legacy_secrets_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
  Ok(dir.join(".secrets.json"))
}

/// Migrate plaintext .secrets.json → OS keychain, then delete the file.
/// Runs once; if the file does not exist this is a no-op.
fn migrate_legacy_secrets(app: &AppHandle) {
  let path = match legacy_secrets_path(app) {
    Ok(p) => p,
    Err(_) => return,
  };
  if !path.exists() {
    return;
  }

  let content = match fs::read_to_string(&path) {
    Ok(c) => c,
    Err(_) => return,
  };
  let store: LegacySecretsStore = match serde_json::from_str(&content) {
    Ok(s) => s,
    Err(_) => return,
  };

  for (key, value) in &store.secrets {
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, key) {
      let _ = entry.set_password(value);
    }
  }

  // Securely delete: overwrite with zeros then remove.
  let zeros = vec![0u8; content.len().max(64)];
  let _ = fs::write(&path, &zeros);
  let _ = fs::remove_file(&path);
}

#[tauri::command]
pub async fn set_secret(app: AppHandle, key: String, value: String) -> Result<(), String> {
  // Ensure legacy migration has happened.
  migrate_legacy_secrets(&app);

  let entry = keyring::Entry::new(KEYRING_SERVICE, &key)
    .map_err(|e| format!("Keyring error: {}", e))?;
  entry
    .set_password(&value)
    .map_err(|e| format!("Failed to store secret: {}", e))?;
  Ok(())
}

#[tauri::command]
pub async fn has_secret(app: AppHandle, key: String) -> Result<bool, String> {
  migrate_legacy_secrets(&app);

  let entry = keyring::Entry::new(KEYRING_SERVICE, &key)
    .map_err(|e| format!("Keyring error: {}", e))?;
  match entry.get_password() {
    Ok(_) => Ok(true),
    Err(keyring::Error::NoEntry) => Ok(false),
    Err(e) => Err(format!("Keyring read error: {}", e)),
  }
}

#[tauri::command]
pub async fn delete_secret(app: AppHandle, key: String) -> Result<(), String> {
  migrate_legacy_secrets(&app);

  let entry = keyring::Entry::new(KEYRING_SERVICE, &key)
    .map_err(|e| format!("Keyring error: {}", e))?;
  match entry.delete_credential() {
    Ok(()) => Ok(()),
    Err(keyring::Error::NoEntry) => Ok(()), // already gone
    Err(e) => Err(format!("Failed to delete secret: {}", e)),
  }
}

/// Internal helper — never exposed to the frontend to prevent
/// accidental logging of secret values.
pub fn get_secret_internal(app: &AppHandle, key: &str) -> Option<String> {
  migrate_legacy_secrets(app);

  let entry = keyring::Entry::new(KEYRING_SERVICE, key).ok()?;
  entry.get_password().ok()
}

use tauri::AppHandle;
use std::process::Command;
use crate::state_manager::get_app_data_dir;
// use crate::secrets::get_secret_internal; // Unused for now in this iteration

fn sanitize_output(text: &str) -> String {
  let mut lines = Vec::new();
  let sensitive_keys = ["OPENAI_API_KEY", "POSTGRES_PASSWORD", "JWT_SECRET", "SLACK_BOT_TOKEN", "STRIPE_SECRET_KEY"];
  
  for line in text.lines() {
      let mut redacted_line = line.to_string();
      
      // Key=Value redaction
      for key in sensitive_keys {
          if line.contains(key) {
               if let Some(idx) = line.find(key) {
                   redacted_line = format!("{}= [REDACTED]", key);
               }
          }
      }

      // Bearer token redaction
      if redacted_line.contains("Bearer ") {
          if let Some(idx) = redacted_line.find("Bearer ") {
              // Keep everything before "Bearer ", append "Bearer [REDACTED]"
              let valid_part = &redacted_line[..idx];
              redacted_line = format!("{}Bearer [REDACTED]", valid_part);
          }
      }

      lines.push(redacted_line);
  }
  lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

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
}


#[tauri::command]
pub async fn start_gateway(app: AppHandle) -> Result<String, String> {
  let dir = get_app_data_dir(&app)?;
  let compose_file = dir.join("docker-compose.yml");
  
  if !compose_file.exists() {
      return Err("docker-compose.yml not found in app data. Please configure first.".to_string());
  }

  // Ensure .env exists
  // Run docker compose up -d
  let output = Command::new("docker")
      .current_dir(&dir)
      .args(&["compose", "up", "-d"])
      .output()
      .map_err(|e| e.to_string())?;

  let stdout = String::from_utf8_lossy(&output.stdout);
  let stderr = String::from_utf8_lossy(&output.stderr);
  
  let combined = format!("STDOUT:\n{}\nSTDERR:\n{}", stdout, stderr);
  
  if !output.status.success() {
      return Err(format!("Docker start failed: {}", sanitize_output(&combined)));
  }

  Ok("Gateway started successfully".to_string())
}

#[tauri::command]
pub async fn stop_gateway(app: AppHandle) -> Result<String, String> {
  let dir = get_app_data_dir(&app)?;
  
  let output = Command::new("docker")
      .current_dir(&dir)
      .args(&["compose", "down"])
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
      .args(&["compose", "ps", "--format", "json"])
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
        .args(&["compose", "logs", "--tail", "100"])
        .output()
        .map_err(|e| e.to_string())?;
  
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}\n{}", stdout, stderr);
    
    Ok(sanitize_output(&combined))
}

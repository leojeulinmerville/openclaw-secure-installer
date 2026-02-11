use serde::Serialize;
use std::io::ErrorKind;
use std::path::Path;
use std::process::Command;

const MAX_OUTPUT_CHARS: usize = 8 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckDockerResult {
  pub docker_cli_found: bool,
  pub docker_cli_version: Option<String>,
  pub docker_daemon_reachable: bool,
  pub docker_server_version: Option<String>,
  pub compose_v2_available: bool,
  pub compose_version: Option<String>,
  pub diagnostics: Vec<String>,
  pub remediation: Option<String>,
}

#[derive(Debug)]
struct CmdOutput {
  status: Option<i32>,
  stdout: String,
  stderr: String,
  error: Option<String>,
  not_found: bool,
}

impl CheckDockerResult {
  fn new() -> Self {
    Self {
      docker_cli_found: false,
      docker_cli_version: None,
      docker_daemon_reachable: false,
      docker_server_version: None,
      compose_v2_available: false,
      compose_version: None,
      diagnostics: Vec::new(),
      remediation: None,
    }
  }
}

fn run_cmd(exe: &str, args: &[&str]) -> CmdOutput {
  let result = crate::process::run_command_capture(exe, args, None);
  match result {
    Ok(output) => CmdOutput {
      status: Some(output.exit_code),
      stdout: truncate_output(&output.stdout),
      stderr: truncate_output(&output.stderr),
      error: None,
      not_found: false,
    },
    Err(err_msg) => CmdOutput {
      status: None,
      stdout: String::new(),
      stderr: String::new(),
      error: Some(err_msg.clone()),
      not_found: err_msg.to_lowercase().contains("not found") || err_msg.contains("os error 2"),
    },
  }
}

fn truncate_output(text: &str) -> String {
  let trimmed = text.trim();
  if trimmed.chars().count() <= MAX_OUTPUT_CHARS {
    return trimmed.to_string();
  }
  let truncated: String = trimmed.chars().take(MAX_OUTPUT_CHARS).collect();
  format!("{truncated}...")
}

fn redact_output(text: &str) -> String {
  let mut redacted = Vec::new();
  for line in text.lines() {
    let lower = line.to_lowercase();
    if lower.contains("token")
      || lower.contains("password")
      || lower.contains("secret")
      || lower.contains("api_key")
      || lower.contains("apikey")
    {
      redacted.push("[redacted]");
    } else {
      redacted.push(line);
    }
  }
  redacted.join("\n")
}

fn add_cmd_diagnostic(diagnostics: &mut Vec<String>, label: &str, output: &CmdOutput) {
  if let Some(error) = &output.error {
    diagnostics.push(format!("{label}: {error}"));
    return;
  }

  let mut detail = String::new();
  if !output.stderr.is_empty() {
    detail = redact_output(&output.stderr);
  } else if !output.stdout.is_empty() {
    detail = redact_output(&output.stdout);
  }

  if detail.is_empty() {
    diagnostics.push(format!(
      "{label}: exit code {}",
      output.status.unwrap_or(-1)
    ));
  } else {
    diagnostics.push(format!("{label}: {detail}"));
  }
}

fn is_path_candidate(candidate: &str) -> bool {
  candidate.contains('\\') || candidate.contains('/') || candidate.contains(':')
}

fn docker_cli_candidates() -> Vec<String> {
  let mut candidates = vec!["docker".to_string()];
  if cfg!(windows) {
    candidates.push(
      r"C:\Program Files\Docker\Docker\resources\bin\docker.exe".to_string(),
    );
    candidates.push(
      r"C:\Program Files\Docker\Docker\resources\bin\com.docker.cli.exe".to_string(),
    );
  }
  candidates
}

fn parse_version_from_line(line: &str) -> Option<String> {
  let lower = line.to_lowercase();
  let marker = "version";
  let index = lower.find(marker)?;
  let after = line[index + marker.len()..].trim();
  let token = after
    .trim_start_matches(':')
    .trim()
    .split_whitespace()
    .next()?;
  let token = token.trim_end_matches(',');
  if token.is_empty() {
    None
  } else {
    Some(token.to_string())
  }
}

fn parse_docker_cli_version(output: &CmdOutput) -> Option<String> {
  let line = output.stdout.lines().next()?;
  parse_version_from_line(line)
}

fn parse_compose_version(output: &CmdOutput) -> Option<String> {
  let line = output.stdout.lines().next()?;
  parse_version_from_line(line)
}

fn run_check_docker() -> Result<CheckDockerResult, String> {
  let mut result = CheckDockerResult::new();
  let mut diagnostics = Vec::new();

  let mut docker_exe: Option<String> = None;
  for candidate in docker_cli_candidates() {
    if is_path_candidate(&candidate) && !Path::new(&candidate).exists() {
      continue;
    }
    let output = run_cmd(&candidate, &["--version"]);
    if output.error.is_some() {
      if output.not_found {
        continue;
      }
      add_cmd_diagnostic(&mut diagnostics, "docker --version", &output);
      continue;
    }

    result.docker_cli_found = true;
    result.docker_cli_version = parse_docker_cli_version(&output);
    docker_exe = Some(candidate);

    if output.status != Some(0) {
      add_cmd_diagnostic(&mut diagnostics, "docker --version", &output);
    }
    break;
  }

  if !result.docker_cli_found {
    result.remediation = Some(
      "Docker Desktop n'est pas installe ou docker.exe n'est pas accessible.".to_string(),
    );
    result.diagnostics = diagnostics;
    return Ok(result);
  }

  let docker_exe = docker_exe.ok_or_else(|| "Docker CLI path missing".to_string())?;

  let info_output = run_cmd(&docker_exe, &["info"]);
  if info_output.error.is_some() {
    add_cmd_diagnostic(&mut diagnostics, "docker info", &info_output);
  } else if info_output.status == Some(0) {
    result.docker_daemon_reachable = true;
  } else {
    add_cmd_diagnostic(&mut diagnostics, "docker info", &info_output);
  }

  if !result.docker_daemon_reachable && result.remediation.is_none() {
    result.remediation = Some(
      "Docker Desktop est installe mais le daemon ne repond pas. Lancez Docker Desktop puis reessayez."
        .to_string(),
    );
  }

  if result.docker_daemon_reachable {
    let server_output = run_cmd(&docker_exe, &["version", "--format", "{{.Server.Version}}"]);
    if server_output.error.is_none() && server_output.status == Some(0) {
      let server_version = server_output.stdout.trim();
      if !server_version.is_empty() {
        result.docker_server_version = Some(server_version.to_string());
      }
    } else {
      add_cmd_diagnostic(&mut diagnostics, "docker version --format", &server_output);
    }
  }

  let compose_output = run_cmd(&docker_exe, &["compose", "version"]);
  if compose_output.error.is_none() && compose_output.status == Some(0) {
    result.compose_v2_available = true;
    result.compose_version = parse_compose_version(&compose_output);
  } else {
    add_cmd_diagnostic(&mut diagnostics, "docker compose version", &compose_output);
    if result.remediation.is_none() {
      result.remediation = Some(
        "Docker Compose v2 n'est pas disponible. Mettez a jour Docker Desktop.".to_string(),
      );
    }
  }

  result.diagnostics = diagnostics;
  Ok(result)
}

#[tauri::command]
pub async fn check_docker() -> Result<CheckDockerResult, String> {
  tauri::async_runtime::spawn_blocking(run_check_docker)
    .await
    .map_err(|err| format!("checkDocker failed: {err}"))?
}

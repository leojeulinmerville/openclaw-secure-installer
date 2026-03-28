use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};
use chrono::Utc;
use uuid::Uuid;
use std::io::Write;
use serde_json;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use std::process::Stdio;

use crate::db::DbState;
use crate::repositories::run_linkages_repository::RunLinkagesRepository;
use crate::repositories::artifacts_repository::ArtifactsRepository;
use crate::repositories::decision_records_repository::DecisionRecordsRepository;
use crate::repositories::responsibility_ledger_repository::ResponsibilityLedgerRepository;
use crate::repositories::resume_snapshots_repository::ResumeSnapshotsRepository;
use crate::services::projection_service::ProjectionService;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum RunStatus {
    Queued,
    Running,
    Blocked,
    Done,
    Failed,
    Cancelled,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Run {
    pub id: String,
    pub created_at: String,
    pub updated_at: String,
    pub agent_id: String,
    pub provider: String,
    pub model: String,
    pub title: String,
    pub user_goal: String,
    pub status: RunStatus,
    pub current_step: Option<String>,
    pub error: Option<String>,
    pub workspace_path: String,
    pub repo_mode: String,
    // Note: We don't store full event history here, only meta.
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RunEvent {
    pub id: String,
    pub run_id: String,
    pub timestamp: String,
    #[serde(rename = "type")]
    pub event_type: String, // "type" is reserved in Rust, so we map it or use rename
    pub payload: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRunRequest {
    pub agent_id: String,
    pub provider: String,
    pub model: String,
    pub title: String,
    pub user_goal: String,
    pub workspace_path: String,
    pub mission_id: Option<String>,
    pub contract_id: Option<String>,
}

// ── Commands ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn create_run(app: AppHandle, request: CreateRunRequest) -> Result<Run, String> {
    let runs_dir = get_runs_dir(&app).map_err(|e| e.to_string())?;
    
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();

    let run = Run {
        id: id.clone(),
        created_at: now.clone(),
        updated_at: now.clone(),
        agent_id: request.agent_id,
        provider: request.provider,
        model: request.model,
        title: request.title,
        user_goal: request.user_goal,
        status: RunStatus::Queued,
        current_step: None,
        error: None,
        workspace_path: request.workspace_path,
        repo_mode: "none".to_string(),
    };

    // Save meta.json
    let run_dir = runs_dir.join(&id);
    fs::create_dir_all(&run_dir).map_err(|e| e.to_string())?;

    let meta_path = run_dir.join("meta.json");
    let json = serde_json::to_string_pretty(&run).map_err(|e| e.to_string())?;
    fs::write(&meta_path, json).map_err(|e| e.to_string())?;

    // Create empty events.jsonl
    let events_path = run_dir.join("events.jsonl");
    fs::write(&events_path, "").map_err(|e| e.to_string())?;

    // Persist linkage if mission/contract IDs are provided
    let state = app.try_state::<DbState>();
    if let (Some(db), Some(m_id), Some(c_id)) = (state, request.mission_id, request.contract_id) {
        let repo = RunLinkagesRepository::new(db.pool.clone());
        let mission_uuid = Uuid::parse_str(&m_id).map_err(|e| e.to_string())?;
        let contract_uuid = Uuid::parse_str(&c_id).map_err(|e| e.to_string())?;
        // REPO API: run_id, mission_id, contract_id
        repo.create(id.clone(), mission_uuid, contract_uuid).await.map_err(|e| e.to_string())?;
    }

    // Emit event?
    // app.emit("run-created", &run).ok();

    Ok(run)
}

#[tauri::command]
pub async fn list_runs(app: AppHandle) -> Result<Vec<Run>, String> {
    let runs_dir = get_runs_dir(&app).map_err(|e| e.to_string())?;
    if !runs_dir.exists() {
        return Ok(vec![]);
    }

    let mut runs = Vec::new();

    let entries = fs::read_dir(runs_dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            let meta_path = path.join("meta.json");
            if meta_path.exists() {
                if let Ok(content) = fs::read_to_string(&meta_path) {
                    if let Ok(run) = serde_json::from_str::<Run>(&content) {
                        runs.push(run);
                    }
                }
            }
        }
    }

    // Sort by created_at desc
    runs.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(runs)
}

#[tauri::command]
pub async fn get_run(app: AppHandle, run_id: String) -> Result<Run, String> {
    let runs_dir = get_runs_dir(&app).map_err(|e| e.to_string())?;
    let meta_path = runs_dir.join(&run_id).join("meta.json");

    if !meta_path.exists() {
        return Err("Run not found".to_string());
    }

    let content = fs::read_to_string(meta_path).map_err(|e| e.to_string())?;
    let run = serde_json::from_str::<Run>(&content).map_err(|e| e.to_string())?;

    Ok(run)
}

#[tauri::command]
pub async fn get_run_events(app: AppHandle, run_id: String) -> Result<Vec<RunEvent>, String> {
    let runs_dir = get_runs_dir(&app).map_err(|e| e.to_string())?;
    let events_path = runs_dir.join(&run_id).join("events.jsonl");

    if !events_path.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(events_path).map_err(|e| e.to_string())?;
    let mut events = Vec::new();

    for line in content.lines() {
        if !line.trim().is_empty() {
             if let Ok(event) = serde_json::from_str::<RunEvent>(line) {
                 events.push(event);
             }
        }
    }

    Ok(events)
}

// Helper to append an event (internal use or future command)
pub fn _append_event(app_handle: &AppHandle, run_id: &str, event_type: &str, payload: serde_json::Value) -> Result<RunEvent, String> {
    let runs_dir = get_runs_dir(app_handle).map_err(|e| e.to_string())?;
    let events_path = runs_dir.join(run_id).join("events.jsonl");

    let event = RunEvent {
        id: Uuid::new_v4().to_string(),
        run_id: run_id.to_string(),
        timestamp: Utc::now().to_rfc3339(),
        event_type: event_type.to_string(),
        payload,
    };

    let json = serde_json::to_string(&event).map_err(|e| e.to_string())?;
    
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(events_path)
        .map_err(|e| e.to_string())?;
        
    writeln!(file, "{}", json).map_err(|e| e.to_string())?;

    // Emit to frontend for real-time streaming
    let _ = app_handle.emit("run-event", &event);

    Ok(event)
}


#[tauri::command]
pub async fn start_run(app: AppHandle, run_id: String) -> Result<Run, String> {
    // 1. Get current run
    let mut run = get_run(app.clone(), run_id.clone()).await?;
    
    // 2. Update status to Running
    run.status = RunStatus::Running;
    _update_run_meta(&app, &run)?;
    
    // 3. Append 'run.started' event
    _append_event(&app, &run.id, "run.started", serde_json::json!({}))?;

    // 4. Spawn background task
    let app_handle = app.clone();
    let r_id = run.id.clone();
    let r_provider = run.provider.clone();
    let r_model = run.model.clone();
    let r_prompt = run.user_goal.clone();
    let r_workspace = run.workspace_path.clone();

    tauri::async_runtime::spawn(async move {
        real_run_execution(&app_handle, &r_id, &r_provider, &r_model, &r_prompt, &r_workspace).await;
    });

    Ok(run)
}

async fn execute_command_streaming(app: &AppHandle, run_id: &str, mut cmd: Command) -> Result<String, String> {
    let mut child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    let app_c = app.clone();
    let rid_c = run_id.to_string();
    let stdout_handle = tokio::spawn(async move {
        let mut full = String::new();
        while let Ok(Some(line)) = stdout_reader.next_line().await {
            if line.starts_with("[OC_EVENT] ") {
                let rest = &line["[OC_EVENT] ".len()..];
                if let Some((event_name, payload_str)) = rest.split_once(' ') {
                    let _payload: serde_json::Value = serde_json::from_str(payload_str).unwrap_or(serde_json::Value::Null);
                    match event_name {
                        "run.started" => {
                            let _ = reconcile_run_status(&app_c, &rid_c, RunStatus::Running).await;
                        }
                        "run.completed" => {
                            let _ = reconcile_run_status(&app_c, &rid_c, RunStatus::Done).await;
                        }
                        "run.failed" => {
                            let _ = reconcile_run_status(&app_c, &rid_c, RunStatus::Failed).await;
                        }
                        _ => {}
                    }
                }
            }
            full.push_str(&line);
            full.push('\n');
            let _ = _append_event(&app_c, &rid_c, "run.log", serde_json::json!({ "stream": "stdout", "content": line }));
        }
        full
    });

    let app_c2 = app.clone();
    let rid_c2 = run_id.to_string();
    let stderr_handle = tokio::spawn(async move {
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            let _ = _append_event(&app_c2, &rid_c2, "run.log", serde_json::json!({ "stream": "stderr", "content": line }));
        }
    });

    let status = child.wait().await.map_err(|e| e.to_string())?;
    let full_stdout = stdout_handle.await.map_err(|e| e.to_string())?;
    let _ = stderr_handle.await;

    if status.success() {
        Ok(full_stdout)
    } else {
        Err(format!("Command failed with exit code: {:?}", status.code()))
    }
}

async fn discover_artifacts(app: &AppHandle, run_id: &str, workspace_path: &str, mission_id: Uuid, contract_id: Uuid) -> Result<(), String> {
    let workspace = Path::new(workspace_path);
    if !workspace.exists() { return Ok(()); }

    let state = app.try_state::<DbState>();
    let pool = if let Some(db) = state {
        db.pool.clone()
    } else {
        return Err("Database state not found".to_string());
    };
    let repo = ArtifactsRepository::new(pool);

    let mut stack = vec![workspace.to_path_buf()];

    while let Some(current_dir) = stack.pop() {
        if !current_dir.is_dir() { continue; }
        let entries = fs::read_dir(&current_dir).map_err(|e| e.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name == "node_modules" || name == ".git" || name == ".openclaw" || name == ".pi" || name == "dist" {
                    continue;
                }
            }

            if path.is_dir() {
                stack.push(path);
            } else {
                let rel_path = path.strip_prefix(workspace).map_err(|e| e.to_string())?;
                let name = rel_path.file_name().and_then(|n| n.to_str()).unwrap_or("unknown");
                let storage_path = rel_path.to_string_lossy().to_string();
                
                let _ = _append_event(app, run_id, "artifact.created", serde_json::json!({
                    "name": name,
                    "path": storage_path,
                    "type": "file"
                }));

                let _ = repo.upsert_artifact(
                    mission_id,
                    Some(contract_id),
                    "file".to_string(),
                    name.to_string(),
                    Some(storage_path),
                    None
                ).await;
            }
        }
    }
    Ok(())
}

async fn real_run_execution(app: &AppHandle, run_id: &str, provider: &str, model: &str, prompt: &str, workspace: &str) {
    // 1. Fetch Linkage for Mission/Contract IDs
    let state = app.try_state::<DbState>();
    let mut mission_id_uuid = None;
    let mut contract_id_uuid = None;
    let mut mission_id_str = None;
    let mut contract_id_str = None;

    if let Some(db) = state {
        let repo = RunLinkagesRepository::new(db.pool.clone());
        if let Ok(linkage) = repo.get_by_run_id(run_id).await {
            mission_id_uuid = Some(linkage.mission_id);
            contract_id_uuid = Some(linkage.contract_id);
            mission_id_str = Some(linkage.mission_id.to_string());
            contract_id_str = Some(linkage.contract_id.to_string());
        }
    }

    // Determine the openclaw bin path
    let cwd = std::env::current_dir().unwrap_or_default();
    let dev_script1 = cwd.join("../../scripts/run-node.mjs");
    let dev_script2 = cwd.join("../scripts/run-node.mjs");
    
    let base_cmd = if dev_script1.exists() {
        "node".to_string()
    } else if dev_script2.exists() {
        "node".to_string()
    } else if cfg!(target_os = "windows") {
        "openclaw.cmd".to_string()
    } else {
        "openclaw".to_string()
    };

    let get_base_cmd = || -> (String, Vec<String>) {
        if dev_script1.exists() {
            ("node".to_string(), vec![dev_script1.to_string_lossy().to_string()])
        } else if dev_script2.exists() {
            ("node".to_string(), vec![dev_script2.to_string_lossy().to_string()])
        } else {
            (base_cmd.clone(), vec![])
        }
    };

    let (cmd_bin, cmd_init_args) = get_base_cmd();
    
    let _ = _append_event(app, run_id, "agent.setup", serde_json::json!({ "workspace": workspace, "model": model, "provider": provider }));
    
    // Command 1: Add Agent
    let mut add_cmd = Command::new(&cmd_bin);
    add_cmd.args(&cmd_init_args);
    add_cmd.arg("agents").arg("add").arg(run_id)
        .arg("--workspace").arg(workspace)
        .arg("--model").arg(model)
        .arg("--non-interactive");

    match execute_command_streaming(app, run_id, add_cmd).await {
        Ok(stdout) => {
             let _ = _append_event(app, run_id, "agent.setup_ok", serde_json::json!({ "output": stdout }));
        }
        Err(e) => {
             let _ = _append_event(app, run_id, "run.failed", serde_json::json!({ "reason": format!("Failed to configure agent: {}", e) }));
             let _ = update_run_status(app, run_id, RunStatus::Failed, Some("Agent Setup Failed".to_string())).await;
             return;
        }
    }

    // Command 2: Execute Agent Turn
    let _ = _append_event(app, run_id, "llm.requested", serde_json::json!({ "prompt": prompt, "agent_id": run_id }));
    let _ = update_run_status(app, run_id, RunStatus::Running, None).await;

    let mut run_cmd = Command::new(&cmd_bin);
    run_cmd.args(&cmd_init_args);
    run_cmd.arg("agent").arg("--agent").arg(run_id)
        .arg("--provider").arg(provider)
        .arg("--model").arg(model)
        .arg("--message").arg(prompt)
        .arg("--local");

    if let Some(m_id) = mission_id_str {
        run_cmd.arg("--mission-id").arg(m_id);
    }
    if let Some(c_id) = contract_id_str {
        run_cmd.arg("--contract-id").arg(c_id);
    }

    match execute_command_streaming(app, run_id, run_cmd).await {
        Ok(stdout) => {
            let _ = _append_event(app, run_id, "llm.completed", serde_json::json!({ "output": stdout }));
            let _ = _append_event(app, run_id, "agent.message", serde_json::json!({ "role": "assistant", "content": stdout }));
            
            // Artifact discovery
            if let (Some(m_id), Some(c_id)) = (mission_id_uuid, contract_id_uuid) {
                let _ = discover_artifacts(app, run_id, workspace, m_id, c_id).await;
            }
            
            let _ = update_run_status(app, run_id, RunStatus::Done, None).await;
        }
        Err(e) => {
            let _ = _append_event(app, run_id, "run.failed", serde_json::json!({ "reason": format!("Agent CLI error: {}", e) }));
            let _ = update_run_status(app, run_id, RunStatus::Failed, Some(e)).await;
        }
    }
}


async fn update_run_status(app: &AppHandle, run_id: &str, status: RunStatus, error: Option<String>) -> Result<(), String> {
     if let Ok(mut run) = get_run(app.clone(), run_id.to_string()).await {
         if run.status == status {
             // Idempotence check: if status hasn't changed, only update the error/meta and return without triggering mission reconciliation loop
             run.error = error.or(run.error);
             run.updated_at = Utc::now().to_rfc3339();
             let _ = _update_run_meta(app, &run);
             return Ok(());
         }

         run.status = status.clone();
         run.updated_at = Utc::now().to_rfc3339();
         run.error = error;
         _update_run_meta(app, &run)?;
         // Emit status change for real-time UI update
         let _ = app.emit("run-status", serde_json::json!({
             "run_id": run_id,
             "status": run.status,
             "error": run.error
         }));

         let _ = reconcile_run_status(app, run_id, status).await;

         Ok(())
     } else {
         Ok(()) // ignore
     }
}

pub async fn reconcile_run_status_core(pool: &sqlx::PgPool, run_id: &str, status: RunStatus) -> Result<Option<uuid::Uuid>, String> {
    let repo = RunLinkagesRepository::new(pool.clone());
    let status_str = match status {
        RunStatus::Queued => "queued",
        RunStatus::Running => "running",
        RunStatus::Blocked => "blocked",
        RunStatus::Done => "done",
        RunStatus::Failed => "failed",
        RunStatus::Cancelled => "cancelled",
    }.to_string();

    if let Ok(linkage) = repo.get_by_run_id(run_id).await {
        // Idempotence check: Skip if status is already correct
        if linkage.status == status_str {
            return Ok(Some(linkage.mission_id));
        }

        let _ = repo.update_status(run_id, status_str.clone()).await;

        // ── Bridge: update contract status based on run terminal state ──
        let contracts_repo = crate::repositories::contracts_repository::ContractsRepository::new(pool.clone());
        let current_contract = contracts_repo.get(linkage.contract_id).await.ok();
        let current_status = current_contract.as_ref().map(|c| c.status.as_str()).unwrap_or("unknown");

        match status {
            RunStatus::Running if current_status != "active" => {
                let _ = contracts_repo.update_status(linkage.contract_id, "active".to_string()).await;
            }
            RunStatus::Done if current_status != "fulfilled" => {
                let _ = contracts_repo.update_status(linkage.contract_id, "fulfilled".to_string()).await;
            }
            RunStatus::Failed | RunStatus::Cancelled if current_status != "failed" => {
                let _ = contracts_repo.update_status(linkage.contract_id, "failed".to_string()).await;
            }
            RunStatus::Blocked if current_status != "blocked" => {
                let _ = contracts_repo.update_status(linkage.contract_id, "blocked".to_string()).await;
                
                // Record system-initiated block decision (intervention needed)
                let decision_repo = crate::repositories::decision_records_repository::DecisionRecordsRepository::new(pool.clone());
                let _ = decision_repo.create(
                    linkage.mission_id,
                    "run_blocked".to_string(),
                    format!("Run {} entered blocked state. Intervention may be required.", run_id),
                    None,
                    Some("system".to_string()),
                    None, // rationale
                ).await;
            }
            _ => {}
        }

        // ── Bridge: write validation record on terminal states ──
        if matches!(status, RunStatus::Done | RunStatus::Failed | RunStatus::Cancelled) {
            let validation_repo = crate::repositories::validation_records_repository::ValidationRecordsRepository::new(pool.clone());
            
            // Check for idempotence: Do we already have a completion record for this run?
            let existing_validations = validation_repo.list_latest_for_mission(linkage.mission_id, 1000).await.unwrap_or_default();
            let already_handled = existing_validations.iter().any(|v: &crate::repositories::validation_records_repository::ValidationRecord| {
                v.validation_scope == "run_completion" && v.evidence_links.as_ref().map_or(false, |m: &serde_json::Value| {
                    m.get("run_id").and_then(|id| id.as_str()) == Some(run_id)
                })
            });

            if !already_handled {
                let outcome = if matches!(status, RunStatus::Done) { "pass" } else { "fail" };
                let summary = format!(
                    "Run {} completed with status: {}",
                    run_id, status_str
                );
                let _ = validation_repo.create(
                    linkage.mission_id,
                    "run_completion".to_string(),
                    outcome.to_string(),
                    Some(summary),
                    Some("system".to_string()),
                    Some(serde_json::json!({ "run_id": run_id, "status": status_str })),
                ).await;
            }
        }

        // Refresh mission projection
        let projection_service = ProjectionService::new(pool.clone());
        let is_refreshed = projection_service.refresh_projection(linkage.mission_id).await.is_ok();

        // Create ResumeSnapshot when run ends
        if matches!(status, RunStatus::Done | RunStatus::Failed | RunStatus::Blocked) {
            let snapshots_repo = ResumeSnapshotsRepository::new(pool.clone());
            let latest = snapshots_repo.get_latest(linkage.mission_id).await.ok();
            let already_snapped = latest.map_or(false, |s| {
                s.state_blob.as_ref()
                    .and_then(|b| b.get("run_id"))
                    .and_then(|id| id.as_str()) == Some(run_id)
            });

            if !already_snapped {
                let _ = snapshots_repo.create(
                    linkage.mission_id,
                    format!("Run {} ended with status {}", run_id, status_str),
                    Some("auto".to_string()),
                    Some("Review run artifacts and determine next step".to_string()),
                    Some(serde_json::json!({ "run_id": run_id, "status": status_str }))
                ).await;
            }
        }

        if is_refreshed {
            return Ok(Some(linkage.mission_id));
        }
    }
    Ok(None)
}

async fn reconcile_run_status(app: &AppHandle, run_id: &str, status: RunStatus) -> Result<(), String> {
    let state = app.try_state::<DbState>();
    if let Some(db) = state {
        if let Ok(Some(mission_id)) = reconcile_run_status_core(&db.pool, run_id, status).await {
            let _ = app.emit("mission-projection-updated", mission_id);
        }
    }
    Ok(())
}

fn _update_run_meta(app: &AppHandle, run: &Run) -> Result<(), String> {
    let runs_dir = get_runs_dir(app).map_err(|e| e.to_string())?;
    let meta_path = runs_dir.join(&run.id).join("meta.json");
    let json = serde_json::to_string_pretty(run).map_err(|e| e.to_string())?;
    fs::write(meta_path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn submit_approval(app: AppHandle, run_id: String, approval_id: String, decision: String) -> Result<Run, String> {
    let mut run = get_run(app.clone(), run_id.clone()).await?;

    // Append approval.resolved
    _append_event(&app, &run.id, "approval.resolved", serde_json::json!({
        "approval_id": approval_id,
        "decision": decision
    }))?;

    // Record decision and responsibility ledger entry
    let state = app.try_state::<DbState>();
    if let Some(db) = state {
        let linkage_repo = RunLinkagesRepository::new(db.pool.clone());
        if let Ok(linkage) = linkage_repo.get_by_run_id(&run_id).await {
            let mission_id = linkage.mission_id;
            
            let decision_repo = DecisionRecordsRepository::new(db.pool.clone());
            if let Ok(record) = decision_repo.create(
                mission_id,
                "approval_resolved".to_string(),
                format!("Approval resolved for run {} with decision {}", run_id, decision),
                Some(decision.clone()),
                Some("user".to_string()),
                None // rationale
            ).await {
                let ledger_repo = ResponsibilityLedgerRepository::new(db.pool.clone());
                let _ = ledger_repo.create_entry(
                    mission_id,
                    "decision".to_string(),
                    Some(record.decision_id),
                    "user".to_string(),
                    format!("User {} approval for run {}", decision, run_id)
                ).await;
            }
        }
    }

    if decision == "approved" {
        run.status = RunStatus::Running;
        _update_run_meta(&app, &run)?;
        let _ = reconcile_run_status(&app, &run.id, RunStatus::Running).await;

        let app_handle = app.clone();
        let r_id = run.id.clone();
        
        tauri::async_runtime::spawn(async move {
            real_resume_execution(&app_handle, &r_id).await;
        });
    } else {
         run.status = RunStatus::Failed; // Cancelled
         run.error = Some("Rejected by user".to_string());
         _update_run_meta(&app, &run)?;
         let _ = reconcile_run_status(&app, &run.id, RunStatus::Failed).await;
         let _ = _append_event(&app, &run.id, "run.cancelled", serde_json::json!({}));
    }

    Ok(run)
}
#[tauri::command]
pub async fn delete_run(app: AppHandle, run_id: String) -> Result<(), String> {
    let runs_dir = get_runs_dir(&app).map_err(|e| e.to_string())?;
    let run_path = runs_dir.join(&run_id);
    if run_path.exists() {
        fs::remove_dir_all(run_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn read_workspace_file(app: AppHandle, run_id: String, relative_path: String) -> Result<String, String> {
    // 1. Check if it's an artifact in the runs directory
    if relative_path.starts_with("artifacts/") {
        let runs_dir = get_runs_dir(&app).map_err(|e| e.to_string())?;
        let target = runs_dir.join(&run_id).join(&relative_path);
        if target.exists() {
             return fs::read_to_string(target).map_err(|e| e.to_string());
        }
    }

    // 2. Fallback to workspace file
    let run = get_run(app.clone(), run_id).await?;
    let workspace = Path::new(&run.workspace_path);
    let target = workspace.join(&relative_path);

    // Security check: Ensure target is within workspace
    if let (Ok(ws_canon), Ok(target_canon)) = (workspace.canonicalize(), target.canonicalize()) {
        if !target_canon.starts_with(ws_canon) {
            return Err("Access denied: File outside workspace".to_string());
        }
    } else {
        return Err("File not found or invalid path".to_string());
    }

    fs::read_to_string(target).map_err(|e| e.to_string())
}

async fn real_resume_execution(app: &AppHandle, run_id: &str) {
    use crate::patch::apply_patch_safely;
    
    // Read the patch from artifacts
    let runs_dir = get_runs_dir(app).unwrap();
    let patch_path = runs_dir.join(run_id).join("artifacts").join("PATCH.diff");

    if !patch_path.exists() {
         let _ = update_run_status(app, run_id, RunStatus::Failed, Some("Patch file not found".to_string())).await;
         return;
    }

    if let Ok(patch_content) = fs::read_to_string(patch_path) {
         if let Ok(run) = get_run(app.clone(), run_id.to_string()).await {
             let result = apply_patch_safely(&run.workspace_path, &patch_content);
             
             if result.applied {
                  let _ = _append_event(app, run_id, "patch.apply.succeeded", serde_json::json!({ "files": result.modified_files }));
                  let _ = update_run_status(app, run_id, RunStatus::Done, None).await;
                  let _ = _append_event(app, run_id, "run.completed", serde_json::json!({}));
             } else {
                  let err = result.error.unwrap_or("Unknown error".to_string());
                  let _ = _append_event(app, run_id, "patch.apply.failed", serde_json::json!({ "error": err.clone() }));
                  let _ = update_run_status(app, run_id, RunStatus::Failed, Some(err)).await;
             }
         }
    }
}

// ── Utils ──────────────────────────────────────────────────────────

fn get_runs_dir(app: &AppHandle) -> Result<PathBuf, std::io::Error> {
    let app_data = app.path().app_data_dir().map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
    let runs = app_data.join("runs");
    if !runs.exists() {
        fs::create_dir_all(&runs)?;
    }
    Ok(runs)
}

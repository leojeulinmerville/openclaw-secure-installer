use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, State};
use chrono::Utc;
use uuid::Uuid;
use std::io::Write;
use keyring;
use serde_json;

#[derive(Debug, Serialize, Deserialize, Clone)]
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
    pub event_type: String, // "type" is reserved in Rust, so we map it or use rename
    pub payload: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateRunRequest {
    pub agent_id: String,
    pub provider: String,
    pub model: String,
    pub title: String,
    pub user_goal: String,
    pub workspace_path: String,
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

async fn real_run_execution(app: &AppHandle, run_id: &str, provider: &str, model: &str, prompt: &str, workspace: &str) {
    use crate::llm::LlmClient;

    // 1. Check Internet/Secrets if needed
    let allow_internet = crate::state_manager::get_allow_internet(app.clone()).await.unwrap_or(false);
    
    let mut api_key = None;
    if provider == "openai" {
        if !allow_internet {
             let _ = _append_event(app, run_id, "run.failed", serde_json::json!({ "reason": "Internet disabled. Cannot use OpenAI." }));
             let _ = update_run_status(app, run_id, RunStatus::Failed, Some("Internet disabled".to_string())).await;
             return;
        }
        
        if let Ok(entry) = keyring::Entry::new("my_openclaw", "openai_api_key") {
             if let Ok(pwd) = entry.get_password() {
                 api_key = Some(pwd);
             }
        }
        if api_key.is_none() {
             let _ = _append_event(app, run_id, "run.failed", serde_json::json!({ "reason": "OpenAI API Key not found. Please set it in Settings." }));
             let _ = update_run_status(app, run_id, RunStatus::Failed, Some("No API Key".to_string())).await;
             return;
        }
    }

    // 2. Build Context (File Tree)
    // Minimal snapshot: list files in root (depth 1 or 2)
    let context_tree = match list_files_recursive(workspace, 2) {
        Ok(tree) => tree,
        Err(e) => {
             let _ = _append_event(app, run_id, "run.failed", serde_json::json!({ "reason": format!("Failed to read workspace: {}", e) }));
             let _ = update_run_status(app, run_id, RunStatus::Failed, Some(e)).await;
             return;
        }
    };

    let system_prompt = format!(r#"You are an expert software engineer.
You are running in a workspace at: {}
Current file structure:
{}

Your goal is to solve the user's request.
Output your response in the following strict format:

# SUMMARY
[A brief description of what you plan to do]

# PATCH
[A Unified Diff of the changes. Start with "diff --git" or "--- a/". ensure paths are relative to root]

# VERIFICATION
[Steps to verify the change]

Do not include any other text outside these sections.
"#, workspace, context_tree);

    let _ = _append_event(app, run_id, "llm.requested", serde_json::json!({ "model": model, "provider": provider }));

    // 3. Call LLM
    let client = LlmClient::new(provider, model, None, api_key);
    match client.complete(&system_prompt, prompt).await {
        Ok((content, usage)) => {
             let _ = _append_event(app, run_id, "llm.completed", serde_json::json!({ "usage": format!("{:?}", usage) }));
             
             // 4. Parse Response
             // Helper regex or split
             let (summary, patch, verify) = parse_artifacts(&content);

             if patch.trim().is_empty() {
                  let _ = _append_event(app, run_id, "agent.message", serde_json::json!({ "role": "assistant", "content": "I couldn't generate a valid patch. Please check my summary." }));
                  // continue?
             }

             // 5. Write Artifacts
             if let Ok(run) = get_run(app.clone(), run_id.to_string()).await {
                 let runs_dir = get_runs_dir(app).unwrap(); // safe unzip
                 let artifacts_path = runs_dir.join(run_id).join("artifacts");
                 let _ = fs::create_dir_all(&artifacts_path);

                 let _ = fs::write(artifacts_path.join("SUMMARY.md"), &summary);
                 let _ = _append_event(app, run_id, "artifact.created", serde_json::json!({ "type": "summary", "name": "Summary", "path": "artifacts/SUMMARY.md" }));
                 
                 let _ = fs::write(artifacts_path.join("PATCH.diff"), &patch);
                 let _ = _append_event(app, run_id, "artifact.created", serde_json::json!({ "type": "patch", "name": "Proposed Patch", "path": "artifacts/PATCH.diff" }));
                 
                 let _ = fs::write(artifacts_path.join("VERIFICATION.md"), &verify);
             }

             // 6. Request Approval
             let _ = _append_event(app, run_id, "approval.requested", serde_json::json!({
                 "kind": "filesystem.write_patch",
                 "summary": summary.lines().next().unwrap_or("Review Patch"),
                 "risk_level": "medium"
             }));

             let _ = update_run_status(app, run_id, RunStatus::Blocked, None).await;
        }
        Err(e) => {
             let _ = _append_event(app, run_id, "run.failed", serde_json::json!({ "reason": e.to_string() }));
             let _ = update_run_status(app, run_id, RunStatus::Failed, Some(e.to_string())).await;
        }
    }

}

fn list_files_recursive(path: &str, _depth: usize) -> Result<String, String> {
    // Simple implementation
    let root = Path::new(path);
    let mut out = String::new();
    
    if root.is_dir() {
        if let Ok(entries) = fs::read_dir(root) {
            for entry in entries {
                if let Ok(e) = entry {
                    let p = e.path();
                    if let Ok(rel) = p.strip_prefix(root) {
                         out.push_str(&format!("- {}\n", rel.display()));
                    }
                }
            }
        }
    }
    Ok(out)
}

fn parse_artifacts(content: &str) -> (String, String, String) {
    // Naive split by headers
    let parts: Vec<&str> = content.split("# ").collect();
    let mut summary = String::new();
    let mut patch = String::new();
    let mut verify = String::new();

    for part in parts {
        if part.starts_with("SUMMARY") {
            summary = part.replace("SUMMARY", "").trim().to_string();
        } else if part.starts_with("PATCH") {
            patch = part.replace("PATCH", "").trim().to_string();
            // strip code fences if present
            patch = patch.replace("```diff", "").replace("```", "").trim().to_string();
        } else if part.starts_with("VERIFICATION") {
            verify = part.replace("VERIFICATION", "").trim().to_string();
        }
    }
    (summary, patch, verify)
}

async fn update_run_status(app: &AppHandle, run_id: &str, status: RunStatus, error: Option<String>) -> Result<(), String> {
     if let Ok(mut run) = get_run(app.clone(), run_id.to_string()).await {
         run.status = status;
         run.error = error;
         _update_run_meta(app, &run)
     } else {
         Ok(()) // ignore
     }
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

    if decision == "approved" {
        run.status = RunStatus::Running;
        _update_run_meta(&app, &run)?;

        let app_handle = app.clone();
        let r_id = run.id.clone();
        
        tauri::async_runtime::spawn(async move {
            real_resume_execution(&app_handle, &r_id).await;
        });
    } else {
         run.status = RunStatus::Failed; // Cancelled
         run.error = Some("Rejected by user".to_string());
         _update_run_meta(&app, &run)?;
         let _ = _append_event(&app, &run.id, "run.cancelled", serde_json::json!({}));
    }

    Ok(run)
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

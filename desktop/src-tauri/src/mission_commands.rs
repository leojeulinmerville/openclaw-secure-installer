use tauri::State;
use uuid::Uuid;
use crate::db::DbState;
use crate::mission_coordinator::{MissionCoordinator, Mission};
use crate::repositories::mission_state_projections_repository::MissionStateProjection;
use crate::repositories::contracts_repository::Contract;
use crate::repositories::decision_records_repository::DecisionRecord;
use crate::repositories::validation_records_repository::ValidationRecord;
use crate::repositories::artifacts_repository::Artifact;

#[tauri::command]
pub async fn create_mission(
    title: String,
    intent: String,
    state: State<'_, DbState>
) -> Result<Mission, String> {
    let coordinator = MissionCoordinator::new(state.pool.clone());
    coordinator.create_mission(title, intent).await
}

#[tauri::command]
pub async fn list_missions(
    state: State<'_, DbState>
) -> Result<Vec<Mission>, String> {
    let coordinator = MissionCoordinator::new(state.pool.clone());
    coordinator.list_missions().await
}

#[tauri::command]
pub async fn get_mission_detail(
    mission_id: String,
    state: State<'_, DbState>
) -> Result<Mission, String> {
    let mission_uuid = Uuid::parse_str(&mission_id).map_err(|e| e.to_string())?;
    let coordinator = MissionCoordinator::new(state.pool.clone());
    coordinator.get_mission_detail(mission_uuid).await
}

#[tauri::command]
pub async fn pause_mission(
    mission_id: String,
    state: State<'_, DbState>
) -> Result<(), String> {
    let mission_uuid = Uuid::parse_str(&mission_id).map_err(|e| e.to_string())?;
    let coordinator = MissionCoordinator::new(state.pool.clone());
    coordinator.pause_mission(mission_uuid).await
}

#[tauri::command]
pub async fn resume_mission(
    mission_id: String,
    state: State<'_, DbState>
) -> Result<(), String> {
    let mission_uuid = Uuid::parse_str(&mission_id).map_err(|e| e.to_string())?;
    let coordinator = MissionCoordinator::new(state.pool.clone());
    coordinator.resume_mission(mission_uuid).await
}

#[tauri::command]
pub async fn refresh_mission_state(
    mission_id: String,
    state: State<'_, DbState>
) -> Result<(), String> {
    let mission_uuid = Uuid::parse_str(&mission_id).map_err(|e| e.to_string())?;
    let coordinator = MissionCoordinator::new(state.pool.clone());
    coordinator.refresh_mission_state(mission_uuid).await
}

#[tauri::command]
pub async fn get_mission_projection(
    mission_id: String,
    state: State<'_, DbState>
) -> Result<MissionStateProjection, String> {
    let mission_uuid = Uuid::parse_str(&mission_id).map_err(|e| e.to_string())?;
    let coordinator = MissionCoordinator::new(state.pool.clone());
    coordinator.get_mission_projection(mission_uuid).await
}

#[tauri::command]
pub async fn admit_contract(
    mission_id: String,
    contract_type: String,
    title: String,
    state: State<'_, DbState>
) -> Result<Contract, String> {
    let mission_uuid = Uuid::parse_str(&mission_id).map_err(|e| e.to_string())?;
    let coordinator = MissionCoordinator::new(state.pool.clone());
    coordinator.admit_contract(mission_uuid, contract_type, title).await
}

#[tauri::command]
pub async fn record_decision(
    mission_id: String,
    decision_type: String,
    summary: String,
    outcome: Option<String>,
    responsibility: String,
    state: State<'_, DbState>
) -> Result<DecisionRecord, String> {
    let mission_uuid = Uuid::parse_str(&mission_id).map_err(|e| e.to_string())?;
    let coordinator = MissionCoordinator::new(state.pool.clone());
    coordinator.record_decision(mission_uuid, decision_type, summary, outcome, responsibility).await
}

#[tauri::command]
pub async fn record_validation(
    mission_id: String,
    scope: String,
    outcome: String,
    summary: Option<String>,
    responsibility: String,
    state: State<'_, DbState>
) -> Result<ValidationRecord, String> {
    let mission_uuid = Uuid::parse_str(&mission_id).map_err(|e| e.to_string())?;
    let coordinator = MissionCoordinator::new(state.pool.clone());
    coordinator.record_validation(mission_uuid, scope, outcome, summary, responsibility).await
}

#[tauri::command]
pub async fn create_artifact(
    mission_id: String,
    contract_id: String,
    artifact_type: String,
    name: String,
    state: State<'_, DbState>
) -> Result<Artifact, String> {
    let mission_uuid = Uuid::parse_str(&mission_id).map_err(|e| e.to_string())?;
    let contract_uuid = Uuid::parse_str(&contract_id).map_err(|e| e.to_string())?;
    let coordinator = MissionCoordinator::new(state.pool.clone());
    coordinator.create_artifact(mission_uuid, contract_uuid, artifact_type, name).await
}

#[tauri::command]
pub async fn start_contract_activation(
    app: tauri::AppHandle,
    mission_id: String,
    contract_id: String,
    agent_id: String,
    provider: String,
    model: String,
    title: String,
    goal: String,
    workspace_path: String,
    state: State<'_, DbState>
) -> Result<crate::runs::Run, String> {
    let mission_uuid = Uuid::parse_str(&mission_id).map_err(|e| e.to_string())?;
    let contract_uuid = Uuid::parse_str(&contract_id).map_err(|e| e.to_string())?;
    let coordinator = MissionCoordinator::new(state.pool.clone());
    
    coordinator.start_contract_activation(
        app, 
        mission_uuid, 
        contract_uuid, 
        agent_id, 
        provider, 
        model, 
        title, 
        goal, 
        workspace_path
    ).await
}

#[tauri::command]
pub async fn list_mission_contracts(
    mission_id: String,
    state: State<'_, DbState>
) -> Result<Vec<crate::repositories::contracts_repository::Contract>, String> {
    let u_mission_id = Uuid::parse_str(&mission_id).map_err(|e| e.to_string())?;
    let repo = crate::repositories::contracts_repository::ContractsRepository::new(state.pool.clone());
    repo.list(u_mission_id).await
}

#[tauri::command]
pub async fn list_mission_artifacts(
    mission_id: String,
    state: State<'_, DbState>
) -> Result<Vec<crate::repositories::artifacts_repository::Artifact>, String> {
    let u_mission_id = Uuid::parse_str(&mission_id).map_err(|e| e.to_string())?;
    let repo = crate::repositories::artifacts_repository::ArtifactsRepository::new(state.pool.clone());
    repo.list_for_mission(u_mission_id).await
}

#[tauri::command]
pub async fn list_mission_run_linkages(
    mission_id: String,
    state: State<'_, DbState>
) -> Result<Vec<crate::repositories::run_linkages_repository::RunLinkage>, String> {
    let u_mission_id = Uuid::parse_str(&mission_id).map_err(|e| e.to_string())?;
    let repo = crate::repositories::run_linkages_repository::RunLinkagesRepository::new(state.pool.clone());
    repo.list_for_mission(u_mission_id).await
}

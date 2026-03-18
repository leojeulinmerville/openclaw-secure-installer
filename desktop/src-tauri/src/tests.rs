use sqlx::postgres::PgPoolOptions;
use std::time::Duration;
use uuid::Uuid;

use crate::runs::{reconcile_run_status_core, RunStatus};
use crate::mission_coordinator::MissionCoordinator;
use crate::repositories::run_linkages_repository::RunLinkagesRepository;
use crate::repositories::validation_records_repository::ValidationRecordsRepository;
use crate::repositories::decision_records_repository::DecisionRecordsRepository;
use crate::repositories::contracts_repository::ContractsRepository;

/// Helper function to initialize a test DB connection
async fn get_test_db() -> sqlx::PgPool {
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://openclaw@127.0.0.1:18789/postgres".to_string());
    
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(5))
        .connect(&url)
        .await
        .expect("Failed to connect to test Postgres. Ensure OpenClaw Postgres is running.");
        
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    pool
}

#[tokio::test]
async fn test_mission_lifecycle_truth_sequence() {
    let pool = get_test_db().await;
    let coordinator = MissionCoordinator::new(pool.clone());
    let run_linkages_repo = RunLinkagesRepository::new(pool.clone());
    let contracts_repo = ContractsRepository::new(pool.clone());
    let validations_repo = ValidationRecordsRepository::new(pool.clone());
    let decisions_repo = DecisionRecordsRepository::new(pool.clone());

    // ── 1. Create Mission ──
    let mission = coordinator.create_mission(
        "Headless Test Mission".to_string(), 
        "Automated truth verification".to_string()
    ).await.expect("Failed to create mission");

    assert_eq!(mission.status, "active", "Mission should start active");

    // ── 2. Admit Contract ──
    let contract = coordinator.admit_contract(
        mission.id, 
        "research".to_string(), 
        "Verify state mapping".to_string()
    ).await.expect("Failed to admit contract");

    assert_eq!(contract.status, "pending", "Contract should start pending");

    // ── 3. Simulate Run Linkage ──
    let run_id = Uuid::new_v4().to_string();
    run_linkages_repo.create(
        mission.id,
        contract.id,
        run_id.clone(),
        Some("test_agent".to_string())
    ).await.expect("Failed to create linkage");

    // ── 4. Terminal Successful Run (reconcile_run_status_core) ──
    let result = reconcile_run_status_core(&pool, &run_id, RunStatus::Done).await;
    assert!(result.is_ok(), "Reconciliation failed");
    
    // Verify Contract Status
    let updated_contract = contracts_repo.get(contract.id).await.unwrap();
    assert_eq!(updated_contract.status, "fulfilled", "Done terminal string must map to fulfilled contract status.");

    // ── 5. Exactly One Validation Record ──
    let val_after_done = validations_repo.list_for_mission(mission.id).await.unwrap();
    assert_eq!(val_after_done.len(), 1, "Exactly one validation record should exist for completion.");
    assert_eq!(val_after_done[0].outcome, "pass");

    // ── 6. Redundant Terminal Update (Idempotence) ──
    let result2 = reconcile_run_status_core(&pool, &run_id, RunStatus::Done).await;
    assert!(result2.is_ok(), "Second reconciliation should not throw error");
    
    let val_after_redundant = validations_repo.list_for_mission(mission.id).await.unwrap();
    assert_eq!(val_after_redundant.len(), 1, "Idempotence failed: Validation record was duplicated on redundant push.");

    // ── 7. Failed Linked Run Logic ──
    // Create second contract to test failure
    let contract2 = coordinator.admit_contract(
        mission.id, 
        "coding".to_string(), 
        "Verify failure mapping".to_string()
    ).await.unwrap();
    
    let run_id2 = Uuid::new_v4().to_string();
    run_linkages_repo.create(
        mission.id,
        contract2.id,
        run_id2.clone(),
        Some("test_agent".to_string())
    ).await.unwrap();

    let _ = reconcile_run_status_core(&pool, &run_id2, RunStatus::Failed).await;
    let up_contract2 = contracts_repo.get(contract2.id).await.unwrap();
    assert_eq!(up_contract2.status, "failed", "Failed terminal string must map to failed contract status.");

    let val_after_fail = validations_repo.list_for_mission(mission.id).await.unwrap();
    assert_eq!(val_after_fail.len(), 2, "Second validation record should be written for second run.");
    
    // Find the fail validation
    let fail_val = val_after_fail.into_iter().find(|v| v.outcome == "fail").expect("Fail validation missing");
    assert!(fail_val.summary.unwrap().contains(&run_id2), "Validation summary must contain run ID");

    // ── 8. Blocked Run (Automatic Decision Record) ──
    let contract3 = coordinator.admit_contract(
        mission.id,
        "action".to_string(),
        "Verify block mapping".to_string()
    ).await.unwrap();

    let run_id3 = Uuid::new_v4().to_string();
    run_linkages_repo.create(
        mission.id,
        contract3.id,
        run_id3.clone(),
        Some("test_agent".to_string())
    ).await.unwrap();

    let _ = reconcile_run_status_core(&pool, &run_id3, RunStatus::Blocked).await;
    let up_contract3 = contracts_repo.get(contract3.id).await.unwrap();
    assert_eq!(up_contract3.status, "blocked", "Blocked status must map to blocked contract status.");

    let decs_after_block = decisions_repo.list_latest_for_mission(mission.id, 10).await.unwrap();
    let block_dec = decs_after_block.iter().find(|d| d.decision_type == "run_blocked").expect("Run blocked decision record missing");
    assert!(block_dec.summary.contains(&run_id3));

    // ── 9. Operator Intervention Record ──
    let decision = coordinator.record_decision(
        mission.id, 
        "operator_intervention".to_string(), 
        "Manual override applied".to_string(), 
        None, 
        "human_operator".to_string()
    ).await.expect("Failed to record decision intervention");

    assert_eq!(decision.decision_type, "operator_intervention");
    
    let decs_after = decisions_repo.list_latest_for_mission(mission.id, 10).await.unwrap();
    assert!(decs_after.iter().any(|d| d.decision_id == decision.decision_id), "Manual decision record missing");
}

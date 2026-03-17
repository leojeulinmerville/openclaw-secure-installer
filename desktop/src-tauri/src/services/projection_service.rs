use sqlx::PgPool;
use uuid::Uuid;
use crate::repositories::missions_repository::MissionsRepository;
use crate::repositories::contracts_repository::ContractsRepository;
use crate::repositories::decision_records_repository::DecisionRecordsRepository;
use crate::repositories::validation_records_repository::ValidationRecordsRepository;
use crate::repositories::mission_state_projections_repository::{MissionStateProjectionsRepository, MissionStateProjection};

pub struct ProjectionService {
    pub pool: PgPool,
}

impl ProjectionService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn refresh_projection(&self, mission_id: Uuid) -> Result<(), String> {
        let missions_repo = MissionsRepository::new(self.pool.clone());
        let contracts_repo = ContractsRepository::new(self.pool.clone());
        let decisions_repo = DecisionRecordsRepository::new(self.pool.clone());
        let validations_repo = ValidationRecordsRepository::new(self.pool.clone());
        let projection_repo = MissionStateProjectionsRepository::new(self.pool.clone());

        // 1. Get current mission state
        let mission = missions_repo.get(mission_id).await?;

        // 2. Get additional data
        let active_contract_count = contracts_repo.count_active(mission_id).await.unwrap_or(0) as i32;
        
        let last_decision = decisions_repo.list_latest_for_mission(mission_id, 1).await.ok()
            .and_then(|list| list.into_iter().next());
        let last_decision_summary = last_decision.map(|d| d.summary);

        let last_validation = validations_repo.list_latest_for_mission(mission_id, 1).await.ok()
            .and_then(|list| list.into_iter().next());
        let last_validation_summary = last_validation.and_then(|v| v.summary);

        // 3. Upsert projection
        projection_repo.upsert(
            mission_id,
            Some(mission.title),
            mission.current_phase,
            Some(mission.status),
            Some(mission.mission_mode),
            Some(mission.health_state.clone()),
            Some(mission.health_state),
            Some(mission.governance_state.clone()),
            Some(mission.governance_state),
            mission.summary_current,
            None, // blocker_risk
            None, // top_blocker
            None, // top_risk
            None, // reference_path
            mission.resume_readiness,
            active_contract_count,
            last_decision_summary,
            last_validation_summary,
            false, // needs_human_attention (default)
        ).await?;

        Ok(())
    }

    pub async fn get_projection(&self, mission_id: Uuid) -> Result<MissionStateProjection, String> {
        let projection_repo = MissionStateProjectionsRepository::new(self.pool.clone());
        projection_repo.get(mission_id).await
    }
}

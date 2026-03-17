use sqlx::PgPool;
use uuid::Uuid;
use crate::repositories::missions_repository::{MissionsRepository, Mission};
use crate::repositories::mission_charters_repository::MissionChartersRepository;
use crate::repositories::case_files_repository::CaseFilesRepository;
use crate::repositories::mission_state_projections_repository::MissionStateProjectionsRepository;
use crate::services::projection_service::ProjectionService;

pub struct MissionService {
    pub repo: MissionsRepository,
    pub charter_repo: MissionChartersRepository,
    pub case_file_repo: CaseFilesRepository,
    pub projection_repo: MissionStateProjectionsRepository,
    pub projection_service: ProjectionService,
}

impl MissionService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            repo: MissionsRepository::new(pool.clone()),
            charter_repo: MissionChartersRepository::new(pool.clone()),
            case_file_repo: CaseFilesRepository::new(pool.clone()),
            projection_repo: MissionStateProjectionsRepository::new(pool.clone()),
            projection_service: ProjectionService::new(pool),
        }
    }

    pub async fn create_mission(&self, title: String, intent: String) -> Result<Mission, String> {
        // 1. Create Mission core via repo
        let mission = self.repo.create(title.clone()).await?;
        let mission_id = mission.mission_id;

        // 2. Create Charter
        self.charter_repo.create(mission_id, intent).await?;

        // 3. Create Case File
        self.case_file_repo.create(mission_id, "Initial mission state.".to_string()).await?;

        // 4. Create Projection
        self.projection_repo.create(
            mission_id,
            "initialization".to_string(),
            "active".to_string(),
            "stable".to_string(),
            "normal".to_string(),
            title
        ).await?;

        Ok(mission)
    }

    pub async fn list_missions(&self) -> Result<Vec<Mission>, String> {
        self.repo.list().await
    }

    pub async fn get_mission(&self, mission_id: Uuid) -> Result<Mission, String> {
        self.repo.get(mission_id).await
    }

    pub async fn pause_mission(&self, mission_id: Uuid) -> Result<(), String> {
        self.repo.update_status(mission_id, "paused".to_string()).await?;
        self.projection_service.refresh_projection(mission_id).await
    }

    pub async fn resume_mission(&self, mission_id: Uuid) -> Result<(), String> {
        self.repo.update_status(mission_id, "active".to_string()).await?;
        self.projection_service.refresh_projection(mission_id).await
    }

    pub async fn refresh_mission_state(&self, mission_id: Uuid) -> Result<(), String> {
        // Potential logic for refreshing mission state from external sources or environment
        self.projection_service.refresh_projection(mission_id).await
    }
}

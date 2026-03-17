use sqlx::PgPool;
use uuid::Uuid;
pub use crate::repositories::missions_repository::Mission;
use crate::repositories::mission_state_projections_repository::MissionStateProjection;
use crate::services::mission_service::MissionService;
use crate::services::projection_service::ProjectionService;
use crate::services::contract_service::ContractService;
use crate::services::records_service::RecordsService;
use crate::services::resume_service::ResumeService;
use crate::repositories::contracts_repository::Contract;
use crate::repositories::decision_records_repository::DecisionRecord;
use crate::repositories::validation_records_repository::ValidationRecord;
use crate::repositories::artifacts_repository::Artifact;

pub struct MissionCoordinator {
    service: MissionService,
    projection_service: ProjectionService,
    contract_service: ContractService,
    records_service: RecordsService,
    resume_service: ResumeService,
}

impl MissionCoordinator {
    pub fn new(pool: PgPool) -> Self {
        Self { 
            service: MissionService::new(pool.clone()),
            projection_service: ProjectionService::new(pool.clone()),
            contract_service: ContractService::new(pool.clone()),
            records_service: RecordsService::new(pool.clone()),
            resume_service: ResumeService::new(pool),
        }
    }

    pub async fn create_mission(&self, title: String, intent: String) -> Result<Mission, String> {
        self.service.create_mission(title, intent).await
    }

    pub async fn list_missions(&self) -> Result<Vec<Mission>, String> {
        self.service.list_missions().await
    }

    pub async fn get_mission_detail(&self, mission_id: Uuid) -> Result<Mission, String> {
        self.service.get_mission(mission_id).await
    }

    pub async fn pause_mission(&self, mission_id: Uuid) -> Result<(), String> {
        self.service.pause_mission(mission_id).await?;
        self.projection_service.refresh_projection(mission_id).await?;
        Ok(())
    }

    pub async fn resume_mission(&self, mission_id: Uuid) -> Result<(), String> {
        self.service.resume_mission(mission_id).await?;
        self.projection_service.refresh_projection(mission_id).await?;
        Ok(())
    }

    pub async fn refresh_mission_state(&self, mission_id: Uuid) -> Result<(), String> {
        self.service.refresh_mission_state(mission_id).await?;
        self.projection_service.refresh_projection(mission_id).await?;
        Ok(())
    }

    pub async fn get_mission_projection(&self, mission_id: Uuid) -> Result<MissionStateProjection, String> {
        self.projection_service.get_projection(mission_id).await
    }

    pub async fn admit_contract(&self, mission_id: Uuid, contract_type: String, title: String) -> Result<Contract, String> {
        let contract = self.contract_service.admit_contract(mission_id, contract_type, title).await?;
        self.projection_service.refresh_projection(mission_id).await?;
        Ok(contract)
    }

    pub async fn record_decision(&self, mission_id: Uuid, decision_type: String, summary: String, outcome: Option<String>, responsibility: String) -> Result<DecisionRecord, String> {
        let record = self.records_service.record_decision(mission_id, decision_type, summary, outcome, responsibility).await?;
        self.projection_service.refresh_projection(mission_id).await?;
        Ok(record)
    }

    pub async fn record_validation(&self, mission_id: Uuid, scope: String, outcome: String, summary: Option<String>, responsibility: String) -> Result<ValidationRecord, String> {
        let record = self.records_service.record_validation(mission_id, scope, outcome, summary, responsibility).await?;
        self.projection_service.refresh_projection(mission_id).await?;
        Ok(record)
    }

    pub async fn create_artifact(&self, mission_id: Uuid, contract_id: Uuid, artifact_type: String, name: String) -> Result<Artifact, String> {
        let artifact = self.contract_service.create_artifact(mission_id, contract_id, artifact_type, name).await?;
        self.projection_service.refresh_projection(mission_id).await?;
        Ok(artifact)
    }
}

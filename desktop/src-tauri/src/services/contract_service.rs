use sqlx::PgPool;
use uuid::Uuid;
use crate::repositories::contracts_repository::{ContractsRepository, Contract};
use crate::repositories::artifacts_repository::{ArtifactsRepository, Artifact};

pub struct ContractService {
    pool: PgPool,
}

impl ContractService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn admit_contract(&self, mission_id: Uuid, contract_type: String, title: String) -> Result<Contract, String> {
        let repo = ContractsRepository::new(self.pool.clone());
        repo.create(mission_id, contract_type, title, None, None).await
    }

    pub async fn create_artifact(&self, mission_id: Uuid, contract_id: Uuid, artifact_type: String, name: String) -> Result<Artifact, String> {
        let repo = ArtifactsRepository::new(self.pool.clone());
        repo.create(mission_id, Some(contract_id), artifact_type, name, None, None).await
    }
}

use sqlx::PgPool;
use uuid::Uuid;
use crate::repositories::decision_records_repository::{DecisionRecordsRepository, DecisionRecord};
use crate::repositories::validation_records_repository::{ValidationRecordsRepository, ValidationRecord};
use crate::repositories::responsibility_ledger_repository::{ResponsibilityLedgerRepository, ResponsibilityLedgerEntry};

pub struct RecordsService {
    pool: PgPool,
}

impl RecordsService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn record_decision(
        &self, 
        mission_id: Uuid, 
        decision_type: String, 
        summary: String, 
        outcome: Option<String>, 
        responsibility: String
    ) -> Result<DecisionRecord, String> {
        let repo = DecisionRecordsRepository::new(self.pool.clone());
        repo.create(mission_id, decision_type, summary, outcome, Some(responsibility), None).await
    }

    pub async fn record_validation(
        &self, 
        mission_id: Uuid, 
        scope: String, 
        outcome: String, 
        summary: Option<String>, 
        responsibility: String
    ) -> Result<ValidationRecord, String> {
        let repo = ValidationRecordsRepository::new(self.pool.clone());
        repo.create(mission_id, scope, outcome, summary, Some(responsibility), None).await
    }

    pub async fn record_ledger_entry(
        &self, 
        mission_id: Uuid, 
        subject_type: String, 
        subject_id: Option<Uuid>, 
        responsibility: String, 
        description: String
    ) -> Result<ResponsibilityLedgerEntry, String> {
        let repo = ResponsibilityLedgerRepository::new(self.pool.clone());
        repo.create_entry(mission_id, subject_type, subject_id, responsibility, description).await
    }
}

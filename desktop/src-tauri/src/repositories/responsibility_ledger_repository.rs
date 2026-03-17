use sqlx::PgPool;
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct ResponsibilityLedgerEntry {
    pub entry_id: Uuid,
    pub mission_id: Uuid,
    pub subject_type: String,
    pub subject_id: Option<Uuid>,
    pub responsibility_tag: String,
    pub description: String,
    pub recorded_at: DateTime<Utc>,
}

pub struct ResponsibilityLedgerRepository {
    pool: PgPool,
}

impl ResponsibilityLedgerRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create_entry(
        &self,
        mission_id: Uuid,
        subject_type: String,
        subject_id: Option<Uuid>,
        responsibility_tag: String,
        description: String,
    ) -> Result<ResponsibilityLedgerEntry, String> {
        sqlx::query_as::<_, ResponsibilityLedgerEntry>(
            r#"
            INSERT INTO responsibility_ledger_entries (mission_id, subject_type, subject_id, responsibility_tag, description)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            "#
        )
        .bind(mission_id)
        .bind(subject_type)
        .bind(subject_id)
        .bind(responsibility_tag)
        .bind(description)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Failed to create responsibility ledger entry: {}", e))
    }
}

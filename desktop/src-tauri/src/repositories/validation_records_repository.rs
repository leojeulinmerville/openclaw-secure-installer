use sqlx::PgPool;
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct ValidationRecord {
    pub validation_id: Uuid,
    pub mission_id: Uuid,
    pub validation_scope: String,
    pub outcome: String,
    pub summary: Option<String>,
    pub responsibility_tag: Option<String>,
    pub evidence_links: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

pub struct ValidationRecordsRepository {
    pool: PgPool,
}

impl ValidationRecordsRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self,
        mission_id: Uuid,
        validation_scope: String,
        outcome: String,
        summary: Option<String>,
        responsibility_tag: Option<String>,
        evidence_links: Option<serde_json::Value>,
    ) -> Result<ValidationRecord, String> {
        sqlx::query_as::<_, ValidationRecord>(
            r#"
            INSERT INTO validation_records (mission_id, validation_scope, outcome, summary, responsibility_tag, evidence_links)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#
        )
        .bind(mission_id)
        .bind(validation_scope)
        .bind(outcome)
        .bind(summary)
        .bind(responsibility_tag)
        .bind(evidence_links)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Failed to create validation record: {}", e))
    }

    pub async fn list_latest_for_mission(&self, mission_id: Uuid, limit: i64) -> Result<Vec<ValidationRecord>, String> {
        sqlx::query_as::<_, ValidationRecord>(
            "SELECT * FROM validation_records WHERE mission_id = $1 ORDER BY created_at DESC LIMIT $2"
        )
        .bind(mission_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("Failed to list validation records: {}", e))
    }
}

use sqlx::PgPool;
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct DecisionRecord {
    pub decision_id: Uuid,
    pub mission_id: Uuid,
    pub decision_type: String,
    pub summary: String,
    pub outcome: Option<String>,
    pub responsibility_tag: Option<String>,
    pub rationale: Option<String>,
    pub created_at: DateTime<Utc>,
}

pub struct DecisionRecordsRepository {
    pool: PgPool,
}

impl DecisionRecordsRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self,
        mission_id: Uuid,
        decision_type: String,
        summary: String,
        outcome: Option<String>,
        responsibility_tag: Option<String>,
        rationale: Option<String>,
    ) -> Result<DecisionRecord, String> {
        sqlx::query_as::<_, DecisionRecord>(
            r#"
            INSERT INTO decision_records (mission_id, decision_type, summary, outcome, responsibility_tag, rationale)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#
        )
        .bind(mission_id)
        .bind(decision_type)
        .bind(summary)
        .bind(outcome)
        .bind(responsibility_tag)
        .bind(rationale)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Failed to create decision record: {}", e))
    }

    pub async fn list_latest_for_mission(&self, mission_id: Uuid, limit: i64) -> Result<Vec<DecisionRecord>, String> {
        sqlx::query_as::<_, DecisionRecord>(
            "SELECT * FROM decision_records WHERE mission_id = $1 ORDER BY created_at DESC LIMIT $2"
        )
        .bind(mission_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("Failed to list decision records: {}", e))
    }
}

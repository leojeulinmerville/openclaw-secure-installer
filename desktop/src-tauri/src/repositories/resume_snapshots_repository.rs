use sqlx::PgPool;
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct ResumeSnapshot {
    pub snapshot_id: Uuid,
    pub mission_id: Uuid,
    pub snapshot_summary: String,
    pub recommended_resume_mode: Option<String>,
    pub next_action_suggestion: Option<String>,
    pub state_blob: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

pub struct ResumeSnapshotsRepository {
    pool: PgPool,
}

impl ResumeSnapshotsRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self,
        mission_id: Uuid,
        snapshot_summary: String,
        recommended_resume_mode: Option<String>,
        next_action_suggestion: Option<String>,
        state_blob: Option<serde_json::Value>,
    ) -> Result<ResumeSnapshot, String> {
        sqlx::query_as::<_, ResumeSnapshot>(
            r#"
            INSERT INTO resume_snapshots (mission_id, snapshot_summary, recommended_resume_mode, next_action_suggestion, state_blob)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            "#
        )
        .bind(mission_id)
        .bind(snapshot_summary)
        .bind(recommended_resume_mode)
        .bind(next_action_suggestion)
        .bind(state_blob)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Failed to create resume snapshot: {}", e))
    }

    pub async fn get_latest(&self, mission_id: Uuid) -> Result<ResumeSnapshot, String> {
        sqlx::query_as::<_, ResumeSnapshot>(
            "SELECT * FROM resume_snapshots WHERE mission_id = $1 ORDER BY created_at DESC LIMIT 1"
        )
        .bind(mission_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Failed to get latest resume snapshot: {}", e))
    }
}

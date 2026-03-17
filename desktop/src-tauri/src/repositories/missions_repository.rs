use sqlx::PgPool;
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Mission {
    pub mission_id: Uuid,
    pub title: String,
    pub status: String,
    pub mission_mode: String,
    pub current_phase: Option<String>,
    pub health_state: String,
    pub governance_state: String,
    pub resume_readiness: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_resume_at: Option<DateTime<Utc>>,
    pub summary_current: Option<String>,
    pub risk_level_initial: Option<String>,
    pub risk_level_current: Option<String>,
}

pub struct MissionsRepository {
    pool: PgPool,
}

impl MissionsRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, title: String) -> Result<Mission, String> {
        let mission_id = Uuid::new_v4();
        
        sqlx::query_as::<_, Mission>(
            r#"
            INSERT INTO missions (mission_id, title, status, mission_mode)
            VALUES ($1, $2, 'active', 'autonomous')
            RETURNING *
            "#
        )
        .bind(mission_id)
        .bind(title)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Failed to create mission in repo: {}", e))
    }

    pub async fn list(&self) -> Result<Vec<Mission>, String> {
        sqlx::query_as::<_, Mission>(
            "SELECT * FROM missions ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("Failed to list missions in repo: {}", e))
    }

    pub async fn get(&self, mission_id: Uuid) -> Result<Mission, String> {
        sqlx::query_as::<_, Mission>(
            "SELECT * FROM missions WHERE mission_id = $1"
        )
        .bind(mission_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Failed to get mission in repo: {}", e))
    }

    pub async fn update_status(&self, mission_id: Uuid, status: String) -> Result<(), String> {
        sqlx::query(
            "UPDATE missions SET status = $1, updated_at = NOW() WHERE mission_id = $2"
        )
        .bind(status)
        .bind(mission_id)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("Failed to update mission status in repo: {}", e))?;
        
        Ok(())
    }
}

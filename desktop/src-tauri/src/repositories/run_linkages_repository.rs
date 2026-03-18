use sqlx::PgPool;
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct RunLinkage {
    pub run_id: String,
    pub mission_id: Uuid,
    pub contract_id: Uuid,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct RunLinkagesRepository {
    pool: PgPool,
}

impl RunLinkagesRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self,
        run_id: String,
        mission_id: Uuid,
        contract_id: Uuid,
    ) -> Result<RunLinkage, String> {
        sqlx::query_as::<_, RunLinkage>(
            r#"
            INSERT INTO run_linkages (run_id, mission_id, contract_id)
            VALUES ($1, $2, $3)
            RETURNING *
            "#
        )
        .bind(run_id)
        .bind(mission_id)
        .bind(contract_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Failed to create run linkage: {}", e))
    }

    pub async fn get_by_run_id(&self, run_id: &str) -> Result<RunLinkage, String> {
        sqlx::query_as::<_, RunLinkage>(
            "SELECT * FROM run_linkages WHERE run_id = $1"
        )
        .bind(run_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Failed to get run linkage: {}", e))
    }

    pub async fn update_status(&self, run_id: &str, status: String) -> Result<(), String> {
        sqlx::query(
            "UPDATE run_linkages SET status = $1, updated_at = NOW() WHERE run_id = $2"
        )
        .bind(status)
        .bind(run_id)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("Failed to update run linkage status: {}", e))?;
        
        Ok(())
    }

    pub async fn list_for_mission(&self, mission_id: Uuid) -> Result<Vec<RunLinkage>, String> {
        sqlx::query_as::<_, RunLinkage>(
            "SELECT * FROM run_linkages WHERE mission_id = $1 ORDER BY created_at DESC"
        )
        .bind(mission_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("Failed to list run linkages for mission: {}", e))
    }
}

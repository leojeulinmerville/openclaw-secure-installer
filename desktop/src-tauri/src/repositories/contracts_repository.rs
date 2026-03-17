use sqlx::PgPool;
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Contract {
    pub contract_id: Uuid,
    pub mission_id: Uuid,
    pub contract_type: String,
    pub title: String,
    pub status: String,
    pub health_state: String,
    pub governance_state: String,
    pub assigned_role: Option<String>,
    pub spec_raw: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct ContractsRepository {
    pool: PgPool,
}

impl ContractsRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self,
        mission_id: Uuid,
        contract_type: String,
        title: String,
        assigned_role: Option<String>,
        spec_raw: Option<String>,
    ) -> Result<Contract, String> {
        sqlx::query_as::<_, Contract>(
            r#"
            INSERT INTO contracts (mission_id, contract_type, title, assigned_role, spec_raw)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            "#
        )
        .bind(mission_id)
        .bind(contract_type)
        .bind(title)
        .bind(assigned_role)
        .bind(spec_raw)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Failed to create contract: {}", e))
    }

    pub async fn list(&self, mission_id: Uuid) -> Result<Vec<Contract>, String> {
        sqlx::query_as::<_, Contract>(
            "SELECT * FROM contracts WHERE mission_id = $1 ORDER BY created_at DESC"
        )
        .bind(mission_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("Failed to list contracts: {}", e))
    }

    pub async fn get(&self, contract_id: Uuid) -> Result<Contract, String> {
        sqlx::query_as::<_, Contract>(
            "SELECT * FROM contracts WHERE contract_id = $1"
        )
        .bind(contract_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Failed to get contract: {}", e))
    }

    pub async fn update_status(&self, contract_id: Uuid, status: String) -> Result<(), String> {
        sqlx::query(
            "UPDATE contracts SET status = $1, updated_at = NOW() WHERE contract_id = $2"
        )
        .bind(status)
        .bind(contract_id)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("Failed to update contract status: {}", e))?;
        
        Ok(())
    }

    pub async fn count_active(&self, mission_id: Uuid) -> Result<i64, String> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM contracts WHERE mission_id = $1 AND status = 'active'"
        )
        .bind(mission_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Failed to count active contracts: {}", e))?;
        
        Ok(row.0)
    }
}

use sqlx::PgPool;
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Artifact {
    pub artifact_id: Uuid,
    pub mission_id: Uuid,
    pub origin_contract_id: Option<Uuid>,
    pub artifact_type: String,
    pub name: String,
    pub status: String,
    pub promotion_state: String,
    pub storage_path: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct ArtifactsRepository {
    pool: PgPool,
}

impl ArtifactsRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self,
        mission_id: Uuid,
        origin_contract_id: Option<Uuid>,
        artifact_type: String,
        name: String,
        storage_path: Option<String>,
        metadata: Option<serde_json::Value>,
    ) -> Result<Artifact, String> {
        sqlx::query_as::<_, Artifact>(
            r#"
            INSERT INTO artifacts (mission_id, origin_contract_id, artifact_type, name, storage_path, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#
        )
        .bind(mission_id)
        .bind(origin_contract_id)
        .bind(artifact_type)
        .bind(name)
        .bind(storage_path)
        .bind(metadata)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Failed to create artifact: {}", e))
    }

    pub async fn upsert_artifact(
        &self,
        mission_id: Uuid,
        origin_contract_id: Option<Uuid>,
        artifact_type: String,
        name: String,
        storage_path: Option<String>,
        metadata: Option<serde_json::Value>,
    ) -> Result<Artifact, String> {
        let existing = sqlx::query_as::<_, Artifact>(
            "SELECT * FROM artifacts WHERE mission_id = $1 AND name = $2"
        )
        .bind(mission_id)
        .bind(&name)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| format!("Failed to check for existing artifact: {}", e))?;

        if let Some(artifact) = existing {
            sqlx::query_as::<_, Artifact>(
                r#"
                UPDATE artifacts
                SET storage_path = $1, metadata = $2, updated_at = NOW()
                WHERE artifact_id = $3
                RETURNING *
                "#
            )
            .bind(storage_path)
            .bind(metadata)
            .bind(artifact.artifact_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| format!("Failed to update artifact: {}", e))
        } else {
            self.create(
                mission_id,
                origin_contract_id,
                artifact_type,
                name,
                storage_path,
                metadata,
            )
            .await
        }
    }

    pub async fn list_for_mission(&self, mission_id: Uuid) -> Result<Vec<Artifact>, String> {
        sqlx::query_as::<_, Artifact>(
            "SELECT * FROM artifacts WHERE mission_id = $1 ORDER BY created_at DESC"
        )
        .bind(mission_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| format!("Failed to list artifacts for mission: {}", e))
    }

    pub async fn get(&self, artifact_id: Uuid) -> Result<Artifact, String> {
        sqlx::query_as::<_, Artifact>(
            "SELECT * FROM artifacts WHERE artifact_id = $1"
        )
        .bind(artifact_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Failed to get artifact: {}", e))
    }
}

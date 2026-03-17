use sqlx::PgPool;
use uuid::Uuid;

pub struct CaseFilesRepository {
    pool: PgPool,
}

impl CaseFilesRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, mission_id: Uuid, summary: String) -> Result<(), String> {
        sqlx::query(
            r#"
            INSERT INTO case_files (mission_id, summary)
            VALUES ($1, $2)
            "#
        )
        .bind(mission_id)
        .bind(summary)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("Failed to create case file: {}", e))?;
        
        Ok(())
    }
}

use sqlx::PgPool;
use uuid::Uuid;

pub struct MissionChartersRepository {
    pool: PgPool,
}

impl MissionChartersRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, mission_id: Uuid, intent: String) -> Result<(), String> {
        sqlx::query(
            r#"
            INSERT INTO mission_charters (mission_id, intent_raw)
            VALUES ($1, $2)
            "#
        )
        .bind(mission_id)
        .bind(intent)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("Failed to create mission charter: {}", e))?;
        
        Ok(())
    }
}

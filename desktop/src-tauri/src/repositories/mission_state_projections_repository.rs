use sqlx::PgPool;
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct MissionStateProjection {
    pub projection_id: Uuid,
    pub mission_id: Uuid,
    pub title: Option<String>,
    pub phase: Option<String>,
    pub status: Option<String>,
    pub mode: Option<String>,
    pub health: Option<String>,
    pub health_state: Option<String>,
    pub governance: Option<String>,
    pub governance_state: Option<String>,
    pub focus: Option<String>,
    pub blocker_risk: Option<String>,
    pub top_blocker: Option<String>,
    pub top_risk: Option<String>,
    pub reference_path: Option<String>,
    pub resume_readiness: bool,
    pub active_contract_count: i32,
    pub last_decision_summary: Option<String>,
    pub last_validation_summary: Option<String>,
    pub needs_human_attention: bool,
    pub updated_at: DateTime<Utc>,
}

pub struct MissionStateProjectionsRepository {
    pool: PgPool,
}

impl MissionStateProjectionsRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self, 
        mission_id: Uuid, 
        phase: String, 
        status: String, 
        health: String, 
        governance: String, 
        focus: String
    ) -> Result<(), String> {
        sqlx::query(
            r#"
            INSERT INTO mission_state_projections (mission_id, phase, status, health, governance, focus)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#
        )
        .bind(mission_id)
        .bind(phase)
        .bind(status)
        .bind(health)
        .bind(governance)
        .bind(focus)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("Failed to create projection: {}", e))?;
        
        Ok(())
    }

    pub async fn upsert(
        &self,
        mission_id: Uuid,
        title: Option<String>,
        phase: Option<String>,
        status: Option<String>,
        mode: Option<String>,
        health: Option<String>,
        health_state: Option<String>,
        governance: Option<String>,
        governance_state: Option<String>,
        focus: Option<String>,
        blocker_risk: Option<String>,
        top_blocker: Option<String>,
        top_risk: Option<String>,
        reference_path: Option<String>,
        resume_readiness: bool,
        active_contract_count: i32,
        last_decision_summary: Option<String>,
        last_validation_summary: Option<String>,
        needs_human_attention: bool,
    ) -> Result<(), String> {
        sqlx::query(
            r#"
            INSERT INTO mission_state_projections (
                mission_id, title, phase, status, mode, health, health_state, 
                governance, governance_state, focus, blocker_risk, top_blocker, 
                top_risk, reference_path, resume_readiness, active_contract_count, 
                last_decision_summary, last_validation_summary, needs_human_attention, 
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
            ON CONFLICT (mission_id) DO UPDATE SET
                title = EXCLUDED.title,
                phase = EXCLUDED.phase,
                status = EXCLUDED.status,
                mode = EXCLUDED.mode,
                health = EXCLUDED.health,
                health_state = EXCLUDED.health_state,
                governance = EXCLUDED.governance,
                governance_state = EXCLUDED.governance_state,
                focus = EXCLUDED.focus,
                blocker_risk = EXCLUDED.blocker_risk,
                top_blocker = EXCLUDED.top_blocker,
                top_risk = EXCLUDED.top_risk,
                reference_path = EXCLUDED.reference_path,
                resume_readiness = EXCLUDED.resume_readiness,
                active_contract_count = EXCLUDED.active_contract_count,
                last_decision_summary = EXCLUDED.last_decision_summary,
                last_validation_summary = EXCLUDED.last_validation_summary,
                needs_human_attention = EXCLUDED.needs_human_attention,
                updated_at = NOW()
            "#
        )
        .bind(mission_id)
        .bind(title)
        .bind(phase)
        .bind(status)
        .bind(mode)
        .bind(health)
        .bind(health_state)
        .bind(governance)
        .bind(governance_state)
        .bind(focus)
        .bind(blocker_risk)
        .bind(top_blocker)
        .bind(top_risk)
        .bind(reference_path)
        .bind(resume_readiness)
        .bind(active_contract_count)
        .bind(last_decision_summary)
        .bind(last_validation_summary)
        .bind(needs_human_attention)
        .execute(&self.pool)
        .await
        .map_err(|e| format!("Failed to upsert projection: {}", e))?;

        Ok(())
    }

    pub async fn get(&self, mission_id: Uuid) -> Result<MissionStateProjection, String> {
        sqlx::query_as::<_, MissionStateProjection>(
            "SELECT * FROM mission_state_projections WHERE mission_id = $1"
        )
        .bind(mission_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Failed to get projection: {}", e))
    }
}

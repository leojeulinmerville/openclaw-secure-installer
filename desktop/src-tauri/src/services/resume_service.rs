use sqlx::PgPool;
use uuid::Uuid;
use crate::repositories::resume_snapshots_repository::{ResumeSnapshotsRepository, ResumeSnapshot};

pub struct ResumeService {
    pool: PgPool,
}

impl ResumeService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create_resume_snapshot(
        &self, 
        mission_id: Uuid, 
        summary: String, 
        recommended_mode: Option<String>, 
        next_action: Option<String>
    ) -> Result<ResumeSnapshot, String> {
        let repo = ResumeSnapshotsRepository::new(self.pool.clone());
        repo.create(mission_id, summary, recommended_mode, next_action, None).await
    }

    pub async fn get_latest_resume_snapshot(&self, mission_id: Uuid) -> Result<ResumeSnapshot, String> {
        let repo = ResumeSnapshotsRepository::new(self.pool.clone());
        repo.get_latest(mission_id).await
    }
}

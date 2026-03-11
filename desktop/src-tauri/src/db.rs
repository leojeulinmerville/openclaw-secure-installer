use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::time::Duration;

pub struct DbState {
    pub pool: PgPool,
}

pub async fn init_db(url: &str) -> Result<PgPool, String> {
    println!("Connecting to PostgreSQL at {}...", url);
    
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(10))
        .connect(url)
        .await
        .map_err(|e| format!("Failed to connect to PostgreSQL: {}", e))?;

    println!("Connected to PostgreSQL.");
    
    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|e| format!("Failed to run migrations: {}", e))?;
        
    println!("Database migrations completed.");
    
    Ok(pool)
}

pub async fn check_health(pool: &PgPool) -> bool {
    sqlx::query("SELECT 1").execute(pool).await.is_ok()
}

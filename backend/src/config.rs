use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_expiration: u64,
    pub host: String,
    pub port: u16,
    pub aws_region: Option<String>,
    pub s3_bucket_name: Option<String>,
    pub stripe_secret_key: Option<String>,
    pub stripe_webhook_secret: Option<String>,
    pub redis_url: Option<String>,
    pub argon2_memory_cost: u32,
    pub argon2_time_cost: u32,
    pub argon2_parallelism: u32,
}

impl Config {
    pub fn from_env() -> Result<Self, std::env::VarError> {
        dotenvy::dotenv().ok();
        
        Ok(Config {
            database_url: std::env::var("DATABASE_URL")?,
            jwt_secret: std::env::var("JWT_SECRET")?,
            jwt_expiration: std::env::var("JWT_EXPIRATION")
                .unwrap_or_else(|_| "3600".to_string())
                .parse()
                .unwrap_or(3600),
            host: std::env::var("HOST")
                .unwrap_or_else(|_| "127.0.0.1".to_string()),
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "8000".to_string())
                .parse()
                .unwrap_or(8000),
            aws_region: std::env::var("AWS_REGION").ok(),
            s3_bucket_name: std::env::var("S3_BUCKET_NAME").ok(),
            stripe_secret_key: std::env::var("STRIPE_SECRET_KEY").ok(),
            stripe_webhook_secret: std::env::var("STRIPE_WEBHOOK_SECRET").ok(),
            redis_url: std::env::var("REDIS_URL").ok(),
            argon2_memory_cost: std::env::var("ARGON2_MEMORY_COST")
                .unwrap_or_else(|_| "65536".to_string())
                .parse()
                .unwrap_or(65536),
            argon2_time_cost: std::env::var("ARGON2_TIME_COST")
                .unwrap_or_else(|_| "3".to_string())
                .parse()
                .unwrap_or(3),
            argon2_parallelism: std::env::var("ARGON2_PARALLELISM")
                .unwrap_or_else(|_| "4".to_string())
                .parse()
                .unwrap_or(4),
        })
    }
}
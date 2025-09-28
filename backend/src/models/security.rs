use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::net::IpAddr;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct SecurityEvent {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub event_type: String,
    pub ip_address: Option<IpAddr>,
    pub user_agent: Option<String>,
    pub details: Option<serde_json::Value>,
    pub risk_level: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct DestructionLog {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub trigger_type: String,
    pub data_types_destroyed: Vec<String>,
    pub execution_time: DateTime<Utc>,
    pub success: bool,
    pub forensic_residue_level: i32,
    pub details: Option<serde_json::Value>,
}
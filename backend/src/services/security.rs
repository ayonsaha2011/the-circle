use crate::models::{SecurityEvent, DestructionLog};
use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::PgPool;
use std::net::IpAddr;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct SecurityService {
    db: PgPool,
}

#[derive(Debug)]
pub enum SecurityError {
    DatabaseError(sqlx::Error),
    DestructionFailed,
}

impl From<sqlx::Error> for SecurityError {
    fn from(err: sqlx::Error) -> Self {
        SecurityError::DatabaseError(err)
    }
}

impl SecurityService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub async fn log_security_event(
        &self,
        user_id: Option<Uuid>,
        event_type: String,
        ip_address: Option<IpAddr>,
        user_agent: Option<String>,
        details: Option<Value>,
    ) {
        let risk_level = self.calculate_risk_level(&event_type, &ip_address);
        
        let _ = sqlx::query!(
            r#"
            INSERT INTO security_events (user_id, event_type, ip_address, user_agent, details, risk_level)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
            user_id,
            event_type,
            ip_address,
            user_agent,
            details,
            risk_level
        )
        .execute(&self.db)
        .await;

        // Log to tracing for immediate visibility
        match risk_level {
            1..=3 => tracing::info!("Security event: {} for user {:?}", event_type, user_id),
            4..=6 => tracing::warn!("Medium risk security event: {} for user {:?}", event_type, user_id),
            7..=10 => tracing::error!("High risk security event: {} for user {:?}", event_type, user_id),
            _ => {},
        }
    }

    pub async fn trigger_destruction(&self, user_id: Uuid, trigger_type: String) -> Result<(), SecurityError> {
        // Begin transaction for atomic destruction
        let mut tx = self.db.begin().await?;

        // Log destruction event
        let data_types = vec!["user_data".to_string(), "sessions".to_string(), "files".to_string()];
        
        sqlx::query!(
            r#"
            INSERT INTO destruction_logs (user_id, trigger_type, data_types_destroyed, success)
            VALUES ($1, $2, $3, $4)
            "#,
            user_id,
            trigger_type,
            &data_types,
            true
        )
        .execute(&mut *tx)
        .await?;

        // Delete user sessions
        sqlx::query!("DELETE FROM user_sessions WHERE user_id = $1", user_id)
            .execute(&mut *tx)
            .await?;

        // Delete security events
        sqlx::query!("DELETE FROM security_events WHERE user_id = $1", user_id)
            .execute(&mut *tx)
            .await?;

        // Delete user subscriptions
        sqlx::query!("DELETE FROM subscriptions WHERE user_id = $1", user_id)
            .execute(&mut *tx)
            .await?;

        // Finally delete user
        sqlx::query!("DELETE FROM users WHERE id = $1", user_id)
            .execute(&mut *tx)
            .await?;

        // Commit transaction
        tx.commit().await?;

        tracing::warn!("User {} destroyed due to trigger: {}", user_id, trigger_type);

        Ok(())
    }

    fn calculate_risk_level(&self, event_type: &str, _ip_address: &Option<IpAddr>) -> i32 {
        match event_type {
            "login_failed" => 3,
            "login_success" => 1,
            "user_registered" => 2,
            "password_reset" => 4,
            "destruction_triggered" => 10,
            "suspicious_activity" => 7,
            "multiple_failed_logins" => 6,
            "account_locked" => 5,
            _ => 1,
        }
    }
}
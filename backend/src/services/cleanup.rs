use crate::services::SecurityService;
use chrono::Utc;
use sqlx::PgPool;
use std::time::Duration;
use tokio::time::interval;
use tracing::{error, info, warn};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct CleanupService {
    db: PgPool,
    security_service: SecurityService,
}

#[derive(Debug)]
pub enum CleanupError {
    DatabaseError(sqlx::Error),
    InvalidConfiguration,
}

impl std::fmt::Display for CleanupError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CleanupError::DatabaseError(e) => write!(f, "Database error: {}", e),
            CleanupError::InvalidConfiguration => write!(f, "Invalid cleanup configuration"),
        }
    }
}

impl std::error::Error for CleanupError {}

impl From<sqlx::Error> for CleanupError {
    fn from(err: sqlx::Error) -> Self {
        CleanupError::DatabaseError(err)
    }
}

impl CleanupService {
    pub fn new(db: PgPool, security_service: SecurityService) -> Self {
        Self {
            db,
            security_service,
        }
    }

    /// Start the background cleanup task
    pub async fn start_cleanup_task(self) {
        let mut interval = interval(Duration::from_secs(300)); // Run every 5 minutes

        loop {
            interval.tick().await;
            
            if let Err(e) = self.run_cleanup_cycle().await {
                error!("Cleanup cycle failed: {}", e);
            }
        }
    }

    /// Run a complete cleanup cycle
    async fn run_cleanup_cycle(&self) -> Result<(), CleanupError> {
        info!("🧹 Starting cleanup cycle");

        // Clean expired messages
        let expired_messages = self.cleanup_expired_messages().await?;
        
        // Clean expired files
        let expired_files = self.cleanup_expired_files().await?;
        
        // Clean old activity logs (keep last 30 days)
        let old_logs = self.cleanup_old_activity_logs().await?;
        
        // Clean orphaned read receipts
        let orphaned_receipts = self.cleanup_orphaned_read_receipts().await?;

        // Clean up temporary upload tokens
        let expired_tokens = self.cleanup_expired_upload_tokens().await?;

        info!(
            "✅ Cleanup cycle completed: {} messages, {} files, {} logs, {} receipts, {} tokens removed",
            expired_messages, expired_files, old_logs, orphaned_receipts, expired_tokens
        );

        Ok(())
    }

    /// Clean up expired messages
    async fn cleanup_expired_messages(&self) -> Result<i64, CleanupError> {
        let result = sqlx::query!(
            r#"
            DELETE FROM messages 
            WHERE expires_at IS NOT NULL AND expires_at < NOW()
            "#
        )
        .execute(&self.db)
        .await?;

        let deleted_count = result.rows_affected() as i64;
        
        if deleted_count > 0 {
            warn!("🗑️ Deleted {} expired messages", deleted_count);
            
            // Log the cleanup activity
            self.security_service.log_security_event(
                None,
                "messages_auto_deleted".to_string(),
                None,
                None,
                Some(serde_json::json!({
                    "deleted_count": deleted_count,
                    "reason": "expiration"
                })),
            ).await;
        }

        Ok(deleted_count)
    }

    /// Clean up expired files
    async fn cleanup_expired_files(&self) -> Result<i64, CleanupError> {
        // Get expired files first (to potentially delete from S3)
        let expired_files = sqlx::query!(
            r#"
            SELECT id, file_path FROM files 
            WHERE expires_at IS NOT NULL AND expires_at < NOW()
            "#
        )
        .fetch_all(&self.db)
        .await?;

        if expired_files.is_empty() {
            return Ok(0);
        }

        // Delete from database
        let result = sqlx::query!(
            r#"
            DELETE FROM files 
            WHERE expires_at IS NOT NULL AND expires_at < NOW()
            "#
        )
        .execute(&self.db)
        .await?;

        let deleted_count = result.rows_affected() as i64;
        
        warn!("🗑️ Deleted {} expired files from database", deleted_count);

        // TODO: Implement S3 deletion for expired_files
        // This would require AWS SDK integration
        
        // Log the cleanup activity
        self.security_service.log_security_event(
            None,
            "files_auto_deleted".to_string(),
            None,
            None,
            Some(serde_json::json!({
                "deleted_count": deleted_count,
                "reason": "expiration"
            })),
        ).await;

        Ok(deleted_count)
    }

    /// Clean up old activity logs (keep last 30 days)
    async fn cleanup_old_activity_logs(&self) -> Result<i64, CleanupError> {
        let result = sqlx::query!(
            r#"
            DELETE FROM activity_logs 
            WHERE created_at < NOW() - INTERVAL '30 days'
            "#
        )
        .execute(&self.db)
        .await?;

        let deleted_count = result.rows_affected() as i64;
        
        if deleted_count > 0 {
            info!("🗑️ Deleted {} old activity logs", deleted_count);
        }

        Ok(deleted_count)
    }

    /// Clean up orphaned read receipts (messages that no longer exist)
    async fn cleanup_orphaned_read_receipts(&self) -> Result<i64, CleanupError> {
        let result = sqlx::query!(
            r#"
            DELETE FROM message_reads 
            WHERE message_id NOT IN (SELECT id FROM messages)
            "#
        )
        .execute(&self.db)
        .await?;

        let deleted_count = result.rows_affected() as i64;
        
        if deleted_count > 0 {
            info!("🗑️ Deleted {} orphaned read receipts", deleted_count);
        }

        Ok(deleted_count)
    }

    /// Clean up expired upload tokens
    async fn cleanup_expired_upload_tokens(&self) -> Result<i64, CleanupError> {
        // This assumes we have an upload_tokens table for temporary file uploads
        let result = sqlx::query!(
            r#"
            DELETE FROM upload_tokens 
            WHERE expires_at < NOW()
            "#
        )
        .execute(&self.db)
        .await
        .unwrap_or_else(|_| sqlx::postgres::PgQueryResult::default()); // Ignore if table doesn't exist

        let deleted_count = result.rows_affected() as i64;
        
        if deleted_count > 0 {
            info!("🗑️ Deleted {} expired upload tokens", deleted_count);
        }

        Ok(deleted_count)
    }

    /// Force delete all messages in a conversation (for destruction protocol)
    pub async fn force_delete_conversation_messages(&self, conversation_id: Uuid, user_id: Option<Uuid>) -> Result<i64, CleanupError> {
        let result = sqlx::query!(
            "DELETE FROM messages WHERE conversation_id = $1",
            conversation_id
        )
        .execute(&self.db)
        .await?;

        let deleted_count = result.rows_affected() as i64;
        
        // Log the forced deletion
        self.security_service.log_security_event(
            user_id,
            "conversation_messages_force_deleted".to_string(),
            None,
            None,
            Some(serde_json::json!({
                "conversation_id": conversation_id,
                "deleted_count": deleted_count,
                "reason": "destruction_protocol"
            })),
        ).await;

        Ok(deleted_count)
    }

    /// Set message expiration dynamically
    pub async fn set_message_expiration(&self, message_id: Uuid, expires_in_minutes: i32) -> Result<(), CleanupError> {
        let expires_at = Utc::now() + chrono::Duration::minutes(expires_in_minutes as i64);
        
        sqlx::query!(
            "UPDATE messages SET expires_at = $1 WHERE id = $2",
            expires_at,
            message_id
        )
        .execute(&self.db)
        .await?;

        Ok(())
    }

    /// Get cleanup statistics
    pub async fn get_cleanup_stats(&self) -> Result<serde_json::Value, CleanupError> {
        let message_stats = sqlx::query!(
            r#"
            SELECT 
                COUNT(*) as total_messages,
                COUNT(expires_at) as expiring_messages,
                COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired_messages
            FROM messages
            "#
        )
        .fetch_one(&self.db)
        .await?;

        let file_stats = sqlx::query!(
            r#"
            SELECT 
                COUNT(*) as total_files,
                COUNT(expires_at) as expiring_files,
                COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired_files
            FROM files
            "#
        )
        .fetch_one(&self.db)
        .await?;

        let log_stats = sqlx::query!(
            r#"
            SELECT 
                COUNT(*) as total_logs,
                COUNT(CASE WHEN created_at < NOW() - INTERVAL '30 days' THEN 1 END) as old_logs
            FROM activity_logs
            "#
        )
        .fetch_one(&self.db)
        .await?;

        Ok(serde_json::json!({
            "messages": {
                "total": message_stats.total_messages,
                "expiring": message_stats.expiring_messages,
                "expired": message_stats.expired_messages
            },
            "files": {
                "total": file_stats.total_files,
                "expiring": file_stats.expiring_files,
                "expired": file_stats.expired_files
            },
            "logs": {
                "total": log_stats.total_logs,
                "old": log_stats.old_logs
            }
        }))
    }
}
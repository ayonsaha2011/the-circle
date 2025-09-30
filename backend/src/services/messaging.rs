use crate::models::{
    Conversation, ConversationParticipant, Message, MessagePublic,
    CreateConversationRequest, SendMessageRequest
};
use crate::services::{EncryptionService, SecurityService};
use chrono::{DateTime, Duration, Utc};
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct MessagingService {
    db: PgPool,
    encryption_service: EncryptionService,
    security_service: SecurityService,
}

#[derive(Debug)]
pub enum MessagingError {
    DatabaseError(sqlx::Error),
    EncryptionError(crate::services::EncryptionError),
    Unauthorized,
    ConversationNotFound,
    MessageNotFound,
    InvalidRequest,
    UserNotInConversation,
}

impl std::fmt::Display for MessagingError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MessagingError::DatabaseError(e) => write!(f, "Database error: {}", e),
            MessagingError::EncryptionError(e) => write!(f, "Encryption error: {}", e),
            MessagingError::Unauthorized => write!(f, "Unauthorized access"),
            MessagingError::ConversationNotFound => write!(f, "Conversation not found"),
            MessagingError::MessageNotFound => write!(f, "Message not found"),
            MessagingError::InvalidRequest => write!(f, "Invalid request"),
            MessagingError::UserNotInConversation => write!(f, "User is not in this conversation"),
        }
    }
}

impl std::error::Error for MessagingError {}

impl From<sqlx::Error> for MessagingError {
    fn from(err: sqlx::Error) -> Self {
        MessagingError::DatabaseError(err)
    }
}

impl From<crate::services::EncryptionError> for MessagingError {
    fn from(err: crate::services::EncryptionError) -> Self {
        MessagingError::EncryptionError(err)
    }
}

impl MessagingService {
    pub fn new(db: PgPool, encryption_service: EncryptionService, security_service: SecurityService) -> Self {
        Self {
            db,
            encryption_service,
            security_service,
        }
    }

    /// Get a reference to the database pool
    pub fn db(&self) -> &PgPool {
        &self.db
    }

    /// Create a new conversation
    pub async fn create_conversation(
        &self,
        creator_id: Uuid,
        request: CreateConversationRequest,
    ) -> Result<Conversation, MessagingError> {
        // Generate conversation encryption key
        let master_key = self.encryption_service.generate_key()?;
        let conversation_id = Uuid::new_v4();
        let conversation_key = self.encryption_service.derive_conversation_key(&master_key, &conversation_id)?;
        let key_hash = self.encryption_service.hash_conversation_key(&conversation_key);

        let mut tx = self.db.begin().await?;

        // Create conversation
        let conversation = sqlx::query_as!(
            Conversation,
            r#"
            INSERT INTO conversations (id, name, type, creator_id, encryption_key_hash, settings)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
            conversation_id,
            request.name,
            request.r#type,
            creator_id,
            key_hash,
            request.settings.unwrap_or_else(|| serde_json::json!({}))
        )
        .fetch_one(&mut *tx)
        .await?;

        // Add creator as admin
        sqlx::query!(
            r#"
            INSERT INTO conversation_participants (conversation_id, user_id, role)
            VALUES ($1, $2, 'admin')
            "#,
            conversation_id,
            creator_id
        )
        .execute(&mut *tx)
        .await?;

        // Add other participants
        for participant_id in &request.participant_ids {
            if *participant_id != creator_id {
                sqlx::query!(
                    r#"
                    INSERT INTO conversation_participants (conversation_id, user_id, role)
                    VALUES ($1, $2, 'member')
                    "#,
                    conversation_id,
                    participant_id
                )
                .execute(&mut *tx)
                .await?;
            }
        }

        tx.commit().await?;

        // Log activity
        self.security_service.log_security_event(
            Some(creator_id),
            "conversation_created".to_string(),
            None,
            None,
            Some(serde_json::json!({
                "conversation_id": conversation_id,
                "type": request.r#type,
                "participant_count": request.participant_ids.len() + 1
            })),
        ).await;

        Ok(conversation)
    }

    /// Send a message to a conversation
    pub async fn send_message(
        &self,
        sender_id: Uuid,
        request: SendMessageRequest,
    ) -> Result<Message, MessagingError> {
        // Verify user is in conversation
        if !self.is_user_in_conversation(sender_id, request.conversation_id).await? {
            return Err(MessagingError::UserNotInConversation);
        }

        let message_id = Uuid::new_v4();
        let expires_at = request.expires_in_minutes.map(|minutes| {
            Utc::now() + Duration::minutes(minutes as i64)
        });

        // Insert message
        let message = sqlx::query_as!(
            Message,
            r#"
            INSERT INTO messages (
                id, conversation_id, sender_id, content_encrypted, 
                message_type, metadata_encrypted, reply_to_id, expires_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
            message_id,
            request.conversation_id,
            sender_id,
            request.content_encrypted,
            request.message_type,
            request.metadata_encrypted,
            request.reply_to_id,
            expires_at
        )
        .fetch_one(&self.db)
        .await?;

        // Update conversation last activity
        sqlx::query!(
            "UPDATE conversations SET updated_at = NOW() WHERE id = $1",
            request.conversation_id
        )
        .execute(&self.db)
        .await?;

        // Log activity
        self.security_service.log_security_event(
            Some(sender_id),
            "message_sent".to_string(),
            None,
            None,
            Some(serde_json::json!({
                "conversation_id": request.conversation_id,
                "message_id": message_id,
                "message_type": request.message_type
            })),
        ).await;

        Ok(message)
    }

    /// Get messages from a conversation with pagination
    pub async fn get_messages(
        &self,
        user_id: Uuid,
        conversation_id: Uuid,
        limit: Option<i64>,
        before_id: Option<Uuid>,
    ) -> Result<Vec<MessagePublic>, MessagingError> {
        // Verify user is in conversation
        if !self.is_user_in_conversation(user_id, conversation_id).await? {
            return Err(MessagingError::UserNotInConversation);
        }

        let limit = limit.unwrap_or(50).min(100); // Cap at 100 messages

        let messages = if let Some(before_id) = before_id {
            sqlx::query_as!(
                Message,
                r#"
                SELECT * FROM messages 
                WHERE conversation_id = $1 
                AND deleted_at IS NULL 
                AND (expires_at IS NULL OR expires_at > NOW())
                AND created_at < (SELECT created_at FROM messages WHERE id = $2)
                ORDER BY created_at DESC 
                LIMIT $3
                "#,
                conversation_id,
                before_id,
                limit
            )
            .fetch_all(&self.db)
            .await?
        } else {
            sqlx::query_as!(
                Message,
                r#"
                SELECT * FROM messages 
                WHERE conversation_id = $1 
                AND deleted_at IS NULL 
                AND (expires_at IS NULL OR expires_at > NOW())
                ORDER BY created_at DESC 
                LIMIT $2
                "#,
                conversation_id,
                limit
            )
            .fetch_all(&self.db)
            .await?
        };

        Ok(messages.into_iter().map(|m| m.to_public()).collect())
    }

    /// Mark message as read by user
    pub async fn mark_message_read(&self, user_id: Uuid, message_id: Uuid) -> Result<(), MessagingError> {
        // Get message and verify user can read it
        let message = sqlx::query_as!(
            Message,
            "SELECT * FROM messages WHERE id = $1 AND deleted_at IS NULL",
            message_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or(MessagingError::MessageNotFound)?;

        // Get the conversation_id (handle Option<Uuid>)
        let conversation_id = message.conversation_id.ok_or(MessagingError::MessageNotFound)?;

        // Verify user is in conversation
        if !self.is_user_in_conversation(user_id, conversation_id).await? {
            return Err(MessagingError::UserNotInConversation);
        }

        // Update read_by array
        sqlx::query!(
            r#"
            UPDATE messages 
            SET read_by = CASE 
                WHEN read_by ? $2 THEN read_by
                ELSE read_by || $3
            END
            WHERE id = $1
            "#,
            message_id,
            user_id.to_string(),
            serde_json::json!([user_id.to_string()])
        )
        .execute(&self.db)
        .await?;

        // Update participant's last_read_at
        sqlx::query!(
            r#"
            UPDATE conversation_participants 
            SET last_read_at = NOW() 
            WHERE conversation_id = $1 AND user_id = $2
            "#,
            conversation_id,
            user_id
        )
        .execute(&self.db)
        .await?;

        Ok(())
    }

    /// Get user's conversations
    pub async fn get_user_conversations(
        &self,
        user_id: Uuid,
        limit: Option<i64>,
    ) -> Result<Vec<(Conversation, ConversationParticipant)>, MessagingError> {
        let limit = limit.unwrap_or(50).min(100);

        let results = sqlx::query!(
            r#"
            SELECT 
                c.*,
                cp.role,
                cp.joined_at,
                cp.last_read_at,
                cp.permissions
            FROM conversations c
            JOIN conversation_participants cp ON c.id = cp.conversation_id
            WHERE cp.user_id = $1 AND cp.is_active = true AND c.is_active = true
            ORDER BY c.updated_at DESC
            LIMIT $2
            "#,
            user_id,
            limit
        )
        .fetch_all(&self.db)
        .await?;

        let mut conversations = Vec::new();
        for row in results {
            let conversation = Conversation {
                id: row.id,
                name: row.name,
                r#type: row.r#type, // r#type is already a String, not Option<String>
                creator_id: row.creator_id,
                encryption_key_hash: row.encryption_key_hash,
                created_at: row.created_at,
                updated_at: row.updated_at,
                expires_at: row.expires_at,
                is_active: row.is_active,
                settings: row.settings,
            };

            let participant = ConversationParticipant {
                id: Uuid::new_v4(), // Not used in this context
                conversation_id: Some(row.id), // ConversationParticipant.conversation_id is Option<Uuid>
                user_id: Some(user_id),
                role: row.role,
                joined_at: row.joined_at,
                last_read_at: row.last_read_at,
                is_active: row.is_active,
                permissions: row.permissions,
            };

            conversations.push((conversation, participant));
        }

        Ok(conversations)
    }

    /// Check if user is in conversation
    pub async fn is_user_in_conversation(
        &self,
        user_id: Uuid,
        conversation_id: Uuid,
    ) -> Result<bool, MessagingError> {
        let count = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM conversation_participants WHERE user_id = $1 AND conversation_id = $2 AND is_active = true",
            user_id,
            conversation_id
        )
        .fetch_one(&self.db)
        .await?;

        Ok(count.unwrap_or(0) > 0)
    }

    /// Delete expired messages (should be called by a scheduler)
    pub async fn cleanup_expired_messages(&self) -> Result<u64, MessagingError> {
        let result = sqlx::query!(
            r#"
            UPDATE messages 
            SET deleted_at = NOW() 
            WHERE expires_at IS NOT NULL 
            AND expires_at < NOW() 
            AND deleted_at IS NULL
            RETURNING id
            "#
        )
        .fetch_all(&self.db)
        .await?;

        let count = result.len() as u64;
        
        if count > 0 {
            tracing::info!("Cleaned up {} expired messages", count);
        }

        Ok(count)
    }

    /// Get conversation participants
    pub async fn get_conversation_participants(
        &self,
        user_id: Uuid,
        conversation_id: Uuid,
    ) -> Result<Vec<ConversationParticipant>, MessagingError> {
        // Verify user is in conversation
        if !self.is_user_in_conversation(user_id, conversation_id).await? {
            return Err(MessagingError::UserNotInConversation);
        }

        let participants = sqlx::query_as!(
            ConversationParticipant,
            "SELECT * FROM conversation_participants WHERE conversation_id = $1 AND is_active = true",
            conversation_id
        )
        .fetch_all(&self.db)
        .await?;

        Ok(participants)
    }
}
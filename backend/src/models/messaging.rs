use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Conversation {
    pub id: Uuid,
    pub name: Option<String>,
    pub r#type: String, // 'direct', 'group', 'broadcast'
    pub creator_id: Option<Uuid>,
    pub encryption_key_hash: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub settings: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ConversationParticipant {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub user_id: Uuid,
    pub role: String, // 'admin', 'member', 'viewer'
    pub joined_at: DateTime<Utc>,
    pub last_read_at: DateTime<Utc>,
    pub is_active: bool,
    pub permissions: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Message {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub sender_id: Option<Uuid>,
    pub content_encrypted: String,
    pub message_type: String, // 'text', 'file', 'image', 'video', 'system'
    pub metadata_encrypted: Option<String>,
    pub reply_to_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub edited_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub destruction_scheduled_at: Option<DateTime<Utc>>,
    pub read_by: serde_json::Value, // Array of user IDs
    pub reactions: serde_json::Value, // Reactions object
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MessagePublic {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub sender_id: Option<Uuid>,
    pub content_encrypted: String, // Client will decrypt
    pub message_type: String,
    pub metadata_encrypted: Option<String>,
    pub reply_to_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub edited_at: Option<DateTime<Utc>>,
    pub read_by: Vec<Uuid>,
    pub reactions: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct CreateConversationRequest {
    pub name: Option<String>,
    pub r#type: String,
    pub participant_ids: Vec<Uuid>,
    pub settings: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub conversation_id: Uuid,
    pub content_encrypted: String,
    pub message_type: String,
    pub metadata_encrypted: Option<String>,
    pub reply_to_id: Option<Uuid>,
    pub expires_in_minutes: Option<i32>,
}

impl Message {
    pub fn to_public(&self) -> MessagePublic {
        let read_by: Vec<Uuid> = self.read_by
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|v| v.as_str().and_then(|s| s.parse().ok()))
            .collect();

        MessagePublic {
            id: self.id,
            conversation_id: self.conversation_id,
            sender_id: self.sender_id,
            content_encrypted: self.content_encrypted.clone(),
            message_type: self.message_type.clone(),
            metadata_encrypted: self.metadata_encrypted.clone(),
            reply_to_id: self.reply_to_id,
            created_at: self.created_at,
            edited_at: self.edited_at,
            read_by,
            reactions: self.reactions.clone(),
        }
    }
}
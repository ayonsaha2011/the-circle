use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct VideoCall {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub initiator_id: Option<Uuid>,
    pub call_type: String, // 'video', 'audio', 'screen_share'
    pub status: String, // 'initiated', 'ringing', 'active', 'ended', 'failed'
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_seconds: Option<i32>,
    pub participants: serde_json::Value, // Array of participant info
    pub settings: serde_json::Value, // Call settings and quality
    pub recording_enabled: bool,
    pub recording_s3_key: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct UserPresence {
    pub user_id: Uuid,
    pub status: String, // 'online', 'away', 'busy', 'offline'
    pub custom_status: Option<String>,
    pub last_seen_at: DateTime<Utc>,
    pub last_activity_at: DateTime<Utc>,
    pub device_info: Option<serde_json::Value>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ActivityLog {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub action: String, // 'message_sent', 'file_uploaded', 'call_started', etc.
    pub resource_type: Option<String>, // 'message', 'file', 'call', 'conversation'
    pub resource_id: Option<Uuid>,
    pub ip_address: Option<std::net::IpAddr>,
    pub user_agent: Option<String>,
    pub details: Option<serde_json::Value>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct InitiateCallRequest {
    pub conversation_id: Uuid,
    pub call_type: String,
    pub settings: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePresenceRequest {
    pub status: String,
    pub custom_status: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CallSignalMessage {
    pub call_id: Uuid,
    pub message_type: String, // 'offer', 'answer', 'ice_candidate', 'hangup'
    pub data: serde_json::Value,
    pub sender_id: Uuid,
    pub timestamp: DateTime<Utc>,
}

// WebSocket message types for real-time communication
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WebSocketMessage {
    // Authentication
    Authenticate { token: String },
    AuthResult { success: bool, user_id: Option<Uuid> },
    
    // Messaging
    SendMessage { conversationId: String, content: String, messageType: String },
    MessageSent { message: crate::models::MessagePublic },
    MessageReceived { message: crate::models::MessagePublic },
    MessageRead { messageId: String, conversationId: String },
    TypingStart { conversationId: String },
    TypingStop { conversationId: String },
    
    // Presence
    PresenceUpdate { user_id: Uuid, status: String, custom_status: Option<String> },
    UserOnline { user_id: Uuid },
    UserOffline { user_id: Uuid },
    
    // Video calls
    CallInitiated { call: VideoCall },
    CallEnded { call_id: Uuid },
    CallSignal { call_id: Uuid, signal: serde_json::Value },
    
    // System
    Error { message: String },
    Ping,
    Pong,
}
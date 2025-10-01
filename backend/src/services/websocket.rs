use crate::services::{AuthService, MessagingService, SecurityService};
use crate::models::WebSocketMessage;
use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, ConnectInfo, State},
    response::Response,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use serde_json;
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::Arc,
};
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

#[derive(Debug)]
pub enum WebSocketError {
    AuthError(crate::services::AuthError),
    ParseError,
}

impl std::fmt::Display for WebSocketError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WebSocketError::AuthError(e) => write!(f, "Auth error: {}", e),
            WebSocketError::ParseError => write!(f, "Parse error"),
        }
    }
}

impl std::error::Error for WebSocketError {}

impl From<crate::services::AuthError> for WebSocketError {
    fn from(err: crate::services::AuthError) -> Self {
        WebSocketError::AuthError(err)
    }
}

pub type UserConnections = Arc<RwLock<HashMap<Uuid, UserConnection>>>;

#[derive(Debug, Clone)]
pub struct UserConnection {
    pub user_id: Uuid,
    pub sender: broadcast::Sender<String>,
    pub ip_address: SocketAddr,
    pub connected_at: chrono::DateTime<chrono::Utc>,
    pub last_activity: chrono::DateTime<chrono::Utc>,
}

#[derive(Clone)]
pub struct WebSocketService {
    pub connections: UserConnections,
    pub messaging_service: MessagingService,
    pub auth_service: AuthService,
    pub security_service: SecurityService,
}

impl WebSocketService {
    pub fn new(
        messaging_service: MessagingService,
        auth_service: AuthService,
        security_service: SecurityService,
    ) -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            messaging_service,
            auth_service,
            security_service,
        }
    }

    /// Handle WebSocket upgrade
    pub async fn handle_websocket(
        ws: WebSocketUpgrade,
        ConnectInfo(addr): ConnectInfo<SocketAddr>,
        State(service): State<Arc<WebSocketService>>,
    ) -> Response {
        ws.on_upgrade(move |socket| service.handle_socket(socket, addr))
    }

    /// Handle individual WebSocket connection
    pub async fn handle_socket(self: Arc<Self>, socket: WebSocket, addr: SocketAddr) {
        tracing::info!("🔗 New WebSocket connection from: {}", addr);
        let (sender, mut receiver) = socket.split();
        
        // Create broadcast channel for this connection
        let (tx, _rx) = broadcast::channel(1000);
        let mut authenticated_user: Option<Uuid> = None;
        let mut rx = tx.subscribe();
        
        // Wrap sender in Arc<Mutex> to allow sharing
        let sender = Arc::new(tokio::sync::Mutex::new(sender));
        let sender_clone = sender.clone();

        // Spawn task to handle outgoing messages
        let tx_clone = tx.clone();
        let sender_task = tokio::spawn(async move {
            while let Ok(msg) = rx.recv().await {
                let mut sender = sender_clone.lock().await;
                if sender.send(Message::Text(msg)).await.is_err() {
                    break;
                }
            }
        });

        // Handle incoming messages
        while let Some(msg) = receiver.next().await {
            let msg = match msg {
                Ok(Message::Text(text)) => text,
                Ok(Message::Close(_)) => break,
                Ok(Message::Ping(data)) => {
                    // Respond to ping with pong
                    let mut sender_guard = sender.lock().await;
                    if sender_guard.send(Message::Pong(data)).await.is_err() {
                        break;
                    }
                    continue;
                }
                _ => continue,
            };

            // Parse WebSocket message
            let ws_message: WebSocketMessage = match serde_json::from_str(&msg) {
                Ok(msg) => msg,
                Err(_) => {
                    let error_msg = WebSocketMessage::Error {
                        message: "Invalid message format".to_string(),
                    };
                    let _ = tx_clone.send(serde_json::to_string(&error_msg).unwrap());
                    continue;
                }
            };

            // Handle message based on type
            match ws_message {
                WebSocketMessage::Authenticate { token } => {
                    match self.authenticate_user(&token).await {
                        Ok(user_id) => {
                            authenticated_user = Some(user_id);
                            
                            // Store connection
                            let connection = UserConnection {
                                user_id,
                                sender: tx_clone.clone(),
                                ip_address: addr,
                                connected_at: chrono::Utc::now(),
                                last_activity: chrono::Utc::now(),
                            };
                            
                            self.connections.write().await.insert(user_id, connection);

                            // Update user presence
                            let _ = self.update_user_presence(user_id, "online", None).await;

                            // Send authentication result
                            let auth_result = WebSocketMessage::AuthResult {
                                success: true,
                                user_id: Some(user_id),
                            };
                            let _ = tx_clone.send(serde_json::to_string(&auth_result).unwrap());

                            // Notify other users
                            self.broadcast_user_online(user_id).await;

                            // Log connection
                            self.security_service.log_security_event(
                                Some(user_id),
                                "websocket_connected".to_string(),
                                Some(addr.ip()),
                                None,
                                None,
                            ).await;
                        }
                        Err(_) => {
                            let auth_result = WebSocketMessage::AuthResult {
                                success: false,
                                user_id: None,
                            };
                            let _ = tx_clone.send(serde_json::to_string(&auth_result).unwrap());
                        }
                    }
                }
                
                WebSocketMessage::SendMessage { conversationId, content, messageType } => {
                    if let Some(user_id) = authenticated_user {
                        tracing::info!("📤 Received SendMessage from user {} for conversation {}", user_id, conversationId);
                        
                        // Parse conversation_id
                        if let Ok(conversation_uuid) = conversationId.parse::<Uuid>() {
                            // Create and save message to database
                            match self.create_and_save_message(user_id, conversation_uuid, content.clone(), messageType.clone()).await {
                                Ok(message) => {
                                    tracing::info!("✅ Message saved to database: {}", message.id);
                                    
                                    // Create MessageReceived event
                                    let message_received = WebSocketMessage::MessageReceived { message };
                                    
                                    // Broadcast to all conversation participants
                                    self.broadcast_message_to_conversation(conversation_uuid, &message_received).await;
                                }
                                Err(e) => {
                                    tracing::error!("❌ Failed to save message: {:?}", e);
                                    let error_msg = WebSocketMessage::Error {
                                        message: "Failed to send message".to_string(),
                                    };
                                    let _ = tx_clone.send(serde_json::to_string(&error_msg).unwrap());
                                }
                            }
                        } else {
                            tracing::error!("❌ Invalid conversation ID format: {}", conversationId);
                            let error_msg = WebSocketMessage::Error {
                                message: "Invalid conversation ID".to_string(),
                            };
                            let _ = tx_clone.send(serde_json::to_string(&error_msg).unwrap());
                        }
                    }
                }
                
                WebSocketMessage::MessageSent { message } => {
                    if let Some(user_id) = authenticated_user {
                        // Broadcast message to conversation participants
                        if let Some(conversation_id) = message.conversation_id {
                            self.broadcast_message_to_conversation(conversation_id, &message).await;
                        }
                    }
                }
                
                WebSocketMessage::MessageRead { messageId, conversationId } => {
                    if let Some(user_id) = authenticated_user {
                        tracing::info!("📖 User {} marked message {} as read in conversation {}", user_id, messageId, conversationId);
                        // TODO: Implement message read functionality
                    }
                }

                WebSocketMessage::TypingStart { conversationId } => {
                    if let Some(user_id) = authenticated_user {
                        tracing::info!("⌨️ User {} started typing in conversation {}", user_id, conversationId);
                        // TODO: Broadcast typing indicator to other participants
                    }
                }

                WebSocketMessage::TypingStop { conversationId } => {
                    if let Some(user_id) = authenticated_user {
                        tracing::info!("⌨️ User {} stopped typing in conversation {}", user_id, conversationId);
                        // TODO: Broadcast typing stop to other participants
                    }
                }

                WebSocketMessage::Ping => {
                    let pong = WebSocketMessage::Pong;
                    let _ = tx_clone.send(serde_json::to_string(&pong).unwrap());
                }

                _ => {
                    // Handle other message types
                }
            }

            // Update last activity
            if let Some(user_id) = authenticated_user {
                if let Some(connection) = self.connections.write().await.get_mut(&user_id) {
                    connection.last_activity = chrono::Utc::now();
                }
            }
        }

        // Clean up on disconnect
        if let Some(user_id) = authenticated_user {
            self.connections.write().await.remove(&user_id);
            let _ = self.update_user_presence(user_id, "offline", None).await;
            self.broadcast_user_offline(user_id).await;

            // Log disconnection
            self.security_service.log_security_event(
                Some(user_id),
                "websocket_disconnected".to_string(),
                Some(addr.ip()),
                None,
                None,
            ).await;
        }

        sender_task.abort();
    }

    /// Authenticate user with JWT token
    async fn authenticate_user(&self, token: &str) -> Result<Uuid, WebSocketError> {
        tracing::info!("🔐 WebSocket: Attempting to authenticate with token: {}...", &token[..std::cmp::min(20, token.len())]);
        tracing::info!("🔐 WebSocket: Full token: {}", token);
        
        let claims = match self.auth_service.verify_token(token) {
            Ok(claims) => {
                tracing::info!("✅ WebSocket: Token verification successful for user: {}", claims.sub);
                tracing::info!("✅ WebSocket: Token claims: exp={}, iat={}, membership_tier={}, mfa_verified={}", claims.exp, claims.iat, claims.membership_tier, claims.mfa_verified);
                claims
            }
            Err(e) => {
                tracing::error!("❌ WebSocket: Token verification failed: {:?}", e);
                tracing::error!("❌ WebSocket: Token that failed: {}", token);
                return Err(WebSocketError::AuthError(e));
            }
        };
        
        let user_id = claims.sub.parse::<Uuid>().map_err(|e| {
            tracing::error!("❌ WebSocket: Failed to parse user_id from claims.sub '{}': {:?}", claims.sub, e);
            WebSocketError::ParseError
        })?;
        
        tracing::info!("✅ WebSocket: Authentication successful for user_id: {}", user_id);
        Ok(user_id)
    }

    /// Update user presence status
    async fn update_user_presence(
        &self,
        user_id: Uuid,
        status: &str,
        custom_status: Option<String>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        sqlx::query!(
            r#"
            INSERT INTO user_presence (user_id, status, custom_status, last_seen_at, last_activity_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                status = EXCLUDED.status,
                custom_status = EXCLUDED.custom_status,
                last_seen_at = NOW(),
                last_activity_at = NOW(),
                updated_at = NOW()
            "#,
            user_id,
            status,
            custom_status
        )
        .execute(self.messaging_service.db())
        .await?;

        Ok(())
    }

    /// Broadcast message to all participants in a conversation
    async fn broadcast_message_to_conversation<T: serde::Serialize>(
        &self,
        conversation_id: Uuid,
        message: T,
    ) {
        // Get conversation participants
        if let Ok(participants) = self.get_conversation_participants(conversation_id).await {
            let message_str = serde_json::to_string(&message).unwrap_or_default();
            let connections = self.connections.read().await;

            for participant_id in participants {
                if let Some(connection) = connections.get(&participant_id) {
                    let _ = connection.sender.send(message_str.clone());
                }
            }
        }
    }

    /// Broadcast to conversation participants except specific user
    async fn broadcast_to_conversation_except_user<T: serde::Serialize>(
        &self,
        conversation_id: Uuid,
        except_user_id: Uuid,
        message: T,
    ) {
        if let Ok(participants) = self.get_conversation_participants(conversation_id).await {
            let message_str = serde_json::to_string(&message).unwrap_or_default();
            let connections = self.connections.read().await;

            for participant_id in participants {
                if participant_id != except_user_id {
                    if let Some(connection) = connections.get(&participant_id) {
                        let _ = connection.sender.send(message_str.clone());
                    }
                }
            }
        }
    }

    /// Broadcast user online status
    async fn broadcast_user_online(&self, user_id: Uuid) {
        let message = WebSocketMessage::UserOnline { user_id };
        self.broadcast_to_all_connections(&message).await;
    }

    /// Broadcast user offline status
    async fn broadcast_user_offline(&self, user_id: Uuid) {
        let message = WebSocketMessage::UserOffline { user_id };
        self.broadcast_to_all_connections(&message).await;
    }

    /// Broadcast message to all connected users
    async fn broadcast_to_all_connections<T: serde::Serialize>(&self, message: T) {
        let message_str = serde_json::to_string(&message).unwrap_or_default();
        let connections = self.connections.read().await;

        for connection in connections.values() {
            let _ = connection.sender.send(message_str.clone());
        }
    }

    /// Get conversation participants
    async fn get_conversation_participants(&self, conversation_id: Uuid) -> Result<Vec<Uuid>, crate::services::MessagingError> {
        let participants = sqlx::query_scalar!(
            "SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND is_active = true",
            conversation_id
        )
        .fetch_all(self.messaging_service.db())
        .await?
        .into_iter()
        .filter_map(|id| id)
        .collect::<Vec<Uuid>>();

        Ok(participants)
    }

    /// Get message for read receipt (simplified)
    async fn get_message_for_read_receipt(&self, message_id: Uuid) -> Result<crate::models::Message, crate::services::MessagingError> {
        let message = sqlx::query_as!(
            crate::models::Message,
            "SELECT * FROM messages WHERE id = $1",
            message_id
        )
        .fetch_one(self.messaging_service.db())
        .await?;

        Ok(message)
    }

    /// Get connected user count
    pub async fn get_connected_user_count(&self) -> usize {
        self.connections.read().await.len()
    }

    /// Get connected users
    pub async fn get_connected_users(&self) -> Vec<Uuid> {
        self.connections.read().await.keys().copied().collect()
    }

    /// Create and save a message to the database
    async fn create_and_save_message(
        &self,
        user_id: Uuid,
        conversation_id: Uuid,
        content: String,
        message_type: String,
    ) -> Result<crate::models::MessagePublic, Box<dyn std::error::Error + Send + Sync>> {
        // For now, we'll store the content as "encrypted" (in real app, this would be properly encrypted)
        let content_encrypted = content; // In production, encrypt this
        let message_id = Uuid::new_v4();
        
        // Save message to database
        sqlx::query!(
            r#"
            INSERT INTO messages (id, conversation_id, sender_id, content_encrypted, message_type, read_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
            message_id,
            conversation_id,
            user_id,
            content_encrypted,
            message_type,
            serde_json::json!([user_id.to_string()]) // Sender has read it by default
        )
        .execute(self.messaging_service.db())
        .await?;
        
        // Fetch the created message
        let message = sqlx::query_as!(
            crate::models::Message,
            "SELECT * FROM messages WHERE id = $1",
            message_id
        )
        .fetch_one(self.messaging_service.db())
        .await?;
        
        Ok(message.to_public())
    }
}
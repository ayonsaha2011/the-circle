use crate::models::{WebSocketMessage, UserPresence};
use crate::services::{AuthService, MessagingService, SecurityService};
use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, ConnectInfo, State},
    response::Response,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::Arc,
};
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

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
        State(service): State<WebSocketService>,
    ) -> Response {
        ws.on_upgrade(move |socket| service.handle_socket(socket, addr))
    }

    /// Handle individual WebSocket connection
    pub async fn handle_socket(self: Arc<Self>, socket: WebSocket, addr: SocketAddr) {
        let (mut sender, mut receiver) = socket.split();
        
        // Create broadcast channel for this connection
        let (tx, _rx) = broadcast::channel(1000);
        let mut authenticated_user: Option<Uuid> = None;
        let mut rx = tx.subscribe();

        // Spawn task to handle outgoing messages
        let tx_clone = tx.clone();
        let sender_task = tokio::spawn(async move {
            while let Ok(msg) = rx.recv().await {
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
                    if sender.send(Message::Pong(data)).await.is_err() {
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
                
                WebSocketMessage::MessageSent { message } => {
                    if let Some(user_id) = authenticated_user {
                        // Broadcast message to conversation participants
                        self.broadcast_message_to_conversation(message.conversation_id, &message).await;
                    }
                }

                WebSocketMessage::MessageRead { message_id, user_id: reader_id } => {
                    if let Some(user_id) = authenticated_user {
                        if user_id == reader_id {
                            // Mark message as read
                            let _ = self.messaging_service.mark_message_read(user_id, message_id).await;
                            
                            // Broadcast read receipt
                            if let Ok(message) = self.get_message_for_read_receipt(message_id).await {
                                self.broadcast_message_to_conversation(
                                    message.conversation_id,
                                    &WebSocketMessage::MessageRead { message_id, user_id }
                                ).await;
                            }
                        }
                    }
                }

                WebSocketMessage::TypingStart { conversation_id, user_id: typer_id } => {
                    if let Some(user_id) = authenticated_user {
                        if user_id == typer_id {
                            self.broadcast_to_conversation_except_user(
                                conversation_id,
                                user_id,
                                &WebSocketMessage::TypingStart { conversation_id, user_id }
                            ).await;
                        }
                    }
                }

                WebSocketMessage::TypingStop { conversation_id, user_id: typer_id } => {
                    if let Some(user_id) = authenticated_user {
                        if user_id == typer_id {
                            self.broadcast_to_conversation_except_user(
                                conversation_id,
                                user_id,
                                &WebSocketMessage::TypingStop { conversation_id, user_id }
                            ).await;
                        }
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
    async fn authenticate_user(&self, token: &str) -> Result<Uuid, Box<dyn std::error::Error>> {
        let claims = self.auth_service.verify_token(token)?;
        let user_id = claims.sub.parse::<Uuid>()?;
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
        .execute(&self.messaging_service.db)
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
    async fn get_conversation_participants(&self, conversation_id: Uuid) -> Result<Vec<Uuid>, Box<dyn std::error::Error>> {
        let participants = sqlx::query_scalar!(
            "SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND is_active = true",
            conversation_id
        )
        .fetch_all(&self.messaging_service.db)
        .await?;

        Ok(participants)
    }

    /// Get message for read receipt (simplified)
    async fn get_message_for_read_receipt(&self, message_id: Uuid) -> Result<crate::models::Message, Box<dyn std::error::Error>> {
        let message = sqlx::query_as!(
            crate::models::Message,
            "SELECT * FROM messages WHERE id = $1",
            message_id
        )
        .fetch_one(&self.messaging_service.db)
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
}
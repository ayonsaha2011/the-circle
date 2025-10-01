use axum::{
    extract::{State, Json as ExtractJson},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::utils::AppState;
use crate::models::{CreateConversationRequest as ModelCreateConversationRequest};
use crate::services::MessagingError;

#[derive(Debug, Deserialize)]
pub struct CreateConversationRequest {
    pub name: Option<String>,
    pub participant_emails: Vec<String>,
    pub conversation_type: String, // "direct" or "group"
}

#[derive(Debug, Deserialize)]
pub struct AddParticipantRequest {
    pub participant_emails: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct RemoveParticipantRequest {
    pub participant_email: String,
}

#[derive(Debug, Serialize)]
pub struct InviteResponse {
    pub invite_link: String,
    pub expires_at: String,
}

#[derive(Debug, Serialize)]
pub struct ConversationResponse {
    pub id: String,
    pub name: Option<String>,
    pub conversation_type: String,
    pub participants: Vec<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct ConversationListResponse {
    pub conversations: Vec<ConversationResponse>,
}

pub async fn create_conversation(
    State(state): State<AppState>,
    ExtractJson(request): ExtractJson<CreateConversationRequest>,
) -> Result<Json<ConversationResponse>, (StatusCode, Json<serde_json::Value>)> {
    // For now, we'll hardcode the creator_id since auth middleware isn't fully set up
    // In production, this should come from the authenticated user context
    let creator_id: Uuid = "97ecd6b7-99dc-4c93-b31c-f9160fe1aca6".parse().unwrap();
    
    // Get user IDs from emails
    let mut participant_ids = Vec::new();
    for email in &request.participant_emails {
        match sqlx::query_scalar!("SELECT id FROM users WHERE email = $1", email)
            .fetch_optional(&state.db)
            .await
        {
            Ok(Some(user_id)) => participant_ids.push(user_id),
            Ok(None) => {
                tracing::warn!("User with email {} not found", email);
                // For demo purposes, continue without this user
                // In production, you might want to return an error
            }
            Err(e) => {
                tracing::error!("Database error looking up user {}: {:?}", email, e);
                return Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "Database error"})),
                ));
            }
        }
    }

    // Add creator to participants if not already included
    if !participant_ids.contains(&creator_id) {
        participant_ids.push(creator_id);
    }

    let conversation_id = Uuid::new_v4();
    let conversation_name = request.name.clone().unwrap_or_else(|| "New Conversation".to_string());
    
    // Start transaction
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!("Failed to start transaction: {:?}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Database error"})),
            ));
        }
    };

    // Create conversation (simplified - not using encryption for now)
    let conversation_result = sqlx::query!(
        r#"
        INSERT INTO conversations (id, name, type, creator_id, encryption_key_hash)
        VALUES ($1, $2, $3, $4, 'placeholder_hash')
        "#,
        conversation_id,
        conversation_name,
        request.conversation_type,
        creator_id
    )
    .execute(&mut *tx)
    .await;

    if let Err(e) = conversation_result {
        tracing::error!("Failed to create conversation: {:?}", e);
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Failed to create conversation"})),
        ));
    }

    // Add participants
    for participant_id in &participant_ids {
        let role = if *participant_id == creator_id { "admin" } else { "member" };
        
        let participant_result = sqlx::query!(
            r#"
            INSERT INTO conversation_participants (conversation_id, user_id, role)
            VALUES ($1, $2, $3)
            "#,
            conversation_id,
            participant_id,
            role
        )
        .execute(&mut *tx)
        .await;

        if let Err(e) = participant_result {
            tracing::error!("Failed to add participant {}: {:?}", participant_id, e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "Failed to add participants"})),
            ));
        }
    }

    // Commit transaction
    if let Err(e) = tx.commit().await {
        tracing::error!("Failed to commit transaction: {:?}", e);
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Database error"})),
        ));
    }

    tracing::info!("✅ Created conversation {} with {} participants", conversation_id, participant_ids.len());
    
    let response = ConversationResponse {
        id: conversation_id.to_string(),
        name: Some(conversation_name),
        conversation_type: request.conversation_type,
        participants: request.participant_emails,
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    Ok(Json(response))
}

pub async fn list_conversations(
    State(_state): State<AppState>,
) -> Result<Json<ConversationListResponse>, StatusCode> {
    // For now, return empty list since full messaging service is not implemented
    let response = ConversationListResponse {
        conversations: vec![],
    };

    Ok(Json(response))
}

// Add participants to existing conversation
pub async fn add_participants(
    axum::extract::Path(conversation_id): axum::extract::Path<String>,
    State(state): State<AppState>,
    ExtractJson(request): ExtractJson<AddParticipantRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let conversation_uuid = match Uuid::parse_str(&conversation_id) {
        Ok(id) => id,
        Err(_) => return Err((StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Invalid conversation ID"})))),
    };

    // Get user IDs from emails
    let mut participant_ids = Vec::new();
    for email in &request.participant_emails {
        match sqlx::query_scalar!("SELECT id FROM users WHERE email = $1", email)
            .fetch_optional(&state.db)
            .await
        {
            Ok(Some(user_id)) => participant_ids.push(user_id),
            Ok(None) => {
                return Err((StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": format!("User with email {} not found", email)}))));
            }
            Err(e) => {
                tracing::error!("Database error: {:?}", e);
                return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Database error"}))));
            }
        }
    }

    // Add participants to conversation
    for participant_id in participant_ids {
        let result = sqlx::query!(
            "INSERT INTO conversation_participants (conversation_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT (conversation_id, user_id) DO NOTHING",
            conversation_uuid,
            participant_id
        )
        .execute(&state.db)
        .await;

        if let Err(e) = result {
            tracing::error!("Failed to add participant: {:?}", e);
            return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Failed to add participant"}))));
        }
    }

    Ok(Json(serde_json::json!({"success": true, "message": "Participants added successfully"})))
}

// Generate invite link for conversation
pub async fn create_invite_link(
    axum::extract::Path(conversation_id): axum::extract::Path<String>,
    State(_state): State<AppState>,
) -> Result<Json<InviteResponse>, (StatusCode, Json<serde_json::Value>)> {
    let conversation_uuid = match Uuid::parse_str(&conversation_id) {
        Ok(id) => id,
        Err(_) => return Err((StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Invalid conversation ID"})))),
    };

    // Generate invite token and expiration (24 hours)
    let invite_token = Uuid::new_v4().to_string();
    let expires_at = chrono::Utc::now() + chrono::Duration::hours(24);
    let invite_link = format!("https://thecircle.app/invite/{}", invite_token);

    // TODO: Store invite token in database with conversation_id and expiration
    // For now, we'll just return the link

    let response = InviteResponse {
        invite_link,
        expires_at: expires_at.to_rfc3339(),
    };

    tracing::info!("Created invite link for conversation {}", conversation_uuid);
    Ok(Json(response))
}
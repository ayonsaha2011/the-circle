use crate::models::{CreateUserRequest, LoginRequest};
use crate::utils::AppState;
use axum::{
    extract::{ConnectInfo, State},
    http::StatusCode,
    response::Json,
};
use serde_json::{json, Value};
use std::net::SocketAddr;
use validator::Validate;

pub async fn register(
    State(app_state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(payload): Json<CreateUserRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Validate request
    if let Err(errors) = payload.validate() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({
                "error": "Validation failed",
                "details": format!("{:?}", errors)
            })),
        ));
    }

    match app_state.auth_service.register_user(payload).await {
        Ok(user) => {
            let response = json!({
                "message": "User registered successfully. Please check your email for verification.",
                "user": user.to_public()
            });
            Ok(Json(response))
        }
        Err(e) => {
            let (status, message) = match e {
                crate::services::AuthError::UserAlreadyExists => {
                    (StatusCode::CONFLICT, "User already exists")
                }
                _ => (StatusCode::INTERNAL_SERVER_ERROR, "Registration failed"),
            };
            
            Err((
                status,
                Json(json!({
                    "error": message
                })),
            ))
        }
    }
}

pub async fn login_initiate(
    State(app_state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let email = payload["email"]
        .as_str()
        .ok_or_else(|| {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Email is required"})),
            )
        })?;

    match app_state
        .auth_service
        .initiate_login(email, Some(addr.ip()))
        .await
    {
        Ok(login_step) => Ok(Json(serde_json::to_value(login_step).unwrap())),
        Err(e) => {
            let (status, message) = match e {
                crate::services::AuthError::UserNotFound => {
                    (StatusCode::NOT_FOUND, "User not found")
                }
                crate::services::AuthError::AccountLocked => {
                    (StatusCode::LOCKED, "Account is locked")
                }
                _ => (StatusCode::INTERNAL_SERVER_ERROR, "Login initiation failed"),
            };

            Err((
                status,
                Json(json!({
                    "error": message
                })),
            ))
        }
    }
}

pub async fn login_complete(
    State(app_state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Validate request
    if let Err(errors) = payload.validate() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({
                "error": "Validation failed",
                "details": format!("{:?}", errors)
            })),
        ));
    }

    // Extract user agent from headers (would need request headers in real implementation)
    let user_agent = None; // For simplicity

    match app_state
        .auth_service
        .complete_login(payload, Some(addr.ip()), user_agent)
        .await
    {
        Ok(login_response) => Ok(Json(serde_json::to_value(login_response).unwrap())),
        Err(e) => {
            let (status, message) = match e {
                crate::services::AuthError::InvalidCredentials => {
                    (StatusCode::UNAUTHORIZED, "Invalid credentials")
                }
                crate::services::AuthError::AccountLocked => {
                    (StatusCode::LOCKED, "Account is locked")
                }
                crate::services::AuthError::DestructionTriggered => {
                    (StatusCode::GONE, "Account has been destroyed due to security policy")
                }
                _ => (StatusCode::INTERNAL_SERVER_ERROR, "Login failed"),
            };

            Err((
                status,
                Json(json!({
                    "error": message
                })),
            ))
        }
    }
}

pub async fn logout(
    State(_app_state): State<AppState>,
    // In a real implementation, this would extract user info from JWT middleware
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Invalidate session - would need to extract token and invalidate it
    // For now, we'll just return success
    Ok(Json(json!({
        "message": "Logged out successfully"
    })))
}

pub async fn refresh_token(
    State(_app_state): State<AppState>,
    Json(_payload): Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Implement refresh token logic
    // For now, return not implemented
    Err((
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({
            "error": "Refresh token functionality not yet implemented"
        })),
    ))
}
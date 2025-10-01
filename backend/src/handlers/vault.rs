use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono;
use crate::utils::AppState;

#[derive(Debug, Deserialize)]
pub struct FileListQuery {
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct CreateUploadTokenRequest {
    pub filename: String,
    #[serde(rename = "contentType")]
    pub content_type: String,
    pub size: u64,
    #[serde(rename = "conversationId")]
    pub conversation_id: Option<String>,
    #[serde(rename = "expiresInHours")]
    pub expires_in_hours: Option<u32>,
    #[serde(rename = "accessLevel")]
    pub access_level: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateUploadTokenResponse {
    pub token: String,
    #[serde(rename = "fileId")]
    pub file_id: String,
    #[serde(rename = "uploadUrl")]
    pub upload_url: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: String,
}

#[derive(Debug, Deserialize)]
pub struct FileUploadRequest {
    pub token: String,
    #[serde(rename = "encryptedData")]
    pub encrypted_data: Vec<u8>,
    pub checksum: String,
}

#[derive(Debug, Serialize)]
pub struct FileUploadResponse {
    #[serde(rename = "fileId")]
    pub file_id: String,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct FileListResponse {
    pub files: Vec<FileInfo>,
    pub total: u32,
    pub limit: u32,
    pub offset: u32,
}

#[derive(Debug, Serialize)]
pub struct FileInfo {
    pub id: String,
    pub name: String,
    pub size: u64,
    pub created_at: String,
    pub file_type: String,
}

pub async fn list_files(
    Query(params): Query<FileListQuery>,
    State(_state): State<AppState>,
) -> Result<Json<FileListResponse>, StatusCode> {
    let limit = params.limit.unwrap_or(50);
    let offset = params.offset.unwrap_or(0);

    // For now, return empty list since vault service is not fully implemented
    let response = FileListResponse {
        files: vec![],
        total: 0,
        limit,
        offset,
    };

    Ok(Json(response))
}

pub async fn create_upload_token(
    State(_state): State<AppState>,
    Json(request): Json<CreateUploadTokenRequest>,
) -> Result<Json<CreateUploadTokenResponse>, StatusCode> {
    // Generate unique IDs
    let file_id = Uuid::new_v4().to_string();
    let token = Uuid::new_v4().to_string();
    
    // Calculate expiration time
    let expires_in_hours = request.expires_in_hours.unwrap_or(24);
    let expires_at = chrono::Utc::now() + chrono::Duration::hours(expires_in_hours as i64);
    
    // For now, use localhost upload URL - in production this would be cloud storage
    let upload_url = format!("http://localhost:8000/api/vault/upload/{}", token);
    
    let response = CreateUploadTokenResponse {
        token,
        file_id,
        upload_url,
        expires_at: expires_at.to_rfc3339(),
    };
    
    tracing::info!("Created upload token for file: {} ({})", request.filename, response.file_id);
    
    Ok(Json(response))
}

pub async fn upload_file(
    axum::extract::Path(token): axum::extract::Path<String>,
    State(_state): State<AppState>,
    Json(request): Json<FileUploadRequest>,
) -> Result<Json<FileUploadResponse>, StatusCode> {
    // Validate token matches the one in the request
    if token != request.token {
        tracing::warn!("Upload token mismatch: path={}, body={}", token, request.token);
        return Err(StatusCode::UNAUTHORIZED);
    }
    
    // Generate file ID for the uploaded file
    let file_id = Uuid::new_v4().to_string();
    
    // TODO: Save encrypted data to storage (filesystem, database, or cloud storage)
    // For now, just log the upload details
    tracing::info!(
        "File uploaded successfully: token={}, file_id={}, size={} bytes, checksum={}",
        token,
        file_id,
        request.encrypted_data.len(),
        request.checksum
    );
    
    let response = FileUploadResponse {
        file_id,
        success: true,
        message: "File uploaded successfully".to_string(),
    };
    
    Ok(Json(response))
}
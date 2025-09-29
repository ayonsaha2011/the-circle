use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct File {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub conversation_id: Option<Uuid>,
    pub filename_encrypted: String,
    pub s3_key: String,
    pub file_size: i64,
    pub mime_type: Option<String>,
    pub encryption_metadata: String, // JSON containing encryption keys/params
    pub checksum: String,
    pub created_at: DateTime<Utc>,
    pub accessed_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub download_count: i32,
    pub max_downloads: Option<i32>,
    pub is_public: bool,
    pub virus_scan_status: String, // 'pending', 'clean', 'infected', 'error'
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct FilePermission {
    pub id: Uuid,
    pub file_id: Uuid,
    pub user_id: Uuid,
    pub permission_type: String, // 'read', 'write', 'delete', 'share'
    pub granted_by_id: Option<Uuid>,
    pub granted_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FilePublic {
    pub id: Uuid,
    pub filename_encrypted: String, // Client will decrypt filename
    pub file_size: i64,
    pub mime_type: Option<String>,
    pub created_at: DateTime<Utc>,
    pub download_count: i32,
    pub max_downloads: Option<i32>,
    pub expires_at: Option<DateTime<Utc>>,
    pub virus_scan_status: String,
    pub permissions: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct FileUploadRequest {
    pub filename_encrypted: String,
    pub file_size: i64,
    pub mime_type: Option<String>,
    pub encryption_metadata: String,
    pub checksum: String,
    pub conversation_id: Option<Uuid>,
    pub expires_in_hours: Option<i32>,
    pub max_downloads: Option<i32>,
    pub is_public: bool,
}

#[derive(Debug, Deserialize)]
pub struct FileShareRequest {
    pub file_id: Uuid,
    pub user_ids: Vec<Uuid>,
    pub permission_type: String,
    pub expires_in_hours: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct FileUploadResponse {
    pub file_id: Uuid,
    pub upload_url: String, // Pre-signed S3 URL
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct FileDownloadResponse {
    pub download_url: String, // Pre-signed S3 URL
    pub expires_at: DateTime<Utc>,
    pub encryption_metadata: String,
}

impl File {
    pub fn to_public(&self, user_permissions: Vec<String>) -> FilePublic {
        FilePublic {
            id: self.id,
            filename_encrypted: self.filename_encrypted.clone(),
            file_size: self.file_size,
            mime_type: self.mime_type.clone(),
            created_at: self.created_at,
            download_count: self.download_count,
            max_downloads: self.max_downloads,
            expires_at: self.expires_at,
            virus_scan_status: self.virus_scan_status.clone(),
            permissions: user_permissions,
        }
    }
}
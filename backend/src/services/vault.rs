use crate::services::{EncryptionService, SecurityService};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::io::Cursor;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct VaultService {
    db: PgPool,
    encryption_service: EncryptionService,
    security_service: SecurityService,
    // aws_client: Option<aws_sdk_s3::Client>, // TODO: Add when implementing actual S3
}

#[derive(Debug)]
pub enum VaultError {
    DatabaseError(sqlx::Error),
    EncryptionError(crate::services::EncryptionError),
    StorageError(String),
    FileNotFound,
    AccessDenied,
    InvalidRequest,
    QuotaExceeded,
}

impl std::fmt::Display for VaultError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VaultError::DatabaseError(e) => write!(f, "Database error: {}", e),
            VaultError::EncryptionError(e) => write!(f, "Encryption error: {}", e),
            VaultError::StorageError(e) => write!(f, "Storage error: {}", e),
            VaultError::FileNotFound => write!(f, "File not found"),
            VaultError::AccessDenied => write!(f, "Access denied"),
            VaultError::InvalidRequest => write!(f, "Invalid request"),
            VaultError::QuotaExceeded => write!(f, "Storage quota exceeded"),
        }
    }
}

impl std::error::Error for VaultError {}

impl From<sqlx::Error> for VaultError {
    fn from(err: sqlx::Error) -> Self {
        VaultError::DatabaseError(err)
    }
}

impl From<crate::services::EncryptionError> for VaultError {
    fn from(err: crate::services::EncryptionError) -> Self {
        VaultError::EncryptionError(err)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileUploadRequest {
    pub filename: String,
    pub content_type: String,
    pub size: i64,
    pub conversation_id: Option<Uuid>,
    pub expires_in_hours: Option<i32>,
    pub access_level: String, // "private", "conversation", "public"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileMetadata {
    pub id: Uuid,
    pub filename: String,
    pub content_type: String,
    pub size: i64,
    pub uploader_id: Uuid,
    pub conversation_id: Option<Uuid>,
    pub access_level: String,
    pub file_path: String,
    pub encryption_key_hash: String,
    pub checksum: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub download_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UploadToken {
    pub token: String,
    pub file_id: Uuid,
    pub upload_url: String,
    pub expires_at: DateTime<Utc>,
}

impl VaultService {
    pub fn new(db: PgPool, encryption_service: EncryptionService, security_service: SecurityService) -> Self {
        Self {
            db,
            encryption_service,
            security_service,
        }
    }

    /// Create a secure upload token for client-side encryption
    pub async fn create_upload_token(
        &self,
        user_id: Uuid,
        request: FileUploadRequest,
    ) -> Result<UploadToken, VaultError> {
        // Validate request
        self.validate_upload_request(&request, user_id).await?;

        let file_id = Uuid::new_v4();
        let token = self.encryption_service.generate_secure_token();
        let upload_path = format!("vault/{}/{}", user_id, file_id);
        
        // Generate file encryption key
        let file_key = self.encryption_service.generate_key()?;
        let key_hash = self.encryption_service.hash_key(&file_key);

        let expires_at = request.expires_in_hours.map(|hours| {
            Utc::now() + Duration::hours(hours as i64)
        });

        // Store file metadata
        sqlx::query!(
            r#"
            INSERT INTO files (
                id, filename, content_type, size, uploader_id, conversation_id,
                access_level, file_path, encryption_key_hash, status, expires_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
            "#,
            file_id,
            request.filename,
            request.content_type,
            request.size,
            user_id,
            request.conversation_id,
            request.access_level,
            upload_path,
            key_hash,
            expires_at
        )
        .execute(&self.db)
        .await?;

        // Create upload token (expires in 1 hour)
        let token_expires = Utc::now() + Duration::hours(1);
        sqlx::query!(
            r#"
            INSERT INTO upload_tokens (token, file_id, user_id, expires_at)
            VALUES ($1, $2, $3, $4)
            "#,
            token,
            file_id,
            user_id,
            token_expires
        )
        .execute(&self.db)
        .await?;

        // Generate presigned upload URL (mock for now)
        let upload_url = format!("https://api.thecircle.local/vault/upload/{}", token);

        // Log activity
        self.security_service.log_security_event(
            Some(user_id),
            "file_upload_token_created".to_string(),
            None,
            None,
            Some(serde_json::json!({
                "file_id": file_id,
                "filename": request.filename,
                "size": request.size,
                "access_level": request.access_level
            })),
        ).await;

        Ok(UploadToken {
            token,
            file_id,
            upload_url,
            expires_at: token_expires,
        })
    }

    /// Handle encrypted file upload
    pub async fn upload_encrypted_file(
        &self,
        token: &str,
        encrypted_data: Vec<u8>,
        checksum: &str,
    ) -> Result<FileMetadata, VaultError> {
        // Verify upload token
        let token_record = sqlx::query!(
            r#"
            SELECT file_id, user_id FROM upload_tokens 
            WHERE token = $1 AND expires_at > NOW()
            "#,
            token
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or(VaultError::InvalidRequest)?;

        // Get file metadata
        let file_record = sqlx::query!(
            r#"
            SELECT * FROM files WHERE id = $1 AND status = 'pending'
            "#,
            token_record.file_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or(VaultError::FileNotFound)?;

        // Validate file size
        if encrypted_data.len() as i64 != file_record.size {
            return Err(VaultError::InvalidRequest);
        }

        // TODO: Store in S3 or local storage
        // For now, we'll simulate storage by just updating the database
        let storage_path = format!("stored/{}", file_record.file_path);

        // Update file status to completed
        sqlx::query!(
            r#"
            UPDATE files 
            SET status = 'completed', checksum = $1, file_path = $2, uploaded_at = NOW()
            WHERE id = $3
            "#,
            checksum,
            storage_path,
            token_record.file_id
        )
        .execute(&self.db)
        .await?;

        // Delete used token
        sqlx::query!(
            "DELETE FROM upload_tokens WHERE token = $1",
            token
        )
        .execute(&self.db)
        .await?;

        // Log successful upload
        self.security_service.log_security_event(
            Some(token_record.user_id),
            "file_uploaded".to_string(),
            None,
            None,
            Some(serde_json::json!({
                "file_id": token_record.file_id,
                "size": encrypted_data.len(),
                "checksum": checksum
            })),
        ).await;

        // Return file metadata
        self.get_file_metadata(token_record.file_id, token_record.user_id).await
    }

    /// Get file metadata with access control
    pub async fn get_file_metadata(
        &self,
        file_id: Uuid,
        user_id: Uuid,
    ) -> Result<FileMetadata, VaultError> {
        let file = sqlx::query!(
            r#"
            SELECT f.*, 
                   CASE 
                       WHEN f.uploader_id = $2 THEN true
                       WHEN f.access_level = 'public' THEN true
                       WHEN f.access_level = 'conversation' AND 
                            EXISTS(SELECT 1 FROM conversation_participants cp 
                                   WHERE cp.conversation_id = f.conversation_id 
                                   AND cp.user_id = $2) THEN true
                       ELSE false
                   END as can_access
            FROM files f
            WHERE f.id = $1 AND f.status = 'completed'
            "#,
            file_id,
            user_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or(VaultError::FileNotFound)?;

        if !file.can_access.unwrap_or(false) {
            return Err(VaultError::AccessDenied);
        }

        Ok(FileMetadata {
            id: file.id,
            filename: file.filename,
            content_type: file.content_type,
            size: file.size,
            uploader_id: file.uploader_id,
            conversation_id: file.conversation_id,
            access_level: file.access_level,
            file_path: file.file_path,
            encryption_key_hash: file.encryption_key_hash,
            checksum: file.checksum.unwrap_or_default(),
            expires_at: file.expires_at,
            created_at: file.created_at,
            download_count: file.download_count,
        })
    }

    /// Get download URL for encrypted file
    pub async fn get_download_url(
        &self,
        file_id: Uuid,
        user_id: Uuid,
    ) -> Result<String, VaultError> {
        // Verify access
        let _metadata = self.get_file_metadata(file_id, user_id).await?;

        // Increment download count
        sqlx::query!(
            "UPDATE files SET download_count = download_count + 1 WHERE id = $1",
            file_id
        )
        .execute(&self.db)
        .await?;

        // Generate download token (expires in 15 minutes)
        let download_token = self.encryption_service.generate_secure_token();
        let expires_at = Utc::now() + Duration::minutes(15);

        sqlx::query!(
            r#"
            INSERT INTO download_tokens (token, file_id, user_id, expires_at)
            VALUES ($1, $2, $3, $4)
            "#,
            download_token,
            file_id,
            user_id,
            expires_at
        )
        .execute(&self.db)
        .await
        .unwrap_or_default(); // Ignore if table doesn't exist

        // Log download activity
        self.security_service.log_security_event(
            Some(user_id),
            "file_download_requested".to_string(),
            None,
            None,
            Some(serde_json::json!({
                "file_id": file_id,
                "download_token": download_token
            })),
        ).await;

        Ok(format!("https://api.thecircle.local/vault/download/{}", download_token))
    }

    /// List files accessible to user
    pub async fn list_user_files(
        &self,
        user_id: Uuid,
        conversation_id: Option<Uuid>,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<FileMetadata>, VaultError> {
        let files = match conversation_id {
            Some(conv_id) => {
                sqlx::query!(
                    r#"
                    SELECT f.* FROM files f
                    WHERE f.conversation_id = $1 
                      AND f.status = 'completed'
                      AND (
                          f.uploader_id = $2 
                          OR f.access_level IN ('public', 'conversation')
                      )
                    ORDER BY f.created_at DESC
                    LIMIT $3 OFFSET $4
                    "#,
                    conv_id,
                    user_id,
                    limit,
                    offset
                )
                .fetch_all(&self.db)
                .await?
            }
            None => {
                sqlx::query!(
                    r#"
                    SELECT f.* FROM files f
                    LEFT JOIN conversation_participants cp ON f.conversation_id = cp.conversation_id
                    WHERE f.status = 'completed'
                      AND (
                          f.uploader_id = $1 
                          OR f.access_level = 'public'
                          OR (f.access_level = 'conversation' AND cp.user_id = $1)
                      )
                    ORDER BY f.created_at DESC
                    LIMIT $2 OFFSET $3
                    "#,
                    user_id,
                    limit,
                    offset
                )
                .fetch_all(&self.db)
                .await?
            }
        };

        Ok(files.into_iter().map(|f| FileMetadata {
            id: f.id,
            filename: f.filename,
            content_type: f.content_type,
            size: f.size,
            uploader_id: f.uploader_id,
            conversation_id: f.conversation_id,
            access_level: f.access_level,
            file_path: f.file_path,
            encryption_key_hash: f.encryption_key_hash,
            checksum: f.checksum.unwrap_or_default(),
            expires_at: f.expires_at,
            created_at: f.created_at,
            download_count: f.download_count,
        }).collect())
    }

    /// Delete a file (with access control)
    pub async fn delete_file(
        &self,
        file_id: Uuid,
        user_id: Uuid,
    ) -> Result<(), VaultError> {
        // Check if user can delete (must be owner or admin)
        let file = sqlx::query!(
            "SELECT uploader_id FROM files WHERE id = $1",
            file_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or(VaultError::FileNotFound)?;

        if file.uploader_id != user_id {
            return Err(VaultError::AccessDenied);
        }

        // Soft delete
        sqlx::query!(
            "UPDATE files SET status = 'deleted', deleted_at = NOW() WHERE id = $1",
            file_id
        )
        .execute(&self.db)
        .await?;

        // Log deletion
        self.security_service.log_security_event(
            Some(user_id),
            "file_deleted".to_string(),
            None,
            None,
            Some(serde_json::json!({
                "file_id": file_id
            })),
        ).await;

        Ok(())
    }

    /// Validate upload request
    async fn validate_upload_request(
        &self,
        request: &FileUploadRequest,
        user_id: Uuid,
    ) -> Result<(), VaultError> {
        // Check file size limits (100MB max)
        if request.size > 100 * 1024 * 1024 {
            return Err(VaultError::QuotaExceeded);
        }

        // Check user quota (1GB total)
        let user_usage = sqlx::query!(
            "SELECT COALESCE(SUM(size), 0) as total_size FROM files WHERE uploader_id = $1 AND status = 'completed'",
            user_id
        )
        .fetch_one(&self.db)
        .await?;

        if user_usage.total_size.unwrap_or(0) + request.size > 1024 * 1024 * 1024 {
            return Err(VaultError::QuotaExceeded);
        }

        // Validate conversation access if specified
        if let Some(conv_id) = request.conversation_id {
            let is_participant = sqlx::query!(
                "SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2",
                conv_id,
                user_id
            )
            .fetch_optional(&self.db)
            .await?
            .is_some();

            if !is_participant {
                return Err(VaultError::AccessDenied);
            }
        }

        Ok(())
    }
}
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use validator::Validate;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub password_hash: String,
    pub membership_tier: String,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub last_login: Option<DateTime<Utc>>,
    pub failed_login_attempts: Option<i32>,
    pub account_locked_until: Option<DateTime<Utc>>,
    pub destruction_key: Option<String>,
    pub biometric_hash: Option<String>,
    pub mfa_enabled: Option<bool>,
    pub mfa_secret: Option<String>,
    pub is_active: Option<bool>,
    pub email_verified: Option<bool>,
    pub email_verification_token: Option<String>,
    pub password_reset_token: Option<String>,
    pub password_reset_expires: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserPublic {
    pub id: Uuid,
    pub email: String,
    pub membership_tier: String,
    pub created_at: DateTime<Utc>,
    pub last_login: Option<DateTime<Utc>>,
    pub mfa_enabled: bool,
    pub email_verified: bool,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateUserRequest {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 8, max = 128))]
    pub password: String,
    pub membership_tier: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email)]
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserRequest {
    pub membership_tier: Option<String>,
    pub mfa_enabled: Option<bool>,
}

impl User {
    pub fn to_public(&self) -> UserPublic {
        UserPublic {
            id: self.id,
            email: self.email.clone(),
            membership_tier: self.membership_tier.clone(),
            created_at: self.created_at.unwrap_or_else(|| Utc::now()),
            last_login: self.last_login,
            mfa_enabled: self.mfa_enabled.unwrap_or(false),
            email_verified: self.email_verified.unwrap_or(false),
        }
    }
    
    pub fn is_locked(&self) -> bool {
        if let Some(locked_until) = self.account_locked_until {
            locked_until > Utc::now()
        } else {
            false
        }
    }
    
    pub fn should_trigger_destruction(&self) -> bool {
        self.failed_login_attempts.unwrap_or(0) >= 5 // Configurable threshold
    }
}
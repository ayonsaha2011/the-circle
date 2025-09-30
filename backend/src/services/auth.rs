use crate::models::{User, CreateUserRequest, LoginRequest, UserPublic};
use crate::services::SecurityService;
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier, password_hash::SaltString};
use chrono::{DateTime, Duration, Utc};
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use base64::engine::general_purpose::STANDARD as BASE64_ENGINE;
use base64::Engine;
use ring::rand::{SecureRandom, SystemRandom};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::net::IpAddr;
use ipnetwork::IpNetwork;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct AuthService {
    db: PgPool,
    argon2: Argon2<'static>,
    jwt_secret: String,
    jwt_expiration: u64,
    security_service: SecurityService,
    rng: SystemRandom,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // Subject (user ID)
    pub exp: usize,  // Expiration time
    pub iat: usize,  // Issued at
    pub membership_tier: String,
    pub mfa_verified: bool,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub user: UserPublic,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct LoginStep {
    pub step: u8,
    pub session_id: String,
    pub expires_at: DateTime<Utc>,
    pub requires_mfa: bool,
    pub message: String,
}

#[derive(Debug)]
pub enum AuthError {
    InvalidCredentials,
    UserNotFound,
    AccountLocked,
    EmailNotVerified,
    MfaRequired,
    InvalidToken,
    DatabaseError(sqlx::Error),
    HashingError,
    TokenGenerationError,
    DestructionTriggered,
    UserAlreadyExists,
}

impl std::fmt::Display for AuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuthError::InvalidCredentials => write!(f, "Invalid credentials"),
            AuthError::UserNotFound => write!(f, "User not found"),
            AuthError::AccountLocked => write!(f, "Account is locked"),
            AuthError::EmailNotVerified => write!(f, "Email not verified"),
            AuthError::MfaRequired => write!(f, "MFA verification required"),
            AuthError::InvalidToken => write!(f, "Invalid token"),
            AuthError::DatabaseError(e) => write!(f, "Database error: {}", e),
            AuthError::HashingError => write!(f, "Password hashing error"),
            AuthError::TokenGenerationError => write!(f, "Token generation error"),
            AuthError::DestructionTriggered => write!(f, "Account destruction triggered"),
            AuthError::UserAlreadyExists => write!(f, "User already exists"),
        }
    }
}

impl std::error::Error for AuthError {}

impl From<sqlx::Error> for AuthError {
    fn from(err: sqlx::Error) -> Self {
        AuthError::DatabaseError(err)
    }
}

impl AuthService {
    pub fn new(
        db: PgPool,
        jwt_secret: String,
        jwt_expiration: u64,
        security_service: SecurityService,
    ) -> Self {
        Self {
            db,
            argon2: Argon2::default(),
            jwt_secret,
            jwt_expiration,
            security_service,
            rng: SystemRandom::new(),
        }
    }

    pub async fn register_user(&self, request: CreateUserRequest) -> Result<User, AuthError> {
        // Check if user already exists
        if self.find_user_by_email(&request.email).await.is_ok() {
            return Err(AuthError::UserAlreadyExists);
        }

        // Hash password
        let password_hash = self.hash_password(&request.password)?;
        
        // Generate email verification token
        let verification_token = self.generate_secure_token();
        
        // Insert user
        let user = sqlx::query_as!(
            User,
            r#"
            INSERT INTO users (email, password_hash, membership_tier, email_verification_token)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
            request.email,
            password_hash,
            request.membership_tier.unwrap_or_else(|| "basic".to_string()),
            verification_token
        )
        .fetch_one(&self.db)
        .await?;

        // Log security event
        self.security_service
            .log_security_event(
                Some(user.id),
                "user_registered".to_string(),
                None,
                None,
                None,
            )
            .await;

        Ok(user)
    }

    pub async fn initiate_login(&self, email: &str, ip_address: Option<IpAddr>) -> Result<LoginStep, AuthError> {
        let user = self.find_user_by_email(email).await?;
        
        // Check if account is locked
        if user.is_locked() {
            return Err(AuthError::AccountLocked);
        }

        // For basic implementation, we'll simplify the 3-step process
        // In production, this would create a temporary session
        let session_id = self.generate_secure_token();
        let expires_at = Utc::now() + Duration::minutes(5);

        Ok(LoginStep {
            step: 1,
            session_id,
            expires_at,
            requires_mfa: user.mfa_enabled.unwrap_or(false),
            message: "Enter your password".to_string(),
        })
    }

    pub async fn complete_login(&self, request: LoginRequest, ip_address: Option<IpAddr>, user_agent: Option<String>) -> Result<LoginResponse, AuthError> {
        let user = self.find_user_by_email(&request.email).await?;
        
        // Verify password
        if !self.verify_password(&request.password, &user.password_hash) {
            // Increment failed attempts
            let failed_count = self.increment_failed_attempts(user.id, ip_address).await?;
            return Err(AuthError::InvalidCredentials);
        }

        // Check if account is locked (could have been locked during failed attempt check)
        if user.is_locked() {
            return Err(AuthError::AccountLocked);
        }

        // Generate JWT tokens
        let access_token = self.generate_access_token(&user)?;
        let refresh_token = self.generate_refresh_token();
        let expires_at = Utc::now() + Duration::seconds(self.jwt_expiration as i64);

        // Create session record
        sqlx::query!(
            r#"
            INSERT INTO user_sessions (user_id, session_token, refresh_token, expires_at, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
            user.id,
            access_token,
            refresh_token,
            expires_at,
            ip_address.map(|ip| IpNetwork::from(ip)),
            user_agent
        )
        .execute(&self.db)
        .await?;

        // Update last login and reset failed attempts
        sqlx::query!(
            "UPDATE users SET last_login = NOW(), failed_login_attempts = 0 WHERE id = $1",
            user.id
        )
        .execute(&self.db)
        .await?;

        // Log successful login
        self.security_service
            .log_security_event(
                Some(user.id),
                "login_success".to_string(),
                ip_address,
                user_agent,
                None,
            )
            .await;

        Ok(LoginResponse {
            access_token,
            refresh_token,
            user: user.to_public(),
            expires_at,
        })
    }

    pub async fn find_user_by_email(&self, email: &str) -> Result<User, AuthError> {
        sqlx::query_as!(User, "SELECT * FROM users WHERE email = $1", email)
            .fetch_one(&self.db)
            .await
            .map_err(|e| match e {
                sqlx::Error::RowNotFound => AuthError::UserNotFound,
                _ => AuthError::DatabaseError(e),
            })
    }

    pub async fn increment_failed_attempts(&self, user_id: Uuid, ip_address: Option<IpAddr>) -> Result<i32, AuthError> {
        let result = sqlx::query!(
            r#"
            UPDATE users 
            SET failed_login_attempts = failed_login_attempts + 1,
                account_locked_until = CASE 
                    WHEN failed_login_attempts + 1 >= 3 THEN NOW() + INTERVAL '15 minutes'
                    ELSE account_locked_until
                END
            WHERE id = $1
            RETURNING failed_login_attempts
            "#,
            user_id
        )
        .fetch_one(&self.db)
        .await?;

        let failed_count = result.failed_login_attempts;

        // Log failed login attempt
        self.security_service
            .log_security_event(
                Some(user_id),
                "login_failed".to_string(),
                ip_address,
                None,
                Some(serde_json::json!({
                    "failed_attempts": failed_count
                })),
            )
            .await;

        // Check if destruction should be triggered
        if failed_count.unwrap_or(0) >= 5 {
            if let Err(e) = self.security_service
                .trigger_destruction(user_id, "failed_login_threshold".to_string())
                .await {
                tracing::error!("Failed to trigger destruction: {:?}", e);
            }
            return Err(AuthError::DestructionTriggered);
        }

        Ok(failed_count.unwrap_or(0))
    }

    fn hash_password(&self, password: &str) -> Result<String, AuthError> {
        let salt = SaltString::generate(&mut rand::thread_rng());
        
        self.argon2
            .hash_password(password.as_bytes(), &salt)
            .map(|hash| hash.to_string())
            .map_err(|_| AuthError::HashingError)
    }

    fn verify_password(&self, password: &str, hash: &str) -> bool {
        if let Ok(parsed_hash) = PasswordHash::new(hash) {
            self.argon2.verify_password(password.as_bytes(), &parsed_hash).is_ok()
        } else {
            false
        }
    }

    fn generate_access_token(&self, user: &User) -> Result<String, AuthError> {
        let now = Utc::now();
        let claims = Claims {
            sub: user.id.to_string(),
            exp: (now + Duration::seconds(self.jwt_expiration as i64)).timestamp() as usize,
            iat: now.timestamp() as usize,
            membership_tier: user.membership_tier.clone(),
            mfa_verified: !user.mfa_enabled.unwrap_or(false), // If MFA is disabled, consider it verified
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.jwt_secret.as_ref()),
        )
        .map_err(|_| AuthError::TokenGenerationError)
    }

    fn generate_refresh_token(&self) -> String {
        self.generate_secure_token()
    }

    fn generate_secure_token(&self) -> String {
        let mut bytes = [0u8; 32];
        self.rng.fill(&mut bytes).unwrap();
        BASE64_ENGINE.encode(&bytes)
    }

    pub fn verify_token(&self, token: &str) -> Result<Claims, AuthError> {
        decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_ref()),
            &Validation::default(),
        )
        .map(|token_data| token_data.claims)
        .map_err(|_| AuthError::InvalidToken)
    }
}
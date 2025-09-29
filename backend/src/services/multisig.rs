use crate::models::*;
use crate::services::{EncryptionService, SecurityService};
use chrono::{DateTime, Duration, Utc};
use ed25519_dalek::{Keypair, PublicKey, SecretKey, Signature, Signer, Verifier};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct MultisigService {
    db: PgPool,
    encryption_service: EncryptionService,
    security_service: SecurityService,
}

#[derive(Debug)]
pub enum MultisigError {
    DatabaseError(sqlx::Error),
    InvalidSignature,
    InsufficientSignatures,
    TransactionExpired,
    UnauthorizedSigner,
    WalletNotFound,
    TransactionNotFound,
    AlreadySigned,
    InvalidTransaction,
}

impl std::fmt::Display for MultisigError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MultisigError::DatabaseError(e) => write!(f, "Database error: {}", e),
            MultisigError::InvalidSignature => write!(f, "Invalid signature"),
            MultisigError::InsufficientSignatures => write!(f, "Insufficient signatures"),
            MultisigError::TransactionExpired => write!(f, "Transaction has expired"),
            MultisigError::UnauthorizedSigner => write!(f, "Unauthorized signer"),
            MultisigError::WalletNotFound => write!(f, "Multisig wallet not found"),
            MultisigError::TransactionNotFound => write!(f, "Transaction not found"),
            MultisigError::AlreadySigned => write!(f, "Already signed by this user"),
            MultisigError::InvalidTransaction => write!(f, "Invalid transaction"),
        }
    }
}

impl std::error::Error for MultisigError {}

impl From<sqlx::Error> for MultisigError {
    fn from(err: sqlx::Error) -> Self {
        MultisigError::DatabaseError(err)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MultisigWallet {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub required_signatures: i32,
    pub total_signers: i32,
    pub wallet_type: String,
    pub is_active: bool,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateWalletRequest {
    pub name: String,
    pub description: Option<String>,
    pub required_signatures: i32,
    pub signers: Vec<SignerInfo>,
    pub wallet_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SignerInfo {
    pub user_id: Uuid,
    pub public_key: String,
    pub role: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MultisigTransaction {
    pub id: Uuid,
    pub wallet_id: Uuid,
    pub transaction_type: String,
    pub payload: serde_json::Value,
    pub payload_hash: String,
    pub required_signatures: i32,
    pub current_signatures: i32,
    pub status: String,
    pub initiated_by: Uuid,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTransactionRequest {
    pub wallet_id: Uuid,
    pub transaction_type: String,
    pub payload: serde_json::Value,
    pub expires_in_hours: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SignTransactionRequest {
    pub signature: String,
    pub public_key: String,
}

impl MultisigService {
    pub fn new(db: PgPool, encryption_service: EncryptionService, security_service: SecurityService) -> Self {
        Self {
            db,
            encryption_service,
            security_service,
        }
    }

    /// Create a new multisig wallet
    pub async fn create_wallet(
        &self,
        creator_id: Uuid,
        request: CreateWalletRequest,
    ) -> Result<MultisigWallet, MultisigError> {
        if request.required_signatures > request.signers.len() as i32 {
            return Err(MultisigError::InvalidTransaction);
        }

        let wallet_id = Uuid::new_v4();
        let mut tx = self.db.begin().await?;

        // Create wallet
        let wallet = sqlx::query_as!(
            MultisigWallet,
            r#"
            INSERT INTO multisig_wallets (id, name, description, required_signatures, total_signers, wallet_type, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            "#,
            wallet_id,
            request.name,
            request.description,
            request.required_signatures,
            request.signers.len() as i32,
            request.wallet_type,
            creator_id
        )
        .fetch_one(&mut *tx)
        .await?;

        // Add signers
        for signer in request.signers {
            sqlx::query!(
                r#"
                INSERT INTO multisig_signers (wallet_id, user_id, public_key, role, added_by)
                VALUES ($1, $2, $3, $4, $5)
                "#,
                wallet_id,
                signer.user_id,
                signer.public_key,
                signer.role,
                creator_id
            )
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;

        // Log wallet creation
        self.security_service.log_security_event(
            Some(creator_id),
            "multisig_wallet_created".to_string(),
            None,
            None,
            Some(serde_json::json!({
                "wallet_id": wallet_id,
                "wallet_type": request.wallet_type,
                "required_signatures": request.required_signatures,
                "total_signers": request.signers.len()
            })),
        ).await;

        Ok(wallet)
    }

    /// Create a new multisig transaction
    pub async fn create_transaction(
        &self,
        initiator_id: Uuid,
        request: CreateTransactionRequest,
    ) -> Result<MultisigTransaction, MultisigError> {
        // Verify user is authorized for this wallet
        let signer = sqlx::query!(
            r#"
            SELECT role FROM multisig_signers 
            WHERE wallet_id = $1 AND user_id = $2 AND is_active = true
            "#,
            request.wallet_id,
            initiator_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or(MultisigError::UnauthorizedSigner)?;

        // Get wallet details
        let wallet = sqlx::query_as!(
            MultisigWallet,
            "SELECT * FROM multisig_wallets WHERE id = $1 AND is_active = true",
            request.wallet_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or(MultisigError::WalletNotFound)?;

        let transaction_id = Uuid::new_v4();
        let payload_hash = self.calculate_payload_hash(&request.payload);
        let expires_at = request.expires_in_hours.map(|hours| {
            Utc::now() + Duration::hours(hours as i64)
        });

        let transaction = sqlx::query_as!(
            MultisigTransaction,
            r#"
            INSERT INTO multisig_transactions (
                id, wallet_id, transaction_type, payload, payload_hash, 
                required_signatures, initiated_by, expires_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
            transaction_id,
            request.wallet_id,
            request.transaction_type,
            request.payload,
            payload_hash,
            wallet.required_signatures,
            initiator_id,
            expires_at
        )
        .fetch_one(&self.db)
        .await?;

        // Log transaction creation
        self.security_service.log_security_event(
            Some(initiator_id),
            "multisig_transaction_created".to_string(),
            None,
            None,
            Some(serde_json::json!({
                "transaction_id": transaction_id,
                "wallet_id": request.wallet_id,
                "transaction_type": request.transaction_type,
                "payload_hash": payload_hash
            })),
        ).await;

        Ok(transaction)
    }

    /// Sign a multisig transaction
    pub async fn sign_transaction(
        &self,
        transaction_id: Uuid,
        signer_id: Uuid,
        request: SignTransactionRequest,
    ) -> Result<MultisigTransaction, MultisigError> {
        let mut tx = self.db.begin().await?;

        // Get transaction details
        let transaction = sqlx::query_as!(
            MultisigTransaction,
            "SELECT * FROM multisig_transactions WHERE id = $1",
            transaction_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(MultisigError::TransactionNotFound)?;

        // Check if transaction is still valid
        if transaction.status != "pending" {
            return Err(MultisigError::InvalidTransaction);
        }

        if let Some(expires_at) = transaction.expires_at {
            if Utc::now() > expires_at {
                return Err(MultisigError::TransactionExpired);
            }
        }

        // Verify signer is authorized
        let signer = sqlx::query!(
            r#"
            SELECT public_key FROM multisig_signers 
            WHERE wallet_id = $1 AND user_id = $2 AND is_active = true
            "#,
            transaction.wallet_id,
            signer_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(MultisigError::UnauthorizedSigner)?;

        // Check if already signed
        let existing_signature = sqlx::query!(
            "SELECT id FROM multisig_signatures WHERE transaction_id = $1 AND signer_id = $2",
            transaction_id,
            signer_id
        )
        .fetch_optional(&mut *tx)
        .await?;

        if existing_signature.is_some() {
            return Err(MultisigError::AlreadySigned);
        }

        // Verify signature
        if !self.verify_signature(
            &transaction.payload_hash,
            &request.signature,
            &request.public_key,
        )? {
            return Err(MultisigError::InvalidSignature);
        }

        // Verify public key matches signer
        if signer.public_key != request.public_key {
            return Err(MultisigError::InvalidSignature);
        }

        // Add signature
        sqlx::query!(
            r#"
            INSERT INTO multisig_signatures (transaction_id, signer_id, signature_data, signature_algorithm)
            VALUES ($1, $2, $3, $4)
            "#,
            transaction_id,
            signer_id,
            request.signature,
            "ed25519"
        )
        .execute(&mut *tx)
        .await?;

        // Update signature count
        let updated_transaction = sqlx::query_as!(
            MultisigTransaction,
            r#"
            UPDATE multisig_transactions 
            SET current_signatures = current_signatures + 1,
                status = CASE 
                    WHEN current_signatures + 1 >= required_signatures THEN 'approved'
                    ELSE 'pending'
                END
            WHERE id = $1
            RETURNING *
            "#,
            transaction_id
        )
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;

        // Log signature
        self.security_service.log_security_event(
            Some(signer_id),
            "multisig_transaction_signed".to_string(),
            None,
            None,
            Some(serde_json::json!({
                "transaction_id": transaction_id,
                "current_signatures": updated_transaction.current_signatures,
                "required_signatures": updated_transaction.required_signatures,
                "status": updated_transaction.status
            })),
        ).await;

        // Execute transaction if enough signatures
        if updated_transaction.status == "approved" {
            self.execute_transaction(transaction_id).await?;
        }

        Ok(updated_transaction)
    }

    /// Execute an approved multisig transaction
    async fn execute_transaction(&self, transaction_id: Uuid) -> Result<(), MultisigError> {
        let transaction = sqlx::query_as!(
            MultisigTransaction,
            "SELECT * FROM multisig_transactions WHERE id = $1",
            transaction_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or(MultisigError::TransactionNotFound)?;

        if transaction.status != "approved" {
            return Err(MultisigError::InvalidTransaction);
        }

        // Execute based on transaction type
        match transaction.transaction_type.as_str() {
            "auth" => self.execute_auth_transaction(&transaction).await?,
            "governance" => self.execute_governance_transaction(&transaction).await?,
            "treasury" => self.execute_treasury_transaction(&transaction).await?,
            "emergency" => self.execute_emergency_transaction(&transaction).await?,
            _ => return Err(MultisigError::InvalidTransaction),
        }

        // Mark as executed
        sqlx::query!(
            r#"
            UPDATE multisig_transactions 
            SET status = 'executed', executed_at = NOW()
            WHERE id = $1
            "#,
            transaction_id
        )
        .execute(&self.db)
        .await?;

        // Log execution
        self.security_service.log_security_event(
            None,
            "multisig_transaction_executed".to_string(),
            None,
            None,
            Some(serde_json::json!({
                "transaction_id": transaction_id,
                "transaction_type": transaction.transaction_type
            })),
        ).await;

        Ok(())
    }

    async fn execute_auth_transaction(&self, transaction: &MultisigTransaction) -> Result<(), MultisigError> {
        // Implementation for auth transactions (role changes, permissions, etc.)
        // This would integrate with the RBAC system
        Ok(())
    }

    async fn execute_governance_transaction(&self, transaction: &MultisigTransaction) -> Result<(), MultisigError> {
        // Implementation for governance transactions (proposal execution, parameter changes)
        Ok(())
    }

    async fn execute_treasury_transaction(&self, transaction: &MultisigTransaction) -> Result<(), MultisigError> {
        // Implementation for treasury transactions (fund transfers, payments)
        Ok(())
    }

    async fn execute_emergency_transaction(&self, transaction: &MultisigTransaction) -> Result<(), MultisigError> {
        // Implementation for emergency transactions (system lockdown, data destruction)
        Ok(())
    }

    /// Get wallet details with signers
    pub async fn get_wallet(&self, wallet_id: Uuid, user_id: Uuid) -> Result<serde_json::Value, MultisigError> {
        // Verify user has access to this wallet
        let _signer = sqlx::query!(
            "SELECT id FROM multisig_signers WHERE wallet_id = $1 AND user_id = $2",
            wallet_id,
            user_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or(MultisigError::UnauthorizedSigner)?;

        let wallet = sqlx::query!(
            r#"
            SELECT mw.*, 
                   json_agg(
                       json_build_object(
                           'user_id', ms.user_id,
                           'public_key', ms.public_key,
                           'role', ms.role,
                           'is_active', ms.is_active
                       )
                   ) as signers
            FROM multisig_wallets mw
            LEFT JOIN multisig_signers ms ON mw.id = ms.wallet_id
            WHERE mw.id = $1
            GROUP BY mw.id
            "#,
            wallet_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or(MultisigError::WalletNotFound)?;

        Ok(serde_json::json!({
            "id": wallet.id,
            "name": wallet.name,
            "description": wallet.description,
            "required_signatures": wallet.required_signatures,
            "total_signers": wallet.total_signers,
            "wallet_type": wallet.wallet_type,
            "is_active": wallet.is_active,
            "signers": wallet.signers
        }))
    }

    /// List pending transactions for a user
    pub async fn get_pending_transactions(&self, user_id: Uuid) -> Result<Vec<MultisigTransaction>, MultisigError> {
        let transactions = sqlx::query_as!(
            MultisigTransaction,
            r#"
            SELECT mt.* FROM multisig_transactions mt
            JOIN multisig_signers ms ON mt.wallet_id = ms.wallet_id
            WHERE ms.user_id = $1 
              AND mt.status = 'pending'
              AND (mt.expires_at IS NULL OR mt.expires_at > NOW())
              AND NOT EXISTS (
                  SELECT 1 FROM multisig_signatures mss 
                  WHERE mss.transaction_id = mt.id AND mss.signer_id = $1
              )
            ORDER BY mt.created_at ASC
            "#,
            user_id
        )
        .fetch_all(&self.db)
        .await?;

        Ok(transactions)
    }

    fn calculate_payload_hash(&self, payload: &serde_json::Value) -> String {
        use sha2::{Digest, Sha256};
        let payload_str = serde_json::to_string(payload).unwrap_or_default();
        let mut hasher = Sha256::new();
        hasher.update(payload_str.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    fn verify_signature(
        &self,
        message: &str,
        signature_hex: &str,
        public_key_hex: &str,
    ) -> Result<bool, MultisigError> {
        use hex;

        let public_key_bytes = hex::decode(public_key_hex)
            .map_err(|_| MultisigError::InvalidSignature)?;
        let signature_bytes = hex::decode(signature_hex)
            .map_err(|_| MultisigError::InvalidSignature)?;

        let public_key = PublicKey::from_bytes(&public_key_bytes)
            .map_err(|_| MultisigError::InvalidSignature)?;
        let signature = Signature::from_bytes(&signature_bytes)
            .map_err(|_| MultisigError::InvalidSignature)?;

        match public_key.verify(message.as_bytes(), &signature) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }
}
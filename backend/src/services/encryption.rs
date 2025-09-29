use base64::Engine;
use aes_gcm::{Aes256Gcm, Key, Nonce, KeyInit};
use aes_gcm::aead::{Aead, OsRng};
use hkdf::Hkdf;
use sha2::Sha256;
use ring::rand::{SecureRandom, SystemRandom};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct EncryptionService {
    rng: SystemRandom,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptionMetadata {
    pub nonce: Vec<u8>,
    pub salt: Vec<u8>,
    pub key_id: String, // For key rotation
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptedData {
    pub ciphertext: Vec<u8>,
    pub metadata: EncryptionMetadata,
}

#[derive(Debug)]
pub enum EncryptionError {
    KeyGenerationFailed,
    EncryptionFailed,
    DecryptionFailed,
    InvalidMetadata,
    SerializationError,
}

impl std::fmt::Display for EncryptionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EncryptionError::KeyGenerationFailed => write!(f, "Key generation failed"),
            EncryptionError::EncryptionFailed => write!(f, "Encryption failed"),
            EncryptionError::DecryptionFailed => write!(f, "Decryption failed"),
            EncryptionError::InvalidMetadata => write!(f, "Invalid encryption metadata"),
            EncryptionError::SerializationError => write!(f, "Serialization error"),
        }
    }
}

impl std::error::Error for EncryptionError {}

impl EncryptionService {
    pub fn new() -> Self {
        Self {
            rng: SystemRandom::new(),
        }
    }

    /// Generate a new 256-bit encryption key
    pub fn generate_key(&self) -> Result<Vec<u8>, EncryptionError> {
        let mut key = [0u8; 32];
        self.rng.fill(&mut key).map_err(|_| EncryptionError::KeyGenerationFailed)?;
        Ok(key.to_vec())
    }

    /// Generate a conversation-specific encryption key using HKDF
    pub fn derive_conversation_key(&self, master_key: &[u8], conversation_id: &Uuid) -> Result<Vec<u8>, EncryptionError> {
        let salt = conversation_id.as_bytes();
        let info = b"circle_conversation_key";
        
        let hk = Hkdf::<Sha256>::new(Some(salt), master_key);
        let mut okm = [0u8; 32];
        hk.expand(info, &mut okm).map_err(|_| EncryptionError::KeyGenerationFailed)?;
        
        Ok(okm.to_vec())
    }

    /// Encrypt data using AES-256-GCM
    pub fn encrypt(&self, data: &[u8], key: &[u8]) -> Result<EncryptedData, EncryptionError> {
        if key.len() != 32 {
            return Err(EncryptionError::KeyGenerationFailed);
        }

        // Generate random nonce
        let mut nonce_bytes = [0u8; 12];
        self.rng.fill(&mut nonce_bytes).map_err(|_| EncryptionError::EncryptionFailed)?;
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Generate salt for key derivation
        let mut salt = [0u8; 32];
        self.rng.fill(&mut salt).map_err(|_| EncryptionError::EncryptionFailed)?;

        // Create cipher
        let key = Key::<Aes256Gcm>::from_slice(key);
        let cipher = Aes256Gcm::new(key);

        // Encrypt
        let ciphertext = cipher
            .encrypt(nonce, data)
            .map_err(|_| EncryptionError::EncryptionFailed)?;

        let metadata = EncryptionMetadata {
            nonce: nonce_bytes.to_vec(),
            salt: salt.to_vec(),
            key_id: Uuid::new_v4().to_string(),
        };

        Ok(EncryptedData {
            ciphertext,
            metadata,
        })
    }

    /// Decrypt data using AES-256-GCM
    pub fn decrypt(&self, encrypted_data: &EncryptedData, key: &[u8]) -> Result<Vec<u8>, EncryptionError> {
        if key.len() != 32 {
            return Err(EncryptionError::DecryptionFailed);
        }

        let nonce = Nonce::from_slice(&encrypted_data.metadata.nonce);
        let key = Key::<Aes256Gcm>::from_slice(key);
        let cipher = Aes256Gcm::new(key);

        cipher
            .decrypt(nonce, encrypted_data.ciphertext.as_ref())
            .map_err(|_| EncryptionError::DecryptionFailed)
    }

    /// Encrypt a message for storage
    pub fn encrypt_message(&self, content: &str, conversation_key: &[u8]) -> Result<String, EncryptionError> {
        let encrypted = self.encrypt(content.as_bytes(), conversation_key)?;
        let serialized = serde_json::to_string(&encrypted)
            .map_err(|_| EncryptionError::SerializationError)?;
        Ok(base64::engine::general_purpose::STANDARD.encode(serialized))
    }

    /// Decrypt a message from storage
    pub fn decrypt_message(&self, encrypted_content: &str, conversation_key: &[u8]) -> Result<String, EncryptionError> {
        let decoded = base64::engine::general_purpose::STANDARD.decode(encrypted_content)
            .map_err(|_| EncryptionError::InvalidMetadata)?;
        
        let encrypted_data: EncryptedData = serde_json::from_slice(&decoded)
            .map_err(|_| EncryptionError::InvalidMetadata)?;

        let decrypted = self.decrypt(&encrypted_data, conversation_key)?;
        String::from_utf8(decrypted).map_err(|_| EncryptionError::DecryptionFailed)
    }

    /// Generate file encryption metadata
    pub fn generate_file_encryption_metadata(&self) -> Result<String, EncryptionError> {
        let key = self.generate_key()?;
        let mut nonce = [0u8; 12];
        self.rng.fill(&mut nonce).map_err(|_| EncryptionError::KeyGenerationFailed)?;
        
        let metadata = serde_json::json!({
            "key": base64::engine::general_purpose::STANDARD.encode(&key),
            "nonce": base64::engine::general_purpose::STANDARD.encode(&nonce),
            "algorithm": "AES-256-GCM",
            "key_id": Uuid::new_v4().to_string()
        });

        serde_json::to_string(&metadata).map_err(|_| EncryptionError::SerializationError)
    }

    /// Hash conversation key for database storage
    pub fn hash_conversation_key(&self, key: &[u8]) -> String {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(key);
        let result = hasher.finalize();
        base64::engine::general_purpose::STANDARD.encode(&result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let service = EncryptionService::new();
        let key = service.generate_key().unwrap();
        let data = b"Hello, secure world!";

        let encrypted = service.encrypt(data, &key).unwrap();
        let decrypted = service.decrypt(&encrypted, &key).unwrap();

        assert_eq!(data, decrypted.as_slice());
    }

    #[test]
    fn test_message_encrypt_decrypt() {
        let service = EncryptionService::new();
        let key = service.generate_key().unwrap();
        let message = "This is a secret message!";

        let encrypted = service.encrypt_message(message, &key).unwrap();
        let decrypted = service.decrypt_message(&encrypted, &key).unwrap();

        assert_eq!(message, decrypted);
    }

    #[test]
    fn test_derive_conversation_key() {
        let service = EncryptionService::new();
        let master_key = service.generate_key().unwrap();
        let conversation_id = Uuid::new_v4();

        let key1 = service.derive_conversation_key(&master_key, &conversation_id).unwrap();
        let key2 = service.derive_conversation_key(&master_key, &conversation_id).unwrap();

        assert_eq!(key1, key2); // Should be deterministic
        
        let other_conversation_id = Uuid::new_v4();
        let key3 = service.derive_conversation_key(&master_key, &other_conversation_id).unwrap();
        
        assert_ne!(key1, key3); // Different conversations should have different keys
    }
}
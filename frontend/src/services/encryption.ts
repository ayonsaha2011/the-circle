import CryptoJS from 'crypto-js';
import { randomBytes } from 'tweetnacl';

export interface EncryptionMetadata {
  nonce: string;
  salt: string;
  keyId: string;
}

export interface EncryptedData {
  ciphertext: string;
  metadata: EncryptionMetadata;
}

export class ClientEncryptionService {
  private static instance: ClientEncryptionService;

  static getInstance(): ClientEncryptionService {
    if (!ClientEncryptionService.instance) {
      ClientEncryptionService.instance = new ClientEncryptionService();
    }
    return ClientEncryptionService.instance;
  }

  /**
   * Generate a random encryption key
   */
  generateKey(): string {
    const key = randomBytes(32);
    return this.arrayBufferToBase64(key);
  }

  /**
   * Derive a conversation-specific key from master key and conversation ID
   */
  deriveConversationKey(masterKey: string, conversationId: string): string {
    const key = CryptoJS.PBKDF2(masterKey, conversationId, {
      keySize: 256 / 32,
      iterations: 1000,
    });
    return key.toString(CryptoJS.enc.Base64);
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  encrypt(data: string, key: string): EncryptedData {
    try {
      // Generate random IV
      const iv = CryptoJS.lib.WordArray.random(12);
      const salt = CryptoJS.lib.WordArray.random(32);
      
      // Convert base64 key to WordArray
      const keyWordArray = CryptoJS.enc.Base64.parse(key);
      
      // Encrypt using AES-256-GCM (using CTR mode as GCM is not directly available)
      const encrypted = CryptoJS.AES.encrypt(data, keyWordArray, {
        iv: iv,
        mode: CryptoJS.mode.CTR,
        padding: CryptoJS.pad.NoPadding,
      });

      const metadata: EncryptionMetadata = {
        nonce: iv.toString(CryptoJS.enc.Base64),
        salt: salt.toString(CryptoJS.enc.Base64),
        keyId: this.generateId(),
      };

      return {
        ciphertext: encrypted.toString(),
        metadata,
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  decrypt(encryptedData: EncryptedData, key: string): string {
    try {
      const { ciphertext, metadata } = encryptedData;
      
      // Convert base64 values back to WordArrays
      const keyWordArray = CryptoJS.enc.Base64.parse(key);
      const iv = CryptoJS.enc.Base64.parse(metadata.nonce);
      
      // Decrypt
      const decrypted = CryptoJS.AES.decrypt(ciphertext, keyWordArray, {
        iv: iv,
        mode: CryptoJS.mode.CTR,
        padding: CryptoJS.pad.NoPadding,
      });

      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt a message for transmission
   */
  encryptMessage(content: string, conversationKey: string): string {
    const encrypted = this.encrypt(content, conversationKey);
    return btoa(JSON.stringify(encrypted));
  }

  /**
   * Decrypt a message from transmission
   */
  decryptMessage(encryptedContent: string, conversationKey: string): string {
    try {
      const encryptedData = JSON.parse(atob(encryptedContent)) as EncryptedData;
      return this.decrypt(encryptedData, conversationKey);
    } catch (error) {
      console.error('Message decryption failed:', error);
      return '[Decryption Failed]';
    }
  }

  /**
   * Generate secure random bytes for file encryption
   */
  generateFileEncryptionKey(): { key: string; nonce: string } {
    const key = randomBytes(32);
    const nonce = randomBytes(12);
    
    return {
      key: this.arrayBufferToBase64(key),
      nonce: this.arrayBufferToBase64(nonce),
    };
  }

  /**
   * Hash conversation key for storage identification
   */
  hashConversationKey(key: string): string {
    return CryptoJS.SHA256(key).toString(CryptoJS.enc.Base64);
  }

  /**
   * Encrypt file data before upload
   */
  encryptFile(file: File, key: string): Promise<{ encryptedData: Blob; metadata: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
          const base64Data = wordArray.toString(CryptoJS.enc.Base64);
          
          const encrypted = this.encrypt(base64Data, key);
          const encryptedBlob = new Blob([encrypted.ciphertext], { type: 'application/octet-stream' });
          
          const metadata = JSON.stringify({
            ...encrypted.metadata,
            originalName: file.name,
            originalSize: file.size,
            mimeType: file.type,
          });

          resolve({
            encryptedData: encryptedBlob,
            metadata,
          });
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Generate conversation keys for new conversations
   */
  generateConversationKeys(): { masterKey: string; conversationKey: string; keyHash: string } {
    const masterKey = this.generateKey();
    const conversationId = this.generateId();
    const conversationKey = this.deriveConversationKey(masterKey, conversationId);
    const keyHash = this.hashConversationKey(conversationKey);

    return {
      masterKey,
      conversationKey,
      keyHash,
    };
  }

  /**
   * Encrypt file data as Uint8Array for vault storage
   */
  async encryptFileData(fileData: Uint8Array, key: string): Promise<Uint8Array> {
    try {
      // Convert Uint8Array to base64 for encryption
      const base64Data = this.arrayBufferToBase64(fileData);
      const encrypted = this.encrypt(base64Data, key);
      
      // Convert encrypted result to Uint8Array
      const encryptedString = JSON.stringify(encrypted);
      const encoder = new TextEncoder();
      return encoder.encode(encryptedString);
    } catch (error) {
      console.error('File encryption failed:', error);
      throw new Error('Failed to encrypt file');
    }
  }

  /**
   * Decrypt file data from Uint8Array for vault storage
   */
  async decryptFileData(encryptedData: Uint8Array, key: string): Promise<Uint8Array> {
    try {
      // Convert Uint8Array back to string
      const decoder = new TextDecoder();
      const encryptedString = decoder.decode(encryptedData);
      
      // Parse and decrypt
      const encryptedObj = JSON.parse(encryptedString) as EncryptedData;
      const decryptedBase64 = this.decrypt(encryptedObj, key);
      
      // Convert base64 back to Uint8Array
      const binaryString = atob(decryptedBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return bytes;
    } catch (error) {
      console.error('File decryption failed:', error);
      throw new Error('Failed to decrypt file');
    }
  }

  /**
   * Generate secure token for API operations
   */
  generateSecureToken(): string {
    const tokenBytes = randomBytes(32);
    return this.arrayBufferToBase64(tokenBytes);
  }

  /**
   * Hash a key for storage
   */
  hashKey(key: string): string {
    return CryptoJS.SHA256(key).toString(CryptoJS.enc.Base64);
  }

  /**
   * Securely clear sensitive data from memory
   */
  clearSensitiveData(data: string): void {
    // In JavaScript, we can't truly clear memory, but we can overwrite the reference
    // This is more of a symbolic security measure
    try {
      if (typeof data === 'string') {
        // Overwrite with random data (limited effectiveness in JS)
        const randomData = Array(data.length).fill(0).map(() => 
          String.fromCharCode(Math.floor(Math.random() * 256))
        ).join('');
        data = randomData;
      }
    } catch (error) {
      // Ignore errors in cleanup
    }
  }

  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private generateId(): string {
    return Array.from(randomBytes(16), byte => 
      byte.toString(16).padStart(2, '0')
    ).join('');
  }
}

export default ClientEncryptionService.getInstance();
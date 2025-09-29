import { create } from 'zustand';
import { ClientEncryptionService } from './encryption';
import apiService from './api';

// File interfaces
export interface FileMetadata {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  uploaderId: string;
  conversationId?: string;
  accessLevel: string;
  filePath: string;
  checksum: string;
  expiresAt?: string;
  createdAt: string;
  downloadCount: number;
}

export interface UploadProgress {
  fileId: string;
  filename: string;
  progress: number;
  status: 'pending' | 'encrypting' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export interface VaultState {
  files: FileMetadata[];
  uploads: Record<string, UploadProgress>;
  selectedFiles: string[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  uploadFile: (file: File, options?: UploadOptions) => Promise<void>;
  downloadFile: (fileId: string) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
  loadFiles: (conversationId?: string) => Promise<void>;
  selectFile: (fileId: string) => void;
  deselectFile: (fileId: string) => void;
  clearSelection: () => void;
  clearError: () => void;
}

export interface UploadOptions {
  conversationId?: string;
  expiresInHours?: number;
  accessLevel?: 'private' | 'conversation' | 'public';
}

class VaultService {
  private encryptionService: ClientEncryptionService;
  
  constructor() {
    this.encryptionService = ClientEncryptionService.getInstance();
  }

  async createUploadToken(file: File, options: UploadOptions = {}) {
    const response = await apiService.post('/api/vault/upload-token', {
      filename: file.name,
      contentType: file.type,
      size: file.size,
      conversationId: options.conversationId,
      expiresInHours: options.expiresInHours,
      accessLevel: options.accessLevel || 'private',
    });

    return response.data;
  }

  async encryptAndUploadFile(
    file: File, 
    uploadToken: any, 
    onProgress: (progress: number) => void
  ) {
    // Generate file encryption key
    const fileKey = this.encryptionService.generateKey();
    
    // Read file as ArrayBuffer
    const fileBuffer = await file.arrayBuffer();
    
    // Encrypt file content
    onProgress(25); // Encryption started
    const encryptedData = await this.encryptionService.encryptFileData(
      new Uint8Array(fileBuffer),
      fileKey
    );
    
    onProgress(50); // Encryption completed
    
    // Calculate checksum
    const checksum = await this.calculateChecksum(encryptedData);
    
    // Upload encrypted file
    const uploadResponse = await fetch(uploadToken.uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
      body: JSON.stringify({
        token: uploadToken.token,
        encryptedData: Array.from(encryptedData),
        checksum,
      }),
    });

    if (!uploadResponse.ok) {
      throw new Error('Upload failed');
    }

    onProgress(100); // Upload completed
    
    // Store file key for later decryption
    localStorage.setItem(`file_key_${uploadToken.fileId}`, fileKey);
    
    return uploadResponse.json();
  }

  async downloadAndDecryptFile(fileId: string, filename: string) {
    // Get download URL
    const response = await apiService.get(`/api/vault/download-url/${fileId}`);
    const downloadUrl = response.data.url;
    
    // Download encrypted file
    const downloadResponse = await fetch(downloadUrl);
    if (!downloadResponse.ok) {
      throw new Error('Download failed');
    }
    
    const encryptedData = await downloadResponse.arrayBuffer();
    
    // Get file key
    const fileKey = localStorage.getItem(`file_key_${fileId}`);
    if (!fileKey) {
      throw new Error('File decryption key not found');
    }
    
    // Decrypt file
    const decryptedData = await this.encryptionService.decryptFileData(
      new Uint8Array(encryptedData),
      fileKey
    );
    
    // Trigger download
    const blob = new Blob([decryptedData]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async getFileList(conversationId?: string, limit = 50, offset = 0) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    
    if (conversationId) {
      params.append('conversationId', conversationId);
    }
    
    const response = await apiService.get(`/api/vault/files?${params}`);
    return response.data;
  }

  async deleteFile(fileId: string) {
    await apiService.delete(`/api/vault/files/${fileId}`);
    
    // Remove stored file key
    localStorage.removeItem(`file_key_${fileId}`);
  }

  private async calculateChecksum(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// Zustand store
export const useVaultStore = create<VaultState>((set, get) => ({
  files: [],
  uploads: {},
  selectedFiles: [],
  isLoading: false,
  error: null,

  uploadFile: async (file: File, options: UploadOptions = {}) => {
    const vaultService = new VaultService();
    const fileId = Math.random().toString(36).substring(2);
    
    // Add to uploads with pending status
    set(state => ({
      uploads: {
        ...state.uploads,
        [fileId]: {
          fileId,
          filename: file.name,
          progress: 0,
          status: 'pending',
        },
      },
    }));

    try {
      // Create upload token
      set(state => ({
        uploads: {
          ...state.uploads,
          [fileId]: { ...state.uploads[fileId], status: 'encrypting' },
        },
      }));

      const uploadToken = await vaultService.createUploadToken(file, options);
      
      // Encrypt and upload
      set(state => ({
        uploads: {
          ...state.uploads,
          [fileId]: { ...state.uploads[fileId], status: 'uploading' },
        },
      }));

      await vaultService.encryptAndUploadFile(file, uploadToken, (progress) => {
        set(state => ({
          uploads: {
            ...state.uploads,
            [fileId]: { ...state.uploads[fileId], progress },
          },
        }));
      });

      // Mark as completed
      set(state => ({
        uploads: {
          ...state.uploads,
          [fileId]: { ...state.uploads[fileId], status: 'completed', progress: 100 },
        },
      }));

      // Refresh file list
      get().loadFiles(options.conversationId);

      // Remove from uploads after 3 seconds
      setTimeout(() => {
        set(state => {
          const newUploads = { ...state.uploads };
          delete newUploads[fileId];
          return { uploads: newUploads };
        });
      }, 3000);

    } catch (error: any) {
      set(state => ({
        uploads: {
          ...state.uploads,
          [fileId]: {
            ...state.uploads[fileId],
            status: 'error',
            error: error.message,
          },
        },
        error: error.message,
      }));
    }
  },

  downloadFile: async (fileId: string) => {
    const vaultService = new VaultService();
    set({ isLoading: true, error: null });

    try {
      const file = get().files.find(f => f.id === fileId);
      if (!file) {
        throw new Error('File not found');
      }

      await vaultService.downloadAndDecryptFile(fileId, file.filename);
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteFile: async (fileId: string) => {
    const vaultService = new VaultService();
    set({ isLoading: true, error: null });

    try {
      await vaultService.deleteFile(fileId);
      
      // Remove from local state
      set(state => ({
        files: state.files.filter(f => f.id !== fileId),
        selectedFiles: state.selectedFiles.filter(id => id !== fileId),
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  loadFiles: async (conversationId?: string) => {
    const vaultService = new VaultService();
    set({ isLoading: true, error: null });

    try {
      const files = await vaultService.getFileList(conversationId);
      set({ files, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  selectFile: (fileId: string) => {
    set(state => ({
      selectedFiles: [...state.selectedFiles, fileId],
    }));
  },

  deselectFile: (fileId: string) => {
    set(state => ({
      selectedFiles: state.selectedFiles.filter(id => id !== fileId),
    }));
  },

  clearSelection: () => {
    set({ selectedFiles: [] });
  },

  clearError: () => {
    set({ error: null });
  },
}));

export default VaultService;
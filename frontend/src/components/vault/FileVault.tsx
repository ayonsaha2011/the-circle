import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CloudArrowUpIcon,
  DocumentIcon,
  FolderIcon,
  TrashIcon,
  ShareIcon,
  EyeIcon,
  LockClosedIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useVaultStore, UploadOptions } from '../../services/vault';

interface FileVaultProps {
  conversationId?: string;
  onFileSelect?: (fileId: string) => void;
}

const FileVault: React.FC<FileVaultProps> = ({ conversationId, onFileSelect }) => {
  const {
    files,
    uploads,
    selectedFiles,
    isLoading,
    error,
    uploadFile,
    downloadFile,
    deleteFile,
    loadFiles,
    selectFile,
    deselectFile,
    clearSelection,
    clearError
  } = useVaultStore();

  const [dragOver, setDragOver] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFiles(conversationId);
  }, [conversationId, loadFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFileUpload(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFileUpload(files);
    }
  };

  const handleFileUpload = (filesToUpload: File[]) => {
    const uploadOptions: UploadOptions = {
      conversationId,
      accessLevel: conversationId ? 'conversation' : 'private',
      expiresInHours: 24 * 7, // 1 week default
    };

    filesToUpload.forEach(file => {
      uploadFile(file, uploadOptions);
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith('image/')) return '🖼️';
    if (contentType.startsWith('video/')) return '🎥';
    if (contentType.startsWith('audio/')) return '🎵';
    if (contentType.includes('pdf')) return '📄';
    if (contentType.includes('text')) return '📝';
    return '📎';
  };

  const getAccessLevelColor = (level: string) => {
    switch (level) {
      case 'private': return 'text-red-400 bg-red-900/20';
      case 'conversation': return 'text-blue-400 bg-blue-900/20';
      case 'public': return 'text-green-400 bg-green-900/20';
      default: return 'text-gray-400 bg-gray-900/20';
    }
  };

  // Ensure files is always an array
  const safeFiles = Array.isArray(files) ? files : [];

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-circle-dark to-gray-900">
      {/* Header */}
      <div className="flex justify-between items-center p-6 border-b border-gray-700">
        <div>
          <h2 className="text-2xl font-bold text-gradient">Secure File Vault</h2>
          <p className="text-gray-400 mt-1">
            {conversationId ? 'Conversation Files' : 'Personal Files'} • {safeFiles.length} items
          </p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary px-4 py-2 flex items-center space-x-2"
          >
            <CloudArrowUpIcon className="h-5 w-5" />
            <span>Upload</span>
          </button>
          
          {selectedFiles.length > 0 && (
            <>
              <button
                onClick={() => {
                  selectedFiles.forEach(fileId => deleteFile(fileId));
                  clearSelection();
                }}
                className="btn-danger px-4 py-2 flex items-center space-x-2"
              >
                <TrashIcon className="h-5 w-5" />
                <span>Delete ({selectedFiles.length})</span>
              </button>
              
              <button
                onClick={clearSelection}
                className="btn-secondary px-4 py-2"
              >
                Clear Selection
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-6 mt-4 p-4 bg-red-900/50 border border-red-500/50 rounded-lg flex justify-between items-center"
        >
          <div className="flex items-center space-x-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <span className="text-red-200">{error}</span>
          </div>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-300"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </motion.div>
      )}

      {/* Upload Progress */}
      {Object.keys(uploads).length > 0 && (
        <div className="mx-6 mt-4 space-y-2">
          {Object.values(uploads).map(upload => (
            <motion.div
              key={upload.fileId}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-3 bg-gray-800/50 rounded-lg border border-gray-700"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-300">{upload.filename}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  upload.status === 'completed' ? 'bg-green-900/50 text-green-400' :
                  upload.status === 'error' ? 'bg-red-900/50 text-red-400' :
                  'bg-blue-900/50 text-blue-400'
                }`}>
                  {upload.status}
                </span>
              </div>
              
              {upload.status !== 'completed' && upload.status !== 'error' && (
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <motion.div
                    className="bg-circle-blue h-2 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${upload.progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              )}
              
              {upload.error && (
                <p className="text-xs text-red-400 mt-1">{upload.error}</p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {isLoading && safeFiles.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-circle-blue"></div>
          </div>
        ) : safeFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <FolderIcon className="h-24 w-24 text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">
              No files in vault
            </h3>
            <p className="text-gray-500 mb-6">
              Drag and drop files here or click upload to add encrypted files
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary px-6 py-3"
            >
              Upload First File
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
            {safeFiles.map(file => (
              <motion.div
                key={file.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`relative p-4 rounded-lg border transition-all duration-200 cursor-pointer ${
                  selectedFiles.includes(file.id)
                    ? 'border-circle-blue bg-circle-blue/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
                onClick={() => {
                  if (selectedFiles.includes(file.id)) {
                    deselectFile(file.id);
                  } else {
                    selectFile(file.id);
                  }
                }}
              >
                {/* Selection Checkbox */}
                <div className="absolute top-2 right-2">
                  {selectedFiles.includes(file.id) ? (
                    <CheckCircleIcon className="h-5 w-5 text-circle-blue" />
                  ) : (
                    <div className="h-5 w-5 border-2 border-gray-600 rounded-full" />
                  )}
                </div>

                {/* File Icon */}
                <div className="text-4xl mb-3">
                  {getFileIcon(file.contentType)}
                </div>

                {/* File Info */}
                <h4 className="font-medium text-white mb-1 truncate" title={file.filename}>
                  {file.filename}
                </h4>
                
                <p className="text-sm text-gray-400 mb-2">
                  {formatFileSize(file.size)}
                </p>

                {/* Access Level */}
                <span className={`text-xs px-2 py-1 rounded-full ${getAccessLevelColor(file.accessLevel)}`}>
                  {file.accessLevel}
                </span>

                {/* Actions */}
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-700">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadFile(file.id);
                    }}
                    className="text-circle-blue hover:text-circle-blue/80 transition-colors"
                    title="Download"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                  
                  <span className="text-xs text-gray-500">
                    {file.downloadCount} downloads
                  </span>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFile(file.id);
                    }}
                    className="text-red-400 hover:text-red-300 transition-colors"
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />
    </div>
  );
};

export default FileVault;
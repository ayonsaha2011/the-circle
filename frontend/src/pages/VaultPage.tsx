import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import VaultDoor from '../components/vault/VaultDoor';
import FileVault from '../components/vault/FileVault';
import { 
  ShieldCheckIcon, 
  LockClosedIcon,
  ArrowLeftIcon,
  ServerIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const VaultPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [showVaultDoor, setShowVaultDoor] = useState(true);
  const [vaultUnlocking, setVaultUnlocking] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
  }, [isAuthenticated, navigate]);

  const handleEnterVault = async () => {
    setVaultUnlocking(true);
    
    // Simulate vault unlock process with security checks
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setVaultUnlocking(false);
    setShowVaultDoor(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-circle-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-circle-blue"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-circle-dark via-gray-900 to-black">
      <AnimatePresence>
        {showVaultDoor && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black"
          >
            <VaultDoor 
              onEnter={handleEnterVault} 
              isUnlocking={vaultUnlocking}
              userName={user.email}
              securityLevel="maximum"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!showVaultDoor && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="h-screen flex flex-col"
        >
          {/* Enhanced Header */}
          <div className="glass-effect border-b border-gray-800 shadow-xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-6">
                <div className="flex items-center space-x-6">
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
                  >
                    <ArrowLeftIcon className="h-5 w-5" />
                    <span>Back to Dashboard</span>
                  </button>
                  
                  <div className="h-8 w-px bg-gray-600"></div>
                  
                  <div>
                    <h1 className="text-3xl font-bold text-gradient flex items-center space-x-3">
                      <LockClosedIcon className="h-8 w-8 text-circle-blue" />
                      <span>Secure File Vault</span>
                    </h1>
                    <p className="text-gray-400 mt-1">End-to-end encrypted file storage</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6">
                  {/* Security Status */}
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-sm text-green-400 font-medium">Vault Secured</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-gray-400">
                      <ServerIcon className="h-4 w-4" />
                      <span className="text-xs">AES-256</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-gray-400">
                      <ClockIcon className="h-4 w-4" />
                      <span className="text-xs">Auto-Expire</span>
                    </div>
                  </div>
                  
                  <div className="h-8 w-px bg-gray-600"></div>
                  
                  <div className="text-right">
                    <span className="text-gray-300 text-sm">Logged in as</span>
                    <p className="text-circle-blue font-medium">{user.email}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Vault Content */}
          <div className="flex-1 overflow-hidden">
            <FileVault />
          </div>

          {/* Security Footer */}
          <div className="glass-effect border-t border-gray-800 py-4">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center text-sm text-gray-400">
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <ShieldCheckIcon className="h-4 w-4 text-circle-green" />
                    <span>Zero-knowledge encryption</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <LockClosedIcon className="h-4 w-4 text-circle-green" />
                    <span>Client-side encryption</span>
                  </div>
                </div>
                
                <div className="text-xs text-gray-500">
                  Session expires in 2 hours • Auto-save enabled
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default VaultPage;
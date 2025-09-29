import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useWebSocketStore } from '../services/websocket';
import ConversationList from '../components/messaging/ConversationList';
import ChatInterface from '../components/messaging/ChatInterface';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheckIcon, 
  LockClosedIcon, 
  KeyIcon,
  EyeSlashIcon 
} from '@heroicons/react/24/outline';

const MessagingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { connect, disconnect, isConnected, isAuthenticated: wsAuthenticated } = useWebSocketStore();
  
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showVaultDoor, setShowVaultDoor] = useState(true);
  const [vaultUnlocking, setVaultUnlocking] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Connect to WebSocket with auth token
    const token = localStorage.getItem('access_token');
    if (token && !isConnected) {
      connect(token);
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, navigate, connect, disconnect, isConnected]);

  const handleEnterVault = async () => {
    setVaultUnlocking(true);
    
    // Simulate vault unlock process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setVaultUnlocking(false);
    setShowVaultDoor(false);
  };

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
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
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black"
          >
            <VaultDoor 
              onEnter={handleEnterVault} 
              isUnlocking={vaultUnlocking}
              userName={user.email}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!showVaultDoor && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="h-screen flex"
        >
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 glass-effect border-b border-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-4">
                <div className="flex items-center space-x-4">
                  <h1 className="text-2xl font-bold text-gradient">The Circle</h1>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      isConnected && wsAuthenticated ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <span className="text-sm text-gray-400">
                      {isConnected && wsAuthenticated ? 'Secure Connection' : 'Connecting...'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <span className="text-gray-300">Welcome, {user.email}</span>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="btn-secondary px-4 py-2 text-sm"
                  >
                    Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex w-full pt-20">
            {/* Conversation List */}
            <div className="w-1/3 min-w-[300px]">
              <ConversationList
                onSelectConversation={handleSelectConversation}
                selectedConversationId={selectedConversationId}
              />
            </div>

            {/* Chat Interface */}
            <div className="flex-1">
              {selectedConversationId ? (
                <ChatInterface conversationId={selectedConversationId} />
              ) : (
                <div className="h-full flex items-center justify-center bg-gradient-to-b from-circle-gray to-circle-dark">
                  <div className="text-center">
                    <LockClosedIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Select a Conversation
                    </h3>
                    <p className="text-gray-400">
                      Choose a conversation to start secure messaging
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// Vault Door Component
interface VaultDoorProps {
  onEnter: () => void;
  isUnlocking: boolean;
  userName: string;
}

const VaultDoor: React.FC<VaultDoorProps> = ({ onEnter, isUnlocking, userName }) => {
  return (
    <div className="text-center">
      {/* Vault Door Animation */}
      <motion.div
        className="relative mx-auto mb-8"
        style={{ width: '300px', height: '300px' }}
      >
        {/* Outer Ring */}
        <motion.div
          className="absolute inset-0 border-4 border-circle-blue rounded-full"
          animate={isUnlocking ? { rotate: 360 } : {}}
          transition={{ duration: 2, ease: "linear" }}
        />
        
        {/* Inner Ring */}
        <motion.div
          className="absolute inset-8 border-2 border-circle-purple rounded-full"
          animate={isUnlocking ? { rotate: -360 } : {}}
          transition={{ duration: 1.5, ease: "linear" }}
        />
        
        {/* Center Lock */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="p-8 bg-gradient-to-r from-circle-blue to-circle-purple rounded-full"
            animate={isUnlocking ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.5, repeat: isUnlocking ? Infinity : 0 }}
          >
            {isUnlocking ? (
              <KeyIcon className="h-12 w-12 text-white" />
            ) : (
              <LockClosedIcon className="h-12 w-12 text-white" />
            )}
          </motion.div>
        </div>
      </motion.div>

      {/* Vault Door Text */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <h1 className="text-4xl font-bold text-gradient">
          Secure Vault Access
        </h1>
        
        <p className="text-xl text-gray-300">
          Welcome back, <span className="text-circle-blue">{userName}</span>
        </p>

        {isUnlocking ? (
          <div className="space-y-4">
            <p className="text-lg text-circle-green animate-pulse">
              🔓 Unlocking secure communications...
            </p>
            <div className="flex justify-center space-x-2">
              <div className="w-2 h-2 bg-circle-blue rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-circle-blue rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-circle-blue rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-sm">
              <div className="flex items-center space-x-2 text-circle-green">
                <ShieldCheckIcon className="h-4 w-4" />
                <span>End-to-End Encrypted</span>
              </div>
              <div className="flex items-center space-x-2 text-circle-green">
                <EyeSlashIcon className="h-4 w-4" />
                <span>Zero Knowledge</span>
              </div>
              <div className="flex items-center space-x-2 text-circle-green">
                <LockClosedIcon className="h-4 w-4" />
                <span>Military Grade</span>
              </div>
              <div className="flex items-center space-x-2 text-circle-green">
                <KeyIcon className="h-4 w-4" />
                <span>Auto-Destruction</span>
              </div>
            </div>

            <button
              onClick={onEnter}
              className="btn-primary px-8 py-4 text-lg font-semibold transform hover:scale-105 transition-all duration-200"
            >
              Enter Secure Zone
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default MessagingPage;
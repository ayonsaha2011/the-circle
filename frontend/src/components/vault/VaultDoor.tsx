import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheckIcon, 
  LockClosedIcon, 
  KeyIcon,
  EyeSlashIcon,
  ServerIcon,
  ClockIcon 
} from '@heroicons/react/24/outline';

interface VaultDoorProps {
  onEnter: () => void;
  isUnlocking: boolean;
  userName: string;
  securityLevel?: 'standard' | 'high' | 'maximum';
}

const VaultDoor: React.FC<VaultDoorProps> = ({ 
  onEnter, 
  isUnlocking, 
  userName, 
  securityLevel = 'maximum' 
}) => {
  const [securityChecks, setSecurityChecks] = useState([
    { name: 'Identity Verification', status: 'pending' },
    { name: 'Encryption Handshake', status: 'pending' },
    { name: 'Zero-Knowledge Proof', status: 'pending' },
    { name: 'Quantum-Safe Protocol', status: 'pending' },
  ]);

  const [currentCheckIndex, setCurrentCheckIndex] = useState(0);

  useEffect(() => {
    if (isUnlocking && currentCheckIndex < securityChecks.length) {
      const timer = setTimeout(() => {
        setSecurityChecks(prev => 
          prev.map((check, index) => 
            index === currentCheckIndex 
              ? { ...check, status: 'completed' }
              : check
          )
        );
        setCurrentCheckIndex(prev => prev + 1);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isUnlocking, currentCheckIndex, securityChecks.length]);

  const getSecurityLevelColor = () => {
    switch (securityLevel) {
      case 'standard': return 'from-blue-500 to-cyan-500';
      case 'high': return 'from-purple-500 to-pink-500';
      case 'maximum': return 'from-red-500 to-orange-500';
      default: return 'from-circle-blue to-circle-purple';
    }
  };

  const getSecurityLevelText = () => {
    switch (securityLevel) {
      case 'standard': return 'Standard Security';
      case 'high': return 'High Security';
      case 'maximum': return 'Maximum Security';
      default: return 'Secure Access';
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-br from-circle-blue/20 to-circle-purple/20" />
        <div className="absolute inset-0" style={{
          backgroundImage: `
            radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 75% 75%, rgba(147, 51, 234, 0.1) 0%, transparent 50%)
          `
        }} />
      </div>

      <div className="relative text-center z-10 max-w-2xl mx-auto px-8">
        {/* Main Vault Door */}
        <motion.div
          className="relative mx-auto mb-12"
          style={{ width: '400px', height: '400px' }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1 }}
        >
          {/* Outer Security Ring */}
          <motion.div
            className={`absolute inset-0 border-8 border-gradient-to-r ${getSecurityLevelColor()} rounded-full`}
            animate={isUnlocking ? { 
              rotate: 360,
              borderWidth: [8, 12, 8],
              scale: [1, 1.05, 1]
            } : {}}
            transition={{ 
              rotate: { duration: 3, ease: "linear", repeat: isUnlocking ? Infinity : 0 },
              borderWidth: { duration: 0.5, repeat: isUnlocking ? Infinity : 0 },
              scale: { duration: 1, repeat: isUnlocking ? Infinity : 0 }
            }}
            style={{
              background: `conic-gradient(from 0deg, transparent, rgba(59, 130, 246, 0.3), transparent)`,
              borderImage: `linear-gradient(45deg, #3b82f6, #8b5cf6, #ef4444) 1`,
            }}
          />
          
          {/* Middle Ring */}
          <motion.div
            className="absolute inset-8 border-4 border-circle-purple/60 rounded-full"
            animate={isUnlocking ? { rotate: -360 } : {}}
            transition={{ duration: 2, ease: "linear", repeat: isUnlocking ? Infinity : 0 }}
          />
          
          {/* Inner Ring */}
          <motion.div
            className="absolute inset-16 border-2 border-circle-blue/40 rounded-full"
            animate={isUnlocking ? { rotate: 180 } : {}}
            transition={{ duration: 1.5, ease: "linear", repeat: isUnlocking ? Infinity : 0 }}
          />

          {/* Center Lock/Key */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className={`p-12 bg-gradient-to-r ${getSecurityLevelColor()} rounded-full shadow-2xl`}
              animate={isUnlocking ? { 
                scale: [1, 1.3, 1],
                rotate: [0, 360],
                boxShadow: [
                  '0 0 20px rgba(59, 130, 246, 0.5)',
                  '0 0 40px rgba(147, 51, 234, 0.8)',
                  '0 0 20px rgba(239, 68, 68, 0.5)'
                ]
              } : {}}
              transition={{ 
                scale: { duration: 0.8, repeat: isUnlocking ? Infinity : 0 },
                rotate: { duration: 2, ease: "linear" },
                boxShadow: { duration: 1, repeat: isUnlocking ? Infinity : 0 }
              }}
            >
              <AnimatePresence mode="wait">
                {isUnlocking ? (
                  <motion.div
                    key="key"
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.5 }}
                  >
                    <KeyIcon className="h-16 w-16 text-white" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="lock"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <LockClosedIcon className="h-16 w-16 text-white" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </motion.div>

        {/* Security Information */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="space-y-8"
        >
          <div>
            <h1 className="text-5xl font-bold text-gradient mb-4">
              Secure Vault Access
            </h1>
            <p className="text-2xl text-gray-300 mb-2">
              Welcome back, <span className="text-circle-blue font-semibold">{userName}</span>
            </p>
            <p className="text-lg text-gray-400">
              {getSecurityLevelText()} • {isUnlocking ? 'Authenticating...' : 'Ready for Access'}
            </p>
          </div>

          {/* Security Checks */}
          {isUnlocking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-gray-900/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700"
            >
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <ServerIcon className="h-5 w-5 mr-2 text-circle-blue" />
                Security Verification
              </h3>
              <div className="space-y-3">
                {securityChecks.map((check, index) => (
                  <motion.div
                    key={check.name}
                    className="flex items-center space-x-3"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                      check.status === 'completed' 
                        ? 'bg-green-500' 
                        : index === currentCheckIndex 
                          ? 'bg-yellow-500 animate-pulse' 
                          : 'bg-gray-600'
                    }`}>
                      {check.status === 'completed' && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-2 h-2 bg-white rounded-full"
                        />
                      )}
                    </div>
                    <span className={`text-sm ${
                      check.status === 'completed' 
                        ? 'text-green-400' 
                        : index === currentCheckIndex 
                          ? 'text-yellow-400' 
                          : 'text-gray-500'
                    }`}>
                      {check.name}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Security Features Grid */}
          {!isUnlocking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="grid grid-cols-2 gap-6 max-w-lg mx-auto"
            >
              <div className="flex items-center space-x-3 text-circle-green">
                <ShieldCheckIcon className="h-6 w-6" />
                <span className="text-sm font-medium">End-to-End Encrypted</span>
              </div>
              <div className="flex items-center space-x-3 text-circle-green">
                <EyeSlashIcon className="h-6 w-6" />
                <span className="text-sm font-medium">Zero Knowledge</span>
              </div>
              <div className="flex items-center space-x-3 text-circle-green">
                <LockClosedIcon className="h-6 w-6" />
                <span className="text-sm font-medium">Military Grade</span>
              </div>
              <div className="flex items-center space-x-3 text-circle-green">
                <ClockIcon className="h-6 w-6" />
                <span className="text-sm font-medium">Auto-Destruction</span>
              </div>
            </motion.div>
          )}

          {/* Action Button */}
          {!isUnlocking ? (
            <motion.button
              onClick={onEnter}
              className="btn-primary px-12 py-4 text-xl font-bold transform hover:scale-105 transition-all duration-300 shadow-xl"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
            >
              Enter Secure Zone
            </motion.button>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-center items-center space-x-3 text-circle-green"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-6 h-6 border-2 border-circle-blue border-t-transparent rounded-full"
              />
              <span className="text-lg font-medium">Unlocking secure communications...</span>
            </motion.div>
          )}
        </motion.div>

        {/* Loading Animation */}
        {isUnlocking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
          >
            <div className="flex space-x-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-3 h-3 bg-circle-blue rounded-full"
                  animate={{ 
                    y: [-10, 0, -10],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default VaultDoor;
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ShieldCheckIcon, UserCircleIcon, CogIcon } from '@heroicons/react/24/outline';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
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
      {/* Header */}
      <header className="glass-effect border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gradient">The Circle</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-300">Welcome, {user.email}</span>
              <button
                onClick={handleLogout}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Dashboard</h2>
          <p className="text-gray-400">Secure communication hub</p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-effect p-6 rounded-xl">
            <div className="flex items-center">
              <ShieldCheckIcon className="h-8 w-8 text-circle-green mr-4" />
              <div>
                <h3 className="text-lg font-semibold text-white">Security Status</h3>
                <p className="text-circle-green">Protected</p>
              </div>
            </div>
          </div>

          <div className="glass-effect p-6 rounded-xl">
            <div className="flex items-center">
              <UserCircleIcon className="h-8 w-8 text-circle-blue mr-4" />
              <div>
                <h3 className="text-lg font-semibold text-white">Membership</h3>
                <p className="text-circle-blue capitalize">{user.membershipTier}</p>
              </div>
            </div>
          </div>

          <div className="glass-effect p-6 rounded-xl">
            <div className="flex items-center">
              <CogIcon className="h-8 w-8 text-circle-purple mr-4" />
              <div>
                <h3 className="text-lg font-semibold text-white">MFA Status</h3>
                <p className={user.mfaEnabled ? 'text-circle-green' : 'text-yellow-500'}>
                  {user.mfaEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon Features */}
        <div className="glass-effect p-8 rounded-xl">
          <h3 className="text-xl font-semibold text-white mb-6">Phase 2 Features Coming Soon</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-700 rounded-lg p-4 opacity-50">
              <h4 className="font-semibold text-gray-300 mb-2">🔒 Secure Messaging</h4>
              <p className="text-gray-500 text-sm">End-to-end encrypted conversations</p>
            </div>
            <div className="border border-gray-700 rounded-lg p-4 opacity-50">
              <h4 className="font-semibold text-gray-300 mb-2">🗃️ File Vaults</h4>
              <p className="text-gray-500 text-sm">Encrypted file storage and sharing</p>
            </div>
            <div className="border border-gray-700 rounded-lg p-4 opacity-50">
              <h4 className="font-semibold text-gray-300 mb-2">📹 Video Calls</h4>
              <p className="text-gray-500 text-sm">Secure video communication</p>
            </div>
            <div className="border border-gray-700 rounded-lg p-4 opacity-50">
              <h4 className="font-semibold text-gray-300 mb-2">⚡ Destruction Protocols</h4>
              <p className="text-gray-500 text-sm">Advanced security features</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
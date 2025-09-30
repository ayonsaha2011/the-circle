import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ShieldCheckIcon, UserCircleIcon, CogIcon } from '@heroicons/react/24/outline';
import AppHeader from '../components/layout/AppHeader';

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
      <AppHeader />

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

        {/* Available Features */}
        <div className="glass-effect p-8 rounded-xl">
          <h3 className="text-xl font-semibold text-white mb-6">Available Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => navigate('/messaging')}
              className="border border-circle-blue hover:border-circle-blue/80 rounded-lg p-4 transition-all hover:scale-105 cursor-pointer group"
            >
              <h4 className="font-semibold text-circle-blue group-hover:text-circle-blue/80 mb-2">🔒 Secure Messaging</h4>
              <p className="text-gray-300 text-sm">End-to-end encrypted conversations</p>
            </button>
            <button
              onClick={() => navigate('/vault')}
              className="border border-circle-green hover:border-circle-green/80 rounded-lg p-4 transition-all hover:scale-105 cursor-pointer group"
            >
              <h4 className="font-semibold text-circle-green group-hover:text-circle-green/80 mb-2">🗃️ File Vaults</h4>
              <p className="text-gray-300 text-sm">Encrypted file storage and sharing</p>
            </button>
            <div className="border border-gray-700 rounded-lg p-4 opacity-50">
              <h4 className="font-semibold text-gray-300 mb-2">📹 Video Calls</h4>
              <p className="text-gray-500 text-sm">Secure video communication (Coming Soon)</p>
            </div>
            <div className="border border-gray-700 rounded-lg p-4 opacity-50">
              <h4 className="font-semibold text-gray-300 mb-2">⚡ Destruction Protocols</h4>
              <p className="text-gray-500 text-sm">Advanced security features (Coming Soon)</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
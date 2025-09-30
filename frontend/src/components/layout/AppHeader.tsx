import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { 
  HomeIcon, 
  ChatBubbleLeftRightIcon, 
  FolderIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

const AppHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navigationItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: HomeIcon,
    },
    {
      name: 'Messaging',
      path: '/messaging',
      icon: ChatBubbleLeftRightIcon,
    },
    {
      name: 'Vault',
      path: '/vault',
      icon: FolderIcon,
    },
  ];

  return (
    <header className="glass-effect border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <div className="flex items-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-2xl font-bold text-gradient hover:scale-105 transition-transform"
            >
              The Circle
            </button>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all ${
                    isActive
                      ? 'bg-circle-blue/20 text-circle-blue'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            <span className="text-gray-300 hidden sm:block">
              {user?.email}
            </span>
            <span className="text-xs text-circle-blue bg-circle-blue/20 px-2 py-1 rounded-full capitalize">
              {user?.membershipTier}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-3 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 hover:text-red-300 rounded-lg transition-all"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-4">
          <nav className="flex items-center space-x-4">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center space-x-1 px-2 py-1 rounded text-sm transition-all ${
                    isActive
                      ? 'bg-circle-blue/20 text-circle-blue'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
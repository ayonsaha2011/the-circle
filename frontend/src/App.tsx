import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Messaging from './pages/Messaging';
import VaultPage from './pages/VaultPage';
import { DestructionProtocol } from './utils/destruction';

// Initialize destruction protocol
DestructionProtocol.init();

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

// Destroyed Page Component
const DestroyedPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-900 via-red-800 to-black">
      <div className="text-center">
        <div className="text-6xl mb-6">🔥</div>
        <h1 className="text-4xl font-bold text-white mb-4">Data Destroyed</h1>
        <p className="text-gray-300 mb-8 max-w-md">
          All local data has been securely eliminated. No forensic traces remain.
        </p>
        <a href="/" className="inline-block px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors">
          Return to Safety
        </a>
      </div>
    </div>
  );
};

function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    // Check authentication status when app loads
    checkAuth();
  }, [checkAuth]);

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/destroyed" element={<DestroyedPage />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/messaging" 
            element={
              <ProtectedRoute>
                <Messaging />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/vault" 
            element={
              <ProtectedRoute>
                <VaultPage />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
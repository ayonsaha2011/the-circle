import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import RegisterForm from '../components/auth/RegisterForm';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const selectedTier = searchParams.get('tier') || 'basic';

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-circle-dark via-gray-900 to-black px-4 py-8">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gradient mb-2">Join The Circle</h1>
          <p className="text-gray-400">Create your secure account</p>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
};

export default Register;
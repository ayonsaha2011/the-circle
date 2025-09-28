import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../../stores/authStore';
import { RegisterRequest } from '../../types';
import { EyeIcon, EyeSlashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const MEMBERSHIP_TIERS = [
  {
    id: 'basic',
    name: 'Basic',
    price: 'Free',
    features: ['Basic messaging', '5MB file limit', '1GB storage', '5 conversations']
  },
  {
    id: 'standard',
    name: 'Standard',
    price: '$9.99/month',
    features: ['All Basic features', 'File sharing', 'Video calls', 'Destruction protocols']
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$19.99/month',
    features: ['All Standard features', 'Biometric auth', '200MB files', '50GB storage']
  }
];

const RegisterForm: React.FC = () => {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterRequest>();
  const { register: registerUser, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedTier, setSelectedTier] = useState('basic');
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const password = watch('password');

  const onSubmit = async (data: RegisterRequest) => {
    try {
      clearError();
      await registerUser({ ...data, membershipTier: selectedTier });
      setRegistrationSuccess(true);
    } catch (error) {
      // Error handled in store
    }
  };

  if (registrationSuccess) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="glass-effect rounded-xl p-8 shadow-2xl text-center">
          <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-green-400 mb-4">
            Welcome to The Circle
          </h2>
          <p className="text-gray-300 mb-6">
            Your account has been created successfully. Please check your email for verification instructions.
          </p>
          <a href="/login" className="btn-primary">
            Continue to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="glass-effect rounded-xl p-8 shadow-2xl">
        <h2 className="text-3xl font-bold text-center mb-8 text-gradient">
          Join The Circle
        </h2>
        
        {/* Membership Tier Selection */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-white mb-4">Choose Your Membership</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MEMBERSHIP_TIERS.map((tier) => (
              <div
                key={tier.id}
                className={`cursor-pointer p-4 rounded-lg border-2 transition-all duration-200 ${
                  selectedTier === tier.id
                    ? 'border-circle-blue bg-circle-blue/20'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
                onClick={() => setSelectedTier(tier.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-white">{tier.name}</h4>
                  <span className="text-circle-blue font-bold">{tier.price}</span>
                </div>
                <ul className="text-sm text-gray-300 space-y-1">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <div className="w-1 h-1 bg-circle-blue rounded-full mr-2"></div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
              Email Address
            </label>
            <input
              {...register('email', { 
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address'
                }
              })}
              type="email"
              id="email"
              placeholder="your@email.com"
              className="input-field"
            />
            {errors.email && (
              <p className="text-red-400 text-sm mt-2">{errors.email.message}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                {...register('password', { 
                  required: 'Password is required',
                  minLength: {
                    value: 8,
                    message: 'Password must be at least 8 characters'
                  }
                })}
                type={showPassword ? 'text' : 'password'}
                id="password"
                placeholder="••••••••"
                className="input-field pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-400 text-sm mt-2">{errors.password.message}</p>
            )}
          </div>
          
          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Creating Account...
              </div>
            ) : (
              'Join The Circle'
            )}
          </button>
        </form>
        
        <div className="mt-6 text-center text-gray-400">
          <p>
            Already have access?{' '}
            <a href="/login" className="text-circle-blue hover:text-blue-400 transition-colors">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import ApiService from '../services/api';
import { User, LoginRequest, RegisterRequest } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  setUser: (user: User) => void;
  checkAuth: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (credentials: LoginRequest) => {
        set({ isLoading: true, error: null });
        
        try {
          // Step 1: Initiate login
          await ApiService.loginInitiate(credentials.email);
          
          // Step 2: Complete login (simplified for Phase 1)
          const loginResponse = await ApiService.loginComplete(credentials);
          
          console.log('🔑 Login response received:', {
            hasData: !!loginResponse.data,
            responseKeys: Object.keys(loginResponse.data || {}),
            userEmail: loginResponse.data?.user?.email
          });
          
          const { access_token: accessToken, refresh_token: refreshToken, user } = loginResponse.data;
          
          // Validate tokens before storing
          if (!accessToken || accessToken === 'undefined' || typeof accessToken !== 'string') {
            throw new Error('Invalid access token received from server');
          }
          if (!refreshToken || refreshToken === 'undefined' || typeof refreshToken !== 'string') {
            throw new Error('Invalid refresh token received from server');
          }
          
          console.log('🔑 Storing valid tokens:', {
            accessTokenPreview: accessToken.substring(0, 20) + '...',
            refreshTokenPreview: refreshToken.substring(0, 20) + '...',
            userEmail: user?.email
          });
          
          // Store tokens
          localStorage.setItem('access_token', accessToken);
          localStorage.setItem('refresh_token', refreshToken);
          
          set({ 
            user, 
            isAuthenticated: true, 
            isLoading: false,
            error: null
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Login failed';
          set({ 
            error: errorMessage,
            isLoading: false,
            isAuthenticated: false,
            user: null
          });
          throw new Error(errorMessage);
        }
      },

      register: async (data: RegisterRequest) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await ApiService.register(data);
          
          // Registration successful, user needs to verify email
          set({ 
            isLoading: false,
            error: null 
          });
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || 'Registration failed';
          set({ 
            error: errorMessage,
            isLoading: false 
          });
          throw new Error(errorMessage);
        }
      },

      logout: async () => {
        try {
          await ApiService.logout();
        } catch (error) {
          // Ignore logout errors
          console.warn('Logout error:', error);
        }
        
        // Clear local state regardless of API call success
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        
        set({ 
          user: null, 
          isAuthenticated: false,
          error: null 
        });
      },

      clearError: () => set({ error: null }),
      
      setUser: (user: User) => set({ user, isAuthenticated: true }),

      checkAuth: async () => {
        const isAuthenticated = ApiService.isAuthenticated();
        if (!isAuthenticated) {
          set({
            user: null,
            isAuthenticated: false
          });
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      },

      refreshToken: async () => {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          get().logout();
          return false;
        }

        try {
          const response = await ApiService.post('/api/auth/refresh', { refresh_token: refreshToken });
          const { access_token: newAccessToken } = response.data;
          
          if (newAccessToken) {
            localStorage.setItem('access_token', newAccessToken);
            return true;
          }
        } catch (error) {
          console.error('Token refresh failed:', error);
          get().logout();
        }
        
        return false;
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user,
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);
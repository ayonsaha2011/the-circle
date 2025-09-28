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
  logout: () => void;
  clearError: () => void;
  setUser: (user: User) => void;
  checkAuth: () => void;
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
          
          const { accessToken, refreshToken, user } = loginResponse.data;
          
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

      checkAuth: () => {
        const isAuthenticated = ApiService.isAuthenticated();
        if (!isAuthenticated) {
          set({
            user: null,
            isAuthenticated: false
          });
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
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
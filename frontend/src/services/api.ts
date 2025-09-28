import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  User, 
  RegisterRequest, 
  RegisterResponse, 
  LoginRequest, 
  LoginResponse, 
  LoginStepResponse,
  TokenResponse,
  HealthResponse 
} from '../types';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, try to refresh
          const refreshToken = localStorage.getItem('refresh_token');
          if (refreshToken) {
            try {
              const response = await this.refreshToken(refreshToken);
              localStorage.setItem('access_token', response.data.accessToken);
              
              // Retry original request
              return this.client.request(error.config);
            } catch {
              // Refresh failed, redirect to login
              this.clearTokens();
              window.location.href = '/login';
            }
          } else {
            // No refresh token, redirect to login
            this.clearTokens();
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private clearTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  // Authentication endpoints
  async register(data: RegisterRequest): Promise<AxiosResponse<RegisterResponse>> {
    return this.client.post('/api/auth/register', data);
  }

  async loginInitiate(email: string): Promise<AxiosResponse<LoginStepResponse>> {
    return this.client.post('/api/auth/login/initiate', { email });
  }

  async loginComplete(data: LoginRequest): Promise<AxiosResponse<LoginResponse>> {
    return this.client.post('/api/auth/login/complete', data);
  }

  async logout(): Promise<AxiosResponse<void>> {
    const response = await this.client.post('/api/auth/logout');
    this.clearTokens();
    return response;
  }

  private async refreshToken(refreshToken: string): Promise<AxiosResponse<TokenResponse>> {
    return this.client.post('/api/auth/refresh', { refresh_token: refreshToken });
  }

  // Health check
  async healthCheck(): Promise<AxiosResponse<HealthResponse>> {
    return this.client.get('/health');
  }

  // Utility method to check if user is authenticated
  isAuthenticated(): boolean {
    const token = localStorage.getItem('access_token');
    if (!token) return false;

    try {
      // Basic JWT expiration check (in production, use a proper JWT library)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp > currentTime;
    } catch {
      return false;
    }
  }
}

export default new ApiService();
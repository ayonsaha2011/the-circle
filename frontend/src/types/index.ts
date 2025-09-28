export interface User {
  id: string;
  email: string;
  membershipTier: string;
  createdAt: string;
  lastLogin?: string;
  mfaEnabled: boolean;
  emailVerified: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  membershipTier?: string;
}

export interface RegisterResponse {
  message: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginStepResponse {
  step: number;
  sessionId: string;
  expiresAt: string;
  requiresMfa: boolean;
  message: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  expiresAt: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
  service: string;
}

export interface MembershipTier {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  features: Record<string, boolean>;
  maxFileSizeMb: number;
  maxStorageGb: number;
  maxConversations: number;
}

export interface SecurityEvent {
  id: string;
  eventType: string;
  timestamp: string;
  riskLevel: number;
  details?: Record<string, any>;
}

export interface DestructionEvent {
  id: string;
  triggerType: string;
  timestamp: string;
  dataTypesDestroyed: string[];
  success: boolean;
}
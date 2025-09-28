-- Create database and user
-- Run this manually in PostgreSQL as superuser
-- CREATE DATABASE circle_db;
-- CREATE USER circle_user WITH PASSWORD 'secure_password';
-- GRANT ALL PRIVILEGES ON DATABASE circle_db TO circle_user;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users table with security features
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    membership_tier VARCHAR(50) NOT NULL DEFAULT 'basic',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    failed_login_attempts INTEGER DEFAULT 0,
    account_locked_until TIMESTAMP WITH TIME ZONE,
    destruction_key VARCHAR(255),
    biometric_hash VARCHAR(255),
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP WITH TIME ZONE
);

-- Membership tiers
CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    price_monthly DECIMAL(10,2),
    price_yearly DECIMAL(10,2),
    features JSONB,
    max_file_size_mb INTEGER DEFAULT 10,
    max_storage_gb INTEGER DEFAULT 1,
    max_conversations INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- User sessions for security tracking
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    refresh_expires_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Security events logging
CREATE TABLE security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    risk_level INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Destruction logs for audit trail
CREATE TABLE destruction_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    trigger_type VARCHAR(50) NOT NULL,
    data_types_destroyed TEXT[],
    execution_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    success BOOLEAN DEFAULT true,
    forensic_residue_level INTEGER DEFAULT 0,
    details JSONB
);

-- Payment subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    membership_id UUID REFERENCES memberships(id),
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_membership_tier ON users (membership_tier);
CREATE INDEX idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions (session_token);
CREATE INDEX idx_user_sessions_active ON user_sessions (user_id, expires_at) WHERE is_active = true;
CREATE INDEX idx_security_events_user_id ON security_events (user_id, created_at DESC);
CREATE INDEX idx_security_events_type ON security_events (event_type, created_at DESC);
CREATE INDEX idx_subscriptions_user_id ON subscriptions (user_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions (stripe_subscription_id);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Insert default membership tiers
INSERT INTO memberships (name, price_monthly, price_yearly, features, max_file_size_mb, max_storage_gb, max_conversations) VALUES
('Basic', 0.00, 0.00, '{"messaging": true, "file_sharing": false, "video_calls": false, "destruction_protocols": false}', 5, 1, 5),
('Standard', 9.99, 99.99, '{"messaging": true, "file_sharing": true, "video_calls": true, "destruction_protocols": true}', 50, 10, 50),
('Premium', 19.99, 199.99, '{"messaging": true, "file_sharing": true, "video_calls": true, "destruction_protocols": true, "biometric_auth": true}', 200, 50, 200),
('Enterprise', 49.99, 499.99, '{"messaging": true, "file_sharing": true, "video_calls": true, "destruction_protocols": true, "biometric_auth": true, "admin_controls": true}', 1000, 500, -1);
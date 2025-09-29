-- Phase 3: Advanced Security & Governance Database Schema
-- Multi-signature authentication, DAO governance, and advanced security features

-- Multi-signature wallets and authentication
CREATE TABLE multisig_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    required_signatures INTEGER NOT NULL CHECK (required_signatures > 0),
    total_signers INTEGER NOT NULL CHECK (total_signers >= required_signatures),
    wallet_type VARCHAR(50) NOT NULL DEFAULT 'standard', -- standard, treasury, emergency
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE multisig_signers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES multisig_wallets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    public_key TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'signer', -- owner, signer, observer
    added_by UUID NOT NULL REFERENCES users(id),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(wallet_id, user_id)
);

CREATE TABLE multisig_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES multisig_wallets(id),
    transaction_type VARCHAR(100) NOT NULL, -- auth, payment, governance, emergency
    payload JSONB NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    required_signatures INTEGER NOT NULL,
    current_signatures INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, executed, expired
    initiated_by UUID NOT NULL REFERENCES users(id),
    expires_at TIMESTAMP WITH TIME ZONE,
    executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE multisig_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES multisig_transactions(id) ON DELETE CASCADE,
    signer_id UUID NOT NULL REFERENCES users(id),
    signature_data TEXT NOT NULL,
    signature_algorithm VARCHAR(50) NOT NULL DEFAULT 'ed25519',
    signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(transaction_id, signer_id)
);

-- Role-based access control (RBAC)
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    level INTEGER NOT NULL DEFAULT 0, -- 0=basic, 100=admin, 1000=super_admin
    is_system_role BOOLEAN DEFAULT false,
    permissions JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    granted_by UUID NOT NULL REFERENCES users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, role_id)
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    resource VARCHAR(100) NOT NULL, -- conversations, files, users, system
    action VARCHAR(100) NOT NULL, -- create, read, update, delete, admin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DAO Governance System
CREATE TABLE governance_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    proposal_type VARCHAR(50) NOT NULL, -- parameter_change, treasury_spend, feature_request, emergency
    proposer_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, passed, rejected, executed, cancelled
    voting_start TIMESTAMP WITH TIME ZONE,
    voting_end TIMESTAMP WITH TIME ZONE,
    execution_delay HOURS DEFAULT 24,
    minimum_quorum INTEGER DEFAULT 100, -- minimum votes required
    approval_threshold DECIMAL(5,4) DEFAULT 0.5000, -- 50% approval required
    proposal_data JSONB NOT NULL,
    proposal_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE governance_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES governance_proposals(id) ON DELETE CASCADE,
    voter_id UUID NOT NULL REFERENCES users(id),
    vote_choice VARCHAR(20) NOT NULL, -- for, against, abstain
    voting_power DECIMAL(20,8) NOT NULL DEFAULT 1.0,
    vote_reason TEXT,
    vote_signature TEXT,
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(proposal_id, voter_id)
);

CREATE TABLE governance_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    token_type VARCHAR(50) DEFAULT 'governance', -- governance, staking, reputation
    balance DECIMAL(20,8) NOT NULL DEFAULT 0,
    staked_amount DECIMAL(20,8) DEFAULT 0,
    delegated_to UUID REFERENCES users(id),
    last_claim TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, token_type)
);

CREATE TABLE governance_delegations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delegator_id UUID NOT NULL REFERENCES users(id),
    delegate_id UUID NOT NULL REFERENCES users(id),
    token_amount DECIMAL(20,8) NOT NULL,
    active_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    active_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(delegator_id, delegate_id)
);

-- Treasury Management
CREATE TABLE treasury_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL, -- operational, emergency, development, community
    multisig_wallet_id UUID REFERENCES multisig_wallets(id),
    balance_usd DECIMAL(20,8) DEFAULT 0,
    balance_tokens DECIMAL(20,8) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE treasury_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES treasury_accounts(id),
    transaction_type VARCHAR(50) NOT NULL, -- deposit, withdrawal, transfer, fee
    amount DECIMAL(20,8) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    from_address VARCHAR(255),
    to_address VARCHAR(255),
    purpose TEXT,
    proposal_id UUID REFERENCES governance_proposals(id),
    multisig_transaction_id UUID REFERENCES multisig_transactions(id),
    status VARCHAR(50) DEFAULT 'pending',
    executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Immutable audit logs for compliance
CREATE TABLE immutable_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_sequence BIGSERIAL UNIQUE,
    previous_hash VARCHAR(64),
    current_hash VARCHAR(64) NOT NULL,
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    action VARCHAR(100) NOT NULL,
    details JSONB NOT NULL,
    ip_address INET,
    user_agent TEXT,
    session_id UUID,
    merkle_root VARCHAR(64),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (log_sequence > 0)
);

-- Compliance and data retention
CREATE TABLE data_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type VARCHAR(100) NOT NULL, -- messages, files, logs, user_data
    retention_period INTERVAL NOT NULL,
    policy_type VARCHAR(50) NOT NULL, -- automatic, legal_hold, manual
    jurisdiction VARCHAR(100),
    regulation VARCHAR(100), -- GDPR, CCPA, SOX, HIPAA
    auto_delete BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    effective_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE compliance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_type VARCHAR(50) NOT NULL, -- data_export, data_deletion, access_report
    user_id UUID REFERENCES users(id),
    requester_email VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, rejected
    request_details JSONB NOT NULL,
    verification_token VARCHAR(255),
    completed_by UUID REFERENCES users(id),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Threat detection and security monitoring
CREATE TABLE security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(100) NOT NULL, -- login_anomaly, permission_escalation, data_breach
    severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
    source_ip INET,
    user_id UUID REFERENCES users(id),
    resource_affected VARCHAR(255),
    threat_indicators JSONB,
    detection_method VARCHAR(100), -- rule_based, ml_model, manual
    status VARCHAR(50) DEFAULT 'open', -- open, investigating, resolved, false_positive
    assigned_to UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE security_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(255) NOT NULL UNIQUE,
    rule_type VARCHAR(50) NOT NULL, -- behavioral, threshold, pattern, ml
    rule_definition JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    severity VARCHAR(20) NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE behavioral_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
    login_patterns JSONB,
    access_patterns JSONB,
    communication_patterns JSONB,
    risk_score DECIMAL(5,2) DEFAULT 0.00,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    baseline_established BOOLEAN DEFAULT false
);

-- Zero-knowledge proof system
CREATE TABLE zk_commitments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    commitment_type VARCHAR(50) NOT NULL, -- identity, credential, secret
    commitment_hash VARCHAR(64) NOT NULL,
    proof_system VARCHAR(50) NOT NULL DEFAULT 'groth16', -- groth16, plonk, stark
    public_inputs JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE zk_proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commitment_id UUID NOT NULL REFERENCES zk_commitments(id),
    proof_data TEXT NOT NULL,
    verification_key TEXT NOT NULL,
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_multisig_wallets_created_by ON multisig_wallets(created_by);
CREATE INDEX idx_multisig_transactions_wallet_id ON multisig_transactions(wallet_id);
CREATE INDEX idx_multisig_transactions_status ON multisig_transactions(status);
CREATE INDEX idx_governance_proposals_status ON governance_proposals(status);
CREATE INDEX idx_governance_votes_proposal_id ON governance_votes(proposal_id);
CREATE INDEX idx_immutable_audit_logs_sequence ON immutable_audit_logs(log_sequence);
CREATE INDEX idx_immutable_audit_logs_user_id ON immutable_audit_logs(user_id);
CREATE INDEX idx_immutable_audit_logs_timestamp ON immutable_audit_logs(timestamp);
CREATE INDEX idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX idx_security_alerts_status ON security_alerts(status);
CREATE INDEX idx_behavioral_profiles_risk_score ON behavioral_profiles(risk_score);

-- Insert default roles
INSERT INTO roles (name, description, level, is_system_role, permissions) VALUES
('super_admin', 'Super administrator with full system access', 1000, true, 
 '["*"]'),
('admin', 'System administrator', 100, true, 
 '["users:*", "conversations:*", "files:*", "governance:read", "audit:read"]'),
('moderator', 'Community moderator', 50, true,
 '["conversations:moderate", "users:moderate", "governance:read"]'),
('member', 'Standard member', 10, true,
 '["conversations:participate", "files:personal", "governance:vote"]'),
('observer', 'Read-only observer', 1, true,
 '["conversations:read", "governance:read"]');

-- Insert default permissions
INSERT INTO permissions (name, description, resource, action) VALUES
('system_admin', 'Full system administration', 'system', 'admin'),
('user_management', 'Manage users and roles', 'users', 'admin'),
('conversation_moderate', 'Moderate conversations', 'conversations', 'moderate'),
('file_admin', 'Administer files and storage', 'files', 'admin'),
('governance_admin', 'Administer governance system', 'governance', 'admin'),
('audit_access', 'Access audit logs', 'audit', 'read'),
('treasury_manage', 'Manage treasury funds', 'treasury', 'admin');

-- Insert default data retention policies
INSERT INTO data_retention_policies (resource_type, retention_period, policy_type, regulation) VALUES
('messages', '90 days', 'automatic', 'GDPR'),
('files', '1 year', 'automatic', 'GDPR'),
('activity_logs', '7 years', 'legal_hold', 'SOX'),
('user_data', '3 years', 'automatic', 'GDPR'),
('audit_logs', '10 years', 'legal_hold', 'SOX');

-- Security rules for threat detection
INSERT INTO security_rules (rule_name, rule_type, rule_definition, severity, created_by) VALUES
('multiple_failed_logins', 'threshold', 
 '{"threshold": 5, "timeframe": "5 minutes", "action": "block_ip"}', 'high',
 (SELECT id FROM users WHERE email = 'system@thecircle.local' LIMIT 1)),
('unusual_access_time', 'behavioral',
 '{"deviation_threshold": 3, "baseline_period": "30 days"}', 'medium',
 (SELECT id FROM users WHERE email = 'system@thecircle.local' LIMIT 1)),
('privilege_escalation', 'pattern',
 '{"pattern": "role_change", "timeframe": "1 hour", "threshold": 2}', 'critical',
 (SELECT id FROM users WHERE email = 'system@thecircle.local' LIMIT 1));
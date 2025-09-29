-- Phase 2 Database Extensions: Messaging & Vaults
-- Add this to your existing database or run as a new migration

-- Conversations (direct messages and groups)
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255), -- NULL for direct messages, name for groups
    type VARCHAR(20) NOT NULL DEFAULT 'direct', -- 'direct', 'group', 'broadcast'
    creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    encryption_key_hash VARCHAR(255) NOT NULL, -- For end-to-end encryption
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- Auto-expiration
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}' -- Conversation-specific settings
);

-- Conversation participants
CREATE TABLE conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- 'admin', 'member', 'viewer'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '{}', -- Custom permissions
    UNIQUE(conversation_id, user_id)
);

-- Messages with end-to-end encryption
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content_encrypted TEXT NOT NULL, -- Encrypted message content
    message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'file', 'image', 'video', 'system'
    metadata_encrypted TEXT, -- Encrypted metadata (file info, etc.)
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    edited_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE, -- Message expiration
    deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete
    destruction_scheduled_at TIMESTAMP WITH TIME ZONE, -- Auto-destruction
    read_by JSONB DEFAULT '[]', -- Array of user IDs who read the message
    reactions JSONB DEFAULT '{}' -- Message reactions
);

-- File storage and vaults
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL, -- NULL for vault files
    filename_encrypted VARCHAR(500) NOT NULL, -- Encrypted original filename
    s3_key VARCHAR(500) NOT NULL UNIQUE, -- S3 object key
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    encryption_metadata TEXT NOT NULL, -- Encryption keys and parameters
    checksum VARCHAR(128) NOT NULL, -- File integrity checksum
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- Auto-expiration
    deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete
    download_count INTEGER DEFAULT 0,
    max_downloads INTEGER, -- Download limit
    is_public BOOLEAN DEFAULT false,
    virus_scan_status VARCHAR(20) DEFAULT 'pending' -- 'pending', 'clean', 'infected', 'error'
);

-- File access permissions
CREATE TABLE file_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    permission_type VARCHAR(20) NOT NULL, -- 'read', 'write', 'delete', 'share'
    granted_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(file_id, user_id, permission_type)
);

-- Video call sessions
CREATE TABLE video_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    initiator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    call_type VARCHAR(20) NOT NULL DEFAULT 'video', -- 'video', 'audio', 'screen_share'
    status VARCHAR(20) DEFAULT 'initiated', -- 'initiated', 'ringing', 'active', 'ended', 'failed'
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    participants JSONB DEFAULT '[]', -- Array of participant info
    settings JSONB DEFAULT '{}', -- Call settings and quality
    recording_enabled BOOLEAN DEFAULT false,
    recording_s3_key VARCHAR(500) -- If recording is enabled
);

-- Member presence and status
CREATE TABLE user_presence (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'offline', -- 'online', 'away', 'busy', 'offline'
    custom_status VARCHAR(100), -- Custom status message
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    device_info JSONB, -- Device and location info
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity logs for security and audit
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'message_sent', 'file_uploaded', 'call_started', etc.
    resource_type VARCHAR(50), -- 'message', 'file', 'call', 'conversation'
    resource_id UUID, -- ID of the affected resource
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_conversations_creator ON conversations(creator_id, created_at DESC);
CREATE INDEX idx_conversation_participants_user ON conversation_participants(user_id, is_active);
CREATE INDEX idx_conversation_participants_conv ON conversation_participants(conversation_id, is_active);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_sender ON messages(sender_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_expiration ON messages(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_files_owner ON files(owner_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_conversation ON files(conversation_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_expiration ON files(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_file_permissions_file ON file_permissions(file_id, is_active);
CREATE INDEX idx_file_permissions_user ON file_permissions(user_id, is_active);
CREATE INDEX idx_video_calls_conversation ON video_calls(conversation_id, started_at DESC);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id, timestamp DESC);
CREATE INDEX idx_activity_logs_action ON activity_logs(action, timestamp DESC);

-- Row Level Security for new tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Triggers for automatic updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_presence_updated_at BEFORE UPDATE ON user_presence
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired messages and files
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
    -- Soft delete expired messages
    UPDATE messages 
    SET deleted_at = NOW() 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW() 
    AND deleted_at IS NULL;
    
    -- Soft delete expired files
    UPDATE files 
    SET deleted_at = NOW() 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW() 
    AND deleted_at IS NULL;
    
    -- Update conversation last activity
    UPDATE conversations 
    SET updated_at = NOW() 
    WHERE id IN (
        SELECT DISTINCT conversation_id 
        FROM messages 
        WHERE created_at > NOW() - INTERVAL '1 hour'
    );
END;
$$ LANGUAGE plpgsql;
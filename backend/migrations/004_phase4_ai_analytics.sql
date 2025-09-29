-- Phase 4: AI Integration & Analytics Database Schema
-- Machine learning models, analytics, NLP, and intelligent automation

-- AI Model Management
CREATE TABLE ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    model_type VARCHAR(100) NOT NULL, -- nlp, classification, prediction, anomaly_detection
    version VARCHAR(50) NOT NULL,
    description TEXT,
    model_path TEXT NOT NULL,
    model_config JSONB NOT NULL DEFAULT '{}',
    performance_metrics JSONB,
    is_active BOOLEAN DEFAULT false,
    training_data_hash VARCHAR(64),
    last_trained TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE model_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES ai_models(id),
    input_data JSONB NOT NULL,
    prediction_result JSONB NOT NULL,
    confidence_score DECIMAL(5,4),
    prediction_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id),
    resource_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content Analysis and Moderation
CREATE TABLE content_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type VARCHAR(50) NOT NULL, -- message, file, comment, post
    content_id UUID NOT NULL,
    user_id UUID REFERENCES users(id),
    analysis_results JSONB NOT NULL,
    sentiment_score DECIMAL(5,4),
    toxicity_score DECIMAL(5,4),
    spam_score DECIMAL(5,4),
    language_detected VARCHAR(10),
    topics JSONB, -- array of detected topics
    entities JSONB, -- array of named entities
    moderation_action VARCHAR(50), -- none, flag, block, delete
    confidence_level DECIMAL(5,4),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE moderation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(255) NOT NULL UNIQUE,
    rule_type VARCHAR(50) NOT NULL, -- sentiment, toxicity, spam, custom
    rule_config JSONB NOT NULL,
    threshold_score DECIMAL(5,4) NOT NULL,
    action VARCHAR(50) NOT NULL, -- flag, block, delete, notify
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Behavior Analytics
CREATE TABLE user_behavior_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
    engagement_score DECIMAL(5,4) DEFAULT 0,
    activity_patterns JSONB,
    communication_style JSONB,
    interest_categories JSONB,
    social_graph_metrics JSONB,
    risk_indicators JSONB,
    predicted_churn_probability DECIMAL(5,4),
    predicted_ltv DECIMAL(10,2), -- lifetime value
    last_analyzed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    interaction_type VARCHAR(100) NOT NULL, -- message, login, file_upload, vote, etc.
    target_user_id UUID REFERENCES users(id),
    target_resource_id UUID,
    target_resource_type VARCHAR(100),
    interaction_data JSONB,
    interaction_context JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation Insights
CREATE TABLE conversation_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    participant_count INTEGER NOT NULL,
    message_count INTEGER DEFAULT 0,
    avg_response_time INTERVAL,
    sentiment_trend JSONB, -- time series of sentiment
    activity_pattern JSONB,
    engagement_level DECIMAL(5,4),
    health_score DECIMAL(5,4),
    key_topics JSONB,
    insights JSONB,
    last_analyzed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Predictive Analytics
CREATE TABLE prediction_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(255) NOT NULL UNIQUE,
    prediction_type VARCHAR(100) NOT NULL, -- churn, engagement, security_risk, performance
    model_algorithm VARCHAR(100) NOT NULL,
    features JSONB NOT NULL, -- input features definition
    target_variable VARCHAR(100) NOT NULL,
    training_config JSONB,
    model_metrics JSONB,
    is_deployed BOOLEAN DEFAULT false,
    last_retrained TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE system_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES prediction_models(id),
    prediction_type VARCHAR(100) NOT NULL,
    prediction_data JSONB NOT NULL,
    confidence_interval JSONB,
    prediction_horizon INTERVAL, -- how far into future
    actual_outcome JSONB, -- for validation
    accuracy_score DECIMAL(5,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    outcome_date TIMESTAMP WITH TIME ZONE
);

-- Natural Language Processing
CREATE TABLE nlp_processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(100) NOT NULL, -- sentiment, entity_extraction, summarization, translation
    input_data JSONB NOT NULL,
    processing_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    output_data JSONB,
    processing_time_ms INTEGER,
    model_used VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE semantic_search_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type VARCHAR(50) NOT NULL,
    content_id UUID NOT NULL,
    content_text TEXT NOT NULL,
    embeddings VECTOR(384), -- for semantic search (requires pgvector extension)
    metadata JSONB,
    language VARCHAR(10),
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recommendation Engine
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
    explicit_preferences JSONB, -- user-declared preferences
    implicit_preferences JSONB, -- learned from behavior
    interaction_weights JSONB, -- weights for different types of interactions
    preference_version INTEGER DEFAULT 1,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    recommendation_type VARCHAR(100) NOT NULL, -- connection, content, group, feature
    recommended_item_id UUID NOT NULL,
    recommended_item_type VARCHAR(100) NOT NULL,
    score DECIMAL(5,4) NOT NULL,
    reasoning JSONB, -- explanation for recommendation
    context JSONB, -- context when recommendation was generated
    interaction_outcome VARCHAR(50), -- accepted, rejected, ignored
    interaction_timestamp TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Real-time Analytics
CREATE TABLE analytics_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(255) NOT NULL,
    metric_type VARCHAR(100) NOT NULL, -- counter, gauge, histogram, summary
    metric_value DECIMAL(20,8) NOT NULL,
    dimensions JSONB, -- key-value pairs for metric dimensions
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    retention_period INTERVAL DEFAULT '90 days'
);

CREATE TABLE performance_monitoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component VARCHAR(100) NOT NULL,
    metric_type VARCHAR(100) NOT NULL, -- latency, throughput, error_rate, memory, cpu
    value DECIMAL(15,6) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    threshold_warning DECIMAL(15,6),
    threshold_critical DECIMAL(15,6),
    status VARCHAR(20) DEFAULT 'normal', -- normal, warning, critical
    metadata JSONB,
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI-Powered Notifications
CREATE TABLE smart_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    notification_type VARCHAR(100) NOT NULL,
    priority_score DECIMAL(5,4) NOT NULL,
    personalization_data JSONB,
    delivery_channel VARCHAR(50) NOT NULL, -- in_app, email, push, sms
    delivery_timing TIMESTAMP WITH TIME ZONE,
    optimal_send_time TIMESTAMP WITH TIME ZONE, -- AI-predicted best time
    content_template VARCHAR(255),
    content_variables JSONB,
    delivery_status VARCHAR(50) DEFAULT 'pending',
    interaction_outcome VARCHAR(50), -- opened, clicked, dismissed, ignored
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    interacted_at TIMESTAMP WITH TIME ZONE
);

-- ML Model Training and Evaluation
CREATE TABLE training_datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_name VARCHAR(255) NOT NULL UNIQUE,
    dataset_type VARCHAR(100) NOT NULL,
    description TEXT,
    data_source VARCHAR(255),
    data_schema JSONB,
    row_count INTEGER,
    feature_count INTEGER,
    data_quality_score DECIMAL(5,4),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE model_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_name VARCHAR(255) NOT NULL,
    model_id UUID REFERENCES ai_models(id),
    dataset_id UUID REFERENCES training_datasets(id),
    experiment_config JSONB NOT NULL,
    hyperparameters JSONB,
    training_metrics JSONB,
    validation_metrics JSONB,
    test_metrics JSONB,
    experiment_status VARCHAR(50) DEFAULT 'running',
    started_by UUID NOT NULL REFERENCES users(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Feature Flags and A/B Testing
CREATE TABLE feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name VARCHAR(255) NOT NULL UNIQUE,
    flag_type VARCHAR(50) NOT NULL, -- boolean, string, number, json
    default_value JSONB NOT NULL,
    description TEXT,
    targeting_rules JSONB, -- rules for which users get which values
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    hypothesis TEXT,
    feature_flag_id UUID REFERENCES feature_flags(id),
    test_config JSONB NOT NULL,
    traffic_split JSONB NOT NULL, -- percentage allocation per variant
    success_metrics JSONB,
    status VARCHAR(50) DEFAULT 'draft', -- draft, running, paused, completed
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    statistical_significance DECIMAL(5,4),
    results JSONB,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE ab_test_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES ab_tests(id),
    user_id UUID NOT NULL REFERENCES users(id),
    variant VARCHAR(100) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(test_id, user_id)
);

-- System Intelligence and Automation
CREATE TABLE automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(255) NOT NULL UNIQUE,
    rule_type VARCHAR(100) NOT NULL, -- security, performance, user_experience, business
    trigger_conditions JSONB NOT NULL,
    action_config JSONB NOT NULL,
    ml_model_id UUID REFERENCES ai_models(id),
    confidence_threshold DECIMAL(5,4),
    is_active BOOLEAN DEFAULT true,
    execution_count INTEGER DEFAULT 0,
    last_executed TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES automation_rules(id),
    trigger_data JSONB NOT NULL,
    action_taken JSONB NOT NULL,
    execution_result VARCHAR(50), -- success, failure, partial
    execution_time_ms INTEGER,
    error_message TEXT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX idx_model_predictions_model_id ON model_predictions(model_id);
CREATE INDEX idx_model_predictions_created_at ON model_predictions(created_at);
CREATE INDEX idx_content_analysis_content_id ON content_analysis(content_id);
CREATE INDEX idx_content_analysis_user_id ON content_analysis(user_id);
CREATE INDEX idx_content_analysis_sentiment ON content_analysis(sentiment_score);
CREATE INDEX idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX idx_user_interactions_timestamp ON user_interactions(timestamp);
CREATE INDEX idx_conversation_analytics_conversation_id ON conversation_analytics(conversation_id);
CREATE INDEX idx_recommendations_user_id ON recommendations(user_id);
CREATE INDEX idx_recommendations_score ON recommendations(score);
CREATE INDEX idx_analytics_metrics_name_timestamp ON analytics_metrics(metric_name, timestamp);
CREATE INDEX idx_performance_monitoring_component ON performance_monitoring(component);
CREATE INDEX idx_smart_notifications_user_id ON smart_notifications(user_id);
CREATE INDEX idx_smart_notifications_delivery_timing ON smart_notifications(delivery_timing);

-- Triggers for automatic updates
CREATE OR REPLACE FUNCTION update_user_behavior_analytics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_behavior_analytics_update
    BEFORE UPDATE ON user_behavior_analytics
    FOR EACH ROW
    EXECUTE FUNCTION update_user_behavior_analytics_timestamp();

-- Insert default AI models and configurations
INSERT INTO ai_models (name, model_type, version, description, model_path, model_config, is_active, created_by) VALUES
('content_moderator_v1', 'classification', '1.0.0', 'Content moderation model for detecting harmful content', '/models/content_moderator_v1.pkl', 
 '{"threshold": 0.7, "categories": ["spam", "harassment", "hate_speech", "violence"]}', true,
 (SELECT id FROM users WHERE email = 'system@thecircle.local' LIMIT 1)),
 
('sentiment_analyzer_v1', 'nlp', '1.0.0', 'Sentiment analysis model for community health monitoring', '/models/sentiment_v1.pkl',
 '{"model_type": "transformer", "max_length": 512, "batch_size": 32}', true,
 (SELECT id FROM users WHERE email = 'system@thecircle.local' LIMIT 1)),
 
('threat_predictor_v1', 'prediction', '1.0.0', 'Predictive model for security threat detection', '/models/threat_predictor_v1.pkl',
 '{"lookback_window": "7d", "prediction_horizon": "24h", "features": ["login_patterns", "behavior_anomalies"]}', true,
 (SELECT id FROM users WHERE email = 'system@thecircle.local' LIMIT 1)),
 
('user_engagement_predictor', 'prediction', '1.0.0', 'Model to predict user engagement and churn risk', '/models/engagement_v1.pkl',
 '{"algorithm": "xgboost", "features": ["activity_frequency", "social_connections", "content_interaction"]}', true,
 (SELECT id FROM users WHERE email = 'system@thecircle.local' LIMIT 1));

-- Insert default moderation rules
INSERT INTO moderation_rules (rule_name, rule_type, rule_config, threshold_score, action, created_by) VALUES
('high_toxicity_content', 'toxicity', '{"model": "content_moderator_v1", "category": "toxicity"}', 0.8, 'block', 
 (SELECT id FROM users WHERE email = 'system@thecircle.local' LIMIT 1)),
('spam_detection', 'spam', '{"model": "content_moderator_v1", "category": "spam"}', 0.75, 'flag',
 (SELECT id FROM users WHERE email = 'system@thecircle.local' LIMIT 1)),
('harassment_detection', 'custom', '{"model": "content_moderator_v1", "category": "harassment"}', 0.7, 'flag',
 (SELECT id FROM users WHERE email = 'system@thecircle.local' LIMIT 1));

-- Insert default prediction models
INSERT INTO prediction_models (model_name, prediction_type, model_algorithm, features, target_variable, training_config) VALUES
('churn_prediction_v1', 'churn', 'random_forest', 
 '["days_since_last_login", "message_frequency", "social_connections", "feature_usage"]',
 'will_churn_30d', '{"n_estimators": 100, "max_depth": 10, "min_samples_split": 5}'),
 
('security_risk_assessment', 'security_risk', 'gradient_boosting',
 '["login_anomalies", "access_patterns", "behavior_changes", "threat_indicators"]',
 'risk_score', '{"learning_rate": 0.1, "n_estimators": 200, "max_depth": 6}'),
 
('performance_optimization', 'performance', 'neural_network',
 '["cpu_usage", "memory_usage", "request_rate", "response_time", "error_rate"]',
 'performance_score', '{"hidden_layers": [128, 64, 32], "dropout": 0.2, "epochs": 100}');

-- Insert default feature flags
INSERT INTO feature_flags (flag_name, flag_type, default_value, description, targeting_rules, created_by) VALUES
('ai_content_moderation', 'boolean', 'true', 'Enable AI-powered content moderation', 
 '{"enabled_for": "all", "rollout_percentage": 100}',
 (SELECT id FROM users WHERE email = 'system@thecircle.local' LIMIT 1)),
 
('smart_notifications', 'boolean', 'true', 'Enable AI-optimized notification delivery', 
 '{"enabled_for": "premium_users", "rollout_percentage": 50}',
 (SELECT id FROM users WHERE email = 'system@thecircle.local' LIMIT 1)),
 
('predictive_analytics', 'boolean', 'true', 'Enable predictive analytics and insights',
 '{"enabled_for": "admin_users", "rollout_percentage": 100}',
 (SELECT id FROM users WHERE email = 'system@thecircle.local' LIMIT 1));
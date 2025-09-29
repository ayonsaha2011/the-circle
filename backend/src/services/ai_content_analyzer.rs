use crate::services::SecurityService;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct AiContentAnalyzer {
    db: PgPool,
    security_service: SecurityService,
    // In production, this would connect to actual ML services
    ml_client: MockMlClient,
}

#[derive(Debug)]
pub enum AnalysisError {
    DatabaseError(sqlx::Error),
    MlServiceError(String),
    InvalidContent,
    ModelNotFound,
    ConfigurationError,
}

impl std::fmt::Display for AnalysisError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AnalysisError::DatabaseError(e) => write!(f, "Database error: {}", e),
            AnalysisError::MlServiceError(e) => write!(f, "ML service error: {}", e),
            AnalysisError::InvalidContent => write!(f, "Invalid content for analysis"),
            AnalysisError::ModelNotFound => write!(f, "ML model not found"),
            AnalysisError::ConfigurationError => write!(f, "Configuration error"),
        }
    }
}

impl std::error::Error for AnalysisError {}

impl From<sqlx::Error> for AnalysisError {
    fn from(err: sqlx::Error) -> Self {
        AnalysisError::DatabaseError(err)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContentAnalysisResult {
    pub id: Uuid,
    pub content_type: String,
    pub content_id: Uuid,
    pub user_id: Option<Uuid>,
    pub sentiment_score: f64,
    pub toxicity_score: f64,
    pub spam_score: f64,
    pub language_detected: Option<String>,
    pub topics: Vec<String>,
    pub entities: Vec<NamedEntity>,
    pub moderation_action: String,
    pub confidence_level: f64,
    pub analysis_details: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NamedEntity {
    pub text: String,
    pub entity_type: String,
    pub confidence: f64,
    pub start_pos: usize,
    pub end_pos: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModerationRule {
    pub id: Uuid,
    pub rule_name: String,
    pub rule_type: String,
    pub rule_config: serde_json::Value,
    pub threshold_score: f64,
    pub action: String,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContentModerationRequest {
    pub content_type: String,
    pub content_id: Uuid,
    pub content_text: String,
    pub user_id: Option<Uuid>,
    pub metadata: Option<serde_json::Value>,
}

// Mock ML client for demonstration (in production, use actual ML services)
#[derive(Debug, Clone)]
struct MockMlClient;

impl MockMlClient {
    fn analyze_sentiment(&self, text: &str) -> Result<f64, AnalysisError> {
        // Mock sentiment analysis - in production, call actual ML model
        let positive_words = ["good", "great", "excellent", "amazing", "wonderful", "fantastic"];
        let negative_words = ["bad", "terrible", "awful", "horrible", "disgusting", "hate"];
        
        let text_lower = text.to_lowercase();
        let positive_count = positive_words.iter().filter(|&word| text_lower.contains(word)).count();
        let negative_count = negative_words.iter().filter(|&word| text_lower.contains(word)).count();
        
        let total_words = text.split_whitespace().count().max(1);
        let sentiment = (positive_count as f64 - negative_count as f64) / total_words as f64;
        
        // Normalize to 0-1 range where 0.5 is neutral
        Ok(0.5 + sentiment.clamp(-0.5, 0.5))
    }
    
    fn detect_toxicity(&self, text: &str) -> Result<f64, AnalysisError> {
        // Mock toxicity detection
        let toxic_words = ["hate", "kill", "die", "stupid", "idiot", "moron", "racist", "sexist"];
        let text_lower = text.to_lowercase();
        let toxic_count = toxic_words.iter().filter(|&word| text_lower.contains(word)).count();
        
        Ok((toxic_count as f64 / 10.0).min(1.0))
    }
    
    fn detect_spam(&self, text: &str) -> Result<f64, AnalysisError> {
        // Mock spam detection
        let spam_indicators = ["click here", "free money", "earn $", "limited time", "act now", "www.", "http"];
        let text_lower = text.to_lowercase();
        let spam_count = spam_indicators.iter().filter(|&indicator| text_lower.contains(indicator)).count();
        
        Ok((spam_count as f64 / 5.0).min(1.0))
    }
    
    fn detect_language(&self, text: &str) -> Result<String, AnalysisError> {
        // Mock language detection - in production, use actual language detection
        if text.chars().any(|c| "áéíóúñüç".contains(c)) {
            Ok("es".to_string())
        } else if text.chars().any(|c| "àâäéèêëïîôùûüÿç".contains(c)) {
            Ok("fr".to_string())
        } else if text.chars().any(|c| "äöüß".contains(c)) {
            Ok("de".to_string())
        } else {
            Ok("en".to_string())
        }
    }
    
    fn extract_topics(&self, text: &str) -> Result<Vec<String>, AnalysisError> {
        // Mock topic extraction
        let mut topics = Vec::new();
        let text_lower = text.to_lowercase();
        
        if text_lower.contains("security") || text_lower.contains("privacy") || text_lower.contains("encryption") {
            topics.push("security".to_string());
        }
        if text_lower.contains("governance") || text_lower.contains("voting") || text_lower.contains("proposal") {
            topics.push("governance".to_string());
        }
        if text_lower.contains("technology") || text_lower.contains("ai") || text_lower.contains("machine learning") {
            topics.push("technology".to_string());
        }
        if text_lower.contains("community") || text_lower.contains("social") || text_lower.contains("friendship") {
            topics.push("community".to_string());
        }
        
        Ok(topics)
    }
    
    fn extract_entities(&self, text: &str) -> Result<Vec<NamedEntity>, AnalysisError> {
        // Mock named entity recognition
        let mut entities = Vec::new();
        
        // Simple email detection
        if let Some(start) = text.find('@') {
            if let Some(email_start) = text[..start].rfind(' ') {
                let email_start = email_start + 1;
                if let Some(email_end) = text[start..].find(' ') {
                    let email_end = start + email_end;
                    entities.push(NamedEntity {
                        text: text[email_start..email_end].to_string(),
                        entity_type: "EMAIL".to_string(),
                        confidence: 0.9,
                        start_pos: email_start,
                        end_pos: email_end,
                    });
                }
            }
        }
        
        // Simple URL detection
        for protocol in ["http://", "https://", "www."] {
            if let Some(start) = text.find(protocol) {
                if let Some(end) = text[start..].find(' ') {
                    let url_end = start + end;
                    entities.push(NamedEntity {
                        text: text[start..url_end].to_string(),
                        entity_type: "URL".to_string(),
                        confidence: 0.95,
                        start_pos: start,
                        end_pos: url_end,
                    });
                }
            }
        }
        
        Ok(entities)
    }
}

impl AiContentAnalyzer {
    pub fn new(db: PgPool, security_service: SecurityService) -> Self {
        Self {
            db,
            security_service,
            ml_client: MockMlClient,
        }
    }
    
    /// Analyze content and apply moderation rules
    pub async fn analyze_content(
        &self,
        request: ContentModerationRequest,
    ) -> Result<ContentAnalysisResult, AnalysisError> {
        // Perform ML analysis
        let sentiment_score = self.ml_client.analyze_sentiment(&request.content_text)?;
        let toxicity_score = self.ml_client.detect_toxicity(&request.content_text)?;
        let spam_score = self.ml_client.detect_spam(&request.content_text)?;
        let language = self.ml_client.detect_language(&request.content_text)?;
        let topics = self.ml_client.extract_topics(&request.content_text)?;
        let entities = self.ml_client.extract_entities(&request.content_text)?;
        
        // Determine overall confidence
        let confidence_level = self.calculate_confidence(sentiment_score, toxicity_score, spam_score);
        
        // Apply moderation rules
        let moderation_action = self.apply_moderation_rules(
            sentiment_score,
            toxicity_score,
            spam_score,
            &topics,
        ).await?;
        
        // Store analysis results
        let analysis_id = Uuid::new_v4();
        let analysis_details = serde_json::json!({
            "word_count": request.content_text.split_whitespace().count(),
            "character_count": request.content_text.len(),
            "topics": topics,
            "entities": entities,
            "language": language,
            "processing_time_ms": 150 // mock processing time
        });
        
        sqlx::query!(
            r#"
            INSERT INTO content_analysis (
                id, content_type, content_id, user_id, analysis_results,
                sentiment_score, toxicity_score, spam_score, language_detected,
                topics, entities, moderation_action, confidence_level
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            "#,
            analysis_id,
            request.content_type,
            request.content_id,
            request.user_id,
            analysis_details,
            rust_decimal::Decimal::from_f64_retain(sentiment_score).unwrap_or_default(),
            rust_decimal::Decimal::from_f64_retain(toxicity_score).unwrap_or_default(),
            rust_decimal::Decimal::from_f64_retain(spam_score).unwrap_or_default(),
            language,
            serde_json::to_value(&topics).unwrap_or_default(),
            serde_json::to_value(&entities).unwrap_or_default(),
            moderation_action,
            rust_decimal::Decimal::from_f64_retain(confidence_level).unwrap_or_default()
        )
        .execute(&self.db)
        .await?;
        
        // Log moderation action if taken
        if moderation_action != "none" {
            self.security_service.log_security_event(
                request.user_id,
                "content_moderation_action".to_string(),
                None,
                None,
                Some(serde_json::json!({
                    "content_id": request.content_id,
                    "content_type": request.content_type,
                    "action": moderation_action,
                    "toxicity_score": toxicity_score,
                    "spam_score": spam_score,
                    "confidence": confidence_level
                })),
            ).await;
        }
        
        Ok(ContentAnalysisResult {
            id: analysis_id,
            content_type: request.content_type,
            content_id: request.content_id,
            user_id: request.user_id,
            sentiment_score,
            toxicity_score,
            spam_score,
            language_detected: Some(language),
            topics,
            entities,
            moderation_action,
            confidence_level,
            analysis_details,
            created_at: Utc::now(),
        })
    }
    
    /// Apply moderation rules based on analysis scores
    async fn apply_moderation_rules(
        &self,
        sentiment_score: f64,
        toxicity_score: f64,
        spam_score: f64,
        topics: &[String],
    ) -> Result<String, AnalysisError> {
        let rules = self.get_active_moderation_rules().await?;
        
        for rule in rules {
            let should_trigger = match rule.rule_type.as_str() {
                "toxicity" => toxicity_score >= rule.threshold_score,
                "spam" => spam_score >= rule.threshold_score,
                "sentiment" => {
                    // Trigger on very negative sentiment (< 0.2)
                    sentiment_score <= rule.threshold_score
                },
                "custom" => {
                    // Custom rules can combine multiple factors
                    toxicity_score >= rule.threshold_score || spam_score >= rule.threshold_score
                },
                _ => false,
            };
            
            if should_trigger {
                return Ok(rule.action);
            }
        }
        
        Ok("none".to_string())
    }
    
    /// Get active moderation rules
    async fn get_active_moderation_rules(&self) -> Result<Vec<ModerationRule>, AnalysisError> {
        let rules = sqlx::query!(
            "SELECT * FROM moderation_rules WHERE is_active = true ORDER BY threshold_score DESC"
        )
        .fetch_all(&self.db)
        .await?;
        
        Ok(rules.into_iter().map(|row| ModerationRule {
            id: row.id,
            rule_name: row.rule_name,
            rule_type: row.rule_type,
            rule_config: row.rule_config,
            threshold_score: row.threshold_score.to_f64().unwrap_or(0.0),
            action: row.action,
            is_active: row.is_active,
        }).collect())
    }
    
    /// Calculate overall confidence score
    fn calculate_confidence(&self, sentiment: f64, toxicity: f64, spam: f64) -> f64 {
        // Simple confidence calculation - in production, use more sophisticated methods
        let avg_score = (sentiment + toxicity + spam) / 3.0;
        let variance = ((sentiment - avg_score).powi(2) + 
                       (toxicity - avg_score).powi(2) + 
                       (spam - avg_score).powi(2)) / 3.0;
        
        // Higher confidence when scores are consistent (low variance)
        (1.0 - variance).max(0.1).min(1.0)
    }
    
    /// Get content analysis history
    pub async fn get_content_analysis_history(
        &self,
        content_id: Uuid,
    ) -> Result<Vec<ContentAnalysisResult>, AnalysisError> {
        let analyses = sqlx::query!(
            r#"
            SELECT id, content_type, content_id, user_id, analysis_results,
                   sentiment_score, toxicity_score, spam_score, language_detected,
                   topics, entities, moderation_action, confidence_level, created_at
            FROM content_analysis 
            WHERE content_id = $1 
            ORDER BY created_at DESC
            "#,
            content_id
        )
        .fetch_all(&self.db)
        .await?;
        
        Ok(analyses.into_iter().map(|row| ContentAnalysisResult {
            id: row.id,
            content_type: row.content_type,
            content_id: row.content_id,
            user_id: row.user_id,
            sentiment_score: row.sentiment_score.unwrap_or_default().to_f64().unwrap_or(0.0),
            toxicity_score: row.toxicity_score.unwrap_or_default().to_f64().unwrap_or(0.0),
            spam_score: row.spam_score.unwrap_or_default().to_f64().unwrap_or(0.0),
            language_detected: row.language_detected,
            topics: serde_json::from_value(row.topics.unwrap_or_default()).unwrap_or_default(),
            entities: serde_json::from_value(row.entities.unwrap_or_default()).unwrap_or_default(),
            moderation_action: row.moderation_action,
            confidence_level: row.confidence_level.unwrap_or_default().to_f64().unwrap_or(0.0),
            analysis_details: row.analysis_results,
            created_at: row.created_at,
        }).collect())
    }
    
    /// Get moderation statistics
    pub async fn get_moderation_stats(&self, time_range: chrono::Duration) -> Result<serde_json::Value, AnalysisError> {
        let since = Utc::now() - time_range;
        
        let stats = sqlx::query!(
            r#"
            SELECT 
                moderation_action,
                COUNT(*) as count,
                AVG(toxicity_score) as avg_toxicity,
                AVG(spam_score) as avg_spam,
                AVG(sentiment_score) as avg_sentiment
            FROM content_analysis 
            WHERE created_at >= $1
            GROUP BY moderation_action
            "#,
            since
        )
        .fetch_all(&self.db)
        .await?;
        
        let total_analyzed = sqlx::query!(
            "SELECT COUNT(*) as total FROM content_analysis WHERE created_at >= $1",
            since
        )
        .fetch_one(&self.db)
        .await?;
        
        Ok(serde_json::json!({
            "time_range_hours": time_range.num_hours(),
            "total_analyzed": total_analyzed.total,
            "actions": stats.into_iter().map(|row| serde_json::json!({
                "action": row.moderation_action,
                "count": row.count,
                "avg_toxicity": row.avg_toxicity.unwrap_or_default(),
                "avg_spam": row.avg_spam.unwrap_or_default(),
                "avg_sentiment": row.avg_sentiment.unwrap_or_default()
            })).collect::<Vec<_>>()
        }))
    }
    
    /// Batch analyze multiple pieces of content
    pub async fn batch_analyze_content(
        &self,
        requests: Vec<ContentModerationRequest>,
    ) -> Result<Vec<ContentAnalysisResult>, AnalysisError> {
        let mut results = Vec::new();
        
        for request in requests {
            match self.analyze_content(request).await {
                Ok(result) => results.push(result),
                Err(e) => {
                    // Log error but continue with other content
                    eprintln!("Failed to analyze content: {}", e);
                }
            }
        }
        
        Ok(results)
    }
    
    /// Update moderation rule
    pub async fn update_moderation_rule(
        &self,
        rule_id: Uuid,
        threshold_score: Option<f64>,
        action: Option<String>,
        is_active: Option<bool>,
    ) -> Result<(), AnalysisError> {
        if let Some(threshold) = threshold_score {
            sqlx::query!(
                "UPDATE moderation_rules SET threshold_score = $1 WHERE id = $2",
                rust_decimal::Decimal::from_f64_retain(threshold).unwrap_or_default(),
                rule_id
            )
            .execute(&self.db)
            .await?;
        }
        
        if let Some(action_str) = action {
            sqlx::query!(
                "UPDATE moderation_rules SET action = $1 WHERE id = $2",
                action_str,
                rule_id
            )
            .execute(&self.db)
            .await?;
        }
        
        if let Some(active) = is_active {
            sqlx::query!(
                "UPDATE moderation_rules SET is_active = $1 WHERE id = $2",
                active,
                rule_id
            )
            .execute(&self.db)
            .await?;
        }
        
        Ok(())
    }
}
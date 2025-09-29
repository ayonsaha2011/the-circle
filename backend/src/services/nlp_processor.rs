use std::collections::HashMap;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NlpAnalysis {
    pub id: Uuid,
    pub content_id: String,
    pub content_type: String,
    pub language: String,
    pub sentiment: SentimentAnalysis,
    pub entities: Vec<NamedEntity>,
    pub topics: Vec<Topic>,
    pub keywords: Vec<String>,
    pub summary: Option<String>,
    pub toxicity_score: f32,
    pub spam_probability: f32,
    pub readability_score: f32,
    pub processed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SentimentAnalysis {
    pub overall_sentiment: Sentiment,
    pub confidence: f32,
    pub positive_score: f32,
    pub negative_score: f32,
    pub neutral_score: f32,
    pub emotional_indicators: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Sentiment {
    Positive,
    Negative,
    Neutral,
    Mixed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NamedEntity {
    pub text: String,
    pub entity_type: EntityType,
    pub confidence: f32,
    pub start_pos: usize,
    pub end_pos: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EntityType {
    Person,
    Organization,
    Location,
    Date,
    Money,
    Email,
    Phone,
    Url,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Topic {
    pub topic_name: String,
    pub relevance_score: f32,
    pub keywords: Vec<String>,
}

pub struct NlpProcessor {
    db_pool: PgPool,
}

impl NlpProcessor {
    pub fn new(db_pool: PgPool) -> Self {
        Self { db_pool }
    }

    pub async fn process_content(&self, content: &str, content_type: &str, content_id: &str) -> Result<NlpAnalysis> {
        let sentiment = self.analyze_sentiment(content).await?;
        let entities = self.extract_entities(content).await?;
        let topics = self.extract_topics(content).await?;
        let keywords = self.extract_keywords(content).await?;
        
        let analysis = NlpAnalysis {
            id: Uuid::new_v4(),
            content_id: content_id.to_string(),
            content_type: content_type.to_string(),
            language: "en".to_string(),
            sentiment,
            entities,
            topics,
            keywords,
            summary: if content.len() > 500 { Some(self.generate_summary(content).await?) } else { None },
            toxicity_score: self.detect_toxicity(content).await?,
            spam_probability: self.detect_spam(content).await?,
            readability_score: self.calculate_readability(content),
            processed_at: Utc::now(),
        };

        self.store_analysis(&analysis).await?;
        Ok(analysis)
    }

    async fn analyze_sentiment(&self, content: &str) -> Result<SentimentAnalysis> {
        // Mock sentiment analysis
        let positive_keywords = ["good", "great", "excellent", "amazing", "wonderful", "love"];
        let negative_keywords = ["bad", "terrible", "awful", "hate", "dislike", "horrible"];

        let content_lower = content.to_lowercase();
        let positive_count = positive_keywords.iter().filter(|&&word| content_lower.contains(word)).count() as f32;
        let negative_count = negative_keywords.iter().filter(|&&word| content_lower.contains(word)).count() as f32;

        let positive_score = (positive_count / (positive_count + negative_count + 1.0)).min(1.0);
        let negative_score = (negative_count / (positive_count + negative_count + 1.0)).min(1.0);
        let neutral_score = 1.0 - positive_score - negative_score;

        let overall_sentiment = if positive_score > negative_score && positive_score > 0.5 {
            Sentiment::Positive
        } else if negative_score > positive_score && negative_score > 0.5 {
            Sentiment::Negative
        } else {
            Sentiment::Neutral
        };

        Ok(SentimentAnalysis {
            overall_sentiment,
            confidence: (positive_score - negative_score).abs(),
            positive_score,
            negative_score,
            neutral_score,
            emotional_indicators: vec!["mock_indicator".to_string()],
        })
    }

    async fn extract_entities(&self, content: &str) -> Result<Vec<NamedEntity>> {
        // Mock entity extraction
        let mut entities = Vec::new();
        
        // Simple email detection
        if let Some(start) = content.find('@') {
            if let Some(space_before) = content[..start].rfind(' ') {
                if let Some(space_after) = content[start..].find(' ') {
                    let email = &content[space_before + 1..start + space_after];
                    entities.push(NamedEntity {
                        text: email.to_string(),
                        entity_type: EntityType::Email,
                        confidence: 0.9,
                        start_pos: space_before + 1,
                        end_pos: start + space_after,
                    });
                }
            }
        }

        Ok(entities)
    }

    async fn extract_topics(&self, content: &str) -> Result<Vec<Topic>> {
        // Mock topic extraction
        let topics = vec![
            Topic {
                topic_name: "general_discussion".to_string(),
                relevance_score: 0.7,
                keywords: vec!["discussion", "topic", "conversation"].iter().map(|s| s.to_string()).collect(),
            }
        ];
        Ok(topics)
    }

    async fn extract_keywords(&self, _content: &str) -> Result<Vec<String>> {
        Ok(vec!["keyword1".to_string(), "keyword2".to_string()])
    }

    async fn generate_summary(&self, content: &str) -> Result<String> {
        // Mock summarization
        let words: Vec<&str> = content.split_whitespace().take(20).collect();
        Ok(format!("{}...", words.join(" ")))
    }

    async fn detect_toxicity(&self, content: &str) -> Result<f32> {
        let toxic_words = ["toxic", "harmful", "abusive"];
        let toxic_count = toxic_words.iter()
            .filter(|&&word| content.to_lowercase().contains(word))
            .count() as f32;
        Ok((toxic_count / 10.0).min(1.0))
    }

    async fn detect_spam(&self, content: &str) -> Result<f32> {
        let spam_indicators = ["click here", "free money", "urgent"];
        let spam_count = spam_indicators.iter()
            .filter(|&&phrase| content.to_lowercase().contains(phrase))
            .count() as f32;
        Ok((spam_count / 5.0).min(1.0))
    }

    fn calculate_readability(&self, content: &str) -> f32 {
        // Simple readability calculation
        let word_count = content.split_whitespace().count() as f32;
        let sentence_count = content.matches('.').count() as f32 + 1.0;
        let avg_words_per_sentence = word_count / sentence_count;
        
        // Return score between 0-1 (higher = more readable)
        if avg_words_per_sentence < 15.0 { 0.9 }
        else if avg_words_per_sentence < 25.0 { 0.7 }
        else { 0.5 }
    }

    async fn store_analysis(&self, analysis: &NlpAnalysis) -> Result<()> {
        sqlx::query!(
            r#"
            INSERT INTO nlp_analysis (
                id, content_id, content_type, language, sentiment_data,
                entities, topics, keywords, summary, toxicity_score,
                spam_probability, readability_score, processed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            "#,
            analysis.id,
            analysis.content_id,
            analysis.content_type,
            analysis.language,
            serde_json::to_value(&analysis.sentiment)?,
            serde_json::to_value(&analysis.entities)?,
            serde_json::to_value(&analysis.topics)?,
            &analysis.keywords,
            analysis.summary,
            analysis.toxicity_score,
            analysis.spam_probability,
            analysis.readability_score,
            analysis.processed_at
        )
        .execute(&self.db_pool)
        .await?;

        Ok(())
    }
}
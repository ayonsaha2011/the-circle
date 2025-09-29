use crate::services::SecurityService;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::{HashMap, VecDeque};
use std::net::IpAddr;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct ThreatDetectionService {
    db: PgPool,
    security_service: SecurityService,
    // In-memory threat tracking for real-time analysis
    ip_tracking: HashMap<IpAddr, IpThreatData>,
    user_behavior: HashMap<Uuid, UserBehaviorData>,
}

#[derive(Debug)]
pub enum ThreatError {
    DatabaseError(sqlx::Error),
    InvalidRule,
    DetectionFailed,
    ConfigurationError,
}

impl std::fmt::Display for ThreatError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ThreatError::DatabaseError(e) => write!(f, "Database error: {}", e),
            ThreatError::InvalidRule => write!(f, "Invalid security rule"),
            ThreatError::DetectionFailed => write!(f, "Threat detection failed"),
            ThreatError::ConfigurationError => write!(f, "Configuration error"),
        }
    }
}

impl std::error::Error for ThreatError {}

impl From<sqlx::Error> for ThreatError {
    fn from(err: sqlx::Error) -> Self {
        ThreatError::DatabaseError(err)
    }
}

#[derive(Debug, Clone)]
struct IpThreatData {
    failed_logins: VecDeque<DateTime<Utc>>,
    request_count: u32,
    last_request: DateTime<Utc>,
    suspicious_activity: bool,
}

#[derive(Debug, Clone)]
struct UserBehaviorData {
    login_times: VecDeque<DateTime<Utc>>,
    access_patterns: HashMap<String, u32>,
    risk_score: f64,
    baseline_established: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SecurityAlert {
    pub id: Uuid,
    pub alert_type: String,
    pub severity: String,
    pub source_ip: Option<IpAddr>,
    pub user_id: Option<Uuid>,
    pub resource_affected: Option<String>,
    pub threat_indicators: serde_json::Value,
    pub detection_method: String,
    pub status: String,
    pub assigned_to: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ThreatIndicator {
    pub indicator_type: String,
    pub value: String,
    pub confidence: f64,
    pub context: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BehaviorAnalysisResult {
    pub user_id: Uuid,
    pub risk_score: f64,
    pub anomalies: Vec<String>,
    pub recommendations: Vec<String>,
}

impl ThreatDetectionService {
    pub fn new(db: PgPool, security_service: SecurityService) -> Self {
        Self {
            db,
            security_service,
            ip_tracking: HashMap::new(),
            user_behavior: HashMap::new(),
        }
    }

    /// Analyze login attempt for threats
    pub async fn analyze_login_attempt(
        &mut self,
        user_id: Option<Uuid>,
        ip_address: IpAddr,
        user_agent: &str,
        success: bool,
    ) -> Result<Vec<ThreatIndicator>, ThreatError> {
        let mut indicators = Vec::new();
        let now = Utc::now();

        // Track IP-based threats
        let ip_data = self.ip_tracking.entry(ip_address).or_insert_with(|| IpThreatData {
            failed_logins: VecDeque::new(),
            request_count: 0,
            last_request: now,
            suspicious_activity: false,
        });

        ip_data.last_request = now;
        ip_data.request_count += 1;

        if !success {
            ip_data.failed_logins.push_back(now);
            
            // Remove old failed login attempts (older than 1 hour)
            while let Some(&front_time) = ip_data.failed_logins.front() {
                if now.signed_duration_since(front_time) > Duration::hours(1) {
                    ip_data.failed_logins.pop_front();
                } else {
                    break;
                }
            }

            // Check for brute force attack
            if ip_data.failed_logins.len() >= 5 {
                indicators.push(ThreatIndicator {
                    indicator_type: "brute_force_attack".to_string(),
                    value: ip_address.to_string(),
                    confidence: 0.9,
                    context: HashMap::from([
                        ("failed_attempts".to_string(), ip_data.failed_logins.len().to_string()),
                        ("timeframe".to_string(), "1_hour".to_string()),
                    ]),
                });

                // Create security alert
                self.create_security_alert(
                    "brute_force_attack",
                    "high",
                    Some(ip_address),
                    user_id,
                    None,
                    serde_json::json!({
                        "failed_attempts": ip_data.failed_logins.len(),
                        "user_agent": user_agent,
                        "timeframe_hours": 1
                    }),
                    "rule_based",
                ).await?;
            }
        }

        // Analyze user behavior if user is known
        if let Some(uid) = user_id {
            let behavior_indicators = self.analyze_user_behavior(uid, ip_address, user_agent, success).await?;
            indicators.extend(behavior_indicators);
        }

        // Check for suspicious user agents
        if self.is_suspicious_user_agent(user_agent) {
            indicators.push(ThreatIndicator {
                indicator_type: "suspicious_user_agent".to_string(),
                value: user_agent.to_string(),
                confidence: 0.7,
                context: HashMap::from([
                    ("ip_address".to_string(), ip_address.to_string()),
                ]),
            });
        }

        Ok(indicators)
    }

    /// Analyze user behavior patterns
    async fn analyze_user_behavior(
        &mut self,
        user_id: Uuid,
        ip_address: IpAddr,
        user_agent: &str,
        login_success: bool,
    ) -> Result<Vec<ThreatIndicator>, ThreatError> {
        let mut indicators = Vec::new();
        let now = Utc::now();

        // Get or create user behavior data
        let behavior_data = self.user_behavior.entry(user_id).or_insert_with(|| UserBehaviorData {
            login_times: VecDeque::new(),
            access_patterns: HashMap::new(),
            risk_score: 0.0,
            baseline_established: false,
        });

        if login_success {
            behavior_data.login_times.push_back(now);
            
            // Keep only last 30 days of login times
            while let Some(&front_time) = behavior_data.login_times.front() {
                if now.signed_duration_since(front_time) > Duration::days(30) {
                    behavior_data.login_times.pop_front();
                } else {
                    break;
                }
            }

            // Update access patterns
            let hour_key = format!("hour_{}", now.hour());
            *behavior_data.access_patterns.entry(hour_key).or_insert(0) += 1;

            // Check for unusual login times
            if behavior_data.baseline_established {
                let unusual_time = self.detect_unusual_login_time(user_id, now).await?;
                if unusual_time {
                    indicators.push(ThreatIndicator {
                        indicator_type: "unusual_login_time".to_string(),
                        value: format!("{}:00", now.hour()),
                        confidence: 0.6,
                        context: HashMap::from([
                            ("user_id".to_string(), user_id.to_string()),
                            ("ip_address".to_string(), ip_address.to_string()),
                        ]),
                    });
                }
            }

            // Check for impossible travel
            if let Some(impossible_travel) = self.detect_impossible_travel(user_id, ip_address).await? {
                indicators.push(ThreatIndicator {
                    indicator_type: "impossible_travel".to_string(),
                    value: ip_address.to_string(),
                    confidence: 0.85,
                    context: impossible_travel,
                });
            }

            // Establish baseline after 10 successful logins
            if !behavior_data.baseline_established && behavior_data.login_times.len() >= 10 {
                behavior_data.baseline_established = true;
                self.update_user_baseline(user_id).await?;
            }
        }

        Ok(indicators)
    }

    /// Detect unusual login times based on user's historical pattern
    async fn detect_unusual_login_time(&self, user_id: Uuid, login_time: DateTime<Utc>) -> Result<bool, ThreatError> {
        let profile = sqlx::query!(
            r#"
            SELECT login_patterns FROM behavioral_profiles 
            WHERE user_id = $1 AND baseline_established = true
            "#,
            user_id
        )
        .fetch_optional(&self.db)
        .await?;

        if let Some(profile) = profile {
            if let Ok(patterns) = serde_json::from_value::<HashMap<String, f64>>(profile.login_patterns.unwrap_or_default()) {
                let hour_key = format!("hour_{}", login_time.hour());
                let frequency = patterns.get(&hour_key).unwrap_or(&0.0);
                
                // Consider unusual if frequency is less than 5% of total logins
                return Ok(*frequency < 0.05);
            }
        }

        Ok(false)
    }

    /// Detect impossible travel based on IP geolocation
    async fn detect_impossible_travel(&self, user_id: Uuid, current_ip: IpAddr) -> Result<Option<HashMap<String, String>>, ThreatError> {
        // Get last login location from database
        let last_login = sqlx::query!(
            r#"
            SELECT ip_address, created_at FROM activity_logs 
            WHERE user_id = $1 AND event_type = 'login' AND created_at < NOW() - INTERVAL '1 hour'
            ORDER BY created_at DESC 
            LIMIT 1
            "#,
            user_id
        )
        .fetch_optional(&self.db)
        .await?;

        if let Some(last) = last_login {
            if let Ok(last_ip) = last.ip_address.unwrap_or_default().parse::<IpAddr>() {
                // Simplified geolocation check - in production, use actual geolocation service
                let distance = self.estimate_distance(last_ip, current_ip);
                let time_diff = Utc::now().signed_duration_since(last.created_at).num_hours() as f64;
                
                // Calculate maximum possible travel speed (assuming 1000 km/h max travel speed)
                let max_distance = time_diff * 1000.0;
                
                if distance > max_distance {
                    return Ok(Some(HashMap::from([
                        ("previous_ip".to_string(), last_ip.to_string()),
                        ("current_ip".to_string(), current_ip.to_string()),
                        ("estimated_distance_km".to_string(), distance.to_string()),
                        ("time_hours".to_string(), time_diff.to_string()),
                        ("max_possible_distance".to_string(), max_distance.to_string()),
                    ])));
                }
            }
        }

        Ok(None)
    }

    /// Create a security alert
    async fn create_security_alert(
        &self,
        alert_type: &str,
        severity: &str,
        source_ip: Option<IpAddr>,
        user_id: Option<Uuid>,
        resource_affected: Option<String>,
        threat_indicators: serde_json::Value,
        detection_method: &str,
    ) -> Result<SecurityAlert, ThreatError> {
        let alert_id = Uuid::new_v4();
        
        let alert = sqlx::query_as!(
            SecurityAlert,
            r#"
            INSERT INTO security_alerts (
                id, alert_type, severity, source_ip, user_id, 
                resource_affected, threat_indicators, detection_method
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
            alert_id,
            alert_type,
            severity,
            source_ip,
            user_id,
            resource_affected,
            threat_indicators,
            detection_method
        )
        .fetch_one(&self.db)
        .await?;

        // Log the alert creation
        self.security_service.log_security_event(
            user_id,
            "security_alert_created".to_string(),
            source_ip,
            None,
            Some(serde_json::json!({
                "alert_id": alert_id,
                "alert_type": alert_type,
                "severity": severity,
                "detection_method": detection_method
            })),
        ).await;

        Ok(alert)
    }

    /// Update user behavioral baseline
    async fn update_user_baseline(&self, user_id: Uuid) -> Result<(), ThreatError> {
        // Calculate login patterns from recent activity
        let login_data = sqlx::query!(
            r#"
            SELECT EXTRACT(hour FROM created_at) as hour, COUNT(*) as count
            FROM activity_logs 
            WHERE user_id = $1 AND event_type = 'login' 
              AND created_at > NOW() - INTERVAL '30 days'
            GROUP BY EXTRACT(hour FROM created_at)
            "#,
            user_id
        )
        .fetch_all(&self.db)
        .await?;

        let total_logins: i64 = login_data.iter().map(|row| row.count.unwrap_or(0)).sum();
        let mut login_patterns = HashMap::new();

        for row in login_data {
            if let (Some(hour), Some(count)) = (row.hour, row.count) {
                let frequency = count as f64 / total_logins as f64;
                login_patterns.insert(format!("hour_{}", hour), frequency);
            }
        }

        let patterns_json = serde_json::to_value(login_patterns).unwrap_or_default();

        // Update or insert behavioral profile
        sqlx::query!(
            r#"
            INSERT INTO behavioral_profiles (user_id, login_patterns, baseline_established, last_updated)
            VALUES ($1, $2, true, NOW())
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                login_patterns = $2,
                baseline_established = true,
                last_updated = NOW()
            "#,
            user_id,
            patterns_json
        )
        .execute(&self.db)
        .await?;

        Ok(())
    }

    /// Check if user agent is suspicious
    fn is_suspicious_user_agent(&self, user_agent: &str) -> bool {
        let suspicious_patterns = [
            "bot", "crawler", "spider", "scraper", "scanner",
            "curl", "wget", "python", "java", "go-http",
        ];

        let ua_lower = user_agent.to_lowercase();
        suspicious_patterns.iter().any(|pattern| ua_lower.contains(pattern))
    }

    /// Estimate distance between two IP addresses (simplified)
    fn estimate_distance(&self, ip1: IpAddr, ip2: IpAddr) -> f64 {
        // Simplified distance calculation - in production, use actual geolocation
        // This is a placeholder that returns a random distance for demonstration
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        (ip1, ip2).hash(&mut hasher);
        let hash = hasher.finish();
        
        // Return a distance between 0 and 20000 km based on IP hash
        (hash % 20000) as f64
    }

    /// Analyze behavioral anomalies for a user
    pub async fn analyze_behavioral_anomalies(&self, user_id: Uuid) -> Result<BehaviorAnalysisResult, ThreatError> {
        let profile = sqlx::query!(
            r#"
            SELECT login_patterns, access_patterns, communication_patterns, risk_score
            FROM behavioral_profiles 
            WHERE user_id = $1
            "#,
            user_id
        )
        .fetch_optional(&self.db)
        .await?;

        let mut anomalies = Vec::new();
        let mut recommendations = Vec::new();
        let mut risk_score = 0.0;

        if let Some(profile) = profile {
            risk_score = profile.risk_score.unwrap_or(0.0).to_f64().unwrap_or(0.0);

            // Analyze recent activity for anomalies
            let recent_activity = sqlx::query!(
                r#"
                SELECT event_type, COUNT(*) as count, 
                       EXTRACT(hour FROM created_at) as hour
                FROM activity_logs 
                WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
                GROUP BY event_type, EXTRACT(hour FROM created_at)
                "#,
                user_id
            )
            .fetch_all(&self.db)
            .await?;

            // Check for unusual activity patterns
            for activity in recent_activity {
                if let Some(count) = activity.count {
                    if count > 100 {  // Threshold for high activity
                        anomalies.push(format!("High {} activity: {} events", 
                            activity.event_type, count));
                        recommendations.push("Review recent activity for potential automation".to_string());
                    }
                }
            }

            // Update risk score based on anomalies
            risk_score += anomalies.len() as f64 * 0.1;
            risk_score = risk_score.min(1.0);  // Cap at 1.0

            // Update risk score in database
            sqlx::query!(
                "UPDATE behavioral_profiles SET risk_score = $1 WHERE user_id = $2",
                rust_decimal::Decimal::from_f64_retain(risk_score).unwrap_or_default(),
                user_id
            )
            .execute(&self.db)
            .await?;
        }

        Ok(BehaviorAnalysisResult {
            user_id,
            risk_score,
            anomalies,
            recommendations,
        })
    }

    /// Get security alerts for review
    pub async fn get_security_alerts(&self, status_filter: Option<String>) -> Result<Vec<SecurityAlert>, ThreatError> {
        let alerts = if let Some(status) = status_filter {
            sqlx::query_as!(
                SecurityAlert,
                "SELECT * FROM security_alerts WHERE status = $1 ORDER BY created_at DESC LIMIT 100",
                status
            )
            .fetch_all(&self.db)
            .await?
        } else {
            sqlx::query_as!(
                SecurityAlert,
                "SELECT * FROM security_alerts ORDER BY created_at DESC LIMIT 100"
            )
            .fetch_all(&self.db)
            .await?
        };

        Ok(alerts)
    }

    /// Resolve a security alert
    pub async fn resolve_security_alert(
        &self,
        alert_id: Uuid,
        resolver_id: Uuid,
        resolution_notes: Option<String>,
    ) -> Result<(), ThreatError> {
        sqlx::query!(
            r#"
            UPDATE security_alerts 
            SET status = 'resolved', assigned_to = $1, resolved_at = NOW()
            WHERE id = $2
            "#,
            resolver_id,
            alert_id
        )
        .execute(&self.db)
        .await?;

        // Log resolution
        self.security_service.log_security_event(
            Some(resolver_id),
            "security_alert_resolved".to_string(),
            None,
            None,
            Some(serde_json::json!({
                "alert_id": alert_id,
                "resolution_notes": resolution_notes
            })),
        ).await;

        Ok(())
    }
}
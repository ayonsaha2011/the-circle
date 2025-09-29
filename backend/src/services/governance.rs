use crate::services::{SecurityService, MultisigService};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct GovernanceService {
    db: PgPool,
    security_service: SecurityService,
    multisig_service: MultisigService,
}

#[derive(Debug)]
pub enum GovernanceError {
    DatabaseError(sqlx::Error),
    ProposalNotFound,
    Unauthorized,
    InvalidProposal,
    VotingNotActive,
    AlreadyVoted,
    InsufficientTokens,
    QuorumNotMet,
    InvalidVoteChoice,
    ProposalExpired,
}

impl std::fmt::Display for GovernanceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GovernanceError::DatabaseError(e) => write!(f, "Database error: {}", e),
            GovernanceError::ProposalNotFound => write!(f, "Proposal not found"),
            GovernanceError::Unauthorized => write!(f, "Unauthorized action"),
            GovernanceError::InvalidProposal => write!(f, "Invalid proposal"),
            GovernanceError::VotingNotActive => write!(f, "Voting is not active for this proposal"),
            GovernanceError::AlreadyVoted => write!(f, "User has already voted on this proposal"),
            GovernanceError::InsufficientTokens => write!(f, "Insufficient governance tokens"),
            GovernanceError::QuorumNotMet => write!(f, "Minimum quorum not met"),
            GovernanceError::InvalidVoteChoice => write!(f, "Invalid vote choice"),
            GovernanceError::ProposalExpired => write!(f, "Proposal has expired"),
        }
    }
}

impl std::error::Error for GovernanceError {}

impl From<sqlx::Error> for GovernanceError {
    fn from(err: sqlx::Error) -> Self {
        GovernanceError::DatabaseError(err)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Proposal {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub proposal_type: String,
    pub proposer_id: Uuid,
    pub status: String,
    pub voting_start: Option<DateTime<Utc>>,
    pub voting_end: Option<DateTime<Utc>>,
    pub execution_delay: i32,
    pub minimum_quorum: i32,
    pub approval_threshold: rust_decimal::Decimal,
    pub proposal_data: serde_json::Value,
    pub proposal_hash: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateProposalRequest {
    pub title: String,
    pub description: String,
    pub proposal_type: String,
    pub proposal_data: serde_json::Value,
    pub voting_duration_hours: i32,
    pub execution_delay_hours: Option<i32>,
    pub minimum_quorum: Option<i32>,
    pub approval_threshold: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Vote {
    pub id: Uuid,
    pub proposal_id: Uuid,
    pub voter_id: Uuid,
    pub vote_choice: String,
    pub voting_power: rust_decimal::Decimal,
    pub vote_reason: Option<String>,
    pub vote_signature: Option<String>,
    pub voted_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CastVoteRequest {
    pub vote_choice: String, // "for", "against", "abstain"
    pub vote_reason: Option<String>,
    pub delegate_power: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GovernanceToken {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token_type: String,
    pub balance: rust_decimal::Decimal,
    pub staked_amount: rust_decimal::Decimal,
    pub delegated_to: Option<Uuid>,
    pub last_claim: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProposalResults {
    pub proposal_id: Uuid,
    pub total_votes: i32,
    pub votes_for: rust_decimal::Decimal,
    pub votes_against: rust_decimal::Decimal,
    pub votes_abstain: rust_decimal::Decimal,
    pub total_voting_power: rust_decimal::Decimal,
    pub approval_percentage: f64,
    pub quorum_met: bool,
    pub passed: bool,
}

impl GovernanceService {
    pub fn new(
        db: PgPool, 
        security_service: SecurityService,
        multisig_service: MultisigService,
    ) -> Self {
        Self {
            db,
            security_service,
            multisig_service,
        }
    }

    /// Create a new governance proposal
    pub async fn create_proposal(
        &self,
        proposer_id: Uuid,
        request: CreateProposalRequest,
    ) -> Result<Proposal, GovernanceError> {
        // Check if user has sufficient tokens to create proposal
        let min_tokens_required = rust_decimal::Decimal::from(100); // 100 governance tokens
        let user_tokens = self.get_user_voting_power(proposer_id).await?;
        
        if user_tokens < min_tokens_required {
            return Err(GovernanceError::InsufficientTokens);
        }

        let proposal_id = Uuid::new_v4();
        let proposal_hash = self.calculate_proposal_hash(&request.proposal_data);
        
        let voting_start = Utc::now() + Duration::hours(24); // 24 hour delay before voting
        let voting_end = voting_start + Duration::hours(request.voting_duration_hours as i64);

        let proposal = sqlx::query_as!(
            Proposal,
            r#"
            INSERT INTO governance_proposals (
                id, title, description, proposal_type, proposer_id, 
                voting_start, voting_end, execution_delay, minimum_quorum,
                approval_threshold, proposal_data, proposal_hash
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
            "#,
            proposal_id,
            request.title,
            request.description,
            request.proposal_type,
            proposer_id,
            voting_start,
            voting_end,
            request.execution_delay_hours.unwrap_or(24),
            request.minimum_quorum.unwrap_or(100),
            rust_decimal::Decimal::from_f64_retain(request.approval_threshold.unwrap_or(0.5))
                .unwrap_or(rust_decimal::Decimal::from_f64_retain(0.5).unwrap()),
            request.proposal_data,
            proposal_hash
        )
        .fetch_one(&self.db)
        .await?;

        // Log proposal creation
        self.security_service.log_security_event(
            Some(proposer_id),
            "governance_proposal_created".to_string(),
            None,
            None,
            Some(serde_json::json!({
                "proposal_id": proposal_id,
                "proposal_type": request.proposal_type,
                "title": request.title,
                "voting_start": voting_start,
                "voting_end": voting_end
            })),
        ).await;

        Ok(proposal)
    }

    /// Cast a vote on a proposal
    pub async fn cast_vote(
        &self,
        voter_id: Uuid,
        proposal_id: Uuid,
        request: CastVoteRequest,
    ) -> Result<Vote, GovernanceError> {
        // Validate vote choice
        if !["for", "against", "abstain"].contains(&request.vote_choice.as_str()) {
            return Err(GovernanceError::InvalidVoteChoice);
        }

        // Get proposal details
        let proposal = self.get_proposal(proposal_id).await?;

        // Check if voting is active
        let now = Utc::now();
        if proposal.status != "active" 
            || proposal.voting_start.map_or(true, |start| now < start)
            || proposal.voting_end.map_or(true, |end| now > end) {
            return Err(GovernanceError::VotingNotActive);
        }

        // Check if user already voted
        let existing_vote = sqlx::query!(
            "SELECT id FROM governance_votes WHERE proposal_id = $1 AND voter_id = $2",
            proposal_id,
            voter_id
        )
        .fetch_optional(&self.db)
        .await?;

        if existing_vote.is_some() {
            return Err(GovernanceError::AlreadyVoted);
        }

        // Calculate voting power
        let voting_power = self.get_user_voting_power(voter_id).await?;
        if voting_power <= rust_decimal::Decimal::ZERO {
            return Err(GovernanceError::InsufficientTokens);
        }

        // Create vote record
        let vote = sqlx::query_as!(
            Vote,
            r#"
            INSERT INTO governance_votes (proposal_id, voter_id, vote_choice, voting_power, vote_reason)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            "#,
            proposal_id,
            voter_id,
            request.vote_choice,
            voting_power,
            request.vote_reason
        )
        .fetch_one(&self.db)
        .await?;

        // Log vote
        self.security_service.log_security_event(
            Some(voter_id),
            "governance_vote_cast".to_string(),
            None,
            None,
            Some(serde_json::json!({
                "proposal_id": proposal_id,
                "vote_choice": request.vote_choice,
                "voting_power": voting_power,
                "proposal_title": proposal.title
            })),
        ).await;

        Ok(vote)
    }

    /// Get proposal results
    pub async fn get_proposal_results(&self, proposal_id: Uuid) -> Result<ProposalResults, GovernanceError> {
        let results = sqlx::query!(
            r#"
            SELECT 
                COUNT(*) as total_votes,
                COALESCE(SUM(CASE WHEN vote_choice = 'for' THEN voting_power ELSE 0 END), 0) as votes_for,
                COALESCE(SUM(CASE WHEN vote_choice = 'against' THEN voting_power ELSE 0 END), 0) as votes_against,
                COALESCE(SUM(CASE WHEN vote_choice = 'abstain' THEN voting_power ELSE 0 END), 0) as votes_abstain,
                COALESCE(SUM(voting_power), 0) as total_voting_power
            FROM governance_votes
            WHERE proposal_id = $1
            "#,
            proposal_id
        )
        .fetch_one(&self.db)
        .await?;

        let proposal = self.get_proposal(proposal_id).await?;

        let total_votes = results.total_votes.unwrap_or(0) as i32;
        let votes_for = results.votes_for.unwrap_or(rust_decimal::Decimal::ZERO);
        let votes_against = results.votes_against.unwrap_or(rust_decimal::Decimal::ZERO);
        let votes_abstain = results.votes_abstain.unwrap_or(rust_decimal::Decimal::ZERO);
        let total_voting_power = results.total_voting_power.unwrap_or(rust_decimal::Decimal::ZERO);

        let approval_percentage = if total_voting_power > rust_decimal::Decimal::ZERO {
            (votes_for / total_voting_power).to_f64().unwrap_or(0.0) * 100.0
        } else {
            0.0
        };

        let quorum_met = total_votes >= proposal.minimum_quorum;
        let passed = quorum_met && 
            (votes_for / (votes_for + votes_against)) >= proposal.approval_threshold;

        Ok(ProposalResults {
            proposal_id,
            total_votes,
            votes_for,
            votes_against,
            votes_abstain,
            total_voting_power,
            approval_percentage,
            quorum_met,
            passed,
        })
    }

    /// Execute a passed proposal
    pub async fn execute_proposal(&self, proposal_id: Uuid, executor_id: Uuid) -> Result<(), GovernanceError> {
        let proposal = self.get_proposal(proposal_id).await?;
        
        // Check if proposal can be executed
        if proposal.status != "passed" {
            return Err(GovernanceError::InvalidProposal);
        }

        // Check if execution delay has passed
        if let Some(voting_end) = proposal.voting_end {
            let execution_time = voting_end + Duration::hours(proposal.execution_delay as i64);
            if Utc::now() < execution_time {
                return Err(GovernanceError::InvalidProposal);
            }
        }

        // Execute based on proposal type
        match proposal.proposal_type.as_str() {
            "parameter_change" => self.execute_parameter_change(&proposal).await?,
            "treasury_spend" => self.execute_treasury_spend(&proposal).await?,
            "feature_request" => self.execute_feature_request(&proposal).await?,
            "emergency" => self.execute_emergency_proposal(&proposal).await?,
            _ => return Err(GovernanceError::InvalidProposal),
        }

        // Mark proposal as executed
        sqlx::query!(
            "UPDATE governance_proposals SET status = 'executed' WHERE id = $1",
            proposal_id
        )
        .execute(&self.db)
        .await?;

        // Log execution
        self.security_service.log_security_event(
            Some(executor_id),
            "governance_proposal_executed".to_string(),
            None,
            None,
            Some(serde_json::json!({
                "proposal_id": proposal_id,
                "proposal_type": proposal.proposal_type,
                "executor_id": executor_id
            })),
        ).await;

        Ok(())
    }

    /// Get user's voting power (tokens + delegated tokens)
    pub async fn get_user_voting_power(&self, user_id: Uuid) -> Result<rust_decimal::Decimal, GovernanceError> {
        let result = sqlx::query!(
            r#"
            SELECT 
                COALESCE(gt.balance + gt.staked_amount, 0) as own_tokens,
                COALESCE(SUM(gd.token_amount), 0) as delegated_tokens
            FROM governance_tokens gt
            LEFT JOIN governance_delegations gd ON gd.delegate_id = $1 
                AND (gd.active_until IS NULL OR gd.active_until > NOW())
            WHERE gt.user_id = $1 AND gt.token_type = 'governance'
            GROUP BY gt.balance, gt.staked_amount
            "#,
            user_id
        )
        .fetch_optional(&self.db)
        .await?;

        if let Some(row) = result {
            let own_tokens = row.own_tokens.unwrap_or(rust_decimal::Decimal::ZERO);
            let delegated_tokens = row.delegated_tokens.unwrap_or(rust_decimal::Decimal::ZERO);
            Ok(own_tokens + delegated_tokens)
        } else {
            Ok(rust_decimal::Decimal::ZERO)
        }
    }

    /// Delegate voting power to another user
    pub async fn delegate_voting_power(
        &self,
        delegator_id: Uuid,
        delegate_id: Uuid,
        token_amount: rust_decimal::Decimal,
        duration_days: Option<i32>,
    ) -> Result<(), GovernanceError> {
        // Check if delegator has sufficient tokens
        let available_tokens = self.get_user_voting_power(delegator_id).await?;
        if available_tokens < token_amount {
            return Err(GovernanceError::InsufficientTokens);
        }

        let active_until = duration_days.map(|days| {
            Utc::now() + Duration::days(days as i64)
        });

        sqlx::query!(
            r#"
            INSERT INTO governance_delegations (delegator_id, delegate_id, token_amount, active_until)
            VALUES ($1, $2, $3, $4)
            "#,
            delegator_id,
            delegate_id,
            token_amount,
            active_until
        )
        .execute(&self.db)
        .await?;

        // Log delegation
        self.security_service.log_security_event(
            Some(delegator_id),
            "voting_power_delegated".to_string(),
            None,
            None,
            Some(serde_json::json!({
                "delegate_id": delegate_id,
                "token_amount": token_amount,
                "active_until": active_until
            })),
        ).await;

        Ok(())
    }

    /// Get proposal by ID
    pub async fn get_proposal(&self, proposal_id: Uuid) -> Result<Proposal, GovernanceError> {
        let proposal = sqlx::query_as!(
            Proposal,
            "SELECT * FROM governance_proposals WHERE id = $1",
            proposal_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or(GovernanceError::ProposalNotFound)?;

        Ok(proposal)
    }

    /// List active proposals
    pub async fn list_active_proposals(&self) -> Result<Vec<Proposal>, GovernanceError> {
        let proposals = sqlx::query_as!(
            Proposal,
            r#"
            SELECT * FROM governance_proposals 
            WHERE status IN ('draft', 'active', 'passed')
            ORDER BY created_at DESC
            "#
        )
        .fetch_all(&self.db)
        .await?;

        Ok(proposals)
    }

    /// Update proposal status based on voting results
    pub async fn update_proposal_status(&self, proposal_id: Uuid) -> Result<(), GovernanceError> {
        let proposal = self.get_proposal(proposal_id).await?;
        let results = self.get_proposal_results(proposal_id).await?;

        let new_status = if proposal.voting_end.map_or(false, |end| Utc::now() > end) {
            if results.passed {
                "passed"
            } else {
                "rejected"
            }
        } else if proposal.voting_start.map_or(false, |start| Utc::now() >= start) {
            "active"
        } else {
            "draft"
        };

        if new_status != proposal.status {
            sqlx::query!(
                "UPDATE governance_proposals SET status = $1 WHERE id = $2",
                new_status,
                proposal_id
            )
            .execute(&self.db)
            .await?;

            // Log status update
            self.security_service.log_security_event(
                None,
                "governance_proposal_status_updated".to_string(),
                None,
                None,
                Some(serde_json::json!({
                    "proposal_id": proposal_id,
                    "old_status": proposal.status,
                    "new_status": new_status,
                    "results": results
                })),
            ).await;
        }

        Ok(())
    }

    // Execution methods for different proposal types
    async fn execute_parameter_change(&self, proposal: &Proposal) -> Result<(), GovernanceError> {
        // Implementation for parameter changes (system settings, thresholds, etc.)
        Ok(())
    }

    async fn execute_treasury_spend(&self, proposal: &Proposal) -> Result<(), GovernanceError> {
        // Implementation for treasury spending through multisig
        Ok(())
    }

    async fn execute_feature_request(&self, proposal: &Proposal) -> Result<(), GovernanceError> {
        // Implementation for feature activation/deactivation
        Ok(())
    }

    async fn execute_emergency_proposal(&self, proposal: &Proposal) -> Result<(), GovernanceError> {
        // Implementation for emergency actions
        Ok(())
    }

    fn calculate_proposal_hash(&self, data: &serde_json::Value) -> String {
        use sha2::{Digest, Sha256};
        let data_str = serde_json::to_string(data).unwrap_or_default();
        let mut hasher = Sha256::new();
        hasher.update(data_str.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}
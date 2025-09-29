use crate::services::SecurityService;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashSet;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct RbacService {
    db: PgPool,
    security_service: SecurityService,
}

#[derive(Debug)]
pub enum RbacError {
    DatabaseError(sqlx::Error),
    RoleNotFound,
    PermissionNotFound,
    UserNotFound,
    Unauthorized,
    InvalidRole,
    CircularDependency,
    SystemRoleModification,
}

impl std::fmt::Display for RbacError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RbacError::DatabaseError(e) => write!(f, "Database error: {}", e),
            RbacError::RoleNotFound => write!(f, "Role not found"),
            RbacError::PermissionNotFound => write!(f, "Permission not found"),
            RbacError::UserNotFound => write!(f, "User not found"),
            RbacError::Unauthorized => write!(f, "Unauthorized action"),
            RbacError::InvalidRole => write!(f, "Invalid role configuration"),
            RbacError::CircularDependency => write!(f, "Circular dependency detected"),
            RbacError::SystemRoleModification => write!(f, "Cannot modify system roles"),
        }
    }
}

impl std::error::Error for RbacError {}

impl From<sqlx::Error> for RbacError {
    fn from(err: sqlx::Error) -> Self {
        RbacError::DatabaseError(err)
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Role {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub level: i32,
    pub is_system_role: bool,
    pub permissions: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Permission {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub resource: String,
    pub action: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserRole {
    pub id: Uuid,
    pub user_id: Uuid,
    pub role_id: Uuid,
    pub granted_by: Uuid,
    pub granted_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateRoleRequest {
    pub name: String,
    pub description: Option<String>,
    pub level: i32,
    pub permissions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssignRoleRequest {
    pub user_id: Uuid,
    pub role_id: Uuid,
    pub expires_in_days: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PermissionCheck {
    pub resource: String,
    pub action: String,
}

impl RbacService {
    pub fn new(db: PgPool, security_service: SecurityService) -> Self {
        Self {
            db,
            security_service,
        }
    }

    /// Create a new role
    pub async fn create_role(
        &self,
        creator_id: Uuid,
        request: CreateRoleRequest,
    ) -> Result<Role, RbacError> {
        // Verify creator has permission to create roles
        if !self.check_permission(creator_id, "roles", "create").await? {
            return Err(RbacError::Unauthorized);
        }

        // Validate permissions exist
        for permission_name in &request.permissions {
            if !self.permission_exists(permission_name).await? {
                return Err(RbacError::PermissionNotFound);
            }
        }

        let role_id = Uuid::new_v4();
        let permissions_json = serde_json::to_value(&request.permissions)
            .map_err(|_| RbacError::InvalidRole)?;

        let role = sqlx::query_as!(
            Role,
            r#"
            INSERT INTO roles (id, name, description, level, permissions)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, name, description, level, is_system_role, 
                     permissions as "permissions: serde_json::Value", created_at, updated_at
            "#,
            role_id,
            request.name,
            request.description,
            request.level,
            permissions_json
        )
        .fetch_one(&self.db)
        .await?;

        // Convert permissions back to Vec<String>
        let permissions: Vec<String> = serde_json::from_value(role.permissions.clone())
            .unwrap_or_default();

        let role_result = Role {
            id: role.id,
            name: role.name,
            description: role.description,
            level: role.level,
            is_system_role: role.is_system_role,
            permissions,
            created_at: role.created_at,
            updated_at: role.updated_at,
        };

        // Log role creation
        self.security_service.log_security_event(
            Some(creator_id),
            "role_created".to_string(),
            None,
            None,
            Some(serde_json::json!({
                "role_id": role_id,
                "role_name": request.name,
                "level": request.level,
                "permissions_count": request.permissions.len()
            })),
        ).await;

        Ok(role_result)
    }

    /// Assign role to user
    pub async fn assign_role(
        &self,
        assigner_id: Uuid,
        request: AssignRoleRequest,
    ) -> Result<UserRole, RbacError> {
        // Verify assigner has permission
        if !self.check_permission(assigner_id, "users", "manage_roles").await? {
            return Err(RbacError::Unauthorized);
        }

        // Verify role exists
        let role = self.get_role(request.role_id).await?;

        // Check if assigner has sufficient level to assign this role
        let assigner_max_level = self.get_user_max_role_level(assigner_id).await?;
        if role.level >= assigner_max_level {
            return Err(RbacError::Unauthorized);
        }

        // Check if user already has this role
        let existing = sqlx::query!(
            "SELECT id FROM user_roles WHERE user_id = $1 AND role_id = $2 AND is_active = true",
            request.user_id,
            request.role_id
        )
        .fetch_optional(&self.db)
        .await?;

        if existing.is_some() {
            return Err(RbacError::InvalidRole);
        }

        let expires_at = request.expires_in_days.map(|days| {
            Utc::now() + Duration::days(days as i64)
        });

        let user_role = sqlx::query_as!(
            UserRole,
            r#"
            INSERT INTO user_roles (user_id, role_id, granted_by, expires_at)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
            request.user_id,
            request.role_id,
            assigner_id,
            expires_at
        )
        .fetch_one(&self.db)
        .await?;

        // Log role assignment
        self.security_service.log_security_event(
            Some(assigner_id),
            "role_assigned".to_string(),
            None,
            None,
            Some(serde_json::json!({
                "user_id": request.user_id,
                "role_id": request.role_id,
                "role_name": role.name,
                "expires_at": expires_at
            })),
        ).await;

        Ok(user_role)
    }

    /// Revoke role from user
    pub async fn revoke_role(
        &self,
        revoker_id: Uuid,
        user_id: Uuid,
        role_id: Uuid,
    ) -> Result<(), RbacError> {
        // Verify revoker has permission
        if !self.check_permission(revoker_id, "users", "manage_roles").await? {
            return Err(RbacError::Unauthorized);
        }

        // Get role details for logging
        let role = self.get_role(role_id).await?;

        // Check if revoker has sufficient level
        let revoker_max_level = self.get_user_max_role_level(revoker_id).await?;
        if role.level >= revoker_max_level {
            return Err(RbacError::Unauthorized);
        }

        sqlx::query!(
            "UPDATE user_roles SET is_active = false WHERE user_id = $1 AND role_id = $2",
            user_id,
            role_id
        )
        .execute(&self.db)
        .await?;

        // Log role revocation
        self.security_service.log_security_event(
            Some(revoker_id),
            "role_revoked".to_string(),
            None,
            None,
            Some(serde_json::json!({
                "user_id": user_id,
                "role_id": role_id,
                "role_name": role.name
            })),
        ).await;

        Ok(())
    }

    /// Check if user has specific permission
    pub async fn check_permission(
        &self,
        user_id: Uuid,
        resource: &str,
        action: &str,
    ) -> Result<bool, RbacError> {
        let user_permissions = self.get_user_permissions(user_id).await?;
        
        // Check for wildcard permissions
        if user_permissions.contains("*") {
            return Ok(true);
        }

        // Check for resource wildcard
        let resource_wildcard = format!("{}:*", resource);
        if user_permissions.contains(&resource_wildcard) {
            return Ok(true);
        }

        // Check for specific permission
        let specific_permission = format!("{}:{}", resource, action);
        Ok(user_permissions.contains(&specific_permission))
    }

    /// Get all permissions for a user
    pub async fn get_user_permissions(&self, user_id: Uuid) -> Result<HashSet<String>, RbacError> {
        let roles = sqlx::query!(
            r#"
            SELECT r.permissions
            FROM roles r
            JOIN user_roles ur ON r.id = ur.role_id
            WHERE ur.user_id = $1 
              AND ur.is_active = true
              AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
            "#,
            user_id
        )
        .fetch_all(&self.db)
        .await?;

        let mut all_permissions = HashSet::new();

        for role in roles {
            if let Ok(permissions) = serde_json::from_value::<Vec<String>>(role.permissions) {
                for permission in permissions {
                    all_permissions.insert(permission);
                }
            }
        }

        Ok(all_permissions)
    }

    /// Get user's roles
    pub async fn get_user_roles(&self, user_id: Uuid) -> Result<Vec<Role>, RbacError> {
        let roles = sqlx::query!(
            r#"
            SELECT r.id, r.name, r.description, r.level, r.is_system_role, 
                   r.permissions, r.created_at, r.updated_at,
                   ur.granted_at, ur.expires_at
            FROM roles r
            JOIN user_roles ur ON r.id = ur.role_id
            WHERE ur.user_id = $1 
              AND ur.is_active = true
              AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
            ORDER BY r.level DESC
            "#,
            user_id
        )
        .fetch_all(&self.db)
        .await?;

        let mut result = Vec::new();
        for role_row in roles {
            let permissions: Vec<String> = serde_json::from_value(role_row.permissions)
                .unwrap_or_default();

            result.push(Role {
                id: role_row.id,
                name: role_row.name,
                description: role_row.description,
                level: role_row.level,
                is_system_role: role_row.is_system_role,
                permissions,
                created_at: role_row.created_at,
                updated_at: role_row.updated_at,
            });
        }

        Ok(result)
    }

    /// Get role by ID
    pub async fn get_role(&self, role_id: Uuid) -> Result<Role, RbacError> {
        let role = sqlx::query!(
            r#"
            SELECT id, name, description, level, is_system_role, 
                   permissions, created_at, updated_at
            FROM roles WHERE id = $1
            "#,
            role_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or(RbacError::RoleNotFound)?;

        let permissions: Vec<String> = serde_json::from_value(role.permissions)
            .unwrap_or_default();

        Ok(Role {
            id: role.id,
            name: role.name,
            description: role.description,
            level: role.level,
            is_system_role: role.is_system_role,
            permissions,
            created_at: role.created_at,
            updated_at: role.updated_at,
        })
    }

    /// Get all available permissions
    pub async fn get_all_permissions(&self) -> Result<Vec<Permission>, RbacError> {
        let permissions = sqlx::query_as!(
            Permission,
            "SELECT * FROM permissions ORDER BY resource, action"
        )
        .fetch_all(&self.db)
        .await?;

        Ok(permissions)
    }

    /// Check if user has higher or equal role level than target
    pub async fn has_sufficient_level(
        &self,
        user_id: Uuid,
        target_level: i32,
    ) -> Result<bool, RbacError> {
        let user_max_level = self.get_user_max_role_level(user_id).await?;
        Ok(user_max_level >= target_level)
    }

    /// Get user's maximum role level
    async fn get_user_max_role_level(&self, user_id: Uuid) -> Result<i32, RbacError> {
        let result = sqlx::query!(
            r#"
            SELECT COALESCE(MAX(r.level), 0) as max_level
            FROM roles r
            JOIN user_roles ur ON r.id = ur.role_id
            WHERE ur.user_id = $1 
              AND ur.is_active = true
              AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
            "#,
            user_id
        )
        .fetch_one(&self.db)
        .await?;

        Ok(result.max_level.unwrap_or(0))
    }

    /// Check if permission exists
    async fn permission_exists(&self, permission_name: &str) -> Result<bool, RbacError> {
        let count = sqlx::query!(
            "SELECT COUNT(*) as count FROM permissions WHERE name = $1",
            permission_name
        )
        .fetch_one(&self.db)
        .await?;

        Ok(count.count.unwrap_or(0) > 0)
    }

    /// Clean up expired role assignments
    pub async fn cleanup_expired_roles(&self) -> Result<i64, RbacError> {
        let result = sqlx::query!(
            r#"
            UPDATE user_roles 
            SET is_active = false 
            WHERE expires_at IS NOT NULL AND expires_at < NOW() AND is_active = true
            "#
        )
        .execute(&self.db)
        .await?;

        let expired_count = result.rows_affected() as i64;

        if expired_count > 0 {
            // Log cleanup
            self.security_service.log_security_event(
                None,
                "role_assignments_expired".to_string(),
                None,
                None,
                Some(serde_json::json!({
                    "expired_count": expired_count
                })),
            ).await;
        }

        Ok(expired_count)
    }

    /// List all roles
    pub async fn list_roles(&self, requester_id: Uuid) -> Result<Vec<Role>, RbacError> {
        // Check permission to view roles
        if !self.check_permission(requester_id, "roles", "read").await? {
            return Err(RbacError::Unauthorized);
        }

        let roles = sqlx::query!(
            r#"
            SELECT id, name, description, level, is_system_role, 
                   permissions, created_at, updated_at
            FROM roles ORDER BY level DESC, name
            "#
        )
        .fetch_all(&self.db)
        .await?;

        let mut result = Vec::new();
        for role_row in roles {
            let permissions: Vec<String> = serde_json::from_value(role_row.permissions)
                .unwrap_or_default();

            result.push(Role {
                id: role_row.id,
                name: role_row.name,
                description: role_row.description,
                level: role_row.level,
                is_system_role: role_row.is_system_role,
                permissions,
                created_at: role_row.created_at,
                updated_at: role_row.updated_at,
            });
        }

        Ok(result)
    }
}
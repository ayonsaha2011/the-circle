use crate::config::Config;
use crate::services::{AuthService, SecurityService};
use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Config,
    pub auth_service: AuthService,
    pub security_service: SecurityService,
}

impl AppState {
    pub fn new(
        db: PgPool,
        config: Config,
        auth_service: AuthService,
        security_service: SecurityService,
    ) -> Self {
        Self {
            db,
            config,
            auth_service,
            security_service,
        }
    }
}
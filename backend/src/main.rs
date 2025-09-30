mod config;
mod handlers;
mod models;
mod services;
mod utils;

use crate::config::Config;
use crate::handlers::{auth, health};
use crate::services::{AuthService, SecurityService};
use crate::utils::AppState;
use axum::{
    extract::ConnectInfo,
    http::{HeaderValue, Method},
    routing::{get, post},
    Router,
};
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use tower::ServiceBuilder;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = Config::from_env().expect("Failed to load configuration");

    // Setup database connection
    let db = PgPoolOptions::new()
        .max_connections(20)
        .connect(&config.database_url)
        .await
        .expect("Failed to connect to database");

    // Run migrations (commented out since we manually ran them)
    // sqlx::migrate!("./migrations")
    //     .run(&db)
    //     .await
    //     .expect("Failed to run migrations");

    // Initialize services
    let security_service = SecurityService::new(db.clone());
    let auth_service = AuthService::new(
        db.clone(),
        config.jwt_secret.clone(),
        config.jwt_expiration,
        security_service.clone(),
    );

    // Create application state
    let app_state = AppState::new(db, config.clone(), auth_service, security_service);

    // Setup CORS
    let cors = CorsLayer::new()
        .allow_origin("http://localhost:3000".parse::<HeaderValue>().unwrap())
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers(Any);

    // Build application router
    let app = Router::new()
        // Health checks
        .route("/health", get(health::health_check))
        .route("/ready", get(health::readiness_check))
        // Authentication routes
        .route("/api/auth/register", post(auth::register))
        .route("/api/auth/login/initiate", post(auth::login_initiate))
        .route("/api/auth/login/complete", post(auth::login_complete))
        .route("/api/auth/logout", post(auth::logout))
        .route("/api/auth/refresh", post(auth::refresh_token))
        // Add state and middleware
        .with_state(app_state)
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(cors)
                .into_inner(),
        );

    // Start server
    let addr = SocketAddr::from(([127, 0, 0, 1], config.port));
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    
    tracing::info!("🚀 The Circle backend server starting on http://{}", addr);
    tracing::info!("📖 API documentation available at http://{}/health", addr);
    
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}
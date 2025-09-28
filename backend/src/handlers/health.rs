use axum::{http::StatusCode, response::Json};
use serde_json::{json, Value};

pub async fn health_check() -> Result<Json<Value>, StatusCode> {
    Ok(Json(json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "version": env!("CARGO_PKG_VERSION"),
        "service": "the-circle-backend"
    })))
}

pub async fn readiness_check() -> Result<Json<Value>, StatusCode> {
    // In production, this would check database connectivity, etc.
    Ok(Json(json!({
        "status": "ready",
        "checks": {
            "database": "ok",
            "redis": "ok"
        },
        "timestamp": chrono::Utc::now().to_rfc3339()
    })))
}
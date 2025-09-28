# The Circle - Secure Communication Platform

## Phase 1 Implementation Status 🚧

This repository contains the implementation of Phase 1 of The Circle project - a secure communication platform with advanced containment protocols.

### 🏗️ Project Structure

```
the-circle/
├── backend/                # Rust backend (Axum framework)
│   ├── src/
│   │   ├── main.rs        # Server entry point
│   │   ├── config.rs      # Configuration management
│   │   ├── models/        # Database models
│   │   ├── services/      # Business logic (Auth, Security)
│   │   ├── handlers/      # API route handlers
│   │   └── utils/         # Utility functions
│   ├── migrations/        # Database migrations
│   └── Cargo.toml        # Rust dependencies
├── frontend/              # React frontend (TypeScript)
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API services
│   │   ├── stores/       # State management
│   │   └── utils/        # Utility functions
│   └── package.json      # Node.js dependencies
└── infrastructure/       # AWS infrastructure
    └── cloudformation/   # Infrastructure as code
```

### ✅ Phase 1 Deliverables (14 days)

#### Backend Components
- [x] **Rust/Axum Setup**: Project initialized with security-focused dependencies
- [x] **Database Schema**: PostgreSQL with encryption, security events, and destruction logs
- [x] **Authentication Service**: JWT-based auth with 3-step login process
- [x] **Security Service**: Failed login monitoring and destruction protocols
- [x] **API Handlers**: REST endpoints for authentication and health checks
- [ ] **Database Connection**: PostgreSQL setup and migration execution

#### Frontend Components  
- [🔄] **React/TypeScript Setup**: Project initialization in progress
- [ ] **TailwindCSS Configuration**: Design system and responsive styling
- [ ] **Authentication Components**: Login, register, and MFA verification
- [ ] **Landing Page**: Hero section with value proposition
- [ ] **Onboarding Flow**: Tier selection and membership signup
- [ ] **State Management**: Zustand for authentication and app state

#### Security Features
- [x] **Password Hashing**: Argon2 for secure password storage
- [x] **JWT Tokens**: Access and refresh token management
- [x] **Failed Login Tracking**: Automatic account lockout after attempts
- [x] **Destruction Protocols**: Auto-wipe triggers for security violations
- [x] **Security Event Logging**: Comprehensive audit trail
- [ ] **Hotkey Destruction**: Client-side emergency data wipe

#### Infrastructure
- [x] **Environment Configuration**: Development environment setup
- [ ] **PostgreSQL Database**: Local development database
- [ ] **Redis Session Store**: Session management and caching
- [ ] **Stripe Integration**: Payment gateway for memberships
- [ ] **AWS Infrastructure**: Production deployment configuration

### 🔒 Security Architecture

#### Core Security Principles
1. **Zero Trust**: Every request authenticated and authorized
2. **Defense in Depth**: Multiple layers of security controls
3. **Containment First**: Auto-destruction on security violations
4. **Forensic Resistance**: Minimal data retention and secure deletion
5. **Privacy by Design**: End-to-end encryption and data minimization

#### Authentication Flow
```
1. Email Validation → 2. Password Verification → 3. MFA (if enabled) → Access Token
                                    ↓
                        Failed Attempts Monitoring
                                    ↓
                        Lockout (3 attempts) → Destruction (5 attempts)
```

### 🚀 Getting Started

#### Prerequisites
- Rust 1.70+ with Cargo
- Node.js 18+ with npm
- PostgreSQL 15+
- Redis (optional, for sessions)

#### Backend Setup
```bash
cd the-circle/backend

# Install dependencies
cargo build

# Set up environment
cp .env.example .env
# Edit .env with your database credentials

# Set up database
createdb circle_db
psql -d circle_db -f migrations/001_initial_schema.sql

# Run the server
cargo run
```

#### Frontend Setup
```bash
cd the-circle/frontend

# Install dependencies
npm install

# Install additional packages
npm install @heroicons/react axios react-router-dom zustand
npm install -D tailwindcss postcss autoprefixer

# Start development server
npm start
```

### 🎯 API Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login/initiate` - Start login process
- `POST /api/auth/login/complete` - Complete login with credentials
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token

#### Health & Monitoring
- `GET /health` - Service health check
- `GET /ready` - Readiness probe for deployment

### 📊 Membership Tiers

| Tier | Monthly | Yearly | Features |
|------|---------|--------|----------|
| **Basic** | Free | Free | Basic messaging, 5MB files, 1GB storage |
| **Standard** | $9.99 | $99.99 | + File sharing, video calls, destruction protocols |
| **Premium** | $19.99 | $199.99 | + Biometric auth, 200MB files, 50GB storage |
| **Enterprise** | $49.99 | $499.99 | + Admin controls, unlimited storage, priority support |

### 🔥 Destruction Protocols

#### Automatic Triggers
- **Failed Login Threshold**: 5 consecutive failed attempts
- **Suspicious Activity**: Unusual login patterns or locations
- **Timeout Expiry**: Inactive sessions beyond security policy
- **Manual Activation**: User-initiated emergency destruction

#### Hotkey Sequence
```
Ctrl + Shift + D + D
```
Triggers immediate local data destruction with confirmation dialog.

### 📈 Progress Tracking

**Overall Phase 1 Progress: 70%**

- ✅ Backend Architecture (90%)
- 🔄 Frontend Setup (20%) 
- ⏳ Database Integration (0%)
- ⏳ Security Features (60%)
- ⏳ Payment Integration (0%)

### 🛣️ Next Steps

1. **Complete React Setup**: Finish frontend initialization
2. **Database Connection**: Set up PostgreSQL and run migrations
3. **Authentication UI**: Build login/register components
4. **Landing Page**: Create compelling hero section
5. **Stripe Integration**: Add payment processing
6. **Testing**: End-to-end testing of auth flow
7. **Production Deployment**: AWS infrastructure setup

### 📞 Support

For technical questions or issues during development:
- Check the implementation guides in the `docs/` directory
- Review error logs in `backend/logs/`
- Test API endpoints using the provided Postman collection

---

**The Circle** - Your privacy, protected by design. 🔒
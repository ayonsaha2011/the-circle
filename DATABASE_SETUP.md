# Database Setup Instructions

## PostgreSQL Setup for The Circle

### 1. Install PostgreSQL

#### macOS (using Homebrew)
```bash
brew install postgresql
brew services start postgresql
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Create Database and User

```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# Or on macOS
psql postgres
```

Execute the following SQL commands:

```sql
-- Create database
CREATE DATABASE circle_db;

-- Create user
CREATE USER circle_user WITH PASSWORD 'secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE circle_db TO circle_user;
GRANT ALL ON SCHEMA public TO circle_user;

-- Exit PostgreSQL
\q
```

### 3. Run Database Migrations

```bash
# Navigate to backend directory
cd /Users/ayonsaha/Workspace/Fiverr/rafauk123/the-circle/backend

# Connect to the database and run migration
psql -U circle_user -d circle_db -f migrations/001_initial_schema.sql
```

### 4. Verify Database Setup

```bash
# Connect to verify
psql -U circle_user -d circle_db

# Check tables
\dt

# Check membership tiers
SELECT * FROM memberships;

# Exit
\q
```

### 5. Update Environment Variables

Make sure your `.env` file in the backend directory has the correct database URL:

```env
DATABASE_URL=postgresql://circle_user:secure_password@localhost:5432/circle_db
```

### 6. Test Backend Connection

```bash
cd /Users/ayonsaha/Workspace/Fiverr/rafauk123/the-circle/backend

# Try to compile (this will test database connection during macro expansion)
cargo build

# If successful, run the server
cargo run
```

## Troubleshooting

### Common Issues

1. **Permission denied for schema public**
   ```sql
   GRANT ALL ON SCHEMA public TO circle_user;
   GRANT ALL ON ALL TABLES IN SCHEMA public TO circle_user;
   ```

2. **Role "circle_user" does not exist**
   - Make sure you created the user as shown in step 2
   - Check with: `\du` in psql

3. **Database connection refused**
   - Ensure PostgreSQL is running: `brew services list | grep postgresql`
   - Check the port (default 5432): `lsof -i :5432`

4. **SQLx compilation errors**
   - Make sure the database exists and is accessible
   - Run migrations before compiling
   - Check environment variables

### Security Notes

- Change the default password in production
- Use environment variables for sensitive data
- Enable SSL/TLS for production deployments
- Consider using connection pooling for high-load scenarios

## Production Considerations

For production deployment:

1. Use a managed PostgreSQL service (AWS RDS, Google Cloud SQL, etc.)
2. Enable connection SSL
3. Use secrets management for credentials
4. Set up automated backups
5. Monitor database performance
6. Configure connection pooling
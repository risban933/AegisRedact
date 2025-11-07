# AegisRedact Backend API

Backend authentication and cloud storage service for AegisRedact.

## Features

- **User Authentication**: JWT-based authentication with refresh tokens
- **Encrypted File Storage**: Client-side encrypted file storage
- **Zero-Knowledge Architecture**: Server never sees unencrypted data
- **Storage Quotas**: Per-user storage limits
- **Rate Limiting**: Protection against abuse
- **PostgreSQL Database**: Reliable data storage

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 15+
- (Optional) Docker and Docker Compose

## Quick Start

### Option 1: Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env and fill in required values
   ```

3. **Start PostgreSQL:**
   ```bash
   # Using Docker:
   docker run -d \
     --name postgres \
     -e POSTGRES_DB=aegis_redact \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=postgres \
     -p 5432:5432 \
     postgres:15-alpine

   # Or use your local PostgreSQL installation
   ```

4. **Run database migrations:**
   ```bash
   npm run db:migrate
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`

### Option 2: Docker Compose

1. **Create `.env` file:**
   ```bash
   cp .env.example .env
   # Generate secrets:
   JWT_ACCESS_SECRET=$(openssl rand -base64 32)
   JWT_REFRESH_SECRET=$(openssl rand -base64 32)
   ```

2. **Start all services:**
   ```bash
   docker-compose up -d
   ```

3. **Run migrations:**
   ```bash
   docker-compose exec api npm run db:migrate
   ```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout (revoke refresh token)
- `GET /api/auth/profile` - Get user profile (authenticated)
- `DELETE /api/auth/account` - Delete account (authenticated)

### File Storage

- `GET /api/files` - List user's files (authenticated)
- `POST /api/files/upload/request` - Request upload URL (authenticated)
- `POST /api/files/:id/upload` - Upload file data (authenticated)
- `GET /api/files/:id` - Get file metadata and download URL (authenticated)
- `DELETE /api/files/:id` - Delete file (authenticated)
- `GET /api/files/storage/quota` - Get storage quota info (authenticated)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | `development` |
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_ACCESS_SECRET` | Secret for access tokens (32+ chars) | Required |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens (32+ chars) | Required |
| `JWT_ACCESS_EXPIRES_IN` | Access token expiration | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiration | `30d` |
| `BCRYPT_SALT_ROUNDS` | Bcrypt cost factor | `12` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:5173` |
| `STORAGE_PROVIDER` | Storage backend (local/s3) | `local` |
| `UPLOAD_DIR` | Local upload directory | `./uploads` |
| `DEFAULT_STORAGE_QUOTA_BYTES` | Default user storage quota | `104857600` (100MB) |

## Security

### Password Requirements

- Minimum 12 characters
- Hashed with bcrypt (cost factor 12)
- Never logged or exposed in responses

### Rate Limiting

- General API: 100 requests per 15 minutes
- Login attempts: 5 attempts per 15 minutes
- Registration: 3 attempts per hour
- File uploads: 20 per hour

### Token Security

- Access tokens: 15-minute expiration
- Refresh tokens: 30-day expiration
- Refresh tokens stored hashed in database
- Automatic token rotation on refresh

### Encryption

- All files encrypted client-side with AES-256-GCM
- Server never has access to encryption keys
- PBKDF2 key derivation (100,000 iterations)

## Database Schema

```sql
users
  - id (UUID, primary key)
  - email (VARCHAR, unique)
  - password_hash (TEXT)
  - salt (VARCHAR) -- for client-side key derivation
  - storage_quota_bytes (BIGINT)
  - storage_used_bytes (BIGINT)
  - created_at, updated_at

refresh_tokens
  - id (UUID, primary key)
  - user_id (UUID, foreign key)
  - token_hash (TEXT)
  - expires_at (TIMESTAMP)
  - revoked (BOOLEAN)

files
  - id (UUID, primary key)
  - user_id (UUID, foreign key)
  - filename (TEXT)
  - file_size_bytes (BIGINT)
  - storage_key (TEXT)
  - encryption_metadata (JSONB)
  - mime_type (VARCHAR)
  - created_at, last_accessed_at
```

## Production Deployment

### Recommended Setup

1. **Use HTTPS only** (Let's Encrypt, Cloudflare)
2. **Set strong JWT secrets** (32+ random characters)
3. **Configure CORS** for your frontend domain
4. **Use managed PostgreSQL** (AWS RDS, DigitalOcean, etc.)
5. **Set up S3/R2 storage** for scalability
6. **Enable monitoring** (Sentry, DataDog, etc.)
7. **Set up automated backups** for database

### Environment Checklist

- [ ] `NODE_ENV=production`
- [ ] Strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
- [ ] Correct `FRONTEND_URL` for CORS
- [ ] Secure `DATABASE_URL` with SSL
- [ ] Configure S3 if using cloud storage
- [ ] Set appropriate `DEFAULT_STORAGE_QUOTA_BYTES`

## Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### Logs

In development, the server logs all queries and requests. In production, logs are minimal for performance.

## Troubleshooting

### Database Connection Errors

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution**: Ensure PostgreSQL is running and `DATABASE_URL` is correct.

### JWT Secret Errors

```
❌ Invalid environment variables: JWT_ACCESS_SECRET must be at least 32 characters
```

**Solution**: Generate proper secrets:
```bash
openssl rand -base64 32
```

### CORS Errors

```
Access to fetch at 'http://localhost:3000' from origin 'http://localhost:5173' has been blocked by CORS
```

**Solution**: Set correct `FRONTEND_URL` in `.env`

## License

MIT - Same as main AegisRedact project

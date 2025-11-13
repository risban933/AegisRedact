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

## S3 Storage Setup

AegisRedact supports both local file storage and cloud storage via Amazon S3 (or S3-compatible services).

### Why Use S3?

- **Scalability**: Handle unlimited file storage without local disk constraints
- **Reliability**: Built-in redundancy and durability (99.999999999% durability)
- **Performance**: Global CDN integration and parallel uploads
- **Cost-effective**: Pay only for what you use

### Supported S3 Providers

- **Amazon S3** (AWS)
- **Cloudflare R2** (zero egress fees)
- **DigitalOcean Spaces**
- **Backblaze B2**
- **MinIO** (self-hosted S3-compatible storage)
- Any S3-compatible object storage service

### Configuration Examples

#### Amazon S3

1. **Create S3 bucket:**
   ```bash
   aws s3 mb s3://aegis-redact-files --region us-east-1
   ```

2. **Create IAM user with S3 permissions:**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::aegis-redact-files",
           "arn:aws:s3:::aegis-redact-files/*"
         ]
       }
     ]
   }
   ```

3. **Configure environment variables:**
   ```bash
   STORAGE_PROVIDER=s3
   S3_BUCKET=aegis-redact-files
   S3_REGION=us-east-1
   S3_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
   S3_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   ```

#### Cloudflare R2

1. **Create R2 bucket** in Cloudflare dashboard

2. **Generate API token** with R2 read/write permissions

3. **Configure environment variables:**
   ```bash
   STORAGE_PROVIDER=s3
   S3_BUCKET=aegis-redact-files
   S3_REGION=auto  # R2 uses 'auto' region
   S3_ACCESS_KEY_ID=<your-r2-access-key>
   S3_SECRET_ACCESS_KEY=<your-r2-secret-key>
   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   ```

#### DigitalOcean Spaces

1. **Create Space** in DigitalOcean control panel

2. **Generate Spaces access keys**

3. **Configure environment variables:**
   ```bash
   STORAGE_PROVIDER=s3
   S3_BUCKET=aegis-redact-files
   S3_REGION=nyc3  # or your preferred region
   S3_ACCESS_KEY_ID=<your-spaces-key>
   S3_SECRET_ACCESS_KEY=<your-spaces-secret>
   S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
   ```

#### MinIO (Self-Hosted)

1. **Start MinIO server:**
   ```bash
   docker run -d \
     -p 9000:9000 \
     -p 9001:9001 \
     --name minio \
     -e MINIO_ROOT_USER=minioadmin \
     -e MINIO_ROOT_PASSWORD=minioadmin \
     minio/minio server /data --console-address ":9001"
   ```

2. **Create bucket** via MinIO console (http://localhost:9001)

3. **Configure environment variables:**
   ```bash
   STORAGE_PROVIDER=s3
   S3_BUCKET=aegis-redact-files
   S3_REGION=us-east-1  # MinIO accepts any region
   S3_ACCESS_KEY_ID=minioadmin
   S3_SECRET_ACCESS_KEY=minioadmin
   S3_ENDPOINT=http://localhost:9000
   ```

### S3 Features Implemented

- ✅ **Presigned URLs**: Secure, temporary upload/download URLs (15 min upload, 1 hour download)
- ✅ **Direct uploads**: Files upload directly to S3, never touching the API server
- ✅ **Metadata tagging**: User ID, file ID, and filename stored as S3 object metadata
- ✅ **Automatic cleanup**: Failed uploads don't consume storage
- ✅ **Idempotent deletes**: Safe to call delete multiple times

### Security Considerations

1. **Bucket Permissions**: Ensure bucket is **not** publicly accessible
2. **CORS Configuration**: Configure bucket CORS for frontend uploads:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedOrigins": ["https://your-frontend-domain.com"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
3. **Lifecycle Policies**: Set up automatic deletion of incomplete uploads (recommended: 1 day)
4. **Encryption**: Enable server-side encryption (SSE-S3 or SSE-KMS)
5. **Access Logging**: Enable S3 access logs for audit trails

### Switching Between Storage Providers

To switch from local to S3 storage:

1. Update `.env` with S3 credentials
2. Restart the server
3. Existing local files remain accessible (not migrated automatically)
4. New uploads will use S3

To migrate existing files:
```bash
# Example AWS CLI sync (adjust for your provider)
aws s3 sync ./uploads s3://aegis-redact-files/ --metadata user-migrated=true
```

### Troubleshooting S3

**Error: "S3 client not initialized"**
- Ensure `STORAGE_PROVIDER=s3` is set
- Verify `S3_BUCKET` and `S3_REGION` are configured

**Error: "Access Denied"**
- Check IAM permissions include `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`
- Verify bucket name is correct

**Error: "SignatureDoesNotMatch"**
- Verify `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` are correct
- Check for trailing whitespace in environment variables

**Slow uploads/downloads:**
- Use S3 Transfer Acceleration (AWS S3 only)
- Choose S3 region closest to your users
- Consider Cloudflare R2 for zero egress fees

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

### Core Configuration

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

### Storage Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `STORAGE_PROVIDER` | Storage backend (`local` or `s3`) | `local` |
| `UPLOAD_DIR` | Local upload directory (local storage only) | `./uploads` |
| `DEFAULT_STORAGE_QUOTA_BYTES` | Default user storage quota | `104857600` (100MB) |

### S3 Storage Configuration (Optional)

Required when `STORAGE_PROVIDER=s3`:

| Variable | Description | Required |
|----------|-------------|----------|
| `S3_BUCKET` | S3 bucket name | Yes |
| `S3_REGION` | AWS region (e.g., `us-east-1`) | Yes |
| `S3_ACCESS_KEY_ID` | AWS access key ID | Optional* |
| `S3_SECRET_ACCESS_KEY` | AWS secret access key | Optional* |
| `S3_ENDPOINT` | Custom S3 endpoint (for S3-compatible services) | No |

\* If not provided, the AWS SDK will use the default credential chain (IAM roles, environment variables, etc.)

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

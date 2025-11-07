# Authentication System Documentation

## Overview

AegisRedact's authentication system provides **optional** cloud storage for redacted files while maintaining the core privacy-first principle: all redaction processing remains 100% client-side.

## Architecture Principles

### 1. **Zero-Knowledge Storage**

The server **never** sees unencrypted file content:

```
User → Encrypt in Browser → Upload Encrypted → Store Encrypted
User ← Decrypt in Browser ← Download Encrypted ← Retrieve Encrypted
```

- Encryption key derived from user password
- Encryption happens entirely in the browser
- Server stores only encrypted blobs
- Decryption requires user's password (not stored on server)

### 2. **Client-Side Encryption**

**Encryption Process:**

1. User registers/logs in with password
2. Browser derives encryption key using PBKDF2:
   - Password + User Salt (from server)
   - 100,000 iterations
   - SHA-256 hash
   - Outputs AES-256 key

3. File encryption:
   - Generate random IV (96 bits)
   - Encrypt file with AES-256-GCM
   - Store IV + encrypted data

4. Upload encrypted blob to server

**Decryption Process:**

1. Download encrypted blob
2. Retrieve encryption metadata (IV, salt)
3. Derive same encryption key from password
4. Decrypt using AES-256-GCM

### 3. **JWT Authentication**

**Access Tokens** (short-lived):
- Expires in 15 minutes
- Stored in memory only
- Used for API requests

**Refresh Tokens** (long-lived):
- Expires in 30 days
- Stored in localStorage (hashed in database)
- Used to obtain new access tokens
- Can be revoked

## Security Features

### Password Security

- Minimum 12 characters required
- Hashed with bcrypt (cost factor 12)
- Never logged or transmitted in plain text
- Password resets use time-limited tokens

### Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Login | 5 attempts per 15 minutes |
| Registration | 3 per hour |
| File uploads | 20 per hour |
| General API | 100 requests per 15 minutes |

### Database Security

- All sensitive data hashed before storage
- Prepared statements (SQL injection prevention)
- Foreign key constraints
- Automatic cleanup of expired tokens

### Transport Security

- HTTPS required in production
- Secure headers (Helmet.js)
- CORS restricted to frontend domain
- CSRF protection

## User Flows

### Registration Flow

```
1. User clicks "Sign In" → Opens AuthModal
2. User switches to "Register" tab
3. User enters email + password (12+ chars)
4. Frontend sends POST /api/auth/register
5. Backend:
   - Validates email/password
   - Checks if email exists
   - Generates random salt for encryption
   - Hashes password with bcrypt
   - Creates user record
   - Returns access token + refresh token
6. Frontend:
   - Stores tokens
   - Derives encryption key from password
   - Keeps encryption key in memory
   - Shows UserMenu
```

### Login Flow

```
1. User enters email + password
2. Frontend sends POST /api/auth/login
3. Backend:
   - Finds user by email
   - Verifies password with bcrypt
   - Generates new access + refresh tokens
   - Returns tokens + user profile
4. Frontend:
   - Stores tokens
   - Derives encryption key
   - Shows UserMenu
```

### File Upload Flow

```
1. User exports redacted PDF
2. Frontend prompts "Save to Cloud?"
3. If user accepts:
   a. Encrypt PDF with user's encryption key (in memory)
   b. Request upload URL: POST /api/files/upload/request
   c. Server checks storage quota
   d. Server creates file record, returns upload endpoint
   e. Upload encrypted blob to endpoint
   f. Server stores blob in local storage/S3
4. File now appears in user's dashboard
```

### File Download Flow

```
1. User opens Dashboard
2. Clicks "Download" on a file
3. Frontend:
   a. GET /api/files/:id (get download URL)
   b. Download encrypted blob
   c. Decrypt using password-derived key
   d. Trigger browser download of decrypted file
```

## Storage Management

### Storage Quotas

- Default: 100MB per user
- Stored in `users.storage_quota_bytes`
- Automatically enforced on upload
- Usage tracked via database triggers

### File Lifecycle

1. **Upload**: File encrypted → uploaded → metadata stored
2. **Access**: Metadata retrieved → download URL generated → file downloaded
3. **Delete**: File deleted from storage → metadata removed → quota updated

### Database Triggers

Automatic storage tracking:

```sql
-- On file insert: increment storage_used_bytes
-- On file delete: decrement storage_used_bytes
```

## API Reference

### Authentication Endpoints

#### Register User

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

Response:
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "salt": "hex-string",
    "storage_quota_bytes": 104857600,
    "storage_used_bytes": 0
  }
}
```

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

#### Refresh Access Token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGci..."
}
```

Response:
```json
{
  "accessToken": "eyJhbGci..."
}
```

#### Logout

```http
POST /api/auth/logout
Content-Type: application/json

{
  "refreshToken": "eyJhbGci..."
}
```

### File Storage Endpoints

#### Request Upload

```http
POST /api/files/upload/request
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "filename": "document-redacted.pdf",
  "fileSize": 1048576,
  "encryptionMetadata": {
    "iv": "base64-string",
    "salt": "base64-string",
    "algorithm": "AES-GCM",
    "keyDerivation": "PBKDF2",
    "iterations": 100000
  },
  "mimeType": "application/pdf"
}
```

Response:
```json
{
  "uploadUrl": "/api/files/uuid/upload",
  "fileId": "uuid",
  "storageKey": "user-id/random-id.encrypted"
}
```

#### Upload File Data

```http
POST /api/files/:id/upload
Authorization: Bearer <access-token>
Content-Type: application/octet-stream

<encrypted binary data>
```

#### Get File

```http
GET /api/files/:id
Authorization: Bearer <access-token>
```

Response:
```json
{
  "id": "uuid",
  "filename": "document-redacted.pdf",
  "file_size_bytes": 1048576,
  "mime_type": "application/pdf",
  "created_at": "2025-01-01T00:00:00.000Z",
  "downloadUrl": "/api/files/download/storage-key",
  "encryptionMetadata": { ... }
}
```

#### Delete File

```http
DELETE /api/files/:id
Authorization: Bearer <access-token>
```

#### Storage Quota

```http
GET /api/files/storage/quota
Authorization: Bearer <access-token>
```

Response:
```json
{
  "used": 1048576,
  "quota": 104857600,
  "percentUsed": 1
}
```

## Privacy Guarantees

### What the Server **CAN** See

- User email address
- Number of files stored
- File sizes (encrypted)
- File creation/access timestamps
- Storage quota usage

### What the Server **CANNOT** See

- File contents (encrypted with user password)
- Original filenames (encrypted)
- What PII was redacted
- User's encryption key or password

### Data Deletion

When user deletes account:
1. All refresh tokens revoked
2. All file records deleted (cascade)
3. All encrypted files removed from storage
4. User record permanently deleted
5. **No recovery possible** (by design)

## Troubleshooting

### "Decryption failed" Error

**Cause**: Password changed or incorrect password

**Solution**: Re-login with correct password. If password was changed, old files cannot be decrypted (zero-knowledge design).

### "Storage quota exceeded" Error

**Cause**: User has reached storage limit

**Solution**: Delete old files or upgrade quota (future feature).

### "Session expired" Error

**Cause**: Refresh token expired or revoked

**Solution**: Login again. Session lasts 30 days.

## Future Enhancements

- **OAuth login** (Google, GitHub)
- **Two-factor authentication**
- **File sharing** (encrypted end-to-end)
- **Team accounts** with shared storage
- **Storage quota upgrades**
- **File versioning**
- **Audit logs**

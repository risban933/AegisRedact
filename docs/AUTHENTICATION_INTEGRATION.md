# Authentication Integration Guide

This document explains how to integrate the authentication system into the main App.

## Integration Steps

### 1. Update Toolbar Component

Modify `src/ui/components/Toolbar.ts` to add login button and user menu:

```typescript
// Add to constructor parameters:
private onShowAuth: (() => void) | null = null;
private onShowDashboard: (() => void) | null = null;

// Add to toolbar HTML:
<div class="toolbar-auth" style="margin-top: auto; padding-top: 16px;">
  <div class="auth-container"></div>
</div>

// Add methods:
showLoginButton(): void {
  const container = this.element.querySelector('.auth-container');
  if (container) {
    container.innerHTML = `
      <button class="login-button" style="...">
        Sign In
      </button>
    `;
    const button = container.querySelector('.login-button');
    button?.addEventListener('click', () => this.onShowAuth?.());
  }
}

showUserMenu(userMenuElement: HTMLElement): void {
  const container = this.element.querySelector('.auth-container');
  if (container) {
    container.innerHTML = '';
    container.appendChild(userMenuElement);
  }
}
```

### 2. Update App.ts

Add imports at the top:

```typescript
import { AuthSession } from '../lib/auth/session.js';
import { CloudSyncService } from '../lib/cloud/sync.js';
import { AuthModal } from './components/auth/AuthModal.js';
import { UserMenu } from './components/auth/UserMenu.js';
import { Dashboard } from './components/Dashboard.js';
```

Add properties to the App class:

```typescript
private authSession: AuthSession;
private cloudSync: CloudSyncService | null = null;
private userMenu: UserMenu | null = null;
```

Initialize authentication in constructor:

```typescript
constructor(container: HTMLElement) {
  // ... existing code ...

  // Initialize auth (use environment variable for API URL)
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  this.authSession = new AuthSession(apiUrl);

  // Check if user is logged in
  if (this.authSession.isAuthenticated()) {
    this.initializeCloudSync();
  } else {
    this.toolbar.showLoginButton();
  }
}
```

Add authentication methods:

```typescript
private initializeCloudSync(): void {
  const user = this.authSession.getUser();
  if (!user) return;

  this.cloudSync = new CloudSyncService(this.authSession);

  // Show user menu
  this.userMenu = new UserMenu(
    user,
    () => this.handleLogout(),
    () => this.handleShowDashboard()
  );

  this.toolbar.showUserMenu(this.userMenu.getElement());
}

private handleShowAuth(): void {
  const modal = new AuthModal(
    () => modal.hide(),
    async (email, password) => {
      await this.authSession.login(email, password);
      modal.hide();
      this.initializeCloudSync();
      this.toast.success('Signed in successfully!');
    },
    async (email, password) => {
      await this.authSession.register(email, password);
      modal.hide();
      this.initializeCloudSync();
      this.toast.success('Account created successfully!');
    }
  );

  modal.show();
}

private async handleLogout(): Promise<void> {
  await this.authSession.logout();
  this.cloudSync = null;
  this.userMenu = null;
  this.toolbar.showLoginButton();
  this.toast.info('Signed out');
}

private handleShowDashboard(): void {
  if (!this.cloudSync) return;

  const dashboard = new Dashboard(
    () => dashboard.hide(),
    async (fileId) => {
      // Download file
      const { data, filename } = await this.cloudSync!.downloadFile(fileId);
      const blob = new Blob([data], { type: 'application/pdf' });
      await saveBlob(blob, filename);
      this.toast.success('File downloaded!');
    },
    async (fileId) => {
      // Delete file
      await this.cloudSync!.deleteFile(fileId);
      this.toast.success('File deleted');
    },
    async () => {
      // Refresh file list
      return this.cloudSync!.listFiles();
    }
  );

  dashboard.show();
}
```

Modify the export handler to add cloud save option:

```typescript
private async handleExport() {
  const item = this.files[this.currentFileIndex];
  if (!item) return;

  this.toast.info('Exporting...');

  try {
    let exportedData: Uint8Array;

    if (item.file.type === 'application/pdf') {
      exportedData = await this.exportPdf();
    } else if (item.file.type.startsWith('image/')) {
      const blob = await this.exportImage();
      exportedData = new Uint8Array(await blob.arrayBuffer());
    } else {
      return;
    }

    // Show success animation
    const successAnim = new SuccessAnimation();
    successAnim.show();

    // Prompt to save to cloud if authenticated
    if (this.authSession.isAuthenticated() && this.cloudSync) {
      this.promptSaveToCloud(exportedData, item.file.name);
    } else {
      this.toast.success('Export complete!');
    }
  } catch (error) {
    this.toast.error('Export failed');
    console.error(error);
  }
}

private async promptSaveToCloud(
  fileData: Uint8Array,
  filename: string
): Promise<void> {
  // Create dialog
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
  `;

  overlay.innerHTML = `
    <div style="
      background: white;
      border-radius: 12px;
      padding: 32px;
      max-width: 400px;
      text-align: center;
    ">
      <h3 style="margin: 0 0 16px 0; font-size: 20px;">Save to Cloud?</h3>
      <p style="margin: 0 0 24px 0; color: #666; font-size: 14px;">
        Keep this redacted file in your secure cloud storage for access from any device.
      </p>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button class="btn-skip" style="
          padding: 12px 24px;
          background: #e0e0e0;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">
          Download Only
        </button>
        <button class="btn-save" style="
          padding: 12px 24px;
          background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">
          Save to Cloud
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const skipBtn = overlay.querySelector('.btn-skip') as HTMLButtonElement;
  const saveBtn = overlay.querySelector('.btn-save') as HTMLButtonElement;

  skipBtn.addEventListener('click', () => {
    overlay.remove();
    this.toast.success('Export complete!');
  });

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Uploading...';

    try {
      const redactedFilename = filename.replace(/\.pdf$/, '-redacted.pdf');
      await this.cloudSync!.uploadFile(fileData, redactedFilename, 'application/pdf');
      overlay.remove();
      this.toast.success('Saved to your account!');
    } catch (error) {
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save to Cloud';
    }
  });

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}
```

### 3. Add Environment Variable Support

Create `vite.config.ts` update:

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  // ... existing config ...
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.VITE_API_URL || 'http://localhost:3000'
    ),
  },
});
```

Create `.env` file:

```
VITE_API_URL=http://localhost:3000
```

For production:

```
VITE_API_URL=https://api.aegisredact.com
```

## Testing the Integration

1. Start the backend:
   ```bash
   cd backend
   npm install
   npm run db:migrate
   npm run dev
   ```

2. Start the frontend:
   ```bash
   npm run dev
   ```

3. Test the flow:
   - Click "Sign In" button
   - Register a new account
   - Upload and redact a PDF
   - Export and save to cloud
   - View files in dashboard
   - Download a file
   - Delete a file
   - Logout and login again

## Security Checklist

- [ ] API URL is configurable via environment variable
- [ ] Passwords are never logged or exposed
- [ ] Encryption key (derived from password) is kept in memory only
- [ ] Refresh tokens are stored securely
- [ ] HTTPS is enforced in production
- [ ] CORS is properly configured
- [ ] Rate limiting is active on all endpoints
- [ ] Files are encrypted before upload
- [ ] Server never sees unencrypted data

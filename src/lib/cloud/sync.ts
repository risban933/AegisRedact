/**
 * Cloud sync service for uploading/downloading encrypted files
 */

import { AuthSession } from '../auth/session.js';
import { encryptFile, decryptFile } from '../crypto/encryption.js';

export interface CloudFile {
  id: string;
  filename: string;
  file_size_bytes: number;
  mime_type: string | null;
  created_at: string;
  last_accessed_at: string;
}

export interface StorageQuota {
  used: number;
  quota: number;
  percentUsed: number;
}

/**
 * Cloud sync service
 */
export class CloudSyncService {
  constructor(private authSession: AuthSession) {}

  /**
   * Upload encrypted file to cloud
   */
  async uploadFile(
    fileData: Uint8Array,
    filename: string,
    mimeType?: string
  ): Promise<string> {
    const user = this.authSession.getUser();
    const password = this.authSession.getPassword();

    if (!user || !password) {
      throw new Error('Not authenticated or password not available');
    }

    // Encrypt file client-side
    const encrypted = await encryptFile(fileData.buffer, password, user.salt);

    // Request upload URL
    const requestResponse = await this.authSession.authenticatedFetch(
      '/api/files/upload/request',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          fileSize: encrypted.encryptedData.byteLength,
          encryptionMetadata: encrypted.metadata,
          mimeType,
        }),
      }
    );

    if (!requestResponse.ok) {
      const error = await requestResponse.json();
      throw new Error(error.error || 'Failed to request upload');
    }

    const { uploadUrl, fileId } = await requestResponse.json();

    // Upload encrypted blob
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Authorization': `Bearer ${this.authSession['accessToken']}`,
      },
      body: encrypted.encryptedData,
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file');
    }

    return fileId;
  }

  /**
   * Download and decrypt file from cloud
   */
  async downloadFile(fileId: string): Promise<{ data: Uint8Array; filename: string }> {
    const password = this.authSession.getPassword();

    if (!password) {
      throw new Error('Password not available for decryption');
    }

    // Get file metadata and download URL
    const metadataResponse = await this.authSession.authenticatedFetch(
      `/api/files/${fileId}`
    );

    if (!metadataResponse.ok) {
      throw new Error('Failed to get file metadata');
    }

    const metadata = await metadataResponse.json();

    // Download encrypted blob
    const downloadResponse = await fetch(metadata.downloadUrl, {
      headers: {
        'Authorization': `Bearer ${this.authSession['accessToken']}`,
      },
    });

    if (!downloadResponse.ok) {
      throw new Error('Failed to download file');
    }

    const encryptedData = await downloadResponse.arrayBuffer();

    // Decrypt client-side
    const decryptedData = await decryptFile(
      encryptedData,
      password,
      metadata.encryptionMetadata
    );

    return {
      data: new Uint8Array(decryptedData),
      filename: metadata.filename,
    };
  }

  /**
   * List all user's files
   */
  async listFiles(): Promise<CloudFile[]> {
    const response = await this.authSession.authenticatedFetch('/api/files');

    if (!response.ok) {
      throw new Error('Failed to list files');
    }

    const data = await response.json();
    return data.files;
  }

  /**
   * Delete file from cloud
   */
  async deleteFile(fileId: string): Promise<void> {
    const response = await this.authSession.authenticatedFetch(`/api/files/${fileId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete file');
    }
  }

  /**
   * Get storage quota information
   */
  async getStorageQuota(): Promise<StorageQuota> {
    const response = await this.authSession.authenticatedFetch('/api/files/storage/quota');

    if (!response.ok) {
      throw new Error('Failed to get storage quota');
    }

    return response.json();
  }
}

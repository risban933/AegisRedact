/**
 * Storage service
 * Handles both local and S3 storage
 */

import { env } from '../config/env.js';
import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { FileModel } from '../models/File.js';

export class StorageService {
  /**
   * Get upload URL for a file
   */
  async getUploadUrl(
    userId: string,
    filename: string,
    fileSize: number,
    encryptionMetadata: any,
    mimeType?: string
  ): Promise<{ uploadUrl: string; storageKey: string; fileId: string }> {
    // Generate unique storage key
    const storageKey = `${userId}/${nanoid()}.encrypted`;

    if (env.STORAGE_PROVIDER === 's3') {
      // TODO: Implement S3 presigned URL
      throw new Error('S3 storage not yet implemented');
    } else {
      // Local storage - create file record and return upload endpoint
      const file = await FileModel.create(
        userId,
        filename,
        fileSize,
        storageKey,
        encryptionMetadata,
        mimeType
      );

      // Ensure upload directory exists
      const uploadDir = path.join(process.cwd(), env.UPLOAD_DIR, userId);
      await fs.mkdir(uploadDir, { recursive: true });

      return {
        uploadUrl: `/api/files/${file.id}/upload`,
        storageKey,
        fileId: file.id,
      };
    }
  }

  /**
   * Get download URL for a file
   */
  async getDownloadUrl(storageKey: string): Promise<string> {
    if (env.STORAGE_PROVIDER === 's3') {
      // TODO: Implement S3 presigned download URL
      throw new Error('S3 storage not yet implemented');
    } else {
      // Local storage - return direct download path
      return `/api/files/download/${encodeURIComponent(storageKey)}`;
    }
  }

  /**
   * Save file to storage
   */
  async saveFile(storageKey: string, data: Buffer): Promise<void> {
    if (env.STORAGE_PROVIDER === 's3') {
      // TODO: Implement S3 upload
      throw new Error('S3 storage not yet implemented');
    } else {
      const filePath = path.join(process.cwd(), env.UPLOAD_DIR, storageKey);
      await fs.writeFile(filePath, data);
    }
  }

  /**
   * Get file from storage
   */
  async getFile(storageKey: string): Promise<Buffer> {
    if (env.STORAGE_PROVIDER === 's3') {
      // TODO: Implement S3 download
      throw new Error('S3 storage not yet implemented');
    } else {
      const filePath = path.join(process.cwd(), env.UPLOAD_DIR, storageKey);
      return fs.readFile(filePath);
    }
  }

  /**
   * Delete file from storage
   */
  async deleteFile(storageKey: string): Promise<void> {
    if (env.STORAGE_PROVIDER === 's3') {
      // TODO: Implement S3 delete
      throw new Error('S3 storage not yet implemented');
    } else {
      const filePath = path.join(process.cwd(), env.UPLOAD_DIR, storageKey);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // Ignore if file doesn't exist
        console.warn(`Failed to delete file ${storageKey}:`, error);
      }
    }
  }
}

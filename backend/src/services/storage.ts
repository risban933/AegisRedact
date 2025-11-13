/**
 * Storage service
 * Handles both local and S3 storage
 */

import { env } from '../config/env.js';
import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { FileModel } from '../models/File.js';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

export class StorageService {
  private s3Client: S3Client | null = null;

  constructor() {
    // Initialize S3 client if S3 storage is configured
    if (env.STORAGE_PROVIDER === 's3') {
      if (!env.S3_BUCKET || !env.S3_REGION) {
        throw new Error('S3_BUCKET and S3_REGION are required when using S3 storage');
      }

      const s3Config: any = {
        region: env.S3_REGION,
      };

      // Use custom endpoint if provided (for S3-compatible services like MinIO, DigitalOcean Spaces)
      if (env.S3_ENDPOINT) {
        s3Config.endpoint = env.S3_ENDPOINT;
        s3Config.forcePathStyle = true; // Required for MinIO and some S3-compatible services
      }

      // Use explicit credentials if provided, otherwise fall back to AWS SDK default credential chain
      if (env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
        s3Config.credentials = {
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        };
      }

      this.s3Client = new S3Client(s3Config);
    }
  }

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
      if (!this.s3Client) {
        throw new Error('S3 client not initialized');
      }

      // Create file record first
      const file = await FileModel.create(
        userId,
        filename,
        fileSize,
        storageKey,
        encryptionMetadata,
        mimeType
      );

      // Generate presigned URL for upload (valid for 15 minutes)
      const command = new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: storageKey,
        ContentType: mimeType || 'application/octet-stream',
        ContentLength: fileSize,
        Metadata: {
          'user-id': userId,
          'file-id': file.id,
          'original-filename': filename,
        },
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 900, // 15 minutes
      });

      return {
        uploadUrl,
        storageKey,
        fileId: file.id,
      };
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
      if (!this.s3Client) {
        throw new Error('S3 client not initialized');
      }

      // Generate presigned URL for download (valid for 1 hour)
      const command = new GetObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: storageKey,
      });

      const downloadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600, // 1 hour
      });

      return downloadUrl;
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
      if (!this.s3Client) {
        throw new Error('S3 client not initialized');
      }

      const command = new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: storageKey,
        Body: data,
      });

      await this.s3Client.send(command);
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
      if (!this.s3Client) {
        throw new Error('S3 client not initialized');
      }

      const command = new GetObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: storageKey,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error('Empty response from S3');
      }

      // Convert stream to buffer
      return this.streamToBuffer(response.Body as Readable);
    } else {
      const filePath = path.join(process.cwd(), env.UPLOAD_DIR, storageKey);
      return fs.readFile(filePath);
    }
  }

  /**
   * Convert a readable stream to a buffer
   */
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Delete file from storage
   */
  async deleteFile(storageKey: string): Promise<void> {
    if (env.STORAGE_PROVIDER === 's3') {
      if (!this.s3Client) {
        throw new Error('S3 client not initialized');
      }

      try {
        const command = new DeleteObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: storageKey,
        });

        await this.s3Client.send(command);
      } catch (error) {
        // Log but don't throw - S3 delete is idempotent
        console.warn(`Failed to delete file ${storageKey} from S3:`, error);
      }
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

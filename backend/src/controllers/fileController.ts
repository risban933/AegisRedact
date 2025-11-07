/**
 * File storage controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { FileModel } from '../models/File.js';
import { UserModel } from '../models/User.js';
import type { AuthRequest } from '../middleware/auth.js';
import { StorageService } from '../services/storage.js';

// Validation schemas
const uploadSchema = z.object({
  filename: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(50 * 1024 * 1024), // 50MB max
  encryptionMetadata: z.object({
    iv: z.string(),
    salt: z.string(),
    algorithm: z.string(),
    keyDerivation: z.string(),
    iterations: z.number().int().positive(),
  }),
  mimeType: z.string().optional(),
});

/**
 * Get all files for authenticated user
 */
export async function listFiles(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const files = await FileModel.findByUserId(req.user.userId, limit, offset);
    const metadata = files.map(FileModel.toMetadata);

    res.json({ files: metadata });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
}

/**
 * Request file upload (get presigned URL or upload endpoint)
 */
export async function requestUpload(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { filename, fileSize, encryptionMetadata, mimeType } = uploadSchema.parse(req.body);

    // Check storage quota
    const storage = await UserModel.getStorageUsage(req.user.userId);
    if (storage.used + fileSize > storage.quota) {
      return res.status(413).json({
        error: 'Storage quota exceeded',
        used: storage.used,
        quota: storage.quota,
      });
    }

    // Generate storage key
    const storageService = new StorageService();
    const { uploadUrl, storageKey, fileId } = await storageService.getUploadUrl(
      req.user.userId,
      filename,
      fileSize,
      encryptionMetadata,
      mimeType
    );

    res.json({
      uploadUrl,
      fileId,
      storageKey,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }

    console.error('Request upload error:', error);
    res.status(500).json({ error: 'Failed to request upload' });
  }
}

/**
 * Complete file upload (for local storage)
 */
export async function completeUpload(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const fileId = req.params.id;
    const file = await FileModel.findById(fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({ message: 'Upload completed', file: FileModel.toMetadata(file) });
  } catch (error) {
    console.error('Complete upload error:', error);
    res.status(500).json({ error: 'Failed to complete upload' });
  }
}

/**
 * Get file metadata and download URL
 */
export async function getFile(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const fileId = req.params.id;
    const file = await FileModel.findById(fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Verify ownership
    if (file.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Update last accessed timestamp
    await FileModel.updateLastAccessed(fileId);

    // Get download URL
    const storageService = new StorageService();
    const downloadUrl = await storageService.getDownloadUrl(file.storage_key);

    res.json({
      ...FileModel.toMetadata(file),
      downloadUrl,
      encryptionMetadata: file.encryption_metadata,
    });
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ error: 'Failed to get file' });
  }
}

/**
 * Delete a file
 */
export async function deleteFile(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const fileId = req.params.id;
    const file = await FileModel.findById(fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Verify ownership
    if (file.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Delete from storage
    const storageService = new StorageService();
    await storageService.deleteFile(file.storage_key);

    // Delete from database (will automatically update storage_used_bytes via trigger)
    await FileModel.delete(fileId);

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
}

/**
 * Get storage quota information
 */
export async function getStorageQuota(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const storage = await UserModel.getStorageUsage(req.user.userId);

    res.json({
      used: storage.used,
      quota: storage.quota,
      percentUsed: Math.round((storage.used / storage.quota) * 100),
    });
  } catch (error) {
    console.error('Get storage quota error:', error);
    res.status(500).json({ error: 'Failed to get storage quota' });
  }
}

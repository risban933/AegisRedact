/**
 * File storage routes
 */

import { Router } from 'express';
import * as fileController from '../controllers/fileController.js';
import { authenticate } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { StorageService } from '../services/storage.js';
import type { AuthRequest } from '../middleware/auth.js';
import { FileModel } from '../models/File.js';

const router = Router();

// All file routes require authentication
router.use(authenticate);

// List user's files
router.get('/', fileController.listFiles);

// Request upload URL
router.post('/upload/request', uploadLimiter, fileController.requestUpload);

// Upload file data (for local storage)
router.post('/:id/upload', uploadLimiter, async (req: AuthRequest, res) => {
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

    // Collect binary data
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const data = Buffer.concat(chunks);

        // Verify file size
        if (data.length !== file.file_size_bytes) {
          return res.status(400).json({
            error: 'File size mismatch',
            expected: file.file_size_bytes,
            received: data.length,
          });
        }

        // Save to storage
        const storageService = new StorageService();
        await storageService.saveFile(file.storage_key, data);

        res.json({
          message: 'Upload successful',
          file: FileModel.toMetadata(file),
        });
      } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
      }
    });
  } catch (error) {
    console.error('Upload route error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Download file
router.get('/download/:storageKey', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const storageKey = decodeURIComponent(req.params.storageKey);

    // Find file by storage key
    const result = await FileModel.findByUserId(req.user.userId);
    const file = result.find((f) => f.storage_key === storageKey);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get file from storage
    const storageService = new StorageService();
    const data = await storageService.getFile(storageKey);

    // Set headers
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', data.length);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);

    res.send(data);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// Get file metadata
router.get('/:id', fileController.getFile);

// Delete file
router.delete('/:id', fileController.deleteFile);

// Storage quota
router.get('/storage/quota', fileController.getStorageQuota);

export default router;

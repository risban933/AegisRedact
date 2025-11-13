/**
 * Unit tests for StorageService
 * Tests both local and S3 storage implementations
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { StorageService } from '../../src/services/storage.js';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3');
vi.mock('@aws-sdk/s3-request-presigner');
vi.mock('../../src/models/File.js', () => ({
  FileModel: {
    create: vi.fn().mockResolvedValue({
      id: 'test-file-id',
      userId: 'test-user',
      filename: 'test.txt',
      storageKey: 'test-user/test-key.encrypted',
    }),
  },
}));

describe('StorageService - S3 Implementation', () => {
  let storageService: StorageService;
  let mockS3Client: any;
  let originalEnv: any;

  beforeEach(() => {
    // Store original env
    originalEnv = { ...process.env };

    // Set S3 environment variables
    process.env.STORAGE_PROVIDER = 's3';
    process.env.S3_BUCKET = 'test-bucket';
    process.env.S3_REGION = 'us-east-1';
    process.env.S3_ACCESS_KEY_ID = 'test-access-key';
    process.env.S3_SECRET_ACCESS_KEY = 'test-secret-key';

    // Mock S3 client
    mockS3Client = {
      send: vi.fn(),
    };
    vi.mocked(S3Client).mockImplementation(() => mockS3Client);
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize S3 client with correct configuration', () => {
      storageService = new StorageService();

      expect(S3Client).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
      });
    });

    it('should support custom S3 endpoint for S3-compatible services', () => {
      process.env.S3_ENDPOINT = 'https://minio.example.com';
      storageService = new StorageService();

      expect(S3Client).toHaveBeenCalledWith({
        region: 'us-east-1',
        endpoint: 'https://minio.example.com',
        forcePathStyle: true,
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
      });
    });

    it('should throw error if S3_BUCKET is missing', () => {
      delete process.env.S3_BUCKET;

      expect(() => new StorageService()).toThrow(
        'S3_BUCKET and S3_REGION are required when using S3 storage'
      );
    });

    it('should throw error if S3_REGION is missing', () => {
      delete process.env.S3_REGION;

      expect(() => new StorageService()).toThrow(
        'S3_BUCKET and S3_REGION are required when using S3 storage'
      );
    });

    it('should use AWS SDK credential chain if credentials not provided', () => {
      delete process.env.S3_ACCESS_KEY_ID;
      delete process.env.S3_SECRET_ACCESS_KEY;

      storageService = new StorageService();

      expect(S3Client).toHaveBeenCalledWith({
        region: 'us-east-1',
      });
    });
  });

  describe('getUploadUrl', () => {
    beforeEach(() => {
      vi.mocked(getSignedUrl).mockResolvedValue('https://s3.presigned-upload-url.com');
      storageService = new StorageService();
    });

    it('should generate presigned upload URL', async () => {
      const result = await storageService.getUploadUrl(
        'user-123',
        'document.pdf',
        1024000,
        { algorithm: 'AES-256-GCM' },
        'application/pdf'
      );

      expect(result).toEqual({
        uploadUrl: 'https://s3.presigned-upload-url.com',
        storageKey: expect.stringContaining('user-123/'),
        fileId: 'test-file-id',
      });

      expect(getSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(PutObjectCommand),
        { expiresIn: 900 }
      );
    });

    it('should include correct metadata in PutObjectCommand', async () => {
      await storageService.getUploadUrl(
        'user-123',
        'document.pdf',
        1024000,
        { algorithm: 'AES-256-GCM' },
        'application/pdf'
      );

      const putCommand = vi.mocked(getSignedUrl).mock.calls[0][1] as any;
      expect(putCommand.input).toMatchObject({
        Bucket: 'test-bucket',
        ContentType: 'application/pdf',
        ContentLength: 1024000,
        Metadata: {
          'user-id': 'user-123',
          'file-id': 'test-file-id',
          'original-filename': 'document.pdf',
        },
      });
    });

    it('should default to octet-stream if no MIME type provided', async () => {
      await storageService.getUploadUrl(
        'user-123',
        'file.bin',
        1024,
        { algorithm: 'AES-256-GCM' }
      );

      const putCommand = vi.mocked(getSignedUrl).mock.calls[0][1] as any;
      expect(putCommand.input.ContentType).toBe('application/octet-stream');
    });
  });

  describe('getDownloadUrl', () => {
    beforeEach(() => {
      vi.mocked(getSignedUrl).mockResolvedValue('https://s3.presigned-download-url.com');
      storageService = new StorageService();
    });

    it('should generate presigned download URL', async () => {
      const url = await storageService.getDownloadUrl('user-123/file.encrypted');

      expect(url).toBe('https://s3.presigned-download-url.com');
      expect(getSignedUrl).toHaveBeenCalledWith(
        mockS3Client,
        expect.any(GetObjectCommand),
        { expiresIn: 3600 }
      );
    });

    it('should include correct storage key in GetObjectCommand', async () => {
      await storageService.getDownloadUrl('user-123/file.encrypted');

      const getCommand = vi.mocked(getSignedUrl).mock.calls[0][1] as any;
      expect(getCommand.input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'user-123/file.encrypted',
      });
    });
  });

  describe('saveFile', () => {
    beforeEach(() => {
      mockS3Client.send.mockResolvedValue({});
      storageService = new StorageService();
    });

    it('should upload file to S3', async () => {
      const fileData = Buffer.from('encrypted file content');

      await storageService.saveFile('user-123/file.encrypted', fileData);

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: 'test-bucket',
            Key: 'user-123/file.encrypted',
            Body: fileData,
          },
        })
      );
    });

    it('should propagate S3 errors', async () => {
      mockS3Client.send.mockRejectedValue(new Error('S3 upload failed'));

      await expect(
        storageService.saveFile('user-123/file.encrypted', Buffer.from('data'))
      ).rejects.toThrow('S3 upload failed');
    });
  });

  describe('getFile', () => {
    beforeEach(() => {
      storageService = new StorageService();
    });

    it('should download file from S3 and convert to buffer', async () => {
      // Create a readable stream with test data
      const testData = Buffer.from('encrypted file content');
      const stream = Readable.from([testData]);

      mockS3Client.send.mockResolvedValue({
        Body: stream,
      });

      const result = await storageService.getFile('user-123/file.encrypted');

      expect(result).toEqual(testData);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: 'test-bucket',
            Key: 'user-123/file.encrypted',
          },
        })
      );
    });

    it('should throw error if S3 response body is empty', async () => {
      mockS3Client.send.mockResolvedValue({
        Body: undefined,
      });

      await expect(
        storageService.getFile('user-123/file.encrypted')
      ).rejects.toThrow('Empty response from S3');
    });

    it('should handle stream errors', async () => {
      const errorStream = new Readable({
        read() {
          this.emit('error', new Error('Stream read error'));
        },
      });

      mockS3Client.send.mockResolvedValue({
        Body: errorStream,
      });

      await expect(
        storageService.getFile('user-123/file.encrypted')
      ).rejects.toThrow('Stream read error');
    });
  });

  describe('deleteFile', () => {
    beforeEach(() => {
      mockS3Client.send.mockResolvedValue({});
      storageService = new StorageService();
    });

    it('should delete file from S3', async () => {
      await storageService.deleteFile('user-123/file.encrypted');

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: 'test-bucket',
            Key: 'user-123/file.encrypted',
          },
        })
      );
    });

    it('should not throw error if S3 delete fails (idempotent)', async () => {
      mockS3Client.send.mockRejectedValue(new Error('S3 delete failed'));

      // Should not throw
      await expect(
        storageService.deleteFile('user-123/file.encrypted')
      ).resolves.not.toThrow();
    });

    it('should log warning on delete failure', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockS3Client.send.mockRejectedValue(new Error('S3 delete failed'));

      await storageService.deleteFile('user-123/file.encrypted');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete file'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('streamToBuffer', () => {
    beforeEach(() => {
      storageService = new StorageService();
    });

    it('should handle multiple chunks', async () => {
      const chunk1 = Buffer.from('part1');
      const chunk2 = Buffer.from('part2');
      const chunk3 = Buffer.from('part3');
      const stream = Readable.from([chunk1, chunk2, chunk3]);

      mockS3Client.send.mockResolvedValue({
        Body: stream,
      });

      const result = await storageService.getFile('test-key');

      expect(result).toEqual(Buffer.concat([chunk1, chunk2, chunk3]));
    });

    it('should handle empty stream', async () => {
      const stream = Readable.from([]);

      mockS3Client.send.mockResolvedValue({
        Body: stream,
      });

      const result = await storageService.getFile('test-key');

      expect(result).toEqual(Buffer.from(''));
    });
  });
});

describe('StorageService - Local Storage', () => {
  let originalEnv: any;

  beforeEach(() => {
    // Store original env
    originalEnv = { ...process.env };

    // Set local storage environment
    process.env.STORAGE_PROVIDER = 'local';
    process.env.UPLOAD_DIR = './uploads';
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('Constructor', () => {
    it('should not initialize S3 client for local storage', () => {
      const storageService = new StorageService();

      expect(S3Client).not.toHaveBeenCalled();
    });
  });

  describe('S3 operations with local provider', () => {
    it('getDownloadUrl should return local path', async () => {
      const storageService = new StorageService();
      const url = await storageService.getDownloadUrl('user-123/file.encrypted');

      expect(url).toBe('/api/files/download/user-123%2Ffile.encrypted');
    });
  });
});

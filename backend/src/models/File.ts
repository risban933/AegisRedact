/**
 * File model
 */

import { query } from '../config/database.js';

export interface File {
  id: string;
  user_id: string;
  filename: string;
  file_size_bytes: number;
  storage_key: string;
  encryption_metadata: {
    iv: string;
    salt: string;
    algorithm: string;
    keyDerivation: string;
    iterations: number;
  };
  mime_type: string | null;
  created_at: Date;
  last_accessed_at: Date;
}

export interface FileMetadata {
  id: string;
  filename: string;
  file_size_bytes: number;
  mime_type: string | null;
  created_at: Date;
  last_accessed_at: Date;
}

export class FileModel {
  /**
   * Create a new file record
   */
  static async create(
    userId: string,
    filename: string,
    fileSize: number,
    storageKey: string,
    encryptionMetadata: File['encryption_metadata'],
    mimeType?: string
  ): Promise<File> {
    const result = await query<File>(
      `INSERT INTO files (user_id, filename, file_size_bytes, storage_key, encryption_metadata, mime_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, filename, fileSize, storageKey, JSON.stringify(encryptionMetadata), mimeType || null]
    );

    return result.rows[0];
  }

  /**
   * Find file by ID
   */
  static async findById(fileId: string): Promise<File | null> {
    const result = await query<File>(
      'SELECT * FROM files WHERE id = $1',
      [fileId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find all files for a user
   */
  static async findByUserId(userId: string, limit = 100, offset = 0): Promise<File[]> {
    const result = await query<File>(
      `SELECT * FROM files
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  /**
   * Update last accessed timestamp
   */
  static async updateLastAccessed(fileId: string): Promise<void> {
    await query(
      'UPDATE files SET last_accessed_at = NOW() WHERE id = $1',
      [fileId]
    );
  }

  /**
   * Delete a file
   */
  static async delete(fileId: string): Promise<File | null> {
    const result = await query<File>(
      'DELETE FROM files WHERE id = $1 RETURNING *',
      [fileId]
    );

    return result.rows[0] || null;
  }

  /**
   * Count files for a user
   */
  static async countByUserId(userId: string): Promise<number> {
    const result = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM files WHERE user_id = $1',
      [userId]
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Convert File to FileMetadata (remove internal details)
   */
  static toMetadata(file: File): FileMetadata {
    return {
      id: file.id,
      filename: file.filename,
      file_size_bytes: file.file_size_bytes,
      mime_type: file.mime_type,
      created_at: file.created_at,
      last_accessed_at: file.last_accessed_at,
    };
  }
}

/**
 * User model
 */

import { query } from '../config/database.js';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import crypto from 'crypto';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
  email_verified: boolean;
  storage_quota_bytes: number;
  storage_used_bytes: number;
  salt: string;
}

export interface UserPublic {
  id: string;
  email: string;
  created_at: Date;
  email_verified: boolean;
  storage_quota_bytes: number;
  storage_used_bytes: number;
  salt: string; // Needed for client-side key derivation
}

export class UserModel {
  /**
   * Create a new user
   */
  static async create(email: string, password: string): Promise<User> {
    // Hash password
    const password_hash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);

    // Generate random salt for client-side encryption
    const salt = crypto.randomBytes(16).toString('hex');

    const result = await query<User>(
      `INSERT INTO users (email, password_hash, salt, storage_quota_bytes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [email, password_hash, salt, env.DEFAULT_STORAGE_QUOTA_BYTES]
    );

    return result.rows[0];
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<User | null> {
    const result = await query<User>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    return result.rows[0] || null;
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<User | null> {
    const result = await query<User>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Verify password
   */
  static async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password_hash);
  }

  /**
   * Update user email
   */
  static async updateEmail(userId: string, newEmail: string): Promise<User> {
    const result = await query<User>(
      'UPDATE users SET email = $1, email_verified = false WHERE id = $2 RETURNING *',
      [newEmail, userId]
    );

    return result.rows[0];
  }

  /**
   * Update user password
   */
  static async updatePassword(userId: string, newPassword: string): Promise<User> {
    const password_hash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);

    const result = await query<User>(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING *',
      [password_hash, userId]
    );

    return result.rows[0];
  }

  /**
   * Delete user (will cascade delete files and tokens)
   */
  static async delete(userId: string): Promise<void> {
    await query('DELETE FROM users WHERE id = $1', [userId]);
  }

  /**
   * Get storage usage for a user
   */
  static async getStorageUsage(userId: string): Promise<{ used: number; quota: number }> {
    const result = await query<{ storage_used_bytes: number; storage_quota_bytes: number }>(
      'SELECT storage_used_bytes, storage_quota_bytes FROM users WHERE id = $1',
      [userId]
    );

    const user = result.rows[0];
    return {
      used: user.storage_used_bytes,
      quota: user.storage_quota_bytes,
    };
  }

  /**
   * Convert User to UserPublic (remove sensitive data)
   */
  static toPublic(user: User): UserPublic {
    return {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      email_verified: user.email_verified,
      storage_quota_bytes: user.storage_quota_bytes,
      storage_used_bytes: user.storage_used_bytes,
      salt: user.salt,
    };
  }
}

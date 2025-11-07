/**
 * Refresh Token model
 */

import { query } from '../config/database.js';
import crypto from 'crypto';

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  revoked: boolean;
}

export class RefreshTokenModel {
  /**
   * Create a new refresh token
   */
  static async create(userId: string, expiresIn: number): Promise<{ token: string; id: string }> {
    // Generate random token
    const token = crypto.randomBytes(32).toString('hex');

    // Hash the token for storage
    const token_hash = crypto.createHash('sha256').update(token).digest('hex');

    // Calculate expiration
    const expires_at = new Date(Date.now() + expiresIn);

    const result = await query<RefreshToken>(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [userId, token_hash, expires_at]
    );

    return {
      token,
      id: result.rows[0].id,
    };
  }

  /**
   * Verify and return refresh token
   */
  static async verify(token: string): Promise<RefreshToken | null> {
    const token_hash = crypto.createHash('sha256').update(token).digest('hex');

    const result = await query<RefreshToken>(
      `SELECT * FROM refresh_tokens
       WHERE token_hash = $1 AND expires_at > NOW() AND revoked = false`,
      [token_hash]
    );

    return result.rows[0] || null;
  }

  /**
   * Revoke a refresh token
   */
  static async revoke(token: string): Promise<void> {
    const token_hash = crypto.createHash('sha256').update(token).digest('hex');

    await query(
      'UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1',
      [token_hash]
    );
  }

  /**
   * Revoke all refresh tokens for a user
   */
  static async revokeAllForUser(userId: string): Promise<void> {
    await query(
      'UPDATE refresh_tokens SET revoked = true WHERE user_id = $1',
      [userId]
    );
  }

  /**
   * Delete expired tokens (cleanup job)
   */
  static async deleteExpired(): Promise<number> {
    const result = await query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW()',
      []
    );

    return result.rowCount || 0;
  }
}

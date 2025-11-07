/**
 * Authentication controller
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { UserModel } from '../models/User.js';
import { RefreshTokenModel } from '../models/RefreshToken.js';
import { JWTService } from '../services/jwt.js';
import { env } from '../config/env.js';
import type { AuthRequest } from '../middleware/auth.js';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Register a new user
 */
export async function register(req: Request, res: Response) {
  try {
    const { email, password } = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Create user
    const user = await UserModel.create(email, password);

    // Generate tokens
    const accessToken = JWTService.generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    const refreshTokenExpiration = JWTService.parseExpiration(env.JWT_REFRESH_EXPIRES_IN);
    const { token: refreshToken } = await RefreshTokenModel.create(
      user.id,
      refreshTokenExpiration
    );

    const encodedRefreshToken = JWTService.generateRefreshToken({
      userId: user.id,
      tokenId: refreshToken,
    });

    res.status(201).json({
      accessToken,
      refreshToken: encodedRefreshToken,
      user: UserModel.toPublic(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }

    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
}

/**
 * Login user
 */
export async function login(req: Request, res: Response) {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const user = await UserModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValidPassword = await UserModel.verifyPassword(user, password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate tokens
    const accessToken = JWTService.generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    const refreshTokenExpiration = JWTService.parseExpiration(env.JWT_REFRESH_EXPIRES_IN);
    const { token: refreshToken } = await RefreshTokenModel.create(
      user.id,
      refreshTokenExpiration
    );

    const encodedRefreshToken = JWTService.generateRefreshToken({
      userId: user.id,
      tokenId: refreshToken,
    });

    res.json({
      accessToken,
      refreshToken: encodedRefreshToken,
      user: UserModel.toPublic(user),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }

    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * Refresh access token
 */
export async function refresh(req: Request, res: Response) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    // Verify JWT structure
    const payload = JWTService.verifyRefreshToken(refreshToken);

    // Verify token exists in database and is not revoked
    const tokenRecord = await RefreshTokenModel.verify(payload.tokenId);
    if (!tokenRecord) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Get user
    const user = await UserModel.findById(payload.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Generate new access token
    const accessToken = JWTService.generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    res.json({ accessToken });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }

    console.error('Refresh error:', error);
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}

/**
 * Logout user (revoke refresh token)
 */
export async function logout(req: Request, res: Response) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    await RefreshTokenModel.revoke(refreshToken);

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }

    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
}

/**
 * Get current user profile
 */
export async function getProfile(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await UserModel.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: UserModel.toPublic(user) });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
}

/**
 * Delete user account
 */
export async function deleteAccount(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await UserModel.delete(req.user.userId);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
}

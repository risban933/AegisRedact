/**
 * Environment configuration
 * Validates and exports environment variables
 */

import { config } from 'dotenv';
import { z } from 'zod';

// Load .env file
config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  API_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Password
  BCRYPT_SALT_ROUNDS: z.string().default('12'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
  LOGIN_RATE_LIMIT_MAX: z.string().default('5'),

  // Storage
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
  DEFAULT_STORAGE_QUOTA_BYTES: z.string().default('104857600'),

  // S3 (optional)
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = {
  NODE_ENV: parsed.data.NODE_ENV,
  PORT: parseInt(parsed.data.PORT, 10),
  API_URL: parsed.data.API_URL,
  FRONTEND_URL: parsed.data.FRONTEND_URL,

  DATABASE_URL: parsed.data.DATABASE_URL,

  JWT_ACCESS_SECRET: parsed.data.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: parsed.data.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN: parsed.data.JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN: parsed.data.JWT_REFRESH_EXPIRES_IN,

  BCRYPT_SALT_ROUNDS: parseInt(parsed.data.BCRYPT_SALT_ROUNDS, 10),

  RATE_LIMIT_WINDOW_MS: parseInt(parsed.data.RATE_LIMIT_WINDOW_MS, 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(parsed.data.RATE_LIMIT_MAX_REQUESTS, 10),
  LOGIN_RATE_LIMIT_MAX: parseInt(parsed.data.LOGIN_RATE_LIMIT_MAX, 10),

  STORAGE_PROVIDER: parsed.data.STORAGE_PROVIDER,
  UPLOAD_DIR: parsed.data.UPLOAD_DIR,
  DEFAULT_STORAGE_QUOTA_BYTES: parseInt(parsed.data.DEFAULT_STORAGE_QUOTA_BYTES, 10),

  S3_BUCKET: parsed.data.S3_BUCKET,
  S3_REGION: parsed.data.S3_REGION,
  S3_ACCESS_KEY_ID: parsed.data.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: parsed.data.S3_SECRET_ACCESS_KEY,
  S3_ENDPOINT: parsed.data.S3_ENDPOINT,

  isDevelopment: parsed.data.NODE_ENV === 'development',
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
} as const;

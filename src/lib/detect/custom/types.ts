/**
 * Custom Pattern Types
 *
 * Defines types for user-defined detection patterns.
 */

export interface CustomPattern {
  id: string;
  name: string;
  regex: string;
  type: string; // 'email', 'phone', 'ssn', 'custom', etc.
  caseSensitive: boolean;
  enabled: boolean;
  description?: string;
  createdAt: number;
  lastUsed?: number;
  usageCount?: number;
}

export interface PatternValidationResult {
  valid: boolean;
  error?: string;
}

export interface PatternTestResult {
  matches: string[];
  count: number;
}

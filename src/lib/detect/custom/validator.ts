/**
 * Pattern Validator
 *
 * Validates regex patterns before they are saved to prevent
 * invalid patterns from breaking detection.
 */

import type { PatternValidationResult, PatternTestResult } from './types';

export class PatternValidator {
  /**
   * Validate a regex pattern
   */
  static validate(pattern: string): PatternValidationResult {
    if (!pattern || pattern.trim().length === 0) {
      return {
        valid: false,
        error: 'Pattern cannot be empty'
      };
    }

    // Check for common mistakes
    if (pattern.length < 2) {
      return {
        valid: false,
        error: 'Pattern too short (minimum 2 characters)'
      };
    }

    // Try to compile the regex
    try {
      new RegExp(pattern);
    } catch (error) {
      return {
        valid: false,
        error: `Invalid regex: ${(error as Error).message}`
      };
    }

    // Check for overly broad patterns
    if (this.isTooGreedy(pattern)) {
      return {
        valid: false,
        error: 'Pattern is too greedy and may match too much text'
      };
    }

    return { valid: true };
  }

  /**
   * Test a pattern against sample text
   */
  static test(pattern: string, text: string, caseSensitive: boolean = false): PatternTestResult {
    try {
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(pattern, flags);
      const matches = Array.from(text.matchAll(regex), m => m[0]);

      return {
        matches,
        count: matches.length
      };
    } catch (error) {
      return {
        matches: [],
        count: 0
      };
    }
  }

  /**
   * Check if pattern is too greedy (e.g., .*, .+, etc.)
   */
  private static isTooGreedy(pattern: string): boolean {
    // Check for dangerous patterns
    const dangerousPatterns = [
      /^\.\*$/,        // Just .*
      /^\.\+$/,        // Just .+
      /^\.{1,2}\*$/,   // . or .. followed by *
    ];

    return dangerousPatterns.some(p => p.test(pattern));
  }

  /**
   * Suggest improvements for common pattern issues
   */
  static getSuggestions(pattern: string): string[] {
    const suggestions: string[] = [];

    // Suggest escaping special characters if not already escaped
    const specialChars = ['.', '*', '+', '?', '^', '$', '[', ']', '(', ')', '{', '}', '|', '\\'];
    const unescapedSpecial = specialChars.filter(char => {
      const index = pattern.indexOf(char);
      return index > 0 && pattern[index - 1] !== '\\';
    });

    if (unescapedSpecial.length > 0) {
      suggestions.push(`Consider escaping special characters: ${unescapedSpecial.join(', ')}`);
    }

    // Suggest using character classes
    if (pattern.includes('[0-9]') && pattern.includes('[a-z]')) {
      suggestions.push('Consider using \\d for digits and \\w for word characters');
    }

    // Suggest anchors for exact matches
    if (!pattern.startsWith('^') && !pattern.endsWith('$')) {
      suggestions.push('Add ^ and $ anchors for exact matches');
    }

    return suggestions;
  }
}

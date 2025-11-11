/**
 * Custom Pattern Registry
 *
 * Manages user-defined detection patterns with localStorage persistence.
 */

import type { CustomPattern } from './types';
import { PatternValidator } from './validator';

export class CustomPatternRegistry {
  private patterns = new Map<string, CustomPattern>();
  private storageKey = 'aegis-custom-patterns';

  constructor() {
    this.loadPatterns();
  }

  /**
   * Add a new custom pattern
   */
  addPattern(pattern: Omit<CustomPattern, 'id' | 'createdAt'>): string {
    // Validate pattern first
    const validation = PatternValidator.validate(pattern.regex);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid pattern');
    }

    const id = crypto.randomUUID();
    const newPattern: CustomPattern = {
      ...pattern,
      id,
      createdAt: Date.now(),
      usageCount: 0
    };

    this.patterns.set(id, newPattern);
    this.savePatterns();
    return id;
  }

  /**
   * Update an existing pattern
   */
  updatePattern(id: string, updates: Partial<Omit<CustomPattern, 'id' | 'createdAt'>>): void {
    const pattern = this.patterns.get(id);
    if (!pattern) {
      throw new Error('Pattern not found');
    }

    // Validate regex if it's being updated
    if (updates.regex) {
      const validation = PatternValidator.validate(updates.regex);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid pattern');
      }
    }

    Object.assign(pattern, updates);
    this.savePatterns();
  }

  /**
   * Delete a pattern
   */
  deletePattern(id: string): void {
    if (!this.patterns.has(id)) {
      throw new Error('Pattern not found');
    }

    this.patterns.delete(id);
    this.savePatterns();
  }

  /**
   * Get a pattern by ID
   */
  getPattern(id: string): CustomPattern | undefined {
    return this.patterns.get(id);
  }

  /**
   * Get all patterns
   */
  getAllPatterns(): CustomPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get enabled patterns only
   */
  getEnabledPatterns(): CustomPattern[] {
    return this.getAllPatterns().filter(p => p.enabled);
  }

  /**
   * Get patterns by type
   */
  getPatternsByType(type: string): CustomPattern[] {
    return this.getAllPatterns().filter(p => p.type === type);
  }

  /**
   * Toggle pattern enabled state
   */
  togglePattern(id: string): void {
    const pattern = this.patterns.get(id);
    if (pattern) {
      pattern.enabled = !pattern.enabled;
      this.savePatterns();
    }
  }

  /**
   * Record pattern usage
   */
  recordUsage(id: string): void {
    const pattern = this.patterns.get(id);
    if (pattern) {
      pattern.lastUsed = Date.now();
      pattern.usageCount = (pattern.usageCount || 0) + 1;
      this.savePatterns();
    }
  }

  /**
   * Import patterns from JSON
   */
  importPatterns(json: string): number {
    try {
      const imported = JSON.parse(json) as CustomPattern[];
      let count = 0;

      for (const pattern of imported) {
        // Validate before importing
        const validation = PatternValidator.validate(pattern.regex);
        if (validation.valid) {
          // Generate new ID to avoid conflicts
          const id = crypto.randomUUID();
          this.patterns.set(id, {
            ...pattern,
            id,
            createdAt: Date.now(),
            usageCount: 0
          });
          count++;
        }
      }

      this.savePatterns();
      return count;
    } catch (error) {
      throw new Error('Invalid JSON format');
    }
  }

  /**
   * Export patterns to JSON
   */
  exportPatterns(): string {
    const patterns = this.getAllPatterns();
    return JSON.stringify(patterns, null, 2);
  }

  /**
   * Export enabled patterns only
   */
  exportEnabledPatterns(): string {
    const patterns = this.getEnabledPatterns();
    return JSON.stringify(patterns, null, 2);
  }

  /**
   * Clear all patterns
   */
  clearAll(): void {
    this.patterns.clear();
    this.savePatterns();
  }

  /**
   * Get pattern count
   */
  getCount(): number {
    return this.patterns.size;
  }

  /**
   * Get enabled pattern count
   */
  getEnabledCount(): number {
    return this.getEnabledPatterns().length;
  }

  /**
   * Load patterns from localStorage
   */
  private loadPatterns(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const patterns = JSON.parse(stored) as CustomPattern[];
        patterns.forEach(p => {
          // Validate each pattern before loading
          const validation = PatternValidator.validate(p.regex);
          if (validation.valid) {
            this.patterns.set(p.id, p);
          }
        });
      }
    } catch (error) {
      console.error('Failed to load custom patterns:', error);
    }
  }

  /**
   * Save patterns to localStorage
   */
  private savePatterns(): void {
    try {
      const patterns = this.getAllPatterns();
      localStorage.setItem(this.storageKey, JSON.stringify(patterns));
    } catch (error) {
      console.error('Failed to save custom patterns:', error);
    }
  }
}

// Export singleton instance
export const customPatternRegistry = new CustomPatternRegistry();

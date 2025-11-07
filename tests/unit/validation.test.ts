import { describe, it, expect } from 'vitest';
import {
  validateMLEntity,
  enhanceEntityConfidence,
  hasNearbyPIILabel,
  validateNumericPII,
  filterAndEnhanceEntities
} from '../../src/lib/detect/validation';
import type { MLEntity } from '../../src/lib/detect/ml';

describe('Validation Module', () => {
  describe('validateMLEntity', () => {
    it('should accept valid person names', () => {
      const entity: MLEntity = {
        text: 'John Smith',
        entity: 'PER',
        score: 0.9,
        start: 0,
        end: 10
      };
      expect(validateMLEntity(entity, 'John Smith is here')).toBe(true);
    });

    it('should reject too short names', () => {
      const entity: MLEntity = {
        text: 'Jo',
        entity: 'PER',
        score: 0.9,
        start: 0,
        end: 2
      };
      expect(validateMLEntity(entity, 'Jo is here')).toBe(false);
    });

    it('should reject uncapitalized names', () => {
      const entity: MLEntity = {
        text: 'john',
        entity: 'PER',
        score: 0.9,
        start: 0,
        end: 4
      };
      expect(validateMLEntity(entity, 'john is here')).toBe(false);
    });

    it('should reject common words', () => {
      const entity: MLEntity = {
        text: 'The',
        entity: 'PER',
        score: 0.9,
        start: 0,
        end: 3
      };
      expect(validateMLEntity(entity, 'The document')).toBe(false);
    });

    it('should reject placeholder names', () => {
      const entity: MLEntity = {
        text: 'John Doe',
        entity: 'PER',
        score: 0.9,
        start: 10,
        end: 18
      };
      expect(validateMLEntity(entity, 'Copyright © John Doe 2024')).toBe(false);
    });

    it('should reject emails misclassified as names', () => {
      const entity: MLEntity = {
        text: 'john@example.com',
        entity: 'PER',
        score: 0.9,
        start: 0,
        end: 16
      };
      expect(validateMLEntity(entity, 'john@example.com')).toBe(false);
    });
  });

  describe('enhanceEntityConfidence', () => {
    it('should boost confidence for common first names', () => {
      const entity: MLEntity = {
        text: 'John Smith',
        entity: 'PER',
        score: 0.8,
        start: 0,
        end: 10
      };
      const enhanced = enhanceEntityConfidence(entity, 'John Smith is here');
      expect(enhanced.score).toBeGreaterThan(0.8);
    });

    it('should boost confidence near titles', () => {
      const entity: MLEntity = {
        text: 'John Smith',
        entity: 'PER',
        score: 0.8,
        start: 4,
        end: 14
      };
      const enhanced = enhanceEntityConfidence(entity, 'Dr. John Smith is here');
      expect(enhanced.score).toBeGreaterThan(0.8);
    });

    it('should boost confidence for full names', () => {
      const entity: MLEntity = {
        text: 'Alice Johnson',
        entity: 'PER',
        score: 0.8,
        start: 0,
        end: 13
      };
      const enhanced = enhanceEntityConfidence(entity, 'Alice Johnson works here');
      expect(enhanced.score).toBeGreaterThan(0.8);
    });

    it('should cap confidence at 1.0', () => {
      const entity: MLEntity = {
        text: 'Dr. John Smith',
        entity: 'PER',
        score: 0.95,
        start: 0,
        end: 14
      };
      const enhanced = enhanceEntityConfidence(entity, 'Dr. John Smith, CEO');
      expect(enhanced.score).toBeLessThanOrEqual(1.0);
    });
  });

  describe('hasNearbyPIILabel', () => {
    it('should detect nearby name labels', () => {
      const entity: MLEntity = {
        text: 'John Smith',
        entity: 'PER',
        score: 0.9,
        start: 6,
        end: 16
      };
      expect(hasNearbyPIILabel(entity, 'Name: John Smith')).toBe(true);
    });

    it('should detect nearby SSN labels', () => {
      const entity: MLEntity = {
        text: '123-45-6789',
        entity: 'SSN',
        score: 1.0,
        start: 5,
        end: 16
      };
      expect(hasNearbyPIILabel(entity, 'SSN: 123-45-6789')).toBe(true);
    });

    it('should return false when no label nearby', () => {
      const entity: MLEntity = {
        text: 'John Smith',
        entity: 'PER',
        score: 0.9,
        start: 0,
        end: 10
      };
      expect(hasNearbyPIILabel(entity, 'John Smith works here')).toBe(false);
    });
  });

  describe('validateNumericPII', () => {
    it('should validate SSN format', () => {
      const result = validateNumericPII('123-45-6789');
      expect(result.isValid).toBe(true);
      expect(result.type).toBe('ssn');
    });

    it('should validate credit card with Luhn check', () => {
      // Valid test credit card number (Visa test card)
      const result = validateNumericPII('4532015112830366');
      expect(result.isValid).toBe(true);
      expect(result.type).toBe('card');
    });

    it('should validate phone numbers', () => {
      const result = validateNumericPII('555-123-4567');
      expect(result.isValid).toBe(true);
      expect(result.type).toBe('phone');
    });

    it('should reject invalid patterns', () => {
      const result = validateNumericPII('123');
      expect(result.isValid).toBe(false);
    });

    it('should reject credit cards failing Luhn check', () => {
      const result = validateNumericPII('1234567890123456');
      expect(result.isValid).toBe(false);
    });
  });

  describe('filterAndEnhanceEntities', () => {
    it('should filter out invalid entities', () => {
      const entities: MLEntity[] = [
        { text: 'John Smith', entity: 'PER', score: 0.9, start: 0, end: 10 },
        { text: 'the', entity: 'PER', score: 0.8, start: 11, end: 14 }, // Invalid
        { text: 'ABC Corp', entity: 'ORG', score: 0.85, start: 15, end: 23 }
      ];

      const filtered = filterAndEnhanceEntities(entities, 'John Smith the ABC Corp');
      expect(filtered.length).toBe(2);
      expect(filtered.some(e => e.text === 'the')).toBe(false);
    });

    it('should enhance confidence of valid entities', () => {
      const entities: MLEntity[] = [
        { text: 'John Doe', entity: 'PER', score: 0.8, start: 4, end: 12 }
      ];

      const enhanced = filterAndEnhanceEntities(entities, 'Dr. John Doe');
      expect(enhanced[0].score).toBeGreaterThan(0.8);
    });

    it('should return empty array for all-invalid entities', () => {
      const entities: MLEntity[] = [
        { text: 'the', entity: 'PER', score: 0.8, start: 0, end: 3 },
        { text: 'and', entity: 'PER', score: 0.7, start: 4, end: 7 }
      ];

      const filtered = filterAndEnhanceEntities(entities, 'the and');
      expect(filtered.length).toBe(0);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle resume text correctly', () => {
      const text = `
        Resume
        Name: Alice Johnson
        Email: alice@example.com
        Phone: 555-123-4567

        Experience:
        Senior Developer at ABC Corporation
      `;

      const entities: MLEntity[] = [
        { text: 'Resume', entity: 'MISC', score: 0.7, start: 9, end: 15 },
        { text: 'Alice Johnson', entity: 'PER', score: 0.92, start: 30, end: 43 },
        { text: 'alice@example.com', entity: 'MISC', score: 0.8, start: 59, end: 76 },
        { text: 'ABC Corporation', entity: 'ORG', score: 0.88, start: 154, end: 169 }
      ];

      const filtered = filterAndEnhanceEntities(entities, text);

      // Should filter out 'Resume' (too generic, MISC with low confidence)
      // Should keep 'Alice Johnson' with boosted confidence (near "Name:")
      // Should filter out email (should be caught by regex instead)
      // Should keep 'ABC Corporation'

      expect(filtered.some(e => e.text === 'Resume')).toBe(false);
      expect(filtered.some(e => e.text === 'Alice Johnson')).toBe(true);
      expect(filtered.some(e => e.text === 'ABC Corporation')).toBe(true);
    });

    it('should filter lorem ipsum placeholder text', () => {
      const text = 'Lorem ipsum dolor sit amet, John Doe example text';

      const entities: MLEntity[] = [
        { text: 'Lorem', entity: 'PER', score: 0.75, start: 0, end: 5 },
        { text: 'John Doe', entity: 'PER', score: 0.85, start: 28, end: 36 }
      ];

      const filtered = filterAndEnhanceEntities(entities, text);

      // Should filter out 'Lorem' (common word)
      // Should filter out 'John Doe' (placeholder in context with 'Lorem ipsum')
      expect(filtered.length).toBe(0);
    });
  });
});

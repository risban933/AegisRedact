import { describe, it, expect } from 'vitest';
import {
  mergeDetections,
  mlEntitiesToDetections,
  createRegexDetections,
  extractTerms,
  groupByType,
  getDetectionStats,
  type DetectionResult
} from '../../src/lib/detect/merger';
import type { MLEntity } from '../../src/lib/detect/ml';

describe('Detection Merger', () => {
  describe('createRegexDetections', () => {
    it('should create detection results from string array', () => {
      const terms = ['john@example.com', 'jane@example.com'];
      const results = createRegexDetections(terms, 'email');

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        text: 'john@example.com',
        type: 'email',
        confidence: 1.0,
        source: 'regex'
      });
    });

    it('should handle empty array', () => {
      const results = createRegexDetections([], 'email');
      expect(results).toHaveLength(0);
    });
  });

  describe('mlEntitiesToDetections', () => {
    it('should convert ML entities to detection results', () => {
      const entities: MLEntity[] = [
        {
          text: 'John Doe',
          entity: 'PER',
          score: 0.95,
          start: 0,
          end: 8
        },
        {
          text: 'Acme Corp',
          entity: 'ORG',
          score: 0.88,
          start: 18,
          end: 27
        }
      ];

      const results = mlEntitiesToDetections(entities);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        text: 'John Doe',
        type: 'person',
        confidence: 0.95,
        source: 'ml',
        positions: { start: 0, end: 8 }
      });
      expect(results[1]).toEqual({
        text: 'Acme Corp',
        type: 'organization',
        confidence: 0.88,
        source: 'ml',
        positions: { start: 18, end: 27 }
      });
    });
  });

  describe('mergeDetections', () => {
    it('should merge regex and ML detections without duplicates', () => {
      const regexResults: DetectionResult[] = [
        {
          text: 'john@example.com',
          type: 'email',
          confidence: 1.0,
          source: 'regex'
        }
      ];

      const mlResults: DetectionResult[] = [
        {
          text: 'John Doe',
          type: 'person',
          confidence: 0.95,
          source: 'ml',
          positions: { start: 0, end: 8 }
        }
      ];

      const merged = mergeDetections(regexResults, mlResults);

      expect(merged).toHaveLength(2);
      expect(merged.map(r => r.text)).toContain('john@example.com');
      expect(merged.map(r => r.text)).toContain('John Doe');
    });

    it('should remove exact duplicates', () => {
      const regexResults: DetectionResult[] = [
        {
          text: 'john@example.com',
          type: 'email',
          confidence: 1.0,
          source: 'regex'
        }
      ];

      const mlResults: DetectionResult[] = [
        {
          text: 'john@example.com',
          type: 'email',
          confidence: 0.9,
          source: 'ml',
          positions: { start: 0, end: 16 }
        }
      ];

      const merged = mergeDetections(regexResults, mlResults);

      // Should keep only one (the higher confidence one - regex)
      expect(merged).toHaveLength(1);
      expect(merged[0].source).toBe('regex');
      expect(merged[0].confidence).toBe(1.0);
    });

    it('should prefer higher confidence when overlapping', () => {
      const regexResults: DetectionResult[] = [
        {
          text: 'John',
          type: 'person',
          confidence: 1.0,
          source: 'regex',
          positions: { start: 0, end: 4 }
        }
      ];

      const mlResults: DetectionResult[] = [
        {
          text: 'John Doe',
          type: 'person',
          confidence: 0.95,
          source: 'ml',
          positions: { start: 0, end: 8 }
        }
      ];

      const merged = mergeDetections(regexResults, mlResults);

      // Should keep only the higher confidence one
      expect(merged).toHaveLength(1);
      expect(merged[0].text).toBe('John');
      expect(merged[0].confidence).toBe(1.0);
    });

    it('should handle position overlaps correctly', () => {
      const regexResults: DetectionResult[] = [];
      const mlResults: DetectionResult[] = [
        {
          text: 'John Doe',
          type: 'person',
          confidence: 0.95,
          source: 'ml',
          positions: { start: 0, end: 8 }
        },
        {
          text: 'Doe',
          type: 'person',
          confidence: 0.85,
          source: 'ml',
          positions: { start: 5, end: 8 }
        }
      ];

      const merged = mergeDetections(regexResults, mlResults);

      // Should remove the lower confidence overlapping detection
      expect(merged).toHaveLength(1);
      expect(merged[0].text).toBe('John Doe');
    });

    it('should keep non-overlapping detections', () => {
      const regexResults: DetectionResult[] = [];
      const mlResults: DetectionResult[] = [
        {
          text: 'John Doe',
          type: 'person',
          confidence: 0.95,
          source: 'ml',
          positions: { start: 0, end: 8 }
        },
        {
          text: 'Jane Smith',
          type: 'person',
          confidence: 0.92,
          source: 'ml',
          positions: { start: 20, end: 30 }
        }
      ];

      const merged = mergeDetections(regexResults, mlResults);

      expect(merged).toHaveLength(2);
    });
  });

  describe('extractTerms', () => {
    it('should extract text from detection results', () => {
      const results: DetectionResult[] = [
        {
          text: 'john@example.com',
          type: 'email',
          confidence: 1.0,
          source: 'regex'
        },
        {
          text: 'John Doe',
          type: 'person',
          confidence: 0.95,
          source: 'ml',
          positions: { start: 0, end: 8 }
        }
      ];

      const terms = extractTerms(results);

      expect(terms).toEqual(['john@example.com', 'John Doe']);
    });
  });

  describe('groupByType', () => {
    it('should group detections by type', () => {
      const results: DetectionResult[] = [
        {
          text: 'john@example.com',
          type: 'email',
          confidence: 1.0,
          source: 'regex'
        },
        {
          text: 'jane@example.com',
          type: 'email',
          confidence: 1.0,
          source: 'regex'
        },
        {
          text: 'John Doe',
          type: 'person',
          confidence: 0.95,
          source: 'ml',
          positions: { start: 0, end: 8 }
        }
      ];

      const grouped = groupByType(results);

      expect(grouped.size).toBe(2);
      expect(grouped.get('email')).toHaveLength(2);
      expect(grouped.get('person')).toHaveLength(1);
    });
  });

  describe('getDetectionStats', () => {
    it('should calculate detection statistics', () => {
      const results: DetectionResult[] = [
        {
          text: 'john@example.com',
          type: 'email',
          confidence: 1.0,
          source: 'regex'
        },
        {
          text: 'jane@example.com',
          type: 'email',
          confidence: 1.0,
          source: 'regex'
        },
        {
          text: 'John Doe',
          type: 'person',
          confidence: 0.9,
          source: 'ml',
          positions: { start: 0, end: 8 }
        }
      ];

      const stats = getDetectionStats(results);

      expect(stats.total).toBe(3);
      expect(stats.byType).toEqual({
        email: 2,
        person: 1
      });
      expect(stats.bySource).toEqual({
        regex: 2,
        ml: 1
      });
      expect(stats.avgConfidence).toBeCloseTo(0.967, 2);
    });

    it('should handle empty results', () => {
      const stats = getDetectionStats([]);

      expect(stats.total).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.bySource).toEqual({});
      expect(stats.avgConfidence).toBe(0);
    });
  });
});

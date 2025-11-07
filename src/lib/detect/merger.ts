import type { MLEntity } from './ml';
import { combineConfidences } from './hybrid';

/**
 * Detection result with metadata
 */
export interface DetectionResult {
  /** The detected text/term */
  text: string;
  /** Detection type (email, phone, ssn, card, person, org, loc, etc.) */
  type: string;
  /** Confidence score 0-1 (1 for regex, variable for ML) */
  confidence: number;
  /** Source of detection */
  source: 'regex' | 'ml';
  /** Character positions (for ML detections) */
  positions?: { start: number; end: number };
}

/**
 * Merge ML and regex detection results
 * Deduplicates overlapping detections and prioritizes higher confidence
 */
export function mergeDetections(
  regexResults: DetectionResult[],
  mlResults: DetectionResult[]
): DetectionResult[] {
  const allResults = [...regexResults, ...mlResults];

  if (allResults.length === 0) {
    return [];
  }

  // Sort by position (if available) to group nearby detections
  const sorted = allResults.sort((a, b) => {
    if (a.positions && b.positions) {
      return a.positions.start - b.positions.start;
    }
    return 0;
  });

  const merged: DetectionResult[] = [];
  const seen = new Set<string>();

  for (const result of sorted) {
    const normalizedText = normalizeText(result.text);

    // Skip if we've seen this exact text
    if (seen.has(normalizedText)) {
      continue;
    }

    // Check for overlapping detections
    let shouldAdd = true;
    let replacementIndex = -1;

    for (let i = 0; i < merged.length; i++) {
      const existing = merged[i];

      if (isOverlapping(result, existing)) {
        // If overlap detected, keep the one with higher confidence
        if (result.confidence > existing.confidence) {
          replacementIndex = i;
        } else {
          shouldAdd = false;
        }
        break;
      }
    }

    if (replacementIndex >= 0) {
      // Both detections found same entity - combine confidences
      const existing = merged[replacementIndex];
      const combined = combineConfidences(existing.confidence, result.confidence);

      // Keep the detection with more information (prefer regex for type accuracy)
      const better = existing.source === 'regex' ? existing : result;

      merged[replacementIndex] = {
        ...better,
        confidence: combined // Use combined confidence
      };

      seen.delete(normalizeText(existing.text));
      seen.add(normalizedText);
    } else if (shouldAdd) {
      merged.push(result);
      seen.add(normalizedText);
    }
  }

  return merged;
}

/**
 * Check if two detections overlap (same or similar text, or overlapping positions)
 */
function isOverlapping(a: DetectionResult, b: DetectionResult): boolean {
  const normA = normalizeText(a.text);
  const normB = normalizeText(b.text);

  // Exact match (case-insensitive)
  if (normA === normB) {
    return true;
  }

  // One contains the other
  if (normA.includes(normB) || normB.includes(normA)) {
    return true;
  }

  // Check position overlap (if both have positions)
  if (a.positions && b.positions) {
    const aStart = a.positions.start;
    const aEnd = a.positions.end;
    const bStart = b.positions.start;
    const bEnd = b.positions.end;

    // Check if ranges overlap
    const overlap = aStart <= bEnd && bStart <= aEnd;
    if (overlap) {
      return true;
    }
  }

  return false;
}

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Convert ML entities to detection results
 */
export function mlEntitiesToDetections(entities: MLEntity[]): DetectionResult[] {
  return entities.map(entity => ({
    text: entity.text,
    type: mapMLEntityType(entity.entity),
    confidence: entity.score,
    source: 'ml' as const,
    positions: {
      start: entity.start,
      end: entity.end
    }
  }));
}

/**
 * Map ML entity types to our detection types
 */
function mapMLEntityType(entityType: string): string {
  switch (entityType) {
    case 'PER':
      return 'person';
    case 'ORG':
      return 'organization';
    case 'LOC':
      return 'location';
    case 'MISC':
      return 'misc';
    default:
      return 'unknown';
  }
}

/**
 * Create regex detection results from simple string arrays
 */
export function createRegexDetections(
  terms: string[],
  type: string
): DetectionResult[] {
  return terms.map(text => ({
    text,
    type,
    confidence: 1.0,
    source: 'regex' as const
  }));
}

/**
 * Extract just the text terms from detection results
 * (for compatibility with existing findTextBoxes logic)
 */
export function extractTerms(results: DetectionResult[]): string[] {
  return results.map(r => r.text);
}

/**
 * Group detections by type for display
 */
export function groupByType(results: DetectionResult[]): Map<string, DetectionResult[]> {
  const grouped = new Map<string, DetectionResult[]>();

  for (const result of results) {
    const existing = grouped.get(result.type) || [];
    existing.push(result);
    grouped.set(result.type, existing);
  }

  return grouped;
}

/**
 * Get detection statistics
 */
export interface DetectionStats {
  total: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  avgConfidence: number;
}

export function getDetectionStats(results: DetectionResult[]): DetectionStats {
  const byType: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let totalConfidence = 0;

  for (const result of results) {
    byType[result.type] = (byType[result.type] || 0) + 1;
    bySource[result.source] = (bySource[result.source] || 0) + 1;
    totalConfidence += result.confidence;
  }

  return {
    total: results.length,
    byType,
    bySource,
    avgConfidence: results.length > 0 ? totalConfidence / results.length : 0
  };
}

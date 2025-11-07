import type { MLEntity } from './ml';
import type { DetectionResult } from './merger';
import { validateNumericPII } from './validation';
import { EMAIL, PHONE, SSN } from './patterns';
import { luhnCheck } from './luhn';

/**
 * Hybrid detection strategy: use regex patterns to guide and validate ML detections
 * Results in better accuracy with fewer false positives
 */

/**
 * Cross-validate ML detections with regex patterns
 * If an ML detection matches a regex pattern, boost confidence and reclassify type
 *
 * @param mlEntities - Entities detected by ML
 * @param fullText - Full text for pattern matching
 * @returns Enhanced entities with cross-validation
 */
export function crossValidateWithRegex(
  mlEntities: MLEntity[],
  fullText: string
): MLEntity[] {
  return mlEntities.map(entity => {
    // Check if entity matches any regex patterns
    const entityText = entity.text;

    // Email validation
    if (EMAIL.test(entityText)) {
      return {
        ...entity,
        entity: 'EMAIL', // Reclassify
        score: 1.0 // Regex is definitive
      };
    }

    // Phone validation
    if (PHONE.test(entityText)) {
      return {
        ...entity,
        entity: 'PHONE',
        score: 1.0
      };
    }

    // SSN validation
    if (SSN.test(entityText)) {
      return {
        ...entity,
        entity: 'SSN',
        score: 1.0
      };
    }

    // Numeric PII validation (cards, etc.)
    const numericValidation = validateNumericPII(entityText);
    if (numericValidation.isValid) {
      return {
        ...entity,
        entity: numericValidation.type.toUpperCase(),
        score: 1.0
      };
    }

    // No regex match - return as-is
    return entity;
  });
}

/**
 * Guide ML detection by identifying PII-likely regions with regex
 * Run ML on regions that regex flags as potentially containing PII
 *
 * @param text - Full text to analyze
 * @param regexResults - Pre-computed regex detection results
 * @returns Regions of text that likely contain PII
 */
export function identifyPIIRegions(
  text: string,
  regexResults: DetectionResult[]
): { start: number; end: number; text: string }[] {
  if (regexResults.length === 0) {
    // No regex hits - scan entire text
    return [{ start: 0, end: text.length, text }];
  }

  const regions: { start: number; end: number; text: string }[] = [];
  const CONTEXT_RADIUS = 150; // Characters before/after regex match to include

  for (const result of regexResults) {
    // Find position of this result in text
    if (!result.positions) {
      // If no position info, try to find it
      const index = text.indexOf(result.text);
      if (index === -1) continue;

      const start = Math.max(0, index - CONTEXT_RADIUS);
      const end = Math.min(text.length, index + result.text.length + CONTEXT_RADIUS);

      regions.push({
        start,
        end,
        text: text.substring(start, end)
      });
    } else {
      const start = Math.max(0, result.positions.start - CONTEXT_RADIUS);
      const end = Math.min(text.length, result.positions.end + CONTEXT_RADIUS);

      regions.push({
        start,
        end,
        text: text.substring(start, end)
      });
    }
  }

  // Merge overlapping regions
  const merged = mergeOverlappingRegions(regions);
  console.log(`[Hybrid] Identified ${merged.length} PII-likely regions from ${regexResults.length} regex hits`);

  return merged;
}

/**
 * Merge overlapping regions
 */
function mergeOverlappingRegions(
  regions: { start: number; end: number; text: string }[]
): { start: number; end: number; text: string }[] {
  if (regions.length === 0) return [];

  // Sort by start position
  const sorted = regions.slice().sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number; text: string }[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      // Overlapping - merge
      last.end = Math.max(last.end, current.end);
      // Note: text will be recomputed later if needed
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Smart merging strategy for regex and ML results
 * More sophisticated than simple deduplication
 *
 * Strategy:
 * 1. Regex detections (email/phone/SSN/card) always kept (high confidence)
 * 2. ML detections (names/orgs) kept if not already covered by regex
 * 3. Overlapping detections: prefer higher confidence
 * 4. Expand boxes to include both if partially overlapping
 */
export function smartMerge(
  regexResults: DetectionResult[],
  mlResults: DetectionResult[]
): DetectionResult[] {
  const merged: DetectionResult[] = [];

  // Priority 1: Add all regex results (high confidence, specific patterns)
  merged.push(...regexResults);

  // Priority 2: Add ML results that don't overlap with regex
  for (const mlResult of mlResults) {
    let shouldAdd = true;
    let mergeWithIndex = -1;

    for (let i = 0; i < merged.length; i++) {
      const existing = merged[i];

      // Check for overlap
      if (isOverlapping(mlResult, existing)) {
        // If ML detection is inside a regex detection, skip it
        if (existing.source === 'regex') {
          shouldAdd = false;
          break;
        }

        // If both are ML, keep higher confidence
        if (mlResult.confidence > existing.confidence) {
          mergeWithIndex = i;
          break;
        } else {
          shouldAdd = false;
          break;
        }
      }
    }

    if (mergeWithIndex >= 0) {
      // Replace lower confidence detection
      merged[mergeWithIndex] = mlResult;
    } else if (shouldAdd) {
      merged.push(mlResult);
    }
  }

  console.log(`[Hybrid] Smart merge: ${regexResults.length} regex + ${mlResults.length} ML → ${merged.length} total`);
  return merged;
}

/**
 * Check if two detections overlap
 */
function isOverlapping(a: DetectionResult, b: DetectionResult): boolean {
  // Text-based overlap check
  const normA = a.text.toLowerCase().trim();
  const normB = b.text.toLowerCase().trim();

  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) return true;

  // Position-based overlap check
  if (a.positions && b.positions) {
    const aStart = a.positions.start;
    const aEnd = a.positions.end;
    const bStart = b.positions.start;
    const bEnd = b.positions.end;

    return aStart <= bEnd && bStart <= aEnd;
  }

  return false;
}

/**
 * Boost ML confidence when regex patterns appear nearby
 * Helps identify person names near "Name:", etc.
 */
export function boostMLNearRegex(
  mlResults: DetectionResult[],
  regexResults: DetectionResult[],
  proximityThreshold: number = 50
): DetectionResult[] {
  return mlResults.map(mlResult => {
    if (!mlResult.positions) return mlResult;

    // Check if any regex result is nearby
    for (const regexResult of regexResults) {
      if (!regexResult.positions) continue;

      const distance = Math.min(
        Math.abs(mlResult.positions.start - regexResult.positions.end),
        Math.abs(regexResult.positions.start - mlResult.positions.end)
      );

      if (distance <= proximityThreshold) {
        // Regex pattern nearby - boost ML confidence
        return {
          ...mlResult,
          confidence: Math.min(1.0, mlResult.confidence * 1.2) // +20% boost
        };
      }
    }

    return mlResult;
  });
}

/**
 * Pattern-guided ML detection
 * Use regex patterns to focus ML attention on promising regions
 *
 * @param text - Full text to analyze
 * @param mlDetector - ML detection function
 * @param regexResults - Pre-computed regex results
 * @param minConfidence - Minimum confidence threshold
 * @returns Combined detection results
 */
export async function patternGuidedDetection(
  text: string,
  mlDetector: (text: string, minConfidence: number) => Promise<MLEntity[]>,
  regexResults: DetectionResult[],
  minConfidence: number = 0.7
): Promise<DetectionResult[]> {
  console.log('[Hybrid] Starting pattern-guided detection');

  // Step 1: Identify PII-likely regions around regex hits
  const regions = identifyPIIRegions(text, regexResults);

  // Step 2: Run ML on each region
  const mlEntities: MLEntity[] = [];
  for (const region of regions) {
    const entities = await mlDetector(region.text, minConfidence);

    // Adjust positions to original text
    const adjusted = entities.map(entity => ({
      ...entity,
      start: entity.start + region.start,
      end: entity.end + region.start
    }));

    mlEntities.push(...adjusted);
  }

  // Step 3: Cross-validate ML results with regex
  const validatedML = crossValidateWithRegex(mlEntities, text);

  // Step 4: Convert to DetectionResults
  const mlResults: DetectionResult[] = validatedML.map(entity => ({
    text: entity.text,
    type: entity.entity.toLowerCase(),
    confidence: entity.score,
    source: 'ml' as const,
    positions: {
      start: entity.start,
      end: entity.end
    }
  }));

  // Step 5: Boost ML confidence near regex patterns
  const boostedML = boostMLNearRegex(mlResults, regexResults);

  // Step 6: Smart merge
  const merged = smartMerge(regexResults, boostedML);

  console.log(`[Hybrid] Pattern-guided detection complete: ${merged.length} total detections`);
  return merged;
}

/**
 * Confidence combination for overlapping detections
 * When both regex and ML detect the same entity
 */
export function combineConfidences(
  regexConfidence: number,
  mlConfidence: number
): number {
  // Independent probability combination
  // P(combined) = 1 - (1 - P(regex)) * (1 - P(ML))
  return 1 - (1 - regexConfidence) * (1 - mlConfidence);
}

/**
 * Full hybrid detection pipeline
 * Combines all hybrid strategies for maximum accuracy
 */
export async function hybridDetection(
  text: string,
  mlDetector: (text: string, minConfidence: number) => Promise<MLEntity[]>,
  regexResults: DetectionResult[],
  minConfidence: number = 0.7,
  usePatternGuidance: boolean = true
): Promise<DetectionResult[]> {
  if (usePatternGuidance && regexResults.length > 0) {
    // Use pattern-guided detection (more efficient)
    return patternGuidedDetection(text, mlDetector, regexResults, minConfidence);
  } else {
    // Full document scan
    const mlEntities = await mlDetector(text, minConfidence);

    // Cross-validate
    const validated = crossValidateWithRegex(mlEntities, text);

    // Convert to DetectionResults
    const mlResults: DetectionResult[] = validated.map(entity => ({
      text: entity.text,
      type: entity.entity.toLowerCase(),
      confidence: entity.score,
      source: 'ml' as const,
      positions: {
        start: entity.start,
        end: entity.end
      }
    }));

    // Smart merge
    return smartMerge(regexResults, mlResults);
  }
}

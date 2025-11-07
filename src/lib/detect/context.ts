import type { MLEntity } from './ml';
import { hasNearbyPIILabel } from './validation';

/**
 * Text window for context-aware detection
 */
interface TextWindow {
  /** Window text content */
  text: string;
  /** Start position in original text */
  start: number;
  /** End position in original text */
  end: number;
  /** Window index */
  index: number;
}

/**
 * Create overlapping text windows for context-aware detection
 * Prevents boundary issues where entities are split across windows
 *
 * @param text - Full text to process
 * @param windowSize - Size of each window in characters
 * @param overlapRatio - Overlap between windows (0.0-1.0)
 * @returns Array of text windows
 */
export function createOverlappingWindows(
  text: string,
  windowSize: number = 512,
  overlapRatio: number = 0.25
): TextWindow[] {
  if (text.length <= windowSize) {
    // Text fits in single window
    return [{
      text,
      start: 0,
      end: text.length,
      index: 0
    }];
  }

  const windows: TextWindow[] = [];
  const stride = Math.floor(windowSize * (1 - overlapRatio));
  let position = 0;
  let index = 0;

  while (position < text.length) {
    const end = Math.min(position + windowSize, text.length);
    const windowText = text.substring(position, end);

    windows.push({
      text: windowText,
      start: position,
      end,
      index
    });

    // Move to next window
    position += stride;
    index++;

    // Break if we've reached the end
    if (end === text.length) {
      break;
    }
  }

  console.log(`[Context] Created ${windows.length} windows (size: ${windowSize}, overlap: ${overlapRatio * 100}%)`);
  return windows;
}

/**
 * Deduplicate entities across overlapping windows
 * Keeps the entity with highest confidence when duplicates are found
 *
 * @param windowResults - Array of entity arrays (one per window)
 * @param windows - The windows used for detection
 * @returns Deduplicated entities with corrected positions
 */
export function deduplicateAcrossWindows(
  windowResults: MLEntity[][],
  windows: TextWindow[]
): MLEntity[] {
  // Adjust positions to original text coordinates
  const allEntities: MLEntity[] = [];

  for (let i = 0; i < windowResults.length; i++) {
    const entities = windowResults[i];
    const window = windows[i];

    // Adjust positions relative to original text
    const adjusted = entities.map(entity => ({
      ...entity,
      start: entity.start + window.start,
      end: entity.end + window.start
    }));

    allEntities.push(...adjusted);
  }

  // Sort by start position
  allEntities.sort((a, b) => a.start - b.start);

  // Deduplicate overlapping entities
  const deduplicated: MLEntity[] = [];
  const seen = new Set<string>();

  for (const entity of allEntities) {
    // Create a unique key based on position and text
    const key = `${entity.start}-${entity.end}-${entity.text.toLowerCase()}`;

    // Check for exact duplicates
    if (seen.has(key)) {
      continue;
    }

    // Check for overlapping entities
    let isDuplicate = false;
    for (let i = deduplicated.length - 1; i >= 0; i--) {
      const existing = deduplicated[i];

      // Check if entities overlap
      if (existing.end <= entity.start) {
        break; // No more overlaps possible (sorted by start)
      }

      const overlap = existing.start <= entity.end && entity.start <= existing.end;
      const textMatch = existing.text.toLowerCase() === entity.text.toLowerCase();

      if (overlap && textMatch) {
        // Same entity detected in overlapping windows
        // Keep the one with higher confidence
        if (entity.score > existing.score) {
          deduplicated[i] = entity;
        }
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      deduplicated.push(entity);
      seen.add(key);
    }
  }

  console.log(`[Context] Deduplicated ${allEntities.length} entities to ${deduplicated.length}`);
  return deduplicated;
}

/**
 * Boost entity confidence based on contextual signals
 *
 * @param entity - Entity to enhance
 * @param fullText - Full text for context analysis
 * @returns Entity with boosted confidence
 */
export function boostContextualConfidence(entity: MLEntity, fullText: string): MLEntity {
  let boost = 1.0;

  // Boost if near PII-indicative labels (form fields, etc.)
  if (hasNearbyPIILabel(entity, fullText)) {
    boost *= 1.25; // +25% boost
    console.log(`[Context] Boosted "${entity.text}" near PII label (+25%)`);
  }

  // Boost if multiple PII types appear nearby
  const nearbyPIICount = countNearbyPII(entity, fullText);
  if (nearbyPIICount >= 2) {
    boost *= 1.15; // +15% boost
    console.log(`[Context] Boosted "${entity.text}" with ${nearbyPIICount} nearby PII (+15%)`);
  }

  // Cap at 1.0 (100% confidence)
  const newScore = Math.min(1.0, entity.score * boost);

  return {
    ...entity,
    score: newScore
  };
}

/**
 * Count how many other PII entities are near this entity
 * Helps identify document sections with high PII density
 */
function countNearbyPII(entity: MLEntity, fullText: string): number {
  const radius = 100; // Look within 100 characters
  const contextStart = Math.max(0, entity.start - radius);
  const contextEnd = Math.min(fullText.length, entity.end + radius);
  const context = fullText.substring(contextStart, contextEnd);

  let count = 0;

  // Common PII patterns
  const patterns = [
    /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, // Names (Title Case)
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Emails
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // Phones
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b(?:\d[ -]?){13,19}\b/g // Credit cards
  ];

  for (const pattern of patterns) {
    const matches = context.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }

  return count;
}

/**
 * Detect PII with context-aware windowing
 * More accurate for long documents
 *
 * @param text - Text to analyze
 * @param detector - ML detector function
 * @param minConfidence - Minimum confidence threshold
 * @param windowSize - Window size in characters
 * @returns Detected entities with context-aware enhancements
 */
export async function detectWithContext(
  text: string,
  detector: (text: string, minConfidence: number) => Promise<MLEntity[]>,
  minConfidence: number = 0.7,
  windowSize: number = 512
): Promise<MLEntity[]> {
  // Create overlapping windows
  const windows = createOverlappingWindows(text, windowSize, 0.25);

  console.log(`[Context] Processing ${windows.length} windows for ${text.length} characters`);

  // Detect entities in each window
  const windowResults = await Promise.all(
    windows.map(window => detector(window.text, minConfidence))
  );

  // Deduplicate across windows
  let entities = deduplicateAcrossWindows(windowResults, windows);

  // Apply contextual confidence boosting
  entities = entities.map(entity => boostContextualConfidence(entity, text));

  console.log(`[Context] Final result: ${entities.length} context-aware entities`);
  return entities;
}

/**
 * Analyze document structure to identify PII-rich sections
 * Useful for prioritizing detection efforts
 */
export interface DocumentSection {
  /** Section name */
  name: string;
  /** Start position */
  start: number;
  /** End position */
  end: number;
  /** Estimated PII density (0-1) */
  piiDensity: number;
}

/**
 * Identify sections of a document that likely contain PII
 * Based on heuristics (form fields, headers, etc.)
 */
export function identifyPIISections(text: string): DocumentSection[] {
  const sections: DocumentSection[] = [];

  // Look for form-like structures
  const formPatterns = [
    { pattern: /(?:name|email|phone|address|ssn|dob).*?[:=]/gi, name: 'Form Field' },
    { pattern: /\bsignature\b.*?(?:\n|$)/gi, name: 'Signature Block' },
    { pattern: /\bcontact information\b/gi, name: 'Contact Info' },
    { pattern: /\bpersonal data\b/gi, name: 'Personal Data' }
  ];

  for (const { pattern, name } of formPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const start = Math.max(0, match.index - 50);
      const end = Math.min(text.length, match.index + match[0].length + 200);

      // Calculate PII density in this section
      const sectionText = text.substring(start, end);
      const density = calculatePIIDensity(sectionText);

      sections.push({
        name,
        start,
        end,
        piiDensity: density
      });
    }
  }

  // Merge overlapping sections
  const merged = mergeSections(sections);
  console.log(`[Context] Identified ${merged.length} PII-rich sections`);

  return merged;
}

/**
 * Estimate PII density in a text section
 * Based on pattern matching
 */
function calculatePIIDensity(text: string): number {
  const piiPatterns = [
    /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, // Names
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Emails
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // Phones
    /\b\d{3}-\d{2}-\d{4}\b/g // SSN
  ];

  let matchCount = 0;
  for (const pattern of piiPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matchCount += matches.length;
    }
  }

  // Normalize by text length (matches per 100 characters)
  const density = (matchCount / text.length) * 100;
  return Math.min(1.0, density); // Cap at 1.0
}

/**
 * Merge overlapping sections
 */
function mergeSections(sections: DocumentSection[]): DocumentSection[] {
  if (sections.length === 0) return [];

  // Sort by start position
  sections.sort((a, b) => a.start - b.start);

  const merged: DocumentSection[] = [sections[0]];

  for (let i = 1; i < sections.length; i++) {
    const current = sections[i];
    const last = merged[merged.length - 1];

    // Check if sections overlap
    if (current.start <= last.end) {
      // Merge sections
      last.end = Math.max(last.end, current.end);
      last.piiDensity = Math.max(last.piiDensity, current.piiDensity);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

import type { MLEntity } from './ml';
import { luhnCheck } from './luhn';
import { EMAIL, PHONE, SSN } from './patterns';

/**
 * Common words that are often false positives for person names
 * Compiled from frequent English words and document-specific terms
 */
const COMMON_WORDS = new Set([
  // Articles, prepositions, conjunctions
  'the', 'and', 'but', 'with', 'from', 'about', 'into', 'through',
  'after', 'before', 'between', 'under', 'over', 'above', 'below',

  // Common verbs
  'said', 'will', 'would', 'could', 'should', 'may', 'might',
  'make', 'made', 'take', 'took', 'give', 'gave', 'find', 'found',

  // Document-specific terms
  'page', 'pages', 'section', 'chapter', 'paragraph', 'line', 'document',
  'contract', 'agreement', 'policy', 'terms', 'conditions', 'notice',
  'copyright', 'rights', 'reserved', 'permission', 'authorized',
  'resume', 'curriculum', 'vitae', 'cv', 'cover', 'letter', 'application',
  'reference', 'references', 'education', 'experience', 'skills',

  // Placeholder-related words (but not actual names)
  'example', 'sample', 'placeholder', 'lorem ipsum',

  // Time/date words often misclassified
  'january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',

  // Common organization words (not names themselves)
  'company', 'corporation', 'incorporated', 'limited', 'llc', 'inc',
  'office', 'department', 'division', 'branch', 'agency', 'bureau',

  // Misc common false positives
  'hereby', 'therefore', 'whereas', 'furthermore', 'moreover',
  'however', 'nevertheless', 'notwithstanding'
]);

/**
 * Patterns that indicate false positives in context
 * Only reject entities that appear in these specific contexts
 */
const FALSE_POSITIVE_PATTERNS = [
  // Copyright/license placeholders with "John Doe" or "Jane Doe"
  /©.*?(john doe|jane doe)/i,
  /copyright.*?(john doe|jane doe)/i,

  // Lorem ipsum text (reject entities within lorem ipsum blocks)
  /(lorem ipsum|dolor sit amet)/i,

  // Template/example markers
  /\[(example|sample|placeholder|your name here|john doe|jane doe)\]/i,
  /(example|sample).*?(:).*?(john doe|jane doe|john smith|jane smith)/i,

  // Common document headers/footers (reject if entity is just a page number, etc.)
  /(page \d+ of \d+)/i
];

/**
 * Placeholder name patterns - reject only when in placeholder context
 */
const PLACEHOLDER_NAMES = new Set([
  'john doe',
  'jane doe',
  'john smith',
  'jane smith'
]);

/**
 * Common first names for validation (top 100 US names)
 * Helps boost confidence for name detection
 */
const COMMON_FIRST_NAMES = new Set([
  'james', 'mary', 'john', 'patricia', 'robert', 'jennifer', 'michael', 'linda',
  'william', 'barbara', 'david', 'elizabeth', 'richard', 'susan', 'joseph', 'jessica',
  'thomas', 'sarah', 'charles', 'karen', 'christopher', 'nancy', 'daniel', 'lisa',
  'matthew', 'betty', 'anthony', 'margaret', 'mark', 'sandra', 'donald', 'ashley',
  'steven', 'kimberly', 'paul', 'emily', 'andrew', 'donna', 'joshua', 'michelle',
  'kenneth', 'dorothy', 'kevin', 'carol', 'brian', 'amanda', 'george', 'melissa',
  'edward', 'deborah', 'ronald', 'stephanie', 'timothy', 'rebecca', 'jason', 'sharon',
  'jeffrey', 'laura', 'ryan', 'cynthia', 'jacob', 'kathleen', 'gary', 'amy',
  'nicholas', 'shirley', 'eric', 'angela', 'jonathan', 'helen', 'stephen', 'anna',
  'larry', 'brenda', 'justin', 'pamela', 'scott', 'nicole', 'brandon', 'emma',
  'benjamin', 'samantha', 'samuel', 'katherine', 'raymond', 'christine', 'gregory', 'debra'
]);

/**
 * Title patterns that indicate a person name follows
 */
const TITLE_PATTERNS = /\b(Dr|Mr|Mrs|Ms|Miss|Prof|Professor|CEO|President|Director|Manager|Vice|Chief|Senior|Junior|Sr|Jr)\.?\s*/i;

/**
 * Validate an ML entity and filter false positives
 * @param entity - The entity to validate
 * @param fullText - The full text containing the entity (for context)
 * @returns true if entity is likely valid, false if likely false positive
 */
export function validateMLEntity(entity: MLEntity, fullText: string): boolean {
  const normalizedText = entity.text.toLowerCase().trim();

  // Filter by entity type
  switch (entity.entity) {
    case 'PER':
      return validatePersonName(entity, normalizedText, fullText);
    case 'ORG':
      return validateOrganization(entity, normalizedText, fullText);
    case 'LOC':
      return validateLocation(entity, normalizedText, fullText);
    case 'MISC':
      return validateMisc(entity, normalizedText, fullText);
    default:
      return true; // Unknown types pass through
  }
}

/**
 * Validate person name entities
 */
function validatePersonName(entity: MLEntity, normalizedText: string, fullText: string): boolean {
  // Reject if too short (single letter or very short)
  if (entity.text.length < 3) {
    return false;
  }

  // Reject if not capitalized (proper noun check)
  if (!/^[A-Z]/.test(entity.text)) {
    return false;
  }

  // Reject if in common words list
  if (COMMON_WORDS.has(normalizedText)) {
    return false;
  }

  // Reject if matches a regex pattern (likely email/phone, not a name)
  if (EMAIL.test(entity.text) || PHONE.test(entity.text) || SSN.test(entity.text)) {
    return false;
  }

  // Check context for false positive patterns
  const context = getContext(fullText, entity.start, entity.end, 50);
  if (FALSE_POSITIVE_PATTERNS.some(pattern => pattern.test(context))) {
    return false;
  }

  // Special handling for placeholder names - only reject in placeholder contexts
  if (PLACEHOLDER_NAMES.has(normalizedText)) {
    // Check if appears in placeholder context
    const placeholderContext = /\b(example|sample|placeholder|copyright|©|lorem ipsum|template)\b/i;
    if (placeholderContext.test(context)) {
      return false;
    }
    // Otherwise allow it (might be a real person named John Doe)
  }

  return true;
}

/**
 * Validate organization entities
 */
function validateOrganization(entity: MLEntity, normalizedText: string, fullText: string): boolean {
  // Reject if too short
  if (entity.text.length < 2) {
    return false;
  }

  // Reject common words
  if (COMMON_WORDS.has(normalizedText)) {
    return false;
  }

  return true;
}

/**
 * Validate location entities
 */
function validateLocation(entity: MLEntity, normalizedText: string, fullText: string): boolean {
  // Reject if too short
  if (entity.text.length < 2) {
    return false;
  }

  // Reject common words
  if (COMMON_WORDS.has(normalizedText)) {
    return false;
  }

  return true;
}

/**
 * Validate miscellaneous entities (very strict, high false positive rate)
 */
function validateMisc(entity: MLEntity, normalizedText: string, fullText: string): boolean {
  // MISC entities are often spurious, so be very strict

  // Reject if too short
  if (entity.text.length < 4) {
    return false;
  }

  // Reject common words
  if (COMMON_WORDS.has(normalizedText)) {
    return false;
  }

  // Reject if not capitalized
  if (!/^[A-Z]/.test(entity.text)) {
    return false;
  }

  return true;
}

/**
 * Enhance entity confidence based on contextual signals
 * @param entity - The entity to enhance
 * @param fullText - The full text containing the entity
 * @returns Enhanced entity with adjusted confidence
 */
export function enhanceEntityConfidence(entity: MLEntity, fullText: string): MLEntity {
  let confidenceMultiplier = 1.0;

  if (entity.entity === 'PER') {
    const normalizedText = entity.text.toLowerCase().trim();
    const words = entity.text.split(/\s+/);

    // Boost if contains common first name
    if (words.some(word => COMMON_FIRST_NAMES.has(word.toLowerCase()))) {
      confidenceMultiplier *= 1.15; // +15% boost
    }

    // Boost if near title
    const context = getContext(fullText, entity.start, entity.end, 30);
    if (TITLE_PATTERNS.test(context)) {
      confidenceMultiplier *= 1.2; // +20% boost
    }

    // Boost if multiple words (full name more reliable than single name)
    if (words.length >= 2) {
      confidenceMultiplier *= 1.1; // +10% boost
    }
  }

  // Cap at 1.0 (100% confidence)
  const newScore = Math.min(1.0, entity.score * confidenceMultiplier);

  return {
    ...entity,
    score: newScore
  };
}

/**
 * Get context around an entity (surrounding text)
 * @param fullText - The full text
 * @param start - Entity start position
 * @param end - Entity end position
 * @param radius - Number of characters before/after to include
 * @returns Context string
 */
function getContext(fullText: string, start: number, end: number, radius: number): string {
  const contextStart = Math.max(0, start - radius);
  const contextEnd = Math.min(fullText.length, end + radius);
  return fullText.substring(contextStart, contextEnd);
}

/**
 * Check if entity is near a PII-indicative label
 * Useful for form field detection
 */
export function hasNearbyPIILabel(entity: MLEntity, fullText: string): boolean {
  const PII_LABELS = [
    /\b(name|first name|last name|full name)s?\s*[:=]/i,
    /\b(ssn|social security)s?\s*[:=#]/i,
    /\b(phone|telephone|mobile|cell)s?\s*[:=#]/i,
    /\b(email|e-mail)s?\s*[:=@]/i,
    /\b(address|street|city|state|zip)s?\s*[:=]/i,
    /\b(dob|date of birth|birthday)s?\s*[:=/]/i,
    /\b(account|policy|member|customer)\s*(number|#|no\.?)s?\s*[:=#]/i
  ];

  const context = getContext(fullText, entity.start, entity.end, 50);
  return PII_LABELS.some(pattern => pattern.test(context));
}

/**
 * Validate numeric patterns detected by ML
 * Uses format-specific validation (Luhn for cards, format checks for SSN/phone)
 */
export function validateNumericPII(text: string): {
  isValid: boolean;
  type: 'ssn' | 'card' | 'phone' | 'unknown';
} {
  const digits = text.replace(/\D/g, '');

  // SSN: exactly 9 digits
  if (digits.length === 9 && /^\d{3}-?\d{2}-?\d{4}$/.test(text)) {
    return { isValid: true, type: 'ssn' };
  }

  // Credit card: 13-19 digits, Luhn valid
  if (digits.length >= 13 && digits.length <= 19 && luhnCheck(digits)) {
    return { isValid: true, type: 'card' };
  }

  // Phone: 10-15 digits
  if (digits.length >= 10 && digits.length <= 15) {
    return { isValid: true, type: 'phone' };
  }

  return { isValid: false, type: 'unknown' };
}

/**
 * Filter entities through validation pipeline
 * @param entities - Raw entities from ML
 * @param fullText - Full text for context
 * @returns Filtered and enhanced entities
 */
export function filterAndEnhanceEntities(
  entities: MLEntity[],
  fullText: string
): MLEntity[] {
  return entities
    .filter(entity => validateMLEntity(entity, fullText))
    .map(entity => enhanceEntityConfidence(entity, fullText));
}

import { luhnCheck } from './luhn';

/**
 * PII Detection patterns
 * Keep patterns simple to avoid ReDoS (Regular expression Denial of Service)
 * See OWASP guidance on regex safety
 */

// Email addresses (basic RFC 5322 simplified pattern)
export const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// Phone number patterns (US format primarily)
// Matches: +1.510-953-0626, (510) 953-0626, 510-953-0626, 5109530626, etc.
// Requires at least 10 digits to avoid false positives
export const PHONE = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g;

// E.164 phone format: + and up to 15 digits, starting 1-9 (with separators)
export const E164 = /\+?[1-9](?:[-.\s]?\d){9,14}\b/g;

// US SSN formats (XXX-XX-XXXX or XXXXXXXXX)
// Note: SSA randomized allocation in 2011; do not infer geography
export const SSN = /(?<!\d)(\d{3}-\d{2}-\d{4}|\d{9})(?!\d)/g;

/**
 * Find likely payment card numbers using Luhn validation
 * Looks for 13-19 digit sequences (with optional spaces/dashes) that pass Luhn check
 */
export function findLikelyPANs(text: string): string[] {
  // Flexible grouping: digits separated by space/dash/none
  const candidates = text.match(/\b(?:\d[ -]?){13,19}\b/g) || [];

  return candidates
    .map(s => s.replace(/[ -]/g, ''))
    .filter(d => d.length >= 13 && d.length <= 19 && luhnCheck(d));
}

/**
 * Find all emails in text
 */
export function findEmails(text: string): string[] {
  return Array.from(text.matchAll(EMAIL), m => m[0]);
}

/**
 * Find all phone numbers in text
 * Uses multiple patterns to catch various formats
 */
export function findPhones(text: string): string[] {
  const phonePattern = PHONE;
  const e164Pattern = E164;

  const phones = new Set<string>();

  // Try both patterns
  for (const match of text.matchAll(phonePattern)) {
    phones.add(match[0]);
  }

  for (const match of text.matchAll(e164Pattern)) {
    // Only add if it has at least 10 digits (avoid short numbers)
    const digitCount = match[0].replace(/\D/g, '').length;
    if (digitCount >= 10) {
      phones.add(match[0]);
    }
  }

  return Array.from(phones);
}

/**
 * Find all SSNs in text
 */
export function findSSNs(text: string): string[] {
  return Array.from(text.matchAll(SSN), m => m[0]);
}

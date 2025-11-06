import { luhnCheck } from './luhn';

/**
 * PII Detection patterns
 * Keep patterns simple to avoid ReDoS (Regular expression Denial of Service)
 * See OWASP guidance on regex safety
 */

// Email addresses (basic RFC 5322 simplified pattern)
export const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// E.164 phone format: + and up to 15 digits, starting 1-9
export const E164 = /\+?[1-9]\d{1,14}\b/g;

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
 */
export function findPhones(text: string): string[] {
  return Array.from(text.matchAll(E164), m => m[0]);
}

/**
 * Find all SSNs in text
 */
export function findSSNs(text: string): string[] {
  return Array.from(text.matchAll(SSN), m => m[0]);
}

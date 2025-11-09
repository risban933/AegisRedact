import { luhnCheck } from './luhn';
import { mlDetector, isMLAvailable } from './ml';
import {
  mergeDetections,
  createRegexDetections,
  mlEntitiesToDetections,
  extractTerms,
  type DetectionResult
} from './merger';
import { hybridDetection } from './hybrid';
import {
  findSWIFTCodes,
  findRoutingNumbers,
  findCLABE,
  findIBANs,
  findAccountNumbers as findFinancialAccounts
} from './patterns-financial';
import {
  findAllCryptoAddresses
} from './patterns-crypto';
import {
  findStockTickers,
  findCUSIPs,
  findISINs,
  findBrokerageAccounts
} from './patterns-investment';
import {
  findVATNumbers,
  findEuropeanIDs
} from './patterns-european';
import {
  findChineseIDs,
  findMyNumbers,
  findAadhaarNumbers,
  findTaiwaneseIDs,
  findSingaporeNRICs,
  findKoreanRRNs,
  findThaiIDs,
  findMalaysianNRICs
} from './patterns-asian';
import {
  findCPFs,
  findCURPs,
  findRUTs
} from './patterns-latam';

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

// Date patterns for birthdays and other sensitive dates
// Matches common date formats: MM/DD/YYYY, DD-MM-YYYY, Month DD YYYY, etc.
// Note: These patterns prioritize recall over precision for privacy protection
export const DATE_SLASH = /\b(0?[1-9]|1[0-2])[\/\-\.](0?[1-9]|[12]\d|3[01])[\/\-\.](19|20)\d{2}\b/g; // MM/DD/YYYY or DD/MM/YYYY
export const DATE_ISO = /\b(19|20)\d{2}[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](0?[1-9]|[12]\d|3[01])\b/g; // YYYY-MM-DD
export const DATE_WRITTEN = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(0?[1-9]|[12]\d|3[01]),?\s+(19|20)\d{2}\b/gi; // Month DD, YYYY
export const DATE_WRITTEN_REV = /\b(0?[1-9]|[12]\d|3[01])\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(19|20)\d{2}\b/gi; // DD Month YYYY
export const DOB_LABEL = /\b(DOB|D\.O\.B\.|Date of Birth|Birth Date|Birthday)[:\s]+(0?[1-9]|1[0-2])[\/\-\.](0?[1-9]|[12]\d|3[01])[\/\-\.](19|20)\d{2}\b/gi; // DOB: MM/DD/YYYY

// US Address patterns
// Street addresses: 123 Main St, 456 Oak Avenue, etc.
export const STREET_ADDRESS = /\b\d{1,6}\s+([A-Z][a-z]+\s+){1,4}(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Way|Place|Pl|Parkway|Pkwy|Terrace|Ter)\.?\b/gi;
// PO Boxes
export const PO_BOX = /\b(P\.?\s?O\.?\s+Box|Post Office Box)\s+\d{1,6}\b/gi;
// ZIP codes (5 digits or 5+4 format)
export const ZIP_CODE = /\b\d{5}(?:-\d{4})?\b/g;
// City, State ZIP pattern (more comprehensive address)
export const CITY_STATE_ZIP = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+(A[LKSZRAP]|C[AOT]|D[EC]|F[LM]|G[AU]|HI|I[ADLN]|K[SY]|LA|M[ADEHINOPST]|N[CDEHJMVY]|O[HKR]|P[ARW]|RI|S[CD]|T[NX]|UT|V[AIT]|W[AIVY])\s+\d{5}(?:-\d{4})?\b/g;

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

/**
 * Find all dates and birthdays in text
 * Combines multiple date formats to catch various representations
 */
export function findDates(text: string): string[] {
  const dates = new Set<string>();

  // Try all date patterns
  for (const match of text.matchAll(DATE_SLASH)) {
    dates.add(match[0]);
  }

  for (const match of text.matchAll(DATE_ISO)) {
    dates.add(match[0]);
  }

  for (const match of text.matchAll(DATE_WRITTEN)) {
    dates.add(match[0]);
  }

  for (const match of text.matchAll(DATE_WRITTEN_REV)) {
    dates.add(match[0]);
  }

  for (const match of text.matchAll(DOB_LABEL)) {
    dates.add(match[0]);
  }

  return Array.from(dates);
}

/**
 * Find all addresses in text
 * Combines street addresses, PO boxes, and full addresses
 */
export function findAddresses(text: string): string[] {
  const addresses = new Set<string>();

  // Street addresses
  for (const match of text.matchAll(STREET_ADDRESS)) {
    addresses.add(match[0]);
  }

  // PO Boxes
  for (const match of text.matchAll(PO_BOX)) {
    addresses.add(match[0]);
  }

  // City, State ZIP
  for (const match of text.matchAll(CITY_STATE_ZIP)) {
    addresses.add(match[0]);
  }

  // Also add standalone ZIP codes (but avoid duplicates)
  for (const match of text.matchAll(ZIP_CODE)) {
    // Only add if not already part of a larger address
    const zip = match[0];
    let alreadyIncluded = false;
    for (const addr of addresses) {
      if (addr.includes(zip)) {
        alreadyIncluded = true;
        break;
      }
    }
    if (!alreadyIncluded) {
      addresses.add(zip);
    }
  }

  return Array.from(addresses);
}

/**
 * Detection options for unified detection
 */
export interface DetectionOptions {
  findEmails: boolean;
  findPhones: boolean;
  findSSNs: boolean;
  findCards: boolean;
  findDates: boolean;
  findAddresses: boolean;
  useML: boolean;
  mlMinConfidence?: number;
  // Financial data
  findBankAccounts?: boolean;
  findCrypto?: boolean;
  findInvestments?: boolean;
  // International PII
  findEuropeanIDs?: boolean;
  findAsianIDs?: boolean;
  findLatAmIDs?: boolean;
}

/**
 * Unified PII detection using both regex and ML (if available)
 * Returns deduplicated list of detected terms
 *
 * @param text - Text to analyze
 * @param options - Detection options
 * @returns Array of unique detected terms
 */
export async function detectAllPII(
  text: string,
  options: DetectionOptions
): Promise<string[]> {
  const regexResults: DetectionResult[] = [];
  const mlResults: DetectionResult[] = [];

  // Run regex detection
  if (options.findEmails) {
    const emails = findEmails(text);
    regexResults.push(...createRegexDetections(emails, 'email'));
  }

  if (options.findPhones) {
    const phones = findPhones(text);
    regexResults.push(...createRegexDetections(phones, 'phone'));
  }

  if (options.findSSNs) {
    const ssns = findSSNs(text);
    regexResults.push(...createRegexDetections(ssns, 'ssn'));
  }

  if (options.findCards) {
    const cards = findLikelyPANs(text);
    regexResults.push(...createRegexDetections(cards, 'card'));
  }

  if (options.findDates) {
    const dates = findDates(text);
    regexResults.push(...createRegexDetections(dates, 'date'));
  }

  if (options.findAddresses) {
    const addresses = findAddresses(text);
    regexResults.push(...createRegexDetections(addresses, 'address'));
  }

  // Financial data detection
  if (options.findBankAccounts) {
    const swiftCodes = findSWIFTCodes(text);
    const routingNumbers = findRoutingNumbers(text);
    const clabe = findCLABE(text);
    const ibans = findIBANs(text);
    const accounts = findFinancialAccounts(text);

    regexResults.push(...createRegexDetections(swiftCodes, 'swift'));
    regexResults.push(...createRegexDetections(routingNumbers, 'routing'));
    regexResults.push(...createRegexDetections(clabe, 'clabe'));
    regexResults.push(...createRegexDetections(ibans, 'iban'));
    regexResults.push(...createRegexDetections(accounts, 'account'));
  }

  if (options.findCrypto) {
    const cryptoAddresses = findAllCryptoAddresses(text);
    regexResults.push(...createRegexDetections(cryptoAddresses, 'crypto'));
  }

  if (options.findInvestments) {
    const tickers = findStockTickers(text);
    const cusips = findCUSIPs(text);
    const isins = findISINs(text);
    const brokerageAccounts = findBrokerageAccounts(text);

    regexResults.push(...createRegexDetections(tickers, 'ticker'));
    regexResults.push(...createRegexDetections(cusips, 'cusip'));
    regexResults.push(...createRegexDetections(isins, 'isin'));
    regexResults.push(...createRegexDetections(brokerageAccounts, 'brokerage'));
  }

  // International PII detection
  if (options.findEuropeanIDs) {
    const vatNumbers = findVATNumbers(text);
    const europeanIDs = findEuropeanIDs(text);

    regexResults.push(...createRegexDetections(vatNumbers, 'vat'));
    regexResults.push(...createRegexDetections(europeanIDs, 'eu-id'));
  }

  if (options.findAsianIDs) {
    const chineseIDs = findChineseIDs(text);
    const myNumbers = findMyNumbers(text);
    const aadhaar = findAadhaarNumbers(text);
    const taiwaneseIDs = findTaiwaneseIDs(text);
    const singaporeNRICs = findSingaporeNRICs(text);
    const koreanRRNs = findKoreanRRNs(text);
    const thaiIDs = findThaiIDs(text);
    const malaysianNRICs = findMalaysianNRICs(text);

    regexResults.push(...createRegexDetections(chineseIDs, 'cn-id'));
    regexResults.push(...createRegexDetections(myNumbers, 'jp-mynumber'));
    regexResults.push(...createRegexDetections(aadhaar, 'in-aadhaar'));
    regexResults.push(...createRegexDetections(taiwaneseIDs, 'tw-id'));
    regexResults.push(...createRegexDetections(singaporeNRICs, 'sg-nric'));
    regexResults.push(...createRegexDetections(koreanRRNs, 'kr-rrn'));
    regexResults.push(...createRegexDetections(thaiIDs, 'th-id'));
    regexResults.push(...createRegexDetections(malaysianNRICs, 'my-nric'));
  }

  if (options.findLatAmIDs) {
    const cpfs = findCPFs(text);
    const curps = findCURPs(text);
    const ruts = findRUTs(text);

    regexResults.push(...createRegexDetections(cpfs, 'br-cpf'));
    regexResults.push(...createRegexDetections(curps, 'mx-curp'));
    regexResults.push(...createRegexDetections(ruts, 'cl-rut'));
  }

  // Run ML detection if enabled and available
  if (options.useML && isMLAvailable()) {
    try {
      const minConfidence = options.mlMinConfidence || 0.8;
      const entities = await mlDetector.detectEntities(text, minConfidence);
      mlResults.push(...mlEntitiesToDetections(entities));
    } catch (error) {
      console.error('[detectAllPII] ML detection failed:', error);
      // Continue with regex results only
    }
  }

  // Merge and deduplicate
  const merged = mergeDetections(regexResults, mlResults);

  // Extract just the text terms
  return extractTerms(merged);
}

/**
 * Get detailed detection results with metadata
 * Useful for debugging and showing confidence scores
 */
export async function detectAllPIIWithMetadata(
  text: string,
  options: DetectionOptions
): Promise<DetectionResult[]> {
  const regexResults: DetectionResult[] = [];
  const mlResults: DetectionResult[] = [];

  // Run regex detection
  if (options.findEmails) {
    const emails = findEmails(text);
    regexResults.push(...createRegexDetections(emails, 'email'));
  }

  if (options.findPhones) {
    const phones = findPhones(text);
    regexResults.push(...createRegexDetections(phones, 'phone'));
  }

  if (options.findSSNs) {
    const ssns = findSSNs(text);
    regexResults.push(...createRegexDetections(ssns, 'ssn'));
  }

  if (options.findCards) {
    const cards = findLikelyPANs(text);
    regexResults.push(...createRegexDetections(cards, 'card'));
  }

  if (options.findDates) {
    const dates = findDates(text);
    regexResults.push(...createRegexDetections(dates, 'date'));
  }

  if (options.findAddresses) {
    const addresses = findAddresses(text);
    regexResults.push(...createRegexDetections(addresses, 'address'));
  }

  // Financial data detection
  if (options.findBankAccounts) {
    const swiftCodes = findSWIFTCodes(text);
    const routingNumbers = findRoutingNumbers(text);
    const clabe = findCLABE(text);
    const ibans = findIBANs(text);
    const accounts = findFinancialAccounts(text);

    regexResults.push(...createRegexDetections(swiftCodes, 'swift'));
    regexResults.push(...createRegexDetections(routingNumbers, 'routing'));
    regexResults.push(...createRegexDetections(clabe, 'clabe'));
    regexResults.push(...createRegexDetections(ibans, 'iban'));
    regexResults.push(...createRegexDetections(accounts, 'account'));
  }

  if (options.findCrypto) {
    const cryptoAddresses = findAllCryptoAddresses(text);
    regexResults.push(...createRegexDetections(cryptoAddresses, 'crypto'));
  }

  if (options.findInvestments) {
    const tickers = findStockTickers(text);
    const cusips = findCUSIPs(text);
    const isins = findISINs(text);
    const brokerageAccounts = findBrokerageAccounts(text);

    regexResults.push(...createRegexDetections(tickers, 'ticker'));
    regexResults.push(...createRegexDetections(cusips, 'cusip'));
    regexResults.push(...createRegexDetections(isins, 'isin'));
    regexResults.push(...createRegexDetections(brokerageAccounts, 'brokerage'));
  }

  // International PII detection
  if (options.findEuropeanIDs) {
    const vatNumbers = findVATNumbers(text);
    const europeanIDs = findEuropeanIDs(text);

    regexResults.push(...createRegexDetections(vatNumbers, 'vat'));
    regexResults.push(...createRegexDetections(europeanIDs, 'eu-id'));
  }

  if (options.findAsianIDs) {
    const chineseIDs = findChineseIDs(text);
    const myNumbers = findMyNumbers(text);
    const aadhaar = findAadhaarNumbers(text);
    const taiwaneseIDs = findTaiwaneseIDs(text);
    const singaporeNRICs = findSingaporeNRICs(text);
    const koreanRRNs = findKoreanRRNs(text);
    const thaiIDs = findThaiIDs(text);
    const malaysianNRICs = findMalaysianNRICs(text);

    regexResults.push(...createRegexDetections(chineseIDs, 'cn-id'));
    regexResults.push(...createRegexDetections(myNumbers, 'jp-mynumber'));
    regexResults.push(...createRegexDetections(aadhaar, 'in-aadhaar'));
    regexResults.push(...createRegexDetections(taiwaneseIDs, 'tw-id'));
    regexResults.push(...createRegexDetections(singaporeNRICs, 'sg-nric'));
    regexResults.push(...createRegexDetections(koreanRRNs, 'kr-rrn'));
    regexResults.push(...createRegexDetections(thaiIDs, 'th-id'));
    regexResults.push(...createRegexDetections(malaysianNRICs, 'my-nric'));
  }

  if (options.findLatAmIDs) {
    const cpfs = findCPFs(text);
    const curps = findCURPs(text);
    const ruts = findRUTs(text);

    regexResults.push(...createRegexDetections(cpfs, 'br-cpf'));
    regexResults.push(...createRegexDetections(curps, 'mx-curp'));
    regexResults.push(...createRegexDetections(ruts, 'cl-rut'));
  }

  // Run ML detection if enabled and available
  if (options.useML && isMLAvailable()) {
    try {
      const minConfidence = options.mlMinConfidence || 0.8;
      const entities = await mlDetector.detectEntities(text, minConfidence);
      mlResults.push(...mlEntitiesToDetections(entities));
    } catch (error) {
      console.error('[detectAllPIIWithMetadata] ML detection failed:', error);
      // Continue with regex results only
    }
  }

  // Merge and deduplicate
  return mergeDetections(regexResults, mlResults);
}

/**
 * Enhanced PII detection using hybrid validation pipeline
 * Combines regex, ML, and contextual analysis for maximum accuracy
 *
 * @param text - Text to analyze
 * @param options - Detection options
 * @returns Array of unique detected terms with enhanced accuracy
 */
export async function detectAllPIIEnhanced(
  text: string,
  options: DetectionOptions
): Promise<string[]> {
  const regexResults: DetectionResult[] = [];

  // Step 1: Run regex detection (fast, high precision)
  if (options.findEmails) {
    const emails = findEmails(text);
    regexResults.push(...createRegexDetections(emails, 'email'));
  }

  if (options.findPhones) {
    const phones = findPhones(text);
    regexResults.push(...createRegexDetections(phones, 'phone'));
  }

  if (options.findSSNs) {
    const ssns = findSSNs(text);
    regexResults.push(...createRegexDetections(ssns, 'ssn'));
  }

  if (options.findCards) {
    const cards = findLikelyPANs(text);
    regexResults.push(...createRegexDetections(cards, 'card'));
  }

  // Financial data detection
  if (options.findBankAccounts) {
    const swiftCodes = findSWIFTCodes(text);
    const routingNumbers = findRoutingNumbers(text);
    const clabe = findCLABE(text);
    const ibans = findIBANs(text);

    regexResults.push(...createRegexDetections(swiftCodes, 'swift'));
    regexResults.push(...createRegexDetections(routingNumbers, 'routing'));
    regexResults.push(...createRegexDetections(clabe, 'clabe'));
    regexResults.push(...createRegexDetections(ibans, 'iban'));
  }

  if (options.findCrypto) {
    const cryptoAddresses = findAllCryptoAddresses(text);
    regexResults.push(...createRegexDetections(cryptoAddresses, 'crypto'));
  }

  // Add positions to regex results by finding them in text
  for (const result of regexResults) {
    if (!result.positions) {
      const index = text.indexOf(result.text);
      if (index >= 0) {
        result.positions = {
          start: index,
          end: index + result.text.length
        };
      }
    }
  }

  // Step 2: Run ML detection with hybrid validation (if enabled)
  let finalResults: DetectionResult[];

  if (options.useML && isMLAvailable()) {
    try {
      const minConfidence = options.mlMinConfidence || 0.8;

      // Use hybrid detection for better accuracy
      finalResults = await hybridDetection(
        text,
        (t, conf) => mlDetector.detectEntities(t, conf),
        regexResults,
        minConfidence,
        true // Use pattern guidance
      );

      console.log(`[detectAllPIIEnhanced] Hybrid detection: ${finalResults.length} total detections`);
    } catch (error) {
      console.error('[detectAllPIIEnhanced] Hybrid detection failed:', error);
      // Fallback to regex only
      finalResults = regexResults;
    }
  } else {
    // ML disabled - use regex only
    finalResults = regexResults;
  }

  // Step 3: Extract just the text terms
  return extractTerms(finalResults);
}

/**
 * Enhanced detection with metadata
 * Returns full detection results with confidence scores and positions
 */
export async function detectAllPIIEnhancedWithMetadata(
  text: string,
  options: DetectionOptions
): Promise<DetectionResult[]> {
  const regexResults: DetectionResult[] = [];

  // Run regex detection with position tracking
  if (options.findEmails) {
    const emails = findEmails(text);
    regexResults.push(...createRegexDetections(emails, 'email'));
  }

  if (options.findPhones) {
    const phones = findPhones(text);
    regexResults.push(...createRegexDetections(phones, 'phone'));
  }

  if (options.findSSNs) {
    const ssns = findSSNs(text);
    regexResults.push(...createRegexDetections(ssns, 'ssn'));
  }

  if (options.findCards) {
    const cards = findLikelyPANs(text);
    regexResults.push(...createRegexDetections(cards, 'card'));
  }

  // Financial data detection
  if (options.findBankAccounts) {
    const swiftCodes = findSWIFTCodes(text);
    const routingNumbers = findRoutingNumbers(text);
    const clabe = findCLABE(text);
    const ibans = findIBANs(text);

    regexResults.push(...createRegexDetections(swiftCodes, 'swift'));
    regexResults.push(...createRegexDetections(routingNumbers, 'routing'));
    regexResults.push(...createRegexDetections(clabe, 'clabe'));
    regexResults.push(...createRegexDetections(ibans, 'iban'));
  }

  if (options.findCrypto) {
    const cryptoAddresses = findAllCryptoAddresses(text);
    regexResults.push(...createRegexDetections(cryptoAddresses, 'crypto'));
  }

  // Add positions
  for (const result of regexResults) {
    if (!result.positions) {
      const index = text.indexOf(result.text);
      if (index >= 0) {
        result.positions = {
          start: index,
          end: index + result.text.length
        };
      }
    }
  }

  // Run hybrid detection if ML enabled
  if (options.useML && isMLAvailable()) {
    try {
      const minConfidence = options.mlMinConfidence || 0.8;
      return await hybridDetection(
        text,
        (t, conf) => mlDetector.detectEntities(t, conf),
        regexResults,
        minConfidence,
        true
      );
    } catch (error) {
      console.error('[detectAllPIIEnhancedWithMetadata] Hybrid detection failed:', error);
      return regexResults;
    }
  }

  return regexResults;
}

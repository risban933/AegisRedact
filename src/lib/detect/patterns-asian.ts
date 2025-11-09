/**
 * Asian PII Pattern Detection
 * Covers Chinese ID cards, Japanese My Number, Indian Aadhaar, and other Asian national IDs
 */

/**
 * Chinese Resident Identity Card (居民身份证)
 * 18 digits: RRRRRRYYYYMMDDSSSC
 * - RRRRRR: Region code (6 digits)
 * - YYYYMMDD: Birth date (8 digits)
 * - SSS: Sequence number (3 digits, odd = male, even = female)
 * - C: Check digit (1 digit or 'X')
 */
export const CHINESE_ID = /\b\d{17}[\dX]\b/g;

/**
 * Japanese My Number (マイナンバー)
 * 12 digits with check digit
 * Format: XXXX-XXXX-XXXX or XXXXXXXXXXXX
 */
export const JAPANESE_MY_NUMBER = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;

/**
 * Indian Aadhaar Number
 * 12 digits with Verhoeff checksum
 * Format: XXXX XXXX XXXX or XXXXXXXXXXXX
 */
export const INDIAN_AADHAAR = /\b\d{4}[\s]?\d{4}[\s]?\d{4}\b/g;

/**
 * South Korean Resident Registration Number (주민등록번호)
 * 13 digits: YYMMDD-SSSSSSS
 * - YYMMDD: Birth date (6 digits)
 * - S: Gender/century indicator (1 digit)
 * - SSSSSS: Sequence and check (6 digits)
 */
export const KOREAN_RRN = /\b\d{6}[\s-]?\d{7}\b/g;

/**
 * Taiwanese National ID (中華民國國民身分證)
 * 10 characters: 1 letter + 9 digits
 * First letter indicates region
 */
export const TAIWANESE_ID = /\b[A-Z]\d{9}\b/g;

/**
 * Hong Kong ID Card (香港身份證)
 * Format: A123456(7) - 1-2 letters + 6 digits + check digit in parentheses
 */
export const HONG_KONG_ID = /\b[A-Z]{1,2}\d{6}\(\d\)\b/g;

/**
 * Singapore NRIC/FIN (National Registration Identity Card)
 * Format: Letter + 7 digits + Letter
 * Starts with S, T, F, or G
 */
export const SINGAPORE_NRIC = /\b[STFG]\d{7}[A-Z]\b/g;

/**
 * Malaysian MyKad (NRIC)
 * 12 digits: YYMMDD-PB-###G
 * - YYMMDD: Birth date
 * - PB: Place of birth
 * - ###: Sequence
 * - G: Gender (odd = male, even = female)
 */
export const MALAYSIAN_NRIC = /\b\d{6}[\s-]?\d{2}[\s-]?\d{4}\b/g;

/**
 * Thai National ID (บัตรประจำตัวประชาชน)
 * 13 digits with check digit
 */
export const THAI_NATIONAL_ID = /\b\d[\s-]?\d{4}[\s-]?\d{5}[\s-]?\d{2}[\s-]?\d\b/g;

/**
 * Validate Chinese ID card checksum
 * Uses modulo 11 algorithm with weights
 *
 * @param id - 18-character Chinese ID
 * @returns true if checksum is valid
 */
export function validateChineseID(id: string): boolean {
  if (!CHINESE_ID.test(id) || id.length !== 18) {
    return false;
  }

  // Weights for checksum calculation
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkChars = '10X98765432';

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += parseInt(id[i], 10) * weights[i];
  }

  const checkDigit = checkChars[sum % 11];
  return checkDigit === id[17];
}

/**
 * Validate Japanese My Number checksum
 * Uses modulo 11 algorithm
 *
 * @param myNumber - 12-digit My Number
 * @returns true if checksum is valid
 */
export function validateMyNumber(myNumber: string): boolean {
  const digits = myNumber.replace(/[\s-]/g, '');

  if (!/^\d{12}$/.test(digits)) {
    return false;
  }

  // My Number uses modulo 11 check digit algorithm
  const weights = [6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;

  for (let i = 0; i < 11; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }

  const remainder = sum % 11;
  let checkDigit: number;

  if (remainder <= 1) {
    checkDigit = 0;
  } else {
    checkDigit = 11 - remainder;
  }

  return checkDigit === parseInt(digits[11], 10);
}

/**
 * Validate Indian Aadhaar using Verhoeff algorithm
 * Verhoeff is a sophisticated checksum that detects all single-digit
 * errors and most transposition errors
 *
 * @param aadhaar - 12-digit Aadhaar number
 * @returns true if checksum is valid
 */
export function validateAadhaar(aadhaar: string): boolean {
  const digits = aadhaar.replace(/\s/g, '');

  if (!/^\d{12}$/.test(digits)) {
    return false;
  }

  // Verhoeff algorithm tables
  const d = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
  ];

  const p = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
  ];

  let c = 0;
  const reversedDigits = digits.split('').reverse().map(Number);

  for (let i = 0; i < reversedDigits.length; i++) {
    c = d[c][p[(i % 8)][reversedDigits[i]]];
  }

  return c === 0;
}

/**
 * Validate Taiwanese National ID
 * Uses weighted checksum algorithm
 *
 * @param id - Taiwanese ID (1 letter + 9 digits)
 * @returns true if checksum is valid
 */
export function validateTaiwaneseID(id: string): boolean {
  if (!TAIWANESE_ID.test(id) || id.length !== 10) {
    return false;
  }

  // Convert letter to number (A=10, B=11, ..., Z=35)
  const letterValues: { [key: string]: number } = {
    'A': 10, 'B': 11, 'C': 12, 'D': 13, 'E': 14, 'F': 15, 'G': 16, 'H': 17,
    'I': 34, 'J': 18, 'K': 19, 'L': 20, 'M': 21, 'N': 22, 'O': 35, 'P': 23,
    'Q': 24, 'R': 25, 'S': 26, 'T': 27, 'U': 28, 'V': 29, 'W': 32, 'X': 30,
    'Y': 31, 'Z': 33
  };

  const firstLetter = id[0];
  const letterValue = letterValues[firstLetter];
  if (letterValue === undefined) return false;

  // Weights: [1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1]
  const weights = [1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1];

  // Split letter value into two digits
  const digit1 = Math.floor(letterValue / 10);
  const digit2 = letterValue % 10;

  let sum = digit1 * weights[0] + digit2 * weights[1];

  for (let i = 1; i < 10; i++) {
    sum += parseInt(id[i], 10) * weights[i + 1];
  }

  return sum % 10 === 0;
}

/**
 * Validate Singapore NRIC/FIN
 * Uses weighted checksum with specific letter mapping
 *
 * @param nric - Singapore NRIC (Letter + 7 digits + Letter)
 * @returns true if checksum is valid
 */
export function validateSingaporeNRIC(nric: string): boolean {
  if (!SINGAPORE_NRIC.test(nric) || nric.length !== 9) {
    return false;
  }

  const weights = [2, 7, 6, 5, 4, 3, 2];
  const firstChar = nric[0];
  const digits = nric.substring(1, 8);
  const checkChar = nric[8];

  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }

  // Add offset for FIN (F/G)
  if (firstChar === 'T' || firstChar === 'G') {
    sum += 4;
  }

  const remainder = sum % 11;

  // Check letter mapping (different for S/T vs F/G)
  const stCheckLetters = 'JZIHGFEDCBA';
  const fgCheckLetters = 'XWUTRQPNMLK';

  const expectedChar = (firstChar === 'S' || firstChar === 'T')
    ? stCheckLetters[remainder]
    : fgCheckLetters[remainder];

  return expectedChar === checkChar;
}

/**
 * Validate Korean RRN checksum
 * Uses modulo 11 algorithm
 *
 * @param rrn - Korean Resident Registration Number (13 digits)
 * @returns true if checksum is valid
 */
export function validateKoreanRRN(rrn: string): boolean {
  const digits = rrn.replace(/[\s-]/g, '');

  if (!/^\d{13}$/.test(digits)) {
    return false;
  }

  const weights = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
  let sum = 0;

  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }

  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === parseInt(digits[12], 10);
}

/**
 * Validate Thai National ID checksum
 * Uses modulo 11 algorithm
 *
 * @param id - Thai National ID (13 digits)
 * @returns true if checksum is valid
 */
export function validateThaiID(id: string): boolean {
  const digits = id.replace(/[\s-]/g, '');

  if (!/^\d{13}$/.test(digits)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * (13 - i);
  }

  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === parseInt(digits[12], 10);
}

/**
 * Find all Chinese ID cards
 */
export function findChineseIDs(text: string): string[] {
  const candidates = Array.from(text.matchAll(CHINESE_ID), m => m[0]);
  return candidates.filter(validateChineseID);
}

/**
 * Find all Japanese My Numbers
 */
export function findMyNumbers(text: string): string[] {
  const candidates = Array.from(text.matchAll(JAPANESE_MY_NUMBER), m => m[0]);
  return candidates.filter(validateMyNumber);
}

/**
 * Find all Indian Aadhaar numbers
 */
export function findAadhaarNumbers(text: string): string[] {
  const candidates = Array.from(text.matchAll(INDIAN_AADHAAR), m => m[0]);
  return candidates.filter(validateAadhaar);
}

/**
 * Find all Taiwanese IDs
 */
export function findTaiwaneseIDs(text: string): string[] {
  const candidates = Array.from(text.matchAll(TAIWANESE_ID), m => m[0]);
  return candidates.filter(validateTaiwaneseID);
}

/**
 * Find all Singapore NRICs
 */
export function findSingaporeNRICs(text: string): string[] {
  const candidates = Array.from(text.matchAll(SINGAPORE_NRIC), m => m[0]);
  return candidates.filter(validateSingaporeNRIC);
}

/**
 * Find all Korean RRNs
 */
export function findKoreanRRNs(text: string): string[] {
  const candidates = Array.from(text.matchAll(KOREAN_RRN), m => m[0]);
  return candidates.filter(validateKoreanRRN);
}

/**
 * Find all Thai National IDs
 */
export function findThaiIDs(text: string): string[] {
  const candidates = Array.from(text.matchAll(THAI_NATIONAL_ID), m => m[0]);
  return candidates.filter(validateThaiID);
}

/**
 * Find all Malaysian NRICs
 */
export function findMalaysianNRICs(text: string): string[] {
  // Malaysian NRIC doesn't have a standard checksum, so just pattern match
  return Array.from(text.matchAll(MALAYSIAN_NRIC), m => m[0]);
}

/**
 * Find all Asian national IDs
 */
export function findAllAsian(text: string): {
  chineseIDs: string[];
  japaneseMyNumbers: string[];
  indianAadhaar: string[];
  taiwaneseIDs: string[];
  singaporeNRICs: string[];
  koreanRRNs: string[];
  thaiIDs: string[];
  malaysianNRICs: string[];
} {
  return {
    chineseIDs: findChineseIDs(text),
    japaneseMyNumbers: findMyNumbers(text),
    indianAadhaar: findAadhaarNumbers(text),
    taiwaneseIDs: findTaiwaneseIDs(text),
    singaporeNRICs: findSingaporeNRICs(text),
    koreanRRNs: findKoreanRRNs(text),
    thaiIDs: findThaiIDs(text),
    malaysianNRICs: findMalaysianNRICs(text)
  };
}

/**
 * European PII Pattern Detection
 * Covers EU/EEA countries: VAT numbers, passport formats, national IDs
 */

/**
 * VAT Number Patterns (by country)
 * Format varies significantly across EU countries
 */

// Germany: DE + 9 digits
export const VAT_DE = /\bDE\d{9}\b/g;

// France: FR + 2 alphanumeric + 9 digits
export const VAT_FR = /\bFR[A-Z0-9]{2}\d{9}\b/g;

// United Kingdom: GB + 9 or 12 digits (with optional 3-digit suffix)
export const VAT_GB = /\bGB(?:\d{9}(?:\d{3})?|\d{12})\b/g;

// Italy: IT + 11 digits
export const VAT_IT = /\bIT\d{11}\b/g;

// Spain: ES + alphanumeric (8 chars) + alphanumeric
export const VAT_ES = /\bES[A-Z0-9][0-9]{7}[A-Z0-9]\b/g;

// Netherlands: NL + 9 digits + B + 2 digits
export const VAT_NL = /\bNL\d{9}B\d{2}\b/g;

// Belgium: BE + 10 digits
export const VAT_BE = /\bBE0\d{9}\b/g;

// Austria: ATU + 8 digits
export const VAT_AT = /\bATU\d{8}\b/g;

// Sweden: SE + 12 digits
export const VAT_SE = /\bSE\d{12}\b/g;

// Denmark: DK + 8 digits
export const VAT_DK = /\bDK\d{8}\b/g;

// Finland: FI + 8 digits
export const VAT_FI = /\bFI\d{8}\b/g;

// Poland: PL + 10 digits
export const VAT_PL = /\bPL\d{10}\b/g;

// Ireland: IE + 7-9 alphanumeric characters
export const VAT_IE = /\bIE[A-Z0-9]{7,9}\b/g;

// Portugal: PT + 9 digits
export const VAT_PT = /\bPT\d{9}\b/g;

// Greece: EL + 9 digits
export const VAT_GR = /\bEL\d{9}\b/g;

// Czech Republic: CZ + 8-10 digits
export const VAT_CZ = /\bCZ\d{8,10}\b/g;

// Romania: RO + 2-10 digits
export const VAT_RO = /\bRO\d{2,10}\b/g;

// Hungary: HU + 8 digits
export const VAT_HU = /\bHU\d{8}\b/g;

/**
 * European Passport Patterns
 * Most Schengen countries use 9 alphanumeric characters
 * Some countries have specific prefixes
 */

// Generic European passport: 1-2 letters + 7-8 digits
export const PASSPORT_EU_GENERIC = /\b[A-Z]{1,2}\d{7,8}\b/g;

// German passport: starts with C, followed by 8 alphanumeric
export const PASSPORT_DE = /\bC[A-Z0-9]{8}\b/g;

// French passport: 2 digits + 2 letters + 5 digits
export const PASSPORT_FR = /\b\d{2}[A-Z]{2}\d{5}\b/g;

// UK passport: 9 digits
export const PASSPORT_GB = /\b\d{9}\b/g;

// Italian passport: 2 letters + 7 digits
export const PASSPORT_IT = /\b[A-Z]{2}\d{7}\b/g;

// Spanish passport (DNI): 8 digits + 1 letter
export const DNI_ES = /\b\d{8}[A-Z]\b/g;

// Spanish passport (NIE - foreigner ID): Letter + 7 digits + letter
export const NIE_ES = /\b[XYZ]\d{7}[A-Z]\b/g;

/**
 * National Insurance Number (UK)
 * Format: 2 letters + 6 digits + 1 letter (A, B, C, or D)
 * First letter cannot be D, F, I, Q, U, or V
 * Second letter cannot be D, F, I, O, Q, U, or V
 */
export const NINO_UK = /\b(?![DFIQUV])[A-Z](?![DFIQUOV])[A-Z]\d{6}[A-D]\b/g;

/**
 * French Social Security Number (INSEE)
 * 15 digits: 1 gender + 2 year + 2 month + 5 place + 3 order + 2 check
 */
export const INSEE_FR = /\b[1-478]\d{2}(?:0[1-9]|1[0-2])\d{8}\b/g;

/**
 * German Tax ID (Steueridentifikationsnummer)
 * 11 digits with specific validation rules
 */
export const TAX_ID_DE = /\b\d{11}\b/g;

/**
 * Italian Fiscal Code (Codice Fiscale)
 * 16 alphanumeric characters
 * Format: 3 letters (surname) + 3 letters (name) + 2 digits (year) +
 *         1 letter (month) + 2 digits (day) + 4 alphanumeric (municipality) +
 *         1 check letter
 */
export const CODICE_FISCALE_IT = /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/g;

/**
 * Dutch BSN (Burgerservicenummer)
 * 8 or 9 digits with 11-check validation
 */
export const BSN_NL = /\b\d{8,9}\b/g;

/**
 * Validate German VAT number
 * Uses simple product-sum checksum
 */
export function validateVAT_DE(vat: string): boolean {
  if (!VAT_DE.test(vat)) return false;

  const digits = vat.substring(2); // Remove "DE"
  if (digits.length !== 9) return false;

  // German VAT uses a product-sum checksum algorithm
  // Last digit is the check digit
  const checkDigit = parseInt(digits[8], 10);
  let sum = 0;

  for (let i = 0; i < 8; i++) {
    const digit = parseInt(digits[i], 10);
    sum = (sum + digit) * 2 % 11;
  }

  const calculated = (11 - sum) % 11;
  return calculated === checkDigit;
}

/**
 * Validate French VAT number
 * Uses modulo 97 algorithm
 */
export function validateVAT_FR(vat: string): boolean {
  if (!VAT_FR.test(vat)) return false;

  const key = vat.substring(2, 4);
  const siren = vat.substring(4, 13);

  // Convert letters to numbers (A=1, B=2, ..., Z=26)
  const keyNumeric = key.split('').map(c => {
    const code = c.charCodeAt(0);
    return code >= 65 && code <= 90 ? code - 64 : parseInt(c, 10);
  }).join('');

  const sirenNum = parseInt(siren, 10);
  const keyNum = parseInt(keyNumeric, 10);

  // Check: (SIREN * 100 + Key) % 97 = 0 or Key = (SIREN * 100) % 97
  return (sirenNum * 100 + keyNum) % 97 === 0;
}

/**
 * Validate Spanish DNI (national ID)
 * Uses modulo 23 letter check
 */
export function validateDNI_ES(dni: string): boolean {
  if (!DNI_ES.test(dni)) return false;

  const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
  const number = parseInt(dni.substring(0, 8), 10);
  const letter = dni.charAt(8);

  return letters.charAt(number % 23) === letter;
}

/**
 * Validate Spanish NIE (foreigner ID)
 * Similar to DNI but first letter is replaced with digit
 */
export function validateNIE_ES(nie: string): boolean {
  if (!NIE_ES.test(nie)) return false;

  const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
  let number: string;

  // Replace first letter with corresponding digit
  switch (nie.charAt(0)) {
    case 'X': number = '0' + nie.substring(1, 8); break;
    case 'Y': number = '1' + nie.substring(1, 8); break;
    case 'Z': number = '2' + nie.substring(1, 8); break;
    default: return false;
  }

  const checkLetter = nie.charAt(8);
  return letters.charAt(parseInt(number, 10) % 23) === checkLetter;
}

/**
 * Validate UK National Insurance Number
 * Format check only (no algorithmic validation)
 */
export function validateNINO_UK(nino: string): boolean {
  if (!NINO_UK.test(nino)) return false;

  // Additional validation: certain prefixes are not used
  const prefix = nino.substring(0, 2);
  const invalidPrefixes = new Set([
    'BG', 'GB', 'NK', 'KN', 'TN', 'NT', 'ZZ'
  ]);

  return !invalidPrefixes.has(prefix);
}

/**
 * Validate Dutch BSN using 11-check
 * Elfproef (11-check): sum of (digit * weight) mod 11 = 0
 */
export function validateBSN_NL(bsn: string): boolean {
  const digits = bsn.replace(/\D/g, '');
  if (digits.length !== 8 && digits.length !== 9) return false;

  // Pad to 9 digits if needed
  const paddedBSN = digits.padStart(9, '0');

  // 11-check algorithm
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const weight = (9 - i);
    const digit = parseInt(paddedBSN[i], 10);

    // Last digit (i=8) gets weight -1
    sum += digit * (i === 8 ? -1 : weight);
  }

  return sum % 11 === 0;
}

/**
 * Validate Italian Codice Fiscale
 * Complex validation with check digit calculation
 */
export function validateCodiceFiscale_IT(cf: string): boolean {
  if (!CODICE_FISCALE_IT.test(cf)) return false;

  // Check character conversion tables
  const evenMap: { [key: string]: number } = {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
    'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18,
    'T': 19, 'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
  };

  const oddMap: { [key: string]: number } = {
    '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
    'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
    'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
    'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
  };

  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const char = cf.charAt(i);
    sum += (i % 2 === 0) ? oddMap[char] : evenMap[char];
  }

  const checkLetter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[sum % 26];
  return checkLetter === cf.charAt(15);
}

/**
 * Find all VAT numbers in text
 */
export function findVATNumbers(text: string): string[] {
  const vats: string[] = [];

  // Collect from all country patterns
  const patterns = [
    VAT_DE, VAT_FR, VAT_GB, VAT_IT, VAT_ES, VAT_NL, VAT_BE,
    VAT_AT, VAT_SE, VAT_DK, VAT_FI, VAT_PL, VAT_IE, VAT_PT,
    VAT_GR, VAT_CZ, VAT_RO, VAT_HU
  ];

  for (const pattern of patterns) {
    const matches = Array.from(text.matchAll(pattern), m => m[0]);
    vats.push(...matches);
  }

  return Array.from(new Set(vats)); // Deduplicate
}

/**
 * Find all European passports and national IDs
 */
export function findEuropeanIDs(text: string): string[] {
  const ids: string[] = [];

  // DNI/NIE (Spain)
  const dniMatches = Array.from(text.matchAll(DNI_ES), m => m[0]);
  ids.push(...dniMatches.filter(validateDNI_ES));

  const nieMatches = Array.from(text.matchAll(NIE_ES), m => m[0]);
  ids.push(...nieMatches.filter(validateNIE_ES));

  // NINO (UK)
  const ninoMatches = Array.from(text.matchAll(NINO_UK), m => m[0]);
  ids.push(...ninoMatches.filter(validateNINO_UK));

  // BSN (Netherlands)
  const bsnMatches = Array.from(text.matchAll(BSN_NL), m => m[0]);
  ids.push(...bsnMatches.filter(validateBSN_NL));

  // Codice Fiscale (Italy)
  const cfMatches = Array.from(text.matchAll(CODICE_FISCALE_IT), m => m[0]);
  ids.push(...cfMatches.filter(validateCodiceFiscale_IT));

  // INSEE (France)
  const inseeMatches = Array.from(text.matchAll(INSEE_FR), m => m[0]);
  ids.push(...inseeMatches);

  return Array.from(new Set(ids));
}

/**
 * Find all European PII
 */
export function findAllEuropean(text: string): {
  vat: string[];
  nationalIDs: string[];
} {
  return {
    vat: findVATNumbers(text),
    nationalIDs: findEuropeanIDs(text)
  };
}

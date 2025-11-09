/**
 * Latin American PII Pattern Detection
 * Covers CPF (Brazil), CURP (Mexico), RUT (Chile), and other LATAM national IDs
 */

/**
 * Brazilian CPF (Cadastro de Pessoas Físicas)
 * 11 digits with dual checksum
 * Format: XXX.XXX.XXX-XX or XXXXXXXXXXX
 */
export const CPF_BR = /\b\d{3}[\.]?\d{3}[\.]?\d{3}[\-]?\d{2}\b/g;

/**
 * Mexican CURP (Clave Única de Registro de Población)
 * 18 alphanumeric characters
 * Format: AAAA######HAAAAA##
 * - AAAA: Surname initial + First vowel + First name initial + Second surname initial
 * - ######: Birth date YYMMDD
 * - H: Gender (H/M)
 * - AA: State of birth
 * - AAA: First internal consonants of names
 * - ##: Homonymy digit + check digit
 */
export const CURP_MX = /\b[A-Z]{4}\d{6}[HM][A-Z]{5}\d{2}\b/g;

/**
 * Chilean RUT (Rol Único Tributario)
 * 8-9 digits + check digit (can be 0-9 or K)
 * Format: XX.XXX.XXX-K or XXXXXXXXK
 */
export const RUT_CL = /\b\d{1,2}[\.]?\d{3}[\.]?\d{3}[\-]?[\dKk]\b/g;

/**
 * Argentine DNI (Documento Nacional de Identidad)
 * 7-8 digits
 * Format: XX.XXX.XXX or XXXXXXXX
 */
export const DNI_AR = /\b\d{1,2}[\.]?\d{3}[\.]?\d{3}\b/g;

/**
 * Colombian CC (Cédula de Ciudadanía)
 * 6-10 digits
 * Format: X.XXX.XXX or XXXXXXXX
 */
export const CC_CO = /\b\d{1,3}[\.]?\d{3}[\.]?\d{3}\b/g;

/**
 * Peruvian DNI
 * 8 digits
 * Format: XXXXXXXX
 */
export const DNI_PE = /\b\d{8}\b/g;

/**
 * Venezuelan CI (Cédula de Identidad)
 * Format: V-XXXXXXXX or E-XXXXXXXX (V = Venezuelan, E = Foreign)
 * 7-9 digits
 */
export const CI_VE = /\b[VE][\-]?\d{7,9}\b/g;

/**
 * Ecuadorian CI (Cédula de Identidad)
 * 10 digits with check digit
 */
export const CI_EC = /\b\d{10}\b/g;

/**
 * Validate Brazilian CPF checksum
 * Uses dual modulo 11 algorithm
 *
 * @param cpf - 11-digit CPF
 * @returns true if checksum is valid
 */
export function validateCPF(cpf: string): boolean {
  // Remove formatting
  const digits = cpf.replace(/[.\-]/g, '');

  if (!/^\d{11}$/.test(digits)) {
    return false;
  }

  // Check for known invalid CPFs (all same digit)
  if (/^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  // Calculate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * (10 - i);
  }
  let checkDigit1 = 11 - (sum % 11);
  if (checkDigit1 >= 10) checkDigit1 = 0;

  if (checkDigit1 !== parseInt(digits[9], 10)) {
    return false;
  }

  // Calculate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * (11 - i);
  }
  let checkDigit2 = 11 - (sum % 11);
  if (checkDigit2 >= 10) checkDigit2 = 0;

  return checkDigit2 === parseInt(digits[10], 10);
}

/**
 * Validate Mexican CURP
 * Format validation + checksum
 *
 * @param curp - 18-character CURP
 * @returns true if valid format and checksum
 */
export function validateCURP(curp: string): boolean {
  // Reset regex state before testing (CURP_MX has 'g' flag)
  CURP_MX.lastIndex = 0;
  if (!CURP_MX.test(curp) || curp.length !== 18) {
    return false;
  }

  // Validate date portion (positions 4-9: YYMMDD)
  const year = parseInt(curp.substring(4, 6), 10);
  const month = parseInt(curp.substring(6, 8), 10);
  const day = parseInt(curp.substring(8, 10), 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  // Validate gender (position 10: H or M)
  const gender = curp[10];
  if (gender !== 'H' && gender !== 'M') {
    return false;
  }

  // Validate state code (positions 11-12)
  const validStates = new Set([
    'AS', 'BC', 'BS', 'CC', 'CL', 'CM', 'CS', 'CH', 'DF', 'DG',
    'GT', 'GR', 'HG', 'JC', 'MC', 'MN', 'MS', 'NT', 'NL', 'OC',
    'PL', 'QT', 'QR', 'SP', 'SL', 'SR', 'TC', 'TS', 'TL', 'VZ',
    'YN', 'ZS', 'NE' // NE = Born abroad
  ]);

  const state = curp.substring(11, 13);
  if (!validStates.has(state)) {
    return false;
  }

  // Checksum validation
  const checksumTable = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
  let sum = 0;

  for (let i = 0; i < 17; i++) {
    const char = curp[i];
    const value = checksumTable.indexOf(char);
    sum += value * (18 - i);
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(curp[17], 10);
}

/**
 * Validate Chilean RUT checksum
 * Uses modulo 11 algorithm with specific remainder mapping
 *
 * @param rut - Chilean RUT (8-9 digits + check)
 * @returns true if checksum is valid
 */
export function validateRUT(rut: string): boolean {
  // Remove formatting
  const cleaned = rut.replace(/[.\-]/g, '').toUpperCase();

  if (!/^\d{7,9}[\dK]$/.test(cleaned)) {
    return false;
  }

  const digits = cleaned.slice(0, -1);
  const checkChar = cleaned.slice(-1);

  let sum = 0;
  let multiplier = 2;

  // Process digits from right to left
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += parseInt(digits[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = sum % 11;
  const checkDigit = 11 - remainder;

  let expectedCheck: string;
  if (checkDigit === 11) {
    expectedCheck = '0';
  } else if (checkDigit === 10) {
    expectedCheck = 'K';
  } else {
    expectedCheck = checkDigit.toString();
  }

  return expectedCheck === checkChar;
}

/**
 * Validate Ecuadorian CI checksum
 * Uses modulo 10 algorithm
 *
 * @param ci - 10-digit Ecuadorian CI
 * @returns true if checksum is valid
 */
export function validateCI_EC(ci: string): boolean {
  const digits = ci.replace(/\D/g, '');

  if (!/^\d{10}$/.test(digits)) {
    return false;
  }

  // Province code (first 2 digits) must be between 01 and 24
  const province = parseInt(digits.substring(0, 2), 10);
  if (province < 1 || province > 24) {
    return false;
  }

  // Third digit must be less than 6 (for natural persons)
  const thirdDigit = parseInt(digits[2], 10);
  if (thirdDigit >= 6) {
    return false;
  }

  // Checksum validation (modulo 10)
  let sum = 0;
  const weights = [2, 1, 2, 1, 2, 1, 2, 1, 2];

  for (let i = 0; i < 9; i++) {
    let product = parseInt(digits[i], 10) * weights[i];
    if (product >= 10) {
      product -= 9; // Sum of digits if >= 10
    }
    sum += product;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(digits[9], 10);
}

/**
 * Validate Argentine DNI
 * No standard checksum, just format validation
 *
 * @param dni - Argentine DNI (7-8 digits)
 * @returns true if valid format
 */
export function validateDNI_AR(dni: string): boolean {
  const digits = dni.replace(/\./g, '');
  return /^\d{7,8}$/.test(digits);
}

/**
 * Validate Colombian CC
 * No standard checksum, just format validation
 *
 * @param cc - Colombian CC (6-10 digits)
 * @returns true if valid format
 */
export function validateCC_CO(cc: string): boolean {
  const digits = cc.replace(/\./g, '');
  return /^\d{6,10}$/.test(digits);
}

/**
 * Validate Peruvian DNI
 * No standard checksum, just format validation
 *
 * @param dni - Peruvian DNI (8 digits)
 * @returns true if valid format
 */
export function validateDNI_PE(dni: string): boolean {
  return /^\d{8}$/.test(dni);
}

/**
 * Validate Venezuelan CI
 * No standard checksum, just format validation
 *
 * @param ci - Venezuelan CI (V/E + 7-9 digits)
 * @returns true if valid format
 */
export function validateCI_VE(ci: string): boolean {
  const cleaned = ci.replace(/-/g, '').toUpperCase();
  return /^[VE]\d{7,9}$/.test(cleaned);
}

/**
 * Find all Brazilian CPFs
 */
export function findCPFs(text: string): string[] {
  const candidates = Array.from(text.matchAll(CPF_BR), m => m[0]);
  return candidates.filter(validateCPF);
}

/**
 * Find all Mexican CURPs
 */
export function findCURPs(text: string): string[] {
  const candidates = Array.from(text.matchAll(CURP_MX), m => m[0]);
  return candidates.filter(validateCURP);
}

/**
 * Find all Chilean RUTs
 */
export function findRUTs(text: string): string[] {
  const candidates = Array.from(text.matchAll(RUT_CL), m => m[0]);
  return candidates.filter(validateRUT);
}

/**
 * Find all Ecuadorian CIs
 */
export function findCIs_EC(text: string): string[] {
  const candidates = Array.from(text.matchAll(CI_EC), m => m[0]);
  return candidates.filter(validateCI_EC);
}

/**
 * Find all Argentine DNIs
 */
export function findDNIs_AR(text: string): string[] {
  const candidates = Array.from(text.matchAll(DNI_AR), m => m[0]);
  return candidates.filter(validateDNI_AR);
}

/**
 * Find all Colombian CCs
 */
export function findCCs_CO(text: string): string[] {
  const candidates = Array.from(text.matchAll(CC_CO), m => m[0]);
  return candidates.filter(validateCC_CO);
}

/**
 * Find all Peruvian DNIs
 */
export function findDNIs_PE(text: string): string[] {
  const candidates = Array.from(text.matchAll(DNI_PE), m => m[0]);
  return candidates.filter(validateDNI_PE);
}

/**
 * Find all Venezuelan CIs
 */
export function findCIs_VE(text: string): string[] {
  const candidates = Array.from(text.matchAll(CI_VE), m => m[0]);
  return candidates.filter(validateCI_VE);
}

/**
 * Find all Latin American national IDs
 */
export function findAllLatAm(text: string): {
  cpf: string[];
  curp: string[];
  rut: string[];
  dniAR: string[];
  ccCO: string[];
  dniPE: string[];
  ciVE: string[];
  ciEC: string[];
} {
  return {
    cpf: findCPFs(text),
    curp: findCURPs(text),
    rut: findRUTs(text),
    dniAR: findDNIs_AR(text),
    ccCO: findCCs_CO(text),
    dniPE: findDNIs_PE(text),
    ciVE: findCIs_VE(text),
    ciEC: findCIs_EC(text)
  };
}

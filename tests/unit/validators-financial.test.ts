import { describe, it, expect } from 'vitest';
import {
  validateSWIFT,
  validateRoutingNumber,
  validateCLABE,
  validateIBAN
} from '../../src/lib/detect/patterns-financial';

describe('Financial Validators', () => {
  describe('SWIFT/BIC Code Validation', () => {
    it('should validate correct 8-character SWIFT codes', () => {
      expect(validateSWIFT('DEUTDEFF')).toBe(true);  // Deutsche Bank, Germany
      expect(validateSWIFT('CHASUS33')).toBe(true);  // JPMorgan Chase, USA
      expect(validateSWIFT('BNPAFRPP')).toBe(true);  // BNP Paribas, France
    });

    it('should validate correct 11-character SWIFT codes', () => {
      expect(validateSWIFT('DEUTDEFF500')).toBe(true);  // Deutsche Bank with branch
      expect(validateSWIFT('CHASUS33XXX')).toBe(true);  // JPMorgan with branch
    });

    it('should reject invalid SWIFT codes', () => {
      expect(validateSWIFT('DEUT')).toBe(false);        // Too short
      expect(validateSWIFT('DEUTDEFF50')).toBe(false);  // Wrong length (10)
      expect(validateSWIFT('12345678')).toBe(false);     // Numbers instead of letters
      expect(validateSWIFT('DEUTXXFF')).toBe(false);     // Invalid country code
    });
  });

  describe('US ABA Routing Number Validation', () => {
    it('should validate correct routing numbers', () => {
      expect(validateRoutingNumber('021000021')).toBe(true);  // JPMorgan Chase
      expect(validateRoutingNumber('026009593')).toBe(true);  // Bank of America
      expect(validateRoutingNumber('011401533')).toBe(true);  // Wells Fargo
    });

    it('should reject invalid routing numbers', () => {
      expect(validateRoutingNumber('123456789')).toBe(false);  // Invalid checksum
      expect(validateRoutingNumber('021000022')).toBe(false);  // Wrong check digit
      expect(validateRoutingNumber('99900002')).toBe(false);   // Invalid first two digits
      expect(validateRoutingNumber('12345678')).toBe(false);   // Too short
    });
  });

  describe('CLABE Validation (Mexico)', () => {
    it('should validate correct CLABE numbers', () => {
      // Test CLABE: bank + branch + account + check
      expect(validateCLABE('002010077777777771')).toBe(true);
      expect(validateCLABE('032180000118359719')).toBe(true);
    });

    it('should reject invalid CLABE numbers', () => {
      expect(validateCLABE('002010077777777779')).toBe(false);  // Wrong check digit
      expect(validateCLABE('12345678901234567')).toBe(false);   // Too short
      expect(validateCLABE('0021000777777777712')).toBe(false); // Too long
      expect(validateCLABE('ABC010077777777771')).toBe(false);  // Invalid characters
    });

    it('should handle CLABE with spaces', () => {
      expect(validateCLABE('002 010 07777777777 1')).toBe(true);
    });
  });

  describe('IBAN Validation', () => {
    it('should validate correct IBANs from different countries', () => {
      expect(validateIBAN('DE89370400440532013000')).toBe(true);  // Germany
      expect(validateIBAN('GB82WEST12345698765432')).toBe(true);  // UK
      expect(validateIBAN('FR1420041010050500013M02606')).toBe(true);  // France
      expect(validateIBAN('IT60X0542811101000000123456')).toBe(true);  // Italy
    });

    it('should validate IBANs with spaces', () => {
      expect(validateIBAN('DE89 3704 0044 0532 0130 00')).toBe(true);
      expect(validateIBAN('GB82 WEST 1234 5698 7654 32')).toBe(true);
    });

    it('should reject invalid IBANs', () => {
      expect(validateIBAN('DE89370400440532013001')).toBe(false);  // Wrong check digits
      expect(validateIBAN('XX82WEST12345698765432')).toBe(false);  // Invalid country
      expect(validateIBAN('DE8937')).toBe(false);                  // Too short
      expect(validateIBAN('123456789012345')).toBe(false);         // No letters
    });

    it('should handle case-insensitive IBANs', () => {
      expect(validateIBAN('de89370400440532013000')).toBe(true);  // Lowercase
      expect(validateIBAN('De89370400440532013000')).toBe(true);  // Mixed case
    });
  });
});

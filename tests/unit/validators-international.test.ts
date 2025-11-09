import { describe, it, expect } from 'vitest';
import {
  validateCPF,
  validateCURP,
  validateRUT
} from '../../src/lib/detect/patterns-latam';
import {
  validateChineseID,
  validateMyNumber,
  validateAadhaar
} from '../../src/lib/detect/patterns-asian';
import {
  validateDNI_ES,
  validateNIE_ES,
  validateBSN_NL
} from '../../src/lib/detect/patterns-european';

describe('International ID Validators', () => {
  describe('Latin American IDs', () => {
    describe('Brazilian CPF', () => {
      it('should validate correct CPF numbers', () => {
        expect(validateCPF('111.444.777-35')).toBe(true);
        expect(validateCPF('11144477735')).toBe(true);  // Without formatting
      });

      it('should reject invalid CPF numbers', () => {
        expect(validateCPF('111.444.777-36')).toBe(false);  // Wrong check digits
        expect(validateCPF('111.111.111-11')).toBe(false);  // All same digits
        expect(validateCPF('123.456.789-00')).toBe(false);  // Invalid checksum
      });
    });

    describe('Mexican CURP', () => {
      it('should validate correct CURP', () => {
        expect(validateCURP('HEGG560427MVZRRL04')).toBe(true);
        expect(validateCURP('MAMX850203HDFRLN09')).toBe(true);
      });

      it('should reject invalid CURP', () => {
        expect(validateCURP('HEGG560427MVZRRL05')).toBe(false);  // Wrong check digit
        expect(validateCURP('HEGG991327MVZRRL04')).toBe(false);  // Invalid date (month 13)
        expect(validateCURP('HEGG560427XVZRRL04')).toBe(false);  // Invalid gender
        expect(validateCURP('HEGG560427MVZRRL')).toBe(false);    // Too short
      });
    });

    describe('Chilean RUT', () => {
      it('should validate correct RUT numbers', () => {
        expect(validateRUT('12.345.678-5')).toBe(true);
        expect(validateRUT('12345678-5')).toBe(true);  // Without dots
        expect(validateRUT('12.345.678-K')).toBe(true);  // With K check digit
      });

      it('should reject invalid RUT numbers', () => {
        expect(validateRUT('12.345.678-9')).toBe(false);  // Wrong check digit
        expect(validateRUT('12.345.678-L')).toBe(false);  // Invalid letter (not K)
      });

      it('should handle lowercase k', () => {
        expect(validateRUT('12.345.678-k')).toBe(true);
      });
    });
  });

  describe('Asian IDs', () => {
    describe('Chinese Resident ID', () => {
      it('should validate correct Chinese IDs', () => {
        expect(validateChineseID('110101199003078515')).toBe(true);
        expect(validateChineseID('11010119900307851X')).toBe(true);  // With X check digit
      });

      it('should reject invalid Chinese IDs', () => {
        expect(validateChineseID('110101199003078516')).toBe(false);  // Wrong check digit
        expect(validateChineseID('11010119900307851')).toBe(false);   // Too short
        expect(validateChineseID('1101011990030785159')).toBe(false); // Too long
      });
    });

    describe('Japanese My Number', () => {
      it('should validate correct My Numbers', () => {
        expect(validateMyNumber('123456789012')).toBe(true);
        expect(validateMyNumber('1234-5678-9012')).toBe(true);  // With separators
      });

      it('should reject invalid My Numbers', () => {
        expect(validateMyNumber('123456789013')).toBe(false);  // Wrong check digit
        expect(validateMyNumber('12345678901')).toBe(false);   // Too short
        expect(validateMyNumber('ABC456789012')).toBe(false);  // Invalid characters
      });
    });

    describe('Indian Aadhaar', () => {
      it('should validate correct Aadhaar numbers', () => {
        // Note: Using test Aadhaar numbers (Verhoeff algorithm)
        expect(validateAadhaar('234123412346')).toBe(true);
        expect(validateAadhaar('2341 2341 2346')).toBe(true);  // With spaces
      });

      it('should reject invalid Aadhaar numbers', () => {
        expect(validateAadhaar('234123412347')).toBe(false);  // Wrong check digit
        expect(validateAadhaar('23412341234')).toBe(false);   // Too short
        expect(validateAadhaar('ABC123412346')).toBe(false);  // Invalid characters
      });
    });
  });

  describe('European IDs', () => {
    describe('Spanish DNI', () => {
      it('should validate correct DNI numbers', () => {
        expect(validateDNI_ES('12345678Z')).toBe(true);
        expect(validateDNI_ES('87654321X')).toBe(true);
      });

      it('should reject invalid DNI numbers', () => {
        expect(validateDNI_ES('12345678A')).toBe(false);  // Wrong letter
        expect(validateDNI_ES('1234567Z')).toBe(false);   // Too short
        expect(validateDNI_ES('123456789Z')).toBe(false); // Too long
      });
    });

    describe('Spanish NIE', () => {
      it('should validate correct NIE numbers', () => {
        expect(validateNIE_ES('X1234567L')).toBe(true);
        expect(validateNIE_ES('Y1234567Z')).toBe(true);
        expect(validateNIE_ES('Z1234567R')).toBe(true);
      });

      it('should reject invalid NIE numbers', () => {
        expect(validateNIE_ES('X1234567M')).toBe(false);  // Wrong letter
        expect(validateNIE_ES('A1234567L')).toBe(false);  // Invalid prefix (not X/Y/Z)
        expect(validateNIE_ES('X123456L')).toBe(false);   // Too short
      });
    });

    describe('Dutch BSN', () => {
      it('should validate correct BSN numbers', () => {
        expect(validateBSN_NL('111222333')).toBe(true);
        expect(validateBSN_NL('123456782')).toBe(true);
      });

      it('should reject invalid BSN numbers', () => {
        expect(validateBSN_NL('111222334')).toBe(false);  // Wrong check digit
        expect(validateBSN_NL('12345678')).toBe(false);   // Valid 8-digit but wrong checksum
        expect(validateBSN_NL('1234567')).toBe(false);    // Too short
      });

      it('should pad 8-digit BSN to 9 digits', () => {
        expect(validateBSN_NL('12345678')).toBe(true);  // Will be padded to 012345678
      });
    });
  });
});

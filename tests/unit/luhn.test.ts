import { describe, it, expect } from 'vitest';
import { luhnCheck } from '../../src/lib/detect/luhn';

describe('Luhn Algorithm', () => {
  it('should validate valid card numbers', () => {
    // Valid test card numbers
    expect(luhnCheck('4532015112830366')).toBe(true); // Visa
    expect(luhnCheck('5425233430109903')).toBe(true); // Mastercard
    expect(luhnCheck('378282246310005')).toBe(true);  // Amex
  });

  it('should reject invalid card numbers', () => {
    expect(luhnCheck('1234567812345678')).toBe(false);
    expect(luhnCheck('1111111111111111')).toBe(false);
    expect(luhnCheck('0000000000000000')).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(luhnCheck('0')).toBe(false); // Single digit zero is invalid
    expect(luhnCheck('1')).toBe(false);
    expect(luhnCheck('')).toBe(false);
  });
});

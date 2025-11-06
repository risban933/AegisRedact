import { describe, it, expect } from 'vitest';
import { findEmails, findPhones, findSSNs, findLikelyPANs } from '../../src/lib/detect/patterns';

describe('Pattern Detection', () => {
  describe('Email Detection', () => {
    it('should find valid emails', () => {
      const text = 'Contact us at support@example.com or sales@company.org';
      const emails = findEmails(text);
      expect(emails).toEqual(['support@example.com', 'sales@company.org']);
    });

    it('should handle no matches', () => {
      const text = 'No emails here!';
      expect(findEmails(text)).toEqual([]);
    });
  });

  describe('Phone Detection', () => {
    it('should find E.164 format phones', () => {
      const text = 'Call +14155552671 or +442071234567';
      const phones = findPhones(text);
      expect(phones.length).toBeGreaterThan(0);
    });
  });

  describe('SSN Detection', () => {
    it('should find formatted SSNs', () => {
      const text = 'SSN: 123-45-6789';
      const ssns = findSSNs(text);
      expect(ssns).toContain('123-45-6789');
    });

    it('should find unformatted SSNs', () => {
      const text = 'SSN: 123456789';
      const ssns = findSSNs(text);
      expect(ssns).toContain('123456789');
    });
  });

  describe('Card Number Detection (Luhn)', () => {
    it('should find valid card numbers', () => {
      const text = 'Card: 4532015112830366';
      const cards = findLikelyPANs(text);
      expect(cards).toContain('4532015112830366');
    });

    it('should reject invalid card numbers', () => {
      const text = 'Card: 1234567812345678';
      const cards = findLikelyPANs(text);
      expect(cards).not.toContain('1234567812345678');
    });

    it('should handle formatted card numbers', () => {
      const text = 'Card: 4532-0151-1283-0366';
      const cards = findLikelyPANs(text);
      expect(cards).toContain('4532015112830366');
    });
  });
});

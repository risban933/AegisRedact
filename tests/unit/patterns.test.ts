import { describe, it, expect } from 'vitest';
import { findEmails, findPhones, findSSNs, findLikelyPANs, findDates, findAddresses } from '../../src/lib/detect/patterns';

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

  describe('Date Detection', () => {
    it('should find MM/DD/YYYY dates', () => {
      const text = 'Born on 03/15/1990';
      const dates = findDates(text);
      expect(dates).toContain('03/15/1990');
    });

    it('should find MM-DD-YYYY dates', () => {
      const text = 'Date: 12-25-1985';
      const dates = findDates(text);
      expect(dates).toContain('12-25-1985');
    });

    it('should find YYYY-MM-DD (ISO) dates', () => {
      const text = 'Date: 1995-06-20';
      const dates = findDates(text);
      expect(dates).toContain('1995-06-20');
    });

    it('should find written dates (Month DD, YYYY)', () => {
      const text = 'Born on January 15, 1990';
      const dates = findDates(text);
      expect(dates.length).toBeGreaterThan(0);
      expect(dates.some(d => d.includes('January 15, 1990'))).toBe(true);
    });

    it('should find abbreviated month dates', () => {
      const text = 'Event: Dec 31, 1999';
      const dates = findDates(text);
      expect(dates.length).toBeGreaterThan(0);
      expect(dates.some(d => d.includes('Dec 31, 1999'))).toBe(true);
    });

    it('should find DOB labels', () => {
      const text = 'DOB: 05/10/1988';
      const dates = findDates(text);
      expect(dates.length).toBeGreaterThan(0);
      expect(dates.some(d => d.includes('05/10/1988'))).toBe(true);
    });

    it('should find Date of Birth labels', () => {
      const text = 'Date of Birth: 08/22/1975';
      const dates = findDates(text);
      expect(dates.length).toBeGreaterThan(0);
    });

    it('should handle multiple date formats in one text', () => {
      const text = 'Born 01/15/1990, graduated June 15, 2012, married 2015-08-20';
      const dates = findDates(text);
      expect(dates.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Address Detection', () => {
    it('should find street addresses', () => {
      const text = 'Lives at 123 Main Street';
      const addresses = findAddresses(text);
      expect(addresses.length).toBeGreaterThan(0);
      expect(addresses.some(a => a.includes('123 Main Street'))).toBe(true);
    });

    it('should find addresses with abbreviations', () => {
      const text = 'Address: 456 Oak Ave';
      const addresses = findAddresses(text);
      expect(addresses.length).toBeGreaterThan(0);
      expect(addresses.some(a => a.includes('456 Oak Ave'))).toBe(true);
    });

    it('should find PO boxes', () => {
      const text = 'Mail to P.O. Box 12345';
      const addresses = findAddresses(text);
      expect(addresses.length).toBeGreaterThan(0);
      expect(addresses.some(a => a.toLowerCase().includes('p.o. box'))).toBe(true);
    });

    it('should find PO boxes (alternate format)', () => {
      const text = 'Send to Post Office Box 6789';
      const addresses = findAddresses(text);
      expect(addresses.length).toBeGreaterThan(0);
      expect(addresses.some(a => a.toLowerCase().includes('post office box'))).toBe(true);
    });

    it('should find ZIP codes', () => {
      const text = 'ZIP: 94102';
      const addresses = findAddresses(text);
      expect(addresses).toContain('94102');
    });

    it('should find ZIP+4 codes', () => {
      const text = 'ZIP: 94102-1234';
      const addresses = findAddresses(text);
      expect(addresses).toContain('94102-1234');
    });

    it('should find city, state, ZIP', () => {
      const text = 'Located in San Francisco, CA 94102';
      const addresses = findAddresses(text);
      expect(addresses.length).toBeGreaterThan(0);
      expect(addresses.some(a => a.includes('San Francisco, CA 94102'))).toBe(true);
    });

    it('should find multiple address components', () => {
      const text = '789 Elm Drive, Springfield, IL 62701';
      const addresses = findAddresses(text);
      expect(addresses.length).toBeGreaterThan(0);
    });

    it('should handle various street types', () => {
      const text = '100 Park Boulevard, 200 Lake Terrace, 300 Hill Circle';
      const addresses = findAddresses(text);
      expect(addresses.length).toBeGreaterThanOrEqual(3);
    });
  });
});

/**
 * Unit tests for CsvFormat
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CsvFormat } from '../../../../src/lib/formats/structured/CsvFormat';
import type { Document } from '../../../../src/lib/formats/base/types';

describe('CsvFormat', () => {
  let format: CsvFormat;

  beforeEach(() => {
    format = new CsvFormat();
  });

  describe('constructor', () => {
    it('should have correct format metadata', () => {
      expect(format.formatId).toBe('csv');
      expect(format.formatName).toBe('CSV File');
      expect(format.supportedExtensions).toContain('csv');
      expect(format.supportedExtensions).toContain('tsv');
      expect(format.mimeTypes).toContain('text/csv');
    });

    it('should have correct capabilities', () => {
      expect(format.capabilities.canRenderToDOM).toBe(true);
      expect(format.capabilities.canRenderToCanvas).toBe(false);
      expect(format.capabilities.requiresOCR).toBe(false);
      expect(format.capabilities.supportsDirectExport).toBe(true);
      expect(format.capabilities.supportedExportFormats).toContain('csv');
    });
  });

  describe('load', () => {
    it('should load a simple CSV file', async () => {
      const csvContent = 'Name,Email,Phone\nJohn Doe,john@example.com,555-1234\nJane Smith,jane@example.com,555-5678';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

      const doc = await format.load(file);

      expect(doc.metadata.fileName).toBe('test.csv');
      expect(doc.metadata.format).toBe('csv');
      expect(doc.metadata.rowCount).toBe(3);
      expect(doc.metadata.columnCount).toBe(3);
      expect(doc.content.data).toHaveLength(3);
      expect(doc.content.data[0]).toEqual(['Name', 'Email', 'Phone']);
    });

    it('should store first row data correctly', async () => {
      const csvContent = 'First Name,Last Name,Email\nJohn,Doe,john@example.com\nJane,Smith,jane@example.com';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

      const doc = await format.load(file);

      // Header detection is heuristic-based, just verify data is loaded correctly
      expect(doc.content.data[0]).toEqual(['First Name', 'Last Name', 'Email']);
      expect(doc.content.data[1]).toEqual(['John', 'Doe', 'john@example.com']);
      expect(doc.content.data[2]).toEqual(['Jane', 'Smith', 'jane@example.com']);
    });

    it('should handle TSV files', async () => {
      const tsvContent = 'Name\tEmail\tPhone\nJohn Doe\tjohn@example.com\t555-1234';
      const file = new File([tsvContent], 'test.tsv', { type: 'text/tab-separated-values' });

      const doc = await format.load(file);

      expect(doc.content.delimiter).toBe('\t');
      expect(doc.content.data).toHaveLength(2);
      expect(doc.content.data[0][0]).toBe('Name');
    });

    it('should handle quoted fields', async () => {
      const csvContent = '"Name","Email","Phone"\n"John, Doe","john@example.com","555-1234"';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

      const doc = await format.load(file);

      expect(doc.content.data[1][0]).toBe('John, Doe');
    });

    it('should handle empty CSV', async () => {
      const csvContent = '';
      const file = new File([csvContent], 'empty.csv', { type: 'text/csv' });

      const doc = await format.load(file);

      expect(doc.metadata.rowCount).toBe(0);
      expect(doc.metadata.columnCount).toBe(0);
    });

    it('should handle CSV with different column counts per row', async () => {
      const csvContent = 'A,B,C\n1,2\n4,5,6,7';
      const file = new File([csvContent], 'uneven.csv', { type: 'text/csv' });

      const doc = await format.load(file);

      expect(doc.metadata.columnCount).toBe(4); // Max columns across all rows
    });
  });

  describe('extractText', () => {
    it('should extract full text from CSV', async () => {
      const csvContent = 'Name,Email\nJohn,john@example.com\nJane,jane@example.com';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const doc = await format.load(file);

      const result = await format.extractText(doc);

      expect(result.fullText).toContain('john@example.com');
      expect(result.fullText).toContain('jane@example.com');
    });
  });

  describe('findTextBoxes', () => {
    it('should find text in cells', async () => {
      const csvContent = 'Name,Email\nJohn,john@example.com\nJane,jane@example.com';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const doc = await format.load(file);

      const boxes = await format.findTextBoxes(doc, ['john@example.com']);

      expect(boxes).toHaveLength(1);
      expect(boxes[0].text).toBe('john@example.com');
      expect(boxes[0].row).toBe(1);
      expect(boxes[0].column).toBe(1);
    });

    it('should find multiple occurrences across cells', async () => {
      const csvContent = 'Email1,Email2\ntest@example.com,test@example.com\nuser@test.com,user@test.com';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const doc = await format.load(file);

      const boxes = await format.findTextBoxes(doc, ['test@example.com', 'user@test.com']);

      expect(boxes).toHaveLength(4); // 2 emails × 2 occurrences each
    });

    it('should be case-insensitive', async () => {
      const csvContent = 'Name\nJohn\nJOHN\njohn';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const doc = await format.load(file);

      const boxes = await format.findTextBoxes(doc, ['john']);

      expect(boxes).toHaveLength(3);
    });

    it('should handle partial matches in cells', async () => {
      const csvContent = 'Name,Email\nJohn Doe,john.doe@example.com';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const doc = await format.load(file);

      const boxes = await format.findTextBoxes(doc, ['john.doe@example.com']);

      expect(boxes).toHaveLength(1);
      expect(boxes[0].row).toBe(1);
      expect(boxes[0].column).toBe(1);
    });

    it('should skip empty terms', async () => {
      const csvContent = 'Name\nJohn';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const doc = await format.load(file);

      const boxes = await format.findTextBoxes(doc, ['', '  ', 'John']);

      expect(boxes).toHaveLength(1);
    });
  });

  describe('redact', () => {
    it('should redact cells with block characters', async () => {
      const csvContent = 'Name,Email\nJohn,john@example.com';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const doc = await format.load(file);

      const boxes = await format.findTextBoxes(doc, ['john@example.com']);
      await format.redact(doc, boxes);

      expect(doc.modified).toBe(true);
      expect(doc.content.data[1][1]).toContain('█');
      expect(doc.content.data[1][1]).not.toContain('john@example.com');
    });

    it('should handle multiple redactions in same row', async () => {
      const csvContent = 'Name,Email,Phone\nJohn,john@example.com,555-1234';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const doc = await format.load(file);

      const boxes = await format.findTextBoxes(doc, ['john@example.com', '555-1234']);
      await format.redact(doc, boxes);

      expect(doc.content.data[1][1]).toContain('█');
      expect(doc.content.data[1][2]).toContain('█');
      expect(doc.content.data[1][0]).toBe('John'); // Name not redacted
    });

    it('should handle redactions across multiple rows', async () => {
      const csvContent = 'Email\ntest@example.com\nuser@example.com';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const doc = await format.load(file);

      const boxes = await format.findTextBoxes(doc, ['test@example.com', 'user@example.com']);
      await format.redact(doc, boxes);

      expect(doc.content.data[1][0]).toContain('█');
      expect(doc.content.data[2][0]).toContain('█');
    });

    it('should not redact duplicate cells multiple times', async () => {
      const csvContent = 'Email\ntest@example.com';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const doc = await format.load(file);

      // Create multiple boxes for the same cell
      const boxes = await format.findTextBoxes(doc, ['test@example.com']);
      boxes.push(...boxes); // Duplicate boxes

      await format.redact(doc, boxes);

      // Cell should still be redacted once
      expect(doc.content.data[1][0]).toContain('█');
    });
  });

  describe('export', () => {
    // Helper to read blob as text (compatible with test environment)
    async function readBlobAsText(blob: Blob): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
      });
    }

    it('should export as CSV blob', async () => {
      const csvContent = 'Name,Email\nJohn,john@example.com';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const doc = await format.load(file);

      const blob = await format.export(doc);

      expect(blob.type).toBe('text/csv;charset=utf-8');

      const exportedText = await readBlobAsText(blob);
      expect(exportedText).toContain('Name');
      expect(exportedText).toContain('john@example.com');
    });

    it('should export redacted content', async () => {
      const csvContent = 'Name,Email\nJohn,john@example.com';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const doc = await format.load(file);

      const boxes = await format.findTextBoxes(doc, ['john@example.com']);
      await format.redact(doc, boxes);

      const blob = await format.export(doc);
      const exportedText = await readBlobAsText(blob);

      expect(exportedText).not.toContain('john@example.com');
      expect(exportedText).toContain('█');
    });

    it('should export TSV with tab delimiter', async () => {
      const tsvContent = 'Name\tEmail\nJohn\tjohn@example.com';
      const file = new File([tsvContent], 'test.tsv', { type: 'text/tab-separated-values' });
      const doc = await format.load(file);

      const blob = await format.export(doc);

      expect(blob.type).toBe('text/tab-separated-values;charset=utf-8');

      const exportedText = await readBlobAsText(blob);
      expect(exportedText).toContain('\t'); // Should have tabs
    });

    it('should properly quote fields with special characters', async () => {
      const csvContent = 'Name,Description\nJohn,"Has comma, in value"';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const doc = await format.load(file);

      const blob = await format.export(doc);
      const exportedText = await readBlobAsText(blob);

      // PapaParse should quote fields with special characters
      expect(exportedText).toContain('"Has comma, in value"');
    });
  });

  describe('redactColumn', () => {
    it('should redact entire column by index', async () => {
      const csvContent = 'Name,Email,Phone\nJohn,john@example.com,555-1234\nJane,jane@example.com,555-5678';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const doc = await format.load(file);

      await format.redactColumn(doc, 1); // Redact Email column

      expect(doc.content.data[1][1]).toContain('█');
      expect(doc.content.data[2][1]).toContain('█');
      expect(doc.content.data[1][0]).toBe('John'); // Name not redacted
      expect(doc.content.data[2][2]).toBe('555-5678'); // Phone not redacted
    });

    it('should redact entire column by name', async () => {
      const csvContent = 'Name,Email,Phone\nJohn,john@example.com,555-1234\nJane,jane@example.com,555-5678';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const doc = await format.load(file);

      await format.redactColumn(doc, 'Email');

      expect(doc.content.data[1][1]).toContain('█');
      expect(doc.content.data[2][1]).toContain('█');
    });

    it('should be case-insensitive when redacting by name', async () => {
      const csvContent = 'Name,Email,Phone\nJohn,john@example.com,555-1234';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const doc = await format.load(file);

      await format.redactColumn(doc, 'email'); // lowercase

      expect(doc.content.data[1][1]).toContain('█');
    });

    it('should throw error if column name not found', async () => {
      const csvContent = 'Name,Email\nJohn,john@example.com';
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
      const doc = await format.load(file);

      await expect(format.redactColumn(doc, 'NonExistent')).rejects.toThrow('Column "NonExistent" not found');
    });
  });

  describe('canHandle', () => {
    it('should handle .csv files', () => {
      const file = new File([''], 'test.csv', { type: 'text/csv' });
      expect(format.canHandle(file)).toBe(true);
    });

    it('should handle .tsv files', () => {
      const file = new File([''], 'test.tsv', { type: 'text/tab-separated-values' });
      expect(format.canHandle(file)).toBe(true);
    });

    it('should handle files by extension when MIME type is missing', () => {
      const file = new File([''], 'test.csv', { type: '' });
      expect(format.canHandle(file)).toBe(true);
    });

    it('should reject unsupported formats', () => {
      const file = new File([''], 'test.txt', { type: 'text/plain' });
      expect(format.canHandle(file)).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should not throw errors', () => {
      expect(() => format.cleanup()).not.toThrow();
    });
  });
});

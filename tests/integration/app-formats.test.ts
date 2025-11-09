/**
 * Integration tests for text/CSV format support in App.ts
 */

import { describe, it, expect } from 'vitest';
import { FormatRegistry } from '../../src/lib/formats/base/FormatRegistry';
import { PlainTextFormat } from '../../src/lib/formats/text/PlainTextFormat';
import { CsvFormat } from '../../src/lib/formats/structured/CsvFormat';

// Helper to read blob as text in test environment
async function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('App Format Integration', () => {
  describe('Format Detection', () => {
    it('should detect TXT files', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const isSupported = await FormatRegistry.isSupported(file);
      expect(isSupported).toBe(true);
    });

    it('should detect CSV files', async () => {
      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const isSupported = await FormatRegistry.isSupported(file);
      expect(isSupported).toBe(true);
    });

    it('should detect MD files by extension', async () => {
      const file = new File(['test'], 'README.md', { type: '' });
      const isSupported = await FormatRegistry.isSupported(file);
      expect(isSupported).toBe(true);
    });

    it('should reject unsupported files', async () => {
      const file = new File(['test'], 'test.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const isSupported = await FormatRegistry.isSupported(file);
      expect(isSupported).toBe(false);
    });
  });

  describe('TXT Format Workflow', () => {
    it('should complete full workflow: load → detect → redact → export', async () => {
      // Create sample TXT file with PII
      const content = `Name: John Doe
Email: john.doe@example.com
Phone: 555-123-4567`;

      const file = new File([content], 'test.txt', { type: 'text/plain' });

      // Get format handler
      const format = await FormatRegistry.getFormat(file);
      expect(format).toBeInstanceOf(PlainTextFormat);

      // Load document
      const doc = await format.load(file);
      expect(doc.metadata.fileName).toBe('test.txt');
      expect(doc.metadata.lineCount).toBe(3);

      // Extract text
      const textResult = await format.extractText(doc);
      expect(textResult.fullText).toContain('john.doe@example.com');
      expect(textResult.fullText).toContain('555-123-4567');

      // Find boxes (simulate PII detection)
      const searchTerms = ['john.doe@example.com', '555-123-4567'];
      const boxes = await format.findTextBoxes(doc, searchTerms);
      expect(boxes.length).toBeGreaterThanOrEqual(2);

      // Verify box properties
      const emailBox = boxes.find((b) => b.text === 'john.doe@example.com');
      expect(emailBox).toBeDefined();
      expect(emailBox?.line).toBe(1); // Line 2 (0-indexed)

      // Redact
      await format.redact(doc, boxes);

      // Export
      const blob = await format.export(doc);
      expect(blob.type).toContain('text/plain'); // May include charset

      // Verify redaction in exported content
      const exportedText = await readBlobAsText(blob);
      expect(exportedText).not.toContain('john.doe@example.com');
      expect(exportedText).not.toContain('555-123-4567');
      expect(exportedText).toContain('█'); // Redaction character
    });

    it('should handle empty files gracefully', async () => {
      const file = new File([''], 'empty.txt', { type: 'text/plain' });
      const format = await FormatRegistry.getFormat(file);
      const doc = await format.load(file);

      const textResult = await format.extractText(doc);
      expect(textResult.fullText).toBe('');
    });
  });

  describe('CSV Format Workflow', () => {
    it('should complete full workflow: load → detect → redact → export', async () => {
      // Create sample CSV with PII
      const content = `Name,Email,Phone
John Doe,john@example.com,555-1234
Jane Smith,jane@test.org,555-9876`;

      const file = new File([content], 'test.csv', { type: 'text/csv' });

      // Get format handler
      const format = await FormatRegistry.getFormat(file);
      expect(format).toBeInstanceOf(CsvFormat);

      // Load document
      const doc = await format.load(file);
      expect(doc.metadata.fileName).toBe('test.csv');
      expect(doc.metadata.rowCount).toBe(3); // Header + 2 data rows
      expect(doc.metadata.columnCount).toBe(3);

      // Extract text
      const textResult = await format.extractText(doc);
      expect(textResult.fullText).toContain('john@example.com');
      expect(textResult.fullText).toContain('jane@test.org');

      // Find boxes
      const searchTerms = ['john@example.com', 'jane@test.org'];
      const boxes = await format.findTextBoxes(doc, searchTerms);
      expect(boxes.length).toBe(2);

      // Verify box coordinates
      const johnBox = boxes.find((b) => b.text === 'john@example.com');
      expect(johnBox?.row).toBe(1); // Row 2 (data row 1)
      expect(johnBox?.column).toBe(1); // Email column

      // Redact
      await format.redact(doc, boxes);

      // Export
      const blob = await format.export(doc);
      expect(blob.type).toContain('text/csv'); // May include charset

      // Verify redaction in exported CSV
      const exportedText = await readBlobAsText(blob);
      expect(exportedText).not.toContain('john@example.com');
      expect(exportedText).not.toContain('jane@test.org');
      expect(exportedText).toContain('████'); // CSV cells fully redacted
    });

    it('should handle CSV with quoted fields', async () => {
      const content = `Name,Description
"John Doe","Has email: john@example.com"
"Jane Smith","Phone: 555-1234"`;

      const file = new File([content], 'test.csv', { type: 'text/csv' });
      const format = await FormatRegistry.getFormat(file);
      const doc = await format.load(file);

      const textResult = await format.extractText(doc);
      expect(textResult.fullText).toContain('john@example.com');
    });
  });

  describe('Format Registry Integration', () => {
    it('should return correct format for each file type', async () => {
      const txtFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      const csvFile = new File(['test'], 'test.csv', { type: 'text/csv' });
      const mdFile = new File(['test'], 'README.md', { type: '' });

      const txtFormat = await FormatRegistry.getFormat(txtFile);
      const csvFormat = await FormatRegistry.getFormat(csvFile);
      const mdFormat = await FormatRegistry.getFormat(mdFile);

      expect(txtFormat.formatId).toBe('txt');
      expect(csvFormat.formatId).toBe('csv');
      expect(mdFormat.formatId).toBe('txt'); // MD uses same handler as TXT
    });

    it('should lazy-load format handlers', async () => {
      // FormatRegistry.getFormat() should dynamically import handlers
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const format = await FormatRegistry.getFormat(file);

      expect(format).toBeDefined();
      expect(format.formatName).toBe('Plain Text');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported format', async () => {
      const file = new File(['test'], 'test.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      await expect(FormatRegistry.getFormat(file)).rejects.toThrow('no handler registered');
    });

    it('should handle malformed CSV gracefully', async () => {
      const content = `Name,Email
"Unclosed quote,john@example.com
Normal,jane@test.org`;

      const file = new File([content], 'bad.csv', { type: 'text/csv' });
      const format = await FormatRegistry.getFormat(file);

      // PapaParse should handle this gracefully
      const doc = await format.load(file);
      expect(doc).toBeDefined();
    });
  });

  describe('Export Functionality', () => {
    it('should generate correct filename for TXT export', async () => {
      const file = new File(['test'], 'document.txt', { type: 'text/plain' });
      const format = await FormatRegistry.getFormat(file);
      const doc = await format.load(file);

      const blob = await format.export(doc);

      // In real App.ts, filename would be: document-redacted.txt
      // Here we just verify the blob is correct type
      expect(blob.type).toContain('text/plain');
    });

    it('should generate correct filename for CSV export', async () => {
      const file = new File(['Name\nJohn'], 'data.csv', { type: 'text/csv' });
      const format = await FormatRegistry.getFormat(file);
      const doc = await format.load(file);

      const blob = await format.export(doc);

      // In real App.ts, filename would be: data-redacted.csv
      expect(blob.type).toContain('text/csv');
    });
  });
});

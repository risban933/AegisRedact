/**
 * Unit tests for FormatRegistry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FormatRegistry } from '../../../../src/lib/formats/base/FormatRegistry';

describe('FormatRegistry', () => {
  beforeEach(() => {
    // Clear registry before each test
    FormatRegistry.clear();
  });

  describe('detectFormat', () => {
    it('should detect format from MIME type', () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const format = FormatRegistry.detectFormat(file);
      expect(format).toBe('txt');
    });

    it('should detect format from file extension when MIME type is missing', () => {
      const file = new File(['test content'], 'test.txt', { type: '' });
      const format = FormatRegistry.detectFormat(file);
      expect(format).toBe('txt');
    });

    it('should detect .md files', () => {
      const file = new File(['# Heading'], 'README.md', { type: 'text/markdown' });
      const format = FormatRegistry.detectFormat(file);
      expect(format).toBe('md');
    });

    it('should detect .md files by extension fallback', () => {
      const file = new File(['# Heading'], 'README.md', { type: '' });
      const format = FormatRegistry.detectFormat(file);
      expect(format).toBe('md');
    });

    it('should detect PDF files', () => {
      const file = new File(['%PDF-1.4'], 'document.pdf', { type: 'application/pdf' });
      const format = FormatRegistry.detectFormat(file);
      expect(format).toBe('pdf');
    });

    it('should detect image files', () => {
      const pngFile = new File([''], 'image.png', { type: 'image/png' });
      expect(FormatRegistry.detectFormat(pngFile)).toBe('png');

      const jpgFile = new File([''], 'image.jpg', { type: 'image/jpeg' });
      expect(FormatRegistry.detectFormat(jpgFile)).toBe('jpg');
    });

    it('should detect Office documents', () => {
      const docxFile = new File([''], 'document.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      expect(FormatRegistry.detectFormat(docxFile)).toBe('docx');

      const xlsxFile = new File([''], 'spreadsheet.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      expect(FormatRegistry.detectFormat(xlsxFile)).toBe('xlsx');
    });

    it('should return null for unsupported formats', () => {
      const file = new File(['test'], 'test.unknown', { type: 'application/octet-stream' });
      const format = FormatRegistry.detectFormat(file);
      expect(format).toBeNull();
    });

    it('should handle files without extensions', () => {
      const file = new File(['test'], 'README', { type: 'text/plain' });
      const format = FormatRegistry.detectFormat(file);
      expect(format).toBe('txt');
    });

    it('should be case-insensitive for extensions', () => {
      const file1 = new File(['test'], 'test.TXT', { type: '' });
      expect(FormatRegistry.detectFormat(file1)).toBe('txt');

      const file2 = new File(['test'], 'test.MD', { type: '' });
      expect(FormatRegistry.detectFormat(file2)).toBe('md');
    });
  });

  describe('getSupportedExtensions', () => {
    it('should return array of supported extensions', () => {
      const extensions = FormatRegistry.getSupportedExtensions();
      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions.length).toBeGreaterThan(0);
      expect(extensions).toContain('txt');
      expect(extensions).toContain('md');
      expect(extensions).toContain('pdf');
    });
  });

  describe('getSupportedMimeTypes', () => {
    it('should return array of supported MIME types', () => {
      const mimeTypes = FormatRegistry.getSupportedMimeTypes();
      expect(Array.isArray(mimeTypes)).toBe(true);
      expect(mimeTypes.length).toBeGreaterThan(0);
      expect(mimeTypes).toContain('text/plain');
      expect(mimeTypes).toContain('application/pdf');
    });
  });

  describe('getFormatName', () => {
    it('should return human-readable format names', () => {
      const txtFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      expect(FormatRegistry.getFormatName(txtFile)).toBe('Plain Text');

      const mdFile = new File(['# Heading'], 'README.md', { type: 'text/markdown' });
      expect(FormatRegistry.getFormatName(mdFile)).toBe('Markdown');

      const pdfFile = new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' });
      expect(FormatRegistry.getFormatName(pdfFile)).toBe('PDF Document');
    });

    it('should return "Unknown Format" for unsupported files', () => {
      const file = new File(['test'], 'test.xyz', { type: 'application/octet-stream' });
      expect(FormatRegistry.getFormatName(file)).toBe('Unknown Format');
    });
  });

  describe('getFormat', () => {
    it('should return format handler for supported files', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const format = await FormatRegistry.getFormat(file);

      expect(format).toBeDefined();
      expect(format.formatId).toBe('txt');
      expect(format.formatName).toBe('Plain Text');
    });

    it('should throw error for unsupported files', async () => {
      const file = new File(['test'], 'test.unknown', { type: 'application/octet-stream' });

      await expect(FormatRegistry.getFormat(file)).rejects.toThrow('Unsupported file format');
    });

    it('should return same format for .txt and .md files', async () => {
      const txtFile = new File(['plain text'], 'test.txt', { type: 'text/plain' });
      const mdFile = new File(['# Markdown'], 'test.md', { type: 'text/markdown' });

      const txtFormat = await FormatRegistry.getFormat(txtFile);
      const mdFormat = await FormatRegistry.getFormat(mdFile);

      expect(txtFormat.formatId).toBe('txt');
      expect(mdFormat.formatId).toBe('txt');
    });
  });

  describe('isSupported', () => {
    it('should return true for supported formats', async () => {
      const txtFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      expect(await FormatRegistry.isSupported(txtFile)).toBe(true);

      const mdFile = new File(['test'], 'test.md', { type: 'text/markdown' });
      expect(await FormatRegistry.isSupported(mdFile)).toBe(true);
    });

    it('should return false for unsupported formats', async () => {
      const file = new File(['test'], 'test.unknown', { type: 'application/octet-stream' });
      expect(await FormatRegistry.isSupported(file)).toBe(false);
    });
  });

  describe('getSupportedFormats', () => {
    it('should return array of format IDs', async () => {
      const formats = await FormatRegistry.getSupportedFormats();
      expect(Array.isArray(formats)).toBe(true);
      expect(formats.length).toBeGreaterThan(0);
      expect(formats).toContain('txt');
      expect(formats).toContain('md');
    });
  });
});

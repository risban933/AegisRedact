/**
 * Unit tests for PlainTextFormat
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlainTextFormat } from '../../../../src/lib/formats/text/PlainTextFormat';
import type { Document, RenderOptions } from '../../../../src/lib/formats/base/types';

describe('PlainTextFormat', () => {
  let format: PlainTextFormat;

  beforeEach(() => {
    format = new PlainTextFormat();
  });

  describe('constructor', () => {
    it('should have correct format metadata', () => {
      expect(format.formatId).toBe('txt');
      expect(format.formatName).toBe('Plain Text');
      expect(format.supportedExtensions).toContain('txt');
      expect(format.supportedExtensions).toContain('md');
      expect(format.mimeTypes).toContain('text/plain');
    });

    it('should have correct capabilities', () => {
      expect(format.capabilities.canRenderToDOM).toBe(true);
      expect(format.capabilities.canRenderToCanvas).toBe(false);
      expect(format.capabilities.requiresOCR).toBe(false);
      expect(format.capabilities.supportsDirectExport).toBe(true);
    });
  });

  describe('load', () => {
    it('should load a text file', async () => {
      const content = 'Hello, World!\nThis is a test.';
      const file = new File([content], 'test.txt', { type: 'text/plain' });

      const doc = await format.load(file);

      expect(doc.metadata.fileName).toBe('test.txt');
      expect(doc.metadata.format).toBe('txt');
      expect(doc.metadata.lineCount).toBe(2);
      expect(doc.content.fullText).toBe(content);
      expect(doc.content.lines).toHaveLength(2);
      expect(doc.content.lines[0]).toBe('Hello, World!');
      expect(doc.content.lines[1]).toBe('This is a test.');
    });

    it('should handle empty files', async () => {
      const file = new File([''], 'empty.txt', { type: 'text/plain' });
      const doc = await format.load(file);

      expect(doc.metadata.lineCount).toBe(1);
      expect(doc.content.fullText).toBe('');
      expect(doc.content.lines).toHaveLength(1);
    });

    it('should handle files with multiple line breaks', async () => {
      const content = 'Line 1\n\nLine 3\n\n\nLine 6';
      const file = new File([content], 'test.txt', { type: 'text/plain' });

      const doc = await format.load(file);

      expect(doc.metadata.lineCount).toBe(6);
      expect(doc.content.lines[1]).toBe('');
      expect(doc.content.lines[3]).toBe('');
      expect(doc.content.lines[4]).toBe('');
    });
  });

  describe('extractText', () => {
    it('should extract full text', async () => {
      const content = 'Hello, World!\nThis is a test.';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      const doc = await format.load(file);

      const result = await format.extractText(doc);

      expect(result.fullText).toBe(content);
      expect(result.lineText).toHaveLength(2);
      expect(result.lineText![0]).toBe('Hello, World!');
      expect(result.lineText![1]).toBe('This is a test.');
    });
  });

  describe('findTextBoxes', () => {
    it('should find single occurrence of a term', async () => {
      const content = 'Hello, World!';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      const doc = await format.load(file);

      const boxes = await format.findTextBoxes(doc, ['World']);

      expect(boxes).toHaveLength(1);
      expect(boxes[0].text).toBe('World');
      expect(boxes[0].line).toBe(0);
    });

    it('should find multiple occurrences across lines', async () => {
      const content = 'email: test@example.com\nAnother email: user@example.com';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      const doc = await format.load(file);

      const boxes = await format.findTextBoxes(doc, ['test@example.com', 'user@example.com']);

      expect(boxes).toHaveLength(2);
      expect(boxes[0].text).toBe('test@example.com');
      expect(boxes[0].line).toBe(0);
      expect(boxes[1].text).toBe('user@example.com');
      expect(boxes[1].line).toBe(1);
    });

    it('should find multiple occurrences of same term in one line', async () => {
      const content = 'test test test';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      const doc = await format.load(file);

      const boxes = await format.findTextBoxes(doc, ['test']);

      expect(boxes).toHaveLength(3);
      expect(boxes.every(box => box.line === 0)).toBe(true);
    });

    it('should be case-insensitive', async () => {
      const content = 'Hello hello HELLO';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      const doc = await format.load(file);

      const boxes = await format.findTextBoxes(doc, ['hello']);

      expect(boxes).toHaveLength(3);
      expect(boxes[0].text).toBe('Hello');
      expect(boxes[1].text).toBe('hello');
      expect(boxes[2].text).toBe('HELLO');
    });

    it('should handle empty terms array', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const doc = await format.load(file);

      const boxes = await format.findTextBoxes(doc, []);

      expect(boxes).toHaveLength(0);
    });

    it('should skip empty terms', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const doc = await format.load(file);

      const boxes = await format.findTextBoxes(doc, ['', '  ', 'test']);

      expect(boxes).toHaveLength(1);
      expect(boxes[0].text).toBe('test');
    });
  });

  describe('redact', () => {
    it('should redact text with block characters', async () => {
      const content = 'My email is test@example.com';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      const doc = await format.load(file);

      const boxes = await format.findTextBoxes(doc, ['test@example.com']);
      await format.redact(doc, boxes);

      expect(doc.modified).toBe(true);
      expect(doc.content.fullText).toContain('████████████████');
      expect(doc.content.fullText).not.toContain('test@example.com');
    });

    it('should handle multiple redactions in same line', async () => {
      const content = 'Email: test@example.com Phone: 555-1234';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      const doc = await format.load(file);

      const boxes = await format.findTextBoxes(doc, ['test@example.com', '555-1234']);
      await format.redact(doc, boxes);

      expect(doc.content.fullText).not.toContain('test@example.com');
      expect(doc.content.fullText).not.toContain('555-1234');
      expect(doc.content.fullText).toContain('Email:');
      expect(doc.content.fullText).toContain('Phone:');
    });

    it('should handle redactions across multiple lines', async () => {
      const content = 'Line 1: test@example.com\nLine 2: user@test.com';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      const doc = await format.load(file);

      const boxes = await format.findTextBoxes(doc, ['test@example.com', 'user@test.com']);
      await format.redact(doc, boxes);

      const lines = doc.content.fullText.split('\n');
      expect(lines[0]).not.toContain('test@example.com');
      expect(lines[1]).not.toContain('user@test.com');
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

    it('should export as plain text blob', async () => {
      const content = 'Hello, World!';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      const doc = await format.load(file);

      const blob = await format.export(doc);

      expect(blob.type).toBe('text/plain;charset=utf-8');

      const exportedText = await readBlobAsText(blob);
      expect(exportedText).toBe(content);
    });

    it('should export redacted content', async () => {
      const content = 'My email is test@example.com';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      const doc = await format.load(file);

      const boxes = await format.findTextBoxes(doc, ['test@example.com']);
      await format.redact(doc, boxes);

      const blob = await format.export(doc);
      const exportedText = await readBlobAsText(blob);

      expect(exportedText).not.toContain('test@example.com');
      expect(exportedText).toContain('█');
    });
  });

  describe('canHandle', () => {
    it('should handle .txt files', () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      expect(format.canHandle(file)).toBe(true);
    });

    it('should handle .md files', () => {
      const file = new File(['# Test'], 'README.md', { type: 'text/markdown' });
      expect(format.canHandle(file)).toBe(true);
    });

    it('should handle files by extension when MIME type is missing', () => {
      const file = new File(['test'], 'test.txt', { type: '' });
      expect(format.canHandle(file)).toBe(true);
    });

    it('should reject unsupported formats', () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      expect(format.canHandle(file)).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should not throw errors', () => {
      expect(() => format.cleanup()).not.toThrow();
    });
  });
});

/**
 * Format registry for detecting and instantiating document format handlers
 * Uses factory pattern to create appropriate format instances
 */

import type { DocumentFormat } from './DocumentFormat';
import { MIME_TYPES, FILE_EXTENSIONS } from './types';

/**
 * Registry of all supported document formats
 */
export class FormatRegistry {
  private static formats: Map<string, () => DocumentFormat> = new Map();
  private static initialized = false;

  /**
   * Register a format handler
   *
   * @param formatId - Unique format identifier (pdf, docx, txt, etc.)
   * @param factory - Factory function that creates a format instance
   */
  static register(formatId: string, factory: () => DocumentFormat): void {
    this.formats.set(formatId, factory);
  }

  /**
   * Initialize the registry with all format handlers
   * Lazy loads format implementations to reduce initial bundle size
   */
  private static async initialize(): Promise<void> {
    if (this.initialized) return;

    // Register plain text format (no external dependencies)
    const { PlainTextFormat } = await import('../text/PlainTextFormat');
    this.register('txt', () => new PlainTextFormat());
    this.register('md', () => new PlainTextFormat());

    // Future format registrations will go here
    // Note: These will be lazy-loaded in subsequent phases

    this.initialized = true;
  }

  /**
   * Detect format from file and return appropriate handler
   *
   * @param file - The file to detect format for
   * @returns Promise<DocumentFormat> - Format handler instance
   * @throws {Error} If format is not supported
   */
  static async getFormat(file: File): Promise<DocumentFormat> {
    await this.initialize();

    const formatId = this.detectFormat(file);

    if (!formatId) {
      throw new Error(
        `Unsupported file format: ${file.name}\n` +
        `MIME type: ${file.type || 'unknown'}\n` +
        `Please use PDF, images, or supported text formats.`
      );
    }

    const factory = this.formats.get(formatId);

    if (!factory) {
      throw new Error(
        `Format "${formatId}" detected but no handler registered.\n` +
        `This format may not be implemented yet.`
      );
    }

    return factory();
  }

  /**
   * Detect format identifier from file
   *
   * @param file - The file to detect
   * @returns string | null - Format identifier or null if unknown
   */
  static detectFormat(file: File): string | null {
    // Try MIME type first (most reliable)
    if (file.type && MIME_TYPES[file.type]) {
      return MIME_TYPES[file.type];
    }

    // Fallback to file extension
    const extension = this.getFileExtension(file.name);
    if (extension && FILE_EXTENSIONS[extension]) {
      return FILE_EXTENSIONS[extension];
    }

    return null;
  }

  /**
   * Check if a file format is supported
   *
   * @param file - The file to check
   * @returns Promise<boolean> - True if format is supported
   */
  static async isSupported(file: File): Promise<boolean> {
    await this.initialize();

    const formatId = this.detectFormat(file);
    return formatId !== null && this.formats.has(formatId);
  }

  /**
   * Get list of all supported format identifiers
   *
   * @returns Promise<string[]> - Array of format IDs
   */
  static async getSupportedFormats(): Promise<string[]> {
    await this.initialize();
    return Array.from(this.formats.keys());
  }

  /**
   * Get list of supported file extensions
   *
   * @returns string[] - Array of extensions (without dots)
   */
  static getSupportedExtensions(): string[] {
    return Object.keys(FILE_EXTENSIONS);
  }

  /**
   * Get list of supported MIME types
   *
   * @returns string[] - Array of MIME types
   */
  static getSupportedMimeTypes(): string[] {
    return Object.keys(MIME_TYPES);
  }

  /**
   * Get file extension from filename
   *
   * @param filename - The filename to parse
   * @returns string - Lowercase extension without dot
   */
  private static getFileExtension(filename: string): string {
    const parts = filename.split('.');
    if (parts.length < 2) return '';
    return parts[parts.length - 1].toLowerCase();
  }

  /**
   * Get human-readable format name from file
   *
   * @param file - The file to check
   * @returns string - Format name (e.g., "PDF Document", "Plain Text")
   */
  static getFormatName(file: File): string {
    const formatId = this.detectFormat(file);

    const names: Record<string, string> = {
      'pdf': 'PDF Document',
      'png': 'PNG Image',
      'jpg': 'JPEG Image',
      'gif': 'GIF Image',
      'webp': 'WebP Image',
      'bmp': 'Bitmap Image',
      'docx': 'Word Document',
      'xlsx': 'Excel Spreadsheet',
      'pptx': 'PowerPoint Presentation',
      'txt': 'Plain Text',
      'md': 'Markdown',
      'csv': 'CSV File',
      'tsv': 'TSV File',
      'rtf': 'Rich Text Format',
      'html': 'HTML Document',
      'epub': 'EPUB eBook',
      'mobi': 'Mobi eBook'
    };

    return formatId ? names[formatId] || 'Unknown Format' : 'Unknown Format';
  }

  /**
   * Clear the registry (for testing)
   */
  static clear(): void {
    this.formats.clear();
    this.initialized = false;
  }
}

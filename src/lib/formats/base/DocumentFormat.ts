/**
 * Abstract base class for all document format handlers
 * Each format (PDF, DOCX, TXT, etc.) implements this interface
 */

import type {
  BoundingBox,
  Document,
  DocumentMetadata,
  RenderOptions,
  ExportOptions,
  TextExtractionResult,
  FormatCapabilities
} from './types';

export abstract class DocumentFormat {
  /**
   * Format identifier (pdf, docx, txt, etc.)
   */
  abstract readonly formatId: string;

  /**
   * Human-readable format name
   */
  abstract readonly formatName: string;

  /**
   * Supported file extensions for this format
   */
  abstract readonly supportedExtensions: string[];

  /**
   * Supported MIME types for this format
   */
  abstract readonly mimeTypes: string[];

  /**
   * Format capabilities
   */
  abstract readonly capabilities: FormatCapabilities;

  /**
   * Load a file and convert to internal document representation
   *
   * @param file - The file to load
   * @returns Promise<Document> - Parsed document structure
   * @throws {Error} If file is corrupted or unsupported version
   */
  abstract load(file: File): Promise<Document>;

  /**
   * Render the document to a container element
   *
   * @param doc - The document to render
   * @param options - Rendering options
   * @returns Promise<void>
   * @throws {Error} If rendering fails
   */
  abstract render(doc: Document, options: RenderOptions): Promise<void>;

  /**
   * Extract text content from the document
   *
   * @param doc - The document to extract text from
   * @param page - Optional page number (for multi-page documents)
   * @returns Promise<TextExtractionResult>
   */
  abstract extractText(doc: Document, page?: number): Promise<TextExtractionResult>;

  /**
   * Find bounding boxes for specific text terms in the document
   * This maps detected PII text to visual coordinates
   *
   * @param doc - The document to search
   * @param terms - Array of text terms to find
   * @param page - Optional page number to search
   * @returns Promise<BoundingBox[]> - Array of bounding boxes
   */
  abstract findTextBoxes(doc: Document, terms: string[], page?: number): Promise<BoundingBox[]>;

  /**
   * Apply redaction boxes to the document
   * This modifies the document in-place
   *
   * @param doc - The document to redact
   * @param boxes - Array of bounding boxes to redact
   * @returns Promise<void>
   */
  abstract redact(doc: Document, boxes: BoundingBox[]): Promise<void>;

  /**
   * Export the redacted document
   *
   * @param doc - The document to export
   * @param options - Export options
   * @returns Promise<Blob> - The exported file
   */
  abstract export(doc: Document, options?: ExportOptions): Promise<Blob>;

  /**
   * Cleanup resources (workers, cached data, etc.)
   * Called when document is closed or app is unmounted
   */
  abstract cleanup(): void;

  /**
   * Check if this format can handle a given file
   *
   * @param file - The file to check
   * @returns boolean - True if this format can handle the file
   */
  canHandle(file: File): boolean {
    // Check MIME type first (more reliable)
    if (file.type && this.mimeTypes.includes(file.type)) {
      return true;
    }

    // Fallback to extension check
    const extension = this.getFileExtension(file.name);
    return this.supportedExtensions.includes(extension);
  }

  /**
   * Get file extension from filename
   *
   * @param filename - The filename to parse
   * @returns string - Lowercase extension without dot
   */
  protected getFileExtension(filename: string): string {
    const parts = filename.split('.');
    if (parts.length < 2) return '';
    return parts[parts.length - 1].toLowerCase();
  }

  /**
   * Validate bounding box coordinates
   * Ensures box is within valid bounds and has positive dimensions
   *
   * @param box - The box to validate
   * @param maxWidth - Maximum allowed width
   * @param maxHeight - Maximum allowed height
   * @returns boolean - True if box is valid
   */
  protected validateBox(box: BoundingBox, maxWidth?: number, maxHeight?: number): boolean {
    // Check for NaN or negative values
    if (isNaN(box.x) || isNaN(box.y) || isNaN(box.w) || isNaN(box.h)) {
      return false;
    }

    if (box.w <= 0 || box.h <= 0) {
      return false;
    }

    // Check bounds if provided
    if (maxWidth !== undefined && (box.x < 0 || box.x + box.w > maxWidth)) {
      return false;
    }

    if (maxHeight !== undefined && (box.y < 0 || box.y + box.h > maxHeight)) {
      return false;
    }

    return true;
  }

  /**
   * Expand box by padding (useful for ensuring complete coverage)
   *
   * @param box - The box to expand
   * @param padding - Padding in pixels (default: 4)
   * @returns BoundingBox - New expanded box
   */
  protected expandBox(box: BoundingBox, padding: number = 4): BoundingBox {
    return {
      ...box,
      x: box.x - padding,
      y: box.y - padding,
      w: box.w + (padding * 2),
      h: box.h + (padding * 2)
    };
  }

  /**
   * Merge overlapping boxes
   * Useful for combining multiple detections of the same entity
   *
   * @param boxes - Array of boxes to merge
   * @returns BoundingBox[] - Array of merged boxes
   */
  protected mergeOverlappingBoxes(boxes: BoundingBox[]): BoundingBox[] {
    if (boxes.length === 0) return [];

    // Sort boxes by x position
    const sorted = [...boxes].sort((a, b) => a.x - b.x);
    const merged: BoundingBox[] = [];
    let current = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];

      // Check if boxes overlap or are adjacent
      if (this.boxesOverlap(current, next)) {
        // Merge boxes
        current = this.mergeTwoBoxes(current, next);
      } else {
        // No overlap - save current and move to next
        merged.push(current);
        current = next;
      }
    }

    // Don't forget the last box
    merged.push(current);

    return merged;
  }

  /**
   * Check if two boxes overlap
   *
   * @param a - First box
   * @param b - Second box
   * @returns boolean - True if boxes overlap
   */
  private boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
    return !(
      a.x + a.w < b.x ||
      b.x + b.w < a.x ||
      a.y + a.h < b.y ||
      b.y + b.h < a.y
    );
  }

  /**
   * Merge two boxes into a single bounding box
   *
   * @param a - First box
   * @param b - Second box
   * @returns BoundingBox - Merged box
   */
  private mergeTwoBoxes(a: BoundingBox, b: BoundingBox): BoundingBox {
    const x1 = Math.min(a.x, b.x);
    const y1 = Math.min(a.y, b.y);
    const x2 = Math.max(a.x + a.w, b.x + b.w);
    const y2 = Math.max(a.y + a.h, b.y + b.h);

    return {
      x: x1,
      y: y1,
      w: x2 - x1,
      h: y2 - y1,
      text: a.text + (a.text && b.text ? ' ' : '') + b.text,
      page: a.page,
      type: a.type || b.type,
      source: a.source || b.source,
      confidence: Math.min(a.confidence || 1.0, b.confidence || 1.0)
    };
  }

  /**
   * Get display name for format
   *
   * @returns string - Human-readable format name
   */
  toString(): string {
    return this.formatName;
  }
}

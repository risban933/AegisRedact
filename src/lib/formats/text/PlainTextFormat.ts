/**
 * Plain text format handler (.txt, .md)
 * Simplest format implementation - proof of concept for abstraction layer
 */

import { DocumentFormat } from '../base/DocumentFormat';
import type {
  BoundingBox,
  Document,
  DocumentMetadata,
  RenderOptions,
  ExportOptions,
  TextExtractionResult,
  FormatCapabilities
} from '../base/types';

/**
 * Internal content structure for plain text documents
 */
interface PlainTextContent {
  fullText: string;
  lines: string[];
  lineElements: Map<number, HTMLElement>; // Map of line number to rendered element
}

export class PlainTextFormat extends DocumentFormat {
  readonly formatId = 'txt';
  readonly formatName = 'Plain Text';
  readonly supportedExtensions = ['txt', 'md', 'markdown'];
  readonly mimeTypes = ['text/plain', 'text/markdown'];

  readonly capabilities: FormatCapabilities = {
    canRenderToCanvas: false,
    canRenderToDOM: true,
    supportsMultiPage: false,
    supportsTextExtraction: true,
    requiresOCR: false,
    supportsDirectExport: true,
    requiresFlattening: false,
    supportedExportFormats: ['txt', 'text']
  };

  /**
   * Load a plain text file
   */
  async load(file: File): Promise<Document> {
    const text = await this.readFileAsText(file);
    const lines = text.split('\n');

    const metadata: DocumentMetadata = {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'text/plain',
      lineCount: lines.length,
      format: this.formatId
    };

    const content: PlainTextContent = {
      fullText: text,
      lines: lines,
      lineElements: new Map()
    };

    return {
      metadata,
      content,
      boxes: [],
      currentPage: 0,
      rendered: false,
      modified: false
    };
  }

  /**
   * Render plain text to a DOM container
   * Creates a styled <pre> element with line numbers
   */
  async render(doc: Document, options: RenderOptions): Promise<void> {
    const content = doc.content as PlainTextContent;
    const container = options.container;

    // Clear container
    container.innerHTML = '';

    // Create container with styling
    const textContainer = document.createElement('div');
    textContainer.className = 'plain-text-container';
    textContainer.style.cssText = `
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-wrap: break-word;
      padding: 20px;
      background: #fafafa;
      border: 1px solid #ddd;
      border-radius: 4px;
      max-height: 600px;
      overflow-y: auto;
      position: relative;
    `;

    // Create line-numbered display
    const lineNumbersDiv = document.createElement('div');
    lineNumbersDiv.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 50px;
      padding: 20px 10px;
      background: #eee;
      border-right: 1px solid #ddd;
      text-align: right;
      color: #666;
      user-select: none;
    `;

    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = `
      margin-left: 60px;
      position: relative;
    `;

    // Render each line
    content.lineElements.clear();

    content.lines.forEach((line, index) => {
      // Line number
      const lineNumSpan = document.createElement('div');
      lineNumSpan.textContent = String(index + 1);
      lineNumSpan.style.cssText = 'min-height: 1.6em;';
      lineNumbersDiv.appendChild(lineNumSpan);

      // Line content
      const lineDiv = document.createElement('div');
      lineDiv.className = 'text-line';
      lineDiv.textContent = line || ' '; // Preserve empty lines
      lineDiv.style.cssText = `
        min-height: 1.6em;
        position: relative;
      `;
      lineDiv.dataset.lineNumber = String(index);

      content.lineElements.set(index, lineDiv);
      contentDiv.appendChild(lineDiv);
    });

    textContainer.appendChild(lineNumbersDiv);
    textContainer.appendChild(contentDiv);
    container.appendChild(textContainer);

    // Apply existing redaction boxes
    this.renderRedactionBoxes(doc, container);

    doc.rendered = true;
  }

  /**
   * Extract text from the document
   */
  async extractText(doc: Document, page?: number): Promise<TextExtractionResult> {
    const content = doc.content as PlainTextContent;

    return {
      fullText: content.fullText,
      lineText: content.lines
    };
  }

  /**
   * Find bounding boxes for text terms
   * Maps terms to line-based coordinates
   */
  async findTextBoxes(doc: Document, terms: string[], page?: number): Promise<BoundingBox[]> {
    const content = doc.content as PlainTextContent;
    const boxes: BoundingBox[] = [];

    // For each term, find all occurrences in the text
    for (const term of terms) {
      if (!term || term.trim().length === 0) continue;

      // Search each line
      content.lines.forEach((line, lineIndex) => {
        const lowerLine = line.toLowerCase();
        const lowerTerm = term.toLowerCase();
        let startIndex = 0;

        // Find all occurrences in this line
        while (true) {
          const index = lowerLine.indexOf(lowerTerm, startIndex);
          if (index === -1) break;

          // Get the actual matched text (preserve original case)
          const matchedText = line.substring(index, index + term.length);

          // Calculate bounding box
          // For text, we use character positions converted to approximate pixel coordinates
          const lineElement = content.lineElements.get(lineIndex);
          let box: BoundingBox;

          if (lineElement) {
            // Use actual rendered dimensions
            const rect = lineElement.getBoundingClientRect();
            const charWidth = rect.width / line.length || 8; // Approximate char width
            const lineHeight = rect.height || 22;

            box = {
              x: index * charWidth,
              y: lineIndex * lineHeight,
              w: term.length * charWidth,
              h: lineHeight,
              text: matchedText,
              line: lineIndex,
              source: 'regex'
            };
          } else {
            // Fallback: use approximate dimensions
            const charWidth = 8;
            const lineHeight = 22;

            box = {
              x: index * charWidth,
              y: lineIndex * lineHeight,
              w: term.length * charWidth,
              h: lineHeight,
              text: matchedText,
              line: lineIndex,
              source: 'regex'
            };
          }

          boxes.push(box);
          startIndex = index + 1;
        }
      });
    }

    return boxes;
  }

  /**
   * Apply redactions to the document
   * Replaces matched text with redaction characters
   */
  async redact(doc: Document, boxes: BoundingBox[]): Promise<void> {
    const content = doc.content as PlainTextContent;

    // Group boxes by line
    const boxesByLine = new Map<number, BoundingBox[]>();
    for (const box of boxes) {
      if (box.line === undefined) continue;
      if (!boxesByLine.has(box.line)) {
        boxesByLine.set(box.line, []);
      }
      boxesByLine.get(box.line)!.push(box);
    }

    // Apply redactions line by line (from end to start to preserve indices)
    const sortedLines = Array.from(boxesByLine.keys()).sort((a, b) => b - a);

    for (const lineIndex of sortedLines) {
      const lineBoxes = boxesByLine.get(lineIndex)!;
      let line = content.lines[lineIndex];

      // Sort boxes by position (right to left to preserve indices)
      lineBoxes.sort((a, b) => {
        const aStart = line.toLowerCase().indexOf(a.text.toLowerCase());
        const bStart = line.toLowerCase().indexOf(b.text.toLowerCase());
        return bStart - aStart;
      });

      // Apply redactions
      for (const box of lineBoxes) {
        const index = line.toLowerCase().indexOf(box.text.toLowerCase());
        if (index >= 0) {
          const redactionChar = '█';
          const redactionText = redactionChar.repeat(box.text.length);
          line = line.substring(0, index) + redactionText + line.substring(index + box.text.length);
        }
      }

      content.lines[lineIndex] = line;
    }

    // Update full text
    content.fullText = content.lines.join('\n');

    // Update boxes
    doc.boxes = [...doc.boxes, ...boxes];
    doc.modified = true;

    // Re-render if already rendered
    if (doc.rendered) {
      content.lineElements.clear();
    }
  }

  /**
   * Export the redacted document as plain text
   */
  async export(doc: Document, options?: ExportOptions): Promise<Blob> {
    const content = doc.content as PlainTextContent;

    // Create blob from redacted text
    const blob = new Blob([content.fullText], { type: 'text/plain;charset=utf-8' });

    return blob;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // No external resources to clean up for plain text
  }

  /**
   * Read file as text using FileReader (compatible with test environments)
   */
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  /**
   * Render redaction boxes visually on the DOM
   */
  private renderRedactionBoxes(doc: Document, container: HTMLElement): void {
    const content = doc.content as PlainTextContent;

    for (const box of doc.boxes) {
      if (box.line === undefined) continue;

      const lineElement = content.lineElements.get(box.line);
      if (!lineElement) continue;

      // Create redaction overlay
      const overlay = document.createElement('span');
      overlay.className = 'redaction-box';
      overlay.style.cssText = `
        background-color: #000;
        color: #000;
        padding: 2px 0;
        border-radius: 2px;
      `;
      overlay.textContent = box.text;

      // Replace text content in line
      const lineText = lineElement.textContent || '';
      const index = lineText.toLowerCase().indexOf(box.text.toLowerCase());

      if (index >= 0) {
        const before = lineText.substring(0, index);
        const after = lineText.substring(index + box.text.length);

        lineElement.innerHTML = '';
        lineElement.appendChild(document.createTextNode(before));
        lineElement.appendChild(overlay);
        lineElement.appendChild(document.createTextNode(after));
      }
    }
  }
}

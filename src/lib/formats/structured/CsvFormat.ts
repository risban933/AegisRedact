/**
 * CSV/TSV format handler
 * Uses PapaParse for parsing, supports cell and column-based redaction
 */

import Papa from 'papaparse';
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
 * Internal content structure for CSV documents
 */
interface CsvContent {
  data: string[][]; //Raw 2D array of cells
  headers: string[]; // First row (if hasHeaders is true)
  hasHeaders: boolean;
  delimiter: string; // ',' for CSV, '\t' for TSV
  fullText: string; // All text concatenated for PII detection
  cellElements: Map<string, HTMLElement>; // Map of "row-col" to rendered cell element
}

/**
 * Cell position for CSV files
 */
interface CellPosition {
  row: number;
  column: number;
}

export class CsvFormat extends DocumentFormat {
  readonly formatId = 'csv';
  readonly formatName = 'CSV File';
  readonly supportedExtensions = ['csv', 'tsv'];
  readonly mimeTypes = ['text/csv', 'text/tab-separated-values'];

  readonly capabilities: FormatCapabilities = {
    canRenderToCanvas: false,
    canRenderToDOM: true,
    supportsMultiPage: false,
    supportsTextExtraction: true,
    requiresOCR: false,
    supportsDirectExport: true,
    requiresFlattening: false,
    supportedExportFormats: ['csv', 'tsv', 'pdf']
  };

  /**
   * Load a CSV/TSV file
   */
  async load(file: File): Promise<Document> {
    const text = await this.readFileAsText(file);

    // Determine delimiter
    const isTsv = file.name.toLowerCase().endsWith('.tsv');
    const delimiter = isTsv ? '\t' : ',';

    // Parse CSV with PapaParse
    const parseResult = Papa.parse(text, {
      delimiter,
      skipEmptyLines: false, // Preserve structure
      quoteChar: '"',
      escapeChar: '"'
    });

    if (parseResult.errors.length > 0) {
      console.warn('[CsvFormat] Parse errors:', parseResult.errors);
    }

    const data = parseResult.data as string[][];

    // Detect if first row is headers
    const hasHeaders = this.detectHeaders(data);

    const headers = hasHeaders && data.length > 0 ? data[0] : [];

    // Calculate metadata
    const rowCount = data.length;
    const columnCount = data.length > 0 ? Math.max(...data.map(row => row.length)) : 0;

    // Extract full text for PII detection
    const fullText = data.map(row => row.join(' ')).join('\n');

    const metadata: DocumentMetadata = {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || (isTsv ? 'text/tab-separated-values' : 'text/csv'),
      rowCount,
      columnCount,
      format: this.formatId,
      hasHeaders
    };

    const content: CsvContent = {
      data,
      headers,
      hasHeaders,
      delimiter,
      fullText,
      cellElements: new Map()
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
   * Detect if first row is likely headers
   * Heuristic: headers are usually shorter, contain no numbers, and are unique
   */
  private detectHeaders(data: string[][]): boolean {
    if (data.length < 2) return false;

    const firstRow = data[0];
    const secondRow = data[1];

    // If first row has significantly different characteristics from second row
    // (e.g., shorter, no numbers), it's likely headers

    const firstRowAvgLength = firstRow.reduce((sum, cell) => sum + cell.length, 0) / firstRow.length;
    const secondRowAvgLength = secondRow.reduce((sum, cell) => sum + cell.length, 0) / secondRow.length;

    // Headers are usually shorter
    if (firstRowAvgLength < secondRowAvgLength * 0.7) {
      return true;
    }

    // Check if first row contains mostly text (no numbers)
    const firstRowNumeric = firstRow.filter(cell => /^\d+$/.test(cell.trim())).length;
    const secondRowNumeric = secondRow.filter(cell => /^\d+$/.test(cell.trim())).length;

    if (firstRowNumeric === 0 && secondRowNumeric > 0) {
      return true;
    }

    // Default: assume no headers
    return false;
  }

  /**
   * Render CSV as HTML table
   */
  async render(doc: Document, options: RenderOptions): Promise<void> {
    const content = doc.content as CsvContent;
    const container = options.container;

    // Clear container
    container.innerHTML = '';

    // Create table
    const tableWrapper = document.createElement('div');
    tableWrapper.style.cssText = `
      overflow-x: auto;
      max-height: 600px;
      overflow-y: auto;
      border: 1px solid #ddd;
      border-radius: 4px;
    `;

    const table = document.createElement('table');
    table.style.cssText = `
      width: 100%;
      border-collapse: collapse;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
    `;

    // Clear cell elements map
    content.cellElements.clear();

    // Render headers
    if (content.hasHeaders && content.data.length > 0) {
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      headerRow.style.background = '#f8f9fa';

      content.headers.forEach((header, colIndex) => {
        const th = document.createElement('th');
        th.textContent = header;
        th.style.cssText = `
          padding: 12px;
          text-align: left;
          border: 1px solid #dee2e6;
          font-weight: 600;
          position: sticky;
          top: 0;
          background: #f8f9fa;
          z-index: 10;
        `;
        headerRow.appendChild(th);

        // Store reference
        content.cellElements.set(`0-${colIndex}`, th);
      });

      thead.appendChild(headerRow);
      table.appendChild(thead);
    }

    // Render data rows
    const tbody = document.createElement('tbody');
    const startRow = content.hasHeaders ? 1 : 0;

    for (let rowIndex = startRow; rowIndex < content.data.length; rowIndex++) {
      const row = content.data[rowIndex];
      const tr = document.createElement('tr');

      // Alternate row colors
      if ((rowIndex - startRow) % 2 === 1) {
        tr.style.background = '#f8f9fa';
      }

      row.forEach((cell, colIndex) => {
        const td = document.createElement('td');
        td.textContent = cell;
        td.style.cssText = `
          padding: 10px 12px;
          border: 1px solid #dee2e6;
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        `;
        td.title = cell; // Show full content on hover
        td.dataset.row = String(rowIndex);
        td.dataset.col = String(colIndex);

        tr.appendChild(td);

        // Store reference
        content.cellElements.set(`${rowIndex}-${colIndex}`, td);
      });

      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    container.appendChild(tableWrapper);

    // Apply existing redaction boxes
    this.renderRedactionBoxes(doc);

    doc.rendered = true;
  }

  /**
   * Extract text from CSV
   */
  async extractText(doc: Document, page?: number): Promise<TextExtractionResult> {
    const content = doc.content as CsvContent;

    return {
      fullText: content.fullText,
      characterPositions: [] // CSV doesn't use character positions
    };
  }

  /**
   * Find bounding boxes for text terms in CSV
   * Maps terms to cell positions
   */
  async findTextBoxes(doc: Document, terms: string[], page?: number): Promise<BoundingBox[]> {
    const content = doc.content as CsvContent;
    const boxes: BoundingBox[] = [];

    // Search each cell for terms
    for (let rowIndex = 0; rowIndex < content.data.length; rowIndex++) {
      const row = content.data[rowIndex];

      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const cell = row[colIndex];
        const cellLower = cell.toLowerCase();

        // Check if this cell contains any of the terms
        for (const term of terms) {
          if (!term || term.trim().length === 0) continue;

          const termLower = term.toLowerCase();

          if (cellLower.includes(termLower)) {
            // Get cell element for dimensions
            const cellKey = `${rowIndex}-${colIndex}`;
            const cellElement = content.cellElements.get(cellKey);

            let box: BoundingBox;

            if (cellElement) {
              const rect = cellElement.getBoundingClientRect();
              box = {
                x: rect.left,
                y: rect.top,
                w: rect.width,
                h: rect.height,
                text: cell,
                row: rowIndex,
                column: colIndex,
                source: 'regex'
              };
            } else {
              // Fallback: approximate dimensions
              box = {
                x: colIndex * 100,
                y: rowIndex * 30,
                w: 100,
                h: 30,
                text: cell,
                row: rowIndex,
                column: colIndex,
                source: 'regex'
              };
            }

            boxes.push(box);
          }
        }
      }
    }

    return boxes;
  }

  /**
   * Apply redactions to CSV cells
   * Replaces cell content with redaction characters
   */
  async redact(doc: Document, boxes: BoundingBox[]): Promise<void> {
    const content = doc.content as CsvContent;

    // Group boxes by cell position
    const cellsToRedact = new Map<string, BoundingBox>();

    for (const box of boxes) {
      if (box.row === undefined || box.column === undefined) continue;

      const cellKey = `${box.row}-${box.column}`;

      // Only keep first box per cell (they all redact the whole cell anyway)
      if (!cellsToRedact.has(cellKey)) {
        cellsToRedact.set(cellKey, box);
      }
    }

    // Apply redactions to data
    for (const [cellKey, box] of cellsToRedact) {
      const { row, column } = box;

      if (row !== undefined && column !== undefined &&
          row < content.data.length &&
          column < content.data[row].length) {

        // Replace cell content with redaction characters
        const originalLength = content.data[row][column].length;
        content.data[row][column] = '█'.repeat(Math.max(3, Math.min(originalLength, 20)));
      }
    }

    // Update fullText
    content.fullText = content.data.map(row => row.join(' ')).join('\n');

    // Update boxes
    doc.boxes = [...doc.boxes, ...boxes];
    doc.modified = true;

    // Re-render if already rendered
    if (doc.rendered) {
      content.cellElements.clear();
    }
  }

  /**
   * Export CSV with redactions applied
   */
  async export(doc: Document, options?: ExportOptions): Promise<Blob> {
    const content = doc.content as CsvContent;

    // Use PapaParse to unparse (generate CSV)
    const csv = Papa.unparse(content.data, {
      delimiter: content.delimiter,
      quotes: true, // Quote all fields for safety
      quoteChar: '"',
      escapeChar: '"',
      header: false,
      newline: '\n'
    });

    const mimeType = content.delimiter === '\t'
      ? 'text/tab-separated-values;charset=utf-8'
      : 'text/csv;charset=utf-8';

    const blob = new Blob([csv], { type: mimeType });

    return blob;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // No external resources to clean up
  }

  /**
   * Read file as text using FileReader
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
   * Render redaction boxes visually on the table
   */
  private renderRedactionBoxes(doc: Document): void {
    const content = doc.content as CsvContent;

    for (const box of doc.boxes) {
      if (box.row === undefined || box.column === undefined) continue;

      const cellKey = `${box.row}-${box.column}`;
      const cellElement = content.cellElements.get(cellKey);

      if (!cellElement) continue;

      // Apply redaction styling
      cellElement.style.background = '#000';
      cellElement.style.color = '#000';
      cellElement.textContent = '█████';
    }
  }

  /**
   * Get column by name (for column-based redaction)
   */
  getColumnIndex(doc: Document, columnName: string): number | null {
    const content = doc.content as CsvContent;

    if (!content.hasHeaders) return null;

    const index = content.headers.findIndex(
      h => h.toLowerCase() === columnName.toLowerCase()
    );

    return index >= 0 ? index : null;
  }

  /**
   * Redact entire column by name or index
   */
  async redactColumn(doc: Document, columnIdentifier: string | number): Promise<void> {
    const content = doc.content as CsvContent;

    let columnIndex: number;

    if (typeof columnIdentifier === 'string') {
      const index = this.getColumnIndex(doc, columnIdentifier);
      if (index === null) {
        throw new Error(`Column "${columnIdentifier}" not found`);
      }
      columnIndex = index;
    } else {
      columnIndex = columnIdentifier;
    }

    // Create boxes for all cells in this column
    const boxes: BoundingBox[] = [];
    const startRow = content.hasHeaders ? 1 : 0;

    for (let rowIndex = startRow; rowIndex < content.data.length; rowIndex++) {
      if (columnIndex < content.data[rowIndex].length) {
        boxes.push({
          x: 0,
          y: 0,
          w: 0,
          h: 0,
          text: content.data[rowIndex][columnIndex],
          row: rowIndex,
          column: columnIndex,
          source: 'manual'
        });
      }
    }

    await this.redact(doc, boxes);
  }
}

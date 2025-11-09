/**
 * Shared types and interfaces for document format abstraction layer
 */

/**
 * Bounding box for redaction areas (unified across all formats)
 * Coordinate system is format-specific (see each format's implementation)
 */
export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  page?: number;          // For multi-page documents (PDF, DOCX, etc.)
  sheet?: number;         // For spreadsheets (XLSX)
  slide?: number;         // For presentations (PPTX)
  line?: number;          // For line-based formats (TXT, MD)
  row?: number;           // For table-based formats (CSV, TSV)
  column?: number;        // For table-based formats (CSV, TSV)
  type?: string;          // PII type (email, phone, ssn, etc.)
  source?: 'regex' | 'ml' | 'manual' | 'hybrid';
  confidence?: number;    // 0.0 to 1.0 for ML detections
  detectionId?: string;   // Unique identifier for tracking
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  pageCount?: number;     // For multi-page documents
  sheetCount?: number;    // For spreadsheets
  slideCount?: number;    // For presentations
  lineCount?: number;     // For text documents
  rowCount?: number;      // For CSV/TSV
  columnCount?: number;   // For CSV/TSV
  hasTextLayer?: boolean; // For PDFs (indicates if OCR needed)
  format: string;         // Format identifier (pdf, docx, txt, etc.)
  [key: string]: any;     // Format-specific metadata
}

/**
 * Rendering options for document display
 */
export interface RenderOptions {
  container: HTMLElement;
  page?: number;          // For multi-page documents
  sheet?: number;         // For spreadsheets
  slide?: number;         // For presentations
  scale?: number;         // Zoom level (default: 1.0)
  width?: number;         // Target width
  height?: number;        // Target height
  renderMode?: 'canvas' | 'dom' | 'hybrid'; // Rendering strategy
  [key: string]: any;     // Format-specific options
}

/**
 * Export options for redacted documents
 */
export interface ExportOptions {
  format?: 'pdf' | 'png' | 'original' | 'text'; // Target export format
  quality?: number;       // Image quality (0.0 to 1.0)
  flatten?: boolean;      // Flatten to rasterized output (security)
  includeMetadata?: boolean; // Whether to preserve non-sensitive metadata
  fileName?: string;      // Suggested filename
  [key: string]: any;     // Format-specific options
}

/**
 * Document state during processing
 */
export interface Document {
  metadata: DocumentMetadata;
  content: any;           // Format-specific content representation
  boxes: BoundingBox[];   // All redaction boxes (detected + manual)
  currentPage?: number;   // Current page/sheet/slide being viewed
  rendered: boolean;      // Whether document has been rendered
  modified: boolean;      // Whether document has been modified
}

/**
 * Text extraction result
 */
export interface TextExtractionResult {
  fullText: string;
  pageText?: Map<number, string>;  // For multi-page documents
  sheetText?: Map<number, string>; // For spreadsheets
  lineText?: string[];             // For line-based formats
  characterPositions?: CharacterPosition[]; // For precise mapping
}

/**
 * Character position for precise text mapping
 */
export interface CharacterPosition {
  char: string;
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  page?: number;
  line?: number;
  row?: number;
  column?: number;
}

/**
 * Format capabilities (what a format supports)
 */
export interface FormatCapabilities {
  canRenderToCanvas: boolean;
  canRenderToDOM: boolean;
  supportsMultiPage: boolean;
  supportsTextExtraction: boolean;
  requiresOCR: boolean;
  supportsDirectExport: boolean;  // Can export in original format
  requiresFlattening: boolean;    // Must flatten for security
  supportedExportFormats: string[];
}

/**
 * MIME type to format mapping
 */
export const MIME_TYPES: Record<string, string> = {
  // PDF
  'application/pdf': 'pdf',

  // Images
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',

  // Office Documents
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/msword': 'doc',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.ms-powerpoint': 'ppt',

  // Text formats
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
  'text/tab-separated-values': 'tsv',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf',
  'text/html': 'html',
  'application/xhtml+xml': 'html',

  // E-books
  'application/epub+zip': 'epub',
  'application/x-mobipocket-ebook': 'mobi'
};

/**
 * File extension to format mapping
 */
export const FILE_EXTENSIONS: Record<string, string> = {
  // PDF
  'pdf': 'pdf',

  // Images
  'png': 'png',
  'jpg': 'jpg',
  'jpeg': 'jpg',
  'gif': 'gif',
  'webp': 'webp',
  'bmp': 'bmp',

  // Office Documents
  'docx': 'docx',
  'xlsx': 'xlsx',
  'pptx': 'pptx',
  'doc': 'doc',
  'xls': 'xls',
  'ppt': 'ppt',

  // Text formats
  'txt': 'txt',
  'md': 'md',
  'markdown': 'md',
  'csv': 'csv',
  'tsv': 'tsv',
  'rtf': 'rtf',
  'html': 'html',
  'htm': 'html',

  // E-books
  'epub': 'epub',
  'mobi': 'mobi'
};

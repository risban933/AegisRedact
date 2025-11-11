/**
 * Privacy Analysis Types
 *
 * Types for privacy scoring, risk analysis, and metadata extraction.
 */

/**
 * Risk severity levels
 */
export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low' | 'none';

/**
 * Privacy risk item
 */
export interface PrivacyRisk {
  id: string;
  category: string;
  severity: RiskSeverity;
  title: string;
  description: string;
  found: boolean;
  details?: string;
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  // PDF metadata
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;

  // Image EXIF data
  exif?: {
    make?: string;
    model?: string;
    software?: string;
    dateTime?: Date;
    gps?: {
      latitude?: number;
      longitude?: number;
      altitude?: number;
    };
  };

  // File info
  fileName: string;
  fileType: string;
  fileSize: number;
}

/**
 * Privacy score breakdown
 */
export interface PrivacyScoreBreakdown {
  // Individual component scores (0-100)
  metadata: number;
  piiDetection: number;
  textLayer: number;
  exifData: number;

  // Overall score (weighted average)
  overall: number;

  // Grade (A-F)
  grade: string;
}

/**
 * Complete privacy analysis result
 */
export interface PrivacyAnalysis {
  score: PrivacyScoreBreakdown;
  risks: PrivacyRisk[];
  metadata: DocumentMetadata;
  recommendations: string[];
  timestamp: number;
}

/**
 * Privacy improvement options
 */
export interface PrivacyImprovementOptions {
  redactAllPII: boolean;
  stripMetadata: boolean;
  flattenPDF: boolean;
  removeExif: boolean;
  reEncodeImages: boolean;
}

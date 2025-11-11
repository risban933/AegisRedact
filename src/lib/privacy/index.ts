/**
 * Privacy Analysis Module
 *
 * Exports privacy scoring, risk analysis, and metadata extraction.
 */

export { PrivacyAnalyzer } from './analyzer';
export { extractPDFMetadata, extractImageMetadata, createTextDocumentMetadata } from './metadata';
export type {
  RiskSeverity,
  PrivacyRisk,
  DocumentMetadata,
  PrivacyScoreBreakdown,
  PrivacyAnalysis,
  PrivacyImprovementOptions
} from './types';

/**
 * Analytics types for document statistics and heatmaps
 */

import type { Box } from '../pdf/find';
import type { DetectionType } from '../detect/types';

/**
 * Document-wide statistics
 */
export interface DocumentStatistics {
  totalDetections: number;
  byType: Record<DetectionType, number>;
  byPage: Record<number, number>;
  bySource: {
    regex: number;
    ml: number;
    manual: number;
  };
  byConfidence: {
    high: number; // >= 0.9
    medium: number; // 0.7 - 0.89
    low: number; // < 0.7
  };
  averageConfidence: number;
  pagesWithDetections: number;
  maxDetectionsOnPage: number;
  hotspotPage: number; // Page with most detections
  totalPages: number;
}

/**
 * Heatmap data for a single page
 */
export interface HeatmapData {
  page: number;
  density: number; // 0-1 normalized across document
  boxCount: number;
  boxes: Box[];
  grid?: number[][]; // 10x10 grid of density values (optional, for grid mode)
}

/**
 * Statistics for a specific detection type
 */
export interface TypeStatistics {
  type: DetectionType;
  count: number;
  percentage: number;
  averageConfidence: number;
  pages: Set<number>;
}

/**
 * Page hotspot information
 */
export interface PageHotspot {
  page: number;
  count: number;
  density: number;
  types: Record<DetectionType, number>;
}

/**
 * Export format for CSV
 */
export interface DetectionExportRow {
  page: number;
  type: DetectionType | string;
  source: 'regex' | 'ml' | 'manual';
  confidence: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

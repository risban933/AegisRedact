/**
 * Analytics aggregator - compute statistics and heatmap data
 */

import type { Box } from '../pdf/find';
import type { DetectionType } from '../detect/types';
import type { RedactionItem } from '../../ui/components/RedactionList';
import type {
  DocumentStatistics,
  HeatmapData,
  TypeStatistics,
  PageHotspot,
  DetectionExportRow,
} from './types';

export class AnalyticsAggregator {
  /**
   * Compute comprehensive document statistics
   */
  static computeStatistics(items: RedactionItem[], totalPages: number): DocumentStatistics {
    const stats: DocumentStatistics = {
      totalDetections: items.length,
      byType: {
        email: 0,
        phone: 0,
        ssn: 0,
        card: 0,
      },
      byPage: {},
      bySource: {
        regex: 0,
        ml: 0,
        manual: 0,
      },
      byConfidence: {
        high: 0,
        medium: 0,
        low: 0,
      },
      averageConfidence: 0,
      pagesWithDetections: 0,
      maxDetectionsOnPage: 0,
      hotspotPage: 0,
      totalPages,
    };

    if (items.length === 0) return stats;

    let totalConfidence = 0;
    const pagesSet = new Set<number>();

    for (const item of items) {
      // Count by type
      if (item.type && item.type in stats.byType) {
        stats.byType[item.type as DetectionType]++;
      }

      // Count by page
      stats.byPage[item.page] = (stats.byPage[item.page] || 0) + 1;
      pagesSet.add(item.page);

      // Count by source
      const source = item.source || 'manual';
      stats.bySource[source]++;

      // Count by confidence
      const confidence = item.confidence || 1.0;
      totalConfidence += confidence;

      if (confidence >= 0.9) {
        stats.byConfidence.high++;
      } else if (confidence >= 0.7) {
        stats.byConfidence.medium++;
      } else {
        stats.byConfidence.low++;
      }
    }

    // Calculate derived statistics
    stats.averageConfidence = totalConfidence / items.length;
    stats.pagesWithDetections = pagesSet.size;

    // Find hotspot page
    let maxCount = 0;
    for (const [page, count] of Object.entries(stats.byPage)) {
      if (count > maxCount) {
        maxCount = count;
        stats.hotspotPage = parseInt(page, 10);
      }
    }
    stats.maxDetectionsOnPage = maxCount;

    return stats;
  }

  /**
   * Compute heatmap data for all pages
   */
  static computeHeatmap(items: RedactionItem[], totalPages: number): HeatmapData[] {
    const heatmap: HeatmapData[] = [];

    // Group items by page
    const byPage = new Map<number, RedactionItem[]>();
    for (const item of items) {
      const pageItems = byPage.get(item.page) || [];
      pageItems.push(item);
      byPage.set(item.page, pageItems);
    }

    // Find max count for normalization
    let maxCount = 0;
    for (const pageItems of byPage.values()) {
      maxCount = Math.max(maxCount, pageItems.length);
    }

    // Create heatmap data for each page
    for (let page = 0; page < totalPages; page++) {
      const pageItems = byPage.get(page) || [];
      const density = maxCount > 0 ? pageItems.length / maxCount : 0;

      heatmap.push({
        page,
        density,
        boxCount: pageItems.length,
        boxes: pageItems,
      });
    }

    return heatmap;
  }

  /**
   * Compute density grid for a specific page
   * Divides page into 10x10 grid and counts boxes per cell
   */
  static computeDensityGrid(
    boxes: Box[],
    pageWidth: number,
    pageHeight: number,
    gridSize: number = 10
  ): number[][] {
    // Initialize grid
    const grid: number[][] = Array(gridSize)
      .fill(0)
      .map(() => Array(gridSize).fill(0));

    const cellWidth = pageWidth / gridSize;
    const cellHeight = pageHeight / gridSize;

    // Count boxes in each cell
    for (const box of boxes) {
      const centerX = box.x + box.w / 2;
      const centerY = box.y + box.h / 2;

      const cellX = Math.min(Math.floor(centerX / cellWidth), gridSize - 1);
      const cellY = Math.min(Math.floor(centerY / cellHeight), gridSize - 1);

      if (cellX >= 0 && cellX < gridSize && cellY >= 0 && cellY < gridSize) {
        grid[cellY][cellX]++;
      }
    }

    // Normalize to 0-1
    let maxCount = 0;
    for (const row of grid) {
      for (const count of row) {
        maxCount = Math.max(maxCount, count);
      }
    }

    if (maxCount > 0) {
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          grid[y][x] = grid[y][x] / maxCount;
        }
      }
    }

    return grid;
  }

  /**
   * Get statistics by type
   */
  static getTypeStatistics(items: RedactionItem[]): TypeStatistics[] {
    const typeMap = new Map<DetectionType, TypeStatistics>();

    for (const item of items) {
      if (!item.type || !(item.type in { email: 1, phone: 1, ssn: 1, card: 1 })) continue;

      const type = item.type as DetectionType;
      let stats = typeMap.get(type);

      if (!stats) {
        stats = {
          type,
          count: 0,
          percentage: 0,
          averageConfidence: 0,
          pages: new Set(),
        };
        typeMap.set(type, stats);
      }

      stats.count++;
      stats.averageConfidence += item.confidence || 1.0;
      stats.pages.add(item.page);
    }

    // Calculate percentages and averages
    const total = items.length;
    const result: TypeStatistics[] = [];

    for (const stats of typeMap.values()) {
      stats.percentage = total > 0 ? (stats.count / total) * 100 : 0;
      stats.averageConfidence = stats.averageConfidence / stats.count;
      result.push(stats);
    }

    // Sort by count descending
    result.sort((a, b) => b.count - a.count);

    return result;
  }

  /**
   * Get top N hotspot pages
   */
  static getHotspots(items: RedactionItem[], topN: number = 5): PageHotspot[] {
    const pageMap = new Map<number, PageHotspot>();

    for (const item of items) {
      let hotspot = pageMap.get(item.page);

      if (!hotspot) {
        hotspot = {
          page: item.page,
          count: 0,
          density: 0,
          types: {
            email: 0,
            phone: 0,
            ssn: 0,
            card: 0,
          },
        };
        pageMap.set(item.page, hotspot);
      }

      hotspot.count++;
      if (item.type && item.type in hotspot.types) {
        hotspot.types[item.type as DetectionType]++;
      }
    }

    // Calculate density (normalize by max count)
    let maxCount = 0;
    for (const hotspot of pageMap.values()) {
      maxCount = Math.max(maxCount, hotspot.count);
    }

    for (const hotspot of pageMap.values()) {
      hotspot.density = maxCount > 0 ? hotspot.count / maxCount : 0;
    }

    // Sort by count and return top N
    const hotspots = Array.from(pageMap.values());
    hotspots.sort((a, b) => b.count - a.count);

    return hotspots.slice(0, topN);
  }

  /**
   * Export detections to CSV format
   */
  static exportToCSV(items: RedactionItem[]): string {
    const rows: DetectionExportRow[] = items.map((item) => ({
      page: item.page + 1, // 1-indexed for user-friendly display
      type: item.type || 'manual',
      source: item.source || 'manual',
      confidence: item.confidence || 1.0,
      text: item.text || '',
      x: Math.round(item.x),
      y: Math.round(item.y),
      width: Math.round(item.w),
      height: Math.round(item.h),
    }));

    // Build CSV string
    const header = 'Page,Type,Source,Confidence,Text,X,Y,Width,Height\n';
    const lines = rows.map(
      (row) =>
        `${row.page},${row.type},${row.source},${row.confidence.toFixed(2)},"${row.text.replace(/"/g, '""')}",${row.x},${row.y},${row.width},${row.height}`
    );

    return header + lines.join('\n');
  }

  /**
   * Filter items by confidence threshold
   */
  static filterByConfidence(items: RedactionItem[], minConfidence: number): RedactionItem[] {
    return items.filter((item) => (item.confidence || 1.0) >= minConfidence);
  }

  /**
   * Filter items by type
   */
  static filterByType(items: RedactionItem[], type: DetectionType | null): RedactionItem[] {
    if (type === null) return items;
    return items.filter((item) => item.type === type);
  }

  /**
   * Filter items by source
   */
  static filterBySource(
    items: RedactionItem[],
    source: 'regex' | 'ml' | 'manual' | null
  ): RedactionItem[] {
    if (source === null) return items;
    return items.filter((item) => (item.source || 'manual') === source);
  }

  /**
   * Get color for heatmap density value (0-1)
   */
  static getHeatmapColor(density: number, alpha: number = 1.0): string {
    // Color gradient: blue (0) → cyan (0.25) → green (0.5) → yellow (0.75) → red (1.0)
    let r: number, g: number, b: number;

    if (density < 0.25) {
      // Blue to cyan
      const t = density / 0.25;
      r = 0;
      g = Math.round(255 * t);
      b = 255;
    } else if (density < 0.5) {
      // Cyan to green
      const t = (density - 0.25) / 0.25;
      r = 0;
      g = 255;
      b = Math.round(255 * (1 - t));
    } else if (density < 0.75) {
      // Green to yellow
      const t = (density - 0.5) / 0.25;
      r = Math.round(255 * t);
      g = 255;
      b = 0;
    } else {
      // Yellow to red
      const t = (density - 0.75) / 0.25;
      r = 255;
      g = Math.round(255 * (1 - t));
      b = 0;
    }

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Get confidence color (traffic light style)
   */
  static getConfidenceColor(confidence: number): string {
    if (confidence >= 0.9) return '#00FF00'; // Green (high)
    if (confidence >= 0.7) return '#FFFF00'; // Yellow (medium)
    return '#FF6600'; // Orange (low)
  }

  /**
   * Get confidence badge emoji
   */
  static getConfidenceBadge(confidence: number): string {
    if (confidence >= 0.9) return '🟢';
    if (confidence >= 0.7) return '🟡';
    return '🟠';
  }
}

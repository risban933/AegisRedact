/**
 * Tests for analytics aggregator
 */

import { describe, it, expect } from 'vitest';
import { AnalyticsAggregator } from '../../src/lib/analytics/aggregator';
import type { RedactionItem } from '../../src/ui/components/RedactionList';
import type { Box } from '../../src/lib/pdf/find';

describe('AnalyticsAggregator', () => {
  const createItem = (
    page: number,
    type: string,
    source: 'regex' | 'ml' | 'manual',
    confidence: number
  ): RedactionItem => ({
    id: `${page}-${Math.random()}`,
    x: Math.random() * 500,
    y: Math.random() * 700,
    w: 100,
    h: 20,
    text: 'test',
    enabled: true,
    page,
    type,
    source,
    confidence,
  });

  describe('computeStatistics', () => {
    it('should compute empty statistics', () => {
      const stats = AnalyticsAggregator.computeStatistics([], 10);
      expect(stats.totalDetections).toBe(0);
      expect(stats.averageConfidence).toBe(0);
    });

    it('should count by type', () => {
      const items: RedactionItem[] = [
        createItem(0, 'email', 'regex', 1.0),
        createItem(0, 'email', 'regex', 1.0),
        createItem(0, 'phone', 'regex', 1.0),
        createItem(0, 'ssn', 'ml', 0.9),
      ];

      const stats = AnalyticsAggregator.computeStatistics(items, 10);
      expect(stats.byType.email).toBe(2);
      expect(stats.byType.phone).toBe(1);
      expect(stats.byType.ssn).toBe(1);
      expect(stats.byType.card).toBe(0);
    });

    it('should count by page', () => {
      const items: RedactionItem[] = [
        createItem(0, 'email', 'regex', 1.0),
        createItem(0, 'phone', 'regex', 1.0),
        createItem(1, 'ssn', 'ml', 0.9),
        createItem(2, 'email', 'regex', 1.0),
        createItem(2, 'phone', 'regex', 1.0),
        createItem(2, 'card', 'regex', 1.0),
      ];

      const stats = AnalyticsAggregator.computeStatistics(items, 10);
      expect(stats.byPage[0]).toBe(2);
      expect(stats.byPage[1]).toBe(1);
      expect(stats.byPage[2]).toBe(3);
      expect(stats.pagesWithDetections).toBe(3);
    });

    it('should count by source', () => {
      const items: RedactionItem[] = [
        createItem(0, 'email', 'regex', 1.0),
        createItem(0, 'email', 'regex', 1.0),
        createItem(0, 'phone', 'ml', 0.9),
        createItem(0, 'ssn', 'ml', 0.85),
      ];

      const stats = AnalyticsAggregator.computeStatistics(items, 10);
      expect(stats.bySource.regex).toBe(2);
      expect(stats.bySource.ml).toBe(2);
      expect(stats.bySource.manual).toBe(0);
    });

    it('should count by confidence', () => {
      const items: RedactionItem[] = [
        createItem(0, 'email', 'regex', 1.0), // high
        createItem(0, 'phone', 'ml', 0.95), // high
        createItem(0, 'ssn', 'ml', 0.85), // medium
        createItem(0, 'card', 'ml', 0.75), // medium
        createItem(0, 'email', 'ml', 0.65), // low
      ];

      const stats = AnalyticsAggregator.computeStatistics(items, 10);
      expect(stats.byConfidence.high).toBe(2);
      expect(stats.byConfidence.medium).toBe(2);
      expect(stats.byConfidence.low).toBe(1);
    });

    it('should calculate average confidence', () => {
      const items: RedactionItem[] = [
        createItem(0, 'email', 'regex', 1.0),
        createItem(0, 'phone', 'ml', 0.8),
        createItem(0, 'ssn', 'ml', 0.9),
      ];

      const stats = AnalyticsAggregator.computeStatistics(items, 10);
      expect(stats.averageConfidence).toBeCloseTo(0.9);
    });

    it('should find hotspot page', () => {
      const items: RedactionItem[] = [
        createItem(0, 'email', 'regex', 1.0),
        createItem(1, 'phone', 'regex', 1.0),
        createItem(1, 'ssn', 'regex', 1.0),
        createItem(1, 'card', 'regex', 1.0),
        createItem(2, 'email', 'regex', 1.0),
      ];

      const stats = AnalyticsAggregator.computeStatistics(items, 10);
      expect(stats.hotspotPage).toBe(1);
      expect(stats.maxDetectionsOnPage).toBe(3);
    });
  });

  describe('computeHeatmap', () => {
    it('should compute empty heatmap', () => {
      const heatmap = AnalyticsAggregator.computeHeatmap([], 5);
      expect(heatmap).toHaveLength(5);
      expect(heatmap[0].density).toBe(0);
    });

    it('should normalize density', () => {
      const items: RedactionItem[] = [
        createItem(0, 'email', 'regex', 1.0),
        createItem(0, 'phone', 'regex', 1.0),
        createItem(1, 'ssn', 'regex', 1.0),
      ];

      const heatmap = AnalyticsAggregator.computeHeatmap(items, 5);
      expect(heatmap[0].density).toBe(1.0); // Page 0 has max (2 items)
      expect(heatmap[1].density).toBe(0.5); // Page 1 has half (1 item)
      expect(heatmap[2].density).toBe(0.0); // Page 2 has none
    });

    it('should include box counts', () => {
      const items: RedactionItem[] = [
        createItem(0, 'email', 'regex', 1.0),
        createItem(0, 'phone', 'regex', 1.0),
        createItem(1, 'ssn', 'regex', 1.0),
      ];

      const heatmap = AnalyticsAggregator.computeHeatmap(items, 3);
      expect(heatmap[0].boxCount).toBe(2);
      expect(heatmap[1].boxCount).toBe(1);
      expect(heatmap[2].boxCount).toBe(0);
    });
  });

  describe('computeDensityGrid', () => {
    it('should create 10x10 grid', () => {
      const boxes: Box[] = [];
      const grid = AnalyticsAggregator.computeDensityGrid(boxes, 1000, 1400, 10);

      expect(grid).toHaveLength(10);
      expect(grid[0]).toHaveLength(10);
    });

    it('should normalize grid values', () => {
      const boxes: Box[] = [
        { x: 50, y: 50, w: 100, h: 20, text: 'test1' }, // Cell (0, 0)
        { x: 50, y: 50, w: 100, h: 20, text: 'test2' }, // Cell (0, 0)
        { x: 150, y: 150, w: 100, h: 20, text: 'test3' }, // Cell (1, 1)
      ];

      const grid = AnalyticsAggregator.computeDensityGrid(boxes, 1000, 1400, 10);

      // Cell (0, 0) should have max density (2 boxes)
      expect(grid[0][0]).toBe(1.0);

      // Cell (1, 1) should have half density (1 box)
      expect(grid[1][1]).toBe(0.5);
    });
  });

  describe('getTypeStatistics', () => {
    it('should aggregate by type', () => {
      const items: RedactionItem[] = [
        createItem(0, 'email', 'regex', 1.0),
        createItem(0, 'email', 'ml', 0.9),
        createItem(1, 'phone', 'regex', 1.0),
      ];

      const typeStats = AnalyticsAggregator.getTypeStatistics(items);

      expect(typeStats).toHaveLength(2);
      expect(typeStats[0].type).toBe('email');
      expect(typeStats[0].count).toBe(2);
      expect(typeStats[1].type).toBe('phone');
      expect(typeStats[1].count).toBe(1);
    });

    it('should calculate percentages', () => {
      const items: RedactionItem[] = [
        createItem(0, 'email', 'regex', 1.0),
        createItem(0, 'email', 'regex', 1.0),
        createItem(0, 'phone', 'regex', 1.0),
        createItem(0, 'ssn', 'regex', 1.0),
      ];

      const typeStats = AnalyticsAggregator.getTypeStatistics(items);

      expect(typeStats[0].percentage).toBe(50); // 2/4 emails
      expect(typeStats[1].percentage).toBe(25); // 1/4 phone
      expect(typeStats[2].percentage).toBe(25); // 1/4 ssn
    });
  });

  describe('getHotspots', () => {
    it('should find top N hotspots', () => {
      const items: RedactionItem[] = [
        createItem(0, 'email', 'regex', 1.0),
        createItem(1, 'phone', 'regex', 1.0),
        createItem(1, 'ssn', 'regex', 1.0),
        createItem(1, 'card', 'regex', 1.0),
        createItem(2, 'email', 'regex', 1.0),
        createItem(2, 'phone', 'regex', 1.0),
      ];

      const hotspots = AnalyticsAggregator.getHotspots(items, 3);

      expect(hotspots).toHaveLength(3);
      expect(hotspots[0].page).toBe(1); // 3 detections
      expect(hotspots[0].count).toBe(3);
      expect(hotspots[1].page).toBe(2); // 2 detections
      expect(hotspots[2].page).toBe(0); // 1 detection
    });
  });

  describe('exportToCSV', () => {
    it('should export to CSV format', () => {
      const items: RedactionItem[] = [
        createItem(0, 'email', 'regex', 1.0),
        createItem(1, 'phone', 'ml', 0.95),
      ];

      const csv = AnalyticsAggregator.exportToCSV(items);

      expect(csv).toContain('Page,Type,Source,Confidence');
      expect(csv).toContain('1,email,regex,1.00');
      expect(csv).toContain('2,phone,ml,0.95');
    });

    it('should escape quotes in text', () => {
      const item: RedactionItem = {
        id: '1',
        x: 10,
        y: 20,
        w: 100,
        h: 20,
        text: 'test "quoted" text',
        enabled: true,
        page: 0,
        type: 'email',
        source: 'regex',
        confidence: 1.0,
      };

      const csv = AnalyticsAggregator.exportToCSV([item]);
      expect(csv).toContain('test ""quoted"" text');
    });
  });

  describe('getHeatmapColor', () => {
    it('should return blue for low density', () => {
      const color = AnalyticsAggregator.getHeatmapColor(0.1);
      expect(color).toContain('rgb');
    });

    it('should return red for high density', () => {
      const color = AnalyticsAggregator.getHeatmapColor(1.0);
      expect(color).toContain('255, 0, 0'); // Red
    });
  });

  describe('getConfidenceColor', () => {
    it('should return green for high confidence', () => {
      expect(AnalyticsAggregator.getConfidenceColor(0.95)).toBe('#00FF00');
    });

    it('should return yellow for medium confidence', () => {
      expect(AnalyticsAggregator.getConfidenceColor(0.8)).toBe('#FFFF00');
    });

    it('should return orange for low confidence', () => {
      expect(AnalyticsAggregator.getConfidenceColor(0.6)).toBe('#FF6600');
    });
  });

  describe('filtering', () => {
    const items: RedactionItem[] = [
      createItem(0, 'email', 'regex', 1.0),
      createItem(0, 'phone', 'ml', 0.8),
      createItem(0, 'ssn', 'ml', 0.6),
    ];

    it('should filter by confidence', () => {
      const filtered = AnalyticsAggregator.filterByConfidence(items, 0.9);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe('email');
    });

    it('should filter by type', () => {
      const filtered = AnalyticsAggregator.filterByType(items, 'phone');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe('phone');
    });

    it('should filter by source', () => {
      const filtered = AnalyticsAggregator.filterBySource(items, 'ml');
      expect(filtered).toHaveLength(2);
    });
  });
});

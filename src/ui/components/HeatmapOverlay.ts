/**
 * Heatmap Overlay - Visualizes redaction density across document pages
 */

import type { HeatmapData } from '../../lib/analytics/types';
import { AnalyticsAggregator } from '../../lib/analytics/aggregator';

export type HeatmapMode = 'grid' | 'blur' | 'outline';

export class HeatmapOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mode: HeatmapMode = 'grid';
  private opacity: number = 0.3;
  private enabled: boolean = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'heatmap-overlay';
    this.canvas.style.display = 'none';
    this.canvas.style.pointerEvents = 'none';
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Render heatmap for a page
   */
  render(heatmapData: HeatmapData, canvasWidth: number, canvasHeight: number): void {
    if (!this.enabled) {
      this.canvas.style.display = 'none';
      return;
    }

    // Set canvas size to match source canvas
    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;
    this.canvas.style.display = 'block';

    // Clear canvas
    this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    switch (this.mode) {
      case 'grid':
        this.renderGridMode(heatmapData, canvasWidth, canvasHeight);
        break;
      case 'blur':
        this.renderBlurMode(heatmapData);
        break;
      case 'outline':
        this.renderOutlineMode(heatmapData);
        break;
    }
  }

  /**
   * Render grid-based heatmap
   */
  private renderGridMode(heatmapData: HeatmapData, canvasWidth: number, canvasHeight: number): void {
    // Compute density grid
    const grid = AnalyticsAggregator.computeDensityGrid(
      heatmapData.boxes,
      canvasWidth,
      canvasHeight,
      10
    );

    const cellWidth = canvasWidth / 10;
    const cellHeight = canvasHeight / 10;

    // Render grid cells
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const density = grid[y][x];
        if (density === 0) continue;

        const color = AnalyticsAggregator.getHeatmapColor(density, this.opacity);
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
      }
    }
  }

  /**
   * Render blur-based heatmap (gaussian-like)
   */
  private renderBlurMode(heatmapData: HeatmapData): void {
    this.ctx.save();

    // Draw blurred circles around each box
    heatmapData.boxes.forEach((box) => {
      const centerX = box.x + box.w / 2;
      const centerY = box.y + box.h / 2;
      const radius = Math.max(box.w, box.h) * 1.5;

      // Create radial gradient
      const gradient = this.ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius
      );

      const color = AnalyticsAggregator.getHeatmapColor(0.8, this.opacity);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'rgba(0, 0, 255, 0)');

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.restore();
  }

  /**
   * Render outline mode (just highlight boxes)
   */
  private renderOutlineMode(heatmapData: HeatmapData): void {
    this.ctx.save();

    // Calculate overall density for this page
    const density = heatmapData.density;
    const color = AnalyticsAggregator.getHeatmapColor(density, this.opacity * 2);

    // Draw semi-transparent overlay on boxes
    heatmapData.boxes.forEach((box) => {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(box.x, box.y, box.w, box.h);

      // Add border
      this.ctx.strokeStyle = AnalyticsAggregator.getHeatmapColor(density, 1.0);
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(box.x, box.y, box.w, box.h);
    });

    this.ctx.restore();
  }

  /**
   * Set heatmap mode
   */
  setMode(mode: HeatmapMode): void {
    this.mode = mode;
  }

  /**
   * Set heatmap opacity
   */
  setOpacity(opacity: number): void {
    this.opacity = Math.max(0, Math.min(1, opacity));
  }

  /**
   * Enable/disable heatmap
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.canvas.style.display = enabled ? 'block' : 'none';
  }

  /**
   * Get enabled state
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.canvas.remove();
  }
}

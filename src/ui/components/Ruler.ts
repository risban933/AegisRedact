/**
 * Ruler component - renders horizontal and vertical rulers with tick marks
 */

import type { RulerOptions } from '../../lib/ruler/types';
import type { GuideManager } from '../../lib/ruler/guide-manager';

export class Ruler {
  private horizontalCanvas: HTMLCanvasElement;
  private verticalCanvas: HTMLCanvasElement;
  private horizontalCtx: CanvasRenderingContext2D;
  private verticalCtx: CanvasRenderingContext2D;
  private guideManager?: GuideManager;
  private onGuideCreate?: (orientation: 'horizontal' | 'vertical', position: number) => void;

  constructor(
    guideManager?: GuideManager,
    onGuideCreate?: (orientation: 'horizontal' | 'vertical', position: number) => void
  ) {
    this.guideManager = guideManager;
    this.onGuideCreate = onGuideCreate;

    // Create horizontal ruler (top)
    this.horizontalCanvas = document.createElement('canvas');
    this.horizontalCanvas.className = 'ruler-horizontal';
    this.horizontalCtx = this.horizontalCanvas.getContext('2d')!;

    // Create vertical ruler (left)
    this.verticalCanvas = document.createElement('canvas');
    this.verticalCanvas.className = 'ruler-vertical';
    this.verticalCtx = this.verticalCanvas.getContext('2d')!;

    // Setup click handlers for creating guides
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for guide creation
   */
  private setupEventListeners(): void {
    // Click horizontal ruler to create vertical guide
    this.horizontalCanvas.addEventListener('click', (e) => {
      if (!this.onGuideCreate) return;
      const rect = this.horizontalCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      this.onGuideCreate('vertical', x);
    });

    // Click vertical ruler to create horizontal guide
    this.verticalCanvas.addEventListener('click', (e) => {
      if (!this.onGuideCreate) return;
      const rect = this.verticalCanvas.getBoundingClientRect();
      const y = e.clientY - rect.top;
      this.onGuideCreate('horizontal', y);
    });

    // Add cursor styles
    this.horizontalCanvas.style.cursor = 'crosshair';
    this.verticalCanvas.style.cursor = 'crosshair';
  }

  /**
   * Render horizontal ruler
   */
  renderHorizontal(options: RulerOptions): void {
    const { width, scale, majorTickInterval, minorTickInterval, labelInterval } = options;
    const rulerHeight = 20;

    // Set canvas size
    this.horizontalCanvas.width = width;
    this.horizontalCanvas.height = rulerHeight;

    const ctx = this.horizontalCtx;

    // Clear and draw background
    ctx.fillStyle = '#1a1f35';
    ctx.fillRect(0, 0, width, rulerHeight);

    // Draw border
    ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, rulerHeight);

    // Draw tick marks
    ctx.strokeStyle = 'rgba(102, 126, 234, 0.6)';
    ctx.fillStyle = '#9ca3b8';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let x = 0; x <= width; x += minorTickInterval * scale) {
      const isMajor = x % (majorTickInterval * scale) === 0;
      const isLabel = x % (labelInterval * scale) === 0;

      ctx.beginPath();
      ctx.moveTo(x, rulerHeight);
      ctx.lineTo(x, rulerHeight - (isMajor ? 8 : 4));
      ctx.stroke();

      // Draw labels
      if (isLabel && x > 0) {
        const label = Math.round(x / scale);
        ctx.fillText(label.toString(), x, rulerHeight / 2);
      }
    }
  }

  /**
   * Render vertical ruler
   */
  renderVertical(options: RulerOptions): void {
    const { height, scale, majorTickInterval, minorTickInterval, labelInterval } = options;
    const rulerWidth = 20;

    // Set canvas size
    this.verticalCanvas.width = rulerWidth;
    this.verticalCanvas.height = height;

    const ctx = this.verticalCtx;

    // Clear and draw background
    ctx.fillStyle = '#1a1f35';
    ctx.fillRect(0, 0, rulerWidth, height);

    // Draw border
    ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, rulerWidth, height);

    // Draw tick marks
    ctx.strokeStyle = 'rgba(102, 126, 234, 0.6)';
    ctx.fillStyle = '#9ca3b8';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let y = 0; y <= height; y += minorTickInterval * scale) {
      const isMajor = y % (majorTickInterval * scale) === 0;
      const isLabel = y % (labelInterval * scale) === 0;

      ctx.beginPath();
      ctx.moveTo(rulerWidth, y);
      ctx.lineTo(rulerWidth - (isMajor ? 8 : 4), y);
      ctx.stroke();

      // Draw labels (rotated)
      if (isLabel && y > 0) {
        const label = Math.round(y / scale);
        ctx.save();
        ctx.translate(rulerWidth / 2, y);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(label.toString(), 0, 0);
        ctx.restore();
      }
    }
  }

  /**
   * Get horizontal ruler canvas
   */
  getHorizontalCanvas(): HTMLCanvasElement {
    return this.horizontalCanvas;
  }

  /**
   * Get vertical ruler canvas
   */
  getVerticalCanvas(): HTMLCanvasElement {
    return this.verticalCanvas;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.horizontalCanvas.remove();
    this.verticalCanvas.remove();
  }
}

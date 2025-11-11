/**
 * Pattern-based redaction styles (diagonal lines, crosshatch, dots)
 */

import type { Box } from '../../pdf/find';
import type { RedactionStyle, StyleOptions } from '../styles';
import { createPreviewCanvas } from '../styles';

export class PatternRedactionStyle implements RedactionStyle {
  id = 'pattern';
  name = 'Pattern Fill';
  description = 'Black pattern fill (diagonal, crosshatch, or dots)';
  securityScore = 95;
  category: 'secure' | 'experimental' | 'visual' = 'secure';

  render(ctx: CanvasRenderingContext2D, box: Box, options?: StyleOptions): void {
    const pattern = options?.pattern || 'diagonal';
    const padding = options?.padding || 0;

    const x = box.x - padding;
    const y = box.y - padding;
    const w = box.w + padding * 2;
    const h = box.h + padding * 2;

    // First fill with black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, w, h);

    // Then draw pattern on top (for visual variety, but exports as solid)
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;

    switch (pattern) {
      case 'diagonal':
        this.renderDiagonal(ctx, x, y, w, h);
        break;
      case 'crosshatch':
        this.renderCrosshatch(ctx, x, y, w, h);
        break;
      case 'dots':
        this.renderDots(ctx, x, y, w, h);
        break;
    }

    ctx.restore();
  }

  export(ctx: CanvasRenderingContext2D, box: Box, options?: StyleOptions): void {
    // Export is always solid black, no transparency
    const padding = options?.padding || 0;

    ctx.fillStyle = '#000000';
    ctx.fillRect(box.x - padding, box.y - padding, box.w + padding * 2, box.h + padding * 2);
  }

  getPreview(): string {
    const { canvas, ctx } = createPreviewCanvas();

    // Draw diagonal pattern preview
    ctx.fillStyle = '#000000';
    ctx.fillRect(5, 5, 40, 20);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;

    // Diagonal lines
    for (let i = -20; i < 60; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 5);
      ctx.lineTo(i + 25, 25);
      ctx.stroke();
    }

    return canvas.toDataURL();
  }

  private renderDiagonal(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const spacing = 10;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;

    // Draw diagonal lines at 45 degrees
    for (let i = -h; i < w; i += spacing) {
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i + h, y + h);
      ctx.stroke();
    }
  }

  private renderCrosshatch(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const spacing = 10;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;

    // Draw diagonal lines in both directions
    for (let i = -h; i < w; i += spacing) {
      // Forward diagonal
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i + h, y + h);
      ctx.stroke();

      // Backward diagonal
      ctx.beginPath();
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + h, y);
      ctx.stroke();
    }
  }

  private renderDots(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const spacing = 8;
    const radius = 2;

    ctx.fillStyle = '#ffffff';

    // Draw grid of dots
    for (let dx = 0; dx < w; dx += spacing) {
      for (let dy = 0; dy < h; dy += spacing) {
        ctx.beginPath();
        ctx.arc(x + dx + spacing / 2, y + dy + spacing / 2, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/**
 * Text replacement redaction style
 */

import type { Box } from '../../pdf/find';
import type { RedactionStyle, StyleOptions } from '../styles';
import { createPreviewCanvas } from '../styles';

export class TextRedactionStyle implements RedactionStyle {
  id = 'text';
  name = 'Custom Text';
  description = 'Replace with custom text (e.g., "REDACTED")';

  render(ctx: CanvasRenderingContext2D, box: Box, options?: StyleOptions): void {
    const text = options?.text || 'REDACTED';
    const padding = options?.padding || 4;

    const x = box.x - padding;
    const y = box.y - padding;
    const w = box.w + padding * 2;
    const h = box.h + padding * 2;

    // Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, w, h);

    // White text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Auto-size font to fit box
    let fontSize = options?.fontSize || this.calculateFontSize(ctx, text, w, h);
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;

    // Draw text centered
    ctx.fillText(text, x + w / 2, y + h / 2);
  }

  export(ctx: CanvasRenderingContext2D, box: Box, options?: StyleOptions): void {
    // Export with text (still opaque)
    const text = options?.text || 'REDACTED';
    const padding = options?.padding || 4;

    const x = box.x - padding;
    const y = box.y - padding;
    const w = box.w + padding * 2;
    const h = box.h + padding * 2;

    // Black background (fully opaque)
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, w, h);

    // White text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Auto-size font
    let fontSize = options?.fontSize || this.calculateFontSize(ctx, text, w, h);
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;

    // Draw text
    ctx.fillText(text, x + w / 2, y + h / 2);
  }

  getPreview(): string {
    const { canvas, ctx } = createPreviewCanvas();

    // Draw preview
    ctx.fillStyle = '#000000';
    ctx.fillRect(2, 5, 46, 20);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.fillText('REDACTED', 25, 15);

    return canvas.toDataURL();
  }

  /**
   * Calculate font size to fit text within box
   */
  private calculateFontSize(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxHeight: number
  ): number {
    const minFontSize = 8;
    const maxFontSize = 48;

    let fontSize = maxFontSize;

    // Try progressively smaller font sizes until it fits
    while (fontSize > minFontSize) {
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      const metrics = ctx.measureText(text);
      const textWidth = metrics.width;
      const textHeight = fontSize * 1.2; // Approximate height

      if (textWidth <= maxWidth * 0.9 && textHeight <= maxHeight * 0.9) {
        return fontSize;
      }

      fontSize -= 2;
    }

    return minFontSize;
  }
}

/**
 * Common text templates
 */
export const TEXT_TEMPLATES = [
  'REDACTED',
  '[REDACTED]',
  '█████',
  'XXX-XX-XXXX',
  '[CONFIDENTIAL]',
  '•••••',
  '[REMOVED]',
  'CENSORED',
] as const;

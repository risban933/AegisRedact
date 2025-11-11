/**
 * Solid black box redaction style (current default)
 */

import type { Box } from '../../pdf/find';
import type { RedactionStyle, StyleOptions } from '../styles';
import { createPreviewCanvas } from '../styles';

export class SolidRedactionStyle implements RedactionStyle {
  id = 'solid';
  name = 'Solid Black';
  description = 'Opaque black rectangle (default, most secure)';
  securityScore = 100;
  category: 'secure' | 'experimental' | 'visual' = 'secure';

  render(ctx: CanvasRenderingContext2D, box: Box, options?: StyleOptions): void {
    const color = options?.color || '#000000';
    const padding = options?.padding || 0;

    ctx.fillStyle = color;
    ctx.fillRect(box.x - padding, box.y - padding, box.w + padding * 2, box.h + padding * 2);
  }

  export(ctx: CanvasRenderingContext2D, box: Box, options?: StyleOptions): void {
    // Export is always solid black, no transparency
    const padding = options?.padding || 0;

    ctx.fillStyle = '#000000';
    ctx.fillRect(box.x - padding, box.y - padding, box.w + padding * 2, box.h + padding * 2);
  }

  getPreview(): string {
    const { canvas, ctx } = createPreviewCanvas();

    // Draw a solid black rectangle
    ctx.fillStyle = '#000000';
    ctx.fillRect(5, 5, 40, 20);

    return canvas.toDataURL();
  }
}

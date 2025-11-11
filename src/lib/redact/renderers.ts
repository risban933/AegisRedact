/**
 * Redaction Renderers
 *
 * Canvas rendering implementations for different redaction styles.
 */

import type { RedactionStyle, BoundingBox } from './types';

/**
 * Solid Black - Maximum Security (Recommended)
 *
 * Renders opaque black rectangles that are completely unrecoverable.
 * This is the gold standard for secure redaction.
 */
export const SolidBlackStyle: RedactionStyle = {
  id: 'solid-black',
  name: 'Solid Black',
  description: 'Opaque black rectangles - completely unrecoverable (recommended)',
  securityScore: 100,
  category: 'secure',

  render(ctx: CanvasRenderingContext2D, box: BoundingBox): void {
    ctx.fillStyle = '#000000';
    ctx.fillRect(box.x, box.y, box.width, box.height);
  },

  getPreview(): string {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 30;
    const ctx = canvas.getContext('2d')!;

    // Sample background text
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, 50, 30);
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText('SECRET', 5, 18);

    // Apply redaction
    this.render(ctx, { x: 5, y: 10, width: 40, height: 15 });

    return canvas.toDataURL();
  }
};

/**
 * Solid White - For Dark Documents
 *
 * Renders opaque white rectangles. Secure, but may not work well
 * on light backgrounds.
 */
export const SolidWhiteStyle: RedactionStyle = {
  id: 'solid-white',
  name: 'Solid White',
  description: 'Opaque white rectangles - for dark backgrounds',
  securityScore: 100,
  category: 'secure',

  render(ctx: CanvasRenderingContext2D, box: BoundingBox): void {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(box.x, box.y, box.width, box.height);
  },

  getPreview(): string {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 30;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 50, 30);
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText('SECRET', 5, 18);

    this.render(ctx, { x: 5, y: 10, width: 40, height: 15 });

    return canvas.toDataURL();
  }
};

/**
 * Colored Overlay - Visual Indication
 *
 * Renders colored semi-transparent or opaque rectangles.
 * Secure if opacity = 1.0, otherwise partially reversible.
 */
export const ColoredOverlayStyle: RedactionStyle = {
  id: 'colored-overlay',
  name: 'Colored Overlay',
  description: 'Colored rectangles with adjustable opacity',
  securityScore: 95,
  category: 'secure',

  render(
    ctx: CanvasRenderingContext2D,
    box: BoundingBox,
    color: string = '#ef4444'
  ): void {
    ctx.fillStyle = color;
    ctx.fillRect(box.x, box.y, box.width, box.height);
  },

  getPreview(): string {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 30;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, 50, 30);
    ctx.fillStyle = '#333';
    ctx.font = '10px monospace';
    ctx.fillText('SECRET', 5, 18);

    this.render(ctx, { x: 5, y: 10, width: 40, height: 15 }, '#ef4444');

    return canvas.toDataURL();
  }
};

/**
 * Strikethrough - Visual Indication Only
 *
 * Renders black bars with transparency. Text is still readable.
 * NOT secure - for visual indication only.
 */
export const StrikethroughStyle: RedactionStyle = {
  id: 'strikethrough',
  name: 'Strikethrough',
  description: '⚠️ Visual only - text remains readable',
  securityScore: 20,
  category: 'visual',

  render(ctx: CanvasRenderingContext2D, box: BoundingBox): void {
    const centerY = box.y + box.height / 2;
    const thickness = Math.max(2, box.height * 0.2);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(box.x, centerY - thickness / 2, box.width, thickness);
  },

  getPreview(): string {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 30;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 50, 30);
    ctx.fillStyle = '#333';
    ctx.font = '10px monospace';
    ctx.fillText('SECRET', 5, 18);

    this.render(ctx, { x: 5, y: 10, width: 40, height: 15 });

    return canvas.toDataURL();
  },

  getWarning(): string {
    return 'This style does NOT hide text securely. Use only for visual marking.';
  }
};

/**
 * Blur - EXPERIMENTAL & INSECURE
 *
 * Applies Gaussian blur to the region. Can be partially reversed
 * using deconvolution attacks. NOT RECOMMENDED for sensitive data.
 */
export const BlurStyle: RedactionStyle = {
  id: 'blur',
  name: 'Blur',
  description: '⚠️ WARNING: Can be reversed via deconvolution attacks',
  securityScore: 25,
  category: 'experimental',

  render(
    ctx: CanvasRenderingContext2D,
    box: BoundingBox,
    blurAmount: number = 20
  ): void {
    // Extract region
    const imageData = ctx.getImageData(box.x, box.y, box.width, box.height);

    // Save context
    ctx.save();

    // Apply blur filter
    ctx.filter = `blur(${blurAmount}px)`;

    // Create temporary canvas for blurred region
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = box.width;
    tempCanvas.height = box.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);

    // Draw blurred region back
    ctx.drawImage(tempCanvas, box.x, box.y);

    // Restore context
    ctx.restore();
  },

  getPreview(): string {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 30;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 50, 30);
    ctx.fillStyle = '#333';
    ctx.font = '10px monospace';
    ctx.fillText('SECRET', 5, 18);

    this.render(ctx, { x: 5, y: 10, width: 40, height: 15 }, 10);

    return canvas.toDataURL();
  },

  getWarning(): string {
    return 'Blur can be reversed using image processing techniques. NOT secure for sensitive data.';
  }
};

/**
 * Pixelate - EXPERIMENTAL & INSECURE
 *
 * Pixelates the region by downsampling and upsampling.
 * Can be partially reversed. NOT RECOMMENDED for sensitive data.
 */
export const PixelateStyle: RedactionStyle = {
  id: 'pixelate',
  name: 'Pixelate',
  description: '⚠️ WARNING: Can be partially reversed',
  securityScore: 30,
  category: 'experimental',

  render(
    ctx: CanvasRenderingContext2D,
    box: BoundingBox,
    pixelSize: number = 10
  ): void {
    // Extract region
    const imageData = ctx.getImageData(box.x, box.y, box.width, box.height);
    const data = imageData.data;

    // Pixelate by sampling every Nth pixel
    for (let y = 0; y < box.height; y += pixelSize) {
      for (let x = 0; x < box.width; x += pixelSize) {
        const pixelIndex = (y * box.width + x) * 4;

        // Get color of this pixel block
        const r = data[pixelIndex];
        const g = data[pixelIndex + 1];
        const b = data[pixelIndex + 2];

        // Fill block with same color
        for (let dy = 0; dy < pixelSize && y + dy < box.height; dy++) {
          for (let dx = 0; dx < pixelSize && x + dx < box.width; dx++) {
            const blockPixelIndex = ((y + dy) * box.width + (x + dx)) * 4;
            data[blockPixelIndex] = r;
            data[blockPixelIndex + 1] = g;
            data[blockPixelIndex + 2] = b;
          }
        }
      }
    }

    // Put pixelated region back
    ctx.putImageData(imageData, box.x, box.y);
  },

  getPreview(): string {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 30;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 50, 30);
    ctx.fillStyle = '#333';
    ctx.font = '10px monospace';
    ctx.fillText('SECRET', 5, 18);

    this.render(ctx, { x: 5, y: 10, width: 40, height = 15 }, 4);

    return canvas.toDataURL();
  },

  getWarning(): string {
    return 'Pixelation can be reversed using super-resolution techniques. NOT secure for sensitive data.';
  }
};

/**
 * Pattern Fill - Secure & Visual
 *
 * Fills with a repeating pattern (stripes, checkerboard, etc.).
 * Secure if pattern is opaque.
 */
export const PatternFillStyle: RedactionStyle = {
  id: 'pattern-fill',
  name: 'Pattern Fill',
  description: 'Repeating pattern overlay',
  securityScore: 95,
  category: 'secure',

  render(ctx: CanvasRenderingContext2D, box: BoundingBox): void {
    // Diagonal stripes pattern
    const stripeWidth = 8;

    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fillRect(box.x, box.y, box.width, box.height);

    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;

    // Draw diagonal lines
    for (let i = -box.height; i < box.width + box.height; i += stripeWidth) {
      ctx.beginPath();
      ctx.moveTo(box.x + i, box.y);
      ctx.lineTo(box.x + i + box.height, box.y + box.height);
      ctx.stroke();
    }

    ctx.restore();
  },

  getPreview(): string {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 30;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 50, 30);
    ctx.fillStyle = '#333';
    ctx.font = '10px monospace';
    ctx.fillText('SECRET', 5, 18);

    this.render(ctx, { x: 5, y: 10, width: 40, height: 15 });

    return canvas.toDataURL();
  }
};

import type { Box } from '../pdf/find';

/**
 * Image redaction utilities
 * Uses the same approach as PDF: solid black rectangles, then flatten
 */

/**
 * Apply redaction boxes to an image
 * Returns a new canvas with black boxes drawn over sensitive areas
 */
export function redactImage(
  img: HTMLImageElement,
  boxes: Box[]
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext('2d')!;

  // Draw the original image
  ctx.drawImage(img, 0, 0);

  // Draw opaque black rectangles
  ctx.fillStyle = '#000';
  for (const box of boxes) {
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }

  return canvas;
}

/**
 * Export a redacted image as a blob (with EXIF stripped via canvas re-encode)
 */
export async function exportRedactedImage(
  img: HTMLImageElement,
  boxes: Box[],
  format: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
  quality: number = 0.92
): Promise<Blob> {
  const canvas = redactImage(img, boxes);

  return await new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), format, quality);
  });
}

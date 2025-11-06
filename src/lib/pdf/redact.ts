import type { Box } from './find';

/**
 * Apply opaque black boxes to a canvas
 * This is the core redaction mechanism - solid black fills, not reversible blur
 */
export function applyBoxes(
  canvas: HTMLCanvasElement,
  boxes: Box[]
): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = canvas.width;
  output.height = canvas.height;

  const ctx = output.getContext('2d')!;

  // Draw the original content
  ctx.drawImage(canvas, 0, 0);

  // Draw opaque black rectangles over sensitive areas
  ctx.fillStyle = '#000';
  for (const box of boxes) {
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }

  return output;
}

/**
 * Add padding to boxes to ensure complete coverage
 */
export function expandBox(box: Box, padding: number): Box {
  return {
    x: box.x - padding,
    y: box.y - padding,
    w: box.w + padding * 2,
    h: box.h + padding * 2,
    text: box.text
  };
}

/**
 * Expand all boxes with padding
 */
export function expandBoxes(boxes: Box[], padding: number = 4): Box[] {
  return boxes.map(box => expandBox(box, padding));
}

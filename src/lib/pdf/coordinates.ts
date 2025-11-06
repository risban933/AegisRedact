/**
 * Coordinate system conversion utilities for PDF processing
 *
 * PDF.js uses canvas/viewport coordinates: origin top-left, Y increases downward
 * pdf-lib uses PDF coordinates: origin bottom-left, Y increases upward
 */

import type { Box } from './find';

export interface PdfLibBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Convert a Box from PDF.js viewport coordinates to pdf-lib page coordinates
 *
 * @param box - Box in PDF.js viewport coordinates (top-left origin)
 * @param pdfPageHeight - Height of the PDF page in pdf-lib coordinates
 * @param scale - Scale factor used when rendering (viewport.scale)
 * @returns Box in pdf-lib coordinates (bottom-left origin)
 */
export function convertBoxToPdfLib(
  box: Box,
  pdfPageHeight: number,
  scale: number
): PdfLibBox {
  console.log('convertBoxToPdfLib: Input box:', box);
  console.log('convertBoxToPdfLib: pdfPageHeight:', pdfPageHeight, 'scale:', scale);

  // Validate inputs
  if (!scale || scale <= 0 || isNaN(scale)) {
    throw new Error(`Invalid scale factor: ${scale}`);
  }

  if (!box) {
    throw new Error('Box is null or undefined');
  }

  // Check each coordinate individually
  if (typeof box.x !== 'number' || isNaN(box.x)) {
    throw new Error(`Invalid box.x: ${box.x} (type: ${typeof box.x})`);
  }
  if (typeof box.y !== 'number' || isNaN(box.y)) {
    throw new Error(`Invalid box.y: ${box.y} (type: ${typeof box.y})`);
  }
  if (typeof box.w !== 'number' || isNaN(box.w)) {
    throw new Error(`Invalid box.w: ${box.w} (type: ${typeof box.w})`);
  }
  if (typeof box.h !== 'number' || isNaN(box.h)) {
    throw new Error(`Invalid box.h: ${box.h} (type: ${typeof box.h})`);
  }

  // Convert from canvas pixels to PDF points
  const x = box.x / scale;
  const width = box.w / scale;
  const height = box.h / scale;
  const canvasY = box.y / scale;
  const y = pdfPageHeight - (canvasY + height);

  console.log('convertBoxToPdfLib: Converted:', { x, y, width, height });

  // Validate outputs
  if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
    throw new Error(`Conversion produced NaN: x=${x}, y=${y}, width=${width}, height=${height}`);
  }

  // Ensure coordinates are within reasonable bounds
  if (y < 0 || y > pdfPageHeight || x < 0) {
    console.warn(`Box coordinates out of bounds: x=${x}, y=${y}, width=${width}, height=${height}, pageHeight=${pdfPageHeight}`);
  }

  return { x, y, width, height };
}

/**
 * Convert multiple boxes at once
 */
export function convertBoxesToPdfLib(
  boxes: Box[],
  pdfPageHeight: number,
  scale: number
): PdfLibBox[] {
  return boxes.map(box => convertBoxToPdfLib(box, pdfPageHeight, scale));
}

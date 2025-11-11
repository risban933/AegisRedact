/**
 * Redaction Style Types
 *
 * Defines interfaces for the redaction style system that enables
 * different visual redaction methods with security scoring.
 */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RedactionStyle {
  id: string;
  name: string;
  description: string;
  securityScore: number; // 0-100 (100 = completely unrecoverable)
  category: 'secure' | 'experimental' | 'visual';

  /**
   * Render redaction on canvas context
   */
  render(ctx: CanvasRenderingContext2D, box: BoundingBox): void;

  /**
   * Generate preview thumbnail (50x30px data URL)
   */
  getPreview(): string;

  /**
   * Get warning message (if applicable)
   */
  getWarning?(): string;
}

export interface RedactionOptions {
  style: string; // Style ID
  color?: string;
  blurAmount?: number;
  pixelSize?: number;
  opacity?: number;
}

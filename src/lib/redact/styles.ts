/**
 * Redaction style system - pluggable renderers for different redaction styles
 */

import type { Box } from '../pdf/find';

/**
 * Options for redaction styling
 */
export interface StyleOptions {
  color?: string;
  pattern?: 'diagonal' | 'crosshatch' | 'dots';
  text?: string;
  fontSize?: number;
  padding?: number;
}

/**
 * Redaction style interface
 */
export interface RedactionStyle {
  id: string;
  name: string;
  description: string;

  /**
   * Security score (0-100)
   * 100 = completely unrecoverable
   * <50 = potentially reversible (show warning)
   */
  securityScore: number;

  /**
   * Style category
   */
  category: 'secure' | 'experimental' | 'visual';

  /**
   * Render the redaction for preview (on canvas)
   * This may use semi-transparency for visual feedback
   */
  render(ctx: CanvasRenderingContext2D, box: Box, options?: StyleOptions): void;

  /**
   * Render the redaction for export (final output)
   * This MUST be fully opaque (no transparency)
   */
  export(ctx: CanvasRenderingContext2D, box: Box, options?: StyleOptions): void;

  /**
   * Get a preview thumbnail for this style (50x30px)
   */
  getPreview(): string; // Data URL

  /**
   * Get security warning (if applicable)
   */
  getWarning?(): string;
}

/**
 * Extended Box type with style information
 */
export interface BoxWithStyle extends Box {
  styleId?: string;
  styleOptions?: StyleOptions;
}

/**
 * Style registry - manages available redaction styles
 */
export class StyleRegistry {
  private static styles: Map<string, RedactionStyle> = new Map();
  private static defaultStyleId: string = 'solid';

  /**
   * Register a redaction style
   */
  static register(style: RedactionStyle): void {
    this.styles.set(style.id, style);
  }

  /**
   * Get a style by ID
   */
  static get(id: string): RedactionStyle | undefined {
    return this.styles.get(id);
  }

  /**
   * Get the default style
   */
  static getDefault(): RedactionStyle {
    return this.styles.get(this.defaultStyleId)!;
  }

  /**
   * Set the default style
   */
  static setDefault(id: string): void {
    if (this.styles.has(id)) {
      this.defaultStyleId = id;
    }
  }

  /**
   * Get all registered styles
   */
  static getAll(): RedactionStyle[] {
    return Array.from(this.styles.values());
  }

  /**
   * Get all style IDs
   */
  static getIds(): string[] {
    return Array.from(this.styles.keys());
  }

  /**
   * Get styles by category
   */
  static getByCategory(category: 'secure' | 'experimental' | 'visual'): RedactionStyle[] {
    return this.getAll().filter(style => style.category === category);
  }

  /**
   * Get secure styles only (security score >= 90)
   */
  static getSecureStyles(): RedactionStyle[] {
    return this.getAll().filter(style => style.securityScore >= 90);
  }

  /**
   * Get security warning for a style
   */
  static getSecurityWarning(styleId: string): string | null {
    const style = this.get(styleId);
    if (!style) return null;

    if (style.securityScore < 50) {
      return `⚠️ Low Security (${style.securityScore}/100): ${style.getWarning?.() || 'This style may not fully protect sensitive information.'}`;
    }

    if (style.securityScore < 80) {
      return `⚠️ Moderate Security (${style.securityScore}/100): Consider using a more secure redaction method for highly sensitive data.`;
    }

    return null;
  }

  /**
   * Load default style from localStorage
   */
  static loadDefaultFromStorage(): string {
    try {
      return localStorage.getItem('redaction-style-default') || this.defaultStyleId;
    } catch (error) {
      return this.defaultStyleId;
    }
  }

  /**
   * Save default style to localStorage
   */
  static saveDefaultToStorage(styleId: string): void {
    try {
      localStorage.setItem('redaction-style-default', styleId);
      if (this.styles.has(styleId)) {
        this.defaultStyleId = styleId;
      }
    } catch (error) {
      console.warn('Failed to save default style:', error);
    }
  }
}

/**
 * Helper to create a preview canvas
 */
export function createPreviewCanvas(
  width: number = 50,
  height: number = 30
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  return { canvas, ctx };
}

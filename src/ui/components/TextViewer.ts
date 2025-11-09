/**
 * Text viewer component for displaying and redacting text files
 * Works with PlainTextFormat from the format abstraction layer
 */

import type { Document, BoundingBox } from '../../lib/formats/base/types';

export class TextViewer {
  private element: HTMLDivElement;
  private container: HTMLElement | null = null;
  private currentDoc: Document | null = null;
  private onBoxesChange: (boxes: BoundingBox[]) => void;

  constructor(onBoxesChange: (boxes: BoundingBox[]) => void) {
    this.onBoxesChange = onBoxesChange;
    this.element = this.createTextViewer();
  }

  private createTextViewer(): HTMLDivElement {
    const viewer = document.createElement('div');
    viewer.className = 'text-viewer glass-card';
    viewer.style.cssText = `
      width: 100%;
      max-width: 900px;
      margin: 0 auto;
      padding: 0;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      display: none;
    `;

    return viewer;
  }

  /**
   * Render a document using its format handler
   */
  async renderDocument(doc: Document, format: any): Promise<void> {
    this.currentDoc = doc;
    this.element.innerHTML = '';

    // Create a container for the format to render into
    const contentContainer = document.createElement('div');
    contentContainer.className = 'text-content-container';
    this.container = contentContainer;

    this.element.appendChild(contentContainer);

    // Let the format handler render the document
    await format.render(doc, {
      container: contentContainer,
      renderMode: 'dom'
    });

    this.element.style.display = 'block';
  }

  /**
   * Update redaction boxes on the rendered document
   */
  setBoxes(boxes: BoundingBox[]): void {
    if (!this.currentDoc) return;

    // Update document boxes
    this.currentDoc.boxes = boxes;

    // Re-render to show updated redactions
    // Note: This is a simple approach - could be optimized to only update changed boxes
    if (this.container) {
      // The format handler should handle visual updates
      // For now, we just store the boxes - the actual visual update
      // happens during export or when the format re-renders
    }
  }

  /**
   * Get current document
   */
  getDocument(): Document | null {
    return this.currentDoc;
  }

  /**
   * Get the viewer element
   */
  getElement(): HTMLDivElement {
    return this.element;
  }

  /**
   * Show the viewer
   */
  show(): void {
    this.element.style.display = 'block';
  }

  /**
   * Hide the viewer
   */
  hide(): void {
    this.element.style.display = 'none';
  }

  /**
   * Clear the viewer
   */
  clear(): void {
    this.element.innerHTML = '';
    this.currentDoc = null;
    this.container = null;
  }
}

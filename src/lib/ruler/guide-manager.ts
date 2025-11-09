/**
 * Guide Manager - manages guide lines with magnetic snapping
 */

import type { Box } from '../pdf/find';
import type { Guide, GuideEventListener } from './types';

export class GuideManager {
  private guides: Guide[] = [];
  private nextId: number = 1;
  private listeners: GuideEventListener[] = [];
  private snapThreshold: number = 5; // pixels

  /**
   * Add a guide line
   */
  addGuide(orientation: 'horizontal' | 'vertical', position: number, color: string = '#00FFFF'): Guide {
    const guide: Guide = {
      id: `guide-${this.nextId++}`,
      orientation,
      position,
      color,
    };

    this.guides.push(guide);
    this.notifyListeners();
    return guide;
  }

  /**
   * Remove a guide by ID
   */
  removeGuide(id: string): boolean {
    const index = this.guides.findIndex((g) => g.id === id);
    if (index < 0) return false;

    this.guides.splice(index, 1);
    this.notifyListeners();
    return true;
  }

  /**
   * Update guide position
   */
  updateGuidePosition(id: string, position: number): boolean {
    const guide = this.guides.find((g) => g.id === id);
    if (!guide) return false;

    guide.position = position;
    this.notifyListeners();
    return true;
  }

  /**
   * Get all guides
   */
  getGuides(): ReadonlyArray<Guide> {
    return this.guides;
  }

  /**
   * Get guides by orientation
   */
  getGuidesByOrientation(orientation: 'horizontal' | 'vertical'): Guide[] {
    return this.guides.filter((g) => g.orientation === orientation);
  }

  /**
   * Clear all guides
   */
  clearGuides(): void {
    this.guides = [];
    this.notifyListeners();
  }

  /**
   * Set snap threshold
   */
  setSnapThreshold(threshold: number): void {
    this.snapThreshold = threshold;
  }

  /**
   * Get snap threshold
   */
  getSnapThreshold(): number {
    return this.snapThreshold;
  }

  /**
   * Snap a box to nearby guides
   * Returns modified box if snapped, original if not
   */
  snapToGuides(box: Box): { box: Box; snapped: boolean; guides: Guide[] } {
    const snappedGuides: Guide[] = [];
    let snapped = false;
    const result = { ...box };

    // Snap left edge
    const leftGuide = this.findNearestVerticalGuide(box.x);
    if (leftGuide) {
      result.x = leftGuide.position;
      snappedGuides.push(leftGuide);
      snapped = true;
    }

    // Snap right edge
    const rightGuide = this.findNearestVerticalGuide(box.x + box.w);
    if (rightGuide) {
      result.x = rightGuide.position - box.w;
      snappedGuides.push(rightGuide);
      snapped = true;
    }

    // Snap top edge
    const topGuide = this.findNearestHorizontalGuide(box.y);
    if (topGuide) {
      result.y = topGuide.position;
      snappedGuides.push(topGuide);
      snapped = true;
    }

    // Snap bottom edge
    const bottomGuide = this.findNearestHorizontalGuide(box.y + box.h);
    if (bottomGuide) {
      result.y = bottomGuide.position - box.h;
      snappedGuides.push(bottomGuide);
      snapped = true;
    }

    return { box: result, snapped, guides: snappedGuides };
  }

  /**
   * Find nearest vertical guide within snap threshold
   */
  private findNearestVerticalGuide(x: number): Guide | null {
    let nearest: Guide | null = null;
    let minDistance = this.snapThreshold;

    for (const guide of this.guides) {
      if (guide.orientation === 'vertical') {
        const distance = Math.abs(guide.position - x);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = guide;
        }
      }
    }

    return nearest;
  }

  /**
   * Find nearest horizontal guide within snap threshold
   */
  private findNearestHorizontalGuide(y: number): Guide | null {
    let nearest: Guide | null = null;
    let minDistance = this.snapThreshold;

    for (const guide of this.guides) {
      if (guide.orientation === 'horizontal') {
        const distance = Math.abs(guide.position - y);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = guide;
        }
      }
    }

    return nearest;
  }

  /**
   * Render guides on canvas
   */
  renderGuides(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    this.guides.forEach((guide) => {
      ctx.save();
      ctx.strokeStyle = guide.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      ctx.beginPath();
      if (guide.orientation === 'horizontal') {
        ctx.moveTo(0, guide.position);
        ctx.lineTo(canvasWidth, guide.position);
      } else {
        ctx.moveTo(guide.position, 0);
        ctx.lineTo(guide.position, canvasHeight);
      }
      ctx.stroke();

      ctx.restore();
    });
  }

  /**
   * Find guide at position (for dragging/deletion)
   */
  findGuideAtPosition(
    x: number,
    y: number,
    threshold: number = 10
  ): Guide | null {
    for (const guide of this.guides) {
      if (guide.orientation === 'horizontal') {
        if (Math.abs(guide.position - y) < threshold) {
          return guide;
        }
      } else {
        if (Math.abs(guide.position - x) < threshold) {
          return guide;
        }
      }
    }
    return null;
  }

  /**
   * Add event listener
   */
  addListener(listener: GuideEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeListener(listener: GuideEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify listeners of changes
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener([...this.guides]));
  }

  /**
   * Export state for serialization
   */
  exportState(): unknown {
    return {
      guides: this.guides.map((g) => ({ ...g })),
      nextId: this.nextId,
      snapThreshold: this.snapThreshold,
    };
  }

  /**
   * Import state from serialization
   */
  importState(state: any): void {
    this.guides = state.guides || [];
    this.nextId = state.nextId || 1;
    this.snapThreshold = state.snapThreshold || 5;
    this.notifyListeners();
  }
}

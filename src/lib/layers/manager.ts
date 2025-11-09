/**
 * Layer manager - manages multiple redaction layers
 */

import type { Box } from '../pdf/find';
import type {
  RedactionLayer,
  CreateLayerOptions,
  LayerEvent,
  LayerEventListener,
} from './types';

export class LayerManager {
  private layers: RedactionLayer[] = [];
  private activeLayerId: string;
  private listeners: LayerEventListener[] = [];
  private nextId: number = 1;

  constructor() {
    // Create default main layer
    const mainLayer = this.createLayer({ name: 'Main' });
    this.activeLayerId = mainLayer.id;
  }

  /**
   * Create a new layer
   */
  createLayer(options: CreateLayerOptions = {}): RedactionLayer {
    const id = `layer-${this.nextId++}`;
    const layer: RedactionLayer = {
      id,
      name: options.name || `Layer ${this.layers.length + 1}`,
      visible: options.visible !== undefined ? options.visible : true,
      locked: options.locked || false,
      opacity: options.opacity !== undefined ? options.opacity : 1.0,
      boxes: new Map(),
      createdAt: new Date(),
      modifiedAt: new Date(),
      color: options.color,
    };

    this.layers.push(layer);
    this.emit({ type: 'layer-created', layerId: id });

    return layer;
  }

  /**
   * Delete a layer
   */
  deleteLayer(id: string): boolean {
    const index = this.layers.findIndex((l) => l.id === id);
    if (index < 0) return false;

    // Can't delete the last layer
    if (this.layers.length === 1) {
      console.warn('Cannot delete the last layer');
      return false;
    }

    // If deleting active layer, switch to another layer
    if (this.activeLayerId === id) {
      const newActiveIndex = index > 0 ? index - 1 : index + 1;
      this.setActiveLayer(this.layers[newActiveIndex].id);
    }

    this.layers.splice(index, 1);
    this.emit({ type: 'layer-deleted', layerId: id });

    return true;
  }

  /**
   * Get a layer by ID
   */
  getLayer(id: string): RedactionLayer | undefined {
    return this.layers.find((l) => l.id === id);
  }

  /**
   * Get all layers
   */
  getLayers(): ReadonlyArray<RedactionLayer> {
    return this.layers;
  }

  /**
   * Get the active layer
   */
  getActiveLayer(): RedactionLayer {
    const layer = this.layers.find((l) => l.id === this.activeLayerId);
    if (!layer) {
      // Fallback to first layer
      return this.layers[0];
    }
    return layer;
  }

  /**
   * Set the active layer
   */
  setActiveLayer(id: string): boolean {
    const layer = this.layers.find((l) => l.id === id);
    if (!layer) return false;

    const oldLayerId = this.activeLayerId;
    this.activeLayerId = id;
    this.emit({ type: 'active-layer-changed', oldLayerId, newLayerId: id });

    return true;
  }

  /**
   * Rename a layer
   */
  renameLayer(id: string, newName: string): boolean {
    const layer = this.layers.find((l) => l.id === id);
    if (!layer) return false;

    const oldName = layer.name;
    layer.name = newName;
    layer.modifiedAt = new Date();
    this.emit({ type: 'layer-renamed', layerId: id, oldName, newName });

    return true;
  }

  /**
   * Move layer to a new position
   */
  moveLayer(id: string, newIndex: number): boolean {
    const oldIndex = this.layers.findIndex((l) => l.id === id);
    if (oldIndex < 0) return false;

    if (newIndex < 0 || newIndex >= this.layers.length) return false;
    if (oldIndex === newIndex) return true;

    const [layer] = this.layers.splice(oldIndex, 1);
    this.layers.splice(newIndex, 0, layer);

    this.emit({ type: 'layer-moved', layerId: id, oldIndex, newIndex });
    return true;
  }

  /**
   * Toggle layer visibility
   */
  toggleVisibility(id: string): boolean {
    const layer = this.layers.find((l) => l.id === id);
    if (!layer) return false;

    layer.visible = !layer.visible;
    layer.modifiedAt = new Date();
    this.emit({ type: 'layer-visibility-changed', layerId: id, visible: layer.visible });

    return true;
  }

  /**
   * Toggle layer lock
   */
  toggleLock(id: string): boolean {
    const layer = this.layers.find((l) => l.id === id);
    if (!layer) return false;

    layer.locked = !layer.locked;
    layer.modifiedAt = new Date();
    this.emit({ type: 'layer-lock-changed', layerId: id, locked: layer.locked });

    return true;
  }

  /**
   * Set layer visibility
   */
  setVisibility(id: string, visible: boolean): boolean {
    const layer = this.layers.find((l) => l.id === id);
    if (!layer) return false;

    if (layer.visible === visible) return true;

    layer.visible = visible;
    layer.modifiedAt = new Date();
    this.emit({ type: 'layer-visibility-changed', layerId: id, visible });

    return true;
  }

  /**
   * Set layer lock
   */
  setLock(id: string, locked: boolean): boolean {
    const layer = this.layers.find((l) => l.id === id);
    if (!layer) return false;

    if (layer.locked === locked) return true;

    layer.locked = locked;
    layer.modifiedAt = new Date();
    this.emit({ type: 'layer-lock-changed', layerId: id, locked });

    return true;
  }

  /**
   * Get boxes for a specific page on a layer
   */
  getBoxes(layerId: string, page: number): Box[] {
    const layer = this.layers.find((l) => l.id === layerId);
    if (!layer) return [];

    return layer.boxes.get(page) || [];
  }

  /**
   * Set boxes for a specific page on a layer
   */
  setBoxes(layerId: string, page: number, boxes: Box[]): boolean {
    const layer = this.layers.find((l) => l.id === layerId);
    if (!layer) return false;

    layer.boxes.set(page, boxes);
    layer.modifiedAt = new Date();
    this.emit({ type: 'boxes-modified', layerId, page });

    return true;
  }

  /**
   * Add a box to a specific page on a layer
   */
  addBox(layerId: string, page: number, box: Box): boolean {
    const layer = this.layers.find((l) => l.id === layerId);
    if (!layer) return false;

    const boxes = layer.boxes.get(page) || [];
    boxes.push(box);
    layer.boxes.set(page, boxes);
    layer.modifiedAt = new Date();
    this.emit({ type: 'boxes-modified', layerId, page });

    return true;
  }

  /**
   * Remove a box from a specific page on a layer
   */
  removeBox(layerId: string, page: number, box: Box): boolean {
    const layer = this.layers.find((l) => l.id === layerId);
    if (!layer) return false;

    const boxes = layer.boxes.get(page) || [];
    const index = boxes.indexOf(box);
    if (index < 0) return false;

    boxes.splice(index, 1);
    layer.boxes.set(page, boxes);
    layer.modifiedAt = new Date();
    this.emit({ type: 'boxes-modified', layerId, page });

    return true;
  }

  /**
   * Merge all visible layers into a single box collection
   * Used for export
   */
  mergeVisibleLayers(): Map<number, Box[]> {
    const merged = new Map<number, Box[]>();

    // Process layers in order (bottom to top)
    for (const layer of this.layers) {
      if (!layer.visible) continue;

      for (const [page, boxes] of layer.boxes) {
        const existingBoxes = merged.get(page) || [];
        merged.set(page, [...existingBoxes, ...boxes]);
      }
    }

    return merged;
  }

  /**
   * Get total box count for a layer
   */
  getBoxCount(layerId: string): number {
    const layer = this.layers.find((l) => l.id === layerId);
    if (!layer) return 0;

    let count = 0;
    for (const boxes of layer.boxes.values()) {
      count += boxes.length;
    }
    return count;
  }

  /**
   * Duplicate a layer
   */
  duplicateLayer(id: string): RedactionLayer | null {
    const layer = this.layers.find((l) => l.id === id);
    if (!layer) return null;

    const newLayer = this.createLayer({
      name: `${layer.name} Copy`,
      visible: layer.visible,
      locked: false, // Unlock duplicates
      opacity: layer.opacity,
      color: layer.color,
    });

    // Deep copy boxes
    for (const [page, boxes] of layer.boxes) {
      newLayer.boxes.set(page, boxes.map((box) => ({ ...box })));
    }

    return newLayer;
  }

  /**
   * Merge a layer down (into the layer below it)
   */
  mergeDown(id: string): boolean {
    const index = this.layers.findIndex((l) => l.id === id);
    if (index <= 0) return false; // Can't merge bottom layer

    const layer = this.layers[index];
    const targetLayer = this.layers[index - 1];

    // Merge boxes
    for (const [page, boxes] of layer.boxes) {
      const targetBoxes = targetLayer.boxes.get(page) || [];
      targetLayer.boxes.set(page, [...targetBoxes, ...boxes]);
    }

    // Delete source layer
    this.deleteLayer(id);

    return true;
  }

  /**
   * Clear all boxes from a layer
   */
  clearLayer(id: string): boolean {
    const layer = this.layers.find((l) => l.id === id);
    if (!layer) return false;

    layer.boxes.clear();
    layer.modifiedAt = new Date();

    // Emit events for all pages that were cleared
    for (const page of layer.boxes.keys()) {
      this.emit({ type: 'boxes-modified', layerId: id, page });
    }

    return true;
  }

  /**
   * Add an event listener
   */
  addListener(listener: LayerEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove an event listener
   */
  removeListener(listener: LayerEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: LayerEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  /**
   * Export state for serialization
   */
  exportState(): unknown {
    return {
      layers: this.layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        opacity: layer.opacity,
        color: layer.color,
        boxes: Array.from(layer.boxes.entries()),
        createdAt: layer.createdAt.toISOString(),
        modifiedAt: layer.modifiedAt.toISOString(),
      })),
      activeLayerId: this.activeLayerId,
      nextId: this.nextId,
    };
  }

  /**
   * Import state from serialization
   */
  importState(state: any): void {
    this.layers = state.layers.map((layer: any) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity,
      color: layer.color,
      boxes: new Map(layer.boxes),
      createdAt: new Date(layer.createdAt),
      modifiedAt: new Date(layer.modifiedAt),
    }));
    this.activeLayerId = state.activeLayerId;
    this.nextId = state.nextId;
  }
}

/**
 * Tests for layer management system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LayerManager } from '../../src/lib/layers/manager';
import type { Box } from '../../src/lib/pdf/find';

describe('LayerManager', () => {
  let manager: LayerManager;

  beforeEach(() => {
    manager = new LayerManager();
  });

  it('should create default main layer', () => {
    const layers = manager.getLayers();
    expect(layers).toHaveLength(1);
    expect(layers[0].name).toBe('Main');
    expect(layers[0].visible).toBe(true);
    expect(layers[0].locked).toBe(false);
  });

  it('should create new layer', () => {
    const layer = manager.createLayer({ name: 'Test Layer' });
    expect(layer.name).toBe('Test Layer');
    expect(layer.visible).toBe(true);
    expect(layer.locked).toBe(false);

    const layers = manager.getLayers();
    expect(layers).toHaveLength(2);
  });

  it('should delete layer', () => {
    const layer = manager.createLayer({ name: 'Test' });
    expect(manager.deleteLayer(layer.id)).toBe(true);

    const layers = manager.getLayers();
    expect(layers).toHaveLength(1);
  });

  it('should not delete last layer', () => {
    const layers = manager.getLayers();
    expect(manager.deleteLayer(layers[0].id)).toBe(false);
  });

  it('should get active layer', () => {
    const active = manager.getActiveLayer();
    expect(active.name).toBe('Main');
  });

  it('should set active layer', () => {
    const layer = manager.createLayer({ name: 'Test' });
    expect(manager.setActiveLayer(layer.id)).toBe(true);

    const active = manager.getActiveLayer();
    expect(active.id).toBe(layer.id);
  });

  it('should rename layer', () => {
    const layer = manager.getActiveLayer();
    expect(manager.renameLayer(layer.id, 'New Name')).toBe(true);
    expect(layer.name).toBe('New Name');
  });

  it('should toggle visibility', () => {
    const layer = manager.getActiveLayer();
    expect(layer.visible).toBe(true);

    manager.toggleVisibility(layer.id);
    expect(layer.visible).toBe(false);

    manager.toggleVisibility(layer.id);
    expect(layer.visible).toBe(true);
  });

  it('should toggle lock', () => {
    const layer = manager.getActiveLayer();
    expect(layer.locked).toBe(false);

    manager.toggleLock(layer.id);
    expect(layer.locked).toBe(true);

    manager.toggleLock(layer.id);
    expect(layer.locked).toBe(false);
  });

  it('should add and get boxes', () => {
    const layer = manager.getActiveLayer();
    const box: Box = { x: 10, y: 20, w: 100, h: 50, text: 'test' };

    manager.addBox(layer.id, 0, box);

    const boxes = manager.getBoxes(layer.id, 0);
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toBe(box);
  });

  it('should set boxes', () => {
    const layer = manager.getActiveLayer();
    const boxes: Box[] = [
      { x: 10, y: 20, w: 100, h: 50, text: 'test1' },
      { x: 30, y: 40, w: 100, h: 50, text: 'test2' },
    ];

    manager.setBoxes(layer.id, 0, boxes);

    const retrieved = manager.getBoxes(layer.id, 0);
    expect(retrieved).toHaveLength(2);
  });

  it('should remove box', () => {
    const layer = manager.getActiveLayer();
    const box: Box = { x: 10, y: 20, w: 100, h: 50, text: 'test' };

    manager.addBox(layer.id, 0, box);
    expect(manager.getBoxes(layer.id, 0)).toHaveLength(1);

    manager.removeBox(layer.id, 0, box);
    expect(manager.getBoxes(layer.id, 0)).toHaveLength(0);
  });

  it('should merge visible layers', () => {
    const layer1 = manager.getActiveLayer();
    const layer2 = manager.createLayer({ name: 'Layer 2' });
    const layer3 = manager.createLayer({ name: 'Layer 3', visible: false });

    manager.addBox(layer1.id, 0, { x: 10, y: 20, w: 100, h: 50, text: 'layer1' });
    manager.addBox(layer2.id, 0, { x: 30, y: 40, w: 100, h: 50, text: 'layer2' });
    manager.addBox(layer3.id, 0, { x: 50, y: 60, w: 100, h: 50, text: 'layer3' });

    const merged = manager.mergeVisibleLayers();
    const page0Boxes = merged.get(0) || [];

    // Should only have boxes from visible layers (layer1 and layer2)
    expect(page0Boxes).toHaveLength(2);
  });

  it('should get box count', () => {
    const layer = manager.getActiveLayer();

    manager.addBox(layer.id, 0, { x: 10, y: 20, w: 100, h: 50, text: 'test1' });
    manager.addBox(layer.id, 0, { x: 30, y: 40, w: 100, h: 50, text: 'test2' });
    manager.addBox(layer.id, 1, { x: 50, y: 60, w: 100, h: 50, text: 'test3' });

    expect(manager.getBoxCount(layer.id)).toBe(3);
  });

  it('should duplicate layer', () => {
    const layer = manager.getActiveLayer();
    manager.addBox(layer.id, 0, { x: 10, y: 20, w: 100, h: 50, text: 'test' });

    const duplicate = manager.duplicateLayer(layer.id);
    expect(duplicate).not.toBeNull();
    expect(duplicate!.name).toBe('Main Copy');
    expect(duplicate!.locked).toBe(false); // Should unlock duplicates

    const boxes = manager.getBoxes(duplicate!.id, 0);
    expect(boxes).toHaveLength(1);
  });

  it('should merge down', () => {
    const layer1 = manager.getActiveLayer();
    const layer2 = manager.createLayer({ name: 'Layer 2' });

    manager.addBox(layer1.id, 0, { x: 10, y: 20, w: 100, h: 50, text: 'layer1' });
    manager.addBox(layer2.id, 0, { x: 30, y: 40, w: 100, h: 50, text: 'layer2' });

    expect(manager.mergeDown(layer2.id)).toBe(true);

    // Layer 2 should be deleted
    expect(manager.getLayers()).toHaveLength(1);

    // Layer 1 should have both boxes
    expect(manager.getBoxCount(layer1.id)).toBe(2);
  });

  it('should clear layer', () => {
    const layer = manager.getActiveLayer();
    manager.addBox(layer.id, 0, { x: 10, y: 20, w: 100, h: 50, text: 'test1' });
    manager.addBox(layer.id, 1, { x: 30, y: 40, w: 100, h: 50, text: 'test2' });

    manager.clearLayer(layer.id);
    expect(manager.getBoxCount(layer.id)).toBe(0);
  });

  it('should move layer', () => {
    const layer1 = manager.getActiveLayer();
    const layer2 = manager.createLayer({ name: 'Layer 2' });
    const layer3 = manager.createLayer({ name: 'Layer 3' });

    // Move layer1 to end
    manager.moveLayer(layer1.id, 2);

    const layers = manager.getLayers();
    expect(layers[0].id).toBe(layer2.id);
    expect(layers[1].id).toBe(layer3.id);
    expect(layers[2].id).toBe(layer1.id);
  });

  it('should emit events', () => {
    let eventCount = 0;
    manager.addListener(() => eventCount++);

    manager.createLayer({ name: 'Test' });
    expect(eventCount).toBeGreaterThan(0);
  });

  it('should export and import state', () => {
    const layer1 = manager.getActiveLayer();
    manager.addBox(layer1.id, 0, { x: 10, y: 20, w: 100, h: 50, text: 'test' });

    const layer2 = manager.createLayer({ name: 'Layer 2' });
    manager.addBox(layer2.id, 1, { x: 30, y: 40, w: 100, h: 50, text: 'test2' });

    const state = manager.exportState();

    // Create new manager and import
    const manager2 = new LayerManager();
    manager2.importState(state);

    expect(manager2.getLayers()).toHaveLength(2);
    expect(manager2.getBoxCount(layer1.id)).toBe(1);
    expect(manager2.getBoxCount(layer2.id)).toBe(1);
  });
});

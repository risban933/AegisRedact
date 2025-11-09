/**
 * Tests for history/undo system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '../../src/lib/history/manager';
import {
  AddBoxCommand,
  RemoveBoxCommand,
  MoveBoxCommand,
  ResizeBoxCommand,
} from '../../src/lib/history/commands';
import type { Box } from '../../src/lib/pdf/find';

describe('HistoryManager', () => {
  let manager: HistoryManager;
  let boxes: Box[];

  beforeEach(() => {
    manager = new HistoryManager(10); // Small stack for testing
    boxes = [];
  });

  it('should execute and undo add command', () => {
    const box: Box = { x: 10, y: 20, w: 100, h: 50, text: 'test' };
    const cmd = new AddBoxCommand(boxes, box);

    manager.execute(cmd);
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toBe(box);

    manager.undo();
    expect(boxes).toHaveLength(0);
  });

  it('should execute and redo command', () => {
    const box: Box = { x: 10, y: 20, w: 100, h: 50, text: 'test' };
    const cmd = new AddBoxCommand(boxes, box);

    manager.execute(cmd);
    manager.undo();
    expect(boxes).toHaveLength(0);

    manager.redo();
    expect(boxes).toHaveLength(1);
  });

  it('should clear redo stack on new command', () => {
    const box1: Box = { x: 10, y: 20, w: 100, h: 50, text: 'test1' };
    const box2: Box = { x: 30, y: 40, w: 100, h: 50, text: 'test2' };

    manager.execute(new AddBoxCommand(boxes, box1));
    manager.undo();
    expect(manager.canRedo()).toBe(true);

    manager.execute(new AddBoxCommand(boxes, box2));
    expect(manager.canRedo()).toBe(false);
  });

  it('should handle remove command', () => {
    const box: Box = { x: 10, y: 20, w: 100, h: 50, text: 'test' };
    boxes.push(box);

    const cmd = new RemoveBoxCommand(boxes, box);
    manager.execute(cmd);
    expect(boxes).toHaveLength(0);

    manager.undo();
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toBe(box);
  });

  it('should merge consecutive move commands', () => {
    const box: Box = { x: 10, y: 20, w: 100, h: 50, text: 'test' };

    manager.execute(new MoveBoxCommand(box, 10, 20, 15, 25));
    manager.execute(new MoveBoxCommand(box, 15, 25, 20, 30));
    manager.execute(new MoveBoxCommand(box, 20, 30, 25, 35));

    // Should merge into single command
    expect(manager.getUndoStack().length).toBe(1);

    manager.undo();
    expect(box.x).toBe(10);
    expect(box.y).toBe(20);
  });

  it('should handle batch operations', () => {
    const box1: Box = { x: 10, y: 20, w: 100, h: 50, text: 'test1' };
    const box2: Box = { x: 30, y: 40, w: 100, h: 50, text: 'test2' };

    manager.beginBatch();
    manager.execute(new AddBoxCommand(boxes, box1));
    manager.execute(new AddBoxCommand(boxes, box2));
    manager.endBatch();

    expect(boxes).toHaveLength(2);
    expect(manager.getUndoStack().length).toBe(1); // Single batch command

    manager.undo();
    expect(boxes).toHaveLength(0);
  });

  it('should cancel batch', () => {
    const box: Box = { x: 10, y: 20, w: 100, h: 50, text: 'test' };

    manager.beginBatch();
    manager.execute(new AddBoxCommand(boxes, box));
    manager.cancelBatch();

    expect(boxes).toHaveLength(0);
    expect(manager.getUndoStack().length).toBe(0);
  });

  it('should prune old history', () => {
    const maxSize = 5;
    manager = new HistoryManager(maxSize);

    // Add more than max
    for (let i = 0; i < maxSize + 3; i++) {
      const box: Box = { x: i, y: i, w: 100, h: 50, text: `test${i}` };
      manager.execute(new AddBoxCommand(boxes, box));
    }

    expect(manager.getUndoStack().length).toBe(maxSize);
  });

  it('should jump to specific position', () => {
    const box1: Box = { x: 10, y: 20, w: 100, h: 50, text: 'test1' };
    const box2: Box = { x: 30, y: 40, w: 100, h: 50, text: 'test2' };
    const box3: Box = { x: 50, y: 60, w: 100, h: 50, text: 'test3' };

    manager.execute(new AddBoxCommand(boxes, box1));
    manager.execute(new AddBoxCommand(boxes, box2));
    manager.execute(new AddBoxCommand(boxes, box3));

    expect(boxes).toHaveLength(3);

    // Jump back to position 1
    manager.jumpTo(1);
    expect(boxes).toHaveLength(1);
    expect(manager.getCurrentPosition()).toBe(1);

    // Jump forward to position 3
    manager.jumpTo(3);
    expect(boxes).toHaveLength(3);
  });

  it('should notify listeners', () => {
    let notifyCount = 0;
    manager.addListener(() => notifyCount++);

    const box: Box = { x: 10, y: 20, w: 100, h: 50, text: 'test' };
    manager.execute(new AddBoxCommand(boxes, box));
    expect(notifyCount).toBe(1);

    manager.undo();
    expect(notifyCount).toBe(2);

    manager.redo();
    expect(notifyCount).toBe(3);
  });

  it('should handle resize command', () => {
    const box: Box = { x: 10, y: 20, w: 100, h: 50, text: 'test' };

    manager.execute(new ResizeBoxCommand(box, 100, 50, 150, 75));
    expect(box.w).toBe(150);
    expect(box.h).toBe(75);

    manager.undo();
    expect(box.w).toBe(100);
    expect(box.h).toBe(50);
  });
});

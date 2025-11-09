/**
 * Commands for box operations (add, remove, move, resize)
 */

import type { Box } from '../../pdf/find';
import { BaseCommand } from '../command';

/**
 * Command to add a box
 */
export class AddBoxCommand extends BaseCommand {
  private boxes: Box[];
  private box: Box;

  constructor(boxes: Box[], box: Box) {
    super();
    this.boxes = boxes;
    this.box = box;
  }

  execute(): void {
    this.boxes.push(this.box);
  }

  undo(): void {
    const index = this.boxes.indexOf(this.box);
    if (index >= 0) {
      this.boxes.splice(index, 1);
    }
  }

  describe(): string {
    return `Add box at (${Math.round(this.box.x)}, ${Math.round(this.box.y)})`;
  }
}

/**
 * Command to remove a box
 */
export class RemoveBoxCommand extends BaseCommand {
  private boxes: Box[];
  private box: Box;
  private index: number;

  constructor(boxes: Box[], box: Box) {
    super();
    this.boxes = boxes;
    this.box = box;
    this.index = boxes.indexOf(box);
  }

  execute(): void {
    const index = this.boxes.indexOf(this.box);
    if (index >= 0) {
      this.boxes.splice(index, 1);
    }
  }

  undo(): void {
    // Restore at original position
    if (this.index >= 0 && this.index <= this.boxes.length) {
      this.boxes.splice(this.index, 0, this.box);
    } else {
      this.boxes.push(this.box);
    }
  }

  describe(): string {
    return `Remove box at (${Math.round(this.box.x)}, ${Math.round(this.box.y)})`;
  }
}

/**
 * Command to move a box
 */
export class MoveBoxCommand extends BaseCommand {
  private box: Box;
  private oldX: number;
  private oldY: number;
  private newX: number;
  private newY: number;

  constructor(box: Box, oldX: number, oldY: number, newX: number, newY: number) {
    super();
    this.box = box;
    this.oldX = oldX;
    this.oldY = oldY;
    this.newX = newX;
    this.newY = newY;
  }

  execute(): void {
    this.box.x = this.newX;
    this.box.y = this.newY;
  }

  undo(): void {
    this.box.x = this.oldX;
    this.box.y = this.oldY;
  }

  describe(): string {
    const dx = Math.round(this.newX - this.oldX);
    const dy = Math.round(this.newY - this.oldY);
    return `Move box (${dx > 0 ? '+' : ''}${dx}, ${dy > 0 ? '+' : ''}${dy})`;
  }

  /**
   * Merge consecutive move commands for the same box
   */
  merge(other: unknown): boolean {
    if (!(other instanceof MoveBoxCommand)) return false;
    if (other.box !== this.box) return false;

    // Update the end position
    this.newX = other.newX;
    this.newY = other.newY;
    return true;
  }
}

/**
 * Command to resize a box
 */
export class ResizeBoxCommand extends BaseCommand {
  private box: Box;
  private oldW: number;
  private oldH: number;
  private newW: number;
  private newH: number;

  constructor(box: Box, oldW: number, oldH: number, newW: number, newH: number) {
    super();
    this.box = box;
    this.oldW = oldW;
    this.oldH = oldH;
    this.newW = newW;
    this.newH = newH;
  }

  execute(): void {
    this.box.w = this.newW;
    this.box.h = this.newH;
  }

  undo(): void {
    this.box.w = this.oldW;
    this.box.h = this.oldH;
  }

  describe(): string {
    const dw = Math.round(this.newW - this.oldW);
    const dh = Math.round(this.newH - this.oldH);
    return `Resize box (${dw > 0 ? '+' : ''}${dw}×${dh > 0 ? '+' : ''}${dh})`;
  }

  /**
   * Merge consecutive resize commands for the same box
   */
  merge(other: unknown): boolean {
    if (!(other instanceof ResizeBoxCommand)) return false;
    if (other.box !== this.box) return false;

    // Update the end size
    this.newW = other.newW;
    this.newH = other.newH;
    return true;
  }
}

/**
 * Command to move and resize a box (for drag operations)
 */
export class TransformBoxCommand extends BaseCommand {
  private box: Box;
  private oldX: number;
  private oldY: number;
  private oldW: number;
  private oldH: number;
  private newX: number;
  private newY: number;
  private newW: number;
  private newH: number;

  constructor(
    box: Box,
    oldX: number,
    oldY: number,
    oldW: number,
    oldH: number,
    newX: number,
    newY: number,
    newW: number,
    newH: number
  ) {
    super();
    this.box = box;
    this.oldX = oldX;
    this.oldY = oldY;
    this.oldW = oldW;
    this.oldH = oldH;
    this.newX = newX;
    this.newY = newY;
    this.newW = newW;
    this.newH = newH;
  }

  execute(): void {
    this.box.x = this.newX;
    this.box.y = this.newY;
    this.box.w = this.newW;
    this.box.h = this.newH;
  }

  undo(): void {
    this.box.x = this.oldX;
    this.box.y = this.oldY;
    this.box.w = this.oldW;
    this.box.h = this.oldH;
  }

  describe(): string {
    return 'Transform box';
  }

  /**
   * Merge consecutive transform commands for the same box
   */
  merge(other: unknown): boolean {
    if (!(other instanceof TransformBoxCommand)) return false;
    if (other.box !== this.box) return false;

    // Update the end state
    this.newX = other.newX;
    this.newY = other.newY;
    this.newW = other.newW;
    this.newH = other.newH;
    return true;
  }
}

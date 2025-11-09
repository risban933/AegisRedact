/**
 * Commands for detection operations (toggle, style changes)
 */

import type { RedactionItem } from '../../../ui/components/RedactionList';
import { BaseCommand } from '../command';

/**
 * Command to toggle a detection's enabled state
 */
export class ToggleDetectionCommand extends BaseCommand {
  private item: RedactionItem;
  private oldEnabled: boolean;
  private newEnabled: boolean;

  constructor(item: RedactionItem, newEnabled: boolean) {
    super();
    this.item = item;
    this.oldEnabled = item.enabled;
    this.newEnabled = newEnabled;
  }

  execute(): void {
    this.item.enabled = this.newEnabled;
  }

  undo(): void {
    this.item.enabled = this.oldEnabled;
  }

  describe(): string {
    return `${this.newEnabled ? 'Enable' : 'Disable'} detection`;
  }
}

/**
 * Command to toggle multiple detections at once
 */
export class ToggleMultipleDetectionsCommand extends BaseCommand {
  private items: RedactionItem[];
  private oldStates: Map<string, boolean>;
  private newEnabled: boolean;

  constructor(items: RedactionItem[], newEnabled: boolean) {
    super();
    this.items = items;
    this.newEnabled = newEnabled;
    this.oldStates = new Map(items.map((item) => [item.id, item.enabled]));
  }

  execute(): void {
    this.items.forEach((item) => {
      item.enabled = this.newEnabled;
    });
  }

  undo(): void {
    this.items.forEach((item) => {
      const oldState = this.oldStates.get(item.id);
      if (oldState !== undefined) {
        item.enabled = oldState;
      }
    });
  }

  describe(): string {
    return `${this.newEnabled ? 'Enable' : 'Disable'} ${this.items.length} detections`;
  }
}

/**
 * Command to change detection type filter
 */
export class FilterDetectionsCommand extends BaseCommand {
  private items: RedactionItem[];
  private oldStates: Map<string, boolean>;
  private newStates: Map<string, boolean>;
  private filterType: string | null;

  constructor(items: RedactionItem[], filterType: string | null, apply: boolean) {
    super();
    this.items = items;
    this.filterType = filterType;
    this.oldStates = new Map(items.map((item) => [item.id, item.enabled]));
    this.newStates = new Map();

    // Calculate new states
    items.forEach((item) => {
      const shouldEnable = filterType === null || item.type === filterType;
      this.newStates.set(item.id, apply ? shouldEnable : item.enabled);
    });
  }

  execute(): void {
    this.items.forEach((item) => {
      const newState = this.newStates.get(item.id);
      if (newState !== undefined) {
        item.enabled = newState;
      }
    });
  }

  undo(): void {
    this.items.forEach((item) => {
      const oldState = this.oldStates.get(item.id);
      if (oldState !== undefined) {
        item.enabled = oldState;
      }
    });
  }

  describe(): string {
    return this.filterType
      ? `Filter detections: ${this.filterType}`
      : 'Clear detection filter';
  }
}

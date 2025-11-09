/**
 * History manager for undo/redo functionality
 */

import type { Command } from './command';

export type HistoryChangeListener = () => void;

export class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxStackSize: number;
  private listeners: HistoryChangeListener[] = [];
  private batchMode: boolean = false;
  private batchCommands: Command[] = [];

  constructor(maxStackSize: number = 50) {
    this.maxStackSize = maxStackSize;
  }

  /**
   * Execute a command and add it to the history
   */
  execute(command: Command): void {
    if (this.batchMode) {
      this.batchCommands.push(command);
      command.execute();
      return;
    }

    command.execute();
    this.addToUndoStack(command);
    this.redoStack = []; // Clear redo stack when new command is executed
    this.notifyListeners();
  }

  /**
   * Undo the last command
   */
  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;

    command.undo();
    this.redoStack.push(command);
    this.notifyListeners();
    return true;
  }

  /**
   * Redo the last undone command
   */
  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;

    command.redo();
    this.undoStack.push(command);
    this.notifyListeners();
    return true;
  }

  /**
   * Start batch mode - group multiple commands into single undo step
   */
  beginBatch(): void {
    this.batchMode = true;
    this.batchCommands = [];
  }

  /**
   * End batch mode and commit all batched commands as a single unit
   */
  endBatch(description?: string): void {
    if (!this.batchMode) return;

    this.batchMode = false;

    if (this.batchCommands.length === 0) return;

    if (this.batchCommands.length === 1) {
      // Single command, no need for batch wrapper
      this.addToUndoStack(this.batchCommands[0]);
    } else {
      // Multiple commands, wrap in batch command
      const batch = new BatchCommand(this.batchCommands, description);
      this.addToUndoStack(batch);
    }

    this.batchCommands = [];
    this.redoStack = [];
    this.notifyListeners();
  }

  /**
   * Cancel batch mode without committing
   */
  cancelBatch(): void {
    if (!this.batchMode) return;

    // Undo all batched commands
    for (let i = this.batchCommands.length - 1; i >= 0; i--) {
      this.batchCommands[i].undo();
    }

    this.batchMode = false;
    this.batchCommands = [];
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyListeners();
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get the current undo stack
   */
  getUndoStack(): ReadonlyArray<Command> {
    return this.undoStack;
  }

  /**
   * Get the current redo stack
   */
  getRedoStack(): ReadonlyArray<Command> {
    return this.redoStack;
  }

  /**
   * Get the current position in history (0 = start, length = end)
   */
  getCurrentPosition(): number {
    return this.undoStack.length;
  }

  /**
   * Get total history length (undo + redo)
   */
  getTotalLength(): number {
    return this.undoStack.length + this.redoStack.length;
  }

  /**
   * Jump to a specific position in history
   */
  jumpTo(position: number): void {
    const current = this.getCurrentPosition();

    if (position === current) return;

    if (position < current) {
      // Undo to position
      for (let i = current; i > position; i--) {
        this.undo();
      }
    } else {
      // Redo to position
      for (let i = current; i < position; i++) {
        this.redo();
      }
    }
  }

  /**
   * Add a listener for history changes
   */
  addListener(listener: HistoryChangeListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove a listener
   */
  removeListener(listener: HistoryChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  private addToUndoStack(command: Command): void {
    // Try to merge with last command if possible
    if (this.undoStack.length > 0) {
      const lastCommand = this.undoStack[this.undoStack.length - 1];
      if (lastCommand.merge && lastCommand.merge(command)) {
        // Successfully merged, no need to add new command
        return;
      }
    }

    this.undoStack.push(command);

    // Prune stack if too large
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }
}

/**
 * Batch command that groups multiple commands
 */
class BatchCommand implements Command {
  private commands: Command[];
  private description?: string;
  private timestamp: Date;

  constructor(commands: Command[], description?: string) {
    this.commands = commands;
    this.description = description;
    this.timestamp = new Date();
  }

  execute(): void {
    this.commands.forEach((cmd) => cmd.execute());
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }

  redo(): void {
    this.commands.forEach((cmd) => cmd.redo());
  }

  describe(): string {
    return this.description || `Batch (${this.commands.length} operations)`;
  }

  getTimestamp(): Date {
    return this.timestamp;
  }
}

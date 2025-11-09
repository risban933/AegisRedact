/**
 * Command pattern interface for undo/redo operations
 */

export interface Command {
  /**
   * Execute the command
   */
  execute(): void;

  /**
   * Undo the command
   */
  undo(): void;

  /**
   * Redo the command (default: call execute again)
   */
  redo(): void;

  /**
   * Try to merge this command with another command
   * Returns true if merge was successful
   * Used for coalescing similar operations (e.g., multiple small moves)
   */
  merge?(other: Command): boolean;

  /**
   * Get a human-readable description of this command
   */
  describe(): string;

  /**
   * Get timestamp when command was created
   */
  getTimestamp(): Date;
}

/**
 * Base command class with common functionality
 */
export abstract class BaseCommand implements Command {
  protected timestamp: Date;

  constructor() {
    this.timestamp = new Date();
  }

  abstract execute(): void;
  abstract undo(): void;
  abstract describe(): string;

  redo(): void {
    this.execute();
  }

  getTimestamp(): Date {
    return this.timestamp;
  }
}

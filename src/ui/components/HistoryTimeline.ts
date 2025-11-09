/**
 * History Timeline - Visual undo/redo timeline component
 */

import type { HistoryManager } from '../../lib/history/manager';
import type { Command } from '../../lib/history/command';

export class HistoryTimeline {
  private element: HTMLDivElement;
  private historyManager: HistoryManager;
  private maxVisible: number = 20; // Show last 20 actions
  private isVisible: boolean = false;

  constructor(historyManager: HistoryManager) {
    this.historyManager = historyManager;
    this.element = this.createTimeline();

    // Listen to history changes
    this.historyManager.addListener(() => this.render());
  }

  private createTimeline(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'history-timeline';
    container.style.display = 'none';

    container.innerHTML = `
      <div class="history-timeline-header">
        <h3>History Timeline</h3>
        <div class="history-timeline-controls">
          <button id="history-undo" class="btn-icon" aria-label="Undo" disabled>
            ⟲
          </button>
          <button id="history-redo" class="btn-icon" aria-label="Redo" disabled>
            ⟳
          </button>
          <button id="history-close" class="btn-icon" aria-label="Close timeline">
            ✕
          </button>
        </div>
      </div>
      <div class="history-timeline-track">
        <div class="history-timeline-line"></div>
        <div class="history-timeline-nodes"></div>
      </div>
    `;

    // Setup event listeners
    container.querySelector('#history-undo')?.addEventListener('click', () => {
      this.historyManager.undo();
    });

    container.querySelector('#history-redo')?.addEventListener('click', () => {
      this.historyManager.redo();
    });

    container.querySelector('#history-close')?.addEventListener('click', () => {
      this.hide();
    });

    return container;
  }

  /**
   * Render timeline nodes
   */
  private render(): void {
    const nodesContainer = this.element.querySelector('.history-timeline-nodes');
    const undoButton = this.element.querySelector('#history-undo') as HTMLButtonElement;
    const redoButton = this.element.querySelector('#history-redo') as HTMLButtonElement;

    if (!nodesContainer) return;

    // Clear existing nodes
    nodesContainer.innerHTML = '';

    // Get history
    const undoStack = this.historyManager.getUndoStack();
    const redoStack = this.historyManager.getRedoStack();
    const currentPos = undoStack.length;
    const totalLength = undoStack.length + redoStack.length;

    // Update buttons
    undoButton.disabled = !this.historyManager.canUndo();
    redoButton.disabled = !this.historyManager.canRedo();

    if (totalLength === 0) {
      nodesContainer.innerHTML = '<p class="history-empty">No history yet</p>';
      return;
    }

    // Combine stacks for display
    const allCommands: Command[] = [...undoStack, ...redoStack];

    // Calculate visible range
    const startIndex = Math.max(0, currentPos - this.maxVisible / 2);
    const endIndex = Math.min(totalLength, startIndex + this.maxVisible);
    const visibleCommands = allCommands.slice(startIndex, endIndex);

    // Render nodes
    visibleCommands.forEach((command, index) => {
      const absoluteIndex = startIndex + index;
      const isPast = absoluteIndex < currentPos;
      const isCurrent = absoluteIndex === currentPos - 1;
      const isFuture = absoluteIndex >= currentPos;

      const node = document.createElement('div');
      node.className = 'history-timeline-node';

      if (isPast) node.classList.add('history-node-past');
      if (isCurrent) node.classList.add('history-node-current');
      if (isFuture) node.classList.add('history-node-future');

      // Create node circle
      const circle = document.createElement('div');
      circle.className = 'history-node-circle';
      node.appendChild(circle);

      // Create tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'history-node-tooltip';
      tooltip.textContent = command.describe();
      node.appendChild(tooltip);

      // Click to jump to this position
      node.addEventListener('click', () => {
        this.historyManager.jumpTo(absoluteIndex + 1);
      });

      nodesContainer.appendChild(node);
    });

    // Scroll current position into view
    const currentNode = nodesContainer.querySelector('.history-node-current');
    if (currentNode) {
      currentNode.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  /**
   * Show timeline
   */
  show(): void {
    this.isVisible = true;
    this.element.style.display = 'block';
    this.render();
  }

  /**
   * Hide timeline
   */
  hide(): void {
    this.isVisible = false;
    this.element.style.display = 'none';
  }

  /**
   * Toggle timeline visibility
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Get the timeline element
   */
  getElement(): HTMLDivElement {
    return this.element;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.element.remove();
  }
}

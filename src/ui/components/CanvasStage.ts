import type { Box } from '../../lib/pdf/find';
import type { HistoryManager } from '../../lib/history/manager';
import {
  AddBoxCommand,
  RemoveBoxCommand,
  MoveBoxCommand,
  ResizeBoxCommand,
} from '../../lib/history/commands';

interface CanvasStageOptions {
  onPrevPage?: () => void;
  onNextPage?: () => void;
  historyManager?: HistoryManager;
  showRulers?: boolean;
  snapToGrid?: number; // Grid size in pixels (0 = no snap)
}

/**
 * Canvas stage for displaying and editing redactions with precision controls
 */

export class CanvasStage {
  private element: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private boxes: Box[] = [];
  private selectedBoxIndex: number = -1;
  private scale: number = 1;
  private isDrawing: boolean = false;
  private drawStart: { x: number; y: number } | null = null;
  private onBoxesChange: (boxes: Box[]) => void;
  private onPrevPage?: () => void;
  private onNextPage?: () => void;
  private pageControls: HTMLDivElement | null = null;
  private pageIndicator: HTMLSpanElement | null = null;
  private prevPageButton: HTMLButtonElement | null = null;
  private nextPageButton: HTMLButtonElement | null = null;
  private zoomLabel: HTMLSpanElement | null = null;
  private wrapper: HTMLDivElement | null = null;
  private fitScale = 1;
  private lastFitScale = 1;
  private resizeObserver?: ResizeObserver;
  private sourceImage: HTMLImageElement | HTMLCanvasElement | null = null;
  private historyManager?: HistoryManager;
  private snapToGrid: number = 0;
  private positionTooltip: HTMLDivElement | null = null;
  private isDragging: boolean = false;
  private dragStart: { x: number; y: number; boxX: number; boxY: number } | null = null;

  constructor(onBoxesChange: (boxes: Box[]) => void, options: CanvasStageOptions = {}) {
    this.onBoxesChange = onBoxesChange;
    this.onPrevPage = options.onPrevPage;
    this.onNextPage = options.onNextPage;
    this.historyManager = options.historyManager;
    this.snapToGrid = options.snapToGrid || 0;
    this.element = this.createStage();
    this.canvas = this.element.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.createPositionTooltip();
    this.setupEventListeners();
  }

  /**
   * Create position tooltip for precision feedback
   */
  private createPositionTooltip(): void {
    this.positionTooltip = document.createElement('div');
    this.positionTooltip.className = 'canvas-position-tooltip';
    this.positionTooltip.style.display = 'none';
    this.element.appendChild(this.positionTooltip);
  }

  private createStage(): HTMLDivElement {
    const stage = document.createElement('div');
    stage.className = 'canvas-stage';

    stage.innerHTML = `
      <div class="canvas-controls">
        <div class="canvas-zoom-controls">
          <button id="zoom-in" class="btn-icon" aria-label="Zoom in">+</button>
          <button id="zoom-out" class="btn-icon" aria-label="Zoom out">−</button>
          <button id="zoom-reset" class="btn-icon" aria-label="Reset zoom">100%</button>
          <button id="zoom-fit" class="btn-icon" aria-label="Fit to screen">
            ⤢
          </button>
          <span id="zoom-label" class="canvas-zoom-label" aria-live="polite">100%</span>
        </div>
        <div class="canvas-page-controls" style="display: none;" aria-label="Page navigation" aria-live="polite">
          <button id="page-prev" class="btn-icon" aria-label="Previous page">
            <span aria-hidden="true">←</span>
          </button>
          <span id="page-indicator">Page 1 / 1</span>
          <button id="page-next" class="btn-icon" aria-label="Next page">
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <div class="canvas-wrapper">
        <canvas></canvas>
      </div>
    `;

    this.wrapper = stage.querySelector('.canvas-wrapper');
    this.pageControls = stage.querySelector('.canvas-page-controls');
    this.pageIndicator = stage.querySelector('#page-indicator') as HTMLSpanElement | null;
    this.prevPageButton = stage.querySelector('#page-prev') as HTMLButtonElement | null;
    this.nextPageButton = stage.querySelector('#page-next') as HTMLButtonElement | null;
    this.zoomLabel = stage.querySelector('#zoom-label') as HTMLSpanElement | null;

    this.prevPageButton?.addEventListener('click', () => {
      this.onPrevPage?.();
    });

    this.nextPageButton?.addEventListener('click', () => {
      this.onNextPage?.();
    });

    this.resizeObserver = this.wrapper
      ? new ResizeObserver(() => {
          this.fitToScreen();
        })
      : undefined;
    if (this.wrapper && this.resizeObserver) {
      this.resizeObserver.observe(this.wrapper);
    }

    return stage;
  }

  private setupEventListeners() {
    // Zoom controls
    this.element.querySelector('#zoom-in')?.addEventListener('click', () => {
      this.setScale(this.scale * 1.2);
    });

    this.element.querySelector('#zoom-out')?.addEventListener('click', () => {
      this.setScale(this.scale / 1.2);
    });

    this.element.querySelector('#zoom-reset')?.addEventListener('click', () => {
      this.setScale(1);
    });
    this.element.querySelector('#zoom-fit')?.addEventListener('click', () => {
      this.fitToScreen(true);
    });

    // Drawing boxes
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
    this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());

    // Keyboard support
    this.canvas.setAttribute('tabindex', '0');
    this.canvas.addEventListener('keydown', (e) => this.handleKeyDown(e));
  }

  /**
   * Handle keyboard events for precision controls
   */
  private handleKeyDown(e: KeyboardEvent): void {
    if (this.selectedBoxIndex < 0) return;

    const box = this.boxes[this.selectedBoxIndex];
    const MOVE_SMALL = 1;
    const MOVE_LARGE = 10;
    const delta = e.shiftKey ? MOVE_LARGE : MOVE_SMALL;

    let handled = false;
    const oldX = box.x;
    const oldY = box.y;
    const oldW = box.w;
    const oldH = box.h;

    if (e.key === 'Delete') {
      // Delete box
      if (this.historyManager) {
        this.historyManager.execute(new RemoveBoxCommand(this.boxes, box));
      } else {
        this.boxes.splice(this.selectedBoxIndex, 1);
      }
      this.selectedBoxIndex = -1;
      this.onBoxesChange(this.boxes);
      handled = true;
    } else if (e.altKey) {
      // Alt + Arrow = Resize
      switch (e.key) {
        case 'ArrowLeft':
          box.w = Math.max(5, box.w - delta);
          handled = true;
          break;
        case 'ArrowRight':
          box.w += delta;
          handled = true;
          break;
        case 'ArrowUp':
          box.h = Math.max(5, box.h - delta);
          handled = true;
          break;
        case 'ArrowDown':
          box.h += delta;
          handled = true;
          break;
      }

      if (handled && (oldW !== box.w || oldH !== box.h)) {
        if (this.historyManager) {
          this.historyManager.execute(new ResizeBoxCommand(box, oldW, oldH, box.w, box.h));
        }
        this.showPositionTooltip(box, `${Math.round(box.w)}×${Math.round(box.h)}`);
        this.onBoxesChange(this.boxes);
      }
    } else {
      // Arrow = Move
      switch (e.key) {
        case 'ArrowLeft':
          box.x = Math.max(0, box.x - delta);
          handled = true;
          break;
        case 'ArrowRight':
          box.x = Math.min(this.canvas.width - box.w, box.x + delta);
          handled = true;
          break;
        case 'ArrowUp':
          box.y = Math.max(0, box.y - delta);
          handled = true;
          break;
        case 'ArrowDown':
          box.y = Math.min(this.canvas.height - box.h, box.y + delta);
          handled = true;
          break;
      }

      if (handled && (oldX !== box.x || oldY !== box.y)) {
        // Apply grid snapping if enabled
        if (this.snapToGrid > 0) {
          box.x = Math.round(box.x / this.snapToGrid) * this.snapToGrid;
          box.y = Math.round(box.y / this.snapToGrid) * this.snapToGrid;
        }

        if (this.historyManager) {
          this.historyManager.execute(new MoveBoxCommand(box, oldX, oldY, box.x, box.y));
        }
        this.showPositionTooltip(box, `(${Math.round(box.x)}, ${Math.round(box.y)})`);
        this.onBoxesChange(this.boxes);
      }
    }

    if (handled) {
      e.preventDefault();
      this.render();
    }
  }

  /**
   * Show position tooltip for precision feedback
   */
  private showPositionTooltip(box: Box, text: string): void {
    if (!this.positionTooltip) return;

    this.positionTooltip.textContent = text;
    this.positionTooltip.style.display = 'block';
    this.positionTooltip.style.left = `${(box.x + box.w / 2) * this.scale}px`;
    this.positionTooltip.style.top = `${(box.y - 10) * this.scale}px`;

    // Hide after 1 second
    setTimeout(() => {
      if (this.positionTooltip) {
        this.positionTooltip.style.display = 'none';
      }
    }, 1000);
  }

  private handleMouseDown(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.scale;
    const y = (e.clientY - rect.top) / this.scale;

    // Check if clicking on existing box
    const clickedIndex = this.boxes.findIndex((box) =>
      x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h
    );

    if (clickedIndex >= 0) {
      this.selectedBoxIndex = clickedIndex;
      this.render();
    } else {
      // Start drawing new box
      this.isDrawing = true;
      this.drawStart = { x, y };
    }
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.isDrawing || !this.drawStart) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.scale;
    const y = (e.clientY - rect.top) / this.scale;

    // Render with preview box
    this.render();
    this.ctx.strokeStyle = '#4a90e2';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(
      this.drawStart.x,
      this.drawStart.y,
      x - this.drawStart.x,
      y - this.drawStart.y
    );
  }

  private handleMouseUp() {
    if (this.isDrawing && this.drawStart) {
      const rect = this.canvas.getBoundingClientRect();
      const x = (event as MouseEvent).clientX - rect.left;
      const y = (event as MouseEvent).clientY - rect.top;

      const box: Box = {
        x: Math.min(this.drawStart.x, x / this.scale),
        y: Math.min(this.drawStart.y, y / this.scale),
        w: Math.abs(x / this.scale - this.drawStart.x),
        h: Math.abs(y / this.scale - this.drawStart.y),
        text: 'manual',
        source: 'manual'
      };

      // Apply grid snapping if enabled
      if (this.snapToGrid > 0) {
        box.x = Math.round(box.x / this.snapToGrid) * this.snapToGrid;
        box.y = Math.round(box.y / this.snapToGrid) * this.snapToGrid;
        box.w = Math.round(box.w / this.snapToGrid) * this.snapToGrid;
        box.h = Math.round(box.h / this.snapToGrid) * this.snapToGrid;
      }

      if (box.w > 5 && box.h > 5) {
        if (this.historyManager) {
          this.historyManager.execute(new AddBoxCommand(this.boxes, box));
        } else {
          this.boxes.push(box);
        }
        this.onBoxesChange(this.boxes);
      }
    }

    this.isDrawing = false;
    this.drawStart = null;
    this.render();
  }

  setImage(img: HTMLImageElement | HTMLCanvasElement) {
    this.sourceImage = img;
    this.canvas.width = img.width;
    this.canvas.height = img.height;
    this.calculateFitScale();
    this.setScale(this.fitScale);
    this.render();
  }

  setBoxes(boxes: Box[]) {
    this.boxes = boxes;
    this.render();
  }

  getBoxes(): Box[] {
    return this.boxes;
  }

  setPageInfo(currentPage: number, totalPages: number) {
    if (!this.pageIndicator || !this.pageControls || !this.prevPageButton || !this.nextPageButton) {
      return;
    }

    const safeTotal = Math.max(1, totalPages);
    const safeCurrent = Math.min(Math.max(currentPage, 0), safeTotal - 1);

    this.pageIndicator.textContent = `Page ${safeCurrent + 1} / ${safeTotal}`;

    this.pageControls.style.display = safeTotal > 1 ? 'flex' : 'none';
    this.prevPageButton.disabled = safeCurrent === 0;
    this.nextPageButton.disabled = safeCurrent >= safeTotal - 1;
  }

  private render() {
    // Clear and redraw
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Redraw the source image if available
    if (this.sourceImage) {
      this.ctx.drawImage(this.sourceImage, 0, 0);
    }

    // Draw boxes on top
    this.boxes.forEach((box, index) => {
      if (index === this.selectedBoxIndex) {
        this.ctx.strokeStyle = '#4a90e2';
        this.ctx.lineWidth = 3;
      } else {
        this.ctx.strokeStyle = '#e74c3c';
        this.ctx.lineWidth = 2;
      }

      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(box.x, box.y, box.w, box.h);
      this.ctx.strokeRect(box.x, box.y, box.w, box.h);
    });

    // Apply scale
    this.canvas.style.transform = `scale(${this.scale})`;
    this.canvas.style.transformOrigin = 'top left';
    this.updateZoomLabel();
  }

  private setScale(scale: number) {
    this.scale = Math.max(0.1, Math.min(3, scale));
    this.render();
  }

  private calculateFitScale() {
    if (!this.wrapper || this.canvas.width === 0 || this.canvas.height === 0) {
      return;
    }
    const rect = this.wrapper.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }
    const scaleX = rect.width / this.canvas.width;
    const scaleY = rect.height / this.canvas.height;
    const nextFit = Math.min(scaleX, scaleY);
    if (!isFinite(nextFit) || nextFit <= 0) {
      return;
    }
    this.lastFitScale = this.fitScale;
    this.fitScale = Math.min(nextFit, 2);
  }

  private fitToScreen(force: boolean = false) {
    this.calculateFitScale();
    if (this.fitScale <= 0) return;
    const shouldApply = force || Math.abs(this.scale - this.lastFitScale) < 0.05 || this.scale > this.fitScale;
    if (shouldApply) {
      this.setScale(this.fitScale);
    } else {
      this.updateZoomLabel();
    }
  }

  private updateZoomLabel() {
    if (!this.zoomLabel) return;
    this.zoomLabel.textContent = `${Math.round(this.scale * 100)}%`;
  }

  getElement(): HTMLDivElement {
    return this.element;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}

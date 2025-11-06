import type { Box } from '../../lib/pdf/find';

/**
 * Canvas stage for displaying and editing redactions
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
  private sourceImage: HTMLImageElement | HTMLCanvasElement | null = null;

  constructor(onBoxesChange: (boxes: Box[]) => void) {
    this.onBoxesChange = onBoxesChange;
    this.element = this.createStage();
    this.canvas = this.element.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.setupEventListeners();
  }

  private createStage(): HTMLDivElement {
    const stage = document.createElement('div');
    stage.className = 'canvas-stage';

    stage.innerHTML = `
      <div class="canvas-controls">
        <button id="zoom-in" class="btn-icon" aria-label="Zoom in">+</button>
        <button id="zoom-out" class="btn-icon" aria-label="Zoom out">−</button>
        <button id="zoom-reset" class="btn-icon" aria-label="Reset zoom">100%</button>
      </div>
      <div class="canvas-wrapper">
        <canvas></canvas>
      </div>
    `;

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

    // Drawing boxes
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
    this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());

    // Keyboard support
    this.canvas.setAttribute('tabindex', '0');
    this.canvas.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' && this.selectedBoxIndex >= 0) {
        this.boxes.splice(this.selectedBoxIndex, 1);
        this.selectedBoxIndex = -1;
        this.render();
        this.onBoxesChange(this.boxes);
      }
    });
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
        text: 'manual'
      };

      if (box.w > 5 && box.h > 5) {
        this.boxes.push(box);
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
    this.render();
  }

  setBoxes(boxes: Box[]) {
    this.boxes = boxes;
    this.render();
  }

  getBoxes(): Box[] {
    return this.boxes;
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
  }

  private setScale(scale: number) {
    this.scale = Math.max(0.1, Math.min(3, scale));
    this.render();
  }

  getElement(): HTMLDivElement {
    return this.element;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}

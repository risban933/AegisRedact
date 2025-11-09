/**
 * Layer Panel - UI for managing redaction layers
 */

import type { LayerManager } from '../../lib/layers/manager';
import type { RedactionLayer } from '../../lib/layers/types';

export class LayerPanel {
  private element: HTMLDivElement;
  private layerManager: LayerManager;
  private isVisible: boolean = false;
  private onLayerChange: () => void;

  constructor(layerManager: LayerManager, onLayerChange: () => void) {
    this.layerManager = layerManager;
    this.onLayerChange = onLayerChange;
    this.element = this.createPanel();

    // Listen to layer events
    this.layerManager.addListener(() => {
      this.render();
      this.onLayerChange();
    });
  }

  private createPanel(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'layer-panel';
    container.style.display = 'none';

    container.innerHTML = `
      <div class="layer-panel-header">
        <h3>Layers</h3>
        <div class="layer-panel-controls">
          <button id="layer-add" class="btn-icon" aria-label="Add layer" title="Add new layer">
            +
          </button>
          <button id="layer-close" class="btn-icon" aria-label="Close panel">
            ✕
          </button>
        </div>
      </div>
      <div class="layer-panel-list"></div>
    `;

    // Setup event listeners
    container.querySelector('#layer-add')?.addEventListener('click', () => {
      const name = prompt('Enter layer name:', `Layer ${this.layerManager.getLayers().length + 1}`);
      if (name) {
        this.layerManager.createLayer({ name });
      }
    });

    container.querySelector('#layer-close')?.addEventListener('click', () => {
      this.hide();
    });

    return container;
  }

  /**
   * Render layer list
   */
  private render(): void {
    const listContainer = this.element.querySelector('.layer-panel-list');
    if (!listContainer) return;

    // Clear existing layers
    listContainer.innerHTML = '';

    const layers = this.layerManager.getLayers();
    const activeLayer = this.layerManager.getActiveLayer();

    // Render layers in reverse order (top to bottom)
    [...layers].reverse().forEach((layer, reverseIndex) => {
      const index = layers.length - 1 - reverseIndex;
      const layerElement = this.createLayerElement(layer, layer.id === activeLayer.id);

      // Add drag and drop
      layerElement.draggable = true;
      layerElement.dataset.layerId = layer.id;
      layerElement.dataset.layerIndex = index.toString();

      layerElement.addEventListener('dragstart', (e) => this.handleDragStart(e));
      layerElement.addEventListener('dragover', (e) => this.handleDragOver(e));
      layerElement.addEventListener('drop', (e) => this.handleDrop(e));
      layerElement.addEventListener('dragend', () => this.handleDragEnd());

      listContainer.appendChild(layerElement);
    });
  }

  /**
   * Create a single layer element
   */
  private createLayerElement(layer: RedactionLayer, isActive: boolean): HTMLDivElement {
    const element = document.createElement('div');
    element.className = 'layer-panel-item';
    if (isActive) element.classList.add('layer-panel-item--active');
    if (layer.locked) element.classList.add('layer-panel-item--locked');

    const boxCount = this.layerManager.getBoxCount(layer.id);

    // Status icons
    const visibilityIcon = layer.visible ? '👁' : '⚬';
    const lockIcon = layer.locked ? '🔒' : '⚬';
    const activeIcon = isActive ? '▣' : '▢';

    element.innerHTML = `
      <div class="layer-visibility" data-layer-id="${layer.id}" title="${layer.visible ? 'Hide layer' : 'Show layer'}">
        ${visibilityIcon}
      </div>
      <div class="layer-lock" data-layer-id="${layer.id}" title="${layer.locked ? 'Unlock layer' : 'Lock layer'}">
        ${lockIcon}
      </div>
      <div class="layer-active" data-layer-id="${layer.id}">
        ${activeIcon}
      </div>
      <div class="layer-info" data-layer-id="${layer.id}">
        <span class="layer-name">${layer.name}</span>
        <span class="layer-count">(${boxCount})</span>
      </div>
      <div class="layer-actions">
        <button class="btn-icon-small" data-action="rename" data-layer-id="${layer.id}" title="Rename layer">
          ✎
        </button>
        <button class="btn-icon-small" data-action="duplicate" data-layer-id="${layer.id}" title="Duplicate layer">
          ⧉
        </button>
        <button class="btn-icon-small" data-action="delete" data-layer-id="${layer.id}" title="Delete layer">
          🗑
        </button>
      </div>
    `;

    // Event listeners for layer controls
    element.querySelector('.layer-visibility')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.layerManager.toggleVisibility(layer.id);
    });

    element.querySelector('.layer-lock')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.layerManager.toggleLock(layer.id);
    });

    element.querySelector('.layer-info')?.addEventListener('click', () => {
      if (!layer.locked) {
        this.layerManager.setActiveLayer(layer.id);
      }
    });

    // Action buttons
    element.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = (e.currentTarget as HTMLElement).dataset.action;
        this.handleLayerAction(action!, layer.id);
      });
    });

    return element;
  }

  /**
   * Handle layer actions
   */
  private handleLayerAction(action: string, layerId: string): void {
    switch (action) {
      case 'rename':
        const layer = this.layerManager.getLayer(layerId);
        if (layer) {
          const newName = prompt('Enter new name:', layer.name);
          if (newName) {
            this.layerManager.renameLayer(layerId, newName);
          }
        }
        break;

      case 'duplicate':
        this.layerManager.duplicateLayer(layerId);
        break;

      case 'delete':
        if (confirm('Are you sure you want to delete this layer?')) {
          this.layerManager.deleteLayer(layerId);
        }
        break;
    }
  }

  /**
   * Drag and drop handlers
   */
  private handleDragStart(e: DragEvent): void {
    const target = e.currentTarget as HTMLElement;
    target.classList.add('layer-panel-item--dragging');
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', target.dataset.layerId!);
  }

  private handleDragOver(e: DragEvent): void {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';

    const target = e.currentTarget as HTMLElement;
    target.classList.add('layer-panel-item--drag-over');
  }

  private handleDrop(e: DragEvent): void {
    e.preventDefault();

    const target = e.currentTarget as HTMLElement;
    target.classList.remove('layer-panel-item--drag-over');

    const draggedId = e.dataTransfer!.getData('text/plain');
    const targetId = target.dataset.layerId!;

    if (draggedId !== targetId) {
      // Get indices
      const layers = this.layerManager.getLayers();
      const draggedIndex = layers.findIndex((l) => l.id === draggedId);
      const targetIndex = layers.findIndex((l) => l.id === targetId);

      if (draggedIndex >= 0 && targetIndex >= 0) {
        this.layerManager.moveLayer(draggedId, targetIndex);
      }
    }
  }

  private handleDragEnd(): void {
    // Remove all drag-related classes
    this.element.querySelectorAll('.layer-panel-item').forEach((el) => {
      el.classList.remove('layer-panel-item--dragging', 'layer-panel-item--drag-over');
    });
  }

  /**
   * Show panel
   */
  show(): void {
    this.isVisible = true;
    this.element.style.display = 'block';
    this.render();
  }

  /**
   * Hide panel
   */
  hide(): void {
    this.isVisible = false;
    this.element.style.display = 'none';
  }

  /**
   * Toggle panel visibility
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Get the panel element
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

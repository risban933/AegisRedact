# Phase 2 Integration Guide

This document provides step-by-step instructions for integrating all Phase 2 components into the application.

## Components to Integrate

1. **HistoryManager** - Undo/redo system
2. **LayerManager** - Multi-layer redaction management
3. **HistoryTimeline** - Visual timeline UI
4. **LayerPanel** - Layer management UI
5. **StylePicker** - Redaction style selector
6. **Ruler** - Ruler with guides system
7. **GuideManager** - Guide line management

---

## Step 1: Update App.ts Imports

Add the following imports at the top of `src/ui/components/App.ts`:

```typescript
import { HistoryManager } from '../lib/history/manager';
import { LayerManager } from '../lib/layers/manager';
import { GuideManager } from '../lib/ruler/guide-manager';
import { HistoryTimeline } from './components/HistoryTimeline';
import { LayerPanel } from './components/LayerPanel';
import { StylePicker } from './components/StylePicker';
import { Ruler } from './components/Ruler';
import { StyleRegistry } from '../lib/redact/styles';
import type { BoxWithStyle } from '../lib/redact/styles';
```

---

## Step 2: Add Private Properties to App Class

Add these properties to the `App` class:

```typescript
export class App {
  // ... existing properties ...

  // Phase 2: Advanced UI/UX
  private historyManager: HistoryManager;
  private layerManager: LayerManager;
  private guideManager: GuideManager;
  private historyTimeline: HistoryTimeline | null = null;
  private layerPanel: LayerPanel | null = null;
  private stylePicker: StylePicker | null = null;
  private ruler: Ruler | null = null;
  private showRulers: boolean = false;
  private currentStyleId: string = 'solid';
  private currentStyleOptions: StyleOptions = {};

  // ... rest of class ...
}
```

---

## Step 3: Initialize Managers in Constructor

In the `App` constructor, after creating `this.toast`:

```typescript
constructor(container: HTMLElement) {
  this.container = container;
  this.toast = new Toast();

  // Initialize Phase 2 managers
  this.historyManager = new HistoryManager(50);
  this.layerManager = new LayerManager();
  this.guideManager = new GuideManager();

  // Load ML preference from localStorage
  this.useML = localStorage.getItem('ml-detection-enabled') === 'true';

  // ... rest of constructor ...
}
```

---

## Step 4: Update CanvasStage Initialization

When creating the `CanvasStage`, pass the `historyManager`:

```typescript
this.canvasStage = new CanvasStage(
  (boxes) => this.handleCanvasBoxesChange(boxes),
  {
    onPrevPage: () => this.prevPage(),
    onNextPage: () => this.nextPage(),
    historyManager: this.historyManager,
    snapToGrid: 5, // 5px grid snapping
  }
);
```

---

## Step 5: Create UI Components

Add a new method to create Phase 2 UI components:

```typescript
private createAdvancedUI(): void {
  // Get app view container
  const appView = this.appView;
  if (!appView) return;

  // Create History Timeline
  this.historyTimeline = new HistoryTimeline(this.historyManager);
  const canvasControls = appView.querySelector('.canvas-controls');
  if (canvasControls) {
    canvasControls.insertAdjacentElement('afterend', this.historyTimeline.getElement());
  }

  // Create Layer Panel
  this.layerPanel = new LayerPanel(this.layerManager, () => {
    this.syncLayersToCanvas();
  });
  appView.appendChild(this.layerPanel.getElement());

  // Create Style Picker
  this.stylePicker = new StylePicker((styleId, options) => {
    this.currentStyleId = styleId;
    this.currentStyleOptions = options;
    // Apply style to selected boxes or all future boxes
  });

  // Add style picker to toolbar
  const toolbar = appView.querySelector('.toolbar');
  if (toolbar) {
    const stylePickerContainer = document.createElement('div');
    stylePickerContainer.className = 'toolbar-style-picker';
    stylePickerContainer.appendChild(this.stylePicker.getElement());
    toolbar.appendChild(stylePickerContainer);
  }

  // Create Ruler and Guides
  this.ruler = new Ruler(this.guideManager, (orientation, position) => {
    this.guideManager.addGuide(orientation, position);
  });

  // Add rulers to canvas wrapper (when rulers are enabled)
  if (this.showRulers) {
    this.toggleRulers();
  }
}
```

Call this method in `showApp()` after creating the main UI:

```typescript
private showApp(): void {
  // ... existing code to create app view ...

  // Create advanced UI components
  this.createAdvancedUI();

  // ... rest of showApp ...
}
```

---

## Step 6: Implement Layer Synchronization

Add a method to sync the active layer's boxes to the canvas:

```typescript
private syncLayersToCanvas(): void {
  const activeLayer = this.layerManager.getActiveLayer();
  const boxes = this.layerManager.getBoxes(activeLayer.id, this.currentPageIndex);
  this.canvasStage.setBoxes(boxes);
}
```

---

## Step 7: Update Box Change Handler

Modify the canvas box change handler to update the active layer:

```typescript
private handleCanvasBoxesChange(boxes: Box[]): void {
  const activeLayer = this.layerManager.getActiveLayer();

  // Update active layer's boxes for current page
  this.layerManager.setBoxes(activeLayer.id, this.currentPageIndex, boxes);

  // Update redaction list
  this.updateRedactionList();
}
```

---

## Step 8: Add Global Keyboard Shortcuts

Add keyboard shortcut handler in the constructor:

```typescript
private setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    // Ctrl+Z: Undo
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.historyManager.undo();
      this.syncLayersToCanvas();
    }

    // Ctrl+Shift+Z or Ctrl+Y: Redo
    if ((e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
      e.preventDefault();
      this.historyManager.redo();
      this.syncLayersToCanvas();
    }

    // Ctrl+H: Toggle History Timeline
    if (e.ctrlKey && e.key === 'h') {
      e.preventDefault();
      this.historyTimeline?.toggle();
    }

    // Ctrl+L: Toggle Layer Panel
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      this.layerPanel?.toggle();
    }

    // Ctrl+R: Toggle Rulers
    if (e.ctrlKey && e.key === 'r') {
      e.preventDefault();
      this.toggleRulers();
    }

    // Ctrl+;: Clear all guides
    if (e.ctrlKey && e.key === ';') {
      e.preventDefault();
      if (confirm('Clear all guides?')) {
        this.guideManager.clearGuides();
      }
    }
  });
}
```

Call this in the constructor:

```typescript
constructor(container: HTMLElement) {
  // ... existing initialization ...

  this.setupKeyboardShortcuts();
}
```

---

## Step 9: Implement Ruler Toggle

Add a method to toggle rulers:

```typescript
private toggleRulers(): void {
  this.showRulers = !this.showRulers;

  const canvasWrapper = this.appView?.querySelector('.canvas-wrapper');
  if (!canvasWrapper || !this.ruler) return;

  if (this.showRulers) {
    // Add corner
    const corner = document.createElement('div');
    corner.className = 'ruler-corner';
    canvasWrapper.appendChild(corner);

    // Add rulers
    canvasWrapper.appendChild(this.ruler.getHorizontalCanvas());
    canvasWrapper.appendChild(this.ruler.getVerticalCanvas());

    // Update ruler dimensions
    this.updateRulerDimensions();
  } else {
    // Remove rulers
    canvasWrapper.querySelectorAll('.ruler-horizontal, .ruler-vertical, .ruler-corner').forEach(el => el.remove());
  }
}

private updateRulerDimensions(): void {
  if (!this.ruler || !this.showRulers) return;

  const canvas = this.canvasStage.getCanvas();

  this.ruler.renderHorizontal({
    width: canvas.width,
    height: 20,
    scale: 1,
    majorTickInterval: 50,
    minorTickInterval: 10,
    labelInterval: 100,
  });

  this.ruler.renderVertical({
    width: 20,
    height: canvas.height,
    scale: 1,
    majorTickInterval: 50,
    minorTickInterval: 10,
    labelInterval: 100,
  });
}
```

---

## Step 10: Add Toolbar Buttons for Phase 2 Features

Update the toolbar to include buttons for new features:

```typescript
// In the Toolbar component or App.ts toolbar creation:

<button class="btn-icon" aria-label="Toggle history timeline" title="History (Ctrl+H)">
  ⏱
</button>
<button class="btn-icon" aria-label="Toggle layers" title="Layers (Ctrl+L)">
  📚
</button>
<button class="btn-icon" aria-label="Toggle rulers" title="Rulers (Ctrl+R)">
  📏
</button>
```

Wire these to the respective toggle methods.

---

## Step 11: Update Export to Merge Layers

Modify the export logic to merge visible layers:

```typescript
private async handleExport(): Promise<void> {
  try {
    // Merge all visible layers
    const mergedBoxes = this.layerManager.mergeVisibleLayers();

    if (this.currentFileIndex < 0 || this.files.length === 0) return;

    const file = this.files[this.currentFileIndex];

    if (file.type === 'pdf') {
      await this.exportPdf(mergedBoxes);
    } else {
      await this.exportImage(mergedBoxes);
    }
  } catch (error) {
    console.error('Export failed:', error);
    this.toast.show('Export failed: ' + (error as Error).message, 'error');
  }
}
```

---

## Step 12: Render Redactions with Styles

Update the rendering logic to use the style system:

```typescript
private renderBoxWithStyle(ctx: CanvasRenderingContext2D, box: BoxWithStyle): void {
  const styleId = box.styleId || this.currentStyleId;
  const options = box.styleOptions || this.currentStyleOptions;

  const style = StyleRegistry.get(styleId);
  if (style) {
    style.render(ctx, box, options);
  }
}
```

---

## Keyboard Shortcuts Summary

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` or `Ctrl+Y` | Redo |
| `Ctrl+H` | Toggle History Timeline |
| `Ctrl+L` | Toggle Layer Panel |
| `Ctrl+R` | Toggle Rulers |
| `Ctrl+;` | Clear all guides |
| `Arrow Keys` | Move selected box (1px) |
| `Shift+Arrow` | Move selected box (10px) |
| `Alt+Arrow` | Resize selected box |
| `Delete` | Delete selected box |

---

## Component Communication Flow

```
User Action
    ↓
UI Component (Timeline/LayerPanel/StylePicker)
    ↓
Manager (HistoryManager/LayerManager/GuideManager)
    ↓
Event Listener in App.ts
    ↓
syncLayersToCanvas()
    ↓
CanvasStage.setBoxes()
    ↓
Render with style system
```

---

## Testing Checklist

After integration, verify:

- [ ] Undo/redo works for all box operations
- [ ] History timeline shows correct states
- [ ] Can create/delete/rename layers
- [ ] Active layer receives new boxes
- [ ] Locked layers cannot be edited
- [ ] Can drag layers to reorder
- [ ] Style picker changes redaction appearance
- [ ] Custom text modal works correctly
- [ ] Rulers display with correct measurements
- [ ] Can create guides by clicking rulers
- [ ] Boxes snap to guides
- [ ] All keyboard shortcuts work
- [ ] Export merges visible layers correctly
- [ ] Styles render correctly in exported files

---

## Performance Considerations

1. **History Manager**: Prunes to 50 steps automatically
2. **Layer Rendering**: Only render visible layers
3. **Guide Snapping**: Only check when dragging (not on every mouse move)
4. **Ruler Updates**: Only re-render on zoom/resize events

---

## Accessibility

All Phase 2 components maintain WCAG 2.2 compliance:

- Full keyboard navigation
- ARIA labels and roles
- Screen reader announcements for state changes
- High contrast mode support
- Touch target sizes ≥44x44px

---

## Next Steps: Phase 3

After Phase 2 integration is complete, proceed with Phase 3:

1. **HeatmapOverlay** - Density visualization on canvas
2. **StatsDashboard** - Analytics panel with charts
3. **ConfidenceBadges** - Visual confidence indicators

See `IMPLEMENTATION_PLAN.md` for Phase 3 details.

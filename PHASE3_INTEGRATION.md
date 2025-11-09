# Phase 3 Integration Guide: Visualization & Analytics

This guide shows how to integrate the visualization and analytics components from Phase 3 into your AegisRedact application.

## Overview

Phase 3 adds three major features:

1. **HeatmapOverlay** - Visual density map showing redaction concentrations
2. **StatsDashboard** - Comprehensive analytics panel with charts and metrics
3. **Enhanced RedactionList** - Confidence scoring with visual indicators (already integrated)

## Components Reference

### HeatmapOverlay

**File**: `src/ui/components/HeatmapOverlay.ts`

**Purpose**: Renders a visual overlay showing redaction density across the document page.

**Features**:
- Three rendering modes: `grid`, `blur`, `outline`
- Configurable opacity (0-1)
- Canvas-based rendering with AnalyticsAggregator integration
- Real-time updates on box changes

**API**:
```typescript
constructor()
setMode(mode: 'grid' | 'blur' | 'outline'): void
setOpacity(opacity: number): void
render(boxes: RedactionItem[], width: number, height: number): void
getElement(): HTMLCanvasElement
show(): void
hide(): void
destroy(): void
```

### StatsDashboard

**File**: `src/ui/components/StatsDashboard.ts`

**Purpose**: Displays comprehensive analytics about redactions across the entire document.

**Features**:
- Overview cards (total detections, pages analyzed, average confidence)
- Type breakdown with horizontal bar chart
- Source distribution (ML/Regex/Manual)
- Confidence distribution with traffic light indicators
- Top 5 hotspot pages with click-to-navigate
- CSV export functionality

**API**:
```typescript
constructor(onNavigate: (page: number) => void)
update(items: RedactionItem[], totalPages: number): void
getElement(): HTMLDivElement
show(): void
hide(): void
toggle(): void
```

## Step-by-Step Integration

### Step 1: Import Components

Add imports to `src/ui/App.ts`:

```typescript
import { HeatmapOverlay } from './components/HeatmapOverlay';
import { StatsDashboard } from './components/StatsDashboard';
```

### Step 2: Add Component Properties

Add private properties to the `App` class:

```typescript
export class App {
  // ... existing properties ...

  private heatmapOverlay?: HeatmapOverlay;
  private statsDashboard?: StatsDashboard;
  private showHeatmap: boolean = false;
  private showStats: boolean = false;
}
```

### Step 3: Initialize Components

In the `App` constructor, initialize the new components:

```typescript
constructor() {
  // ... existing initialization ...

  // Initialize heatmap overlay
  this.heatmapOverlay = new HeatmapOverlay();
  this.heatmapOverlay.setMode('grid'); // Default mode
  this.heatmapOverlay.setOpacity(0.6); // Default opacity
  this.heatmapOverlay.hide();

  // Initialize stats dashboard
  this.statsDashboard = new StatsDashboard((page: number) => {
    // Navigate to page when hotspot is clicked
    this.loadFile(this.currentFileIndex, page);
  });
  this.statsDashboard.hide();
}
```

### Step 4: Add to DOM Layout

Insert components into the DOM structure. Add after CanvasStage initialization:

```typescript
private setupUI() {
  // ... existing UI setup ...

  // Add heatmap overlay to canvas container
  const canvasContainer = document.querySelector('.canvas-container');
  if (canvasContainer && this.heatmapOverlay) {
    canvasContainer.appendChild(this.heatmapOverlay.getElement());
  }

  // Add stats dashboard to body (fixed positioning)
  if (this.statsDashboard) {
    document.body.appendChild(this.statsDashboard.getElement());
  }
}
```

### Step 5: Update Heatmap on Box Changes

Whenever redaction boxes change, update the heatmap overlay:

```typescript
private updateHeatmap() {
  if (!this.heatmapOverlay || !this.canvasStage) return;

  const boxes = this.redactionList.getItems().filter(
    item => item.page === this.currentPage && item.enabled
  );

  const canvas = this.canvasStage.getCanvas();
  this.heatmapOverlay.render(boxes, canvas.width, canvas.height);
}
```

Call `updateHeatmap()` in:
- After detection completes
- After manual box add/remove/edit
- After page navigation
- After toggling boxes on/off

### Step 6: Update Stats Dashboard

Update the stats dashboard whenever redaction data changes:

```typescript
private updateStatsDashboard() {
  if (!this.statsDashboard) return;

  const allItems = this.redactionList.getItems();
  const totalPages = this.files[this.currentFileIndex]?.pageCount || 1;

  this.statsDashboard.update(allItems, totalPages);
}
```

Call `updateStatsDashboard()` in:
- After detection completes
- After manual box operations
- After bulk enable/disable operations

### Step 7: Add Toolbar Controls

Add buttons to toggle heatmap and stats panel. In `src/ui/components/Toolbar.ts`:

```typescript
// Add heatmap toggle button
const heatmapBtn = document.createElement('button');
heatmapBtn.textContent = '🔥 Heatmap';
heatmapBtn.title = 'Toggle heatmap overlay (Ctrl+H)';
heatmapBtn.className = 'toolbar-button';
heatmapBtn.addEventListener('click', () => this.onToggleHeatmap());

// Add stats toggle button
const statsBtn = document.createElement('button');
statsBtn.textContent = '📊 Stats';
statsBtn.title = 'Toggle statistics dashboard (Ctrl+D)';
statsBtn.className = 'toolbar-button';
statsBtn.addEventListener('click', () => this.onToggleStats());
```

Update the Toolbar interface to include callbacks:

```typescript
export interface ToolbarOptions {
  // ... existing options ...
  onToggleHeatmap?: () => void;
  onToggleStats?: () => void;
}
```

### Step 8: Implement Toggle Methods

Add toggle methods to `App.ts`:

```typescript
private toggleHeatmap() {
  this.showHeatmap = !this.showHeatmap;

  if (!this.heatmapOverlay) return;

  if (this.showHeatmap) {
    this.updateHeatmap();
    this.heatmapOverlay.show();
  } else {
    this.heatmapOverlay.hide();
  }
}

private toggleStats() {
  this.showStats = !this.showStats;

  if (!this.statsDashboard) return;

  if (this.showStats) {
    this.updateStatsDashboard();
    this.statsDashboard.show();
  } else {
    this.statsDashboard.hide();
  }
}
```

### Step 9: Add Keyboard Shortcuts

Add keyboard shortcuts to the global handler:

```typescript
private setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // ... existing shortcuts ...

    // Ctrl+H: Toggle heatmap
    if (e.ctrlKey && e.key === 'h') {
      e.preventDefault();
      this.toggleHeatmap();
    }

    // Ctrl+D: Toggle stats dashboard
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      this.toggleStats();
    }
  });
}
```

### Step 10: Add Heatmap Mode Controls

Add a dropdown or button group to switch heatmap modes:

```typescript
private setupHeatmapControls() {
  const modeSelect = document.createElement('select');
  modeSelect.innerHTML = `
    <option value="grid">Grid Mode</option>
    <option value="blur">Blur Mode</option>
    <option value="outline">Outline Mode</option>
  `;

  modeSelect.addEventListener('change', (e) => {
    const mode = (e.target as HTMLSelectElement).value as 'grid' | 'blur' | 'outline';
    this.heatmapOverlay?.setMode(mode);
    this.updateHeatmap();
  });

  // Add opacity slider
  const opacitySlider = document.createElement('input');
  opacitySlider.type = 'range';
  opacitySlider.min = '0';
  opacitySlider.max = '100';
  opacitySlider.value = '60';

  opacitySlider.addEventListener('input', (e) => {
    const opacity = parseInt((e.target as HTMLInputElement).value) / 100;
    this.heatmapOverlay?.setOpacity(opacity);
    this.updateHeatmap();
  });
}
```

### Step 11: Cleanup on Destroy

Clean up components when the app is destroyed:

```typescript
destroy() {
  // ... existing cleanup ...

  this.heatmapOverlay?.destroy();
  this.statsDashboard?.getElement().remove();
}
```

### Step 12: Update RedactionList Integration

The RedactionList component is already enhanced with confidence visualization. Ensure it receives items with confidence scores:

```typescript
// When creating RedactionItem objects from detection results:
const item: RedactionItem = {
  id: `box-${Date.now()}-${Math.random()}`,
  enabled: true,
  page: currentPage,
  type: detection.type, // 'email', 'phone', 'ssn', etc.
  source: detection.source, // 'regex', 'ml', or 'manual'
  confidence: detection.confidence, // 0.0-1.0 for ML, 1.0 for regex
  x: detection.box.x,
  y: detection.box.y,
  w: detection.box.w,
  h: detection.box.h,
  text: detection.text
};
```

Confidence badges will automatically appear in the list for items with confidence values.

## Complete Integration Example

Here's a complete example showing how all components work together:

```typescript
import { App } from './ui/App';
import { HeatmapOverlay } from './ui/components/HeatmapOverlay';
import { StatsDashboard } from './ui/components/StatsDashboard';

export class App {
  private heatmapOverlay: HeatmapOverlay;
  private statsDashboard: StatsDashboard;
  private showHeatmap: boolean = false;
  private showStats: boolean = false;

  constructor() {
    // Initialize components
    this.heatmapOverlay = new HeatmapOverlay();
    this.heatmapOverlay.setMode('grid');
    this.heatmapOverlay.setOpacity(0.6);
    this.heatmapOverlay.hide();

    this.statsDashboard = new StatsDashboard((page) => {
      this.loadFile(this.currentFileIndex, page);
    });
    this.statsDashboard.hide();

    // Setup UI
    this.setupUI();
    this.setupKeyboardShortcuts();
  }

  private setupUI() {
    // Add heatmap to canvas container
    const canvasContainer = document.querySelector('.canvas-container');
    canvasContainer?.appendChild(this.heatmapOverlay.getElement());

    // Add stats dashboard to body
    document.body.appendChild(this.statsDashboard.getElement());
  }

  private async detectPII() {
    // Run detection...
    const detections = await runDetection(text);

    // Update UI
    this.redactionList.setItems(detections);
    this.updateHeatmap();
    this.updateStatsDashboard();
  }

  private updateHeatmap() {
    if (!this.showHeatmap) return;

    const boxes = this.redactionList.getItems().filter(
      item => item.page === this.currentPage && item.enabled
    );

    const canvas = this.canvasStage.getCanvas();
    this.heatmapOverlay.render(boxes, canvas.width, canvas.height);
  }

  private updateStatsDashboard() {
    if (!this.showStats) return;

    const allItems = this.redactionList.getItems();
    const totalPages = this.files[this.currentFileIndex]?.pageCount || 1;

    this.statsDashboard.update(allItems, totalPages);
  }

  private toggleHeatmap() {
    this.showHeatmap = !this.showHeatmap;

    if (this.showHeatmap) {
      this.updateHeatmap();
      this.heatmapOverlay.show();
    } else {
      this.heatmapOverlay.hide();
    }
  }

  private toggleStats() {
    this.showStats = !this.showStats;

    if (this.showStats) {
      this.updateStatsDashboard();
      this.statsDashboard.show();
    } else {
      this.statsDashboard.hide();
    }
  }
}
```

## Keyboard Shortcuts Summary

| Shortcut | Action |
|----------|--------|
| `Ctrl+H` | Toggle heatmap overlay |
| `Ctrl+D` | Toggle statistics dashboard |

## UI Layout

The components are positioned as follows:

```
┌─────────────────────────────────────────────────────────┐
│ Toolbar                                                 │
├─────────────────────────────────────────┬───────────────┤
│                                         │               │
│                                         │  Stats        │
│        Canvas (with heatmap overlay)    │  Dashboard    │
│                                         │  (fixed)      │
│                                         │               │
│                                         ├───────────────┤
│                                         │               │
│                                         │  Redaction    │
│                                         │  List         │
│                                         │  (enhanced)   │
└─────────────────────────────────────────┴───────────────┘
```

- **HeatmapOverlay**: Absolute positioned canvas overlay on top of CanvasStage
- **StatsDashboard**: Fixed positioned panel on right side (right: 20px, top: 120px)
- **RedactionList**: Below stats dashboard, shows confidence badges

## Heatmap Modes Explained

### Grid Mode
- Divides page into 10x10 grid
- Colors cells based on redaction density
- Blue (low) → Yellow (medium) → Red (high)
- Best for: Overview of document-wide patterns

### Blur Mode
- Renders radial gradients around each redaction
- Creates "heat islands" effect
- Overlapping gradients intensify color
- Best for: Visualizing clusters and concentrations

### Outline Mode
- Highlights redaction boxes with semi-transparent overlay
- Shows exact redaction boundaries
- Color-coded by density
- Best for: Precise box verification

## Data Flow

```
Detection/Manual Edit
       ↓
RedactionList.setItems()
       ↓
   ┌───┴────┐
   ↓        ↓
updateHeatmap()  updateStatsDashboard()
   ↓                    ↓
HeatmapOverlay.render()  StatsDashboard.update()
```

## Testing Checklist

After integration, verify the following:

### Heatmap Overlay
- [ ] Heatmap renders correctly in grid mode
- [ ] Heatmap renders correctly in blur mode
- [ ] Heatmap renders correctly in outline mode
- [ ] Opacity slider works (0-100%)
- [ ] Heatmap updates when boxes are added/removed
- [ ] Heatmap updates when navigating pages
- [ ] Heatmap hides/shows with toggle button
- [ ] Ctrl+H keyboard shortcut works
- [ ] Heatmap positioned correctly over canvas

### Stats Dashboard
- [ ] Overview cards show correct counts
- [ ] Type breakdown chart renders with correct percentages
- [ ] Bar widths match percentages
- [ ] Source breakdown shows ML/Regex/Manual distribution
- [ ] Confidence distribution shows High/Medium/Low counts
- [ ] Hotspots list shows top 5 pages
- [ ] Clicking hotspot navigates to correct page
- [ ] CSV export downloads correct data
- [ ] Dashboard hides/shows with toggle button
- [ ] Ctrl+D keyboard shortcut works
- [ ] Stats update when boxes are added/removed

### RedactionList Enhancement
- [ ] Confidence badges appear for ML detections
- [ ] Badges show correct emoji (🟢🟡🟠)
- [ ] Badges show correct percentage
- [ ] Badge colors match confidence level
- [ ] Tooltip shows "Confidence: X%" on hover
- [ ] Badges don't appear for regex detections (confidence = 1.0 implicit)
- [ ] Layout remains correct with badges

### Integration
- [ ] All components work together without conflicts
- [ ] No console errors on page load
- [ ] No console errors during interaction
- [ ] Performance is acceptable with 100+ boxes
- [ ] UI remains responsive during updates
- [ ] Memory usage is reasonable

## Performance Considerations

1. **Heatmap Rendering**:
   - Render only for visible page
   - Debounce updates during box dragging
   - Use requestAnimationFrame for smooth updates

2. **Stats Dashboard**:
   - Update only when data changes (not on every render)
   - Cache computed statistics
   - Limit hotspots to top 5 pages

3. **Memory**:
   - Clean up canvas contexts on page change
   - Remove event listeners on component destroy
   - Clear computed data caches when switching files

## Troubleshooting

### Heatmap not visible
- Check if `show()` was called after `render()`
- Verify canvas is positioned correctly over CanvasStage
- Check z-index (should be higher than canvas but lower than controls)
- Verify opacity is > 0

### Stats dashboard shows 0 detections
- Verify `update()` is called after detection
- Check that items have required fields (type, source, confidence)
- Ensure totalPages parameter is correct

### Confidence badges not showing
- Verify items have `confidence` property (0-1 range)
- Check that AnalyticsAggregator is imported
- Confirm CSS for `.confidence-badge` is loaded

### Performance issues
- Reduce heatmap updates during dragging (debounce)
- Use lower resolution grid for large documents
- Limit stats updates to significant changes only

## Next Steps

After integrating Phase 3 components:

1. Test with real documents containing 100+ detections
2. Verify CSV export with different data sets
3. Test heatmap with different page sizes and aspect ratios
4. Optimize rendering performance if needed
5. Add user preferences for default heatmap mode
6. Consider adding heatmap color scheme options
7. Add tooltips to stats dashboard charts
8. Implement print-friendly stats view

## Additional Resources

- `src/lib/analytics/aggregator.ts` - Analytics computation logic
- `src/ui/components/HeatmapOverlay.ts` - Heatmap component source
- `src/ui/components/StatsDashboard.ts` - Dashboard component source
- `tests/unit/analytics.test.ts` - Analytics unit tests (to be created)

---

**Phase 3 Status**: ✅ Complete

All visualization and analytics components are implemented and ready for integration. Follow this guide to add them to your application.

# Implementation Roadmap: Architectural Improvements

## QUICK REFERENCE: Key Files & Modules

### UI Layer (src/ui/)
- `App.ts` - 1600-line orchestrator (state management hub)
- `components/Toolbar.ts` - Detection toggle controls
- `components/CanvasStage.ts` - Drawing surface + zoom
- `components/RedactionList.ts` - Detection list filtering
- `components/Settings.ts` - ML model toggle modal

### Business Logic (src/lib/)
- `detect/patterns*.ts` - 7 regional pattern libraries
- `detect/ml.ts` - TensorFlow.js NER model integration
- `detect/merger.ts` - Deduplication logic
- `formats/` - DocumentFormat abstract + implementations
- `pdf/load.ts`, `find.ts`, `redact.ts`, `export.ts` - PDF pipeline
- `images/exif.ts`, `redact.ts`, `ocr.ts` - Image pipeline
- `redact/styles.ts` - Redaction renderer system (StyleRegistry)

### Styling (src/styles/)
- `styles.css` - Root theme variables
- `animations.css` - Transition effects
- `modern.css` - Component styles
- `landing-enhanced.css` - Landing page
- `immersive-enhancements.css` - Extra effects

---

## IMPLEMENTATION PRIORITY MATRIX

### CRITICAL (Block other features)
1. **Theme System** - Unlocks dark/light mode, accessibility variants
2. **State Management Refactor** - Needed for batch processing, undo/redo
3. **Batch Processing Queue** - Needed for multi-file handling

### HIGH (Core feature gaps)
4. **Detection Enhancements** - User-defined patterns, confidence tuning
5. **Document Sanitization** - Metadata stripping, form field clearing
6. **Format Handler Expansion** - DOCX, XLSX, PPTX support

### MEDIUM (UX polish)
7. **Accessibility Audit** - WCAG compliance, screen reader testing
8. **Performance Optimization** - Caching, parallelization
9. **Advanced Analytics** - Heatmaps, statistics dashboard (partially done)

---

## DETAILED IMPLEMENTATION PLANS

### 1. THEME SYSTEM (Estimated: 8-10 hours)

**Phase 1: Runtime Theme Switching**
```typescript
// NEW: src/lib/theme/ThemeManager.ts
export class ThemeManager {
  private themes = {
    dark: { --bg-primary: '#0b1020', ... },
    light: { --bg-primary: '#ffffff', ... },
    'high-contrast': { --bg-primary: '#000000', ... }
  };
  
  setTheme(id: string) {
    document.documentElement.style.setProperty('--bg-primary', value);
    localStorage.setItem('theme', id);
  }
  
  getTheme() { return localStorage.getItem('theme') ?? 'dark'; }
}
```

**Phase 2: UI Integration**
- Add theme selector to Settings modal
- Persist choice via localStorage
- Sync with prefers-color-scheme media query
- Add theme context to all components

**Phase 3: Redaction Style UI**
```typescript
// NEW: src/ui/components/StylePicker.ts
export class StylePicker {
  private styles = StyleRegistry.getAll();
  private selectedStyle = StyleRegistry.getDefault().id;
  
  onStyleChange: (styleId: string) => void;
  
  // Renders style thumbnails from style.getPreview()
}
```

**Files to Create**: 
- `src/lib/theme/ThemeManager.ts`
- `src/lib/theme/themes.ts` (theme definitions)
- `src/ui/components/StylePicker.ts`

**Files to Modify**:
- `src/styles.css` - Add light/high-contrast theme definitions
- `src/ui/components/Settings.ts` - Add theme selector
- `src/ui/App.ts` - Initialize ThemeManager on app start
- `src/ui/components/CanvasStage.ts` - Use style from StyleRegistry

---

### 2. BATCH PROCESSING SYSTEM (Estimated: 12-16 hours)

**Phase 1: Task Queue Architecture**
```typescript
// NEW: src/lib/queue/TaskQueue.ts
export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  PAUSED = 'paused'
}

export interface ProcessingTask {
  id: string;
  fileIndex: number;
  status: TaskStatus;
  progress: number; // 0-100
  error?: Error;
  startTime?: number;
  endTime?: number;
}

export class TaskQueue {
  private tasks: Map<string, ProcessingTask> = new Map();
  private isProcessing = false;
  
  enqueue(fileIndex: number): string { /* ... */ }
  pause(taskId: string) { /* ... */ }
  resume(taskId: string) { /* ... */ }
  remove(taskId: string) { /* ... */ }
  getStatus(taskId: string): ProcessingTask { /* ... */ }
  
  private async processNext() { /* ... */ }
  onTaskStart?: (taskId: string) => void;
  onTaskProgress?: (taskId: string, progress: number) => void;
  onTaskComplete?: (taskId: string, result: any) => void;
  onTaskError?: (taskId: string, error: Error) => void;
}
```

**Phase 2: App.ts Integration**
```typescript
// In App.ts
private taskQueue = new TaskQueue();

private async handleBatchExport() {
  for (let i = 0; i < this.files.length; i++) {
    const taskId = this.taskQueue.enqueue(i);
    // Show task in new BatchProgressPanel
  }
}

private setupTaskQueueHandlers() {
  this.taskQueue.onTaskProgress = (id, progress) => {
    this.batchProgressPanel?.updateTask(id, progress);
  };
  this.taskQueue.onTaskComplete = (id, result) => {
    saveBlob(result.blob, result.filename);
  };
}
```

**Phase 3: UI Components**
```typescript
// NEW: src/ui/components/BatchProgressPanel.ts
export class BatchProgressPanel {
  // Shows:
  // - Overall progress bar (X/Y files)
  // - Individual task cards with status
  // - Pause/Resume/Cancel buttons
  // - Retry failed tasks
  // - Download all button (aggregates results)
}

// Modify: src/ui/components/Toolbar.ts
// Add "Batch Export" button (only shows when multiple files loaded)
```

**Files to Create**:
- `src/lib/queue/TaskQueue.ts`
- `src/lib/queue/types.ts`
- `src/ui/components/BatchProgressPanel.ts`

**Files to Modify**:
- `src/ui/App.ts` - Integrate task queue
- `src/ui/components/Toolbar.ts` - Add batch mode
- `src/lib/pdf/export.ts` - Emit progress events

---

### 3. SMART DETECTION ENHANCEMENTS (Estimated: 10-14 hours)

**Phase 1: Custom Pattern System**
```typescript
// NEW: src/lib/detect/custom-patterns.ts
export interface CustomPattern {
  id: string;
  name: string;
  regex: string;
  type: string;
  caseSensitive: boolean;
  enabled: boolean;
  createdAt: number;
}

export class CustomPatternRegistry {
  private patterns: Map<string, CustomPattern> = new Map();
  
  addPattern(pattern: CustomPattern) {
    localStorage.setItem('custom-patterns', JSON.stringify(...));
  }
  loadPatterns() {
    return JSON.parse(localStorage.getItem('custom-patterns') ?? '[]');
  }
}
```

**Phase 2: Confidence Threshold UI**
```typescript
// NEW: src/ui/components/ConfidenceThreshold.ts
export class ConfidenceThreshold {
  // Slider: 0.0 to 1.0
  // Shows: "Detecting items with confidence >= X"
  // Saves to: App.detectionOptions.mlMinConfidence
}
```

**Phase 3: Pattern Builder Modal**
```typescript
// NEW: src/ui/components/PatternBuilder.ts
export class PatternBuilder {
  // Form fields:
  // - Pattern name (text)
  // - Regex (textarea with validation)
  // - Type/category (select)
  // - Case sensitive (checkbox)
  // - Test against sample text (textarea)
  // - Live regex match preview
  
  // Actions:
  // - Save pattern
  // - Delete pattern
  // - Clone existing pattern
}
```

**Phase 4: Detection Options Enhancement**
```typescript
// Modify: src/lib/detect/patterns.ts
// Add to detectAllPIIWithMetadata():

const customPatterns = CustomPatternRegistry.getPatterns();
for (const pattern of customPatterns) {
  if (pattern.enabled) {
    const matches = text.match(new RegExp(pattern.regex));
    results.push(...matches.map(m => ({
      text: m,
      type: pattern.type,
      source: 'custom',
      confidence: 1.0
    })));
  }
}
```

**Files to Create**:
- `src/lib/detect/custom-patterns.ts`
- `src/ui/components/PatternBuilder.ts`
- `src/ui/components/ConfidenceThreshold.ts`

**Files to Modify**:
- `src/lib/detect/patterns.ts` - Add custom pattern processing
- `src/ui/components/Settings.ts` - Add pattern builder button
- `src/ui/App.ts` - Add confidence threshold to detection options

---

### 4. DOCUMENT SANITIZATION (Estimated: 8-12 hours)

**Phase 1: PDF Metadata Stripping**
```typescript
// NEW: src/lib/pdf/sanitize.ts
export async function sanitizePdfMetadata(
  pdfBytes: Uint8Array,
  options: SanitizeOptions
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  
  if (options.stripMetadata) {
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer('');
    pdfDoc.setCreator('');
  }
  
  if (options.removeAnnotations) {
    // Remove all annotations (comments, highlights, etc.)
    for (const page of pdfDoc.getPages()) {
      // Use pdf-lib API to clear annotations
    }
  }
  
  return await pdfDoc.save();
}

export interface SanitizeOptions {
  stripMetadata: boolean;
  removeAnnotations: boolean;
  removeFormFields: boolean;
  stripHyperlinks: boolean;
  removeXMPMetadata: boolean;
}
```

**Phase 2: UI Integration**
```typescript
// NEW: src/ui/components/SanitizeOptions.ts
export class SanitizeOptions extends ModalDialog {
  // Checkboxes:
  // - Strip PDF metadata (title, author, etc.)
  // - Remove annotations (comments, highlights)
  // - Clear form fields
  // - Strip hyperlinks
  // - Remove XMP metadata
  
  // Preview shows what will be removed
}

// Modify: src/ui/components/Toolbar.ts
// Add "Advanced Options" button → Opens SanitizeOptions
```

**Phase 3: Integration with Export**
```typescript
// In App.ts exportPdf():
if (this.sanitizeOptions?.stripMetadata) {
  const sanitized = await sanitizePdfMetadata(
    pdfBytes,
    this.sanitizeOptions
  );
  await saveBlob(new Blob([sanitized]), filename);
} else {
  await saveBlob(new Blob([pdfBytes]), filename);
}
```

**Files to Create**:
- `src/lib/pdf/sanitize.ts`
- `src/ui/components/SanitizeOptions.ts`

**Files to Modify**:
- `src/ui/App.ts` - Add sanitization to export pipeline
- `src/ui/components/Toolbar.ts` - Add options button
- `src/lib/pdf/export.ts` - Call sanitization if enabled

---

### 5. ACCESSIBILITY IMPROVEMENTS (Estimated: 10-12 hours)

**Phase 1: Keyboard Navigation Audit**
```typescript
// NEW: src/lib/a11y/keyboard-handler.ts
export class KeyboardHandler {
  static readonly FOCUS_TRAP = '.modal'; // Trap focus in modals
  static readonly SKIP_TO_MAIN = '#main-content';
  
  static trapFocus(element: HTMLElement) {
    // Prevent Tab from leaving modal
  }
  
  static handleEscape(callback: () => void) {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') callback();
    });
  }
}
```

**Phase 2: ARIA Enhancements**
```typescript
// Audit all components for:
// - role="dialog" on modals
// - aria-label/aria-labelledby on interactive elements
// - aria-live regions for notifications (Toast already has this)
// - aria-describedby for complex controls
// - aria-expanded for collapsible sections
// - aria-disabled="true" for disabled buttons

// In Toast.ts:
this.element.setAttribute('role', 'status');
this.element.setAttribute('aria-live', 'polite');
this.element.setAttribute('aria-atomic', 'true');
```

**Phase 3: Color Contrast & High Contrast Mode**
```typescript
// In StyleRegistry, add high-contrast variant:
const highContrastTheme = {
  '--bg-primary': '#000000',
  '--text-primary': '#ffffff',
  '--accent-blue': '#ffff00',
  '--accent-red': '#ff0000'
};

// Support prefers-contrast media query
if (window.matchMedia('(prefers-contrast: more)').matches) {
  ThemeManager.setTheme('high-contrast');
}
```

**Files to Create**:
- `src/lib/a11y/keyboard-handler.ts`
- `src/lib/a11y/focus-manager.ts`

**Files to Modify**:
- All component files - audit and add ARIA attributes
- `src/styles.css` - Add high-contrast theme
- `src/ui/App.ts` - Initialize keyboard handler
- `src/ui/components/DropZone.ts` - Add role="button", tabindex="0"

---

## CROSS-CUTTING REFACTORING

### State Management Evolution

**Current → Target**:
```
// CURRENT: Direct property mutation
this.files = [];
this.currentFileIndex = -1;

// TARGET: Event-based updates
this.stateManager.emit('files-updated', { files: [] });
this.stateManager.on('files-updated', (data) => {
  this.redactionList.setFiles(data.files);
});
```

**Create**: `src/lib/state/StateManager.ts`
- Event emitter pattern
- Immutable state snapshots
- Undo/redo support

**Benefit**: Easier testing, loose coupling, feature flags support

---

## TESTING STRATEGY FOR NEW FEATURES

### Unit Tests
```bash
# Detection enhancements
npm test tests/unit/detect/custom-patterns.test.ts

# Batch processing
npm test tests/unit/queue/TaskQueue.test.ts

# Sanitization
npm test tests/unit/pdf/sanitize.test.ts
```

### Integration Tests
```bash
# End-to-end batch export
npm test tests/integration/batch-export.test.ts

# Theme persistence
npm test tests/integration/theme-switching.test.ts

# Detection with custom patterns
npm test tests/integration/custom-detection.test.ts
```

### Manual Testing Checklist
- [ ] Dark/light mode toggle + persistence
- [ ] Batch export with 3+ files (check progress)
- [ ] Custom pattern creation + live preview
- [ ] Confidence threshold adjustment
- [ ] PDF metadata stripping + verification
- [ ] Keyboard nav: Tab through all components
- [ ] Screen reader: Navigate redaction list

---

## PERFORMANCE OPTIMIZATION OPPORTUNITIES

1. **OCR Worker Pool** (Add to src/lib/ocr/):
   - Reuse Tesseract worker instance
   - Avoid download on each analysis
   - Parallel page processing (max 2 workers)

2. **Detection Caching** (Add to src/lib/detect/):
   - Cache regex results per page
   - Avoid re-scanning identical text
   - Invalidate on pattern change

3. **Format Handler Lazy Loading**:
   - Only import DocumentFormat when needed
   - Tree-shake unused formats from bundle

4. **PDF Rendering Optimization**:
   - Cache rendered canvases
   - Reuse viewport calculation
   - Progressive rendering (render visible page first)

---

## DEPENDENCY REVIEW

### No New Major Dependencies Needed
- Theme system: Use native CSS + localStorage
- Batch queue: Pure TypeScript, no library needed
- Custom patterns: Runtime regex (browser built-in)
- Sanitization: pdf-lib already imported
- Accessibility: Browser APIs (no library needed)

### Optional (Nice to Have)
- `@dnd-kit/core` - Drag-and-drop pattern reordering
- `framer-motion` - Advanced animations (already using raw CSS)
- `zustand` - State management (consider for Phase 2)

---

## ESTIMATED TIMELINE

| Feature | Hours | Start | End | Dependencies |
|---------|-------|-------|-----|--------------|
| Theme System | 10 | Week 1 | Week 2 | None |
| Batch Queue | 14 | Week 2 | Week 3 | Theme System |
| Detection UI | 12 | Week 3 | Week 4 | None |
| Sanitization | 10 | Week 4 | Week 5 | None |
| Accessibility | 11 | Week 5 | Week 6 | Theme System |
| Testing & Polish | 8 | Week 6 | Week 6 | All above |
| **Total** | **65** | | | |

**Recommended Parallelization**:
- Theme + Detection UI can run in parallel (Week 2-3)
- Sanitization + Accessibility parallel (Week 4-5)
- Focus on theme first (unlocks other features)


# Master Implementation Plan
## Features 1-5: Creative Direction Expansion

**Document Version**: 1.0
**Created**: 2025-11-11
**Estimated Total Effort**: 8-10 weeks (65 development hours)

---

## Executive Summary

This plan implements 5 major feature expansions for Share-Safe Toolkit:

1. **Redaction Themes System** - Visual styles with security warnings
2. **Dark Mode + Accessibility** - Full theme system with WCAG compliance
3. **Smart Context Detection** - AI-powered pattern recognition and custom rules
4. **Batch Processing** - Multi-file workflow with visual progress
5. **Document Sanitizer** - Metadata stripping and privacy scoring

**Key Principles**:
- ✅ Maintain client-side-only architecture (no server dependencies)
- ✅ Zero new major dependencies (use existing libraries)
- ✅ Modular implementation (each feature is independently testable)
- ✅ Progressive enhancement (features work without breaking existing functionality)

---

## 📋 Implementation Phases

### **PHASE 1: Foundation (Weeks 1-2) - 18 hours**

Theme system and accessibility groundwork that unlocks all other features.

#### 1.1 Theme Manager Core
**Files to Create**:
```
src/lib/theme/
  ├─ ThemeManager.ts        # Runtime theme switching + persistence
  ├─ themes.ts              # Theme definitions (dark, light, high-contrast)
  └─ types.ts               # Theme interfaces
```

**Core Implementation**:
```typescript
// src/lib/theme/ThemeManager.ts
export class ThemeManager {
  private currentTheme: string = 'dark';
  private themes = new Map<string, Theme>();

  constructor() {
    this.registerDefaultThemes();
    this.loadThemeFromStorage();
    this.syncWithSystemPreference();
  }

  setTheme(themeId: string): void {
    const theme = this.themes.get(themeId);
    if (!theme) return;

    // Apply CSS variables
    Object.entries(theme.variables).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });

    // Persist choice
    localStorage.setItem('theme', themeId);
    this.currentTheme = themeId;

    // Emit event for components
    document.dispatchEvent(new CustomEvent('theme-changed', {
      detail: { themeId }
    }));
  }

  private syncWithSystemPreference(): void {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const contrastQuery = window.matchMedia('(prefers-contrast: more)');

    if (contrastQuery.matches) {
      this.setTheme('high-contrast');
    } else if (!localStorage.getItem('theme')) {
      this.setTheme(darkModeQuery.matches ? 'dark' : 'light');
    }
  }
}
```

**Files to Modify**:
- `src/styles.css` - Add light and high-contrast theme variables
- `src/ui/App.ts` - Initialize ThemeManager in constructor
- `src/main.ts` - Boot theme manager before UI initialization

**Testing**:
```bash
npm test tests/unit/theme/ThemeManager.test.ts
```

---

#### 1.2 Redaction Style System
**Files to Create**:
```
src/lib/redact/
  ├─ styles.ts              # StyleRegistry + built-in styles
  ├─ renderers.ts           # Canvas rendering implementations
  └─ types.ts               # Style interfaces
```

**Core Implementation**:
```typescript
// src/lib/redact/styles.ts
export interface RedactionStyle {
  id: string;
  name: string;
  description: string;
  securityScore: number; // 0-100 (100 = unrecoverable)
  render(ctx: CanvasRenderingContext2D, box: BoundingBox): void;
  getPreview(): string; // Data URL for thumbnail
}

export class StyleRegistry {
  private static styles = new Map<string, RedactionStyle>();

  static register(style: RedactionStyle): void {
    this.styles.set(style.id, style);
  }

  static getAll(): RedactionStyle[] {
    return Array.from(this.styles.values());
  }

  static getById(id: string): RedactionStyle {
    return this.styles.get(id) || this.getDefault();
  }

  static getDefault(): RedactionStyle {
    return this.getById('solid-black');
  }
}

// Built-in styles
export const SolidBlackStyle: RedactionStyle = {
  id: 'solid-black',
  name: 'Solid Black (Recommended)',
  description: 'Opaque black rectangles - unrecoverable',
  securityScore: 100,
  render(ctx, box) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(box.x, box.y, box.width, box.height);
  },
  getPreview() {
    // Generate 50x30 preview canvas
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 30;
    const ctx = canvas.getContext('2d')!;
    this.render(ctx, { x: 5, y: 5, width: 40, height: 20 });
    return canvas.toDataURL();
  }
};

export const BlurStyle: RedactionStyle = {
  id: 'blur',
  name: 'Blur (Experimental)',
  description: '⚠️ WARNING: Can be partially reversed via deconvolution',
  securityScore: 25,
  render(ctx, box) {
    // Apply 20px blur filter
    ctx.filter = 'blur(20px)';
    ctx.drawImage(ctx.canvas, box.x, box.y, box.width, box.height,
                   box.x, box.y, box.width, box.height);
    ctx.filter = 'none';
  },
  getPreview() { /* ... */ }
};

// Register all built-in styles
StyleRegistry.register(SolidBlackStyle);
StyleRegistry.register(BlurStyle);
// Add: PixelateStyle, StrikethroughStyle, ColoredOverlayStyle, etc.
```

**UI Component**:
```typescript
// src/ui/components/StylePicker.ts
export class StylePicker {
  private element: HTMLElement;
  private selectedStyleId: string = 'solid-black';
  onChange?: (styleId: string) => void;

  constructor() {
    this.element = this.render();
  }

  private render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'style-picker';
    container.innerHTML = `
      <h3>Redaction Style</h3>
      <div class="style-grid"></div>
    `;

    const grid = container.querySelector('.style-grid')!;

    StyleRegistry.getAll().forEach(style => {
      const card = document.createElement('button');
      card.className = 'style-card';
      card.dataset.styleId = style.id;
      card.innerHTML = `
        <img src="${style.getPreview()}" alt="${style.name}" />
        <h4>${style.name}</h4>
        <p>${style.description}</p>
        <div class="security-badge" data-score="${style.securityScore}">
          🔒 Security: ${style.securityScore}%
        </div>
      `;

      card.addEventListener('click', () => {
        this.selectStyle(style.id);
      });

      grid.appendChild(card);
    });

    return container;
  }

  private selectStyle(styleId: string): void {
    this.selectedStyleId = styleId;

    // Update visual selection
    this.element.querySelectorAll('.style-card').forEach(card => {
      card.classList.toggle('selected',
        card.dataset.styleId === styleId);
    });

    // Notify parent
    this.onChange?.(styleId);
  }

  getSelectedStyle(): RedactionStyle {
    return StyleRegistry.getById(this.selectedStyleId);
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.element);
  }
}
```

**Files to Modify**:
- `src/ui/components/Settings.ts` - Add StylePicker to settings modal
- `src/ui/App.ts` - Store selected style, pass to redact methods
- `src/lib/pdf/redact.ts` - Use style.render() instead of hardcoded black
- `src/lib/images/redact.ts` - Use style.render() instead of hardcoded black

**Testing**:
```bash
npm test tests/unit/redact/styles.test.ts
npm test tests/unit/redact/renderers.test.ts
```

---

#### 1.3 Accessibility Foundation
**Files to Create**:
```
src/lib/a11y/
  ├─ KeyboardHandler.ts     # Global keyboard shortcuts
  ├─ FocusManager.ts        # Modal focus trapping
  └─ AriaAnnouncer.ts       # Screen reader announcements
```

**Core Implementation**:
```typescript
// src/lib/a11y/KeyboardHandler.ts
export class KeyboardHandler {
  private shortcuts = new Map<string, () => void>();

  register(key: string, callback: () => void, description: string): void {
    this.shortcuts.set(key, callback);
  }

  init(): void {
    document.addEventListener('keydown', (e) => {
      const key = this.normalizeKey(e);
      const handler = this.shortcuts.get(key);
      if (handler) {
        e.preventDefault();
        handler();
      }
    });
  }

  private normalizeKey(e: KeyboardEvent): string {
    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    parts.push(e.key);
    return parts.join('+');
  }
}

// src/lib/a11y/AriaAnnouncer.ts
export class AriaAnnouncer {
  private liveRegion: HTMLElement;

  constructor() {
    this.liveRegion = document.createElement('div');
    this.liveRegion.setAttribute('role', 'status');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.liveRegion.style.position = 'absolute';
    this.liveRegion.style.left = '-10000px';
    document.body.appendChild(this.liveRegion);
  }

  announce(message: string): void {
    this.liveRegion.textContent = message;
  }
}
```

**Files to Modify**:
- All component files - Audit and add ARIA labels
- `src/ui/components/DropZone.ts` - Add `role="button"`, `tabindex="0"`
- `src/ui/components/ModalDialog.ts` - Add focus trap
- `src/ui/App.ts` - Initialize keyboard handler, add shortcuts

**Testing**:
```bash
npm test tests/unit/a11y/KeyboardHandler.test.ts
npm run test:a11y  # Manual accessibility audit
```

---

### **PHASE 2: Batch Processing (Weeks 3-4) - 16 hours**

Multi-file workflow with progress tracking and error handling.

#### 2.1 Task Queue System
**Files to Create**:
```
src/lib/queue/
  ├─ TaskQueue.ts           # Core queue logic
  ├─ types.ts               # Task interfaces
  └─ TaskProcessor.ts       # File processing worker
```

**Core Implementation**:
```typescript
// src/lib/queue/types.ts
export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  PAUSED = 'paused',
  CANCELLED = 'cancelled'
}

export interface ProcessingTask {
  id: string;
  fileIndex: number;
  fileName: string;
  status: TaskStatus;
  progress: number; // 0-100
  error?: Error;
  startTime?: number;
  endTime?: number;
  result?: Blob;
}

// src/lib/queue/TaskQueue.ts
export class TaskQueue {
  private tasks = new Map<string, ProcessingTask>();
  private isProcessing = false;
  private isPaused = false;
  private maxConcurrent = 1; // Sequential processing

  // Event callbacks
  onTaskStart?: (taskId: string) => void;
  onTaskProgress?: (taskId: string, progress: number) => void;
  onTaskComplete?: (taskId: string, result: Blob) => void;
  onTaskError?: (taskId: string, error: Error) => void;
  onQueueComplete?: () => void;

  enqueue(fileIndex: number, fileName: string): string {
    const id = crypto.randomUUID();
    const task: ProcessingTask = {
      id,
      fileIndex,
      fileName,
      status: TaskStatus.PENDING,
      progress: 0
    };

    this.tasks.set(id, task);
    this.processNext();
    return id;
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
    this.processNext();
  }

  cancel(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task && task.status === TaskStatus.PENDING) {
      task.status = TaskStatus.CANCELLED;
    }
  }

  cancelAll(): void {
    this.tasks.forEach(task => {
      if (task.status === TaskStatus.PENDING) {
        task.status = TaskStatus.CANCELLED;
      }
    });
    this.isPaused = true;
  }

  retry(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task && task.status === TaskStatus.FAILED) {
      task.status = TaskStatus.PENDING;
      task.error = undefined;
      task.progress = 0;
      this.processNext();
    }
  }

  getStatus(taskId: string): ProcessingTask | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): ProcessingTask[] {
    return Array.from(this.tasks.values());
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.isPaused) return;

    // Find next pending task
    const task = Array.from(this.tasks.values()).find(
      t => t.status === TaskStatus.PENDING
    );

    if (!task) {
      // All tasks completed
      if (this.tasks.size > 0) {
        this.onQueueComplete?.();
      }
      return;
    }

    this.isProcessing = true;
    task.status = TaskStatus.PROCESSING;
    task.startTime = Date.now();
    this.onTaskStart?.(task.id);

    try {
      // Process task (implemented by caller via processor callback)
      const result = await this.processTask(task);

      task.status = TaskStatus.SUCCESS;
      task.endTime = Date.now();
      task.result = result;
      task.progress = 100;

      this.onTaskComplete?.(task.id, result);
    } catch (error) {
      task.status = TaskStatus.FAILED;
      task.endTime = Date.now();
      task.error = error as Error;

      this.onTaskError?.(task.id, error as Error);
    } finally {
      this.isProcessing = false;

      // Process next task in queue
      setTimeout(() => this.processNext(), 100);
    }
  }

  // To be implemented by caller
  private async processTask(task: ProcessingTask): Promise<Blob> {
    throw new Error('processTask must be implemented');
  }

  setProcessorCallback(callback: (task: ProcessingTask) => Promise<Blob>): void {
    this.processTask = callback;
  }
}
```

---

#### 2.2 Batch Progress UI
**Files to Create**:
```
src/ui/components/
  ├─ BatchProgressPanel.ts  # Progress display
  └─ BatchControls.ts       # Pause/Resume/Cancel buttons
```

**Core Implementation**:
```typescript
// src/ui/components/BatchProgressPanel.ts
export class BatchProgressPanel {
  private element: HTMLElement;
  private tasks = new Map<string, HTMLElement>();

  constructor() {
    this.element = this.createPanel();
  }

  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'batch-progress-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <h3>Batch Processing</h3>
        <div class="overall-progress">
          <progress id="overall-progress" max="100" value="0"></progress>
          <span class="progress-text">0 / 0 files</span>
        </div>
      </div>
      <div class="task-list"></div>
      <div class="panel-actions">
        <button id="pause-btn">Pause</button>
        <button id="resume-btn" disabled>Resume</button>
        <button id="cancel-btn">Cancel All</button>
        <button id="download-all-btn" disabled>Download All</button>
      </div>
    `;
    return panel;
  }

  addTask(taskId: string, fileName: string): void {
    const taskCard = document.createElement('div');
    taskCard.className = 'task-card';
    taskCard.dataset.taskId = taskId;
    taskCard.innerHTML = `
      <div class="task-header">
        <span class="file-name">${fileName}</span>
        <span class="status-badge pending">Pending</span>
      </div>
      <progress class="task-progress" max="100" value="0"></progress>
      <div class="task-actions">
        <button class="retry-btn" disabled>Retry</button>
      </div>
    `;

    const taskList = this.element.querySelector('.task-list')!;
    taskList.appendChild(taskCard);
    this.tasks.set(taskId, taskCard);
  }

  updateTask(taskId: string, status: TaskStatus, progress: number): void {
    const taskCard = this.tasks.get(taskId);
    if (!taskCard) return;

    const statusBadge = taskCard.querySelector('.status-badge')!;
    const progressBar = taskCard.querySelector('.task-progress') as HTMLProgressElement;
    const retryBtn = taskCard.querySelector('.retry-btn') as HTMLButtonElement;

    // Update status
    statusBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    statusBadge.className = `status-badge ${status}`;

    // Update progress
    progressBar.value = progress;

    // Update actions
    retryBtn.disabled = status !== TaskStatus.FAILED;

    // Update overall progress
    this.updateOverallProgress();
  }

  private updateOverallProgress(): void {
    const tasks = Array.from(this.tasks.keys());
    const completed = tasks.filter(id => {
      const card = this.tasks.get(id)!;
      const status = card.querySelector('.status-badge')!.textContent?.toLowerCase();
      return status === 'success';
    }).length;

    const progressBar = this.element.querySelector('#overall-progress') as HTMLProgressElement;
    const progressText = this.element.querySelector('.progress-text')!;

    const percentage = (completed / tasks.length) * 100;
    progressBar.value = percentage;
    progressText.textContent = `${completed} / ${tasks.length} files`;

    // Enable download button when all complete
    const downloadBtn = this.element.querySelector('#download-all-btn') as HTMLButtonElement;
    downloadBtn.disabled = completed !== tasks.length;
  }

  show(): void {
    document.body.appendChild(this.element);
  }

  hide(): void {
    this.element.remove();
  }

  // Event handlers (implemented in App.ts)
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onDownloadAll?: () => void;
  onRetry?: (taskId: string) => void;
}
```

---

#### 2.3 App Integration
**Files to Modify**:
- `src/ui/App.ts` - Add batch export method + queue management
- `src/ui/components/Toolbar.ts` - Add "Batch Export" button
- `src/lib/pdf/export.ts` - Emit progress events during export

**Implementation in App.ts**:
```typescript
// In App.ts
private taskQueue = new TaskQueue();
private batchProgressPanel?: BatchProgressPanel;

private async handleBatchExport(): Promise<void> {
  if (this.files.length === 0) return;

  // Show progress panel
  this.batchProgressPanel = new BatchProgressPanel();
  this.batchProgressPanel.show();

  // Setup queue callbacks
  this.setupTaskQueueHandlers();

  // Set processor callback
  this.taskQueue.setProcessorCallback(async (task) => {
    return await this.processFile(task.fileIndex);
  });

  // Enqueue all files
  this.files.forEach((file, index) => {
    const taskId = this.taskQueue.enqueue(index, file.name);
    this.batchProgressPanel?.addTask(taskId, file.name);
  });
}

private setupTaskQueueHandlers(): void {
  this.taskQueue.onTaskProgress = (id, progress) => {
    this.batchProgressPanel?.updateTask(id, TaskStatus.PROCESSING, progress);
  };

  this.taskQueue.onTaskComplete = (id, result) => {
    this.batchProgressPanel?.updateTask(id, TaskStatus.SUCCESS, 100);

    // Auto-download (or store for bulk download)
    const task = this.taskQueue.getStatus(id);
    if (task) {
      saveBlob(result, task.fileName);
    }
  };

  this.taskQueue.onTaskError = (id, error) => {
    this.batchProgressPanel?.updateTask(id, TaskStatus.FAILED, 0);
    this.toast.show(`Failed: ${error.message}`, 'error');
  };

  this.taskQueue.onQueueComplete = () => {
    this.toast.show('Batch export complete!', 'success');
  };

  // Wire up panel controls
  if (this.batchProgressPanel) {
    this.batchProgressPanel.onPause = () => this.taskQueue.pause();
    this.batchProgressPanel.onResume = () => this.taskQueue.resume();
    this.batchProgressPanel.onCancel = () => this.taskQueue.cancelAll();
    this.batchProgressPanel.onRetry = (id) => this.taskQueue.retry(id);
  }
}

private async processFile(fileIndex: number): Promise<Blob> {
  // Load file
  await this.loadFile(fileIndex);

  // Run detection if enabled
  if (this.detectionsEnabled) {
    await this.detectPII();
  }

  // Export with redactions
  if (this.currentFileType === 'pdf') {
    return await this.exportPdfToBlob();
  } else {
    return await this.exportImageToBlob();
  }
}
```

**Testing**:
```bash
npm test tests/unit/queue/TaskQueue.test.ts
npm test tests/integration/batch-export.test.ts
```

---

### **PHASE 3: Smart Detection (Weeks 4-5) - 14 hours**

Custom patterns, confidence tuning, and context-aware detection.

#### 3.1 Custom Pattern System
**Files to Create**:
```
src/lib/detect/
  ├─ custom-patterns.ts     # Pattern registry + persistence
  └─ pattern-validator.ts   # Regex validation
```

**Core Implementation**:
```typescript
// src/lib/detect/custom-patterns.ts
export interface CustomPattern {
  id: string;
  name: string;
  regex: string;
  type: string; // 'email', 'phone', 'custom', etc.
  caseSensitive: boolean;
  enabled: boolean;
  description?: string;
  createdAt: number;
  lastUsed?: number;
}

export class CustomPatternRegistry {
  private patterns = new Map<string, CustomPattern>();
  private storageKey = 'custom-patterns';

  constructor() {
    this.loadPatterns();
  }

  addPattern(pattern: Omit<CustomPattern, 'id' | 'createdAt'>): string {
    const id = crypto.randomUUID();
    const newPattern: CustomPattern = {
      ...pattern,
      id,
      createdAt: Date.now()
    };

    this.patterns.set(id, newPattern);
    this.savePatterns();
    return id;
  }

  updatePattern(id: string, updates: Partial<CustomPattern>): void {
    const pattern = this.patterns.get(id);
    if (pattern) {
      Object.assign(pattern, updates);
      this.savePatterns();
    }
  }

  deletePattern(id: string): void {
    this.patterns.delete(id);
    this.savePatterns();
  }

  getPattern(id: string): CustomPattern | undefined {
    return this.patterns.get(id);
  }

  getAllPatterns(): CustomPattern[] {
    return Array.from(this.patterns.values());
  }

  getEnabledPatterns(): CustomPattern[] {
    return this.getAllPatterns().filter(p => p.enabled);
  }

  private loadPatterns(): void {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      const patterns = JSON.parse(stored) as CustomPattern[];
      patterns.forEach(p => this.patterns.set(p.id, p));
    }
  }

  private savePatterns(): void {
    const patterns = this.getAllPatterns();
    localStorage.setItem(this.storageKey, JSON.stringify(patterns));
  }

  // Import/export for sharing
  exportToJSON(): string {
    return JSON.stringify(this.getAllPatterns(), null, 2);
  }

  importFromJSON(json: string): number {
    const patterns = JSON.parse(json) as CustomPattern[];
    let imported = 0;

    patterns.forEach(pattern => {
      // Generate new IDs to avoid conflicts
      this.addPattern(pattern);
      imported++;
    });

    return imported;
  }
}

// Integrate into main detection pipeline
export function detectAllPIIEnhanced(
  text: string,
  options: DetectionOptions
): PIIMatch[] {
  const results: PIIMatch[] = [];

  // 1. Run built-in regex patterns
  results.push(...detectAllPII(text));

  // 2. Run custom patterns
  const customPatterns = options.customPatternRegistry?.getEnabledPatterns() ?? [];
  for (const pattern of customPatterns) {
    const regex = new RegExp(
      pattern.regex,
      pattern.caseSensitive ? 'g' : 'gi'
    );

    const matches = Array.from(text.matchAll(regex));
    matches.forEach(match => {
      results.push({
        text: match[0],
        type: pattern.type,
        source: 'custom',
        confidence: 1.0,
        start: match.index!,
        end: match.index! + match[0].length,
        patternId: pattern.id
      });
    });

    // Track usage
    pattern.lastUsed = Date.now();
  }

  // 3. Run ML detection (if enabled)
  if (options.mlEnabled) {
    const mlResults = await detectWithML(text, options);
    results.push(...mlResults);
  }

  // 4. Merge and deduplicate
  return mergeDetections(results, options);
}
```

---

#### 3.2 Pattern Builder UI
**Files to Create**:
```
src/ui/components/
  ├─ PatternBuilder.ts      # Pattern creation modal
  ├─ PatternList.ts         # Pattern management list
  └─ PatternTester.ts       # Live regex testing
```

**Core Implementation**:
```typescript
// src/ui/components/PatternBuilder.ts
export class PatternBuilder extends ModalDialog {
  private patternRegistry: CustomPatternRegistry;
  private editingPatternId?: string;

  constructor(registry: CustomPatternRegistry) {
    super('Create Custom Pattern');
    this.patternRegistry = registry;
  }

  protected getContent(): string {
    return `
      <form class="pattern-form">
        <label>
          Pattern Name
          <input type="text" name="name" placeholder="Company ID Format" required />
        </label>

        <label>
          Regular Expression
          <textarea name="regex"
                    placeholder="[A-Z]{3}-\d{6}"
                    rows="3"
                    required></textarea>
          <span class="help-text">
            Use JavaScript regex syntax.
            <a href="https://regex101.com" target="_blank">Test on regex101.com</a>
          </span>
        </label>

        <label>
          Category
          <select name="type">
            <option value="custom">Custom</option>
            <option value="id">ID Number</option>
            <option value="financial">Financial</option>
            <option value="medical">Medical</option>
            <option value="personal">Personal Info</option>
          </select>
        </label>

        <label>
          <input type="checkbox" name="caseSensitive" />
          Case Sensitive
        </label>

        <label>
          Description (optional)
          <textarea name="description"
                    placeholder="Matches company-issued ID numbers"
                    rows="2"></textarea>
        </label>

        <hr />

        <h4>Test Pattern</h4>
        <label>
          Sample Text
          <textarea id="test-text"
                    placeholder="Paste sample text here..."
                    rows="5"></textarea>
        </label>
        <button type="button" id="test-btn">Test Pattern</button>
        <div id="test-results" class="test-results"></div>

        <div class="modal-actions">
          <button type="submit" class="primary">Save Pattern</button>
          <button type="button" class="secondary" data-action="cancel">Cancel</button>
        </div>
      </form>
    `;
  }

  protected setupEventListeners(): void {
    super.setupEventListeners();

    const form = this.element.querySelector('.pattern-form') as HTMLFormElement;
    const testBtn = this.element.querySelector('#test-btn') as HTMLButtonElement;

    // Live regex testing
    testBtn.addEventListener('click', () => this.testPattern());

    // Form submission
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.savePattern(new FormData(form));
    });
  }

  private testPattern(): void {
    const regexInput = this.element.querySelector('[name="regex"]') as HTMLTextAreaElement;
    const testText = this.element.querySelector('#test-text') as HTMLTextAreaElement;
    const resultsDiv = this.element.querySelector('#test-results')!;

    try {
      const regex = new RegExp(regexInput.value, 'gi');
      const matches = Array.from(testText.value.matchAll(regex));

      if (matches.length === 0) {
        resultsDiv.innerHTML = '<p class="no-matches">No matches found</p>';
      } else {
        resultsDiv.innerHTML = `
          <p class="match-count">Found ${matches.length} match(es):</p>
          <ul class="match-list">
            ${matches.map(m => `<li><code>${m[0]}</code></li>`).join('')}
          </ul>
        `;
      }
    } catch (error) {
      resultsDiv.innerHTML = `<p class="error">Invalid regex: ${(error as Error).message}</p>`;
    }
  }

  private savePattern(formData: FormData): void {
    const pattern = {
      name: formData.get('name') as string,
      regex: formData.get('regex') as string,
      type: formData.get('type') as string,
      caseSensitive: formData.has('caseSensitive'),
      description: formData.get('description') as string,
      enabled: true
    };

    // Validate regex
    try {
      new RegExp(pattern.regex);
    } catch (error) {
      alert('Invalid regular expression: ' + (error as Error).message);
      return;
    }

    if (this.editingPatternId) {
      this.patternRegistry.updatePattern(this.editingPatternId, pattern);
    } else {
      this.patternRegistry.addPattern(pattern);
    }

    this.close();
    this.onSave?.(pattern);
  }

  onSave?: (pattern: any) => void;
}
```

---

#### 3.3 Confidence Threshold UI
**Files to Modify**:
- `src/ui/components/Settings.ts` - Add confidence slider
- `src/ui/App.ts` - Apply threshold to detection results

**Implementation**:
```typescript
// In Settings.ts
<label>
  ML Detection Confidence Threshold: <span id="confidence-value">0.85</span>
  <input type="range"
         id="ml-confidence-threshold"
         min="0"
         max="1"
         step="0.05"
         value="0.85" />
  <span class="help-text">
    Higher values = fewer false positives, but may miss some detections
  </span>
</label>

// In App.ts detection
const threshold = this.getConfidenceThreshold();
const filteredResults = detections.filter(d => d.confidence >= threshold);
```

**Testing**:
```bash
npm test tests/unit/detect/custom-patterns.test.ts
npm test tests/integration/custom-detection.test.ts
```

---

### **PHASE 4: Document Sanitizer (Week 6) - 10 hours**

Metadata stripping and privacy scoring.

#### 4.1 PDF Sanitization
**Files to Create**:
```
src/lib/pdf/
  ├─ sanitize.ts            # Metadata stripping
  └─ privacy-scanner.ts     # Privacy risk analysis
```

**Core Implementation**:
```typescript
// src/lib/pdf/sanitize.ts
import { PDFDocument } from 'pdf-lib';

export interface SanitizeOptions {
  stripMetadata: boolean;         // Remove title, author, etc.
  removeAnnotations: boolean;     // Remove comments, highlights
  removeFormFields: boolean;      // Clear fillable form data
  stripHyperlinks: boolean;       // Remove all links
  removeXMPMetadata: boolean;     // Remove embedded XMP
  removeJavaScript: boolean;      // Remove embedded JS
  flattenLayers: boolean;         // Flatten optional content layers
}

export interface SanitizationReport {
  itemsRemoved: {
    metadata: string[];
    annotations: number;
    formFields: number;
    hyperlinks: number;
    scripts: number;
  };
  privacyScore: number; // 0-100 (after sanitization)
}

export async function sanitizePdf(
  pdfBytes: Uint8Array,
  options: SanitizeOptions
): Promise<{ sanitized: Uint8Array; report: SanitizationReport }> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const report: SanitizationReport = {
    itemsRemoved: {
      metadata: [],
      annotations: 0,
      formFields: 0,
      hyperlinks: 0,
      scripts: 0
    },
    privacyScore: 100
  };

  // 1. Strip metadata
  if (options.stripMetadata) {
    const metadata = [
      { key: 'Title', value: pdfDoc.getTitle() },
      { key: 'Author', value: pdfDoc.getAuthor() },
      { key: 'Subject', value: pdfDoc.getSubject() },
      { key: 'Creator', value: pdfDoc.getCreator() },
      { key: 'Producer', value: pdfDoc.getProducer() }
    ];

    metadata.forEach(({ key, value }) => {
      if (value) {
        report.itemsRemoved.metadata.push(`${key}: ${value}`);
      }
    });

    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setCreator('');
    pdfDoc.setProducer('');
    pdfDoc.setKeywords([]);
    pdfDoc.setCreationDate(new Date(0));
    pdfDoc.setModificationDate(new Date(0));
  }

  // 2. Remove annotations
  if (options.removeAnnotations) {
    const pages = pdfDoc.getPages();
    pages.forEach(page => {
      // Get page annotations (pdf-lib doesn't expose this directly)
      // May need to use pdf.js or lower-level PDFDocument APIs
      const annots = (page as any).node.Annots?.();
      if (annots) {
        report.itemsRemoved.annotations += annots.size();
        (page as any).node.delete('Annots');
      }
    });
  }

  // 3. Remove form fields
  if (options.removeFormFields) {
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    report.itemsRemoved.formFields = fields.length;

    fields.forEach(field => {
      form.removeField(field);
    });
  }

  // 4. Strip hyperlinks
  if (options.stripHyperlinks) {
    // Links are stored in annotation dictionaries
    // Implementation similar to removeAnnotations
  }

  // 5. Remove embedded JavaScript
  if (options.removeJavaScript) {
    // Check for JS in document catalog and actions
    const catalog = (pdfDoc as any).context.lookup((pdfDoc as any).context.trailerInfo.Root);
    if (catalog.has('OpenAction') || catalog.has('AA')) {
      catalog.delete('OpenAction');
      catalog.delete('AA');
      report.itemsRemoved.scripts++;
    }
  }

  // Calculate final privacy score
  report.privacyScore = calculatePrivacyScore(report);

  const sanitized = await pdfDoc.save();
  return { sanitized, report };
}

function calculatePrivacyScore(report: SanitizationReport): number {
  let score = 100;

  // Deduct points for remaining risks
  if (report.itemsRemoved.metadata.length === 0) score -= 20;
  if (report.itemsRemoved.annotations > 0) score -= 10;
  if (report.itemsRemoved.formFields > 0) score -= 15;
  if (report.itemsRemoved.scripts > 0) score -= 30;

  return Math.max(0, score);
}
```

---

#### 4.2 Privacy Scanner
**Files to Create**:
```
src/lib/pdf/
  └─ privacy-scanner.ts     # Pre-sanitization risk analysis
```

**Core Implementation**:
```typescript
// src/lib/pdf/privacy-scanner.ts
export interface PrivacyRisk {
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  found: boolean;
  details?: string;
}

export interface PrivacyScanResult {
  score: number; // 0-100 (100 = no risks)
  risks: PrivacyRisk[];
}

export async function scanPdfPrivacy(pdfBytes: Uint8Array): Promise<PrivacyScanResult> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const risks: PrivacyRisk[] = [];

  // 1. Check metadata
  const hasMetadata = !!(
    pdfDoc.getTitle() ||
    pdfDoc.getAuthor() ||
    pdfDoc.getCreator() ||
    pdfDoc.getProducer()
  );

  risks.push({
    category: 'Document Metadata',
    severity: 'medium',
    description: 'PDF contains author, title, or creation software information',
    found: hasMetadata,
    details: hasMetadata
      ? `Author: ${pdfDoc.getAuthor()}, Creator: ${pdfDoc.getCreator()}`
      : undefined
  });

  // 2. Check for annotations
  const pages = pdfDoc.getPages();
  let annotationCount = 0;
  pages.forEach(page => {
    const annots = (page as any).node.Annots?.();
    if (annots) annotationCount += annots.size();
  });

  risks.push({
    category: 'Annotations',
    severity: 'low',
    description: 'PDF contains comments, highlights, or markup',
    found: annotationCount > 0,
    details: annotationCount > 0 ? `${annotationCount} annotation(s) found` : undefined
  });

  // 3. Check for form fields
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  risks.push({
    category: 'Form Fields',
    severity: 'high',
    description: 'PDF contains fillable form fields that may leak data',
    found: fields.length > 0,
    details: fields.length > 0 ? `${fields.length} field(s) found` : undefined
  });

  // 4. Check for JavaScript
  const catalog = (pdfDoc as any).context.lookup((pdfDoc as any).context.trailerInfo.Root);
  const hasJS = catalog.has('OpenAction') || catalog.has('AA');

  risks.push({
    category: 'Embedded Scripts',
    severity: 'critical',
    description: 'PDF contains JavaScript that could execute actions',
    found: hasJS
  });

  // Calculate overall score
  const score = calculatePrivacyScoreFromRisks(risks);

  return { score, risks };
}

function calculatePrivacyScoreFromRisks(risks: PrivacyRisk[]): number {
  let score = 100;

  risks.forEach(risk => {
    if (risk.found) {
      switch (risk.severity) {
        case 'low': score -= 5; break;
        case 'medium': score -= 15; break;
        case 'high': score -= 25; break;
        case 'critical': score -= 40; break;
      }
    }
  });

  return Math.max(0, score);
}
```

---

#### 4.3 Sanitizer UI
**Files to Create**:
```
src/ui/components/
  ├─ SanitizeOptions.ts     # Sanitization settings modal
  └─ PrivacyScoreCard.ts    # Privacy score display
```

**Core Implementation**:
```typescript
// src/ui/components/SanitizeOptions.ts
export class SanitizeOptions extends ModalDialog {
  private scanResult?: PrivacyScanResult;

  constructor() {
    super('Document Sanitizer');
  }

  async showForPdf(pdfBytes: Uint8Array): Promise<SanitizeOptions | null> {
    // Run privacy scan
    this.scanResult = await scanPdfPrivacy(pdfBytes);

    this.open();
    return new Promise(resolve => {
      this.onConfirm = () => resolve(this.getSelectedOptions());
      this.onCancel = () => resolve(null);
    });
  }

  protected getContent(): string {
    const risks = this.scanResult?.risks || [];
    const score = this.scanResult?.score || 100;

    return `
      <div class="privacy-score-card ${this.getScoreClass(score)}">
        <h3>Privacy Score: ${score}/100</h3>
        <div class="score-bar">
          <div class="score-fill" style="width: ${score}%"></div>
        </div>
        <p>${this.getScoreDescription(score)}</p>
      </div>

      <h4>Privacy Risks Found:</h4>
      <ul class="risk-list">
        ${risks.map(risk => this.renderRisk(risk)).join('')}
      </ul>

      <hr />

      <h4>Sanitization Options:</h4>
      <form id="sanitize-form">
        <label>
          <input type="checkbox" name="stripMetadata" checked />
          Strip document metadata (title, author, dates)
        </label>
        <label>
          <input type="checkbox" name="removeAnnotations" checked />
          Remove all annotations and comments
        </label>
        <label>
          <input type="checkbox" name="removeFormFields" checked />
          Clear all form field data
        </label>
        <label>
          <input type="checkbox" name="stripHyperlinks" />
          Remove all hyperlinks
        </label>
        <label>
          <input type="checkbox" name="removeJavaScript" checked />
          Remove embedded JavaScript
        </label>

        <div class="modal-actions">
          <button type="submit" class="primary">Sanitize Document</button>
          <button type="button" class="secondary" data-action="cancel">Cancel</button>
        </div>
      </form>
    `;
  }

  private renderRisk(risk: PrivacyRisk): string {
    if (!risk.found) return '';

    return `
      <li class="risk-item severity-${risk.severity}">
        <span class="severity-badge">${risk.severity.toUpperCase()}</span>
        <div class="risk-details">
          <strong>${risk.category}</strong>
          <p>${risk.description}</p>
          ${risk.details ? `<code>${risk.details}</code>` : ''}
        </div>
      </li>
    `;
  }

  private getScoreClass(score: number): string {
    if (score >= 80) return 'score-good';
    if (score >= 50) return 'score-medium';
    return 'score-poor';
  }

  private getScoreDescription(score: number): string {
    if (score >= 80) return '✅ Good privacy - minimal risks detected';
    if (score >= 50) return '⚠️ Moderate privacy - some risks present';
    return '🚨 Poor privacy - significant risks detected';
  }

  private getSelectedOptions(): SanitizeOptions {
    const form = this.element.querySelector('#sanitize-form') as HTMLFormElement;
    const formData = new FormData(form);

    return {
      stripMetadata: formData.has('stripMetadata'),
      removeAnnotations: formData.has('removeAnnotations'),
      removeFormFields: formData.has('removeFormFields'),
      stripHyperlinks: formData.has('stripHyperlinks'),
      removeJavaScript: formData.has('removeJavaScript'),
      removeXMPMetadata: true,
      flattenLayers: true
    };
  }

  onConfirm?: () => void;
  onCancel?: () => void;
}
```

**Files to Modify**:
- `src/ui/App.ts` - Add sanitization step to export pipeline
- `src/ui/components/Toolbar.ts` - Add "Sanitize" button

**Integration in App.ts**:
```typescript
private async exportPdfWithSanitization(): Promise<void> {
  // 1. Get current PDF bytes
  const pdfBytes = await this.getCurrentPdfBytes();

  // 2. Show sanitizer modal
  const sanitizeDialog = new SanitizeOptions();
  const options = await sanitizeDialog.showForPdf(pdfBytes);

  if (!options) return; // User cancelled

  // 3. Apply redactions first
  const redactedBytes = await this.applyRedactions(pdfBytes);

  // 4. Sanitize
  const { sanitized, report } = await sanitizePdf(redactedBytes, options);

  // 5. Show report
  this.toast.show(
    `Sanitized! Removed ${report.itemsRemoved.metadata.length} metadata items, ` +
    `${report.itemsRemoved.annotations} annotations. Privacy score: ${report.privacyScore}/100`,
    'success'
  );

  // 6. Save
  await saveBlob(new Blob([sanitized]), this.currentFileName);
}
```

**Testing**:
```bash
npm test tests/unit/pdf/sanitize.test.ts
npm test tests/unit/pdf/privacy-scanner.test.ts
npm test tests/integration/sanitization-workflow.test.ts
```

---

## 📊 Implementation Summary

### Dependency Matrix

| Feature | Dependencies | Can Parallelize |
|---------|--------------|-----------------|
| Theme System | None | ✅ Start immediately |
| Redaction Styles | Theme Manager | After Phase 1.1 |
| Accessibility | Theme Manager | After Phase 1.1 |
| Batch Processing | None | ✅ Start immediately |
| Smart Detection | None | ✅ Start immediately |
| Sanitization | None | ✅ Start immediately |

### Recommended Implementation Order

**Week 1-2**: Theme foundation (enables everything else)
- Theme Manager
- Redaction Styles
- Basic accessibility

**Week 3-4**: Parallel development
- **Track A**: Batch Processing (developer 1)
- **Track B**: Smart Detection (developer 2)

**Week 5-6**: Sanitization + Polish
- Document Sanitizer
- Integration testing
- Accessibility audit

### Testing Milestones

| Week | Tests to Complete | Coverage Target |
|------|-------------------|-----------------|
| 2 | Theme + Styles unit tests | 85%+ |
| 4 | Batch queue + Detection tests | 80%+ |
| 6 | Sanitization + Integration tests | 85%+ |
| 7 | E2E tests + accessibility audit | 90%+ |

---

## 🎯 Success Metrics

**Feature 1 (Themes)**: Users can switch between 3+ themes, persisted across sessions
**Feature 2 (Accessibility)**: Pass WCAG 2.2 AA audit, keyboard nav works 100%
**Feature 3 (Smart Detection)**: Users can create custom patterns, accuracy improves 20%
**Feature 4 (Batch Processing)**: Process 10+ files sequentially, <5% failure rate
**Feature 5 (Sanitization)**: Privacy score shown before/after, metadata 100% removed

---

## 📦 Bundle Size Impact

| Feature | Estimated Size | Notes |
|---------|---------------|-------|
| Theme System | +8 KB | CSS variables + manager |
| Redaction Styles | +12 KB | 5-6 style renderers |
| Batch Queue | +6 KB | Pure TypeScript |
| Custom Patterns | +10 KB | Regex validator + UI |
| Sanitization | +15 KB | pdf-lib extensions |
| **Total** | **+51 KB** | <5% increase (current: ~1.2MB) |

All features use existing dependencies (no new npm packages required).

---

## 🚀 Quick Start Commands

```bash
# Install dependencies (if needed)
npm install

# Run tests for specific feature
npm test tests/unit/theme/
npm test tests/unit/queue/
npm test tests/unit/detect/custom-patterns.test.ts

# Start dev server
npm run dev

# Build production
npm run build

# Preview production build
npm run preview
```

---

## 📚 Additional Documentation

- **ARCHITECTURE_ANALYSIS.md** - Deep dive into current codebase
- **IMPLEMENTATION_ROADMAP.md** - Detailed per-feature plans
- **FORMAT_HANDLER_GUIDE.md** - Adding new document formats
- **ML_DETECTION.md** - Machine learning detection details

---

## ✅ Final Checklist

Before marking implementation complete:

- [ ] All unit tests pass (`npm test`)
- [ ] Integration tests pass (`npm test tests/integration/`)
- [ ] Coverage ≥85% for new code (`npm run test:coverage`)
- [ ] Accessibility audit passes (`npm run test:a11y`)
- [ ] Production build succeeds (`npm run build`)
- [ ] PWA still works offline (test in DevTools)
- [ ] No new console errors or warnings
- [ ] Documentation updated (CLAUDE.md, README.md)
- [ ] All features demo successfully in manual testing

---

**Questions or need clarification?** Reference the detailed roadmap or ask for specific code examples!

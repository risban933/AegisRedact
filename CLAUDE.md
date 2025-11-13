# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AegisRedact** (formerly Share-Safe Toolkit) is a privacy-first Progressive Web App for redacting sensitive information from multiple document formats. **All processing happens client-side in the browser—no server uploads, no tracking, no external APIs for core functionality.**

The app supports PDFs, images, plain text, CSV/TSV, and includes advanced features like undo/redo, layer management, customizable themes, privacy scoring, and batch processing.

## Context7 MCP (Documentation Research)

- The Context7 MCP server (`context7`) is now wired up for this project—use it whenever you need current library/API docs, setup steps, or configuration details instead of guessing.
- Preferred workflow: call `mcp__context7__resolve-library-id` to locate the package, then `mcp__context7__get-library-docs` to pull the relevant references before updating or planning features.
- You can run the server without credentials, but if you have a Context7 API key, export `CONTEXT7_API_KEY` in your shell (or update `.claude/settings.local.json`) before invoking the tools to unlock higher rate limits and private docs.
- Add a rule to your prompts (e.g., “always use Context7 for docs/research”) if you want automatic retrieval.

## Commands

### Development
```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Production build (Vite + Workbox SW generation)
npm run preview      # Preview production build locally
```

### Testing
```bash
npm test             # Run unit tests (watch mode)
npm run test:ui      # Run tests with Vitest UI dashboard
npm run test:coverage # Generate coverage report
```

## Architecture

### Layered Design with Strict Separation

The codebase follows a **modular, library-first architecture** with three distinct layers:

1. **`src/lib/`** - Framework-agnostic business logic (testable in isolation)
   - `detect/` - PII detection (regex patterns + ML-based NER + result merging)
     - `patterns.ts` - Core US-centric patterns (emails, phones, SSNs, cards)
     - `patterns-european.ts` - EU data (IBAN, VAT numbers, national IDs)
     - `patterns-asian.ts` - Asian formats (Aadhaar, MyKad, NRIC, etc.)
     - `patterns-latam.ts` - Latin American IDs (CPF, CURP, RUT, etc.)
     - `patterns-financial.ts` - Banking (SWIFT/BIC, routing numbers, CLABE)
     - `patterns-investment.ts` - Investment data (CUSIP, ISIN, ticker symbols)
     - `patterns-crypto.ts` - Cryptocurrency addresses and wallet IDs
     - `ml.ts` - TensorFlow.js NER model integration
     - `merger.ts` - Deduplication and confidence-based merging
     - `hybrid.ts` - Hybrid detection combining regex + ML
     - `luhn.ts` - Credit card validation algorithm
     - `validation.ts` - Validation utilities for detected patterns
   - `formats/` - Document format abstraction layer (multi-format support)
     - `base/` - Abstract base classes and shared types
     - `text/` - Plain text and Markdown handlers
     - `structured/` - CSV/TSV handlers
   - `pdf/` - PDF processing pipeline (load, render, find, redact, export)
     - `coordinates.ts` - PDF coordinate system conversion utilities
     - `sanitize.ts` - PDF metadata sanitization
   - `images/` - Image processing and EXIF metadata removal
   - `ocr/` - OCR utilities and enhanced detection
     - `mapper.ts` - Maps detected PII to OCR word coordinates
     - `enhanced-ocr.ts` - Enhanced OCR with preprocessing
     - `table-detector.ts` - Automatic table structure detection
     - `form-detector.ts` - Form field recognition
     - `column-rules.ts` - Column-based redaction rules
     - `form-templates.ts` - Pre-defined form templates
   - `history/` - Undo/redo system
     - `command.ts` - Command pattern interface
     - `manager.ts` - History manager implementation
     - `commands.ts` - Concrete command implementations
   - `layers/` - Layer management for multi-layer redaction
     - `types.ts` - Layer type definitions
     - `manager.ts` - Layer stack management
   - `redact/` - Redaction style system
     - `styles.ts` - Style registry and base classes
     - `renderers.ts` - Built-in renderers (solid, pattern, text)
   - `theme/` - Theme management and customization
     - `ThemeManager.ts` - Runtime theme switching
     - `themes.ts` - Pre-defined themes (dark, light, high-contrast)
     - `types.ts` - Theme type definitions
   - `privacy/` - Privacy analysis and scoring
     - `analyzer.ts` - Privacy risk scoring engine
     - `metadata.ts` - Document metadata extraction
   - `queue/` - Batch processing task queue
     - `TaskQueue.ts` - Concurrent task processing
     - `types.ts` - Queue type definitions
   - `ruler/` - Ruler and guide system
     - `guide-manager.ts` - Guide placement and snapping
   - `analytics/` - Privacy-preserving analytics
     - `aggregator.ts` - Local analytics aggregation
   - `fs/` - Cross-platform file I/O abstraction
   - `pwa/` - Service worker registration and update management
     - `register-sw.ts` - Service worker registration
     - `update-manager.ts` - SW update detection and prompts
   - `a11y/` - Accessibility utilities
   - `auth/` - Authentication (partial implementation)
     - `session.ts` - Session management
   - `cloud/` - Cloud sync (partial implementation)
     - `sync.ts` - Cloud synchronization
   - `crypto/` - Encryption utilities (partial implementation)
     - `encryption.ts` - Client-side encryption

2. **`src/ui/`** - Vanilla TypeScript UI components
   - `App.ts` - Main orchestrator (state management, workflow coordination)
   - `components/` - Reusable UI widgets (DropZone, Toolbar, CanvasStage, etc.)

3. **`src/main.ts`** - Application entry point (wiring and initialization)

**Key principle**: Library modules have zero UI dependencies and can be tested/reused independently.

### Component Communication Pattern

```
UI Event → App.ts (state update) → lib module (processing) → App.ts (state) → UI Component (render)
```

- **Parent → Child**: Direct method calls (`component.setItems(data)`)
- **Child → Parent**: Constructor callbacks (`onChange(data)`)
- **No global state**: Each component owns its DOM and local state

### Data Flow: Complete Redaction Workflow

1. **File Loading**: DropZone → `handleFiles()` → PDF.js or Image loading → Store in `files[]`
2. **Rendering**: `loadFile(index)` → Render PDF page or image to canvas → Display in CanvasStage
3. **PII Detection** (two different paths):

   **For PDFs with text layers:**
   - Extract text using PDF.js `getTextContent()`
   - Run PII detection on extracted text
   - Find bounding boxes using PDF.js text coordinates
   - **Critical**: Convert PDF coordinates (origin bottom-left) to canvas coordinates (origin top-left)

   **For Scanned PDFs and Images (requires OCR enabled):**
   - Run Tesseract.js OCR on canvas to extract text + word-level bounding boxes
   - Run PII detection on OCR text
   - Map detected PII to OCR word bounding boxes using character position matching
   - Combine overlapping word boxes into redaction boxes
   - No coordinate conversion needed (OCR returns canvas coordinates directly)

   **Detection methods** (used for both paths):
   - **Regex patterns**: `findEmails`, `findPhones`, `findSSNs`, `findLikelyPANs`
   - **ML-based NER** (if enabled): Named Entity Recognition via TensorFlow.js
   - **Hybrid merging**: Automatic deduplication and confidence-based merging

4. **Manual Editing**: Mouse events on CanvasStage for drawing/deleting boxes
5. **Export**:
   - Apply black rectangles to canvas (`ctx.fillRect()`)
   - **PDFs**: Rasterize each page to PNG, embed in fresh PDF document (no text layers)
   - **Images**: Re-encode through canvas (strips EXIF/GPS metadata)

## Document Format Abstraction Layer

**NEW**: The app now supports multiple document formats beyond PDFs and images through a pluggable format abstraction system.

### Supported Formats

| Format | Extensions | Status | Rendering | Text Extraction | Export Formats |
|--------|-----------|--------|-----------|----------------|----------------|
| **Plain Text** | `.txt`, `.md` | ✅ Implemented | DOM | Native | `.txt` |
| **CSV/TSV** | `.csv`, `.tsv` | ✅ Implemented | DOM (table) | Native | `.csv`, `.tsv`, `.pdf` |
| **PDF** | `.pdf` | ✅ Legacy | Canvas | PDF.js | `.pdf` |
| **Images** | `.png`, `.jpg`, `.webp`, etc. | ✅ Legacy | Canvas | OCR | Same format |
| **Office Docs** | `.docx`, `.xlsx`, `.pptx` | 🔮 Planned | TBD | Library-based | `.pdf` |
| **Rich Text** | `.rtf`, `.html` | 🔮 Planned | DOM | Native | `.pdf` |
| **E-books** | `.epub`, `.mobi` | 🔮 Planned | DOM/Canvas | Library-based | `.pdf` |

### Architecture Overview

The format system uses a **factory pattern with lazy loading** to minimize bundle size:

```
FormatRegistry
  ├─ detectFormat(file) → format ID
  ├─ getFormat(file) → DocumentFormat instance
  └─ Lazy imports format handlers on-demand

DocumentFormat (abstract base class)
  ├─ load(file) → Document
  ├─ render(doc, container) → void
  ├─ extractText(doc) → TextExtractionResult
  ├─ findTextBoxes(doc, terms) → BoundingBox[]
  ├─ redact(doc, boxes) → void
  ├─ export(doc, options) → Blob
  └─ cleanup() → void
```

### Key Files

- **`src/lib/formats/base/DocumentFormat.ts`** - Abstract base class all formats extend
- **`src/lib/formats/base/types.ts`** - Shared types (BoundingBox, Document, etc.)
- **`src/lib/formats/base/FormatRegistry.ts`** - Format detection and factory
- **`src/lib/formats/text/PlainTextFormat.ts`** - Text/Markdown implementation
- **`src/lib/formats/structured/CsvFormat.ts`** - CSV/TSV implementation

### Format-Specific Quirks

#### Plain Text (.txt, .md)
- **Rendering**: DOM-based with line numbers and monospace font
- **Coordinates**: Line-based (x = char position * char width, y = line index * line height)
- **Redaction**: Replaces text with block characters (`█`)
- **Export**: Plain text with redactions applied
- **No flattening needed** (text format is inherently secure after replacement)

#### CSV/TSV
- **Rendering**: HTML table with sticky headers
- **Coordinates**: Cell-based (row, column indices)
- **Detection**: Whole-cell matching (if any term found, entire cell is redacted)
- **Redaction**: Replaces cell content with block characters
- **Special features**:
  - `redactColumn(columnName)` - Redact entire column by header name
  - Auto-detects headers using heuristics
- **Export**: CSV with redactions applied (uses PapaParse for proper escaping)

#### PDFs and Images (Legacy)
These formats still use the original pipeline (`src/lib/pdf/` and `src/lib/images/`) but will eventually be migrated to the format abstraction system.

### Usage Pattern

```typescript
// Automatic format detection
const format = await FormatRegistry.getFormat(file);

// Load document
const doc = await format.load(file);

// Render to container
await format.render(doc, { container: element });

// Extract text for PII detection
const { fullText } = await format.extractText(doc);

// Run PII detection
const terms = detectAllPII(fullText);

// Find bounding boxes
const boxes = await format.findTextBoxes(doc, terms);

// Apply redactions
await format.redact(doc, boxes);

// Export redacted document
const blob = await format.export(doc);

// Cleanup
format.cleanup();
```

### Adding New Format Handlers

See `docs/FORMAT_HANDLER_GUIDE.md` for step-by-step instructions. Key steps:

1. **Create format class** extending `DocumentFormat`
2. **Implement required methods**: `load`, `render`, `extractText`, `findTextBoxes`, `redact`, `export`, `cleanup`
3. **Register in FormatRegistry**: Add import and registration in `FormatRegistry.initialize()`
4. **Add unit tests**: Follow pattern in `tests/unit/formats/`
5. **Update type mappings**: Add MIME types and extensions to `types.ts`

### Testing Multi-Format Files

```bash
# Run all format tests
npm test tests/unit/formats/

# Run specific format tests
npm test tests/unit/formats/text/PlainTextFormat.test.ts
npm test tests/unit/formats/structured/CsvFormat.test.ts

# Test format registry
npm test tests/unit/formats/base/FormatRegistry.test.ts
```

### Performance Considerations

- **Lazy loading**: Format handlers are only imported when first used
- **Bundle impact**: PlainTextFormat adds ~5KB, CsvFormat adds ~15KB (includes PapaParse)
- **Memory**: Each format manages its own resources (cleanup on document close)
- **Rendering**: DOM-based formats (text, CSV) are faster than canvas-based (PDF, images)

### Coordinate System Differences

Each format has its own coordinate system for `BoundingBox`:

| Format | Coordinate System | Units | Notes |
|--------|------------------|-------|-------|
| PDF | Bottom-left origin | Points (1/72 inch) | Requires conversion to canvas coords |
| Images | Top-left origin | Pixels | Direct canvas coordinates |
| Plain Text | Top-left origin | Pixels (approximate) | Char width × line height estimation |
| CSV | Cell-based | Row/Column indices | No pixel coordinates needed |

The abstraction layer handles these differences internally—callers work with a unified `BoundingBox` interface.

## Advanced Features

### History/Undo System

**Implementation**: Command pattern with history stack

The app includes a full undo/redo system for all redaction operations:

**Key files**:
- `src/lib/history/command.ts` - Command interface
- `src/lib/history/manager.ts` - HistoryManager class
- `src/lib/history/commands.ts` - Concrete commands (AddRedactionCommand, DeleteRedactionCommand, etc.)

**Usage pattern**:
```typescript
import { HistoryManager, AddRedactionCommand } from '@/lib/history';

const history = new HistoryManager({ maxSize: 50 });

// Execute command (adds to history)
const command = new AddRedactionCommand(box);
history.execute(command);

// Undo/redo
history.undo(); // Reverts last action
history.redo(); // Re-applies undone action

// Check state
history.canUndo(); // true if undo available
history.canRedo(); // true if redo available
```

**Keyboard shortcuts**:
- `Ctrl+Z` / `Cmd+Z`: Undo
- `Ctrl+Shift+Z` / `Cmd+Shift+Z`: Redo

### Layer Management

**Purpose**: Organize redactions into separate layers for complex documents

The layer system allows users to organize redactions by category (e.g., "Names", "Financial Data", "Addresses"):

**Key files**:
- `src/lib/layers/types.ts` - Layer type definitions
- `src/lib/layers/manager.ts` - LayerManager class

**Features**:
- Create/delete/rename layers
- Show/hide layers (affects rendering only, not export)
- Lock layers (prevent accidental edits)
- Merge layers
- Layer visibility does NOT affect export (all layers are flattened)

**Usage**:
```typescript
import { LayerManager } from '@/lib/layers';

const layers = new LayerManager();
const layerId = layers.createLayer('Names');
layers.addRedaction(layerId, box);
layers.setVisible(layerId, false); // Hide layer in UI
```

### Theme System

**NEW**: Runtime theme switching with multiple built-in themes

**Key files**:
- `src/lib/theme/ThemeManager.ts` - Theme manager singleton
- `src/lib/theme/themes.ts` - Pre-defined themes
- `src/lib/theme/types.ts` - Theme interfaces

**Built-in themes**:
1. **Dark** (default): Dark background, high contrast
2. **Light**: Light background for daytime use
3. **High Contrast**: WCAG AAA compliant, for accessibility

**Usage**:
```typescript
import { themeManager } from '@/lib/theme';

// Switch themes
themeManager.setTheme('light');
themeManager.setTheme('dark');
themeManager.setTheme('high-contrast');

// Listen to theme changes
themeManager.addListener((newTheme) => {
  console.log('Theme changed to:', newTheme.id);
});

// System preference detection
themeManager.detectSystemTheme(); // Respects prefers-color-scheme
```

**Theme persistence**: User's theme choice is saved to localStorage

### Privacy Scoring

**Purpose**: Analyze documents for privacy risks and provide scores

**Key files**:
- `src/lib/privacy/analyzer.ts` - PrivacyAnalyzer class
- `src/lib/privacy/metadata.ts` - Metadata extraction utilities

**How it works**:
1. **Metadata analysis**: Checks for author, creation date, GPS coordinates
2. **PII detection**: Counts detected sensitive data instances
3. **Risk scoring**: Calculates overall privacy score (0-100)
4. **Recommendations**: Suggests improvements (e.g., "Remove EXIF data", "Redact 3 email addresses")

**Scoring formula**:
```
Base score: 100
- Metadata present: -10 per field
- PII detected: -5 per instance (capped at -50)
- Unredacted sensitive data: -20
Final score: 0-100 (higher is better)
```

**Usage**:
```typescript
import { PrivacyAnalyzer } from '@/lib/privacy';

const analyzer = new PrivacyAnalyzer();
const analysis = analyzer.analyze(document, detectedPII, redactionBoxes);

console.log(analysis.score); // 0-100
console.log(analysis.risks); // Array of PrivacyRisk objects
console.log(analysis.recommendations); // Improvement suggestions
```

### Batch Processing

**Purpose**: Process multiple files concurrently with progress tracking

**Key files**:
- `src/lib/queue/TaskQueue.ts` - Task queue implementation
- `src/lib/queue/types.ts` - Queue types

**Features**:
- Concurrent processing (configurable worker count)
- Per-file progress tracking
- Error handling with retry logic
- Queue pause/resume
- Task prioritization

**Usage**:
```typescript
import { TaskQueue, TaskStatus } from '@/lib/queue';

const queue = new TaskQueue({
  concurrency: 3, // Process 3 files at once
  onProgress: (task, progress) => {
    console.log(`${task.file.name}: ${progress}%`);
  },
  onComplete: (task, result) => {
    console.log(`${task.file.name} complete`);
  },
  onError: (task, error) => {
    console.error(`${task.file.name} failed:`, error);
  }
});

// Add files to queue
files.forEach(file => queue.addTask(file));

// Start processing
queue.start();
```

**UI Component**: `BatchProgressPanel` shows real-time progress for all files

### Redaction Styles

**Purpose**: Customize the appearance of redaction boxes

**Built-in styles**:
1. **Solid** (default): Solid black rectangle
2. **Pattern**: Diagonal lines or crosshatch pattern
3. **Text**: Block characters (`[REDACTED]`)

**Key files**:
- `src/lib/redact/styles.ts` - StyleRegistry
- `src/lib/redact/renderers.ts` - Style implementations

**Adding custom styles**:
```typescript
import { RedactionStyle, StyleRegistry } from '@/lib/redact';

class CustomStyle extends RedactionStyle {
  render(ctx: CanvasRenderingContext2D, box: BoundingBox): void {
    // Custom rendering logic
    ctx.fillStyle = 'blue';
    ctx.fillRect(box.x, box.y, box.width, box.height);
  }
}

StyleRegistry.register(new CustomStyle());
```

### Enhanced OCR Features

Beyond basic OCR, the app includes specialized detection capabilities:

**Table detection** (`src/lib/ocr/table-detector.ts`):
- Automatically detects table structures in scanned documents
- Identifies rows, columns, and cells
- Enables cell-level redaction

**Form detection** (`src/lib/ocr/form-detector.ts`):
- Recognizes common form templates (W-2, 1099, invoices)
- Pre-defined field mappings for auto-redaction
- Customizable form templates

**Column-based rules** (`src/lib/ocr/column-rules.ts`):
- Redact entire columns by header name (e.g., "SSN", "Salary")
- Pattern-based column detection

**Usage**:
```typescript
import { detectTables, detectFormType } from '@/lib/ocr';

const tables = await detectTables(canvas);
const formType = detectFormType(ocrText); // Returns 'w2' | '1099' | null

if (formType === 'w2') {
  // Apply W-2 specific redaction rules
}
```

### International Pattern Libraries

The app now supports **7 regional pattern libraries** covering 40+ countries:

**Coverage**:
- **US**: SSN, EIN, driver's license
- **Europe**: IBAN, VAT numbers, national IDs (UK NIN, German Tax ID, French NIR)
- **Asia**: Aadhaar (India), MyKad (Malaysia), NRIC (Singapore), etc.
- **Latin America**: CPF/CNPJ (Brazil), CURP/RFC (Mexico), RUT (Chile)
- **Financial**: SWIFT/BIC, routing numbers, CLABE
- **Investment**: CUSIP, ISIN, SEDOL, ticker symbols
- **Crypto**: Bitcoin, Ethereum, Litecoin, Monero addresses

**Key files**:
- `src/lib/detect/patterns-european.ts`
- `src/lib/detect/patterns-asian.ts`
- `src/lib/detect/patterns-latam.ts`
- `src/lib/detect/patterns-financial.ts`
- `src/lib/detect/patterns-investment.ts`
- `src/lib/detect/patterns-crypto.ts`

**Enabling regional patterns**:
Regional patterns are opt-in via Settings panel to reduce false positives.

## Critical Implementation Details

### PDF Coordinate System Conversion

PDF.js uses bottom-left origin; HTML canvas uses top-left. When finding text boxes:

```typescript
const { x, y } = viewport.convertToViewportPoint(e, f); // e, f from transform matrix
const height = fontHeight * viewport.scale;
const finalY = y - height; // Convert baseline to top-left corner
```

This is implemented in `src/lib/pdf/find.ts:findTextBoxes()`. Incorrect conversion causes misaligned redaction boxes.

### OCR for Scanned Documents and Images

**When to use OCR:**
- Scanned PDFs (documents without embedded text layers)
- Images containing text (screenshots, photos of documents)
- Enable via "Use OCR (scanned docs)" checkbox in the toolbar

**Implementation:**

The app uses **Tesseract.js** for OCR, which runs entirely in the browser (no server communication).

**Key files:**
- `src/lib/pdf/ocr.ts` - Basic OCR wrapper for PDFs (text-only)
- `src/lib/images/ocr.ts` - Enhanced OCR wrapper returning text + word bounding boxes
- `src/lib/ocr/mapper.ts` - Maps detected PII to OCR word coordinates
- `src/ui/App.ts:analyzeImageDetections()` - OCR detection pipeline for images

**How it works:**

1. **OCR Execution**: `ocrImageCanvas(canvas)` runs Tesseract on the canvas
2. **Result**: Returns `{ text: string, words: OCRWord[] }`
   - Each `OCRWord` contains: `{ text, bbox: { x, y, width, height }, confidence }`
3. **PII Detection**: Run regex/ML detection on OCR text
4. **Coordinate Mapping**: `mapPIIToOCRBoxes()` maps detected PII to word bounding boxes:
   - Build character position map from OCR words
   - For each detected PII term, find character positions in full text
   - Find OCR words that overlap those positions
   - Combine word bounding boxes into single redaction box
5. **Expansion**: Add 4px padding to ensure complete coverage

**Auto-detection for scanned PDFs:**
- App automatically detects scanned PDFs (pages with <10 characters)
- Shows toast: "Scanned PDF detected. Enable 'Use OCR' in the toolbar..."
- Does NOT auto-enable OCR (user choice, as Tesseract is ~10MB download)

**Performance notes:**
- First run: Downloads Tesseract (~10MB) and language data
- Subsequent runs: Loads from browser cache (~2s)
- OCR speed: ~5-10s per page (depends on image resolution and text density)
- Memory: Tesseract worker is created/terminated per operation

### Security: Why Black Boxes + Flattening

**Never use blur or pixelation**—these are reversible via deconvolution attacks (documented in PoPETs research).

Our approach:
1. **Opaque black rectangles** (`fillStyle = '#000'`, no transparency)
2. **Flattening**:
   - PDFs: Rasterize pages to PNG, embed in new PDF (no selectable text or hidden layers)
   - Images: Re-encode through canvas (automatically strips EXIF/GPS)

Code: `src/lib/pdf/redact.ts` and `src/lib/images/redact.ts`

### PWA Build Pipeline

```bash
npm run build
  ├─ vite build          # TypeScript → bundled JS/CSS with asset hashing
  └─ node workbox.config.mjs  # Generate service worker with precaching
```

**Workbox configuration** (`workbox.config.mjs`):
- **Precaching**: All HTML/JS/CSS/icons matched by glob pattern (offline-first app shell)
- **Runtime caching**:
  - Images: CacheFirst strategy (7-day expiration, 60 entries max)
  - Fonts: CacheFirst strategy (1-year expiration, 10 entries max)
  - PDF.js worker: CacheFirst strategy (30-day expiration)
  - External CDN: StaleWhileRevalidate (1-day expiration)
- **Offline fallback**: `/offline.html` for offline navigation
- **Update strategy**: `skipWaiting: true` + `clientsClaim: true` for immediate updates

The service worker is generated **after** Vite completes, ensuring cache manifest matches built assets.

**Update detection**: `src/lib/pwa/update-manager.ts` detects new SW versions and prompts users to reload.

### PDF.js Worker Configuration

The PDF.js worker file must be copied to the output directory:

- **Vite plugin** (`vite.config.ts`): `vite-plugin-static-copy` copies `pdf.worker.min.mjs` to `dist/assets/pdfjs/`
- **Worker path** (`src/lib/pdf/worker.ts`): Set `workerSrc` to `/assets/pdfjs/pdf.worker.min.mjs`

If the worker path is incorrect, PDF rendering will fail silently or throw CORS errors.

### ML-Based PII Detection

**Optional Enhancement**: The app includes AI-powered Named Entity Recognition (NER) for improved accuracy.

#### Architecture

```
detectAllPII()
  ├─ Regex Detection (patterns.ts)
  │  └─ Returns: emails, phones, SSNs, cards
  ├─ ML Detection (ml.ts) [if enabled]
  │  └─ Returns: person names, organizations, locations
  └─ Merge Results (merger.ts)
     └─ Deduplicate, prefer higher confidence
```

#### Implementation Details

- **Library**: `@xenova/transformers` (~500KB bundled)
- **Model**: `Xenova/bert-base-NER` (~110MB, downloaded on-demand)
- **Caching**: Browser cache (persistent across sessions via IndexedDB)
- **Performance**: ~100-200ms inference per page on modern hardware
- **Privacy**: Model runs 100% in browser (no server communication)

**Key files**:
- `src/lib/detect/ml.ts` - TensorFlow.js model loading and inference
- `src/lib/detect/merger.ts` - Deduplication logic
- `src/ui/components/Settings.ts` - Settings modal for ML toggle
- `docs/ML_DETECTION.md` - Detailed ML architecture documentation

#### Detection Merging Strategy

When both regex and ML detect the same entity:
1. **Prefer higher confidence** (regex = 1.0, ML = variable 0.0-1.0)
2. **Expand boxes** to include both if partially overlapping
3. **Keep both** if different types (e.g., ML found name, regex found email)

Example merge:
```typescript
Regex: "john@example.com" (confidence: 1.0)
ML:    "John Doe" (confidence: 0.95)
Result: Both kept (different entities)

Regex: "John" (confidence: 1.0, positions: 0-4)
ML:    "John Doe" (confidence: 0.95, positions: 0-8)
Result: "John" kept (higher confidence, overlapping position)
```

#### User Experience

- **Default**: ML detection disabled (opt-in)
- **First use**: User clicks Settings → Enable ML → Downloads model (~110MB)
- **Subsequent use**: Model loads from cache (~2s)
- **UI indicator**: Model status shown in Settings modal
- **Fallback**: Always works with regex-only if ML disabled/unavailable

#### Testing ML Features

```bash
# Unit tests (merger logic only - fast)
npm test tests/unit/merger.test.ts

# Proof of concept (loads actual model - slow)
npm run dev
# Navigate to http://localhost:5173/tests/ml-poc.html
```

**Note**: Full ML integration tests are omitted due to model download time (~30s) and size. Manual testing via PoC page recommended.

## Testing Strategy

### Current Coverage

**Core Detection:**
- **`tests/unit/luhn.test.ts`**: Luhn algorithm for credit card validation
- **`tests/unit/patterns.test.ts`**: PII regex detection (emails, phones, SSNs, cards)
- **`tests/unit/merger.test.ts`**: ML/regex result merging and deduplication
- **`tests/unit/validation.test.ts`**: Pattern validation utilities
- **`tests/unit/validators-financial.test.ts`**: Financial pattern validators
- **`tests/unit/validators-international.test.ts`**: International ID validators

**Format Handlers:**
- **`tests/unit/formats/base/FormatRegistry.test.ts`**: Format detection and factory
- **`tests/unit/formats/text/PlainTextFormat.test.ts`**: Plain text handler (42 tests)
- **`tests/unit/formats/structured/CsvFormat.test.ts`**: CSV/TSV handler (38 tests)

**Advanced Features:**
- **`tests/unit/history.test.ts`**: Undo/redo system
- **`tests/unit/layers.test.ts`**: Layer management
- **`tests/unit/table-detector.test.ts`**: OCR table detection
- **`tests/unit/form-detector.test.ts`**: OCR form detection
- **`tests/unit/coordinates.test.ts`**: PDF coordinate conversion
- **`tests/unit/analytics.test.ts`**: Privacy-preserving analytics
- **`tests/unit/encryption.test.ts`**: Client-side encryption

**Integration Tests:**
- **`tests/integration/app-formats.test.ts`**: End-to-end format processing workflows

### Testing Philosophy

- **Unit tests**: Pure functions in `src/lib/` (no DOM dependencies)
- **Test data**: Known-valid samples (e.g., test credit card numbers from payment processor docs)
- **Edge cases**: Empty strings, invalid formats, boundary conditions
- **Isolation**: Each test is independent (no shared state)
- **Fast feedback**: Unit tests complete in <100ms each

### Testing Best Practices for Format Handlers

#### Test Structure

Follow the AAA pattern (Arrange, Act, Assert):

```typescript
describe('MyFormat', () => {
  let format: MyFormat;

  beforeEach(() => {
    format = new MyFormat(); // Arrange: Fresh instance per test
  });

  it('should load a valid file', async () => {
    // Arrange
    const file = new File(['content'], 'test.myext', { type: 'application/x-myformat' });

    // Act
    const doc = await format.load(file);

    // Assert
    expect(doc.metadata.fileName).toBe('test.myext');
    expect(doc.metadata.format).toBe('myformat');
  });
});
```

#### Required Test Categories

Every format handler must test:

1. **Constructor & Metadata**
   - Format ID, name, extensions, MIME types
   - Capabilities declaration
   - `canHandle()` method

2. **Loading**
   - Valid files
   - Empty files
   - Corrupted files (should throw)
   - Large files (performance test)

3. **Text Extraction**
   - Full text extraction
   - Page/section-specific extraction (if applicable)
   - Character position mapping (if applicable)

4. **Text Box Finding**
   - Single occurrence
   - Multiple occurrences
   - Multiple occurrences per line
   - Case insensitivity
   - Empty terms handling
   - Original case preservation

5. **Redaction**
   - Basic redaction
   - Multiple boxes
   - Overlapping boxes
   - Modified flag set correctly

6. **Export**
   - Blob type and size
   - Redactions applied
   - No recoverable data

7. **Cleanup**
   - No errors thrown
   - Resources released

#### Example Test Suite

```typescript
describe('TextFormat', () => {
  let format: TextFormat;

  beforeEach(() => {
    format = new TextFormat();
  });

  // Category 1: Constructor & Metadata
  describe('constructor', () => {
    it('should have correct format metadata', () => {
      expect(format.formatId).toBe('txt');
      expect(format.supportedExtensions).toContain('txt');
    });
  });

  // Category 2: Loading
  describe('load', () => {
    it('should load valid file', async () => { /* ... */ });
    it('should handle empty file', async () => { /* ... */ });
  });

  // Category 3: Text Extraction
  describe('extractText', () => {
    it('should extract full text', async () => { /* ... */ });
  });

  // Category 4: Text Box Finding
  describe('findTextBoxes', () => {
    it('should find single occurrence', async () => { /* ... */ });
    it('should be case-insensitive', async () => { /* ... */ });
    it('should preserve original case', async () => { /* ... */ });
  });

  // Category 5: Redaction
  describe('redact', () => {
    it('should apply redactions', async () => { /* ... */ });
    it('should mark as modified', async () => { /* ... */ });
  });

  // Category 6: Export
  describe('export', () => {
    it('should export as blob', async () => { /* ... */ });
    it('should include redactions', async () => { /* ... */ });
  });

  // Category 7: Cleanup
  describe('cleanup', () => {
    it('should not throw', () => { /* ... */ });
  });
});
```

#### Test Data Helpers

Create reusable test data:

```typescript
// tests/fixtures/formats.ts
export const TEST_FILES = {
  plainText: () => new File(['Hello World\nTest'], 'test.txt', { type: 'text/plain' }),
  csv: () => new File(['name,email\nJohn,john@test.com'], 'test.csv', { type: 'text/csv' }),
  empty: () => new File([''], 'empty.txt', { type: 'text/plain' })
};

export const TEST_PII = {
  email: 'test@example.com',
  phone: '+14155552671',
  ssn: '123-45-6789'
};
```

Usage:
```typescript
it('should detect emails', async () => {
  const file = TEST_FILES.plainText();
  const doc = await format.load(file);
  const boxes = await format.findTextBoxes(doc, [TEST_PII.email]);
  expect(boxes).toHaveLength(1);
});
```

#### Snapshot Testing

For complex output, use snapshots:

```typescript
it('should render correct HTML structure', async () => {
  const file = new File(['test'], 'test.txt');
  const doc = await format.load(file);

  const container = document.createElement('div');
  await format.render(doc, { container });

  expect(container.innerHTML).toMatchSnapshot();
});
```

#### Performance Testing

For large files:

```typescript
it('should load large files within 1 second', async () => {
  const largeContent = 'line\n'.repeat(10000);
  const file = new File([largeContent], 'large.txt');

  const start = performance.now();
  await format.load(file);
  const duration = performance.now() - start;

  expect(duration).toBeLessThan(1000);
});
```

#### Mock File Helpers

For testing without real files:

```typescript
function createMockFile(content: string, name: string, mimeType?: string): File {
  return new File([content], name, { type: mimeType || '' });
}

function createMockBlob(content: string, mimeType: string): Blob {
  return new Blob([content], { type: mimeType });
}
```

### Running Specific Tests

```bash
# Single file
npx vitest tests/unit/luhn.test.ts

# By test name pattern
npx vitest -t "should validate"

# By directory
npx vitest tests/unit/formats/

# Watch mode (re-run on file change)
npx vitest tests/unit/formats/ --watch

# UI mode (visual test runner)
npm run test:ui
```

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report
open coverage/index.html

# Check specific file coverage
npx vitest --coverage --coverage.include=src/lib/formats/text/PlainTextFormat.ts
```

### Coverage Requirements

- **Minimum**: 80% line coverage for new code
- **Target**: 90%+ line coverage
- **Critical paths**: 100% coverage (load, redact, export methods)

### Debugging Tests

```bash
# Run single test with console output
npx vitest -t "should load valid file" --reporter=verbose

# Debug with Node inspector
node --inspect-brk ./node_modules/.bin/vitest tests/unit/formats/text/PlainTextFormat.test.ts
```

### Continuous Integration

Tests run automatically on:
- Every commit (pre-commit hook)
- Pull requests (GitHub Actions)
- Main branch merges

CI requirements:
- ✅ All tests pass
- ✅ Coverage ≥80%
- ✅ No new lint errors

## Key Dependencies

- **pdfjs-dist** (^4.8.69): PDF rendering and text extraction (Mozilla's PDF.js)
- **pdf-lib** (^1.17.1): PDF document creation (used for exporting rasterized pages)
- **tesseract.js** (^5.1.1): Optional OCR for scanned documents (loaded on-demand)
- **@xenova/transformers** (^2.17.2): ML-based Named Entity Recognition via TensorFlow.js/ONNX Runtime
- **papaparse** (^5.5.3): CSV/TSV parsing and generation
- **browser-fs-access** (^0.35.0): File System Access API with download fallback
- **workbox-build** (^7.1.1): Service worker generation for PWA capabilities
- **vite** (^5.4.11): Fast build tool with ESM support
- **vitest** (^2.1.5): Unit testing framework

## Common Development Tasks

### Adding a New PII Pattern

1. Add detection function to `src/lib/detect/patterns.ts`:
   ```typescript
   export function findNewPattern(text: string): string[] {
     const regex = /your-pattern-here/gi;
     return Array.from(text.matchAll(regex), m => m[0]);
   }
   ```
2. Add unit tests to `tests/unit/patterns.test.ts`
3. Integrate in `App.ts:detectPII()` method
4. Add toggle to `Toolbar` component

### Modifying PDF Processing Pipeline

The pipeline is split across `src/lib/pdf/`:
- `load.ts` - Load PDF documents
- `find.ts` - Extract text and find bounding boxes (coordinate conversion here!)
- `redact.ts` - Apply black boxes to canvas
- `export.ts` - Generate new PDF with rasterized pages

Each module exports async functions that can be tested independently.

### Debugging PDF Coordinate Issues

If redaction boxes are misaligned:
1. Check `viewport.scale` value (should be ≥2 for quality)
2. Verify transform matrix extraction in `findTextBoxes()`
3. Log PDF coordinates vs canvas coordinates
4. Test with `expandBoxes()` padding adjustment (default: 4px)
5. Use `src/lib/pdf/coordinates.ts` utilities for conversion

### Adding a New Theme

1. Create theme definition in `src/lib/theme/themes.ts`:
   ```typescript
   export const MY_THEME: Theme = {
     id: 'my-theme',
     name: 'My Theme',
     variables: {
       '--bg-primary': '#000000',
       '--text-primary': '#ffffff',
       // ... other variables
     }
   };
   ```
2. Register in `DEFAULT_THEMES` array
3. Theme will appear in Settings panel automatically

### Implementing a New Command (for Undo/Redo)

1. Create command class in `src/lib/history/commands.ts`:
   ```typescript
   export class MyCommand implements Command {
     execute(): void {
       // Forward operation
     }

     undo(): void {
       // Reverse operation
     }

     getDescription(): string {
       return 'My operation';
     }
   }
   ```
2. Use in `App.ts`:
   ```typescript
   const command = new MyCommand(args);
   this.history.execute(command);
   ```

### Adding a New Redaction Style

1. Create renderer in `src/lib/redact/renderers/`:
   ```typescript
   export class MyStyle extends RedactionStyle {
     id = 'my-style';
     name = 'My Style';

     render(ctx: CanvasRenderingContext2D, box: BoundingBox): void {
       // Custom rendering
     }
   }
   ```
2. Register in `src/lib/redact/index.ts`:
   ```typescript
   StyleRegistry.register(new MyStyle());
   ```
3. Style will appear in StylePicker automatically

### Adding a New Regional Pattern Library

1. Create file `src/lib/detect/patterns-region.ts`:
   ```typescript
   export const REGION_PATTERN = /your-pattern/gi;

   export function findRegionData(text: string): string[] {
     return Array.from(text.matchAll(REGION_PATTERN), m => m[0]);
   }
   ```
2. Add validation if needed in `src/lib/detect/validation.ts`
3. Create tests in `tests/unit/patterns-region.test.ts`
4. Integrate in detection pipeline (see `patterns.ts:detectAllPIIWithMetadata()`)
5. Add UI toggle in Settings panel

### Implementing Batch Processing

The TaskQueue is already set up. To use it:

```typescript
import { TaskQueue } from '@/lib/queue';

const queue = new TaskQueue({
  concurrency: 3,
  onProgress: (task, progress) => updateUI(task.id, progress),
  onComplete: (task, result) => handleSuccess(task, result),
  onError: (task, error) => handleError(task, error)
});

files.forEach(file => {
  queue.addTask({
    id: generateId(),
    file,
    processor: async (file, updateProgress) => {
      // Your processing logic
      updateProgress(50);
      const result = await processFile(file);
      updateProgress(100);
      return result;
    }
  });
});

queue.start();
```

### Working with Service Worker

During development, the SW is not generated (uses Vite's dev server). To test PWA features:

```bash
npm run build        # Build with SW generation
npm run preview      # Serve production build
```

To clear cached SW: Open DevTools → Application → Service Workers → Unregister

## Repository Structure

```
/
├── src/
│   ├── lib/                  # Core business logic (no UI)
│   │   ├── detect/           # PII patterns and validation
│   │   │   ├── patterns.ts   # Core US patterns
│   │   │   ├── patterns-european.ts  # EU patterns
│   │   │   ├── patterns-asian.ts     # Asian patterns
│   │   │   ├── patterns-latam.ts     # Latin American patterns
│   │   │   ├── patterns-financial.ts # Banking patterns
│   │   │   ├── patterns-investment.ts # Investment data
│   │   │   ├── patterns-crypto.ts    # Cryptocurrency patterns
│   │   │   ├── ml.ts         # TensorFlow.js NER
│   │   │   ├── merger.ts     # Result merging
│   │   │   ├── hybrid.ts     # Hybrid detection
│   │   │   ├── luhn.ts       # Luhn algorithm
│   │   │   ├── validation.ts # Validation utilities
│   │   │   └── types.ts      # Detection types
│   │   ├── formats/          # Document format abstraction layer
│   │   │   ├── base/         # Base classes and shared types
│   │   │   │   ├── DocumentFormat.ts  # Abstract base class
│   │   │   │   ├── types.ts           # Shared interfaces
│   │   │   │   └── FormatRegistry.ts  # Format detection factory
│   │   │   ├── text/         # Plain text format handlers
│   │   │   │   └── PlainTextFormat.ts
│   │   │   └── structured/   # Structured data handlers
│   │   │       └── CsvFormat.ts
│   │   ├── pdf/              # PDF processing pipeline
│   │   │   ├── worker.ts     # PDF.js worker configuration
│   │   │   ├── load.ts       # Load PDF documents
│   │   │   ├── find.ts       # Text extraction and box finding
│   │   │   ├── redact.ts     # Apply black boxes
│   │   │   ├── export.ts     # Generate new PDF
│   │   │   ├── ocr.ts        # Tesseract.js integration
│   │   │   ├── coordinates.ts # Coordinate conversion
│   │   │   └── sanitize.ts   # Metadata sanitization
│   │   ├── images/           # Image processing
│   │   │   ├── exif.ts       # EXIF metadata removal
│   │   │   ├── redact.ts     # Apply boxes and export
│   │   │   └── ocr.ts        # OCR with word bounding boxes
│   │   ├── ocr/              # Enhanced OCR utilities
│   │   │   ├── mapper.ts     # PII-to-OCR coordinate mapping
│   │   │   ├── enhanced-ocr.ts # Enhanced OCR preprocessing
│   │   │   ├── table-detector.ts # Table structure detection
│   │   │   ├── form-detector.ts # Form template recognition
│   │   │   ├── column-rules.ts # Column-based redaction
│   │   │   └── form-templates.ts # Pre-defined form templates
│   │   ├── history/          # Undo/redo system
│   │   │   ├── command.ts    # Command interface
│   │   │   ├── manager.ts    # History manager
│   │   │   └── commands.ts   # Concrete commands
│   │   ├── layers/           # Layer management
│   │   │   ├── types.ts      # Layer types
│   │   │   └── manager.ts    # Layer manager
│   │   ├── redact/           # Redaction styles
│   │   │   ├── styles.ts     # Style registry
│   │   │   ├── renderers.ts  # Style implementations
│   │   │   └── types.ts      # Redaction types
│   │   ├── theme/            # Theme system
│   │   │   ├── ThemeManager.ts # Theme manager
│   │   │   ├── themes.ts     # Built-in themes
│   │   │   └── types.ts      # Theme types
│   │   ├── privacy/          # Privacy analysis
│   │   │   ├── analyzer.ts   # Privacy scoring
│   │   │   ├── metadata.ts   # Metadata extraction
│   │   │   └── types.ts      # Privacy types
│   │   ├── queue/            # Batch processing
│   │   │   ├── TaskQueue.ts  # Task queue
│   │   │   └── types.ts      # Queue types
│   │   ├── ruler/            # Ruler/guide system
│   │   │   ├── guide-manager.ts # Guide management
│   │   │   └── types.ts      # Ruler types
│   │   ├── analytics/        # Privacy-preserving analytics
│   │   │   ├── aggregator.ts # Analytics aggregation
│   │   │   └── types.ts      # Analytics types
│   │   ├── pwa/              # PWA features
│   │   │   ├── register-sw.ts # Service worker registration
│   │   │   └── update-manager.ts # Update detection
│   │   ├── fs/
│   │   │   └── io.ts         # File I/O (browser-fs-access)
│   │   ├── a11y/             # Accessibility utilities
│   │   ├── auth/             # Authentication (partial)
│   │   │   └── session.ts    # Session management
│   │   ├── cloud/            # Cloud sync (partial)
│   │   │   └── sync.ts       # Cloud synchronization
│   │   └── crypto/           # Encryption (partial)
│   │       └── encryption.ts # Client-side encryption
│   ├── ui/
│   │   ├── App.ts            # Main orchestrator (~1925 lines)
│   │   └── components/       # UI components (36+ components)
│   │       ├── DropZone.ts   # File drop zone
│   │       ├── Toolbar.ts    # Main toolbar
│   │       ├── CanvasStage.ts # Redaction canvas
│   │       ├── Settings.ts   # Settings modal
│   │       ├── HistoryTimeline.ts # Undo/redo UI
│   │       ├── LayerPanel.ts # Layer management UI
│   │       ├── BatchProgressPanel.ts # Batch progress
│   │       ├── PrivacyPanel.ts # Privacy scoring UI
│   │       ├── StylePicker.ts # Redaction style picker
│   │       ├── UpdateNotification.ts # PWA update prompt
│   │       └── ...           # Many more components
│   ├── main.ts               # Entry point
│   └── styles.css            # Global styles
├── tests/
│   ├── unit/                 # Unit tests for lib modules
│   │   ├── formats/          # Format handler tests
│   │   │   ├── base/         # Registry and type tests
│   │   │   ├── text/         # Plain text format tests
│   │   │   └── structured/   # CSV format tests
│   │   ├── luhn.test.ts      # Luhn algorithm tests
│   │   ├── patterns.test.ts  # Pattern detection tests
│   │   ├── merger.test.ts    # Result merging tests
│   │   ├── validation.test.ts # Validation tests
│   │   ├── validators-financial.test.ts # Financial validators
│   │   ├── validators-international.test.ts # International validators
│   │   ├── history.test.ts   # History system tests
│   │   ├── layers.test.ts    # Layer management tests
│   │   ├── coordinates.test.ts # Coordinate conversion tests
│   │   ├── table-detector.test.ts # Table detection tests
│   │   ├── form-detector.test.ts # Form detection tests
│   │   ├── analytics.test.ts # Analytics tests
│   │   └── encryption.test.ts # Encryption tests
│   ├── integration/
│   │   └── app-formats.test.ts # Format integration tests
│   └── e2e.spec.ts           # End-to-end test stubs
├── docs/                     # Documentation
│   ├── FORMATS.md            # User guide for supported formats
│   ├── FORMAT_HANDLER_GUIDE.md # Developer guide for adding formats
│   ├── ML_DETECTION.md       # ML detection architecture
│   ├── ARCHITECTURE_SUMMARY.md # Architecture overview
│   ├── ARCHITECTURE_OVERVIEW.md # Detailed architecture
│   ├── ARCHITECTURE_ANALYSIS.md # Architecture analysis
│   ├── IMPLEMENTATION_ROADMAP.md # Implementation roadmap
│   ├── SECURITY.md           # Security documentation
│   ├── AUTHENTICATION.md     # Authentication docs
│   └── ...                   # Other documentation
├── public/
│   ├── icons/                # PWA icons (192x192, 512x512)
│   └── manifest.webmanifest  # PWA manifest
├── vite.config.ts            # Vite build configuration
├── workbox.config.mjs        # Service worker generation
├── vitest.config.ts          # Test runner configuration
├── tsconfig.json             # TypeScript strict mode config
├── CLAUDE.md                 # This file
└── README.md                 # User-facing documentation
```

## Known Limitations

1. **OCR performance**: Tesseract.js can be slow on high-resolution scanned PDFs (5-10s per page)
2. **Browser compatibility**: File System Access API requires Chromium-based browsers (graceful fallback to downloads)
3. **Partial implementations**:
   - `auth/` - Session management (not fully integrated)
   - `cloud/` - Cloud sync (placeholder implementation)
   - `crypto/` - Client-side encryption (basic implementation)
4. **Regional patterns**: International patterns are opt-in to avoid false positives (enable in Settings)
5. **Memory usage**: Large PDF batches (50+ files) may require page reload to clear memory
6. **Mobile support**: Touch gestures work, but desktop experience is optimized

## Accessibility

The app follows WCAG 2.2 guidelines:
- Full keyboard navigation (Tab, Enter, Space, Delete)
- ARIA labels and roles on all interactive elements
- High contrast mode support
- Reduced motion support via `prefers-reduced-motion`
- Touch targets ≥44x44px

When adding UI components, ensure keyboard accessibility and ARIA attributes are included.

## Privacy & Security Principles

1. **No server communication**: All processing is client-side JavaScript
2. **No tracking or analytics**: No third-party scripts or telemetry
3. **Metadata removal**: EXIF/GPS stripped automatically via canvas re-encoding
4. **Non-reversible redaction**: Black boxes + flattening (never blur/pixelation)
5. **No hidden data**: Exported PDFs contain only rasterized images (no text layers)

These principles are **architectural constraints**, not optional features. Any code that sends data to external servers should be rejected.

## Development Notes

### Current State (as of latest commit)

- **App.ts size**: ~1925 lines (consider refactoring into smaller modules if it grows beyond 2000)
- **Component count**: 36+ UI components
- **Detection patterns**: 19 pattern files covering 40+ countries
- **Test coverage**: Core modules have 80%+ coverage, aim for 90%+
- **Bundle size**: ~500KB gzipped (excluding ML model)

### Codebase Health

**Strengths**:
- Clean separation between lib (business logic) and UI
- Comprehensive test coverage for core features
- Modular architecture with clear extension points
- Strong TypeScript typing (strict mode)
- No external server dependencies

**Areas for improvement**:
- App.ts orchestrator is large (consider state management library or breaking into sub-orchestrators)
- Partial implementations (auth, cloud, crypto) should be completed or removed
- Some UI components lack comprehensive tests
- Documentation could be expanded for OCR features

### Performance Considerations

**Bundle optimization**:
- Lazy loading for format handlers (already implemented)
- ML model is on-demand download (~110MB, not in bundle)
- OCR (Tesseract) is on-demand (~10MB)
- Consider code splitting for regional pattern libraries

**Runtime performance**:
- PDF rendering: ~100-200ms per page (hardware-dependent)
- PII detection: ~50-100ms per page
- OCR: ~5-10s per page (Tesseract)
- ML inference: ~100-200ms per page

**Memory management**:
- Large PDF batches (50+) may cause memory pressure
- Consider implementing page-by-page processing with cleanup
- Service Worker cache has size limits (check QuotaExceededError)

### Common Pitfalls

1. **PDF coordinates**: Always use conversion utilities in `src/lib/pdf/coordinates.ts`
2. **OCR context**: OCR runs in Web Worker, avoid large data transfers
3. **History stack**: Limit to 50 operations to prevent memory issues
4. **Layer visibility**: Remember that hidden layers still export
5. **Theme variables**: Use CSS variables, not hardcoded colors
6. **File System API**: Always provide fallback for non-Chromium browsers

### Debugging Tips

**Enable verbose logging**:
```typescript
// In App.ts
const DEBUG = true;
if (DEBUG) console.log('State:', this.state);
```

**Test with sample files**:
- PDFs: Use multi-page documents with text and images
- Scanned PDFs: Use actual scans, not digital PDFs saved as images
- CSV: Test with quoted fields, commas in data, Unicode
- Images: Test with EXIF data (phone camera photos work best)

**Performance profiling**:
```typescript
console.time('operation');
await someOperation();
console.timeEnd('operation');
```

### Migration Guide (for major changes)

If migrating PDFs/Images to the format abstraction layer:

1. Create `src/lib/formats/pdf/PdfFormat.ts` extending `DocumentFormat`
2. Move logic from `src/lib/pdf/*` into format handler methods
3. Update `FormatRegistry` to detect PDF MIME type
4. Update `App.ts` to use format handler instead of direct imports
5. Update tests to use new format handler
6. Deprecate old PDF pipeline after testing

### Contributing Guidelines

When adding new features:

1. **Start with lib module**: Implement business logic first (no UI)
2. **Add tests**: Aim for 80%+ coverage before UI work
3. **Create UI component**: Keep components small (<300 lines)
4. **Update App.ts**: Wire new component into orchestrator
5. **Document**: Update CLAUDE.md with new feature details
6. **Test manually**: Use real-world files, not just synthetic data

### Feature Flags

For experimental features, use feature flags in Settings:

```typescript
// In Settings.ts
export interface SettingsState {
  // ... existing settings
  experimentalFeature: boolean; // Default: false
}

// In App.ts
if (this.settings.experimentalFeature) {
  // Enable new feature
}
```

### Version History

- **v1.0**: Initial release (PDFs, images, basic PII detection)
- **v1.1**: Multi-format support (text, CSV), regional patterns
- **v1.2** (current): History/undo, layers, themes, privacy scoring, batch processing
- **v1.3** (planned): Office docs, custom patterns, export audit logs

### Useful Resources

**Internal docs**:
- `docs/ARCHITECTURE_SUMMARY.md` - High-level architecture overview
- `docs/FORMAT_HANDLER_GUIDE.md` - Guide for adding new formats
- `docs/ML_DETECTION.md` - ML detection details
- `docs/SECURITY.md` - Security best practices

**External references**:
- PDF.js API: https://mozilla.github.io/pdf.js/
- Tesseract.js: https://tesseract.projectnaptha.com/
- Workbox: https://developer.chrome.com/docs/workbox/
- File System Access API: https://web.dev/file-system-access/

---

**Remember**: This is a privacy-first app. Every change should be evaluated through the lens of "does this preserve user privacy?" If a feature requires server communication, it should be opt-in and clearly documented.

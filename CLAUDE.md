# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Share-Safe Toolkit is a privacy-first Progressive Web App for redacting sensitive information from PDFs and images. **All processing happens client-side in the browser—no server uploads, no tracking, no external APIs for core functionality.**

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
     - `patterns.ts` - Regex patterns and unified detection API
     - `ml.ts` - TensorFlow.js NER model integration
     - `merger.ts` - Deduplication and confidence-based merging
     - `luhn.ts` - Credit card validation algorithm
   - `pdf/` - PDF processing pipeline (load, render, find, redact, export)
   - `images/` - Image processing and EXIF metadata removal
   - `fs/` - Cross-platform file I/O abstraction
   - `pwa/` - Service worker registration and install prompt

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
3. **PII Detection**:
   - Extract text (PDF.js `getTextContent()` or Tesseract.js OCR)
   - **Hybrid detection** (regex + optional ML):
     - Regex patterns: `findEmails`, `findPhones`, `findSSNs`, `findLikelyPANs`
     - ML-based NER (if enabled): Named Entity Recognition via TensorFlow.js
     - Automatic deduplication and confidence-based merging
   - Find bounding boxes using PDF.js text coordinates
   - **Critical**: Convert PDF coordinates (origin bottom-left) to canvas coordinates (origin top-left)
4. **Manual Editing**: Mouse events on CanvasStage for drawing/deleting boxes
5. **Export**:
   - Apply black rectangles to canvas (`ctx.fillRect()`)
   - **PDFs**: Rasterize each page to PNG, embed in fresh PDF document (no text layers)
   - **Images**: Re-encode through canvas (strips EXIF/GPS metadata)

## Critical Implementation Details

### PDF Coordinate System Conversion

PDF.js uses bottom-left origin; HTML canvas uses top-left. When finding text boxes:

```typescript
const { x, y } = viewport.convertToViewportPoint(e, f); // e, f from transform matrix
const height = fontHeight * viewport.scale;
const finalY = y - height; // Convert baseline to top-left corner
```

This is implemented in `src/lib/pdf/find.ts:findTextBoxes()`. Incorrect conversion causes misaligned redaction boxes.

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
- **Runtime caching**: Images use CacheFirst strategy (7-day expiration, 60 entries max)
- **Update strategy**: `skipWaiting: true` + `clientsClaim: true` for immediate updates

The service worker is generated **after** Vite completes, ensuring cache manifest matches built assets.

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

- **`tests/unit/luhn.test.ts`**: Luhn algorithm for credit card validation
- **`tests/unit/patterns.test.ts`**: PII regex detection (emails, phones, SSNs, cards)
- **`tests/unit/merger.test.ts`**: ML/regex result merging and deduplication

### Testing Philosophy

- **Unit tests**: Pure functions in `src/lib/` (no DOM dependencies)
- **Test data**: Known-valid samples (e.g., test credit card numbers from payment processor docs)
- **Edge cases**: Empty strings, invalid formats, boundary conditions

### Running Specific Tests

```bash
npx vitest tests/unit/luhn.test.ts      # Single file
npx vitest -t "should validate"         # By test name pattern
```

### Coverage Reports

```bash
npm run test:coverage  # Generates coverage/ directory with HTML report
open coverage/index.html
```

## Key Dependencies

- **pdfjs-dist**: PDF rendering and text extraction (Mozilla's PDF.js)
- **pdf-lib**: PDF document creation (used for exporting rasterized pages)
- **tesseract.js**: Optional OCR for scanned documents (loaded on-demand)
- **@xenova/transformers**: ML-based Named Entity Recognition via TensorFlow.js/ONNX Runtime
- **browser-fs-access**: File System Access API with download fallback
- **workbox-build**: Service worker generation for PWA capabilities

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
│   │   │   ├── patterns.ts   # Regex-based detection
│   │   │   └── luhn.ts       # Credit card Luhn algorithm
│   │   ├── pdf/              # PDF processing pipeline
│   │   │   ├── worker.ts     # PDF.js worker configuration
│   │   │   ├── load.ts       # Load PDF documents
│   │   │   ├── find.ts       # Text extraction and box finding
│   │   │   ├── redact.ts     # Apply black boxes
│   │   │   ├── export.ts     # Generate new PDF
│   │   │   └── ocr.ts        # Tesseract.js integration
│   │   ├── images/           # Image processing
│   │   │   ├── exif.ts       # EXIF metadata removal
│   │   │   └── redact.ts     # Apply boxes and export
│   │   ├── fs/
│   │   │   └── io.ts         # File I/O (browser-fs-access)
│   │   └── pwa/
│   │       └── register-sw.ts # Service worker registration
│   ├── ui/
│   │   ├── App.ts            # Main orchestrator component
│   │   └── components/       # UI components (DropZone, Toolbar, etc.)
│   ├── main.ts               # Entry point
│   └── styles.css            # Global styles
├── tests/
│   ├── unit/                 # Unit tests for lib modules
│   └── e2e.spec.ts           # End-to-end test stubs
├── public/
│   ├── icons/                # PWA icons (192x192, 512x512)
│   └── manifest.webmanifest  # PWA manifest
├── vite.config.ts            # Vite build configuration
├── workbox.config.mjs        # Service worker generation
├── vitest.config.ts          # Test runner configuration
└── tsconfig.json             # TypeScript strict mode config
```

## Known Limitations

1. **Multi-page redaction tracking**: Manual boxes currently apply to single page only (auto-detected boxes work across pages)
2. **OCR performance**: Tesseract.js can be slow on high-resolution scanned PDFs
3. **US-centric patterns**: SSN format and phone validation optimized for US formats
4. **Browser compatibility**: File System Access API requires Chromium-based browsers (graceful fallback to downloads)

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

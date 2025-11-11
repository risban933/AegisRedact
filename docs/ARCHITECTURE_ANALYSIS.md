# AegisRedact Codebase Architecture Analysis

## 1. UI COMPONENT SYSTEM ARCHITECTURE

### Component Pattern
- **Component Model**: Custom Vanilla TypeScript with constructor callbacks
- **Pattern**: Each component owns its DOM and local state
- **Communication**: Parent → Child (method calls), Child → Parent (callbacks)
- **Key Characteristic**: No global state; all communication explicit

### Component Hierarchy

```
App (Main orchestrator - 1600+ lines)
├── LandingPageEnhanced (Landing screen with animations)
├── Sidebar
│   ├── Toolbar (Detection toggles, export button)
│   ├── FileList (File selection with pagination)
│   └── RedactionList (Detection display with filters)
├── Main Area
│   ├── DropZone (File upload interface)
│   ├── CanvasStage (Rendering + manual drawing)
│   │   ├── Canvas (drawing surface)
│   │   ├── Zoom controls
│   │   └── Page navigation
│   └── TextViewer (For text/CSV documents)
├── PdfViewer (PDF preview modal)
├── Settings (Modal for ML toggle)
├── MLDownloadPrompt (First-run ML onboarding)
├── Toast (Notification system)
└── Auth Components
    ├── AuthModal
    └── UserMenu

```

### Component Communication Pattern

```
UI Event → App.ts (state update) 
  → lib module (processing) 
  → App.ts (updates state) 
  → Component.setItems(data) 
  → Component renders
```

### Key App Properties
- `files[]` - Loaded file items with metadata
- `currentFileIndex` - Active file
- `pageBoxes: Map<page, Box[]>` - Redaction boxes per page
- `documentDetections: RedactionItem[]` - All detected items
- `autoDetectionsByPage: Map<page, RedactionItem[]>` - Auto-detected only
- `manualBoxesByPage: Map<page, Box[]>` - User-drawn boxes

### State Management Pattern
- **No Redux/MobX**: Direct property assignment
- **Event Synchronization**: Change callbacks propagate state updates
- **Page State**: Tracked separately per page with Maps
- **Mixed Auto/Manual**: Two distinct tracking streams merged on export

---

## 2. THEME & STYLING SYSTEM

### Current Approach

#### CSS Variable System (`:root`)
```css
--bg-primary: #0b1020        /* Dark navy background */
--bg-secondary: #1a1f35      /* Slightly lighter navy */
--bg-tertiary: #252b42       /* Card/element background */
--text-primary: #e1e4ed      /* Main text */
--text-secondary: #9ca3b8    /* Secondary text */
--accent-blue: #4a90e2       /* Primary action color */
--accent-red: #e74c3c        /* Destructive/error */
--accent-green: #2ecc71      /* Success */
--border-color: #2d3448      /* Border outlines */
```

#### Style Architecture
```
styles.css (main orchestrator)
├── @import animations.css
├── @import modern.css
├── @import landing-enhanced.css
└── @import immersive-enhancements.css
```

#### Rendering System (`src/lib/redact/styles.ts`)
```typescript
RedactionStyle (interface)
├── render(ctx, box, options)   // Preview (may use transparency)
├── export(ctx, box, options)   // Export (must be opaque)
└── getPreview()                // Thumbnail data URL

StyleRegistry (static registry)
├── register(style)
├── getDefault()
├── setDefault(id)
└── getAll()
```

#### Available Redaction Renderers
- **SolidRenderer** - Opaque black box (security-focused)
- **PatternRenderer** - Patterns (diagonal, crosshatch, dots)
- **TextRenderer** - Redacted text replacement (█████)

### Current Limitations
1. **No Dark/Light Mode Toggle**: Only dark theme exists
2. **Hardcoded in CSS**: No runtime theme switching
3. **No Custom Color Schemes**: CSS variables fixed at compile time
4. **Redaction Styles Limited**: Only 3 renderers, all visual
5. **No Theme Persistence**: No localStorage for user preferences
6. **No Accessibility Variants**: No high-contrast or reduced-motion themes

---

## 3. DETECTION PIPELINE ARCHITECTURE

### Three-Layer Detection System

```
Input Text
├─ Layer 1: Regex Patterns (src/lib/detect/patterns*.ts)
│  ├── patterns.ts (core patterns)
│  ├── patterns-financial.ts (SWIFT, routing, CLABE, IBAN)
│  ├── patterns-crypto.ts (Bitcoin, Ethereum, etc.)
│  ├── patterns-investment.ts (stocks, CUSIPs, ISINs)
│  ├── patterns-european.ts (VAT, ID numbers)
│  ├── patterns-asian.ts (Chinese ID, Aadhar, etc.)
│  └── patterns-latam.ts (CPF, CURP, RUT)
│
├─ Layer 2: ML Detection (src/lib/detect/ml.ts)
│  ├── TensorFlow.js + @xenova/transformers
│  ├── BERT-base-NER model (~110MB)
│  ├── Named Entity Recognition (Person, Org, Location)
│  └── Browser-cached model
│
└─ Layer 3: Merger & Deduplication (src/lib/detect/merger.ts)
   ├── Combine regex + ML results
   ├── Deduplicate overlapping detections
   ├── Prioritize higher confidence
   └── Return merged DetectionResult[]
```

### Detection Pipeline Flow (App.ts)

#### For PDFs with Text Layers
```
1. renderPageToCanvas(page) → Canvas + PDF.js page object
2. extractPageText(page) → Raw text string
3. shouldSuggestOCR(page) → Check if scanned (< 10 chars)
4. If NOT scanned:
   a. detectAllPIIWithMetadata(text, options) → DetectionResult[]
   b. findTextBoxes(page, viewport, filterFn) → Box[] (PDF coords)
   c. Expand boxes by 4px → Canvas coords
   d. Normalize text for matching
   e. mapBoxesToDetectionItems(boxes, detections) → RedactionItem[]
5. Store in pageBoxes, redactionList
```

#### For Scanned PDFs & Images
```
1. renderPageToCanvas(page) → Canvas with visual pixels
2. ocrImageCanvas(canvas) → OCR result {text, words: OCRWord[]}
3. detectAllPIIWithMetadata(ocrText, options) → DetectionResult[]
4. mapPIIToOCRBoxes(detections, ocrWords, text) → Box[]
   a. Build character position map from OCR words
   b. Find char positions of each detected term
   c. Find OCR words overlapping those positions
   d. Combine word bounding boxes
5. Expand boxes by 4px for padding
6. mapBoxesToDetectionItems(boxes, detections) → RedactionItem[]
```

#### For Text Documents (TXT, MD, CSV, TSV)
```
1. FormatRegistry.getFormat(file) → DocumentFormat
2. format.load(file) → Document (format-specific structure)
3. format.extractText(doc) → {fullText, metadata}
4. detectAllPIIWithMetadata(fullText, options) → DetectionResult[]
5. format.findTextBoxes(doc, searchTerms, page) → BoundingBox[]
   (Each format implements coordinate mapping)
6. mapBoxesToDetectionItems(boxes, detections) → RedactionItem[]
```

### Detection Options Structure
```typescript
interface DetectionOptions {
  findEmails: boolean;
  findPhones: boolean;
  findSSNs: boolean;
  findCards: boolean;
  findDates: boolean;
  findAddresses: boolean;
  useML: boolean;
  mlMinConfidence: 0.8;  // ML detection threshold
}
```

### Key Detection Functions
- `detectAllPIIWithMetadata()` - Unified entry point (uses patterns.ts)
- `mergeDetections()` - Combine regex + ML results with dedup logic
- `findEmails()`, `findPhones()`, `findSSNs()`, `findLikelyPANs()` - Individual pattern matchers
- `luhnCheck()` - Credit card validation
- `hybrid.ts` - Confidence combination logic

### Detection Result Type
```typescript
interface DetectionResult {
  text: string;              // What was detected
  type: string;              // 'email', 'phone', 'ssn', 'person', 'org', 'location'
  confidence: number;        // 0-1 (1.0 for regex, variable for ML)
  source: 'regex' | 'ml';
  positions?: {start, end};  // Character positions (ML only)
}
```

### RedactionItem (UI representation)
```typescript
interface RedactionItem {
  id: string;                // Unique for deduplication
  x, y, w, h: number;       // Bounding box
  text: string;             // Detected text
  type: string;             // Detection type
  source: 'regex' | 'ml' | 'manual';
  confidence: number;
  page: number;
  enabled: boolean;         // User toggle in redaction list
  detectionId?: string;     // Link back to detection
}
```

### Critical Issues & Extension Points
1. **ML Model Size**: ~110MB download - consider split model approach
2. **OCR Performance**: Tesseract.js slow on high-res scans - worker pooling possible
3. **Pattern Overlap**: Some patterns may conflict (e.g., dates vs ZIP codes)
4. **Confidence Thresholding**: Currently hardcoded at 0.8 for ML
5. **No Batch Mode**: Process all pages but not optimized for speed
6. **Limited Validation**: patterns-financial.ts types not validated (only regex match)

---

## 4. FILE HANDLING & PROCESSING FLOW

### File Type Support

| Type | Extensions | Handler | Processing |
|------|-----------|---------|------------|
| PDF | `.pdf` | `lib/pdf/load.ts` | PDF.js text extraction + rendering |
| Image | `.png`, `.jpg`, `.webp`, etc. | `lib/images/exif.ts` | Canvas-based + mandatory OCR |
| Text | `.txt`, `.md` | `PlainTextFormat` | DOM rendering + regex detection |
| CSV/TSV | `.csv`, `.tsv` | `CsvFormat` | HTML table + cell-by-cell detection |
| Scanned PDF | `.pdf` (no text layer) | `lib/pdf/ocr.ts` | OCR-based like images |

### File Loading Sequence (App.ts:handleFiles())

```
1. Validate file type (PDF/image/text/CSV)
   └─ For PDFs: loadPdf() → getPageCount() → store in FileItem
   └─ For images: Just store (loading on selection)
   └─ For text: FormatRegistry.isSupported() check

2. Update FileList with items

3. Auto-select first file
   └─ If PDF: Show PdfViewer with initial view (native preview)
   └─ If image/text: loadFile(0) → Show canvas/textViewer

4. Show success toast
```

### PDF Processing (loadPdf)
```
1. file.arrayBuffer() → ArrayBuffer
2. Clone buffer (critical: PDF.js neuters original)
   └─ Store copy in this.pdfBytes for export
3. loadPdf(arrayBuffer) → PDFDocument (PDF.js)
4. getPageCount(doc) → number
5. renderPdfPage(0) → Canvas + page object + viewport
6. detectCurrentPageDetections() → Find PII on page 1
7. detectPIIOnAllPages() → Background: scan pages 2+
   └─ Show ProgressBar if > 3 pages
   └─ suppressToasts: true to avoid spam
```

### Image Processing (loadImage)
```
1. loadImage(file) → HTMLImageElement (canvas context, EXIF removed)
2. Create canvas from image dimensions
3. ctx.drawImage() → Render to canvas
4. Auto-enable OCR toggle (mandatory for images)
5. analyzeImageDetections(0, canvas, options) → Find PII
```

### Text Document Processing (loadTextDocument)
```
1. FormatRegistry.getFormat(file) → DocumentFormat
2. format.load(file) → Document (internal structure)
3. Hide canvas, show TextViewer
4. format.render(doc, container) → Visual display
5. format.extractText(doc) → {fullText, metadata}
6. analyzeTextDocumentDetections() → PII detection
```

### Page Navigation
- `handlePageStep(±1)` → goToPage(index)
- `goToPage()` checks bounds, loads page if not cached
- If page not yet analyzed: detectCurrentPageDetections()
- Else: refreshCanvasForCurrentPage()

### Box State Management
```
pageBoxes: Map<page, Box[]>
├─ Merged: auto-detected + manual
├─ Auto-detected stored separately
├─ Manual boxes tracked separately
└─ Export uses merged state

manualBoxesByPage: Map<page, Box[]>
└─ Only user-drawn boxes

autoDetectionsByPage: Map<page, RedactionItem[]>
└─ Only auto-detected (with enabled toggle)
```

### Key Coordination Points
1. **handleBoxesChange()** - Manual drawing updates manualBoxesByPage
2. **handleDetectionToggles()** - Enabling/disabling detections recalculates merged boxes
3. **mergePageBoxes()** - Combines auto + manual for current page
4. **refreshCanvasForCurrentPage()** - Syncs canvas with merged state

---

## 5. EXPORT CAPABILITIES

### Export Pipeline

#### PDF Export (exportPdf)
```
1. Validate pdfDoc and pdfBytes exist
2. For each page (i = 0 to pageCount):
   a. renderPageToCanvas(doc, i, scale=2) → Canvas
   b. Get boxes for page i
   c. Draw redaction boxes directly on canvas
      └─ ctx.fillRect() with #000000 (opaque black)
   d. Collect canvases
3. exportPdfFromCanvases(canvases[])
   └─ Convert each canvas to PNG
   └─ Embed PNGs in new PDF via pdf-lib
   └─ Set metadata (title, author, dates)
4. Save Uint8Array bytes
5. Transition to PdfViewer showing result
6. Store bytes for download via blob + File System Access API
```

**Key Security Feature**: Flattening via rasterization = no text layer in output PDF

#### Image Export (exportImage)
```
1. Get redaction boxes from canvas
2. exportRedactedImage(image, boxes)
   └─ Create canvas from image dimensions
   └─ Draw image
   └─ Draw opaque black boxes
   └─ canvas.toBlob() → PNG (strips EXIF automatically)
3. Generate filename: `original-redacted.ext`
4. saveBlob(blob, filename)
```

#### Text Document Export (exportTextDocument)
```
1. Get boxes from pageBoxes[0]
2. Convert Box[] → FormatBoundingBox[] (coord adaptation)
3. format.redact(doc, boxes)
   └─ PlainTextFormat: Replace text with block chars (█)
   └─ CsvFormat: Mark cells as redacted
4. format.export(doc)
   └─ PlainTextFormat: Return Blob (text/plain)
   └─ CsvFormat: Return Blob (text/csv) via PapaParse
5. Generate filename: `original-redacted.ext`
6. saveBlob(blob, filename)
```

### Export Format Handlers

#### PlainTextFormat.export()
```
- Replaces detected text with █ characters
- Preserves line structure
- Returns text/plain Blob
- No "flattening" needed (text is inherently secure after replacement)
```

#### CsvFormat.export()
```
- Marks redacted cells with █ or [REDACTED]
- Preserves table structure
- Uses PapaParse for proper CSV escaping
- Returns text/csv Blob
- Can export specific columns with special methods
```

#### PDF Export (via lib/pdf/export.ts)
```
exportPdfFromCanvases()
- Takes HTMLCanvasElement[]
- Converts each to PNG via canvas.toBlob()
- Embeds PNGs in new PDF document
- Sets metadata (title, author, creation date)
- Returns Uint8Array

exportPdfWithRedactionBoxes() [UNUSED in current UI]
- Alternative: modifies original PDF document
- Draws boxes on existing pages
- Preserves rich text but adds boxes on top
- Less secure (text still selectable below boxes)
```

### Download Mechanism (lib/fs/io.ts)
```
saveBlob(blob, filename)
├─ Try: File System Access API (modern browsers)
│  └─ Shows save dialog
│  └─ Writes directly to filesystem
└─ Fallback: blob download
   └─ Create <a> element
   └─ Set href to blob URL
   └─ Trigger download
```

### Export State Management
```
App.ts properties:
- lastExportedPdfBytes: Uint8Array | null
- Stored after PDF export
- Used by PdfViewer download button
- Cleared on loadFile/handleReset

File naming convention:
- Input: "document.pdf"
- Output: "document-redacted.pdf"
- Input: "image.png"
- Output: "image-redacted.png"
```

### Security in Exports
1. **PDF**: Rasterized (PNG embedded) = no text layer
2. **Image**: canvas.toBlob() strips EXIF/metadata
3. **Text**: Text replacement (█) = plaintext, not recoverable
4. **CSV**: Text replacement (█) = plaintext CSV

---

## 6. ARCHITECTURE ASSESSMENT

### Strengths
1. **Clean Separation**: lib/ has zero UI dependencies
2. **Multi-Format Support**: Pluggable format handlers
3. **Detection Flexibility**: Three-layer system (regex + ML + merge)
4. **State Isolation**: No global singletons (except StyleRegistry)
5. **Page-Based Tracking**: Maps handle multi-page documents elegantly
6. **Security First**: Rasterization + flattening approach
7. **Async Throughout**: Proper async/await for heavy operations

### Weaknesses & Refactoring Needs

#### 1. Theme System (CRITICAL)
**Current**: Only dark mode, hardcoded CSS variables
**Needed**:
- [ ] Runtime theme switcher (light/dark/high-contrast)
- [ ] CSS custom properties updated dynamically
- [ ] localStorage persistence
- [ ] Redaction style customization UI
- [ ] Prefers-color-scheme media query support
- [ ] Accessibility variants (reduced motion, high contrast)

#### 2. Batch Processing (HIGH)
**Current**: Sequential page processing, progress bar
**Issues**:
- [ ] No queue/task system for multiple files
- [ ] No parallelization (OCR one page at a time)
- [ ] No resumption after failure
- [ ] No batch export (multiple files → one operation)
- [ ] No concurrent file uploads

#### 3. Detection Enhancements (HIGH)
**Current**: Fixed pattern set, hardcoded confidence thresholds
**Needs**:
- [ ] User-defined patterns (regex custom rules)
- [ ] Confidence threshold slider (UI)
- [ ] Pattern enable/disable per detection (granular)
- [ ] Context-aware detection (e.g., "DOB:" label before date)
- [ ] Synonym handling (Mr./Ms./Dr. before names)
- [ ] PII taxonomy/categorization system
- [ ] Detection caching (avoid re-scanning same text)

#### 4. Document Sanitization (MEDIUM)
**Current**: Only redaction via black boxes
**Missing**:
- [ ] Metadata stripping (PDF creation date, author, etc.)
- [ ] Comment removal (PDFs)
- [ ] Form field clearing
- [ ] Watermark detection
- [ ] Invisible character stripping
- [ ] Font subsetting (prevent font analysis)
- [ ] Compression option selection

#### 5. Accessibility (MEDIUM)
**Current**: Basic ARIA labels, keyboard nav sketched
**Gaps**:
- [ ] Full keyboard navigation (Tab order, focus management)
- [ ] Screen reader testing (component labels)
- [ ] Color contrast validation (WCAG AA/AAA)
- [ ] Zoom support (logical scaling vs. CSS zoom)
- [ ] Error messages (accessible, not just visual)
- [ ] Skip to main content link
- [ ] Form label associations

### Extension Points for Future Features

1. **New Detection Types**:
   ```typescript
   // Add to src/lib/detect/patterns-*.ts
   // Register in detectAllPIIWithMetadata()
   // Add UI toggle to Toolbar
   ```

2. **New Format Handlers**:
   ```typescript
   // Extend DocumentFormat abstract class
   // Register in FormatRegistry.initialize()
   // Add to tests/unit/formats/
   ```

3. **New Redaction Styles**:
   ```typescript
   // Implement RedactionStyle interface
   // Register in StyleRegistry (static)
   // UI via StylePicker component
   ```

4. **New Export Formats**:
   ```typescript
   // Add export() method to format handler
   // Update export pipeline in App.ts
   // Add file type validation
   ```

5. **ML Model Variants**:
   ```typescript
   // Switch model in ml.ts loadMLModel()
   // Support region-specific models
   // Cache model selection in localStorage
   ```

### Performance Bottlenecks
1. **ML Model Download**: ~110MB first-run (cacheable)
2. **OCR Processing**: 5-10s per page (Tesseract.js)
3. **PDF Rendering**: 2x scale factor for quality (slower)
4. **Text Extraction**: No caching between reruns
5. **Large PDFs**: Sequential page processing (no parallelization)

### State Management Refactoring Opportunity
**Current**: Direct properties + callback chains
**Consider**:
- [ ] Event emitter for state changes (loose coupling)
- [ ] Immutable state pattern (easier debugging)
- [ ] Command pattern for undo/redo (partial, only canvas)
- [ ] Store pattern (single source of truth)

---

## Summary: Key Insights for Planning

### For Theme System
- Leverage existing CSS variables but make them dynamic
- Add theme context to all components
- Persist theme choice per user

### For Batch Processing
- Need work queue abstraction
- File processing pipeline
- Progress aggregation across multiple files
- Error recovery strategy

### For Smart Detection
- Build rule builder UI (UI + lib/detect/custom-rules.ts)
- Add detection preview before committing
- Support detection presets/templates
- Context awareness layer

### For Sanitization
- PDF library hooks for metadata removal
- Form field detection and clearing
- Comment/annotation removal

### For Accessibility
- Audit component focus order
- Add role/aria attributes systematically
- Test with screen readers
- Color contrast validation


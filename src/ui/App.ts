/**
 * Main application component
 */

import { LandingPageEnhanced } from './components/LandingPageEnhanced';
import { DropZone } from './components/DropZone';
import { Toolbar, type ToolbarOptions } from './components/Toolbar';
import { FileList, type FileItem } from './components/FileList';
import { CanvasStage } from './components/CanvasStage';
import { RedactionList, type RedactionItem } from './components/RedactionList';
import { Toast } from './components/Toast';
import { SuccessAnimation } from './components/SuccessAnimation';
import { ProgressBar } from './components/ProgressBar';
import { PdfViewer } from './components/PdfViewer';
import { Settings } from './components/Settings';
import { MLDownloadPrompt } from './components/MLDownloadPrompt';
import { TextViewer } from './components/TextViewer';
import { SanitizeOptionsModal } from './components/SanitizeOptions';
import { AuthSession } from '../lib/auth/session.js';
import { CloudSyncService } from '../lib/cloud/sync.js';
import { AuthModal } from './components/auth/AuthModal.js';
import { UserMenu } from './components/auth/UserMenu.js';
import { Dashboard } from './components/Dashboard.js';
import { themeManager } from '../lib/theme/ThemeManager';

import { loadPdf, renderPageToCanvas, getPageCount } from '../lib/pdf/load';
import { findTextBoxes, extractPageText } from '../lib/pdf/find';
import { expandBoxes } from '../lib/pdf/redact';
import { exportPdfFromCanvases } from '../lib/pdf/export';
import { ocrCanvas, shouldSuggestOCR } from '../lib/pdf/ocr';
import { sanitizePDF, type SanitizeOptions } from '../lib/pdf/sanitize';

import { loadImage } from '../lib/images/exif';
import { exportRedactedImage } from '../lib/images/redact';
import { ocrImageCanvas } from '../lib/images/ocr';

import { detectAllPIIWithMetadata, type DetectionOptions } from '../lib/detect/patterns';
import type { DetectionResult } from '../lib/detect/merger';
import { loadMLModel, isMLAvailable } from '../lib/detect/ml';
import { saveBlob } from '../lib/fs/io';
import { mapPIIToOCRBoxes, expandBoxes as expandOCRBoxes } from '../lib/ocr/mapper';

import { FormatRegistry } from '../lib/formats/base/FormatRegistry';
import type { Document, BoundingBox as FormatBoundingBox, DocumentFormat } from '../lib/formats/base/types';

import { TaskQueue, TaskStatus } from '../lib/queue';
import type { ProcessingTask } from '../lib/queue';
import { BatchProgressPanel } from './components/BatchProgressPanel';
import { ariaAnnouncer } from '../lib/a11y';

import type { Box } from '../lib/pdf/find';

export class App {
  private container: HTMLElement;
  private landingPage: LandingPageEnhanced;
  private appView: HTMLElement | null = null;
  private dropZone: DropZone;
  private toolbar: Toolbar;
  private fileList: FileList;
  private canvasStage: CanvasStage;
  private redactionList: RedactionList;
  private toast: Toast;
  private pdfViewer: PdfViewer;
  private textViewer: TextViewer;
  private lastExportedPdfBytes: Uint8Array | null = null;
  private authSession: AuthSession;
  private cloudSync: CloudSyncService | null = null;
  private userMenu: UserMenu | null = null;

  private files: FileItem[] = [];
  private currentFileIndex: number = -1;
  private currentPageIndex: number = 0;
  private pdfDoc: any = null;
  private pdfBytes: ArrayBuffer | null = null; // Store original PDF bytes for export
  private currentImage: HTMLImageElement | null = null;
  private currentDocument: Document | null = null; // For text/CSV documents
  private currentFormat: DocumentFormat | null = null; // Format handler for current document
  private pageBoxes: Map<number, Box[]> = new Map(); // Track boxes per page
  private totalPages: number = 0;
  private processedPages: Set<number> = new Set();
  private documentDetections: RedactionItem[] = [];
  private autoDetectionsByPage: Map<number, RedactionItem[]> = new Map();
  private manualBoxesByPage: Map<number, Box[]> = new Map();
  private useML: boolean = false; // ML detection toggle
  private mlLoadPromise: Promise<boolean> | null = null;

  // Batch processing
  private taskQueue: TaskQueue;
  private batchProgressPanel: BatchProgressPanel | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.toast = new Toast();

    // Initialize task queue for batch processing
    this.taskQueue = new TaskQueue({ maxConcurrent: 1, autoStart: true });
    this.setupTaskQueueHandlers();

    // Load ML preference from localStorage
    this.useML = localStorage.getItem('ml-detection-enabled') === 'true';

    // Create enhanced landing page with all immersive features
    this.landingPage = new LandingPageEnhanced(() => this.showApp());

    // Initialize auth session (use environment variable for API URL)
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    this.authSession = new AuthSession(apiUrl);

    // Create app components
    this.dropZone = new DropZone((files) => this.handleFiles(files));
    this.toolbar = new Toolbar(
      (options) => this.handleToolbarChange(options),
      () => this.handleExport(),
      () => this.handleReset(),
      () => this.handleNewFile(),
      () => this.openSettings(),
      () => this.handleShowAuth(),
      () => this.handleShowDashboard(),
      () => this.handleBatchExport()
    );

    // Check if user is logged in and initialize cloud sync
    if (this.authSession.isAuthenticated()) {
      this.initializeCloudSync();
    } else {
      this.toolbar.showLoginButton();
    }

    this.fileList = new FileList((index) => this.handleFileSelect(index));
    this.canvasStage = new CanvasStage(
      (boxes) => this.handleBoxesChange(boxes),
      {
        onNextPage: () => {
          void this.handlePageStep(1);
        },
        onPrevPage: () => {
          void this.handlePageStep(-1);
        }
      }
    );
    this.canvasStage.setPageInfo(0, 1);
    this.redactionList = new RedactionList(
      (items) => {
        this.handleDetectionToggles(items);
      },
      (item) => {
        void this.navigateToDetection(item);
      }
    );
    this.redactionList.setItems([]);
    this.redactionList.setActivePage(0);
    this.pdfViewer = new PdfViewer(
      () => this.handlePdfDownload(),
      () => this.handlePdfViewerBack(),
      () => this.handleStartRedacting()
    );
    this.textViewer = new TextViewer();

    this.render();
  }

  private render() {
    this.container.className = 'app-container';

    // Show landing page initially
    this.container.appendChild(this.landingPage.getElement());

    // Create app view but keep it hidden
    this.appView = document.createElement('div');
    this.appView.className = 'app-view';
    this.appView.style.display = 'none';
    this.appView.style.width = '100%';
    this.appView.style.height = '100vh';
    this.appView.style.display = 'none';

    const appContainer = document.createElement('div');
    appContainer.className = 'app-container';
    appContainer.style.height = '100%';

    const sidebar = document.createElement('div');
    sidebar.className = 'app-sidebar';
    sidebar.appendChild(this.toolbar.getElement());
    sidebar.appendChild(this.fileList.getElement());
    sidebar.appendChild(this.redactionList.getElement());

    const main = document.createElement('div');
    main.className = 'app-main';
    main.appendChild(this.dropZone.getElement());
    main.appendChild(this.canvasStage.getElement());
    main.appendChild(this.textViewer.getElement());

    appContainer.appendChild(sidebar);
    appContainer.appendChild(main);
    this.appView.appendChild(appContainer);
    this.appView.appendChild(this.pdfViewer.getElement());

    this.container.appendChild(this.appView);

    // Initially hide canvas stage, text viewer, and redaction list
    this.canvasStage.getElement().style.display = 'none';
    this.textViewer.getElement().style.display = 'none';
    this.redactionList.getElement().style.display = 'none';
  }

  private showApp(): void {
    // Check if user has been prompted to download ML model
    const hasBeenPrompted = localStorage.getItem('ml-download-prompted') === 'true';
    const mlAlreadyEnabled = localStorage.getItem('ml-detection-enabled') === 'true';

    // If user hasn't been prompted and ML is not already enabled, show the prompt
    if (!hasBeenPrompted && !mlAlreadyEnabled) {
      const mlPrompt = new MLDownloadPrompt({
        onDownloadAndContinue: () => {
          // User chose to download - ML model is already loaded in the prompt
          this.useML = true;
          this.proceedToApp();
        },
        onSkip: () => {
          // User chose to skip - proceed without ML
          this.useML = false;
          this.proceedToApp();
        },
        onCancel: () => {
          // User wants to go back to homepage - do nothing
          // Landing page is still visible
        }
      });
      mlPrompt.show();
    } else {
      // User has already made a choice, proceed directly
      this.proceedToApp();
    }
  }

  private proceedToApp(): void {
    // Fade out landing page
    const landingEl = this.landingPage.getElement();
    landingEl.style.opacity = '1';
    landingEl.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    landingEl.style.transform = 'scale(1)';

    requestAnimationFrame(() => {
      landingEl.style.opacity = '0';
      landingEl.style.transform = 'scale(0.95)';
    });

    setTimeout(() => {
      this.landingPage.hide();
      if (this.appView) {
        this.appView.style.display = 'flex';
        this.appView.style.opacity = '0';
        this.appView.style.transform = 'scale(1.05)';
        this.appView.style.transition = 'opacity 0.5s ease, transform 0.5s ease';

        requestAnimationFrame(() => {
          this.appView!.style.opacity = '1';
          this.appView!.style.transform = 'scale(1)';
        });
      }
    }, 500);
  }

  private showLanding(): void {
    // Fade out app view
    if (this.appView) {
      this.appView.style.opacity = '1';
      this.appView.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      this.appView.style.transform = 'scale(1)';

      requestAnimationFrame(() => {
        this.appView!.style.opacity = '0';
        this.appView!.style.transform = 'scale(1.05)';
      });

      setTimeout(() => {
        this.appView!.style.display = 'none';
        this.landingPage.show();

        const landingEl = this.landingPage.getElement();
        landingEl.style.opacity = '0';
        landingEl.style.transform = 'scale(0.95)';
        landingEl.style.transition = 'opacity 0.5s ease, transform 0.5s ease';

        requestAnimationFrame(() => {
          landingEl.style.opacity = '1';
          landingEl.style.transform = 'scale(1)';
        });
      }, 500);
    } else {
      this.landingPage.show();
    }
  }

  private async ensureMLModelReady(): Promise<boolean> {
    if (!this.useML) {
      return false;
    }

    if (isMLAvailable()) {
      return true;
    }

    if (!this.mlLoadPromise) {
      this.toast.info('Downloading ML model (~110MB). This happens once per browser and may take a minute.');

      const loadPromise = loadMLModel()
        .then(() => {
          this.toast.success('ML detection ready!');
          return true;
        })
        .catch((error) => {
          console.error('[App] Failed to load ML model:', error);
          this.toast.error('Failed to load ML model. Falling back to regex-only detection.');
          this.useML = false;
          localStorage.setItem('ml-detection-enabled', 'false');
          return false;
        });

      this.mlLoadPromise = loadPromise;
      loadPromise.finally(() => {
        this.mlLoadPromise = null;
      });
    }

    return this.mlLoadPromise ?? false;
  }

  private async handleFiles(files: File[]) {
    this.toast.info('Loading files...');

    const fileItems: FileItem[] = [];

    for (const file of files) {
      if (file.type === 'application/pdf') {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const doc = await loadPdf(arrayBuffer);
          fileItems.push({
            file,
            pages: getPageCount(doc)
          });
        } catch (error) {
          this.toast.error(`Failed to load PDF: ${file.name}`);
        }
      } else if (file.type.startsWith('image/')) {
        fileItems.push({ file });
      } else if (FormatRegistry.isSupported(file)) {
        // Text and structured formats (TXT, MD, CSV, TSV)
        fileItems.push({ file });
      }
    }

    if (fileItems.length > 0) {
      this.files = fileItems;
      this.fileList.setFiles(fileItems);
      this.dropZone.hide();
      this.toolbar.showNewFileButton(true);
      this.toolbar.enableBatchExport(true, fileItems.length);

      // Auto-select first file
      this.currentFileIndex = 0;

      // For PDFs, show native viewer first
      const firstItem = fileItems[0];
      if (firstItem.file.type === 'application/pdf') {
        const arrayBuffer = await firstItem.file.arrayBuffer();
        // Store the PDF bytes for later use
        this.pdfBytes = arrayBuffer.slice(0);

        // Hide the app container and show the PDF viewer
        const appContainer = this.appView?.querySelector('.app-container') as HTMLElement;
        if (appContainer) {
          appContainer.style.display = 'none';
        }

        this.pdfViewer.showInitialView(arrayBuffer);
        this.toast.success(`Loaded ${fileItems.length} file(s)`);
      } else {
        // For images, go straight to the canvas editor
        this.canvasStage.getElement().style.display = 'block';
        this.redactionList.getElement().style.display = 'block';
        this.toolbar.enableExport(true);
        await this.loadFile(0);
        this.toast.success(`Loaded ${fileItems.length} file(s)`);
      }
    }
  }

  private async loadFile(index: number) {
    const item = this.files[index];
    this.currentFileIndex = index;
    this.currentPageIndex = 0;

    if (item.file.type === 'application/pdf') {
      await this.loadPdf(item.file);
    } else if (item.file.type.startsWith('image/')) {
      await this.loadImage(item.file);
    } else if (FormatRegistry.isSupported(item.file)) {
      await this.loadTextDocument(item.file);
    }
  }

  private async loadPdf(file: File) {
    try {
      console.log('loadPdf: Reading file', file.name, 'size:', file.size);
      const arrayBuffer = await file.arrayBuffer();
      console.log('loadPdf: ArrayBuffer size:', arrayBuffer.byteLength);

      // CRITICAL: Clone the ArrayBuffer before passing to PDF.js
      // PDF.js may detach/neuter the ArrayBuffer, so we need a copy for export
      this.pdfBytes = arrayBuffer.slice(0);
      console.log('loadPdf: Cloned pdfBytes, length:', this.pdfBytes.byteLength);

      this.pdfDoc = await loadPdf(arrayBuffer);
      console.log('loadPdf: After loading PDF, pdfBytes length:', this.pdfBytes.byteLength);

      this.totalPages = getPageCount(this.pdfDoc);
      this.resetDetectionMaps();
      await this.renderPdfPage(0);
      await this.detectCurrentPageDetections();

      // Detect PII on all pages in the background
      const pageCount = this.totalPages;
      if (pageCount > 1) {
        this.toast.info(`Scanning ${pageCount} pages for sensitive information...`);
        await this.detectPIIOnAllPages();
        this.toast.success(`Scanned all ${pageCount} pages`);
      }
    } catch (error) {
      this.toast.error('Failed to process PDF');
      console.error('loadPdf error:', error);
    }
  }

  private async renderPdfPage(pageIndex: number) {
    if (!this.pdfDoc) return;

    this.currentPageIndex = pageIndex;
    const { page, canvas, viewport } = await renderPageToCanvas(
      this.pdfDoc,
      pageIndex,
      2
    );

    this.canvasStage.setImage(canvas);

    // Store for detection
    (this.canvasStage as any).currentPage = page;
    (this.canvasStage as any).currentViewport = viewport;

    // Load existing boxes for this page if they exist
    const existingBoxes = this.pageBoxes.get(pageIndex) || [];
    this.canvasStage.setBoxes(existingBoxes);
    this.redactionList.setActivePage(this.currentPageIndex);
    this.canvasStage.setPageInfo(this.currentPageIndex, this.totalPages || 1);
  }

  private async handlePageStep(step: number) {
    if (!this.pdfDoc) return;
    await this.goToPage(this.currentPageIndex + step);
  }

  private async goToPage(pageIndex: number) {
    if (!this.pdfDoc) return;

    const pageCount = this.totalPages || getPageCount(this.pdfDoc);
    if (pageIndex < 0 || pageIndex >= pageCount) {
      return;
    }

    if (pageIndex === this.currentPageIndex) {
      return;
    }

    await this.renderPdfPage(pageIndex);

    if (!this.processedPages.has(pageIndex)) {
      await this.detectCurrentPageDetections();
    } else {
      this.refreshCanvasForCurrentPage();
    }
  }

  private async loadImage(file: File) {
    try {
      const img = await loadImage(file);
      this.currentImage = img;
      this.totalPages = 1;
      this.resetDetectionMaps();
      this.canvasStage.setPageInfo(0, 1);

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      this.canvasStage.setImage(canvas);

      // Images ALWAYS require OCR (no embedded text like PDFs)
      const options = this.toolbar.getOptions();

      // Auto-enable OCR for images if not already enabled
      if (!options.useOCR) {
        this.toast.info('Image detected. Auto-enabling OCR for text detection...');

        const ocrCheckbox = this.toolbar.getElement().querySelector('#use-ocr') as HTMLInputElement;
        if (ocrCheckbox) {
          ocrCheckbox.checked = true;
        }

        // Update options to reflect OCR is now enabled
        options.useOCR = true;
      }

      // Always run OCR detection for images
      await this.analyzeImageDetections(0, canvas, options);
    } catch (error) {
      this.toast.error('Failed to load image');
      console.error(error);
    }
  }

  private async loadTextDocument(file: File) {
    try {
      // Get appropriate format handler
      const format = await FormatRegistry.getFormat(file);
      this.currentFormat = format;

      // Load document
      const doc = await format.load(file);
      this.currentDocument = doc;

      // Reset detection state
      this.totalPages = 1; // Text documents are single-page for now
      this.resetDetectionMaps();

      // Hide canvas, show text viewer
      this.canvasStage.getElement().style.display = 'none';
      this.textViewer.getElement().style.display = 'block';

      // Render document in text viewer
      await this.textViewer.renderDocument(doc, format);

      // Extract text for PII detection
      const options = this.toolbar.getOptions();
      const mlReady = this.useML ? await this.ensureMLModelReady() : false;

      await this.analyzeTextDocumentDetections(0, doc, format, options, mlReady);
    } catch (error) {
      this.toast.error(`Failed to load document: ${file.name}`);
      console.error(error);
    }
  }

  private refreshCanvasForCurrentPage() {
    const boxes = this.pageBoxes.get(this.currentPageIndex) || [];
    this.canvasStage.setBoxes(boxes);
    this.redactionList.setActivePage(this.currentPageIndex);
  }

  private resetDetectionMaps() {
    this.pageBoxes.clear();
    this.documentDetections = [];
    this.autoDetectionsByPage.clear();
    this.manualBoxesByPage.clear();
    this.processedPages.clear();
    this.redactionList.setItems([]);
    this.redactionList.setActivePage(0);
    this.canvasStage.setBoxes([]);
  }

  private clearAutoDetectionsPreservingManual() {
    this.documentDetections = [];
    this.autoDetectionsByPage.clear();
    this.processedPages.clear();
    this.redactionList.setItems([]);
    this.redactionList.setActivePage(this.currentPageIndex);
    this.pageBoxes.clear();
    this.manualBoxesByPage.forEach((boxes, page) => {
      this.pageBoxes.set(
        page,
        boxes.map((box) => ({ ...box }))
      );
    });
    this.refreshCanvasForCurrentPage();
  }

  private async detectCurrentPageDetections() {
    if (!this.pdfDoc) return;
    const stage = this.canvasStage as any;
    const page = stage.currentPage;
    const viewport = stage.currentViewport;

    if (!page || !viewport) {
      return;
    }

    const options = this.toolbar.getOptions();
    const mlReady = this.useML ? await this.ensureMLModelReady() : false;
    const canvas = this.canvasStage.getCanvas();
    await this.analyzePageDetections(this.currentPageIndex, page, viewport, options, mlReady, canvas);
  }

  private async analyzePageDetections(
    pageIndex: number,
    page: any,
    viewport: any,
    options: ToolbarOptions,
    mlReady: boolean,
    canvasForOCR?: HTMLCanvasElement,
    suppressToasts: boolean = false
  ) {
    const baseText = await extractPageText(page);

    // Check if this is a scanned PDF (little to no text)
    const isScannedPdf = await shouldSuggestOCR(page);

    // For scanned PDFs, use OCR-based detection (like images)
    if (isScannedPdf && canvasForOCR) {
      // Only show toast for first page or when not in batch mode
      if (!suppressToasts && pageIndex === 0) {
        this.toast.info('Scanned PDF detected. Auto-enabling OCR for text detection...');
      }

      // Auto-enable OCR in toolbar for future pages
      const ocrCheckbox = this.toolbar.getElement().querySelector('#use-ocr') as HTMLInputElement;
      if (ocrCheckbox && !ocrCheckbox.checked) {
        ocrCheckbox.checked = true;
      }

      // Use the same OCR-based detection as images
      await this.analyzeImageDetections(pageIndex, canvasForOCR, options, suppressToasts);
      return;
    }

    // For PDFs with text layers, use the standard text extraction approach
    let combinedText = baseText;

    // Optionally supplement with OCR if enabled
    if (options.useOCR && canvasForOCR && baseText.trim().length > 0) {
      this.toast.info(`Running OCR on page ${pageIndex + 1}...`);
      const ocrText = await ocrCanvas(canvasForOCR);
      combinedText = `${combinedText} ${ocrText}`;
    }

    const detectionOptions: DetectionOptions = {
      findEmails: options.findEmails,
      findPhones: options.findPhones,
      findSSNs: options.findSSNs,
      findCards: options.findCards,
      findDates: options.findDates,
      findAddresses: options.findAddresses,
      useML: this.useML && mlReady,
      mlMinConfidence: this.settings.getMLConfidenceThreshold(),
      useCustomPatterns: true
    };

    const detectionResults = await detectAllPIIWithMetadata(combinedText, detectionOptions);
    const normalizedDetections: DetectionWithNormalization[] = detectionResults.map((result) => ({
      ...result,
      normalizedText: normalizeDetectionText(result.text),
      digitsOnly: extractDigits(result.text)
    }));

    const boxes =
      normalizedDetections.length === 0
        ? []
        : await findTextBoxes(page, viewport, (str) => doesTextMatchDetections(str, normalizedDetections));

    const expandedBoxes = expandBoxes(boxes, 4).map((box) => ({
      ...box,
      page: pageIndex
    }));

    const detectionItems = this.mapBoxesToDetectionItems(pageIndex, expandedBoxes, normalizedDetections);
    this.storeDetectionItems(pageIndex, detectionItems);
    this.mergePageBoxes(pageIndex);
    this.redactionList.setItems(this.documentDetections);
    this.redactionList.setActivePage(this.currentPageIndex);
    this.processedPages.add(pageIndex);

    if (pageIndex === this.currentPageIndex) {
      const count = detectionItems.length;
      if (count > 0) {
        this.toast.success(`Found ${count} potential matches`);
      } else {
        this.toast.info('No detections found on this page');
      }
    }
  }

  /**
   * Analyze image for PII using OCR
   * This is used for images and scanned PDFs
   */
  private async analyzeImageDetections(
    pageIndex: number,
    canvas: HTMLCanvasElement,
    options: ToolbarOptions,
    suppressToasts: boolean = false
  ) {
    try {
      // Validate canvas
      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        console.error('Invalid canvas for OCR:', { canvas, width: canvas?.width, height: canvas?.height });
        if (!suppressToasts) {
          this.toast.error('Invalid image data');
        }
        this.refreshCanvasForCurrentPage();
        return;
      }

      if (!suppressToasts) {
        this.toast.info('Running OCR on image...');
      }

      // OPTIMIZATION: Start ML model loading in parallel with OCR
      // This saves ~30 seconds on first load when ML is enabled
      const mlReadyPromise = this.useML ? this.ensureMLModelReady() : Promise.resolve(false);

      // Perform OCR to get text and word bounding boxes
      const ocrResult = await ocrImageCanvas(canvas);

      if (!ocrResult.text || ocrResult.text.trim().length === 0) {
        if (!suppressToasts) {
          this.toast.info('No text detected in image');
        }
        this.refreshCanvasForCurrentPage();
        return;
      }

      // Validate OCR words array exists
      if (!ocrResult.words || ocrResult.words.length === 0) {
        console.warn('OCR returned text but no word bounding boxes. Text:', ocrResult.text);
        if (!suppressToasts) {
          this.toast.warning('Text detected but could not locate bounding boxes. Try drawing boxes manually.');
        }
        this.refreshCanvasForCurrentPage();
        return;
      }

      // Wait for ML model to be ready (may already be done if it loaded during OCR)
      const mlReady = await mlReadyPromise;

      // Configure detection options
      const detectionOptions: DetectionOptions = {
        findEmails: options.findEmails,
        findPhones: options.findPhones,
        findSSNs: options.findSSNs,
        findCards: options.findCards,
        findDates: options.findDates,
        findAddresses: options.findAddresses,
        useML: this.useML && mlReady,
        mlMinConfidence: this.settings.getMLConfidenceThreshold(),
        useCustomPatterns: true
      };

      // Detect PII in OCR text
      const detectionResults = await detectAllPIIWithMetadata(ocrResult.text, detectionOptions);

      if (detectionResults.length === 0) {
        this.toast.info('No sensitive information detected');
        this.refreshCanvasForCurrentPage();
        return;
      }

      // Map PII detections to OCR word bounding boxes
      const boxes = mapPIIToOCRBoxes(
        detectionResults,
        ocrResult.words,
        ocrResult.text,
        pageIndex,
        1.0 // No scaling needed for images
      );

      // Expand boxes with padding
      const expandedBoxes = expandOCRBoxes(boxes, 4);

      // Normalize detections for matching
      const normalizedDetections: DetectionWithNormalization[] = detectionResults.map((result) => ({
        ...result,
        normalizedText: normalizeDetectionText(result.text),
        digitsOnly: extractDigits(result.text)
      }));

      // Map to RedactionItems
      const detectionItems = this.mapBoxesToDetectionItems(pageIndex, expandedBoxes, normalizedDetections);

      // Store and display results
      this.storeDetectionItems(pageIndex, detectionItems);
      this.mergePageBoxes(pageIndex);
      this.redactionList.setItems(this.documentDetections);
      this.redactionList.setActivePage(this.currentPageIndex);
      this.processedPages.add(pageIndex);

      const count = detectionItems.length;
      if (!suppressToasts) {
        if (count > 0) {
          this.toast.success(`Found ${count} potential matches`);
        } else {
          this.toast.info('No detections found');
        }
      }
    } catch (error) {
      console.error('Error analyzing image:', error);
      if (!suppressToasts) {
        // Provide more specific error messages
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('initialization failed') || errorMessage.includes('internet connection')) {
          this.toast.error('OCR download failed. Check your internet connection and try again.');
        } else if (errorMessage.includes('processing failed')) {
          this.toast.error('OCR failed to process this image. Try drawing boxes manually.');
        } else {
          this.toast.error('Failed to analyze image. You can still draw redaction boxes manually.');
        }
      }
      this.refreshCanvasForCurrentPage();
    }
  }

  /**
   * Analyze text documents (TXT, MD, CSV, TSV) for PII
   */
  private async analyzeTextDocumentDetections(
    pageIndex: number,
    doc: Document,
    format: DocumentFormat,
    options: ToolbarOptions,
    mlReady: boolean
  ) {
    try {
      // Extract text from document
      const textResult = await format.extractText(doc);

      if (!textResult.fullText || textResult.fullText.trim().length === 0) {
        this.toast.info('No text found in document');
        return;
      }

      // Configure detection options
      const detectionOptions: DetectionOptions = {
        findEmails: options.findEmails,
        findPhones: options.findPhones,
        findSSNs: options.findSSNs,
        findCards: options.findCards,
        findDates: options.findDates,
        findAddresses: options.findAddresses,
        useML: this.useML && mlReady,
        mlMinConfidence: this.settings.getMLConfidenceThreshold(),
        useCustomPatterns: true
      };

      // Detect PII in text
      const detectionResults = await detectAllPIIWithMetadata(textResult.fullText, detectionOptions);

      if (detectionResults.length === 0) {
        this.toast.info('No sensitive information detected');
        return;
      }

      // Extract search terms from detections
      const searchTerms = detectionResults.map((d) => d.text);

      // Find bounding boxes using format-specific logic
      const boxes = await format.findTextBoxes(doc, searchTerms, pageIndex);

      // Normalize detections for matching
      const normalizedDetections: DetectionWithNormalization[] = detectionResults.map((result) => ({
        ...result,
        normalizedText: normalizeDetectionText(result.text),
        digitsOnly: extractDigits(result.text)
      }));

      // Map to RedactionItems
      const detectionItems = this.mapBoxesToDetectionItems(pageIndex, boxes, normalizedDetections);

      // Store and display results
      this.storeDetectionItems(pageIndex, detectionItems);
      this.mergePageBoxes(pageIndex);
      this.redactionList.setItems(this.documentDetections);
      this.redactionList.setActivePage(this.currentPageIndex);
      this.processedPages.add(pageIndex);

      const count = detectionItems.length;
      if (count > 0) {
        this.toast.success(`Found ${count} potential matches`);
      } else {
        this.toast.info('No detections found');
      }
    } catch (error) {
      console.error('Error analyzing text document:', error);
      this.toast.error('Failed to analyze document');
    }
  }

  private storeDetectionItems(pageIndex: number, items: RedactionItem[]) {
    if (items.length === 0) {
      this.autoDetectionsByPage.delete(pageIndex);
    } else {
      this.autoDetectionsByPage.set(pageIndex, items);
    }

    this.documentDetections = [
      ...this.documentDetections.filter((item) => item.page !== pageIndex),
      ...items
    ];
  }

  private mapBoxesToDetectionItems(
    pageIndex: number,
    boxes: Box[],
    detections: DetectionWithNormalization[]
  ): RedactionItem[] {
    return boxes.map((box) => {
      const detectionMeta = this.findDetectionForText(box.text, detections);
      const id = this.createDetectionId(pageIndex, box);
      const previous = this.documentDetections.find((item) => item.id === id);

      return {
        ...box,
        id,
        page: pageIndex,
        enabled: previous ? previous.enabled : true,
        type: detectionMeta?.type ?? box.type,
        source: (detectionMeta?.source ?? 'regex') as 'regex' | 'ml',
        confidence: detectionMeta?.confidence ?? box.confidence
      };
    });
  }

  private findDetectionForText(text: string, detections: DetectionWithNormalization[]) {
    const normalized = normalizeDetectionText(text);
    const digits = extractDigits(text);
    if (!normalized && !digits) {
      return undefined;
    }

    return detections.find((detection) =>
      detectionTextsOverlap(normalized, detection.normalizedText, digits, detection.digitsOnly)
    );
  }

  private createDetectionId(pageIndex: number, box: Box): string {
    const normalizedText = normalizeDetectionText(box.text || '');
    return `det-${pageIndex}-${Math.round(box.x)}-${Math.round(box.y)}-${normalizedText}`;
  }

  private mergePageBoxes(page: number) {
    const manual = this.manualBoxesByPage.get(page) || [];
    const detectionBoxes = (this.autoDetectionsByPage.get(page) || [])
      .filter((item) => item.enabled)
      .map((item) => ({
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        text: item.text,
        page: item.page,
        type: item.type,
        source: item.source,
        confidence: item.confidence,
        detectionId: item.id
      }));

    const combined = [...detectionBoxes, ...manual];

    if (combined.length === 0) {
      this.pageBoxes.delete(page);
    } else {
      this.pageBoxes.set(page, combined);
    }

    if (page === this.currentPageIndex) {
      this.canvasStage.setBoxes(combined);
    }
  }

  private handleDetectionToggles(items: RedactionItem[]) {
    this.documentDetections = items;
    this.autoDetectionsByPage = this.groupDetectionsByPage(items);
    this.refreshCombinedBoxesForAllPages();
  }

  private groupDetectionsByPage(items: RedactionItem[]): Map<number, RedactionItem[]> {
    const grouped = new Map<number, RedactionItem[]>();
    items.forEach((item) => {
      const existing = grouped.get(item.page) || [];
      existing.push(item);
      grouped.set(item.page, existing);
    });
    return grouped;
  }

  private refreshCombinedBoxesForAllPages() {
    const pages = new Set<number>();
    this.autoDetectionsByPage.forEach((_, page) => pages.add(page));
    this.manualBoxesByPage.forEach((_, page) => pages.add(page));
    this.pageBoxes.forEach((_, page) => pages.add(page));

    pages.forEach((page) => this.mergePageBoxes(page));
    this.refreshCanvasForCurrentPage();
  }

  private async navigateToDetection(item: RedactionItem) {
    if (item.page !== this.currentPageIndex) {
      await this.goToPage(item.page);
    } else {
      this.refreshCanvasForCurrentPage();
    }

    this.toast.info(`Showing detection on page ${item.page + 1}`);
  }

  private async detectPIIOnAllPages() {
    if (!this.pdfDoc) return;

    const pageCount = this.totalPages || getPageCount(this.pdfDoc);
    const options = this.toolbar.getOptions();
    const mlReady = this.useML ? await this.ensureMLModelReady() : false;
    const progressBar = new ProgressBar();
    const showProgress = pageCount > 3;

    // Check if first page is scanned to determine message
    let progressMessage = 'Scanning pages for sensitive information...';
    if (pageCount > 0) {
      const firstPage = await this.pdfDoc.getPage(1);
      const isScanned = await shouldSuggestOCR(firstPage);
      if (isScanned) {
        progressMessage = 'Running OCR on scanned document...';
      }
    }

    if (showProgress) {
      progressBar.show(progressMessage);
    }

    for (let i = 0; i < pageCount; i++) {
      if (i === this.currentPageIndex || this.processedPages.has(i)) {
        continue;
      }

      if (showProgress) {
        const progress = ((i + 1) / pageCount) * 100;
        progressBar.update(progress, i + 1, pageCount);
      }

      const { page, canvas, viewport } = await renderPageToCanvas(this.pdfDoc, i, 2);
      // Suppress toasts during batch processing to avoid spam
      await this.analyzePageDetections(i, page, viewport, options, mlReady, canvas, true);
    }

    if (showProgress) {
      progressBar.hide();
    }
  }

  private handleToolbarChange(options: ToolbarOptions) {
    if (this.currentFileIndex >= 0) {
      void this.reprocessDetections();
    }
  }

  private async reprocessDetections() {
    if (!this.pdfDoc) return;
    this.clearAutoDetectionsPreservingManual();
    await this.detectCurrentPageDetections();
    if ((this.totalPages || 0) > 1) {
      await this.detectPIIOnAllPages();
    }
  }

  private handleFileSelect(index: number) {
    this.loadFile(index);
  }

  private handleBoxesChange(boxes: Box[]) {
    const manual = boxes
      .filter((box) => box.text === 'manual' || box.source === 'manual')
      .map((box) => ({
        ...box,
        source: 'manual' as const,
        page: this.currentPageIndex
      }));

    this.manualBoxesByPage.set(this.currentPageIndex, manual);
    this.mergePageBoxes(this.currentPageIndex);
    this.processedPages.add(this.currentPageIndex);
  }

  private async handleExport() {
    const item = this.files[this.currentFileIndex];
    if (!item) return;

    // For PDFs, show sanitization options first
    if (item.file.type === 'application/pdf') {
      this.showSanitizeModal();
      return;
    }

    this.toast.info('Exporting...');

    try {
      if (item.file.type.startsWith('image/')) {
        await this.exportImage();
      } else if (FormatRegistry.isSupported(item.file)) {
        await this.exportTextDocument();
      }

      // Show success animation
      const successAnim = new SuccessAnimation();
      successAnim.show();

      this.toast.success('Export complete!');
    } catch (error) {
      this.toast.error('Export failed');
      console.error(error);
    }
  }

  private showSanitizeModal() {
    const pdfBytes = this.pdfBytes ? new Uint8Array(this.pdfBytes) : null;

    const modal = new SanitizeOptionsModal(
      pdfBytes,
      async (options: SanitizeOptions) => {
        // Export with sanitization
        this.toast.info('Exporting with sanitization...');
        try {
          await this.exportPdf(options);

          // Show success animation
          const successAnim = new SuccessAnimation();
          successAnim.show();

          this.toast.success('Export complete!');
        } catch (error) {
          this.toast.error('Export failed');
          console.error(error);
        }
      },
      () => {
        // Cancel - do nothing
      }
    );

    modal.show();
  }

  private async exportPdf(sanitizeOptions?: SanitizeOptions) {
    console.log('=== PDF Export Start ===');
    console.log('pdfDoc exists:', !!this.pdfDoc);
    console.log('pdfBytes exists:', !!this.pdfBytes);
    console.log('pdfBytes type:', typeof this.pdfBytes);
    console.log('pdfBytes value:', this.pdfBytes);
    console.log('Sanitization enabled:', !!sanitizeOptions);

    if (!this.pdfDoc || !this.pdfBytes) {
      console.error('Cannot export: missing pdfDoc or pdfBytes');
      console.error('pdfDoc:', this.pdfDoc);
      console.error('pdfBytes:', this.pdfBytes);
      this.toast.error('PDF not loaded properly. Please reload the file.');
      return;
    }

    const pageCount = this.totalPages || getPageCount(this.pdfDoc);
    console.log('PDF bytes length:', this.pdfBytes.byteLength);
    console.log('Pages with boxes:', Array.from(this.pageBoxes.entries()).map(([page, boxes]) => `Page ${page}: ${boxes.length} boxes`));
    console.log('Current page index:', this.currentPageIndex);
    console.log('Total pages:', pageCount);

    try {
      // CRITICAL SECURITY: Rasterize pages to remove text layer completely
      // This ensures redacted information cannot be recovered
      const canvases: HTMLCanvasElement[] = [];

      console.log('🔥🔥🔥 SECURITY MODE: RASTERIZATION 🔥🔥🔥');
      console.log('Rendering', pageCount, 'pages as images to DESTROY text layer...');

      for (let i = 0; i < pageCount; i++) {
        console.log(`\n📄 Processing page ${i + 1}/${pageCount}...`);

        // Render page to canvas at scale 2 for quality
        const { page, canvas, viewport } = await renderPageToCanvas(this.pdfDoc, i, 2);
        console.log(`  ✓ Rendered page to canvas: ${canvas.width}x${canvas.height}px`);

        // Get boxes for this page
        const boxes = this.pageBoxes.get(i) || [];
        console.log(`  ✓ Found ${boxes.length} redaction boxes for this page`);

        // Draw redaction boxes directly on canvas (IRREVERSIBLE)
        if (boxes.length > 0) {
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#000000'; // Opaque black

          for (let j = 0; j < boxes.length; j++) {
            const box = boxes[j];
            console.log(`    🖤 Drawing BLACK BOX ${j + 1}: x=${box.x.toFixed(1)}, y=${box.y.toFixed(1)}, w=${box.w.toFixed(1)}, h=${box.h.toFixed(1)}`);
            console.log(`       Text being DESTROYED: "${box.text}"`);

            // Draw filled black rectangle (no transparency)
            ctx.fillRect(box.x, box.y, box.w, box.h);
          }
          console.log(`  ✅ Applied ${boxes.length} IRREVERSIBLE black boxes directly to pixels`);
        } else {
          console.log(`  ℹ️  No redactions on this page`);
        }

        canvases.push(canvas);
      }

      console.log('\n🔒 Converting canvases to PNG images (text is now gone)...');

      // Export as new PDF with rasterized pages (NO TEXT LAYER)
      const pdfBytes = await exportPdfFromCanvases(canvases, {
        title: 'Redacted Document',
        author: 'Aegis Redact'
      });

      console.log('✅ SUCCESS: Created NEW PDF from images only');
      console.log('📊 Original PDF had text layer: YES');
      console.log('📊 New PDF has text layer: NO - DESTROYED');
      console.log('📊 Redacted information is: PERMANENTLY GONE');

      console.log('Export successful, output size:', pdfBytes.length);

      // Apply sanitization if requested
      let finalPdfBytes = pdfBytes;
      if (sanitizeOptions) {
        console.log('🧹 Applying PDF sanitization...');
        const sanitizeResult = await sanitizePDF(pdfBytes, sanitizeOptions);

        if (sanitizeResult.success && sanitizeResult.pdfBytes) {
          finalPdfBytes = sanitizeResult.pdfBytes;
          console.log('✅ Sanitization complete');
          console.log('   Removed:', sanitizeResult.removed);

          if (sanitizeResult.errors.length > 0) {
            console.warn('⚠️ Sanitization warnings:', sanitizeResult.errors);
          }
        } else {
          console.warn('⚠️ Sanitization failed, using unsanitized PDF');
          console.warn('Errors:', sanitizeResult.errors);
          this.toast.warning('Some sanitization steps failed. Check console for details.');
        }
      }

      // Store the exported PDF bytes for download
      this.lastExportedPdfBytes = finalPdfBytes;

      // Hide the canvas stage and show the PDF viewer
      const appContainer = this.appView?.querySelector('.app-container') as HTMLElement;
      if (appContainer) {
        appContainer.style.opacity = '1';
        appContainer.style.transition = 'opacity 0.3s ease';
        requestAnimationFrame(() => {
          appContainer.style.opacity = '0';
        });

        setTimeout(() => {
          appContainer.style.display = 'none';
          this.pdfViewer.show(finalPdfBytes);
        }, 300);
      }

      console.log('=== PDF Export End ===');
    } catch (error) {
      console.error('=== PDF Export Failed ===');
      console.error('Error details:', error);
      throw error;
    }
  }

  private async exportImage() {
    if (!this.currentImage) return;

    const boxes = this.canvasStage.getBoxes();
    const blob = await exportRedactedImage(this.currentImage, boxes);

    const originalName = this.files[this.currentFileIndex].file.name;
    const ext = originalName.split('.').pop();
    const newName = originalName.replace(`.${ext}`, `-redacted.${ext}`);

    await saveBlob(blob, newName);
  }

  private async exportTextDocument() {
    if (!this.currentDocument || !this.currentFormat) {
      this.toast.error('Document not loaded');
      return;
    }

    // Apply redactions to the document
    const boxes = this.pageBoxes.get(0) || [];
    if (boxes.length > 0) {
      // Convert Box[] to FormatBoundingBox[]
      const formatBoxes: FormatBoundingBox[] = boxes.map((box) => ({
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        text: box.text,
        line: box.line,
        row: box.row,
        column: box.column,
        source: 'manual' as const
      }));
      await this.currentFormat.redact(this.currentDocument, formatBoxes);
    }

    // Export the document
    const blob = await this.currentFormat.export(this.currentDocument);

    // Generate filename
    const originalName = this.files[this.currentFileIndex].file.name;
    const ext = originalName.split('.').pop();
    const newName = originalName.replace(`.${ext}`, `-redacted.${ext}`);

    await saveBlob(blob, newName);
  }

  private handleReset() {
    this.files = [];
    this.currentFileIndex = -1;
    this.pdfDoc = null;
    this.pdfBytes = null;
    this.currentImage = null;
    this.currentDocument = null;
    this.currentFormat = null;
    this.totalPages = 0;
    this.resetDetectionMaps();
    this.fileList.setFiles([]);
    this.canvasStage.setPageInfo(0, 1);

    this.dropZone.show();
    this.canvasStage.getElement().style.display = 'none';
    this.textViewer.getElement().style.display = 'none';
    this.redactionList.getElement().style.display = 'none';
    this.toolbar.enableExport(false);
    this.toolbar.showNewFileButton(false);

    // Just clear files, don't return to landing page
    // User can stay in the app and load new files via drop zone
  }

  private handleNewFile() {
    // Animate canvas stage out
    const canvasEl = this.canvasStage.getElement();
    canvasEl.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    canvasEl.style.opacity = '1';
    canvasEl.style.transform = 'scale(1)';

    requestAnimationFrame(() => {
      canvasEl.style.opacity = '0';
      canvasEl.style.transform = 'scale(0.95)';
    });

    setTimeout(() => {
      // Clear state
      this.files = [];
      this.currentFileIndex = -1;
      this.pdfDoc = null;
      this.pdfBytes = null;
      this.currentImage = null;
      this.currentDocument = null;
      this.currentFormat = null;
      this.lastExportedPdfBytes = null;
      this.totalPages = 0;
      this.resetDetectionMaps();
      this.fileList.setFiles([]);
      this.canvasStage.setPageInfo(0, 1);

      this.canvasStage.getElement().style.display = 'none';
      this.textViewer.getElement().style.display = 'none';
      this.toolbar.enableExport(false);
      this.toolbar.showNewFileButton(false);

      // Show drop zone with animation
      this.dropZone.show();
      const dropZoneEl = this.dropZone.getElement();
      dropZoneEl.style.opacity = '0';
      dropZoneEl.style.transform = 'scale(1.05)';
      dropZoneEl.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

      requestAnimationFrame(() => {
        dropZoneEl.style.opacity = '1';
        dropZoneEl.style.transform = 'scale(1)';
      });

      this.toast.info('Ready for new files');
    }, 300);
  }

  private openSettings() {
    const settings = new Settings(
      () => {
        // On close - nothing to do
      },
      async (enabled: boolean) => {
        // On ML toggle
        this.useML = enabled;
        console.log(`[App] ML detection ${enabled ? 'enabled' : 'disabled'}`);

        // If ML is enabled and we have a file loaded, ensure model is ready before rescanning
        if (enabled && this.currentFileIndex >= 0) {
          this.toast.info('Preparing ML model for detection...');

          // Wait for model to be ready before rescanning
          const mlReady = await this.ensureMLModelReady();

          if (mlReady) {
            this.toast.info('ML detection enabled. Re-scanning with AI-powered detection...');

            // Re-detect on current file with ML
            if (this.pdfDoc) {
              await this.loadFile(this.currentFileIndex);
            }
          } else {
            this.toast.warning('ML model unavailable. Using regex-only detection.');
          }
        } else if (!enabled && this.currentFileIndex >= 0) {
          // ML disabled, re-scan with regex-only
          this.toast.info('ML detection disabled. Re-scanning with regex patterns...');

          if (this.pdfDoc) {
            await this.loadFile(this.currentFileIndex);
          }
        }
      }
    );

    settings.show();
  }

  /**
   * Initialize cloud sync after authentication
   */
  private initializeCloudSync(): void {
    const user = this.authSession.getUser();
    if (!user) return;

    this.cloudSync = new CloudSyncService(this.authSession);

    // Show user menu
    this.userMenu = new UserMenu(
      user,
      () => void this.handleLogout(),
      () => this.handleShowDashboard()
    );

    this.toolbar.showUserMenu(this.userMenu.getElement());
  }

  /**
   * Show authentication modal
   */
  private handleShowAuth(): void {
    const modal = new AuthModal(
      () => modal.hide(),
      async (email, password) => {
        try {
          await this.authSession.login(email, password);
          modal.hide();
          this.initializeCloudSync();
          this.toast.success('Signed in successfully!');
        } catch (error) {
          throw error; // Let modal handle display
        }
      },
      async (email, password) => {
        try {
          await this.authSession.register(email, password);
          modal.hide();
          this.initializeCloudSync();
          this.toast.success('Account created successfully!');
        } catch (error) {
          throw error; // Let modal handle display
        }
      }
    );

    modal.show();
  }

  /**
   * Handle user logout
   */
  private async handleLogout(): Promise<void> {
    try {
      await this.authSession.logout();
      this.cloudSync = null;
      this.userMenu = null;
      this.toolbar.showLoginButton();
      this.toast.info('Signed out');
    } catch (error) {
      console.error('Logout error:', error);
      this.toast.error('Logout failed');
    }
  }

  /**
   * Show cloud file dashboard
   */
  private handleShowDashboard(): void {
    if (!this.cloudSync) {
      this.toast.error('Cloud sync not initialized');
      return;
    }

    const dashboard = new Dashboard(
      () => dashboard.hide(),
      async (fileId) => {
        // Download file
        try {
          const { data, filename } = await this.cloudSync!.downloadFile(fileId);
          const blob = new Blob([data], { type: 'application/pdf' });
          await saveBlob(blob, filename);
          this.toast.success('File downloaded!');
        } catch (error) {
          console.error('Download error:', error);
          this.toast.error('Download failed');
        }
      },
      async (fileId) => {
        // Delete file
        try {
          await this.cloudSync!.deleteFile(fileId);
          this.toast.success('File deleted');
        } catch (error) {
          console.error('Delete error:', error);
          this.toast.error('Delete failed');
        }
      },
      async () => {
        // Refresh file list
        try {
          return await this.cloudSync!.listFiles();
        } catch (error) {
          console.error('List files error:', error);
          this.toast.error('Failed to load files');
          return [];
        }
      },
      this.authSession
    );

    dashboard.show();
  }

  private async handlePdfDownload() {
    if (!this.lastExportedPdfBytes) {
      this.toast.error('No PDF to download');
      return;
    }

    try {
      const blob = new Blob([this.lastExportedPdfBytes], { type: 'application/pdf' });
      const originalName = this.files[this.currentFileIndex].file.name;
      const newName = originalName.replace('.pdf', '-redacted.pdf');

      await saveBlob(blob, newName);

      // Show success animation
      const successAnim = new SuccessAnimation();
      successAnim.show();

      this.toast.success('PDF downloaded successfully!');
    } catch (error) {
      this.toast.error('Failed to download PDF');
      console.error(error);
    }
  }

  private handlePdfViewerBack() {
    // Hide PDF viewer and show the editing view
    this.pdfViewer.hide();

    setTimeout(() => {
      const appContainer = this.appView?.querySelector('.app-container') as HTMLElement;
      if (appContainer) {
        appContainer.style.display = 'flex';
        appContainer.style.opacity = '0';
        appContainer.style.transition = 'opacity 0.3s ease';

        requestAnimationFrame(() => {
          appContainer.style.opacity = '1';
        });
      }
    }, 300);

    this.toast.info('Back to editing mode');
  }

  private async handleStartRedacting() {
    // Hide the PDF viewer
    this.pdfViewer.hide();

    // Show the canvas stage and redaction list after animation completes
    setTimeout(async () => {
      const appContainer = this.appView?.querySelector('.app-container') as HTMLElement;
      if (appContainer) {
        appContainer.style.display = 'flex';
        appContainer.style.opacity = '0';
        appContainer.style.transition = 'opacity 0.3s ease';

        requestAnimationFrame(() => {
          appContainer.style.opacity = '1';
        });
      }

      this.canvasStage.getElement().style.display = 'block';
      this.redactionList.getElement().style.display = 'block';
      this.toolbar.enableExport(true);

      // Load the PDF into the canvas-based editor
      if (this.currentFileIndex >= 0) {
        await this.loadFile(this.currentFileIndex);
        this.toast.info('Ready to redact. Draw boxes or use auto-detection.');
      }
    }, 300);
  }

  /**
   * Setup task queue event handlers
   */
  private setupTaskQueueHandlers(): void {
    // Set up the file processor
    this.taskQueue.setProcessor(async (task) => {
      return await this.processFileForBatch(task.fileIndex);
    });

    // Task start handler
    this.taskQueue.onTaskStart = (taskId) => {
      const task = this.taskQueue.getTask(taskId);
      if (task && this.batchProgressPanel) {
        this.batchProgressPanel.updateTask(task);
      }
    };

    // Task progress handler
    this.taskQueue.onTaskProgress = (taskId, progress) => {
      const task = this.taskQueue.getTask(taskId);
      if (task && this.batchProgressPanel) {
        this.batchProgressPanel.updateTask(task);
      }
    };

    // Task complete handler
    this.taskQueue.onTaskComplete = (taskId, result) => {
      const task = this.taskQueue.getTask(taskId);
      if (task && this.batchProgressPanel) {
        this.batchProgressPanel.updateTask(task);

        // Auto-download the file
        const fileName = task.fileName.replace(/\.(pdf|png|jpg|jpeg|webp)$/i, '-redacted.$1');
        saveBlob(result, fileName);
      }
    };

    // Task error handler
    this.taskQueue.onTaskError = (taskId, error) => {
      const task = this.taskQueue.getTask(taskId);
      if (task && this.batchProgressPanel) {
        this.batchProgressPanel.updateTask(task);
      }
      this.toast.error(`Failed to process ${task?.fileName}: ${error.message}`);
    };

    // Queue complete handler
    this.taskQueue.onQueueComplete = () => {
      const stats = this.taskQueue.getStats();
      this.toast.success(`Batch export complete! ${stats.success} files processed successfully.`);
      ariaAnnouncer.announce(`Batch export complete. ${stats.success} of ${stats.total} files processed successfully.`);
    };
  }

  /**
   * Handle batch export button click
   */
  private async handleBatchExport(): Promise<void> {
    if (this.files.length === 0) {
      this.toast.error('No files loaded');
      return;
    }

    if (this.files.length === 1) {
      // Single file - use normal export
      this.toast.info('Only one file loaded. Use the regular Export button.');
      return;
    }

    // Create and show batch progress panel
    this.batchProgressPanel = new BatchProgressPanel();

    // Setup panel event handlers
    this.batchProgressPanel.onPause = () => {
      this.taskQueue.pause();
      this.toast.info('Batch processing paused');
    };

    this.batchProgressPanel.onResume = () => {
      this.taskQueue.resume();
      this.toast.info('Batch processing resumed');
    };

    this.batchProgressPanel.onCancel = () => {
      this.taskQueue.cancelAll();
      this.toast.info('Batch processing cancelled');
    };

    this.batchProgressPanel.onRetry = (taskId) => {
      this.taskQueue.retry(taskId);
      this.toast.info('Retrying failed task...');
    };

    this.batchProgressPanel.onClose = () => {
      this.batchProgressPanel = null;
    };

    this.batchProgressPanel.show();

    // Enqueue all files
    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i];
      const taskId = this.taskQueue.enqueue(i, file.file.name);

      const task = this.taskQueue.getTask(taskId);
      if (task) {
        this.batchProgressPanel.addTask(task);
      }
    }

    this.toast.info(`Processing ${this.files.length} files...`);
    ariaAnnouncer.announce(`Started batch processing ${this.files.length} files`);
  }

  /**
   * Process a single file for batch export
   */
  private async processFileForBatch(fileIndex: number): Promise<Blob> {
    const item = this.files[fileIndex];
    if (!item) {
      throw new Error('File not found');
    }

    // Load the file
    await this.loadFileInternal(fileIndex);

    // Run detection if enabled
    const detectionEnabled = this.toolbar.getOptions().findEmails ||
                            this.toolbar.getOptions().findPhones ||
                            this.toolbar.getOptions().findSSNs ||
                            this.toolbar.getOptions().findCards;

    if (detectionEnabled) {
      await this.detectPII();
    }

    // Export based on file type
    if (item.file.type === 'application/pdf') {
      return await this.exportPdfToBlob();
    } else if (item.file.type.startsWith('image/')) {
      return await this.exportImageToBlob();
    } else if (FormatRegistry.isSupported(item.file)) {
      return await this.exportTextDocumentToBlob();
    }

    throw new Error('Unsupported file type');
  }

  /**
   * Internal file loading without UI updates
   */
  private async loadFileInternal(index: number): Promise<void> {
    // Similar to loadFile but without UI updates for batch processing
    // This is a simplified version focused on loading data
    const item = this.files[index];
    if (!item) return;

    this.currentFileIndex = index;

    if (item.file.type === 'application/pdf') {
      const arrayBuffer = await item.file.arrayBuffer();
      this.pdfBytes = arrayBuffer;
      this.pdfDoc = await loadPdf(arrayBuffer);
      this.totalPages = getPageCount(this.pdfDoc);
      this.currentPageIndex = 0;
    } else if (item.file.type.startsWith('image/')) {
      this.currentImage = await loadImage(item.file);
    }
  }

  /**
   * Export PDF as Blob (without showing PDF viewer)
   */
  private async exportPdfToBlob(): Promise<Blob> {
    if (!this.pdfDoc || !this.pdfBytes) {
      throw new Error('PDF not loaded');
    }

    const pageCount = this.totalPages || getPageCount(this.pdfDoc);
    const canvases: HTMLCanvasElement[] = [];

    for (let i = 0; i < pageCount; i++) {
      const { canvas } = await renderPageToCanvas(this.pdfDoc, i, 2);
      const boxes = this.pageBoxes.get(i) || [];

      if (boxes.length > 0) {
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#000000';

        for (const box of boxes) {
          ctx.fillRect(box.x, box.y, box.w, box.h);
        }
      }

      canvases.push(canvas);
    }

    const pdfBytes = await exportPdfFromCanvases(canvases, {
      title: 'Redacted Document',
      author: 'Aegis Redact'
    });

    return new Blob([pdfBytes], { type: 'application/pdf' });
  }

  /**
   * Export image as Blob
   */
  private async exportImageToBlob(): Promise<Blob> {
    if (!this.currentImage) {
      throw new Error('Image not loaded');
    }

    const boxes = this.pageBoxes.get(0) || [];
    return await exportRedactedImage(this.currentImage, boxes);
  }

  /**
   * Export text document as Blob
   */
  private async exportTextDocumentToBlob(): Promise<Blob> {
    if (!this.currentDocument || !this.currentFormat) {
      throw new Error('Document not loaded');
    }

    const boxes = this.pageBoxes.get(0) || [];
    if (boxes.length > 0) {
      await this.currentFormat.redact(this.currentDocument, boxes);
    }

    return await this.currentFormat.export(this.currentDocument);
  }
}

export function initApp(container: HTMLElement) {
  new App(container);
}

type DetectionWithNormalization = DetectionResult & {
  normalizedText: string;
  digitsOnly: string;
};

function normalizeDetectionText(value: string | undefined): string {
  if (!value) {
    return '';
  }

  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\u00A0]+/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
}

function extractDigits(value: string | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

function detectionTextsOverlap(
  normalizedCandidate: string,
  normalizedTarget: string,
  candidateDigits: string,
  targetDigits: string
): boolean {
  if (normalizedCandidate && normalizedTarget) {
    if (normalizedCandidate === normalizedTarget) {
      return true;
    }

    if (normalizedCandidate.length > 3 && normalizedTarget.includes(normalizedCandidate)) {
      return true;
    }

    if (normalizedTarget.length > 3 && normalizedCandidate.includes(normalizedTarget)) {
      return true;
    }
  }

  if (candidateDigits && targetDigits && candidateDigits.length >= 4 && candidateDigits === targetDigits) {
    return true;
  }

  return false;
}

function doesTextMatchDetections(text: string, detections: DetectionWithNormalization[]): boolean {
  const normalized = normalizeDetectionText(text);
  const digits = extractDigits(text);
  if (!normalized && !digits) return false;

  return detections.some((detection) =>
    detectionTextsOverlap(normalized, detection.normalizedText, digits, detection.digitsOnly)
  );
}

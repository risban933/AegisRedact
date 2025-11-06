/**
 * Main application component
 */

import { LandingPage } from './components/LandingPage';
import { DropZone } from './components/DropZone';
import { Toolbar, type ToolbarOptions } from './components/Toolbar';
import { FileList, type FileItem } from './components/FileList';
import { CanvasStage } from './components/CanvasStage';
import { RedactionList } from './components/RedactionList';
import { Toast } from './components/Toast';
import { SuccessAnimation } from './components/SuccessAnimation';
import { ProgressBar } from './components/ProgressBar';
import { PdfViewer } from './components/PdfViewer';
import { Settings } from './components/Settings';

import { loadPdf, renderPageToCanvas, getPageCount } from '../lib/pdf/load';
import { findTextBoxes, extractPageText } from '../lib/pdf/find';
import { expandBoxes } from '../lib/pdf/redact';
import { exportPdfFromCanvases } from '../lib/pdf/export';
import { ocrCanvas, shouldSuggestOCR } from '../lib/pdf/ocr';

import { loadImage } from '../lib/images/exif';
import { exportRedactedImage } from '../lib/images/redact';

import { detectAllPII } from '../lib/detect/patterns';
import { loadMLModel, isMLAvailable } from '../lib/detect/ml';
import { saveBlob } from '../lib/fs/io';

import type { Box } from '../lib/pdf/find';

export class App {
  private container: HTMLElement;
  private landingPage: LandingPage;
  private appView: HTMLElement | null = null;
  private dropZone: DropZone;
  private toolbar: Toolbar;
  private fileList: FileList;
  private canvasStage: CanvasStage;
  private redactionList: RedactionList;
  private toast: Toast;
  private pdfViewer: PdfViewer;
  private lastExportedPdfBytes: Uint8Array | null = null;

  private files: FileItem[] = [];
  private currentFileIndex: number = -1;
  private currentPageIndex: number = 0;
  private pdfDoc: any = null;
  private pdfBytes: ArrayBuffer | null = null; // Store original PDF bytes for export
  private currentImage: HTMLImageElement | null = null;
  private detectedBoxes: Box[] = [];
  private pageBoxes: Map<number, Box[]> = new Map(); // Track boxes per page
  private useML: boolean = false; // ML detection toggle
  private mlLoadPromise: Promise<boolean> | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.toast = new Toast();

    // Load ML preference from localStorage
    this.useML = localStorage.getItem('ml-detection-enabled') === 'true';

    // Create landing page
    this.landingPage = new LandingPage(() => this.showApp());

    // Create app components
    this.dropZone = new DropZone((files) => this.handleFiles(files));
    this.toolbar = new Toolbar(
      (options) => this.handleToolbarChange(options),
      () => this.handleExport(),
      () => this.handleReset(),
      () => this.handleNewFile(),
      () => this.openSettings()
    );
    this.fileList = new FileList((index) => this.handleFileSelect(index));
    this.canvasStage = new CanvasStage((boxes) => this.handleBoxesChange(boxes));
    this.redactionList = new RedactionList((items) => {
      const boxes = items.filter(i => i.enabled);
      this.canvasStage.setBoxes(boxes);
    });
    this.pdfViewer = new PdfViewer(
      () => this.handlePdfDownload(),
      () => this.handlePdfViewerBack()
    );

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

    appContainer.appendChild(sidebar);
    appContainer.appendChild(main);
    this.appView.appendChild(appContainer);
    this.appView.appendChild(this.pdfViewer.getElement());

    this.container.appendChild(this.appView);

    // Initially hide canvas stage and redaction list
    this.canvasStage.getElement().style.display = 'none';
    this.redactionList.getElement().style.display = 'none';
  }

  private showApp(): void {
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
      }
    }

    if (fileItems.length > 0) {
      this.files = fileItems;
      this.fileList.setFiles(fileItems);
      this.dropZone.hide();
      this.canvasStage.getElement().style.display = 'block';
      this.redactionList.getElement().style.display = 'block';
      this.toolbar.enableExport(true);
      this.toolbar.showNewFileButton(true);

      // Auto-select first file
      this.currentFileIndex = 0;
      await this.loadFile(0);

      this.toast.success(`Loaded ${fileItems.length} file(s)`);
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

      this.pageBoxes.clear(); // Clear boxes when loading new PDF
      await this.renderPdfPage(0);
      await this.detectPII();

      // Detect PII on all pages in the background
      const pageCount = getPageCount(this.pdfDoc);
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
    this.detectedBoxes = existingBoxes;
    this.canvasStage.setBoxes(existingBoxes);
    this.redactionList.setItems(existingBoxes);
  }

  private async loadImage(file: File) {
    try {
      const img = await loadImage(file);
      this.currentImage = img;

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      this.canvasStage.setImage(canvas);

      // For images, we could run OCR if enabled
      const options = this.toolbar.getOptions();
      if (options.useOCR) {
        this.toast.info('Running OCR on image...');
        const text = await ocrCanvas(canvas);
        await this.detectPIIInText(text, canvas);
      }
    } catch (error) {
      this.toast.error('Failed to load image');
      console.error(error);
    }
  }

  private async detectPII() {
    const stage = this.canvasStage as any;
    const page = stage.currentPage;
    const viewport = stage.currentViewport;

    if (!page || !viewport) return;

    const options = this.toolbar.getOptions();
    const text = await extractPageText(page);

    // Check if OCR is needed
    if (options.useOCR && (await shouldSuggestOCR(page))) {
      this.toast.info('Running OCR (low text detected)...');
      const canvas = this.canvasStage.getCanvas();
      const ocrText = await ocrCanvas(canvas);
      await this.detectPIIInText(text + ' ' + ocrText, canvas, page, viewport);
    } else {
      await this.detectPIIInText(text, null, page, viewport);
    }
  }

  private async detectPIIInText(
    text: string,
    canvas: HTMLCanvasElement | null = null,
    page: any = null,
    viewport: any = null
  ) {
    console.log('=== PII Detection Start ===');
    console.log('Text length:', text.length);
    console.log('Text preview:', text.substring(0, 200));

    const options = this.toolbar.getOptions();
    console.log('Detection options:', options);
    console.log('ML detection enabled:', this.useML);

    const mlReady = this.useML ? await this.ensureMLModelReady() : false;
    console.log('ML ready for this run:', mlReady);

    // Use unified detection function
    const foundTerms = await detectAllPII(text, {
      findEmails: options.findEmails,
      findPhones: options.findPhones,
      findSSNs: options.findSSNs,
      findCards: options.findCards,
      useML: this.useML && mlReady,
      mlMinConfidence: 0.8
    });

    console.log('Total terms found:', foundTerms.length, foundTerms);

    // Find boxes for these terms
    let boxes: Box[] = [];

    if (page && viewport) {
      console.log('Finding text boxes with viewport:', viewport.scale);
      boxes = await findTextBoxes(page, viewport, (str) => {
        // Match if the text item contains a full term OR if the text item IS the term
        // This prevents partial matches like "2" matching "626"
        const matches = foundTerms.some((term) => {
          // Exact match
          if (str === term) return true;
          // Text contains the full term (e.g., email in a sentence)
          if (str.includes(term)) return true;
          // Term is longer and contains this text (for multi-word matches)
          // But only if this text is substantial (>3 chars) to avoid false positives
          if (str.length > 3 && term.includes(str)) return true;
          return false;
        });
        if (matches) {
          console.log('Matched text:', str, 'for term:', foundTerms.find(t => str === t || str.includes(t) || (str.length > 3 && t.includes(str))));
        }
        return matches;
      });
      console.log('Found boxes:', boxes.length, boxes);
    } else {
      console.warn('No page or viewport provided for box detection');
    }

    // Expand boxes slightly for better coverage
    this.detectedBoxes = expandBoxes(boxes, 4);
    console.log('Expanded boxes:', this.detectedBoxes.length);

    // Store boxes for current page
    this.pageBoxes.set(this.currentPageIndex, this.detectedBoxes);
    console.log('Stored boxes for page', this.currentPageIndex, '- total pages with boxes:', this.pageBoxes.size);

    this.redactionList.setItems(this.detectedBoxes);
    this.canvasStage.setBoxes(this.detectedBoxes);

    this.toast.success(`Found ${this.detectedBoxes.length} potential matches`);
    console.log('=== PII Detection End ===');
  }

  private async detectPIIOnAllPages() {
    if (!this.pdfDoc) return;

    const pageCount = getPageCount(this.pdfDoc);
    const options = this.toolbar.getOptions();
    const mlReady = this.useML ? await this.ensureMLModelReady() : false;

    // Show progress bar for multi-page documents
    const progressBar = new ProgressBar();
    if (pageCount > 3) {
      progressBar.show('Scanning pages for sensitive information...');
    }

    // Process each page (skip page 0 since we already processed it)
    for (let i = 1; i < pageCount; i++) {
      // Update progress
      if (pageCount > 3) {
        const progress = ((i + 1) / pageCount) * 100;
        progressBar.update(progress, i + 1, pageCount);
      }

      const { page, viewport } = await renderPageToCanvas(this.pdfDoc, i, 2);
      const text = await extractPageText(page);

      // Use unified detection function
      const foundTerms = await detectAllPII(text, {
        findEmails: options.findEmails,
        findPhones: options.findPhones,
        findSSNs: options.findSSNs,
        findCards: options.findCards,
        useML: this.useML && mlReady,
        mlMinConfidence: 0.8
      });

      // Find and store boxes for this page
      if (foundTerms.length > 0) {
        const boxes = await findTextBoxes(page, viewport, (str) =>
          foundTerms.some((term) => str.includes(term) || term.includes(str))
        );
        const expandedBoxes = expandBoxes(boxes, 4);
        this.pageBoxes.set(i, expandedBoxes);
      }
    }

    // Hide progress bar
    if (pageCount > 3) {
      progressBar.hide();
    }
  }

  private handleToolbarChange(options: ToolbarOptions) {
    // Re-run detection with new options
    if (this.currentFileIndex >= 0) {
      this.detectPII();
    }
  }

  private handleFileSelect(index: number) {
    this.loadFile(index);
  }

  private handleBoxesChange(boxes: Box[]) {
    // Manual boxes added/changed
    this.detectedBoxes = boxes;
    // Update the page boxes map
    this.pageBoxes.set(this.currentPageIndex, boxes);
  }

  private async handleExport() {
    const item = this.files[this.currentFileIndex];
    if (!item) return;

    this.toast.info('Exporting...');

    try {
      if (item.file.type === 'application/pdf') {
        await this.exportPdf();
      } else if (item.file.type.startsWith('image/')) {
        await this.exportImage();
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

  private async exportPdf() {
    console.log('=== PDF Export Start ===');
    console.log('pdfDoc exists:', !!this.pdfDoc);
    console.log('pdfBytes exists:', !!this.pdfBytes);
    console.log('pdfBytes type:', typeof this.pdfBytes);
    console.log('pdfBytes value:', this.pdfBytes);

    if (!this.pdfDoc || !this.pdfBytes) {
      console.error('Cannot export: missing pdfDoc or pdfBytes');
      console.error('pdfDoc:', this.pdfDoc);
      console.error('pdfBytes:', this.pdfBytes);
      this.toast.error('PDF not loaded properly. Please reload the file.');
      return;
    }

    console.log('PDF bytes length:', this.pdfBytes.byteLength);
    console.log('Pages with boxes:', Array.from(this.pageBoxes.entries()).map(([page, boxes]) => `Page ${page}: ${boxes.length} boxes`));
    console.log('Current page index:', this.currentPageIndex);
    console.log('Total pages:', getPageCount(this.pdfDoc));

    try {
      // CRITICAL SECURITY: Rasterize pages to remove text layer completely
      // This ensures redacted information cannot be recovered
      const pageCount = getPageCount(this.pdfDoc);
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

      // Store the exported PDF bytes for download
      this.lastExportedPdfBytes = pdfBytes;

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
          this.pdfViewer.show(pdfBytes);
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

  private handleReset() {
    this.files = [];
    this.currentFileIndex = -1;
    this.pdfDoc = null;
    this.pdfBytes = null;
    this.currentImage = null;
    this.detectedBoxes = [];
    this.pageBoxes.clear();

    this.fileList.setFiles([]);
    this.redactionList.setItems([]);
    this.canvasStage.setBoxes([]);

    this.dropZone.show();
    this.canvasStage.getElement().style.display = 'none';
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
      this.detectedBoxes = [];
      this.pageBoxes.clear();
      this.lastExportedPdfBytes = null;

      this.fileList.setFiles([]);
      this.redactionList.setItems([]);
      this.canvasStage.setBoxes([]);

      this.canvasStage.getElement().style.display = 'none';
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
}

export function initApp(container: HTMLElement) {
  new App(container);
}

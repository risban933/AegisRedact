/**
 * Main application component
 */

import { DropZone } from './components/DropZone';
import { Toolbar, type ToolbarOptions } from './components/Toolbar';
import { FileList, type FileItem } from './components/FileList';
import { CanvasStage } from './components/CanvasStage';
import { RedactionList } from './components/RedactionList';
import { Toast } from './components/Toast';

import { loadPdf, renderPageToCanvas, getPageCount } from '../lib/pdf/load';
import { findTextBoxes, extractPageText } from '../lib/pdf/find';
import { applyBoxes, expandBoxes } from '../lib/pdf/redact';
import { exportPdfFromCanvases } from '../lib/pdf/export';
import { ocrCanvas, shouldSuggestOCR } from '../lib/pdf/ocr';

import { loadImage } from '../lib/images/exif';
import { exportRedactedImage } from '../lib/images/redact';

import { findEmails, findPhones, findSSNs, findLikelyPANs } from '../lib/detect/patterns';
import { saveBlob } from '../lib/fs/io';

import type { Box } from '../lib/pdf/find';

export class App {
  private container: HTMLElement;
  private dropZone: DropZone;
  private toolbar: Toolbar;
  private fileList: FileList;
  private canvasStage: CanvasStage;
  private redactionList: RedactionList;
  private toast: Toast;

  private files: FileItem[] = [];
  private currentFileIndex: number = -1;
  private currentPageIndex: number = 0;
  private pdfDoc: any = null;
  private currentImage: HTMLImageElement | null = null;
  private detectedBoxes: Box[] = [];
  private pageBoxes: Map<number, Box[]> = new Map(); // Track boxes per page

  constructor(container: HTMLElement) {
    this.container = container;
    this.toast = new Toast();

    this.dropZone = new DropZone((files) => this.handleFiles(files));
    this.toolbar = new Toolbar(
      (options) => this.handleToolbarChange(options),
      () => this.handleExport(),
      () => this.handleReset()
    );
    this.fileList = new FileList((index) => this.handleFileSelect(index));
    this.canvasStage = new CanvasStage((boxes) => this.handleBoxesChange(boxes));
    this.redactionList = new RedactionList((items) => {
      const boxes = items.filter(i => i.enabled);
      this.canvasStage.setBoxes(boxes);
    });

    this.render();
  }

  private render() {
    this.container.className = 'app-container';

    const sidebar = document.createElement('div');
    sidebar.className = 'app-sidebar';
    sidebar.appendChild(this.toolbar.getElement());
    sidebar.appendChild(this.fileList.getElement());
    sidebar.appendChild(this.redactionList.getElement());

    const main = document.createElement('div');
    main.className = 'app-main';
    main.appendChild(this.dropZone.getElement());
    main.appendChild(this.canvasStage.getElement());

    this.container.appendChild(sidebar);
    this.container.appendChild(main);

    // Initially hide canvas stage
    this.canvasStage.getElement().style.display = 'none';
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
      this.toolbar.enableExport(true);

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
      const arrayBuffer = await file.arrayBuffer();
      this.pdfDoc = await loadPdf(arrayBuffer);
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
      console.error(error);
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
    const options = this.toolbar.getOptions();
    const foundTerms: string[] = [];

    if (options.findEmails) {
      foundTerms.push(...findEmails(text));
    }

    if (options.findPhones) {
      foundTerms.push(...findPhones(text));
    }

    if (options.findSSNs) {
      foundTerms.push(...findSSNs(text));
    }

    if (options.findCards) {
      foundTerms.push(...findLikelyPANs(text));
    }

    // Find boxes for these terms
    let boxes: Box[] = [];

    if (page && viewport) {
      boxes = await findTextBoxes(page, viewport, (str) =>
        foundTerms.some((term) => str.includes(term) || term.includes(str))
      );
    }

    // Expand boxes slightly for better coverage
    this.detectedBoxes = expandBoxes(boxes, 4);

    // Store boxes for current page
    this.pageBoxes.set(this.currentPageIndex, this.detectedBoxes);

    this.redactionList.setItems(this.detectedBoxes);
    this.canvasStage.setBoxes(this.detectedBoxes);

    this.toast.success(`Found ${this.detectedBoxes.length} potential matches`);
  }

  private async detectPIIOnAllPages() {
    if (!this.pdfDoc) return;

    const pageCount = getPageCount(this.pdfDoc);
    const options = this.toolbar.getOptions();

    // Process each page (skip page 0 since we already processed it)
    for (let i = 1; i < pageCount; i++) {
      const { page, viewport } = await renderPageToCanvas(this.pdfDoc, i, 2);
      const text = await extractPageText(page);

      // Find sensitive terms
      const foundTerms: string[] = [];
      if (options.findEmails) foundTerms.push(...findEmails(text));
      if (options.findPhones) foundTerms.push(...findPhones(text));
      if (options.findSSNs) foundTerms.push(...findSSNs(text));
      if (options.findCards) foundTerms.push(...findLikelyPANs(text));

      // Find and store boxes for this page
      if (foundTerms.length > 0) {
        const boxes = await findTextBoxes(page, viewport, (str) =>
          foundTerms.some((term) => str.includes(term) || term.includes(str))
        );
        const expandedBoxes = expandBoxes(boxes, 4);
        this.pageBoxes.set(i, expandedBoxes);
      }
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

      this.toast.success('Export complete!');
    } catch (error) {
      this.toast.error('Export failed');
      console.error(error);
    }
  }

  private async exportPdf() {
    if (!this.pdfDoc) return;

    const pageCount = getPageCount(this.pdfDoc);
    const canvases: HTMLCanvasElement[] = [];

    for (let i = 0; i < pageCount; i++) {
      const { canvas } = await renderPageToCanvas(this.pdfDoc, i, 2);

      // Get boxes for this specific page from the map
      const boxes = this.pageBoxes.get(i) || [];
      const redactedCanvas = applyBoxes(canvas, boxes);

      canvases.push(redactedCanvas);
    }

    const pdfBytes = await exportPdfFromCanvases(canvases, {
      title: 'Redacted Document',
      author: 'Share-Safe Toolkit'
    });

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const originalName = this.files[this.currentFileIndex].file.name;
    const newName = originalName.replace('.pdf', '-redacted.pdf');

    await saveBlob(blob, newName);
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
    this.currentImage = null;
    this.detectedBoxes = [];
    this.pageBoxes.clear();

    this.fileList.setFiles([]);
    this.redactionList.setItems([]);
    this.canvasStage.setBoxes([]);

    this.dropZone.show();
    this.canvasStage.getElement().style.display = 'none';
    this.toolbar.enableExport(false);
  }
}

export function initApp(container: HTMLElement) {
  new App(container);
}

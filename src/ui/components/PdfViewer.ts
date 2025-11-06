/**
 * Native PDF viewer component using browser's built-in PDF renderer
 * Displays the redacted PDF in an iframe for preview before download
 */

export class PdfViewer {
  private element: HTMLDivElement;
  private iframe: HTMLIFrameElement;
  private blobUrl: string | null = null;
  private onDownload: () => void;
  private onBack: () => void;

  constructor(onDownload: () => void, onBack: () => void) {
    this.onDownload = onDownload;
    this.onBack = onBack;
    this.element = this.createViewer();
    this.iframe = this.element.querySelector('iframe')!;
  }

  private createViewer(): HTMLDivElement {
    const viewer = document.createElement('div');
    viewer.className = 'pdf-viewer';
    viewer.style.display = 'none';

    viewer.innerHTML = `
      <div class="pdf-viewer-header">
        <div class="pdf-viewer-title">
          <h2>Redacted PDF Preview</h2>
          <p>Your document has been redacted. Review it below.</p>
        </div>
        <div class="pdf-viewer-actions">
          <button id="pdf-back-btn" class="btn btn-secondary" aria-label="Back to editing">
            <span>← Back to Edit</span>
          </button>
          <button id="pdf-download-btn" class="btn btn-primary" aria-label="Download redacted PDF">
            <span>Download PDF</span>
          </button>
        </div>
      </div>
      <div class="pdf-viewer-content">
        <iframe
          title="Redacted PDF Preview"
          frameborder="0"
          width="100%"
          height="100%"
        ></iframe>
      </div>
    `;

    // Setup event listeners
    viewer.querySelector('#pdf-download-btn')?.addEventListener('click', () => {
      this.onDownload();
    });

    viewer.querySelector('#pdf-back-btn')?.addEventListener('click', () => {
      this.onBack();
    });

    return viewer;
  }

  /**
   * Display a PDF from bytes using browser's native viewer
   */
  show(pdfBytes: Uint8Array) {
    // Clean up previous blob URL if it exists
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
    }

    // Create blob and URL
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    this.blobUrl = URL.createObjectURL(blob);

    // Set iframe source
    this.iframe.src = this.blobUrl;

    // Show the viewer with animation
    this.element.style.display = 'flex';
    this.element.style.opacity = '0';
    this.element.style.transform = 'scale(1.05)';
    this.element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

    requestAnimationFrame(() => {
      this.element.style.opacity = '1';
      this.element.style.transform = 'scale(1)';
    });
  }

  /**
   * Hide the viewer and clean up resources
   */
  hide() {
    // Animate out
    this.element.style.opacity = '1';
    this.element.style.transform = 'scale(1)';
    this.element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

    requestAnimationFrame(() => {
      this.element.style.opacity = '0';
      this.element.style.transform = 'scale(0.95)';
    });

    setTimeout(() => {
      this.element.style.display = 'none';

      // Clean up blob URL
      if (this.blobUrl) {
        URL.revokeObjectURL(this.blobUrl);
        this.blobUrl = null;
      }

      // Clear iframe
      this.iframe.src = '';
    }, 300);
  }

  getElement(): HTMLDivElement {
    return this.element;
  }

  /**
   * Clean up resources when component is destroyed
   */
  destroy() {
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
  }
}

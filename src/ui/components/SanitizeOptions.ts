/**
 * Sanitize Options Modal
 *
 * UI for configuring PDF sanitization options before export.
 * Allows users to selectively remove metadata, annotations, forms, etc.
 */

import type { SanitizeOptions } from '../../lib/pdf/sanitize';
import { analyzePDF } from '../../lib/pdf/sanitize';

export interface SanitizeOptionsConfig extends SanitizeOptions {
  // UI state
}

export class SanitizeOptionsModal {
  private element: HTMLElement;
  private options: SanitizeOptions;
  private onApply: (options: SanitizeOptions) => void;
  private onCancel: () => void;

  // Analysis results
  private analysis: {
    hasMetadata: boolean;
    annotationCount: number;
    formFieldCount: number;
    hyperlinkCount: number;
    hasXMPMetadata: boolean;
    attachmentCount: number;
    javaScriptCount: number;
    embeddedFileCount: number;
  } | null = null;

  constructor(
    pdfBytes: Uint8Array | null,
    onApply: (options: SanitizeOptions) => void,
    onCancel: () => void
  ) {
    this.onApply = onApply;
    this.onCancel = onCancel;

    // Load saved options or use defaults
    this.options = this.loadOptions();

    // Analyze PDF if provided
    if (pdfBytes) {
      this.analyzePDFContent(pdfBytes);
    }

    this.element = this.createModal();
    this.attachEventListeners();
  }

  /**
   * Analyze PDF content to show what can be sanitized
   */
  private async analyzePDFContent(pdfBytes: Uint8Array): Promise<void> {
    try {
      this.analysis = await analyzePDF(pdfBytes);
      this.updateAnalysisDisplay();
    } catch (error) {
      console.warn('Failed to analyze PDF:', error);
    }
  }

  /**
   * Update the analysis display
   */
  private updateAnalysisDisplay(): void {
    if (!this.analysis) return;

    const analysisSection = this.element.querySelector('.sanitize-analysis');
    if (!analysisSection) return;

    const items: string[] = [];

    if (this.analysis.hasMetadata) {
      items.push('Document metadata found');
    }

    if (this.analysis.annotationCount > 0) {
      items.push(`${this.analysis.annotationCount} annotation(s)`);
    }

    if (this.analysis.formFieldCount > 0) {
      items.push(`${this.analysis.formFieldCount} form field(s)`);
    }

    if (this.analysis.hyperlinkCount > 0) {
      items.push(`${this.analysis.hyperlinkCount} hyperlink(s)`);
    }

    if (this.analysis.hasXMPMetadata) {
      items.push('XMP metadata stream');
    }

    if (this.analysis.attachmentCount > 0) {
      items.push(`${this.analysis.attachmentCount} attachment(s)`);
    }

    if (this.analysis.javaScriptCount > 0) {
      items.push(`${this.analysis.javaScriptCount} JavaScript action(s)`);
    }

    if (this.analysis.embeddedFileCount > 0) {
      items.push(`${this.analysis.embeddedFileCount} embedded file(s)`);
    }

    if (items.length === 0) {
      analysisSection.innerHTML = `
        <div class="analysis-clean">
           No potentially sensitive metadata found
        </div>
      `;
    } else {
      analysisSection.innerHTML = `
        <div class="analysis-found">
          <strong>Found in document:</strong>
          <ul>
            ${items.map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>
      `;
    }
  }

  /**
   * Create the modal element
   */
  private createModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'sanitize-title');
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML = `
      <div class="modal-container sanitize-modal">
        <div class="modal-header">
          <h2 id="sanitize-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
            Document Sanitization
          </h2>
          <button class="modal-close" aria-label="Close" data-action="close">×</button>
        </div>

        <div class="modal-body">
          <p class="modal-description">
            Remove potentially sensitive metadata and embedded content from your PDF before exporting.
            This enhances privacy by stripping information that may reveal the document's origins or editing history.
          </p>

          <!-- Analysis Section -->
          <div class="sanitize-analysis">
            <div class="analysis-loading">Analyzing document...</div>
          </div>

          <!-- Options -->
          <div class="sanitize-options-grid">
            <!-- Metadata -->
            <label class="sanitize-option">
              <input
                type="checkbox"
                name="stripMetadata"
                ${this.options.stripMetadata ? 'checked' : ''}
                aria-describedby="desc-metadata"
              />
              <div class="option-content">
                <div class="option-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                  Strip Metadata
                </div>
                <div class="option-description" id="desc-metadata">
                  Remove author, title, subject, keywords, creation date, and other document properties
                </div>
              </div>
            </label>

            <!-- Annotations -->
            <label class="sanitize-option">
              <input
                type="checkbox"
                name="removeAnnotations"
                ${this.options.removeAnnotations ? 'checked' : ''}
                aria-describedby="desc-annotations"
              />
              <div class="option-content">
                <div class="option-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Remove Annotations
                </div>
                <div class="option-description" id="desc-annotations">
                  Delete comments, highlights, stamps, and other markup added to the PDF
                </div>
              </div>
            </label>

            <!-- Form Fields -->
            <label class="sanitize-option">
              <input
                type="checkbox"
                name="removeFormFields"
                ${this.options.removeFormFields ? 'checked' : ''}
                aria-describedby="desc-forms"
              />
              <div class="option-content">
                <div class="option-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <line x1="9" y1="9" x2="15" y2="9"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                  Clear Form Fields
                </div>
                <div class="option-description" id="desc-forms">
                  Remove interactive form fields and their data
                </div>
              </div>
            </label>

            <!-- Hyperlinks -->
            <label class="sanitize-option">
              <input
                type="checkbox"
                name="stripHyperlinks"
                ${this.options.stripHyperlinks ? 'checked' : ''}
                aria-describedby="desc-links"
              />
              <div class="option-content">
                <div class="option-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  Strip Hyperlinks
                </div>
                <div class="option-description" id="desc-links">
                  Remove all clickable links and URI actions
                </div>
              </div>
            </label>

            <!-- XMP Metadata -->
            <label class="sanitize-option">
              <input
                type="checkbox"
                name="removeXMPMetadata"
                ${this.options.removeXMPMetadata ? 'checked' : ''}
                aria-describedby="desc-xmp"
              />
              <div class="option-content">
                <div class="option-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="16 18 22 12 16 6"/>
                    <polyline points="8 6 2 12 8 18"/>
                  </svg>
                  Remove XMP Metadata
                </div>
                <div class="option-description" id="desc-xmp">
                  Delete Adobe XMP metadata streams (extended metadata)
                </div>
              </div>
            </label>

            <!-- Attachments -->
            <label class="sanitize-option">
              <input
                type="checkbox"
                name="removeAttachments"
                ${this.options.removeAttachments ? 'checked' : ''}
                aria-describedby="desc-attachments"
              />
              <div class="option-content">
                <div class="option-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                  Remove Attachments
                </div>
                <div class="option-description" id="desc-attachments">
                  Delete all file attachments embedded in the PDF
                </div>
              </div>
            </label>

            <!-- JavaScript -->
            <label class="sanitize-option">
              <input
                type="checkbox"
                name="removeJavaScript"
                ${this.options.removeJavaScript ? 'checked' : ''}
                aria-describedby="desc-javascript"
              />
              <div class="option-content">
                <div class="option-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="16 18 22 12 16 6"/>
                    <polyline points="8 6 2 12 8 18"/>
                  </svg>
                  Remove JavaScript
                </div>
                <div class="option-description" id="desc-javascript">
                  Delete all JavaScript code and actions
                </div>
              </div>
            </label>

            <!-- Embedded Files -->
            <label class="sanitize-option">
              <input
                type="checkbox"
                name="removeEmbeddedFiles"
                ${this.options.removeEmbeddedFiles ? 'checked' : ''}
                aria-describedby="desc-embedded"
              />
              <div class="option-content">
                <div class="option-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                    <polyline points="13 2 13 9 20 9"/>
                  </svg>
                  Remove Embedded Files
                </div>
                <div class="option-description" id="desc-embedded">
                  Delete files embedded via annotations or attachments
                </div>
              </div>
            </label>
          </div>

          <!-- Quick Actions -->
          <div class="sanitize-quick-actions">
            <button class="btn-text" data-action="select-all">Select All</button>
            <button class="btn-text" data-action="select-none">Select None</button>
            <button class="btn-text" data-action="select-recommended">Recommended</button>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" data-action="cancel">Cancel</button>
          <button class="btn-primary" data-action="apply">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Apply & Export
          </button>
        </div>
      </div>
    `;

    return modal;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Close button
    const closeBtn = this.element.querySelector('[data-action="close"]');
    closeBtn?.addEventListener('click', () => this.cancel());

    // Cancel button
    const cancelBtn = this.element.querySelector('[data-action="cancel"]');
    cancelBtn?.addEventListener('click', () => this.cancel());

    // Apply button
    const applyBtn = this.element.querySelector('[data-action="apply"]');
    applyBtn?.addEventListener('click', () => this.apply());

    // Quick actions
    const selectAllBtn = this.element.querySelector('[data-action="select-all"]');
    selectAllBtn?.addEventListener('click', () => this.selectAll());

    const selectNoneBtn = this.element.querySelector('[data-action="select-none"]');
    selectNoneBtn?.addEventListener('click', () => this.selectNone());

    const selectRecommendedBtn = this.element.querySelector('[data-action="select-recommended"]');
    selectRecommendedBtn?.addEventListener('click', () => this.selectRecommended());

    // Checkboxes
    const checkboxes = this.element.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => this.updateOptions());
    });

    // Keyboard navigation
    this.element.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.cancel();
      }
    });

    // Close on overlay click
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) {
        this.cancel();
      }
    });
  }

  /**
   * Update options from checkboxes
   */
  private updateOptions(): void {
    const checkboxes = this.element.querySelectorAll('input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
      const input = checkbox as HTMLInputElement;
      const name = input.name as keyof SanitizeOptions;
      this.options[name] = input.checked;
    });
  }

  /**
   * Select all options
   */
  private selectAll(): void {
    const checkboxes = this.element.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      (checkbox as HTMLInputElement).checked = true;
    });
    this.updateOptions();
  }

  /**
   * Deselect all options
   */
  private selectNone(): void {
    const checkboxes = this.element.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      (checkbox as HTMLInputElement).checked = false;
    });
    this.updateOptions();
  }

  /**
   * Select recommended options (all privacy-critical items)
   */
  private selectRecommended(): void {
    this.options = {
      stripMetadata: true,
      removeAnnotations: true,
      removeFormFields: false, // May want to keep form structure
      stripHyperlinks: false, // May be intentional
      removeXMPMetadata: true,
      removeAttachments: true,
      removeJavaScript: true,
      removeEmbeddedFiles: true
    };

    // Update UI
    const checkboxes = this.element.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      const input = checkbox as HTMLInputElement;
      const name = input.name as keyof SanitizeOptions;
      input.checked = this.options[name];
    });
  }

  /**
   * Apply options and close
   */
  private apply(): void {
    this.saveOptions();
    this.onApply(this.options);
    this.destroy();
  }

  /**
   * Cancel and close
   */
  private cancel(): void {
    this.onCancel();
    this.destroy();
  }

  /**
   * Load options from localStorage
   */
  private loadOptions(): SanitizeOptions {
    try {
      const saved = localStorage.getItem('sanitize-options');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load sanitize options:', error);
    }

    // Default: all enabled for maximum privacy
    return {
      stripMetadata: true,
      removeAnnotations: true,
      removeFormFields: true,
      stripHyperlinks: true,
      removeXMPMetadata: true,
      removeAttachments: true,
      removeJavaScript: true,
      removeEmbeddedFiles: true
    };
  }

  /**
   * Save options to localStorage
   */
  private saveOptions(): void {
    try {
      localStorage.setItem('sanitize-options', JSON.stringify(this.options));
    } catch (error) {
      console.warn('Failed to save sanitize options:', error);
    }
  }

  /**
   * Show the modal
   */
  show(): void {
    document.body.appendChild(this.element);

    // Focus the first checkbox
    const firstCheckbox = this.element.querySelector('input[type="checkbox"]') as HTMLElement;
    firstCheckbox?.focus();
  }

  /**
   * Destroy the modal
   */
  destroy(): void {
    this.element.remove();
  }

  /**
   * Get the modal element
   */
  getElement(): HTMLElement {
    return this.element;
  }
}

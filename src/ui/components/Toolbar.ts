/**
 * Toolbar component with detection toggles and actions
 */

export interface ToolbarOptions {
  findEmails: boolean;
  findPhones: boolean;
  findSSNs: boolean;
  findCards: boolean;
  useOCR: boolean;
}

export class Toolbar {
  private element: HTMLDivElement;
  private options: ToolbarOptions;
  private onChange: (options: ToolbarOptions) => void;
  private onExport: () => void;
  private onReset: () => void;
  private onNewFile: () => void;

  constructor(
    onChange: (options: ToolbarOptions) => void,
    onExport: () => void,
    onReset: () => void,
    onNewFile: () => void
  ) {
    this.options = {
      findEmails: true,
      findPhones: true,
      findSSNs: true,
      findCards: true,
      useOCR: false
    };
    this.onChange = onChange;
    this.onExport = onExport;
    this.onReset = onReset;
    this.onNewFile = onNewFile;
    this.element = this.createToolbar();
  }

  private createToolbar(): HTMLDivElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';

    toolbar.innerHTML = `
      <div class="toolbar-section">
        <h3 class="toolbar-title">Detection</h3>
        <label class="toolbar-checkbox">
          <input type="checkbox" id="find-emails" checked>
          <span>Emails</span>
        </label>
        <label class="toolbar-checkbox">
          <input type="checkbox" id="find-phones" checked>
          <span>Phone Numbers</span>
        </label>
        <label class="toolbar-checkbox">
          <input type="checkbox" id="find-ssns" checked>
          <span>SSNs</span>
        </label>
        <label class="toolbar-checkbox">
          <input type="checkbox" id="find-cards" checked>
          <span>Card Numbers (Luhn)</span>
        </label>
        <label class="toolbar-checkbox">
          <input type="checkbox" id="use-ocr">
          <span>OCR (if needed)</span>
        </label>
      </div>

      <div class="toolbar-section">
        <button id="btn-export" class="btn btn-primary" disabled aria-label="Export redacted document">
          <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Export Redacted</span>
        </button>
        <button id="btn-new-file" class="btn btn-secondary" style="display: none;" aria-label="Start with a new file">
          <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span>New File</span>
        </button>
        <button id="btn-reset" class="btn btn-secondary" aria-label="Return to landing page">
          <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
          <span>Back to Home</span>
        </button>
      </div>

      <div class="toolbar-warning">
        <strong>⚠ Security Notice:</strong> Never use blur or pixelation for redaction.
        This tool uses solid black rectangles and flattening to prevent recovery.
      </div>

      <div class="toolbar-privacy">
        <strong>🔒 Privacy:</strong> All processing happens in your browser.
        Nothing is uploaded.
      </div>
    `;

    // Wire up event listeners
    const checkboxes = ['emails', 'phones', 'ssns', 'cards', 'ocr'];
    checkboxes.forEach((name) => {
      const checkbox = toolbar.querySelector(`#find-${name}`) as HTMLInputElement;
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          this.updateOptions();
          this.onChange(this.options);
        });
      }
    });

    toolbar.querySelector('#btn-export')?.addEventListener('click', () => {
      this.onExport();
    });

    toolbar.querySelector('#btn-new-file')?.addEventListener('click', () => {
      this.onNewFile();
    });

    toolbar.querySelector('#btn-reset')?.addEventListener('click', () => {
      this.onReset();
    });

    return toolbar;
  }

  private updateOptions() {
    this.options.findEmails = (this.element.querySelector('#find-emails') as HTMLInputElement)?.checked || false;
    this.options.findPhones = (this.element.querySelector('#find-phones') as HTMLInputElement)?.checked || false;
    this.options.findSSNs = (this.element.querySelector('#find-ssns') as HTMLInputElement)?.checked || false;
    this.options.findCards = (this.element.querySelector('#find-cards') as HTMLInputElement)?.checked || false;
    this.options.useOCR = (this.element.querySelector('#use-ocr') as HTMLInputElement)?.checked || false;
  }

  getElement(): HTMLDivElement {
    return this.element;
  }

  getOptions(): ToolbarOptions {
    return this.options;
  }

  enableExport(enabled: boolean) {
    const btn = this.element.querySelector('#btn-export') as HTMLButtonElement;
    if (btn) {
      btn.disabled = !enabled;
    }
  }

  showNewFileButton(show: boolean) {
    const newFileBtn = this.element.querySelector('#btn-new-file') as HTMLButtonElement;
    if (newFileBtn) {
      newFileBtn.style.display = show ? 'block' : 'none';
    }
  }
}

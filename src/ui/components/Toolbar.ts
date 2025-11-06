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

  constructor(
    onChange: (options: ToolbarOptions) => void,
    onExport: () => void,
    onReset: () => void
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
        <button id="btn-export" class="btn btn-primary" disabled>
          Export Redacted
        </button>
        <button id="btn-reset" class="btn btn-secondary">
          Load New Files
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
}
